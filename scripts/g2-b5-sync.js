/* I04: injectable synchronization. Loading this module performs no IO. */
(function(root,factory){const api=factory(typeof module==='object'?require('./g2-b5-core.js'):root.G2B5Core,typeof module==='object'?require('./g2-b5-storage.js'):root.G2B5Storage);if(typeof module==='object')module.exports=api;else root.G2B5Sync=api;})(globalThis,function(Core,Storage){
 'use strict';
 const LOCK='wb-g2-sync',COORD='wb_g2_sync_coord_v1',RECEIPT='wb_last_successful_push',gates=new WeakSet();
 const clone=x=>structuredClone(x),id=()=>crypto.randomUUID(),sha=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(x);
 class SyncError extends Error{constructor(code,status='confirmed-failed'){super(code);this.code=code;this.syncStatus=status;}}
 function bad(code,status){throw new SyncError(code,status);}
 function createSyncLock({manager,timeoutMs=5000,observe=()=>{}}={}){
  let verified=false;
  async function take(task){
   if(!manager?.request)bad('SYNC_LOCK_UNAVAILABLE');
   const controller=new AbortController();let entered=false;
   const timer=setTimeout(()=>controller.abort(),timeoutMs);
   observe({kind:'sync-lock-request',at:Date.now()});
   try{return await manager.request(LOCK,{mode:'exclusive',signal:controller.signal},async held=>{
    clearTimeout(timer);if(!held||held.name!==LOCK)bad('SYNC_LOCK_UNAVAILABLE');entered=true;observe({kind:'sync-lock-acquire',at:Date.now()});
    try{return await task();}finally{observe({kind:'sync-lock-release',at:Date.now()});}
   });}catch(e){if(e instanceof SyncError)throw e;bad(entered?'SYNC_OPERATION_FAILED':'SYNC_LOCK_FAILED');}finally{clearTimeout(timer);}
  }
  const gate={get verified(){return verified;},async verify(){verified=false;await take(()=>manager.request(LOCK,{mode:'exclusive',ifAvailable:true},other=>{if(other!==null)bad('SYNC_LOCK_NOT_EXCLUSIVE');}));verified=true;return {ok:true};},async run(task){if(!verified)bad('SYNC_LOCK_UNVERIFIED');return take(task);}};
  gates.add(gate);return Object.freeze(gate);
 }
 const snapshotDigest=async snapshot=>{const v=clone(snapshot);delete v.exportedAt;return Core.digest(v);};
 function parseCoord(raw){
  if(raw===null)return null;
  const p=Core.readInput(raw),v=p.value;
  if(!p.ok||!v||v.version!==1||typeof v.epoch!=='string'||!Number.isSafeInteger(v.generation)||!Array.isArray(v.unknown)||v.unknown.length>100||!Object.hasOwn(v,'owner')||!Object.hasOwn(v,'paused'))bad('COORDINATOR_INVALID');
  const allowed=new Set(['version','epoch','generation','owner','unknown','paused','lastPull']);if(Object.keys(v).some(k=>!allowed.has(k)))bad('COORDINATOR_INVALID');
  const descriptor=o=>o&&typeof o.operationId==='string'&&typeof o.pageId==='string'&&typeof o.epoch==='string'&&Number.isSafeInteger(o.generation)&&['push','pull'].includes(o.kind)&&['claimed','reading','write-dispatched','write-acknowledged','verified','applying'].includes(o.phase);
  if(v.owner!==null&&!descriptor(v.owner))bad('COORDINATOR_INVALID');
  for(const u of v.unknown)if(!u||typeof u.operationId!=='string'||typeof u.code!=='string'||typeof u.epoch!=='string')bad('COORDINATOR_INVALID');
  if(v.paused!==null&&(!v.paused||typeof v.paused.code!=='string'||typeof v.paused.epoch!=='string'))bad('COORDINATOR_INVALID');
  if(v.lastPull!=null&&(!v.lastPull||typeof v.lastPull.epoch!=='string'||typeof v.lastPull.targetDigest!=='string'||typeof v.lastPull.appliedDigest!=='string'||typeof v.lastPull.operationId!=='string'))bad('COORDINATOR_INVALID');
  return v;
 }
 function settingsValue(settings){
  if(!settings||typeof settings.epoch!=='string'||!settings.epoch||typeof settings.token!=='string')bad('CONNECTION_INVALID');
  const owner=String(settings.owner||'').trim(),repo=String(settings.repo||'').trim(),branch=String(settings.branch||'').trim(),path=settings.path||'data.json';
  if(path!=='data.json'||owner.includes('/')||repo.includes('/'))bad('CONNECTION_INVALID');
  return {owner,repo,branch,path,token:settings.token,epoch:settings.epoch};
 }
 function createSync({transport,storage,storageLock,syncLock,gateway,settings,confirmPull,
   clock={now:()=>Date.now(),setTimeout:(...a)=>globalThis.setTimeout(...a),clearTimeout:n=>globalThis.clearTimeout(n)},online=()=>true,observe=()=>{},requestTimeoutMs=15000,pageId=id()}={}){
  if(!gates.has(syncLock)||!storageLock?.run||!gateway||!settings?.read||!transport)throw Error('Explicit verified dependencies required');
  let started=false,closed=false,pending=false,revision=0,firstAt=null,timer=null,running=null,runningKind=null,pullWaiting=0,active=null,last=null,receiptCandidate=null;
  const history=[];
  const emit=(kind,op,extra={})=>{const entry={kind,at:clock.now(),pageId,...(op?{operationId:op.operationId,generation:op.generation,connectionEpoch:op.epoch,targetDigest:op.targetDigest??null}:{}),...extra};history.push(entry);try{observe(clone(entry));}catch{}};
  function currentSettings(){try{return settingsValue(settings.read());}catch(e){if(e instanceof SyncError)throw e;bad('CONNECTION_READ_FAILED');}}
  async function short(fn){const r=await storageLock.run(async()=>{try{return {value:await fn()};}catch(error){return {failure:error};}});if(r?.ok===false)bad('STORAGE_LOCK_BLOCKED');if(r?.failure)throw r.failure;return r?.value;}
  function getCoord(){try{return parseCoord(storage.getItem(COORD));}catch(e){if(e instanceof SyncError)throw e;bad('COORDINATOR_READ_FAILED');}}
  function putCoord(value){try{const raw=JSON.stringify(value);storage.setItem(COORD,raw);if(storage.getItem(COORD)!==raw)bad('COORDINATOR_VERIFY_FAILED');}catch(e){if(e instanceof SyncError)throw e;bad('COORDINATOR_WRITE_FAILED');}}
  function sameSettings(a,b){return ['owner','repo','branch','path','token','epoch'].every(k=>a[k]===b[k]);}
  async function start(){if(started)return;await syncLock.verify();await short(()=>{const cfg=currentSettings(),c=getCoord();if(c&&c.epoch!==cfg.epoch)bad('CONNECTION_EPOCH_STALE');if(!c)putCoord({version:1,epoch:cfg.epoch,generation:0,owner:null,unknown:[],paused:null,lastPull:null});});started=true;emit('boot-no-network');}
  async function fence(op){
   if(closed||active!==op||op.retired)bad('OPERATION_RETIRED',op.sent?'unknown':'confirmed-failed');
   await short(()=>{const c=getCoord();if(!c||c.epoch!==op.epoch||c.owner?.operationId!==op.operationId||c.owner?.pageId!==pageId||!sameSettings(currentSettings(),op.cfg))bad('CONNECTION_CHANGED',op.sent?'unknown':'confirmed-failed');});
  }
  function unknown(c,owner,code){
   if(!c.unknown.some(u=>u.operationId===owner.operationId))c.unknown.push({operationId:owner.operationId,pageId:owner.pageId,epoch:owner.epoch,targetDigest:owner.targetDigest??null,snapshotDigest:owner.snapshotDigest??null,at:clock.now(),code});
   if(c.unknown.length>100)bad('UNKNOWN_AUDIT_FULL');
   if(owner.epoch===c.epoch)c.paused={epoch:c.epoch,code:'UNRESOLVED_WRITE',targetDigest:owner.targetDigest??null};
  }
  async function claim(kind,manual){return short(()=>{
   const cfg=currentSettings(),c=getCoord();if(!c||c.epoch!==cfg.epoch)bad('CONNECTION_EPOCH_STALE');
   // We hold the real origin sync lock: a remaining owner is an abandoned task.
   if(c.owner){if(['write-dispatched','write-acknowledged','verified'].includes(c.owner.phase)&&c.owner.kind==='push')unknown(c,c.owner,'OWNER_INTERRUPTED');if(c.owner.kind==='pull'&&c.owner.phase==='applying')c.paused={epoch:c.epoch,code:'LOCAL_APPLY_NEEDS_CHECK',targetDigest:c.owner.targetDigest??null};c.owner=null;putCoord(c);}
   if(kind==='push'&&!manual&&c.paused)bad('AUTO_PUSH_PAUSED');
   if(!cfg.owner||!cfg.repo||(kind==='push'&&!cfg.token))bad('LOCAL_ONLY');
   const op={operationId:id(),pageId,kind,epoch:cfg.epoch,generation:++c.generation,cfg,manual,sent:false,retired:false,controllers:new Set(),lastPull:c.lastPull??null};
   c.owner={operationId:op.operationId,pageId,kind,epoch:op.epoch,generation:op.generation,phase:'claimed'};putCoord(c);active=op;return op;
  });}
  async function phase(op,value){await fence(op);await short(()=>{const c=getCoord();if(c.owner?.operationId!==op.operationId||c.epoch!==op.epoch)bad('CONNECTION_CHANGED',op.sent?'unknown':'confirmed-failed');Object.assign(c.owner,{phase:value,targetDigest:op.targetDigest??null,snapshotDigest:op.snapshotDigest??null});putCoord(c);});emit(value,op);}
  async function release(op,result){
   try{await short(()=>{const c=getCoord();if(!c)return;
    // Record old-target unknown facts without adopting a new owner's receipt/lock.
    if(result.status==='unknown')unknown(c,{...op,targetDigest:op.targetDigest},result.code||'WRITE_UNCERTAIN');
    if(op.pullRecord&&op.localResult?.ok&&c.epoch===op.epoch)c.lastPull=op.pullRecord;
    if(c.owner?.operationId===op.operationId&&c.owner?.pageId===pageId)c.owner=null;
    if(result.status==='conflict'&&c.epoch===op.epoch)c.paused={epoch:op.epoch,code:result.code,targetDigest:op.targetDigest};
    if(c.epoch===op.epoch&&result.status==='confirmed-failed'&&(/^(AUTH_|REMOTE_SNAPSHOT_INVALID|TARGET_INVALID|REMOTE_SHA_INVALID|RATE_LIMIT_|READ_RETRY_EXHAUSTED|WRITE_RATE_LIMIT_)/.test(result.code||'')))c.paused={epoch:op.epoch,code:result.code,targetDigest:op.targetDigest??null};
    putCoord(c);
   });}catch{result.coordinatorPersisted=false;result.code=result.code||'COORDINATOR_WRITE_FAILED';}
   if(active===op)active=null;
  }
  async function request(op,method,arg){
   await fence(op);const controller=new AbortController();op.controllers.add(controller);let expired=false;
   const timer=clock.setTimeout(()=>{expired=true;controller.abort();},requestTimeoutMs);
   emit('network-begin',op,{method});
   try{
    // The owner/lock is retained until the injected transport itself settles.
    // An abort-ignoring transport cannot free the owner early via Promise.race.
    const response=await transport[method](clone(arg),{signal:controller.signal,credentials:op.cfg.token});
    if(expired)bad('REQUEST_TIMEOUT',op.sent?'unknown':'confirmed-failed');
    await fence(op);emit('network-end',op,{method,httpStatus:response?.status??null});return response;
   }catch(e){emit('network-end',op,{method,errorCode:e instanceof SyncError?e.code:expired?'REQUEST_TIMEOUT':'TRANSPORT_FAILED'});if(e instanceof SyncError)throw e;bad(expired?'REQUEST_TIMEOUT':'TRANSPORT_FAILED',op.sent?'unknown':'confirmed-failed');}
   finally{clock.clearTimeout(timer);op.controllers.delete(controller);}
  }
  async function sleep(ms,op){await new Promise(resolve=>clock.setTimeout(resolve,ms));await fence(op);}
  const statusError=response=>{const n=response?.status;if(n===401||n===403)bad('AUTH_'+n);if(n===409||n===422||n===400&&response.errorCode==='GITEE_SHA_MISMATCH')bad('SHA_CONFLICT','conflict');};
  async function read(op,{allowMissing=false}={}){
   for(let attempt=0;;attempt++){
    let response,error;try{response=await request(op,'read',op.target);}catch(e){error=e;}
    if(error?.code==='CONNECTION_CHANGED'||error?.code==='OPERATION_RETIRED')throw error;
    const retryable=error||response?.status===429||response?.status>=500;
    if(retryable){if(attempt===3)throw error||new SyncError('READ_RETRY_EXHAUSTED');let delay=Math.max([2000,10000,30000][attempt],Number(response?.retryAfterMs)||0);if(delay>300000)bad('RATE_LIMIT_WAIT_TOO_LONG');emit('read-retry',op,{attempt:attempt+1,delay});await sleep(delay,op);continue;}
    statusError(response);if(response?.status===404&&allowMissing)return null;
    if(response?.status!==200)bad('REMOTE_READ_FAILED');
    if(response.raw===true&&(op.kind!=='pull'||op.cfg.token))bad('RAW_SOURCE_NOT_AUTHORIZED');
    if(!sha(response.sha)&&response.raw!==true)bad('REMOTE_SHA_INVALID');
    const checked=Core.validateExchange(response.data,{mode:Object.hasOwn(response.data||{},'exchangeRevision')?'full':'legacy-full'});
    if(!checked.ok)bad('REMOTE_SNAPSHOT_INVALID');
    const item={sha:response.sha??null,data:checked.snapshot,digest:await snapshotDigest(checked.snapshot),raw:response.raw===true};await fence(op);return item;
   }
  }
  async function target(op){let response;
   for(let attempt=0;;attempt++){let error;try{response=await request(op,'resolve',{owner:op.cfg.owner,repo:op.cfg.repo,path:op.cfg.path});}catch(e){error=e;}
    if(error&&['CONNECTION_CHANGED','OPERATION_RETIRED'].includes(error.code))throw error;
    if(!error&&response?.status!==429&&!(response?.status>=500))break;
    if(attempt===3)throw error||new SyncError('READ_RETRY_EXHAUSTED');const delay=Math.max([2000,10000,30000][attempt],Number(response?.retryAfterMs)||0);if(delay>300000)bad('RATE_LIMIT_WAIT_TOO_LONG');emit('resolve-retry',op,{attempt:attempt+1,delay});await sleep(delay,op);
   }
   statusError(response);
   const t=response?.target;if(response?.status!==200||!t||t.owner!==op.cfg.owner||t.repo!==op.cfg.repo||t.path!==op.cfg.path||typeof t.branch!=='string'||!t.branch||(op.cfg.branch&&op.cfg.branch!==t.branch))bad('TARGET_INVALID');
   op.target={owner:t.owner,repo:t.repo,branch:t.branch,path:t.path};op.targetDigest=await Core.digest(op.target);await phase(op,'reading');
  }
  async function capture(op){await fence(op);const c=await gateway.captureForSync();if(!c.ok)bad('LOCAL_SNAPSHOT_BLOCKED');const e=Core.exportExchange(c.state,{now:new Date(clock.now()).toISOString()});if(!e.ok)bad('LOCAL_SNAPSHOT_INVALID');await fence(op);op.localVerifiedCommit=true;return {snapshot:e.exchange,digest:await snapshotDigest(e.exchange)};}
  async function receipt(op,snapshotDigest,verifiedSha,{at=clock.now(),clearPause=true,sourceOperationId=op.operationId}={}){
   await fence(op);return short(()=>{const c=getCoord();if(c?.epoch!==op.epoch||c.owner?.operationId!==op.operationId||!sameSettings(currentSettings(),op.cfg))bad('CONNECTION_CHANGED','unknown');
    const value={version:1,target:op.target,targetDigest:op.targetDigest,connectionEpoch:op.epoch,operationId:sourceOperationId,at,sha:verifiedSha,snapshotDigest};
    try{const raw=JSON.stringify(value);storage.setItem(RECEIPT,raw);if(storage.getItem(RECEIPT)!==raw)return false;}catch{return false;}
    if(op.manual&&clearPause)c.paused=null;putCoord(c);return true;
   });
  }
  async function duplicate(op,digest,remote){return short(()=>{let p;try{p=Core.readInput(storage.getItem(RECEIPT)).value;}catch{return false;}
   return p?.version===1&&p.targetDigest===op.targetDigest&&p.connectionEpoch===op.epoch&&p.snapshotDigest===digest&&sha(p.sha)&&remote?.sha===p.sha&&remote.digest===digest&&!remote.raw&&Number.isFinite(p.at)&&p.at<=clock.now()&&p.at>=0;
  });}
  async function push(op){
   const local=await capture(op);op.snapshotDigest=local.digest;await target(op);
   if(!op.manual&&op.lastPull?.epoch===op.epoch&&op.lastPull.targetDigest===op.targetDigest&&op.lastPull.appliedDigest===local.digest)return {ok:true,status:'auto-superseded-by-pull',remoteWriteConfirmed:false,receiptPersisted:false,currentLocalSynchronized:false};
   const before=await read(op,{allowMissing:true});if(before?.raw)bad('PUSH_SHA_REQUIRED');const baseSha=before?.sha??null;
   if(!op.manual&&await duplicate(op,local.digest,before)){const latest=await capture(op),same=latest.digest===local.digest;op.readbackVerified=true;return {ok:true,status:same?'already-synchronized':'remote-verified/local-pending',currentLocalSynchronized:same,readbackVerified:true,receiptPersisted:true,remoteWriteConfirmed:false,deduplicated:true};}
   let response;
   for(let retry=0;;retry++){
    await phase(op,'write-dispatched');op.sent=true;
    response=await request(op,'write',{target:op.target,method:baseSha?'PUT':'POST',sha:baseSha,snapshot:local.snapshot});
    if([400,401,403,404,409,422,429].includes(response?.status))op.sent=false;
    statusError(response);
    if([400,404].includes(response?.status))bad('WRITE_REJECTED_'+response.status);
    // Only an explicit 429 response is a proven unexecuted write eligible for retry.
    if(response?.status!==429)break;
    op.sent=false;if(retry===3)bad('WRITE_RATE_LIMIT_EXHAUSTED');const delay=Math.max([2000,10000,30000][retry],Number(response.retryAfterMs)||0);if(delay>300000)bad('RATE_LIMIT_WAIT_TOO_LONG');
    await phase(op,'reading');await sleep(delay,op);const fresh=await read(op,{allowMissing:true});if((fresh?.sha??null)!==baseSha)bad('SHA_CONFLICT','conflict');
   }
   if(response?.status>=500||![200,201].includes(response?.status))bad('WRITE_RESPONSE_UNKNOWN','unknown');
   if(!sha(response.sha))bad('WRITE_SHA_MISSING','unknown');op.remoteWriteConfirmed=true;op.responseSha=response.sha;await phase(op,'write-acknowledged');
   const after=await read(op);if(after.raw||after.sha!==response.sha||after.digest!==local.digest)bad('READBACK_MISMATCH','unknown');
   op.readbackVerified=true;await phase(op,'verified');receiptCandidate={epoch:op.epoch,target:clone(op.target),targetDigest:op.targetDigest,snapshotDigest:local.digest,sha:response.sha,at:clock.now(),operationId:op.operationId};const persisted=await receipt(op,local.digest,response.sha,{at:receiptCandidate.at});op.receiptPersisted=persisted;
   const latest=await capture(op),same=latest.digest===local.digest;
   return {ok:persisted,status:persisted?(same?'current-local-synchronized':'remote-verified/local-pending'):'receipt-failed',code:persisted?null:'RECEIPT_WRITE_FAILED',remoteWriteConfirmed:true,readbackVerified:true,receiptPersisted:persisted,currentLocalSynchronized:same,sha:response.sha,snapshotDigest:local.digest};
  }
  async function pull(op){
   if(typeof confirmPull!=='function')bad('PULL_CONFIRMATION_REQUIRED');await target(op);const source=await read(op);
   const mode=Object.hasOwn(source.data,'exchangeRevision')?'full':'legacy-full';
   const prepared=await gateway.preparePull(source.data,{mode});if(!prepared.ok)bad('PULL_PREFLIGHT_BLOCKED');await fence(op);
   const empty={values:{},presence:Object.fromEntries(Core.MANAGED_KEYS.map(k=>[k,false]))},pure=await Core.prepareExchange(source.data,empty,{mode});
   if(!pure.ok)bad('PULL_PREFLIGHT_BLOCKED');const appliedExchange=Core.exportExchange(pure.plan.stage,{now:new Date(clock.now()).toISOString()});if(!appliedExchange.ok)bad('PULL_PREFLIGHT_BLOCKED');
   op.pullRecord={operationId:op.operationId,epoch:op.epoch,targetDigest:op.targetDigest,appliedDigest:await snapshotDigest(appliedExchange.exchange)};
   const c=await short(()=>getCoord());
   const accepted=await confirmPull(Object.freeze({operationId:op.operationId,target:clone(op.target),sourceSha:source.sha,sourceDigest:source.digest,planDigest:prepared.plan.planDigest,impact:clone(prepared.plan.impact),unknownWarning:c.unknown.some(x=>!x.targetDigest||x.targetDigest===op.targetDigest),warning:'先前推送结果可能未知；旧请求仍可能在远端生效。'}));
   await fence(op);if(accepted!==true)return {ok:false,status:'cancelled',localApplyVerified:false,markersFinalized:false};
   const again=await read(op);if(again.sha!==source.sha||again.digest!==source.digest||again.raw!==source.raw)bad('PULL_SOURCE_STALE');
   await phase(op,'applying');const applied=await gateway.commitPull(prepared.plan,source.data);op.localResult=applied;
   if(!applied.ok)return {ok:false,status:applied.status,code:'LOCAL_APPLY_FAILED',localApplyVerified:false,markersFinalized:applied.unlocked===true,adapterResult:applied};
   await fence(op);return {ok:true,status:'local-apply-verified',localApplyVerified:true,markersFinalized:applied.unlocked===true||applied.phase==='no-op',sourceSha:source.sha,sourceDigest:source.digest,adapterResult:applied,remoteWriteConfirmed:false,receiptPersisted:false,guarantee:source.raw?'two-content-digests; no SHA/CAS':'API SHA + content'};
  }
  // The owner must be released BEFORE releasing the origin lock. Do not use a
  // finally outside manager.request() to mutate shared ownership.
  async function lockedExecute(kind,manual){let op,result;
   try{
    if(!started||closed)bad('SYNC_NOT_STARTED');if(kind==='push'&&!online())bad('OFFLINE');
    return await syncLock.run(async()=>{
     try{op=await claim(kind,manual);emit('owner-acquire',op);result=kind==='push'?await push(op):await pull(op);}
     catch(e){result={ok:false,status:op?.sent&&e.syncStatus!=='conflict'?'unknown':e.syncStatus||'confirmed-failed',code:e instanceof SyncError?e.code:'SYNC_FAILED',remoteWriteConfirmed:!!op?.remoteWriteConfirmed,readbackVerified:!!op?.readbackVerified,receiptPersisted:!!op?.receiptPersisted,currentLocalSynchronized:false,localApplyVerified:false,markersFinalized:false};}
     if(op){await release(op,result);let targetStillCurrent=false;try{targetStillCurrent=!closed&&sameSettings(currentSettings(),op.cfg);}catch{}
      if(result.coordinatorPersisted===false){result.ok=false;result.status='coordinator-finalization-failed';result.currentLocalSynchronized=false;}
      result={localVerifiedCommit:!!op.localVerifiedCommit,pushQueued:kind==='push',transportSettled:true,transportOutcomeConfirmed:result.status!=='unknown',remoteWriteConfirmed:!!op.remoteWriteConfirmed,readbackVerified:!!op.readbackVerified,receiptPersisted:!!op.receiptPersisted,currentLocalSynchronized:false,...result,operationId:op.operationId,generation:op.generation,connectionEpoch:op.epoch,target:op.target??null,targetStillCurrent};emit('owner-release',op,{status:result.status});}return result;
    });
   }catch(e){return {ok:false,status:e.syncStatus||'confirmed-failed',code:e.code||'SYNC_LOCK_FAILED'};}
  }
  function cancelTimer(){if(timer!==null)clock.clearTimeout(timer);timer=null;firstAt=null;}
  function arm(){if(!pending||closed||pullWaiting)return;const now=clock.now();if(firstAt===null)firstAt=now;if(timer!==null)clock.clearTimeout(timer);timer=clock.setTimeout(()=>{timer=null;firstAt=null;void flush().catch(()=>{});},Math.min(1000,Math.max(0,firstAt+5000-now)));}
  async function launch(kind,manual){
   while(running){if(kind==='push'&&runningKind==='push'&&manual)return running;await running;}
   const p=lockedExecute(kind,manual);running=p;runningKind=kind;
   try{last=await p;emit('result',null,{status:last.status,code:last.code??null});return clone(last);}
   finally{if(running===p){running=null;runningKind=null;}if(pending&&!pullWaiting&&!closed)arm();}
  }
  async function flush(){if(!pending||running||pullWaiting)return {status:'waiting'};if(!online())return {status:'offline'};pending=false;cancelTimer();return launch('push',false);}
  async function onCommit(event){
   if(!started||closed)bad('SYNC_NOT_STARTED');
   if(event?.type!=='C1'||event.origin!=='user'||event.autoPushEligible!==true)return {queued:false,status:'C0'};
   revision++;pending=true;emit('local-verified-commit',null,{revision});arm();return {queued:true,revision,status:'queued'};
  }
  async function manualPush(){if(runningKind==='push')return running;pending=false;cancelTimer();return launch('push',true);}
  async function manualPull(){pullWaiting++;const saved=pending;pending=false;cancelTimer();try{const r=await launch('pull',true);if(r.localApplyVerified&&r.markersFinalized){pending=false;cancelTimer();}else if(r.status==='cancelled'||r.adapterResult?.status==='rolled-back'&&r.adapterResult.restored===true&&r.adapterResult.unlocked===true)pending=saved;return r;}finally{pullWaiting--;if(pending&&!closed)arm();}}
  async function changeConnection(next){
   if(!settings.write)bad('CONNECTION_WRITE_NOT_AVAILABLE');const value=settingsValue({...next,epoch:id()});
   // No network lock: invalidate a Push immediately. This short lock waits for
   // any local transaction; no settings change can split its multi-key commit.
   await short(()=>{const c=getCoord();if(!c)bad('COORDINATOR_INVALID');settings.write(clone(value));if(!sameSettings(settingsValue(settings.read()),value))bad('CONNECTION_VERIFY_FAILED');c.epoch=value.epoch;c.paused=null;putCoord(c);});
   pending=false;receiptCandidate=null;cancelTimer();if(active){active.retired=true;for(const c of active.controllers)c.abort();}emit('connection-changed');return {ok:true,epoch:value.epoch,autoPush:false};
  }
  async function retryReceipt(){
   if(running)bad('SYNC_BUSY');if(!started||closed||!receiptCandidate)bad('NO_VERIFIED_RECEIPT_CANDIDATE');
   const candidate=clone(receiptCandidate);return syncLock.run(async()=>{let op,r;
    try{op=await claim('push',true);if(op.epoch!==candidate.epoch||op.cfg.owner!==candidate.target.owner||op.cfg.repo!==candidate.target.repo||op.cfg.branch&&op.cfg.branch!==candidate.target.branch)bad('RECEIPT_TARGET_STALE');
     op.target=candidate.target;op.targetDigest=candidate.targetDigest;const saved=await receipt(op,candidate.snapshotDigest,candidate.sha,{at:candidate.at,clearPause:false,sourceOperationId:candidate.operationId});
     r={ok:saved,status:saved?'receipt-saved-from-verified-push':'receipt-failed',remoteWriteConfirmed:true,readbackVerified:true,receiptPersisted:saved,currentLocalSynchronized:false,pushQueued:false,networkRequests:0,sourceOperationId:candidate.operationId,at:candidate.at};return r;
    }finally{if(op)await release(op,r||{ok:false,status:'confirmed-failed',code:'RECEIPT_RETRY_FAILED'});}
   });
  }
  function close(){closed=true;pending=false;cancelTimer();if(active){active.retired=true;for(const c of active.controllers)c.abort();}emit('page-close');}
  return Object.freeze({start,onCommit,flush,manualPush,manualPull,changeConnection,retryReceipt,close,online:()=>{if(pending)arm();},history,get result(){return clone(last);},get busy(){return !!running;},get pending(){return pending;},get revision(){return revision;}});
 }
 function createApiTransport({fetch:fetcher,baseUrl,authorized=false}={}){
  if(!authorized||typeof fetcher!=='function'||typeof baseUrl!=='string')throw Error('Explicit transport authorization required');
  const base=baseUrl.replace(/\/$/,'');
  const repo=t=>base+'/repos/'+encodeURIComponent(t.owner)+'/'+encodeURIComponent(t.repo);
  const file=t=>repo(t)+'/contents/'+t.path;
  const decode=s=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g,'')),x=>x.charCodeAt(0))));
  const encode=v=>{const bytes=new TextEncoder().encode(JSON.stringify(v));let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
  async function call(url,init){const r=await fetcher(url,{cache:'no-store',credentials:'omit',redirect:'error',...init});let body=null;try{body=await r.json();}catch{}const wait=r.headers?.get('retry-after');const retryAfterMs=wait?(Number.isFinite(Number(wait))?Number(wait)*1000:Math.max(0,Date.parse(wait)-Date.now())):0;return {status:r.status,body,retryAfterMs};}
  // Header-only authentication; credentials never enter request URLs or bodies. Real Gitee auth,
  // CORS/response evidence is scoped by origin and target; it is not a universal CAS guarantee.
  return Object.freeze({
   resolve:async(t,{signal,credentials})=>{const r=await call(repo(t),{signal,headers:credentials?{Authorization:'Bearer '+credentials}:{}});return {status:r.status,target:r.body?.default_branch?{...t,branch:r.body.default_branch}:null};},
   read:async(t,{signal,credentials})=>{if(!credentials){const r=await call(base.replace(/\/api\/v5$/,'')+'/'+encodeURIComponent(t.owner)+'/'+encodeURIComponent(t.repo)+'/raw/'+encodeURIComponent(t.branch)+'/'+t.path,{signal});return {status:r.status,data:r.body,raw:true,retryAfterMs:r.retryAfterMs};}
    const r=await call(file(t)+'?ref='+encodeURIComponent(t.branch),{signal,headers:{Authorization:'Bearer '+credentials}});
    // A Gitee200 empty array alone never proves absence. Verify the repository
    // identity/default branch again, then independently inspect parent Contents.
    if(r.status===200&&Array.isArray(r.body)&&r.body.length===0&&t.path==='data.json'){
     const metadata=await call(repo(t),{signal,headers:{Authorization:'Bearer '+credentials}}),m=metadata.body;
     const owner=typeof t.owner==='string'?t.owner.toLowerCase():'',name=typeof t.repo==='string'?t.repo.toLowerCase():'';
     const identity=metadata.status===200&&Number.isSafeInteger(m?.id)&&m.id>0&&typeof m.path==='string'&&m.path.toLowerCase()===name&&[m.owner?.login,m.namespace?.path].some(x=>typeof x==='string'&&x.toLowerCase()===owner)&&m.default_branch===t.branch&&(t.repositoryId==null||t.repositoryId===m.id);
     if(identity){
      const parent=await call(repo(t)+'/contents?ref='+encodeURIComponent(t.branch),{signal,headers:{Authorization:'Bearer '+credentials}}),entries=parent.body;
      const valid=Array.isArray(entries)&&entries.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.path==='string'&&['file','dir'].includes(x.type));
      if(parent.status===200&&valid&&!entries.some(x=>x.path==='data.json'||x.name==='data.json'))return {status:404,rawStatus:200,absenceVerified:true,absenceProof:'verified-repository-branch-and-parent-contents',retryAfterMs:r.retryAfterMs};
     }
    }
    let data;try{data=decode(r.body?.content);}catch{}return {status:r.status,sha:r.body?.sha,data,retryAfterMs:r.retryAfterMs};},
   write:async(arg,{signal,credentials})=>{const body={content:encode(arg.snapshot),message:'workbench verified snapshot',branch:arg.target.branch,...(arg.sha?{sha:arg.sha}:{})};const r=await call(file(arg.target),{signal,method:arg.method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+credentials},body:JSON.stringify(body)});const message=typeof r.body?.message==='string'?r.body.message:'';
    const mismatch=r.status===400&&/\bsha\b(?:\s+(?:value|hash))?\s*(?:(?:does\s+not|doesn't|did\s+not)\s+match|mismatch(?:es)?|(?:is\s+)?(?:not\s+matching|mismatched)|has\s+changed|不匹配|不一致)/i.test(message);
    return {status:r.status,sha:r.body?.content?.sha,errorCode:mismatch?'GITEE_SHA_MISMATCH':null,retryAfterMs:r.retryAfterMs};}
  });
 }
 return Object.freeze({LOCK_NAME:LOCK,COORD_KEY:COORD,RECEIPT_KEY:RECEIPT,createSyncLock,createSync,createApiTransport,snapshotDigest,SyncError});
});
