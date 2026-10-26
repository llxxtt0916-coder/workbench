/* G2-B5 I02: injected production IO, bounded markers and origin storage lock.
 * No startup storage access, fixture branding, repair, UI, sync or network. */
(function(root,factory){
 const core=typeof module==='object'&&module.exports?require('./g2-b5-core.js'):root.G2B5Core;
 const api=factory(core);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.G2B5Storage=api;
})(globalThis,function(Core){
 'use strict';
 const KEYS=Core.MANAGED_KEYS,GUARD='wb_txn_guard',RESCUE='wb_txn_rescue',LOCK='wb-g2-storage';
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),clone=x=>structuredClone(x);
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const phases=['prepared','committing','verified','rolled-back','rollback-failed'];
 const gates=new WeakSet();
 const issue=(phase,code,key)=>({phase,code,key:key??null});
 const blocked=(phase,code,key)=>({ok:false,status:'blocked',phase,errors:[issue(phase,code,key)],events:0});
 class IOFailure extends Error{constructor(phase,code,key){super(code);this.detail=issue(phase,code,key);}}
 const fail=(phase,code,key)=>{throw new IOFailure(phase,code,key);};
 async function rawDigest(raw){
  if(raw===null)return null;
  if(typeof raw!=='string')fail('digest','INVALID_RAW',null);
  if(!globalThis.crypto?.subtle)fail('digest','DIGEST_UNAVAILABLE',null);
  const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
 }
 async function summarize(raw){return Object.fromEntries(await Promise.all(KEYS.map(async key=>[key,{present:raw[key]!==null,digest:await rawDigest(raw[key])}])));}
 function validSummary(value){
  return object(value)&&Object.keys(value).length===KEYS.length&&KEYS.every(key=>object(value[key])&&Object.keys(value[key]).sort().join(',')==='digest,present'&&typeof value[key].present==='boolean'&&(value[key].present?typeof value[key].digest==='string'&&/^[a-f0-9]{64}$/.test(value[key].digest):value[key].digest===null));
 }
 function parseMarker(raw,kind,depth=0){
  if(raw===null)return {ok:true,marker:null};
  if(typeof raw!=='string'||raw.length>131072||depth>8)return {ok:false};
  const p=Core.readInput(raw);if(!p.ok||!object(p.value))return {ok:false};
  const m=p.value,names=['format','version','operationId','phase','keys','before','after','origin','mode','sourceDigest','createdAt'];
  if(kind==='rescue')names.push('parentGuardDigest','parentOperationId','previousCandidate');
  if(Object.keys(m).some(k=>!names.includes(k))||m.format!=='g2-b5-'+kind+'-v1'||m.version!==1||typeof m.operationId!=='string'||!/^op-[a-zA-Z0-9-]{1,100}$/.test(m.operationId)||!phases.includes(m.phase)||!['user','remote-pull'].includes(m.origin)||!['full','legacy-full','partial','recovery','import'].includes(m.mode)||typeof m.createdAt!=='string'||typeof m.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(m.sourceDigest)||!Array.isArray(m.keys)||new Set(m.keys).size!==m.keys.length||m.keys.some(k=>!KEYS.includes(k))||!validSummary(m.before)||!validSummary(m.after))return {ok:false};
  if(kind==='rescue'){
   if(!(m.parentGuardDigest===null||typeof m.parentGuardDigest==='string'&&/^[a-f0-9]{64}$/.test(m.parentGuardDigest))||!(m.parentOperationId===null||typeof m.parentOperationId==='string'))return {ok:false};
   if(m.previousCandidate!==null){
    if(!object(m.previousCandidate)||Object.keys(m.previousCandidate).sort().join(',')!=='digest,marker'||typeof m.previousCandidate.digest!=='string'||!/^[a-f0-9]{64}$/.test(m.previousCandidate.digest)||!parseMarker(JSON.stringify(m.previousCandidate.marker),'rescue',depth+1).ok)return {ok:false};
   }
  }
  return {ok:true,marker:m};
 }
 function createWebLocksGate({manager=globalThis.navigator?.locks,timeoutMs=5000}={}){
  let verified=false;
  const gate={
   get verified(){return verified;},name:LOCK,
   async verify(){
    verified=false;
    if(!manager||typeof manager.request!=='function')return blocked('lock','UNSUPPORTED_LOCK',LOCK);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
     await manager.request(LOCK,{mode:'exclusive',signal:controller.signal},async held=>{
      if(!held||held.name!==LOCK)throw Error('invalid lock');
      await manager.request(LOCK,{mode:'exclusive',ifAvailable:true},other=>{if(other!==null)throw Error('lock not exclusive');});
     });
     verified=true;return {ok:true,status:'verified',phase:'lock',name:LOCK};
    }catch{return blocked('lock','LOCK_CAPABILITY_FAILED',LOCK);}finally{clearTimeout(timer);}
   },
   async run(task,{signal}={}){
    if(!verified)return blocked('lock','UNVERIFIED_LOCK',LOCK);
    const controller=new AbortController();
    const abort=()=>controller.abort();
    if(signal?.aborted)return blocked('lock','LOCK_ABORTED',LOCK);
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeoutMs);
    let entered=false;
    try{return await manager.request(LOCK,{mode:'exclusive',signal:controller.signal},async held=>{
     clearTimeout(timer);if(!held||held.name!==LOCK)return blocked('lock','LOCK_UNAVAILABLE',LOCK);
     entered=true;return task();
    });}catch(e){
     if(e instanceof IOFailure)return {ok:false,status:'blocked',phase:e.detail.phase,errors:[e.detail],events:0};
     return blocked(entered?'operation':'lock',entered?'OPERATION_FAILED':controller.signal.aborted?'LOCK_ABORTED':'LOCK_FAILED',LOCK);
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
   }
  };
  gates.add(gate);return Object.freeze(gate);
 }
 function createAdapter({storage,lock,clock=()=>new Date().toISOString(),onCommit,checkpoint}={}){
  if(!storage||!['getItem','setItem','removeItem'].every(k=>typeof storage[k]==='function'))throw Error('An explicit Storage interface is required');
  const plans=new WeakMap(),confirmations=new WeakMap();
  let quarantined=false;
  const read=(key,phase)=>{try{const raw=storage.getItem(key);if(raw!==null&&typeof raw!=='string')fail(phase,'READ_INVALID',key);return raw;}catch(e){if(e instanceof IOFailure)throw e;fail(phase,'READ_FAILED',key);}};
  const put=(key,raw,phase)=>{try{if(raw===null)storage.removeItem(key);else storage.setItem(key,raw);}catch{fail(phase,raw===null?'REMOVE_FAILED':'WRITE_FAILED',key);}};
  async function point(phase,key){if(checkpoint)await checkpoint(phase,{key:key??null});}
  function captureRaw(){return Object.fromEntries(KEYS.map(k=>[k,read(k,'capture')]));}
  const readFailure=d=>({ok:false,status:'blocked',phase:d.phase,errors:d.errors,reads:d.reads,events:0});
  function decode(raw){
   const r=Core.captureState({getItem:key=>raw[key]});
   if(!r.ok)return {...r,phase:'capture',errors:r.errors.map(x=>issue('capture',x.code,x.storageKey||x.path||x.key)),raw};
   const checked=Core.exportRecovery(r.state,{now:clock()});
   if(!checked.ok)return {ok:false,phase:'preflight',errors:checked.errors.map(x=>issue('preflight',x.code,x.path)),raw,reads:r.reads};
   return {ok:true,raw,state:{values:r.state.values,presence:r.state.presence},reads:r.reads,warnings:checked.warnings};
  }
  function markers(){
   // C01: Rescue is always read first. Ordinary inspection cannot bypass it.
   const rescue=read(RESCUE,'rescue-read'),guard=read(GUARD,'guard-read');
   return {guard,rescue};
  }
  async function markerBinding(m){return {guard:m.guard===null?null:{digest:await rawDigest(m.guard)},rescue:m.rescue===null?null:{digest:await rawDigest(m.rescue)}};}
  const run=async task=>!gates.has(lock)?blocked('lock','UNVERIFIED_LOCK',LOCK):lock.run(task);
  async function currentMatches(summary){const raw=captureRaw();return {ok:await Core.digest(await summarize(raw))===await Core.digest(summary),raw};}
  function writeMarker(key,marker,phase){
   const text=JSON.stringify(marker),kind=key===RESCUE?'rescue':'guard';
   if(!parseMarker(text,kind).ok)fail(phase,'INVALID_MARKER',key);
   put(key,text,phase);if(read(key,phase)!==text)fail(phase,'MARKER_VERIFY_FAILED',key);return text;
  }
  function owned(key,text,phase){if(read(key,phase)!==text)fail(phase,'MARKER_CHANGED',key);}
  function clearOwned(key,text,phase){
   owned(key,text,phase);
   try{put(key,null,phase);if(read(key,phase)!==null)fail(phase,'MARKER_CLEAR_FAILED',key);}
   catch(e){
    // A remove implementation may mutate and then throw. Re-establish the
    // exact owned pending marker where possible; never replace another owner.
    try{if(read(key,phase)===null){put(key,text,phase);if(read(key,phase)!==text)fail(phase,'MARKER_RESTORE_FAILED',key);}}catch{quarantined=true;}
    throw e;
   }
  }
  async function parentMatches(marker,{allowCleared=false}={}){
   const actual=read(GUARD,'parent-check');
   if(actual===null&&allowCleared&&marker.phase==='verified')return true;
   return await rawDigest(actual)===marker.parentGuardDigest;
  }
  async function finalizeRescue(marker,text){
   const target=await currentMatches(marker.after);
   if(!target.ok||!decode(target.raw).ok)fail('rescue-finalize','TARGET_VERIFY_FAILED',null);
   owned(RESCUE,text,'rescue-finalize');
   if(!await parentMatches(marker,{allowCleared:true}))fail('rescue-finalize','PARENT_GUARD_CHANGED',GUARD);
   const g=read(GUARD,'rescue-finalize');
   if(g!==null){clearOwned(GUARD,g,'rescue-finalize');await point('parent-cleared');}
   // Recheck all 19 keys and owned R before deleting the last protection.
   if(!(await currentMatches(marker.after)).ok)fail('rescue-finalize','TARGET_VERIFY_FAILED',null);
   clearOwned(RESCUE,text,'rescue-finalize');await point('rescue-cleared');
   if(read(GUARD,'rescue-finalize')!==null||read(RESCUE,'rescue-finalize')!==null)fail('rescue-finalize','MARKER_CLEAR_FAILED',RESCUE);
  }
  async function inspect(){return run(async()=>{
   const m=markers();
   if(m.rescue!==null)return blocked('inspect','RESCUE_REQUIRED',RESCUE);
   if(quarantined)return blocked('inspect','ADAPTER_QUARANTINED',null);
   if(m.guard===null){const d=decode(captureRaw());return d.ok?{ok:true,status:'clean',phase:'inspect',unlocked:true,events:0}:readFailure(d);}
   const p=parseMarker(m.guard,'guard');if(!p.ok)return blocked('inspect','UNKNOWN_GUARD',GUARD);
   const raw=captureRaw(),summary=await summarize(raw),after=await Core.digest(summary)===await Core.digest(p.marker.after),before=await Core.digest(summary)===await Core.digest(p.marker.before);
   if((!after&&!before)||!decode(raw).ok)return {ok:false,status:'uncertain',phase:'inspect',errors:[issue('inspect','INTERRUPTED_UNCERTAIN',GUARD)],unlocked:false,events:0};
   try{clearOwned(GUARD,m.guard,'inspect-finalize');return {ok:true,status:after?'verified-after':'verified-before',phase:'inspect',unlocked:true,events:0};}
   catch(e){return {ok:false,status:'uncertain',phase:'inspect-finalize',errors:[e.detail||issue('inspect-finalize','MARKER_CLEAR_FAILED',GUARD)],unlocked:false,events:0};}
  });}
  async function inspectRescue(){return run(async()=>{
   const m=markers();if(m.rescue===null)return blocked('rescue-inspect','NO_RESCUE',RESCUE);
   const p=parseMarker(m.rescue,'rescue');if(!p.ok)return blocked('rescue-inspect','UNKNOWN_RESCUE',RESCUE);
   let r=p.marker,text=m.rescue;
   if(!await parentMatches(r,{allowCleared:true}))return blocked('rescue-inspect','PARENT_GUARD_CHANGED',GUARD);
   const raw=captureRaw(),summary=await summarize(raw),after=await Core.digest(summary)===await Core.digest(r.after),before=await Core.digest(summary)===await Core.digest(r.before);
   if(after&&decode(raw).ok){
    try{if(r.phase!=='verified'){r={...r,phase:'verified'};owned(RESCUE,text,'rescue-verified');text=writeMarker(RESCUE,r,'rescue-verified');}
     await finalizeRescue(r,text);return {ok:true,status:'rescue-finalized',phase:'rescue-inspect',unlocked:true,events:0,passive:true};
    }catch(e){return {ok:false,status:'uncertain',phase:'rescue-finalization-pending',errors:[e.detail||issue('rescue-finalize','INTERRUPTED',RESCUE)],unlocked:false,events:0};}
   }
   if(before){
    try{r={...r,phase:'rolled-back'};owned(RESCUE,text,'rescue-rollback-finalize');text=writeMarker(RESCUE,r,'rescue-rollback-finalize');
     if(!await parentMatches(r))fail('rescue-rollback-finalize','PARENT_GUARD_CHANGED',GUARD);
     clearOwned(RESCUE,text,'rescue-rollback-finalize');
     return {ok:false,status:'rolled-back',phase:'rescue-before-confirmed',restored:true,restoredScope:'current-fault-scene',unlocked:m.guard===null&&decode(raw).ok,events:0};
    }catch(e){return {ok:false,status:'uncertain',phase:'rescue-rollback-finalize',errors:[e.detail||issue('rescue-inspect','MARKER_WRITE_FAILED',RESCUE)],unlocked:false,events:0};}
   }
   return {ok:false,status:'uncertain',phase:'rescue-inspect',errors:[issue('rescue-inspect','MIXED_STATE',RESCUE)],unlocked:false,events:0};
  });}
  async function capture({opaque=false}={}){return run(async()=>{
   const m=markers();if(m.rescue!==null||m.guard!==null||quarantined)return blocked('capture','TRANSACTION_PENDING',m.rescue!==null?RESCUE:GUARD);
   const raw=captureRaw(),d=decode(raw);return d.ok?{...d,phase:'capture',events:0}:opaque?{ok:true,phase:'opaque-capture',raw,invalidKeys:d.errors.map(x=>x.key),recoverableOnly:true,errors:[],events:0}:readFailure(d);
  });}
  async function prepare(input,{kind='exchange',mode='full',origin='user',rescue=false,takeover=false}={}){return run(async()=>{
   if(!['exchange','recovery'].includes(kind)||!['user','remote-pull'].includes(origin))return blocked('prepare','INVALID_OPERATION',null);
   if(rescue&&kind==='exchange'&&!['full','legacy-full'].includes(mode))return blocked('prepare','FULL_RECOVERY_REQUIRED',null);
   const m=markers();
   if(!rescue&&(m.guard!==null||m.rescue!==null||quarantined))return blocked('prepare','TRANSACTION_PENDING',m.rescue!==null?RESCUE:GUARD);
   if(rescue&&m.guard!==null){
    let parses=true;try{JSON.parse(m.guard);}catch{parses=false;}
    // P2 permits an opaque malformed G0, but an unrecognized/future JSON
    // protocol is not an opaque recovery shortcut and must remain blocked.
    if(parses&&!parseMarker(m.guard,'guard').ok)return blocked('prepare','UNKNOWN_GUARD',GUARD);
   }
   let previous=null;
   if(m.rescue!==null){
    const old=parseMarker(m.rescue,'rescue');if(!old.ok)return blocked('prepare','UNKNOWN_RESCUE',RESCUE);
    if(!rescue||!takeover)return blocked('prepare','RESCUE_REQUIRED',RESCUE);
    if(!await parentMatches(old.marker,{allowCleared:true}))return blocked('prepare','PARENT_GUARD_CHANGED',GUARD);
    previous={marker:old.marker,digest:await rawDigest(m.rescue)};
   }
   const raw=captureRaw(),d=decode(raw);
   if(!d.ok&&!rescue)return readFailure(d);
   // Full recovery has an independently complete candidate. Empty state is
   // ONLY a pure candidate-validation context, never a fake local before.
   // Actual opaque beforeRaw/presence/digest are separately bound and retained.
   const pureBefore=d.ok?d.state:{values:{},presence:Object.fromEntries(KEYS.map(k=>[k,false]))};
   const binding=await markerBinding(m),core=kind==='recovery'?await Core.prepareRecovery(input,pureBefore,{markers:binding}):await Core.prepareExchange(input,pureBefore,{mode,markers:binding});
   if(!core.ok)return {...core,status:'blocked',events:0};
   const target=core.plan.stage,after={},changes=[];
   for(const key of KEYS){
    const semanticChanged=(raw[key]===null)!==(!target.presence[key])||target.presence[key]&&(!d.ok||!d.state.presence[key]||await Core.digest(d.state.values[key])!==await Core.digest(target.values[key]));
    if(semanticChanged)changes.push(key);
    after[key]=!rescue&&!semanticChanged?raw[key]:target.presence[key]?JSON.stringify(target.values[key]):null;
   }
   const beforeSummary=await summarize(raw),afterSummary=await summarize(after),beforeRawDigest=await Core.digest(beforeSummary);
   const body={format:'g2-b5-i02-plan-v1',kind,mode:core.plan.mode,origin,rescue,corePlanDigest:core.plan.planDigest,beforeRawDigest,markerDigest:await Core.digest(binding),sourceDigest:core.plan.sourceDigest,changes,
    impact:{...clone(core.plan.impact),opaqueBefore:!d.ok,invalidKeys:d.ok?[]:d.errors.map(x=>x.key),beforePresence:Object.fromEntries(KEYS.map(k=>[k,raw[k]!==null])),afterPresence:clone(target.presence),requiresFaultSceneNotice:rescue,requiresLegacyMissingConfirmation:core.plan.impact.missingEffects.length>0,previousUnresolvedCandidate:previous!==null}};
   const plan=freeze({...body,planDigest:await Core.digest(body)});
   plans.set(plan,{core:core.plan,pureBefore,raw,after,beforeSummary,afterSummary,markers:m,binding,previous});
   return {ok:true,status:'prepared',phase:'prepared',plan,events:0};
  });}
  function confirm(plan){
   const p=plans.get(plan);if(!p)return blocked('confirm','UNTRUSTED_PLAN',null);
   const c=Core.bindConfirmation(p.core);if(!c.ok)return {...c,status:'blocked',events:0};
   const token=Object.freeze({planDigest:plan.planDigest,sourceDigest:plan.sourceDigest,beforeRawDigest:plan.beforeRawDigest,markerDigest:plan.markerDigest,mode:plan.mode});
   confirmations.set(token,{plan,core:c.confirmation});return {ok:true,confirmation:token};
  }
  async function rollback(p,marker,key,text,cause){
   const errors=[];
   for(const k of KEYS){try{put(k,p.raw[k],'rollback');}catch(e){errors.push(e.detail||issue('rollback','WRITE_FAILED',k));}}
   for(const k of KEYS){try{if(read(k,'rollback-verify')!==p.raw[k])errors.push(issue('rollback-verify','RAW_MISMATCH',k));}catch(e){errors.push(e.detail);}}
   let updated=text;
   try{owned(key,text,'rollback-marker');marker={...marker,phase:errors.length?'rollback-failed':'rolled-back'};updated=writeMarker(key,marker,'rollback-marker');}
   catch(e){errors.push(e.detail||issue('rollback-marker','MARKER_WRITE_FAILED',key));}
   if(!errors.length){
    try{if(key===RESCUE&&!await parentMatches(marker))fail('rollback-finalize','PARENT_GUARD_CHANGED',GUARD);clearOwned(key,updated,'rollback-finalize');}
    catch(e){errors.push(e.detail||issue('rollback-finalize','MARKER_CLEAR_FAILED',key));}
   }
   if(errors.length)quarantined=true;
   return {ok:false,status:errors.length?'rollback-failed':'rolled-back',phase:errors.length?'rollback-failed':cause.phase,errors:[cause],rollbackErrors:errors,restored:!errors.length,restoredScope:key===RESCUE?'current-fault-scene':'transaction-before',unlocked:!errors.length&&key!==RESCUE,events:0};
  }
  async function commit(plan,input,{confirmation,cancelled=false}={}){
   if(cancelled)return {ok:false,status:'blocked',phase:'cancelled',errors:[],events:0};
   const p=plans.get(plan),c=confirmations.get(confirmation);
   if(!p||c?.plan!==plan)return blocked('confirm','CONFIRMATION_REQUIRED',null);
   const result=await run(async()=>{
    const m=markers(),raw=captureRaw(),binding=await markerBinding(m);
    if(await Core.digest(await summarize(raw))!==plan.beforeRawDigest||await Core.digest(binding)!==plan.markerDigest)return blocked('recheck','PLAN_STALE',null);
    const checked=await Core.recheckPlan(p.core,input,p.pureBefore,{confirmation:c.core,markers:binding});
    if(!checked.ok)return {...checked,status:'blocked',events:0};
    if(quarantined&&!plan.rescue)return blocked('recheck','ADAPTER_QUARANTINED',null);
    if(!plan.rescue&&!plan.changes.length)return {ok:true,status:'committed',phase:'no-op',changes:[],events:0};
    const key=plan.rescue?RESCUE:GUARD,operationId='op-'+globalThis.crypto.randomUUID();
    let marker={format:'g2-b5-'+(plan.rescue?'rescue':'guard')+'-v1',version:1,operationId,phase:'prepared',keys:plan.rescue?[...KEYS]:[...plan.changes],before:p.beforeSummary,after:p.afterSummary,origin:plan.origin,mode:plan.mode,sourceDigest:plan.sourceDigest,createdAt:clock(),...(plan.rescue?{parentGuardDigest:await rawDigest(m.guard),parentOperationId:parseMarker(m.guard,'guard').marker?.operationId??null,previousCandidate:p.previous}:{})};
    let text=JSON.stringify(marker),businessStarted=false,verified=false;
    try{
     await point('before-marker');
     // No marker/data changed since confirmation and no replacement by owner.
     if(read(GUARD,'guard-recheck')!==m.guard||read(RESCUE,'guard-recheck')!==m.rescue)fail('guard-recheck','MARKER_CHANGED',key);
     text=writeMarker(key,marker,'marker-create');await point('marker-created');
     marker={...marker,phase:'committing'};owned(key,text,'marker-update');text=writeMarker(key,marker,'marker-update');
     for(const k of marker.keys){await point('before-write',k);businessStarted=true;put(k,p.after[k],'commit');await point('after-write',k);}
     const after=captureRaw();
     for(const k of KEYS)if(after[k]!==p.after[k])fail('post-verify','RAW_MISMATCH',k);
     if(!decode(after).ok)fail('post-verify','TARGET_INVALID',null);
     await point('post-verified');
     marker={...marker,phase:'verified'};owned(key,text,'marker-verified');text=writeMarker(key,marker,'marker-verified');verified=true;await point('marker-verified');
     if(plan.rescue)await finalizeRescue(marker,text);else clearOwned(GUARD,text,'finalize');
     quarantined=false;
     return {ok:true,status:'committed',phase:'finalized',operationId,changes:clone(plan.changes),verified:true,unlocked:true,events:0,origin:plan.origin};
    }catch(e){
     const cause=e.detail||issue('interrupted',e.interrupted===true?'INTERRUPTED':'OPERATION_FAILED',key);
     if(e.interrupted===true||verified){quarantined=true;return {ok:false,status:'uncertain',phase:verified?'rescue-finalization-pending':'interrupted',errors:[cause],operationId,unlocked:false,events:0};}
     // A marker update can mutate then throw. Adopt only this operation's
     // recognized marker for rollback; never overwrite a foreign marker.
     let actual;
     try{actual=read(key,'failure-marker');}catch{return rollback(p,marker,key,text,cause);}
     const parsed=parseMarker(actual,key===RESCUE?'rescue':'guard');
     if(!businessStarted){
      const original=key===RESCUE?p.markers.rescue:p.markers.guard;
      if(actual===original)return {ok:false,status:'blocked',phase:cause.phase,errors:[cause],events:0};
      if(!parsed.ok||parsed.marker?.operationId!==operationId){quarantined=true;return blocked('failure-marker','MARKER_CHANGED',key);}
      try{owned(key,actual,'marker-restore');if(original===null)clearOwned(key,actual,'marker-restore');else{put(key,original,'marker-restore');if(read(key,'marker-restore')!==original)fail('marker-restore','MARKER_RESTORE_FAILED',key);}
       return {ok:false,status:'blocked',phase:cause.phase,errors:[cause],restored:true,restoredScope:'marker-before',events:0};
      }catch(error){quarantined=true;return {ok:false,status:'uncertain',phase:'marker-restoration-failed',errors:[cause,error.detail||issue('marker-restore','MARKER_RESTORE_FAILED',key)],unlocked:false,events:0};}
     }
     if(parsed.ok&&parsed.marker?.operationId===operationId)text=actual;
     else if(actual!==null){quarantined=true;return blocked('failure-marker','MARKER_CHANGED',key);}
     return rollback(p,marker,key,text,cause);
    }
   });
   // Event delivery happens after the storage lock is released. No network
   // Promise is awaited while the lock is held; there is no scheduler here.
   if(result.ok&&result.status==='committed'&&result.changes?.length){
    const event={type:'C1',operationId:result.operationId,origin:result.origin,changes:result.changes,autoPushEligible:result.origin==='user'};
    result.events=1;
    if(onCommit){try{const delivery=onCommit(Object.freeze(event));if(delivery?.catch)delivery.catch(()=>{});result.eventDelivery='delivered';}catch{result.eventDelivery='failed';}}
   }
   return result;
  }
  return Object.freeze({capture,prepare,confirm,commit,inspect,inspectRescue});
 }
 return Object.freeze({MANAGED_KEYS:KEYS,GUARD_KEY:GUARD,RESCUE_KEY:RESCUE,LOCK_NAME:LOCK,createWebLocksGate,createAdapter,parseMarker,rawDigest});
});
