/* I03: real synchronous producers stage in memory; only I02 commits storage.
 * No network, scheduler, token reader, implicit migration or fixture branding. */
(function(root,factory){const api=factory(typeof module==='object'?require('./g2-b5-core.js'):root.G2B5Core,typeof module==='object'?require('./g2-b5-storage.js'):root.G2B5Storage);if(typeof module==='object')module.exports=api;else root.G2B5Bindings=api;})(globalThis,function(Core,Storage){
 'use strict';const clone=x=>structuredClone(x),keys=Core.MANAGED_KEYS;
 class GatewayError extends Error{constructor(code,detail){super(code);this.code=code;this.detail=detail;}}
 const fail=(code,detail)=>{throw new GatewayError(code,detail);};
 const recoveryMessage='提交状态未确认，需要恢复检查。请勿直接重复提交。';
 function failureState(result,attempted){
  if(result?.ok&&result.status==='committed'&&result.verified===true&&result.unlocked===true)return 'verified-committed';
  if(result?.ok&&result.phase==='no-op'&&!result.changes?.length)return 'verified-no-op';
  if(['uncertain','rollback-failed'].includes(result?.status))return 'unknown';
  if(result?.status==='rolled-back')return result.restored===true&&result.unlocked===true&&!result.rollbackErrors?.length?'verified-rolled-back':'unknown';
  if(!attempted)return 'not-started';
  // I02 can also report blocked after a foreign marker/operation failure.
  // Only its proven pre-write phases or marker-before restoration imply no write.
  if(result?.status==='blocked'&&(result.restored===true&&result.restoredScope==='marker-before'||['cancelled','confirm','recheck','preflight','capture','digest','guard-read','rescue-read','guard-recheck','marker-create','marker-update','lock'].includes(result.phase)))return 'not-started';
  return 'unknown';
 }
 async function rawSummary(raw){return Object.fromEntries(await Promise.all(keys.map(async k=>[k,{present:raw[k]!==null,digest:await Storage.rawDigest(raw[k])}])));}
 function createGateway({storage,lock,clock=()=>new Date().toISOString(),eventSink=()=>{},onChange=()=>{},onStage=()=>{}}){
  let cache=null,context=null,busy=false,lastResult=null,requiresRecovery=false;const registered=new Set(['config.save','options.save','B2.deleteMany','B3.deleteMany']),deliveries=new Map(),history=[];
  function recoveryBlocked(){const e=new GatewayError('READ_BLOCKED',lastResult?.adapterResult);e.message='READ_BLOCKED: '+recoveryMessage;e.localCommitState='unknown';throw e;}
  const adapter=Storage.createAdapter({storage,lock,clock,onCommit:event=>{
   // I02 internal local commit is not the P2 user C1 classification.
   if(event.origin==='remote-pull'){deliveries.set(event.operationId,Promise.resolve({status:'C0',autoPushEligible:false}));return;}
   const delivery=Promise.resolve().then(()=>eventSink(Object.freeze({...event,type:'C1',autoPushEligible:true}))).then(queue=>({status:'delivered',autoPushEligible:true,...(queue?.queued?{queue:clone(queue)}:{})}),()=>({status:'failed',code:'EVENT_DELIVERY_FAILED',autoPushEligible:true}));
   deliveries.set(event.operationId,delivery);return delivery;
  }});
  async function refresh(){if(requiresRecovery)recoveryBlocked();cache=null;const r=await adapter.capture();if(!r.ok)fail('READ_BLOCKED',r);cache=clone(r);return r;}
  async function initialize({allowRecoveryOnly=false}={}){if(requiresRecovery)recoveryBlocked();if(!(await lock.verify()).ok)fail('UNSUPPORTED_LOCK');const r=await adapter.inspect();if(!r.ok){if(!allowRecoveryOnly)fail('TRANSACTION_PENDING',r);cache=null;requiresRecovery=true;return {ok:false,recoveryOnly:true,diagnostics:r};}return refresh();}
  function read(key){if(requiresRecovery)recoveryBlocked();if(!keys.includes(key))fail('UNMANAGED_KEY');const s=context?.state||cache?.state;if(!s)fail('NOT_READY');return s.presence[key]?clone(s.values[key]):Core.BUSINESS_KEYS.includes(key)||Core.OPTION_KEYS.includes(key)?[]:key===Core.VERSION_KEY?1:{};}
  function write(key,value){if(!context)fail('UNCLASSIFIED_WRITE',{key});try{if(!keys.includes(key))fail('UNMANAGED_KEY');const r=Core.readInput(value);if(!r.ok)fail('INVALID_WRITE',r.errors);context.state.values[key]=clone(r.value);context.state.presence[key]=true;context.writes.add(key);context.stageRevision++;}catch(e){context.error ||= e;throw context.error;}}
  function remove(key){if(!context)fail('UNCLASSIFIED_WRITE',{key});if(!keys.includes(key)){context.error ||= new GatewayError('UNMANAGED_KEY');throw context.error;}delete context.state.values[key];context.state.presence[key]=false;context.writes.add(key);context.stageRevision++;}
  function getRaw(key){if(requiresRecovery)recoveryBlocked();const s=context?.state||cache?.state;if(!s)fail('NOT_READY');return s.presence[key]?(context?JSON.stringify(s.values[key]):cache.raw[key]):null;}
  function effect(fn){if(context){context.effects.push(fn);return;}return fn();}
  function invoke(fn,args,noChangeFalse=()=>false){
   const ctx=context;
   try{
    if(ctx.error)throw ctx.error;
    const revision=ctx.stageRevision,allowed=noChangeFalse(),before=allowed?JSON.stringify(ctx.state):null;
    const value=fn(...args);
    if(ctx.error)throw ctx.error;
    if(value?.then)fail('ASYNC_PRODUCER_NOT_ALLOWED');
    // False is failure unless this specific producer declares a proven no-op.
    // Revision counts same-key writes/removes; the state check also permits
    // unchanged future-source preservation in the approved Matter unlink.
    if(value===false&&(!allowed||ctx.stageRevision!==revision&&JSON.stringify(ctx.state)!==before))fail('PRODUCER_RETURNED_FAILURE');
    return value;
   }catch(e){ctx.error ||= e;throw ctx.error;}
  }
  async function run(name,producer,{origin='user',noChangeFalse=()=>false}={}){
   if(!registered.has(name)||!['user','remote-pull'].includes(origin))fail('UNCLASSIFIED_WRITE',{name});
   if(requiresRecovery)recoveryBlocked();
   if(context)return invoke(producer,[],noChangeFalse);
   if(busy)fail('BUSY');busy=true;let staged,commitAttempted=false,committed=null,phase='capture';
   try{
    const before=await refresh(),ctx={state:clone(before.state),writes:new Set(),stageRevision:0,effects:[],error:null};context=ctx;
    phase='producer';let value;try{invoke(onStage,[]);value=invoke(producer,[],noChangeFalse);}finally{context=null;}
    if(ctx.error)throw ctx.error;
    phase='preflight';const backup=Core.exportRecovery(ctx.state,{now:clock()});if(!backup.ok)fail('PREFLIGHT_FAILED',backup);
    phase='prepare';const p=await adapter.prepare(backup.backup,{kind:'recovery',origin});if(!p.ok)fail('PREPARE_FAILED',p);
    // Pure producer evaluation is outside the storage lock. Bind its actual
    // captured raw before, so another tab's later edit is never overwritten.
    phase='bind';if(p.plan.beforeRawDigest!==await Core.digest(await rawSummary(before.raw)))fail('PLAN_STALE');
    phase='confirm';const confirmation=adapter.confirm(p.plan);if(!confirmation.ok)fail('CONFIRMATION_FAILED',confirmation);
    commitAttempted=true;phase='commit';committed=await adapter.commit(p.plan,backup.backup,{confirmation:confirmation.confirmation});
    if(!committed.ok)fail('TRANSACTION_FAILED',committed);
    cache={ok:true,state:clone(ctx.state),raw:Object.fromEntries(keys.map(k=>[k,(committed.changes||[]).includes(k)?ctx.state.presence[k]?JSON.stringify(ctx.state.values[k]):null:before.raw[k]]))};
    const pending=deliveries.get(committed.operationId);let timer;
    const delivery=pending?await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'failed',code:'EVENT_DELIVERY_TIMEOUT',autoPushEligible:origin==='user'}),5000);})]):{status:'C0',autoPushEligible:false};clearTimeout(timer);deliveries.delete(committed.operationId);
    lastResult={ok:true,name,value,status:committed.changes?.length?'committed':'no-op',phase:committed.phase,adapterResult:clone(committed),localCommitState:committed.changes?.length?'verified-committed':'verified-no-op',localVerified:true,localCommitted:!!committed.changes?.length,autoPushEligible:origin==='user'&&!!committed.changes?.length,changes:committed.changes||[],internalEvents:committed.events||0,userC1:origin==='user'&&(committed.events||0)?1:0,delivery,pushQueued:delivery.queue?.queued===true?'queued':'NOT IMPLEMENTED',remotePush:delivery.queue?'pending':'NOT IMPLEMENTED'};
    history.push({...lastResult,value:undefined});
    for(const f of ctx.effects){try{const effect=f();if(effect?.catch)effect.catch(()=>{lastResult.viewRefresh={status:'failed',code:'VIEW_REFRESH_FAILED'};});}catch{lastResult.viewRefresh={status:'failed',code:'VIEW_REFRESH_FAILED'};}}
    try{onChange(lastResult);}catch{lastResult.viewRefresh={status:'failed',code:'VIEW_REFRESH_FAILED'};}return lastResult;
   }catch(e){
    staged=e;const diagnostics=committed||e.detail?.status&&e.detail||null,state=failureState(diagnostics,commitAttempted);cache=null;
    if(state==='unknown'){requiresRecovery=true;e.message=(e.code||'TRANSACTION_FAILED')+': '+recoveryMessage;}
    e.localCommitState=state;
    const isCommitted=state==='verified-committed',eligible=isCommitted&&origin==='user';
    lastResult={...(diagnostics?clone(diagnostics):{}),ok:false,name,status:diagnostics?.status||'blocked',phase:diagnostics?.phase||phase,adapterResult:diagnostics?clone(diagnostics):null,localCommitState:state,localCommitted:state==='unknown'?null:isCommitted,localVerified:state.startsWith('verified-'),autoPushEligible:eligible,code:e.code||'PRODUCER_FAILED',message:e.message,detail:e.detail,userC1:eligible?(diagnostics?.events||0):0,delivery:{status:isCommitted?'failed':'C0',autoPushEligible:eligible},viewRefresh:{status:'blocked',code:state==='unknown'?'COMMIT_STATE_UNKNOWN':'NOT_VERIFIED'}};
    history.push(lastResult);throw e;
   }finally{
    context=null;
    if(staged&&!requiresRecovery){try{await refresh();lastResult.viewRefresh={status:'verified-snapshot'};try{onChange(lastResult);}catch{lastResult.viewRefresh={status:'failed',code:'VIEW_REFRESH_FAILED'};}}catch{cache=null;lastResult.viewRefresh={status:'blocked',code:'READ_BLOCKED'};}}
    busy=false;
   }
  }
  function operation(name,fn,{observeError=()=>{},noChangeFalse=()=>false}={}){registered.add(name);return function(...args){const permitsNoop=()=>noChangeFalse.apply(this,args);if(context)return invoke(fn.bind(this),args,permitsNoop);const p=run(name,()=>fn.apply(this,args),{noChangeFalse:permitsNoop}).then(r=>r.value);p.catch(e=>{try{observeError(e);}catch{}});return p;};}
  function wrapStore(name,store){const mutations=new Set(['create','edit','state','delete','subtask','reorder','transaction','linkManual','createManual','deleteMany','setInspiration']);return Object.fromEntries(Object.entries(store).map(([k,v])=>[k,typeof v==='function'&&mutations.has(k)?operation(name+'.'+k,v.bind(store)):v]));}
  function batch(name,fn){return run(name,fn).then(r=>r.value);}
  function mergeConfig(raw,view,edited){
   if(JSON.stringify(view)===JSON.stringify(edited))return clone(raw);
   if(Array.isArray(view)&&Array.isArray(edited))return edited.map(row=>{if(row&&typeof row==='object'&&!Array.isArray(row)&&row.id!==undefined){const i=view.findIndex(x=>x?.id!==undefined&&String(x.id)===String(row.id));return i<0?clone(row):mergeConfig((raw||[]).find(x=>String(x?.id)===String(row.id))||{},view[i],row);}return clone(row);});
   if(view&&edited&&typeof view==='object'&&typeof edited==='object'&&!Array.isArray(view)&&!Array.isArray(edited)){const out=raw&&typeof raw==='object'?clone(raw):{};for(const k of new Set([...Object.keys(view),...Object.keys(edited)])){if(!Object.hasOwn(edited,k))delete out[k];else if(JSON.stringify(view[k])!==JSON.stringify(edited[k]))out[k]=mergeConfig(raw?.[k],view[k],edited[k]);}return out;}
   return clone(edited);
  }
  async function captureForSync(){if(requiresRecovery)recoveryBlocked();return adapter.capture();}
  async function preparePull(input,{mode='full'}={}){
   if(busy)fail('BUSY');
   let p=await adapter.prepare(input,{kind:'exchange',mode,origin:'remote-pull'});
   if(!p.ok&&(requiresRecovery||p.errors?.some(e=>['TRANSACTION_PENDING','ADAPTER_QUARANTINED'].includes(e.code))))p=await adapter.prepare(input,{kind:'exchange',mode,origin:'remote-pull',rescue:true,takeover:true});
   return p;
  }
  const dataPlans=new WeakSet();
  async function prepareData(input,{kind='exchange',mode='full'}={}){
   if(busy)fail('BUSY');if(!['exchange','recovery'].includes(kind))fail('INVALID_OPERATION');
   let p=await adapter.prepare(input,{kind,mode,origin:'user'});
   if(!p.ok&&(requiresRecovery||p.errors?.some(e=>['TRANSACTION_PENDING','ADAPTER_QUARANTINED'].includes(e.code))))p=await adapter.prepare(input,{kind,mode,origin:'user',rescue:true,takeover:true});
   if(p.ok)dataPlans.add(p.plan);return p;
  }
  async function commitData(plan,input,{accepted=false}={}){
   if(!accepted)return {ok:false,status:'cancelled',events:0};if(!dataPlans.has(plan))fail('UNTRUSTED_PLAN');if(busy)fail('BUSY');busy=true;cache=null;let r;
   try{const c=adapter.confirm(plan);if(!c.ok)return c;r=await adapter.commit(plan,input,{confirmation:c.confirmation});
    if(!r.ok){const state=failureState(r,true);if(state==='unknown')requiresRecovery=true;lastResult={...clone(r),localCommitState:state,localCommitted:state==='unknown'?null:false,autoPushEligible:false,delivery:{status:'C0'}};if(!requiresRecovery){const fresh=await adapter.capture();if(fresh.ok)cache=clone(fresh);}return lastResult;}
    const fresh=await adapter.capture();if(!fresh.ok){requiresRecovery=true;lastResult={...clone(r),ok:false,status:'uncertain',localCommitState:'unknown',localCommitted:null,autoPushEligible:false,delivery:{status:'C0'}};return lastResult;}
    requiresRecovery=false;cache=clone(fresh);let timer;const delivery=deliveries.has(r.operationId)?await Promise.race([deliveries.get(r.operationId),new Promise(resolve=>timer=setTimeout(()=>resolve({status:'failed',code:'EVENT_DELIVERY_TIMEOUT'}),5000))]):{status:'C0'};clearTimeout(timer);deliveries.delete(r.operationId);
    lastResult={...clone(r),localCommitState:r.changes?.length?'verified-committed':'verified-no-op',localCommitted:!!r.changes?.length,autoPushEligible:!!r.changes?.length,delivery};try{onChange(lastResult);}catch{lastResult.viewRefresh={status:'failed',code:'VIEW_REFRESH_FAILED'};}return lastResult;
   }finally{busy=false;}
  }
  async function commitPull(plan,input){
   if(busy)fail('BUSY');busy=true;cache=null;
   try{
    const c=adapter.confirm(plan);if(!c.ok)return c;
    const r=await adapter.commit(plan,input,{confirmation:c.confirmation});
    if(!r.ok){if(failureState(r,true)==='unknown')requiresRecovery=true;
     if(!requiresRecovery){const fresh=await adapter.capture();if(fresh.ok)cache=clone(fresh);}return r;}
    // Only full I02 post-verification AND marker finalization followed by a
    // fresh strict capture can lift the I03 recovery latch. Never inspect G0
    // alone or merely clear the in-memory flag to resume ordinary producers.
    const fresh=await adapter.capture();if(!fresh.ok){requiresRecovery=true;return {...r,ok:false,status:'uncertain',phase:'pull-capture',unlocked:false};}
    requiresRecovery=false;cache=clone(fresh);try{onChange({origin:'remote-pull',localVerified:true,autoPushEligible:false});}catch{}
    return r;
   }finally{busy=false;}
  }
  return Object.freeze({initialize,refresh,read,write,remove,getRaw,effect,operation,wrapStore,batch,run,mergeConfig,captureForSync,preparePull,commitPull,prepareData,commitData,get busy(){return busy;},get active(){return !!context;},get requiresRecovery(){return requiresRecovery;},get result(){return lastResult;},history,
   saveConfig:(raw,view,value)=>run('config.save',()=>{if(JSON.stringify(read('wb_config'))!==JSON.stringify(raw))fail('CONFIG_STALE');write('wb_config',mergeConfig(raw,view,value));}).then(r=>r.value),
   saveOptions:(key,value)=>run('options.save',()=>{if(!Core.OPTION_KEYS.includes(key))fail('UNMANAGED_KEY');write(key,value);}).then(r=>r.value)});
 }
 async function installBrowser(w,{db,optionsCache,eventSink}={}){
  // Bound native methods remain private to I02; legacy managed writes go to stage.
  const storage=w.localStorage,proto=Object.getPrototypeOf(storage),native={getItem:proto.getItem.bind(storage),setItem:proto.setItem.bind(storage),removeItem:proto.removeItem.bind(storage)};
  const lock=Storage.createWebLocksGate({manager:w.navigator.locks});let sync=null;
  const gateway=createGateway({storage:native,lock,eventSink:eventSink||((e)=>{w.G2B5_SYSTEM?.onLocalCommit(e);return sync?sync.onCommit(e):w.dispatchEvent(new w.CustomEvent('g2-business-commit',{detail:e}));}),onStage:()=>{
   for(const key of Core.OPTION_KEYS)optionsCache[key.slice(8)]=gateway.read(key);
  },onChange:()=>{
   for(const key of Core.OPTION_KEYS)optionsCache[key.slice(8)]=gateway.read(key);
   w.G2B2_APP?.refresh();w.G2B5_SYSTEM?.notify();
  }});
  const original={get:proto.getItem,set:proto.setItem,remove:proto.removeItem,clear:proto.clear};
  proto.getItem=function(k){return this===storage&&keys.includes(String(k))?gateway.getRaw(String(k)):original.get.call(this,k);};
  proto.setItem=function(k,v){if(this===storage&&keys.includes(String(k))){let parsed;try{parsed=JSON.parse(v);}catch{fail('INVALID_WRITE');}return gateway.write(String(k),parsed);}if(this===storage&&[Storage.GUARD_KEY,Storage.RESCUE_KEY].includes(String(k)))fail('UNCLASSIFIED_WRITE');return original.set.call(this,k,v);};
  proto.removeItem=function(k){if(this===storage&&keys.includes(String(k)))return gateway.remove(String(k));if(this===storage&&[Storage.GUARD_KEY,Storage.RESCUE_KEY].includes(String(k)))fail('UNCLASSIFIED_WRITE');return original.remove.call(this,k);};
  proto.clear=function(){if(this===storage)fail('UNCLASSIFIED_WRITE');return original.clear.call(this);};
  if(db){db.set=(key,value)=>gateway.write(key,value);db.raw=key=>gateway.read(key);db.get=key=>gateway.read(key).filter(row=>!row.deleted);}
  const boot=await gateway.initialize({allowRecoveryOnly:!!w.G2B5Sync});
  const normalize=w.G2B1.normalizeConfig,oldDefault=w.defaultConfig;
  const configRaw=()=>gateway.read('wb_config');
  w.getConfig=()=>normalize(gateway.getRaw('wb_config')===null?oldDefault():configRaw());
  w.saveConfig=function(value){const raw=configRaw(),view=w.getConfig();if(gateway.active){gateway.write('wb_config',gateway.mergeConfig(raw,view,value));return;}return gateway.saveConfig(raw,view,value);};
  const app={gateway,recoveryOnly:boot.recoveryOnly===true,feedback:msg=>gateway.requiresRecovery?recoveryMessage:gateway.result?.delivery.status==='failed'?'本地已保存，但提交事件投递失败':msg,saveConfig:value=>w.saveConfig(value),saveOptions:(k,v)=>gateway.saveOptions(k,v),coverage:[],seal,
   async bootSystem(options={}){if(w.G2B5_SYSTEM)fail('SYSTEM_ALREADY_BOUND');const system=w.G2B5UI.createController({...options,gateway,storage:native,lock,configureSync:opts=>app.configureSync(opts)});await system.initialize();w.G2B5_SYSTEM=system;return system;},
   async configureSync(options){
    if(sync)fail('SYNC_ALREADY_BOUND');if(!w.G2B5Sync)fail('SYNC_MODULE_NOT_READY');
    const candidate=w.G2B5Sync.createSync({online:()=>w.navigator.onLine!==false,...options,storage:native,storageLock:lock,gateway,syncLock:w.G2B5Sync.createSyncLock({manager:w.navigator.locks,observe:options.observe})});
    await candidate.start();sync=candidate;w.G2B5_SYNC=sync;
    w.addEventListener('online',()=>sync.online());w.addEventListener('pagehide',()=>sync.close());return sync;
   }};w.G2B5_APP=app;
  function seal(){
   function unlinkedMatterNoop(ledger,id){
    if(!Object.values(w.G2B1.MATTER_TYPES).includes(ledger))return false;
    const empty=value=>value===undefined||value===null||value==='';
    const rows=gateway.read(ledger).filter(row=>w.G2B1.sameId(row.id,id));
    if(rows.length!==1||rows[0].deleted||!empty(rows[0].matter_id))return false;
    const record=w.matterRecord(ledger,id);
    // null is the formal reader's documented non-member result; unexpected
    // undefined is not evidence of no association. Numeric0 is never empty.
    return record===null||!!record&&typeof record==='object'&&w.G2B1.sameId(record.id,id)&&empty(record.matter_id);
   }
   const names=['linkMatterRecords','unlinkMatterRecord','renameMatter','cleanupDeletedMatterRecord','removeMatterSourceReferences','pruneEmptyMatter','matterChooseExisting','saveMatterName','completePendingLinkedRecord','setState','applyState','createLedgerItem','smartSave','saveLinkedNewRecord','upsertConfig','setConfigStatus','moveConfigRow','moveConfigEntry','deleteConfigRow','saveConfigEditor','toggleConfigEntry','deleteConfigEntry','saveCommonOrg','saveOptionStore','addMultiOption','deleteOptionItem','editOptionItem','clearMultiOptions','saveTodo','deleteTodo','skipRecurringPeriod','toggleRecurringPause','addSubtask','toggleSubtask','deleteSubtask','writeWorkSubtasks','moveSubtask','moveSubtaskTo','dropSubtask','editCardSubtask','saveInspiration','archiveInsp','abandonInsp','restoreInsp','deleteInsp','saveContract','deleteContract','savePurchase','deletePurchase','saveAgency','deleteAgency','saveHandover','deleteHandover','saveFund','deleteFund','saveFundRecord','deleteFundRecord','saveExpense','deleteExpense','saveMeeting','deleteMeeting','saveTraining','deleteTraining','deleteBulk','deleteActiveItem'];
   for(const name of names)if(typeof w[name]==='function'){w[name]=gateway.operation('legacy.'+name,w[name],{observeError:e=>{try{w.toast(e.message);}catch{}},noChangeFalse:name==='unlinkMatterRecord'?unlinkedMatterNoop:()=>false});app.coverage.push({name,status:'GATEWAY'});}
   if(typeof w.confirmAction==='function'){const confirmed=w.confirmAction;w.confirmAction=function(message,callback,...rest){return gateway.effect(()=>confirmed(message,gateway.operation('legacy.confirmed',callback,{observeError:e=>w.toast(e.message)}),...rest));};}
   for(const name of ['repairData','repairMatterRelations','ensureV14','ensureV16Data','migrateWorkSourceOrgIds','retireVerifiedLegacyMirrors','snapshotBeforeV14','restoreV14','removeObsoleteInvoiceCredentials'])if(typeof w[name]==='function'){w[name]=()=>fail('PASSIVE_MUTATION_BLOCKED');app.coverage.push({name,status:'PASSIVE_BLOCKED'});}
   for(const name of ['importData','restoreAll','saveSettings','loadSettings','checkBackup','manualPush','manualPull','testSync','deployHTML'])if(typeof w[name]==='function'){w[name]=()=>fail('SYSTEM_OPERATION_NOT_AUTHORIZED');app.coverage.push({name,status:'LATER_PACKAGE_BLOCKED'});}
   for(const name of ['saveQuickNote','deleteQuickNoteConfirmed'])if(typeof w[name]==='function'){w[name]=()=>fail('RETIRED_FEATURE_BLOCKED');app.coverage.push({name,status:'RETIRED_BLOCKED'});}
   for(const name of ['push','pull'])if(w.GITEE&&typeof w.GITEE[name]==='function')w.GITEE[name]=()=>{const p=Promise.reject(new GatewayError('I04_NOT_AUTHORIZED'));p.catch(e=>w.toast(e.message));return p;};
   for(const name of ['toast','closeModal','refreshAll','renderTodos','renderTodo','renderPurchases','renderContracts','renderExpenses','renderMeetings','renderTrainings','renderHandovers','renderFunds','renderFundRecords','renderAgencys','renderInspiration','refreshConfigConsumers','renderMultiOptions','renderMatterPanel','rerenderV16WorkViews','renderConfigPage'])if(typeof w[name]==='function'){const fn=w[name];w[name]=function(...args){return gateway.effect(()=>fn.apply(this,args));};}
   if(w.G2B2_APP){const refresh=w.G2B2_APP.refresh;w.G2B2_APP.refresh=()=>gateway.effect(refresh);}
   if(!gateway.requiresRecovery)for(const key of Core.OPTION_KEYS)optionsCache[key.slice(8)]=gateway.read(key);
  }
  w.addEventListener('storage',event=>{if(keys.includes(event.key)||event.key===null)gateway.refresh().then(()=>w.G2B2_APP?.refresh()).catch(()=>{app.readError={code:'READ_BLOCKED'};try{w.toast?.(gateway.requiresRecovery?recoveryMessage:'数据未通过核验，后续写入已阻止。');}catch{}});});return app;
 }
 return Object.freeze({createGateway,installBrowser,GatewayError});
});
