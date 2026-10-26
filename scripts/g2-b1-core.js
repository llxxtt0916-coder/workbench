/* G2-B1 pure data contracts. Commit/restore accept only branded fixture adapters.
 * No browser storage, DOM, credentials, network or startup migration access. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.G2B1=api;
})(globalThis,function(){
 'use strict';
 const SCHEMA_VERSION=2;
 const BUSINESS_KEYS=Object.freeze(['todos','inspirations','contracts','purchases','expenses','meetings','trainings','agencys','handovers','funds','fundRecords','quick_notes','matters']);
 const OPTION_KEYS=Object.freeze(['wb_opts_agencyMethod','wb_opts_todoCategory','wb_opts_todoSource']);
 const VERSION_KEY='wb_schema_version';
 const MATTER_TYPES=Object.freeze({work:'todos',purchase:'purchases',contract:'contracts',expense:'expenses',meeting:'meetings',training:'trainings',agency:'agencys'});
 // Stored nested business fields, not a rule for same-named unknown extensions.
 const NESTED_FIELDS={todos:['subtasks'],purchases:['items'],meetings:['actionItems'],handovers:['items'],funds:['subcategories']};
 const REFERENCES={todos:{contractRef:'contracts',purchaseRef:'purchases',expenseRef:'expenses',meetingRef:'meetings',trainingRef:'trainings'},purchases:{},expenses:{fundItem:'funds'},fundRecords:{fundId:'funds',expenseRef:'expenses'}};
 const REGISTRY=Object.freeze({
  business:Object.freeze(Object.fromEntries(BUSINESS_KEYS.map(key=>[key,Object.freeze({storageKey:key,exchange:true,recoveryRaw:true,idType:key==='matters'?'string':'number|string',nestedFields:Object.freeze(NESTED_FIELDS[key]||[]),references:Object.freeze({...REFERENCES[key],...(Object.values(MATTER_TYPES).includes(key)?{matter_id:'matters',related_sources:'typed Matter members'}:{}),...(key==='todos'?{parent_goal:'todos:<id>'}:{})})})]))),
  config:Object.freeze({storageKey:'wb_config',snapshotKey:'config',exchange:true,idType:'string'}),
  version:Object.freeze({storageKey:VERSION_KEY,exchange:false,metadata:true}),
  options:Object.freeze(OPTION_KEYS.map(storageKey=>Object.freeze({storageKey,exchange:false,recoveryRaw:true})))
 });
 const clone=v=>v===undefined?undefined:structuredClone(v);
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const own=(v,k)=>Object.hasOwn(v,k);
 const sameId=(a,b)=>a!==undefined&&a!==null&&b!==undefined&&b!==null&&String(a)===String(b);
 const findRecord=(rows,id)=>(Array.isArray(rows)?rows:[]).find(r=>sameId(r?.id,id));
 const sensitive=k=>/(?:token|secret|password|credential|api[_-]?key|wb_baidu_(?:ak|sk))/i.test(k);
 const error=(code,message)=>({code,message});
 const signature=v=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const equal=(a,b)=>signature(a)===signature(b);
 function jsonProblems(v,path='',errors=[],parents=new Set()){
  if(typeof v==='number'&&!Number.isFinite(v))errors.push(error('INVALID_NUMBER',path));
  else if(v===undefined||typeof v==='function'||typeof v==='symbol'||typeof v==='bigint')errors.push(error('INVALID_JSON_VALUE',path));
  else if(v&&typeof v==='object'){
   if(parents.has(v)){errors.push(error('CYCLIC_INPUT',path));return errors;}
   if(!Array.isArray(v)&&Object.prototype.toString.call(v)!=='[object Object]'){errors.push(error('INVALID_JSON_OBJECT',path));return errors;}
   parents.add(v);
   for(const [k,x] of Object.entries(v)){
    const next=path?path+'.'+k:k;
    if(sensitive(k))errors.push(error('SECRET_FIELD',next));
    if(['__proto__','constructor','prototype'].includes(k))errors.push(error('UNSAFE_KEY',next));
    jsonProblems(x,next,errors,parents);
   }
   parents.delete(v);
  }
  return errors;
 }
 function parseInput(input){
  try{return {ok:true,value:typeof input==='string'?JSON.parse(input):clone(input)};}
  catch{return {ok:false,errors:[error('INVALID_JSON','JSON cannot be parsed')]};}
 }
 function detectVersion(data){
  if(!object(data))return {ok:false,errors:[error('INVALID_ROOT','Snapshot must be an object')]};
  const version=own(data,'schemaVersion')?data.schemaVersion:1;
  if(!Number.isInteger(version)||version<1)return {ok:false,errors:[error('INVALID_VERSION','schemaVersion must be a positive integer')]};
  if(version>SCHEMA_VERSION)return {ok:false,errors:[error('FUTURE_VERSION','Unsupported snapshot version')]};
  return {ok:true,version,legacy:version===1};
 }
 function nextNumericId(raw){
  const occupied=new Set(raw.map(r=>String(r.id)));
  let max=0;
  for(const r of raw){const n=Number(r.id);if(/^[0-9]+$/.test(String(r.id))&&Number.isSafeInteger(n)&&n>max)max=n;}
  let id=max+1;while(occupied.has(String(id)))id++;
  if(!Number.isSafeInteger(id))throw new Error('Numeric ID space exhausted');
  return id;
 }
 function patchRecord(old,patch){
  if(own(patch,'id')&&own(old,'id')&&!sameId(old.id,patch.id))throw new Error('Existing ID cannot change');
  const result={...clone(old),...clone(patch)};
  if(own(old,'id'))result.id=old.id;
  return result;
 }
 function patchNested(items,id,patch){
  if(!findRecord(items,id))throw new Error('Nested item ID not found');
  return items.map(item=>sameId(item.id,id)?patchRecord(item,patch):clone(item));
 }
 function readTraining(record){
  return {...clone(record),location:typeof record.location==='string'?record.location:'',days:typeof record.days==='number'&&Number.isFinite(record.days)&&record.days>0?record.days:null};
 }
 function writeTraining(old,patch){
  const edits=clone(patch);
  if(own(edits,'location')&&typeof edits.location!=='string')throw new Error('location must be a string');
  if(own(edits,'days')){
   if(edits.days==='')edits.days=null;
   if(edits.days!==null&&(typeof edits.days!=='number'||!Number.isFinite(edits.days)||edits.days<=0))throw new Error('days must be a finite positive number or null');
  }
  return patchRecord(old,edits);
 }
 const states=Object.freeze(['未开始','进行中','已完成','已关闭']);
 function readState(key,record){
  if(record.state_manual&&states.includes(record.state))return record.state;
  const status=String(record.status||'');
  if(!status)return states.includes(record.state)?record.state:null;
  const mappings={
   todos:{'进行中':'进行中','已完成':'已完成','已取消':'已关闭','已关闭':'已关闭'},
   contracts:{'执行中':'进行中','已签':'进行中','已过期':'进行中','已到期':'进行中','已完成':'已完成','已终止':'已关闭','已解除':'已关闭','已关闭':'已关闭'},
   purchases:{'申请中':'未开始','已采购':'已完成','已完成':'已完成','已到货':'已完成','已取消':'已关闭','已拒绝':'已关闭'},
   expenses:{'待报销':'未开始','已报销':'已完成','已取消':'已关闭'},
   agencys:{'待委托':'未开始','已委托':'进行中','已完成':'已完成','已流标':'已关闭','已取消':'已关闭'},
   handovers:{'进行中':'进行中','交接中':'进行中','已完成':'已完成','已结束':'已完成','已取消':'已关闭'},
   funds:{'进行中':'进行中','已完成':'已完成','已关闭':'已关闭'}
  };
  if(states.includes(status))return status;
  return mappings[key]?.[status]||record.state||null;
 }
 function datePart(value){
  if(typeof value!=='string')return null;
  const m=value.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  if(d.getUTCFullYear()!==+m[1]||d.getUTCMonth()!==+m[2]-1||d.getUTCDate()!==+m[3])return null;
  if(!m[4])return value;
  if(!/^T.*(?:Z|[+-]\d{2}:\d{2})$/.test(m[4])||!Number.isFinite(Date.parse(value)))return null;
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 }
 function eventDate(key,record){
  const state=readState(key,record);
  const fields=state==='已关闭'?['closed_at']:state==='已完成'?(key==='expenses'?['reimbDate','completeDate','completedDate','closed_at']:['completeDate','completedDate','doneDate','closed_at']):[];
  for(const field of fields){const date=datePart(record[field]);if(date)return date;}
  return null;
 }
 function transition(key,record,state,now){
  if(!states.includes(state)||!datePart(now))throw new Error('Invalid state event');
  const next=patchRecord(record,{state,state_manual:true});
  if(key==='todos')next.status=state;
  if(state==='已完成'||state==='已关闭'){next.closed_at=now;next.closed_by='user';}
  if(key==='todos'&&state==='已完成')next.completeDate=datePart(now);
  return next;
 }
 function normalizeConfig(input){
  const config=object(input)?clone(input):{};
  const rows=values=>(Array.isArray(values)?values:[]).map(row=>({...row,status:['active','inactive'].includes(row.status)?row.status:row.disabled===true?'inactive':'active',sort_order:Number.isFinite(Number(row.sort_order??row.sortOrder))?Number(row.sort_order??row.sortOrder):0}));
  config.organizations=rows(config.organizations);
  config.dictionaries=object(config.dictionaries)?config.dictionaries:{};
  config.dictionaries.work_categories=rows(config.dictionaries.work_categories);
  return config;
 }
 function goalReferenceId(value){
  if(typeof value!=='string')return null;
  const match=value.match(/^todos:(.+)$/);
  return match&&match[0]===value&&match[1].trim()?match[1]:null;
 }
 function checkReferences(data,{warnings,errors,profile='strict'}){
  // Only this explicit transport profile preserves evidenced dangling ID fields.
  const dangling=(code,path,value,shape='id')=>{
   const item={...error(code,path),path};
   const safeId=shape==='goal'?goalReferenceId(value)!==null:typeof value==='string'&&value.trim()||typeof value==='number'&&Number.isSafeInteger(value);
   if(profile==='b5-history'&&safeId){item.classification='WARN';item.evidenceRule='P2-06.1.1-reference';warnings.push(item);}
   else errors.push(item);
  };
  for(const [key,fields] of Object.entries(REFERENCES))for(const r of data[key]||[]){
   if(r.deleted)continue;
   for(const [field,target] of Object.entries(fields)){
    if(r[field]===null||r[field]===undefined||r[field]==='')continue;
    if(!own(data,target)){warnings.push(error('REFERENCE_UNCHECKED',key+'.'+field));continue;}
    if(!findRecord(data[target],r[field]))dangling('BROKEN_REFERENCE',key+'.'+field,r[field]);
   }
  }
  for(const [index,r] of (data.todos||[]).entries()){
   if(profile==='b5-history'){
    if(!own(r,'parent_goal')||r.parent_goal===null||r.parent_goal==='')continue;
    const targetId=goalReferenceId(r.parent_goal);
    if(targetId===null){errors.push({...error('INVALID_GOAL_REFERENCE','todos.parent_goal'),path:'todos['+index+'].parent_goal'});continue;}
    if(r.deleted)continue;
    const target=findRecord(data.todos,targetId);
    const path='todos['+index+'].parent_goal';
    if(!target)dangling('BROKEN_GOAL_REFERENCE',path,r.parent_goal,'goal');
    else if(sameId(target.id,r.id))errors.push({...error('SELF_GOAL_REFERENCE',path),path});
    else if(target.is_goal!==true)errors.push({...error('NON_GOAL_REFERENCE',path),path});
    continue;
   }
   // Preserve the original strict/fixture behavior, including empty-value handling.
   if(r.deleted||!r.parent_goal)continue;
   const m=String(r.parent_goal).match(/^todos:(.+)$/),target=m&&findRecord(data.todos,m[1]);
   if(!target||!target.is_goal||sameId(target.id,r.id))dangling('BROKEN_GOAL_REFERENCE','todos.parent_goal',r.parent_goal);
  }
  for(const key of Object.values(MATTER_TYPES))for(const r of data[key]||[]){
   if(r.deleted)continue;
   if(r.matter_id&&own(data,'matters')&&!findRecord(data.matters,r.matter_id))warnings.push(error('DANGLING_MATTER',key+'.matter_id'));
   if(own(r,'related_sources')){
    if(!Array.isArray(r.related_sources))errors.push(error('INVALID_RELATION_SOURCES',key+'.related_sources'));
    else for(const ref of r.related_sources){
     if(!object(ref)||typeof ref.type!=='string'||ref.id===undefined||ref.id===null)errors.push(error('INVALID_RELATION_SOURCE',key+'.related_sources'));
     else if(!MATTER_TYPES[ref.type])warnings.push(error('UNVERIFIED_RELATION_SOURCE',key+'.related_sources'));
    }
   }
  }
  for(const key of ['expenses','fundRecords'])for(const r of data[key]||[]){
   if(r.deleted||!r.subcategoryId)continue;
   const fund=findRecord(data.funds,key==='expenses'?r.fundItem:r.fundId);
   if(fund&&!findRecord(fund.subcategories||[],r.subcategoryId))dangling('BROKEN_SUBCATEGORY_REFERENCE',key+'.subcategoryId',r.subcategoryId);
  }
 }
 function preflight(input,{mode='import',profile='strict'}={}){
  const parsed=parseInput(input);if(!parsed.ok)return parsed;
  const data=parsed.value,v=detectVersion(data);if(!v.ok)return v;
  const errors=jsonProblems(data),warnings=[],missing=[];
  if(!['strict','b5-history'].includes(profile))errors.push(error('INVALID_PROFILE','Unknown validation profile'));
  if(own(data,'backupFormat'))errors.push(error('RECOVERY_NOT_EXCHANGE','Use the recovery restore contract'));
  for(const key of Object.keys(data))if(!BUSINESS_KEYS.includes(key)&&!['schemaVersion','exportedAt','config'].includes(key)){
   if(Array.isArray(data[key]))errors.push(error('UNREGISTERED_COLLECTION',key));
   else warnings.push(error('UNMANAGED_METADATA',key));
  }
  if(!['import','full'].includes(mode))errors.push(error('INVALID_MODE','Use import or full'));
  for(const key of BUSINESS_KEYS){
   if(!own(data,key)){missing.push(key);continue;}
   if(!Array.isArray(data[key])){errors.push(error('INVALID_COLLECTION',key));continue;}
   const seen=new Set();
   for(const [index,r] of data[key].entries()){
    const idPath=profile==='b5-history'?{path:key+'['+index+'].id'}:{};
    if(!object(r)||!(typeof r.id==='string'&&r.id.trim()||typeof r.id==='number'&&Number.isSafeInteger(r.id))){errors.push({...error('INVALID_RECORD_ID',key),...idPath});continue;}
    if(seen.has(String(r.id)))errors.push({...error('DUPLICATE_ID',key),...idPath});seen.add(String(r.id));
    if(key==='trainings'){
     if(own(r,'location')&&typeof r.location!=='string')errors.push(error('INVALID_TRAINING_LOCATION',key));
     if(own(r,'days')&&r.days!==null&&(typeof r.days!=='number'||!Number.isFinite(r.days)||r.days<=0))errors.push(error('INVALID_TRAINING_DAYS',key));
    }
    const nestedFields=profile==='b5-history'?REGISTRY.business[key].nestedFields:['items','subtasks','actionItems','subcategories'];
    for(const field of nestedFields)if(own(r,field)){
     if(!Array.isArray(r[field]))errors.push(error('INVALID_NESTED_COLLECTION',key+'.'+field));
     else{
      const ids=new Set();
      for(const [itemIndex,item] of r[field].entries()){
       if(!object(item)){
        if(profile==='b5-history'&&key==='purchases'&&field==='items'&&(typeof item==='string'||item===null||item===0))
         warnings.push({...error('LEGACY_PURCHASE_ITEM',key+'.'+field),path:key+'.'+field,classification:'WARN',evidenceRule:'P2-06.1.1-purchase-items'});
        else errors.push(error('INVALID_NESTED_ITEM',key+'.'+field));
        continue;
       }
       if(own(item,'id')){if(ids.has(String(item.id)))errors.push({...error('DUPLICATE_NESTED_ID',key+'.'+field),...(profile==='b5-history'?{path:key+'['+index+'].'+field+'['+itemIndex+'].id'}:{})});ids.add(String(item.id));}
      }
     }
    }
   }
  }
  if(!own(data,'config'))missing.push('config');
  else if(!object(data.config))errors.push(error('INVALID_CONFIG','config must be an object'));
  else{
   if(own(data.config,'organizations')&&!Array.isArray(data.config.organizations))errors.push(error('INVALID_CONFIG_ROWS','organizations'));
   if(own(data.config,'dictionaries')&&!object(data.config.dictionaries))errors.push(error('INVALID_CONFIG_ROWS','dictionaries'));
   for(const rows of [data.config.organizations,data.config.dictionaries?.work_categories])if(Array.isArray(rows)){
    const seen=new Set();for(const r of rows){if(!object(r)||typeof r.id!=='string'||!r.id.trim()||typeof r.name!=='string'||!r.name.trim())errors.push(error('INVALID_CONFIG_RECORD','config'));else if(seen.has(r.id))errors.push(error('DUPLICATE_CONFIG_ID','config'));else seen.add(r.id);}
   }
  }
  for(const key of ['relations','goals','ledger'])if(own(data,key))errors.push(error('MIRROR_COLLECTION_FORBIDDEN',key));
  if(mode==='full'&&missing.length)errors.push(error('MISSING_FULL_COLLECTIONS',missing.join(', ')));
  if(!errors.length)checkReferences(data,{warnings,errors,profile});
  return {ok:!errors.length,version:v.version,legacy:v.legacy,mode,missing,errors,warnings,snapshot:data};
 }
 function matterRecord(snapshot,ref){
  const key=MATTER_TYPES[ref.type];if(!key)return null;
  const r=findRecord(snapshot[key],ref.id);
  if(!r||r.deleted||r.owner_ledger&&r.owner_ledger!==key||key==='todos'&&(r.is_goal||/^(contracts|purchases|expenses|meetings|trainings|agencys):/.test(r.origin||'')))return null;
  return r;
 }
 function repairSnapshot(input){
  const snapshot=clone(input),warnings=[];
  for(const key of Object.values(MATTER_TYPES))for(const r of snapshot[key]||[]){
   if(r.deleted)continue;
   if(r.matter_id&&Array.isArray(snapshot.matters)&&!findRecord(snapshot.matters,r.matter_id)){
    delete r.matter_id;delete r.related_sources;warnings.push(error('REMOVED_DANGLING_MATTER',key));
   }
   if(Array.isArray(r.related_sources))r.related_sources=r.related_sources.filter(ref=>{
    if(!MATTER_TYPES[ref.type]){warnings.push(error('UNVERIFIED_RELATION_SOURCE',key));return true;}
    const target=matterRecord(snapshot,ref),valid=target&&r.matter_id&&sameId(target.matter_id,r.matter_id);
    if(!valid)warnings.push(error('REMOVED_DANGLING_SOURCE',key));return valid;
   });
  }
  return {snapshot,warnings};
 }
 function linkMatter(input,sourceRef,targetRef){
  if(!MATTER_TYPES[sourceRef.type]||!MATTER_TYPES[targetRef.type])return {status:'unsupported',snapshot:clone(input)};
  const snapshot=clone(input),source=matterRecord(snapshot,sourceRef),target=matterRecord(snapshot,targetRef);
  if(!source||!target)return {status:'missing',snapshot};
  if(sourceRef.type===targetRef.type&&sameId(source.id,target.id))return {status:'same-record',snapshot};
  if(source.matter_id&&target.matter_id&&!sameId(source.matter_id,target.matter_id))return {status:'conflict',snapshot};
  let id=source.matter_id||target.matter_id;
  if(id&&!findRecord(snapshot.matters||[],id))return {status:'missing-matter',snapshot};
  if(!id){let n=1;while(findRecord(snapshot.matters||[],'matter_'+n))n++;id='matter_'+n;(snapshot.matters||=[]).push({id,name:source.name||source.content||'未命名事项'});}
  source.matter_id=id;target.matter_id=id;target.related_sources||=[];
  if(!target.related_sources.some(r=>r.type===sourceRef.type&&sameId(r.id,source.id)))target.related_sources.push({type:sourceRef.type,id:source.id});
  return {status:'linked',snapshot};
 }
 function unlinkMatter(input,ref){
  const snapshot=clone(input),r=matterRecord(snapshot,ref);if(!r?.matter_id)return {status:'missing',snapshot};
  const matterId=r.matter_id;delete r.matter_id;delete r.related_sources;
  for(const key of Object.values(MATTER_TYPES))for(const row of snapshot[key]||[])if(Array.isArray(row.related_sources))row.related_sources=row.related_sources.filter(s=>!(s.type===ref.type&&sameId(s.id,ref.id)));
  if(!Object.values(MATTER_TYPES).some(k=>(snapshot[k]||[]).some(row=>!row.deleted&&sameId(row.matter_id,matterId))))snapshot.matters=(snapshot.matters||[]).filter(m=>!sameId(m.id,matterId));
  return {status:'unlinked',snapshot};
 }
 const fixtures=new WeakSet();
 function assertFixture(adapter){if(!fixtures.has(adapter))throw new Error('Only a B1 fixture adapter may commit or restore');}
 function createMemoryAdapter(initial={},faults={}){
  const values=new Map(Object.entries(clone(initial)));let writes=0,failed=false,rollingBack=false;
  const adapter={
   read:key=>clone(values.get(key)),has:key=>values.has(key),dump:()=>Object.fromEntries([...values].map(([k,v])=>[k,clone(v)])),
   get writes(){return writes;},
   write(key,value){
    writes++;
    if(rollingBack&&faults.failRollback)throw new Error('Injected rollback write failure');
    if(!failed&&writes===faults.failAt){failed=true;throw new Error('Injected commit failure');}
    values.set(key,writes===faults.corruptAt?[{id:'corrupt-fixture'}]:clone(value));
   },
   remove:key=>{if(rollingBack&&faults.failRollback)throw new Error('Injected rollback remove failure');values.delete(key);},
   setRollback:flag=>{rollingBack=flag;}
  };
  fixtures.add(adapter);return adapter;
 }
 const managedKeys=[...BUSINESS_KEYS,'wb_config',...OPTION_KEYS,VERSION_KEY];
 function createRecovery(adapter,{now=new Date().toISOString(),appVersion='v1.7.0+g2-b1'}={}){
  assertFixture(adapter);
  const businessRaw=Object.fromEntries(BUSINESS_KEYS.map(k=>[k,adapter.read(k)??[]]));
  const businessOptions=Object.fromEntries(OPTION_KEYS.filter(k=>adapter.has(k)).map(k=>[k,adapter.read(k)]));
  return {backupFormat:'g2-recovery-v1',createdAt:now,sourceSchemaVersion:adapter.read(VERSION_KEY)??1,businessRaw,config:adapter.read('wb_config')??{},businessOptions,meta:{appVersion,presence:Object.fromEntries(managedKeys.map(k=>[k,adapter.has(k)]))}};
 }
 function validateRecovery(input){
  const p=parseInput(input);if(!p.ok)return p;const b=p.value,errors=jsonProblems(b);
  if(!object(b)||b.backupFormat!=='g2-recovery-v1')return {ok:false,errors:[error('INVALID_BACKUP_FORMAT','Unsupported recovery format')]};
  if(!datePart(b.createdAt)||!Number.isInteger(b.sourceSchemaVersion)||b.sourceSchemaVersion<1||b.sourceSchemaVersion>2)errors.push(error('INVALID_BACKUP_META','Invalid backup version/date'));
  if(!object(b.businessRaw)||BUSINESS_KEYS.some(k=>!Array.isArray(b.businessRaw[k])))errors.push(error('INVALID_BACKUP_BUSINESS','All raw arrays required'));
  if(!object(b.config)||!object(b.businessOptions)||Object.keys(b.businessOptions).some(k=>!OPTION_KEYS.includes(k)))errors.push(error('INVALID_BACKUP_CONFIG','Invalid config/options'));
  if(!object(b.meta?.presence)||managedKeys.some(k=>typeof b.meta.presence[k]!=='boolean'))errors.push(error('INVALID_BACKUP_PRESENCE','Original key presence required'));
  return {ok:!errors.length,errors,backup:b};
 }
 function backupValues(backup){return {...backup.businessRaw,wb_config:backup.config,...backup.businessOptions,[VERSION_KEY]:backup.sourceSchemaVersion};}
 function writeRecovery(adapter,backup){
  const values=backupValues(backup);for(const key of managedKeys){if(backup.meta.presence[key])adapter.write(key,values[key]);else adapter.remove(key);}
  verifyValues(adapter,values,backup.meta.presence);
 }
 function verifyValues(adapter,values,presence){
  for(const key of managedKeys){
   const exists=presence?presence[key]:own(values,key);
   if(adapter.has(key)!==exists||exists&&!equal(adapter.read(key),values[key]))throw new Error('Post-verify failed for '+key);
  }
 }
 function restoreRecovery(adapter,input){
  assertFixture(adapter);const validation=validateRecovery(input);if(!validation.ok)return validation;
  const before=createRecovery(adapter);const beforeCheck=validateRecovery(before);if(!beforeCheck.ok)return beforeCheck;
  try{writeRecovery(adapter,validation.backup);return {ok:true,verified:true};}
  catch(cause){
   try{adapter.setRollback(true);writeRecovery(adapter,before);return {ok:false,restored:true,errors:[error('RESTORE_FAILED',cause.message)]};}
   catch(restore){return {ok:false,phase:'rollback-failed',restored:false,errors:[error('RESTORE_FAILED',cause.message),error('ROLLBACK_FAILED',restore.message)]};}
   finally{adapter.setRollback(false);}
  }
 }
 function applySnapshot(adapter,input,{mode='import',dryRun=false,now=new Date().toISOString()}={}){
  assertFixture(adapter);
  const checked=preflight(input,{mode});if(!checked.ok)return {...checked,phase:'preflight'};
  const recovery=createRecovery(adapter,{now}),backupCheck=validateRecovery(recovery);
  if(!backupCheck.ok)return {...backupCheck,phase:'backup'};
  const staged={schemaVersion:2,...clone(recovery.businessRaw),config:clone(recovery.config)};
  for(const key of BUSINESS_KEYS)if(own(checked.snapshot,key))staged[key]=clone(checked.snapshot[key]);
  if(own(checked.snapshot,'config'))staged.config=normalizeConfig(checked.snapshot.config);
  const repaired=repairSnapshot(staged),verified=preflight(repaired.snapshot,{mode:'full'});
  if(!verified.ok)return {...verified,phase:'stage',recovery};
  const values={...backupValues(recovery),...Object.fromEntries(BUSINESS_KEYS.map(k=>[k,repaired.snapshot[k]])),wb_config:repaired.snapshot.config,[VERSION_KEY]:2};
  const presence={...recovery.meta.presence,...Object.fromEntries([...BUSINESS_KEYS,'wb_config',VERSION_KEY].map(k=>[k,true]))};
  const changes=managedKeys.filter(k=>presence[k]!==recovery.meta.presence[k]||presence[k]&&!equal(values[k],adapter.read(k)));
  if(dryRun)return {ok:true,phase:'dry-run',changes,warnings:[...checked.warnings,...repaired.warnings],staged:repaired.snapshot,recovery};
  try{
   // Commit only business arrays/config/version; recovery-only options stay local.
   for(const key of [...BUSINESS_KEYS,'wb_config',VERSION_KEY])adapter.write(key,values[key]);
   verifyValues(adapter,values,presence);
   return {ok:true,phase:'committed',verified:true,changes,warnings:[...checked.warnings,...repaired.warnings],recovery};
  }catch(cause){
   try{adapter.setRollback(true);writeRecovery(adapter,recovery);return {ok:false,phase:'rolled-back',restored:true,errors:[error('COMMIT_FAILED',cause.message)],recovery};}
   catch(restore){return {ok:false,phase:'rollback-failed',restored:false,errors:[error('COMMIT_FAILED',cause.message),error('ROLLBACK_FAILED',restore.message)],recovery};}
   finally{adapter.setRollback(false);}
  }
 }
 function exchangeSnapshot(raw,config,{now=new Date().toISOString()}={}){
  const result={schemaVersion:2,exportedAt:now,...Object.fromEntries(BUSINESS_KEYS.map(k=>[k,clone(raw[k]||[]).filter(r=>!r.deleted)])),config:normalizeConfig(config)};
  const errors=jsonProblems(result);if(errors.length)throw new Error('Snapshot contains unsafe fields');return result;
 }
 // Shared pure inspection grants no fixture or production write authority.
 return Object.freeze({SCHEMA_VERSION,BUSINESS_KEYS,OPTION_KEYS,VERSION_KEY,REGISTRY,MATTER_TYPES,sameId,findRecord,nextNumericId,patchRecord,patchNested,readTraining,writeTraining,readState,eventDate,transition,normalizeConfig,detectVersion,jsonProblems,goalReferenceId,preflight,repairSnapshot,linkMatter,unlinkMatter,createMemoryAdapter,createRecovery,validateRecovery,restoreRecovery,applySnapshot,exchangeSnapshot});
});
