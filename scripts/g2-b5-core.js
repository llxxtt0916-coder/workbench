/* G2-B5 I01: pure Exchange/Recovery validation, plans and injected reads only.
 * No production storage, mutation, DOM, scheduler, fetch, migration or repair.
 * B1 remains the collection/ID authority and retains its branded fixture APIs. */
(function(root,factory){
 const b1=typeof module==='object'&&module.exports?require('./g2-b1-core.js'):root.G2B1;
 const api=factory(b1);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.G2B5Core=api;
})(globalThis,function(B1){
 'use strict';
 if(!B1)throw new Error('G2B1 is required');
 const BUSINESS_KEYS=B1.BUSINESS_KEYS, OPTION_KEYS=B1.OPTION_KEYS;
 const VERSION_KEY=B1.VERSION_KEY, META_KEY='wb_exchange_meta';
 const MANAGED_KEYS=Object.freeze([...BUSINESS_KEYS,'wb_config',...OPTION_KEYS,VERSION_KEY,META_KEY]);
 // Scope existing history rules to actual stored business fields (P2 06.1.1,
 // B1 eventDate, B3 fields and B4 fields). Same-named extensions are not inputs
 // to those rules. This describes transport ownership, never new writer semantics.
 const lifecycleDates=['createdAt','updatedAt','completeDate','completedDate','doneDate','closed_at','reopened_at'];
 const historyDates={
  // B2 stores issueDate/deadline/due_date; due is a legacy input and dueDate
  // is a Matter date alias. None is an unmanaged arbitrary extension in todos.
  todos:[...lifecycleDates,'issueDate','deadline','due_date','due','dueDate'],purchases:[...lifecycleDates,'date'],contracts:[...lifecycleDates,'signDate','expiry'],
  expenses:[...lifecycleDates,'appDate','reimbDate','invoiceDate'],meetings:[...lifecycleDates,'date'],
  trainings:[...lifecycleDates,'startDate','endDate'],handovers:[...lifecycleDates,'date'],
  funds:lifecycleDates,agencys:[...lifecycleDates,'date','docDate'],fundRecords:['createdAt','updatedAt','date'],
  inspirations:['createdAt','updatedAt'],quick_notes:['createdAt','updatedAt'],matters:['createdAt','updatedAt']
 };
 const historyNumbers={purchases:['amount'],contracts:['amount'],expenses:['amount'],fundRecords:['amount'],funds:['budget'],agencys:['budget','dealAmount'],trainings:['fee','credits']};
 const REGISTRY=Object.freeze({
  business:B1.REGISTRY.business,config:B1.REGISTRY.config,version:B1.REGISTRY.version,
  options:Object.freeze(B1.REGISTRY.options.map(x=>Object.freeze({...x,exchange:true}))),
  exchangeMeta:Object.freeze({storageKey:META_KEY,exchange:true,recoveryRaw:true,businessCollection:false})
 });
 const ROOT_KEYS=new Set(['schemaVersion','exchangeRevision','exportedAt',...BUSINESS_KEYS,'config','businessOptions']);
 const MIRRORS=new Set(['relations','goals','work','ledger']);
 const own=(v,k)=>Object.hasOwn(v,k), object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const clone=v=>structuredClone(v);
 const emptyConfig=()=>({organizations:[],dictionaries:{work_categories:[]}});
 const id=v=>typeof v==='string'&&!!v.trim()||typeof v==='number'&&Number.isSafeInteger(v);
 const emptyRef=v=>v===null||v==='';
 const diagnostic=(code,path,classification='HARD',evidenceRule='P2-06.1.1')=>({code,path,classification,evidenceRule});
 const rejected=(errors,warnings=[])=>({ok:false,errors,warnings});
 const canonical=v=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&validDate(v)&&Number.isFinite(Date.parse(v));
 function validDate(v){
  if(typeof v!=='string')return false;
  const m=v.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);if(!m)return false;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3];
 }
 // Inspect descriptors before B1 inspection/structuredClone: getters and sparse
 // arrays must not execute or silently become different JSON data.
 function transportProblems(value,path='',errors=[],parents=new Set()){
  if(!value||typeof value!=='object')return errors;
  if(parents.has(value)){errors.push(diagnostic('CYCLIC_INPUT',path));return errors;}
  const proto=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&proto!==null&&Object.getPrototypeOf(proto)!==null){
   errors.push(diagnostic('INVALID_JSON_OBJECT',path));return errors;
  }
  parents.add(value);
  if(Array.isArray(value))for(let i=0;i<value.length;i++)if(!own(value,String(i)))errors.push(diagnostic('SPARSE_ARRAY',path+'['+i+']'));
  for(const key of Reflect.ownKeys(value)){
   if(Array.isArray(value)&&key==='length')continue;
   const p=path?path+'.'+String(key):String(key),desc=Object.getOwnPropertyDescriptor(value,key);
   if(typeof key!=='string'||!desc.enumerable||!own(desc,'value')){errors.push(diagnostic('UNSAFE_DESCRIPTOR',p));continue;}
   if(Array.isArray(value)&&!(/^(0|[1-9]\d*)$/.test(key)&&Number(key)<value.length))errors.push(diagnostic('ARRAY_EXTRA_FIELD',p));
   if(/^wb_(?:gitee_|txn_|last_|backup_|v14_)/.test(key)||['deviceSettings','syncReceipt'].includes(key))errors.push(diagnostic('DEVICE_FIELD_FORBIDDEN',p));
   transportProblems(desc.value,p,errors,parents);
  }
  parents.delete(value);return errors;
 }
 function readInput(input){
  let value;
  try{value=typeof input==='string'?JSON.parse(input):input;}
  catch{return rejected([diagnostic('INVALID_JSON','$')]);}
  let errors;
  try{
   errors=transportProblems(value);
   if(!errors.length)errors=B1.jsonProblems(value).map(x=>diagnostic(x.code,x.message||'$','HARD','B1-json-safety'));
  }catch{return rejected([diagnostic('UNSAFE_INPUT','$')]);}
  if(errors.length)return rejected(errors);
  try{return {ok:true,value:clone(value)};}
  catch{return rejected([diagnostic('INVALID_JSON_VALUE','$')]);}
 }
 function classifyHistory(data){
  const input=readInput(data);
  if(!input.ok)return {...input,classifications:input.errors};
  if(!object(input.value))return {...rejected([diagnostic('INVALID_ROOT','$')]),classifications:[]};
  data=input.value;
  const errors=[],warnings=[],classifications=[];
  const note=(code,path,classification,rule,recordId)=>{
   const x={...diagnostic(code,path,classification,rule),...(recordId!==undefined?{recordId}: {})};
   classifications.push(x);if(classification==='HARD')errors.push(x);else if(classification==='WARN')warnings.push(x);
  };
  const hard=(path,rule,recordId)=>note('UNVERIFIED_HISTORY_SHAPE',path,'HARD',rule,recordId);
  const knownFields=new Set(('id name title content deleted createdAt updatedAt state state_manual status assignee owner note tags recurrence source category source_org_ids work_category_ids parent_goal related_sources matter_id contractRef purchaseRef expenseRef meetingRef trainingRef fundItem subcategoryId fundId expenseRef fund_link_migrated amount budget dealAmount fee price quantity qty days location credits attendees actionItems items subtasks subcategories date startDate endDate due dueDate appDate reimbDate completeDate completedDate doneDate closed_at reopened_at signDate expiry invoiceDate docDate disabled sortOrder agency_result_meta closed_reason closed_by reopened_by is_goal organizer organizer_org_id').split(' '));
  const dates=new Set(['date','createdAt','updatedAt','startDate','endDate','due','dueDate','issueDate','deadline','due_date','appDate','reimbDate','completeDate','completedDate','doneDate','closed_at','reopened_at','signDate','expiry','invoiceDate','docDate']);
  const numeric=new Set(['amount','budget','dealAmount','fee','credits']);
  const nestedNames=new Set(['items','subtasks','actionItems','subcategories']);
  const references=new Set(['contractRef','purchaseRef','expenseRef','meetingRef','trainingRef','fundItem','subcategoryId','fundId','matter_id','parent_goal']);
  for(const key of BUSINESS_KEYS){
   if(!Array.isArray(data[key]))continue;
   data[key].forEach((row,i)=>{
    if(!object(row))return;const base=key+'['+i+']',rid=row.id;
    const nestedFields=B1.REGISTRY.business[key].nestedFields,dateFields=historyDates[key],numberFields=historyNumbers[key]||[];
    for(const [field,value] of Object.entries(row)){
     const p=base+'.'+field;
     if(!knownFields.has(field)&&!dateFields.includes(field)||nestedNames.has(field)&&!nestedFields.includes(field)||dates.has(field)&&!dateFields.includes(field)||numeric.has(field)&&!numberFields.includes(field))
      note('UNMANAGED_RECORD_FIELD',p,'WARN','P2-06.1.1-safe-extension',rid);
     if(field==='deleted'&&typeof value!=='boolean')hard(p,'tombstone-boolean',rid);
     if(['state','status'].includes(field)&&value!==null&&typeof value!=='string')hard(p,'unverified-state',rid);
     if(dateFields.includes(field)){
      if(value!==null&&typeof value!=='string')hard(p,'unverified-date',rid);
      else if(value!==null&&value!==''&&!validDate(value))note('UNKNOWN_DATE',p,'WARN','P2-06.1.1-date',rid);
      else note('DATE_VIEW',p,'VIEW-only','P2-06.1.1-date',rid);
     }
     if(numberFields.includes(field)){
      if(value!==null&&!['string','number'].includes(typeof value))hard(p,'unverified-numeric',rid);
      else note('HISTORICAL_NUMBER',p,typeof value==='number'?'VIEW-only':'WARN','P2-06.1.1-money',rid);
     }
     if(key==='todos'&&field==='parent_goal'){
      if(!emptyRef(value)&&B1.goalReferenceId(value)===null)note('INVALID_GOAL_REFERENCE',p,'HARD','P2-06.1.1-parent-goal',rid);
     }else if(references.has(field)&&!emptyRef(value)&&!id(value))hard(p,'P2-06.1.1-reference',rid);
    }
    if(key==='todos'){
     for(const field of ['source','category'])if(own(row,field)){
      const v=row[field],p=base+'.'+field;
      if(!(typeof v==='string'||Array.isArray(v)&&v.every(x=>typeof x==='string')))hard(p,'P2-06.1.1-todo-text',rid);
      else note('LEGACY_TEXT_VIEW',p,'VIEW-only','P2-06.1.1-todo-text',rid);
     }
     for(const field of ['source_org_ids','work_category_ids'])if(own(row,field)){
      // G2-V06 approved: retain only this exact legacy empty source placeholder.
      const legacyEmpty=field==='source_org_ids'&&Array.isArray(row[field])&&row[field].length===1&&row[field][0]==='';
      if(legacyEmpty)note('LEGACY_EMPTY_SOURCE_ORG_ID',base+'.'+field,'WARN','V06-approved-preserve-single-empty-source-placeholder',rid);
      else if(!Array.isArray(row[field])||!row[field].every(x=>typeof x==='string'&&id(x)))hard(base+'.'+field,'unverified-config-reference',rid);
     }
     if(own(row,'recurrence'))note('RECURRENCE_PRESERVED',base+'.recurrence','VIEW-only','B1-original-recurrence',rid);
    }
    if(key==='trainings'){
     if(own(row,'days')){
      const v=row.days;if(v!==null&&!(typeof v==='number'&&Number.isFinite(v)&&v>0))hard(base+'.days','P2-06.1.1-days-unverified',rid);
      else note('DAYS_UNCHANGED',base+'.days','VIEW-only','B3-DAYS-01',rid);
     }
     if(own(row,'location')&&typeof row.location!=='string')hard(base+'.location','P2-06.1.1-location-unverified',rid);
    }
    if(key==='meetings'&&own(row,'attendees')){
     if(!(typeof row.attendees==='string'||Array.isArray(row.attendees)&&row.attendees.every(x=>typeof x==='string')))hard(base+'.attendees','unverified-attendees',rid);
     else note('ATTENDEES_VIEW',base+'.attendees','VIEW-only','P2-06.1.1-meeting',rid);
    }
    if(key==='agencys'&&own(row,'agency_result_meta')){
     const v=row.agency_result_meta;
     if(v!==null&&typeof v!=='string'&&!object(v)&&!Array.isArray(v))hard(base+'.agency_result_meta','unverified-agency-meta',rid);
     else note('AGENCY_META_PRESERVED',base+'.agency_result_meta','WARN','P2-06.1.1-agency-meta',rid);
    }
    if(own(row,'related_sources')){
     if(!Array.isArray(row.related_sources))hard(base+'.related_sources','unverified-matter-sources',rid);
     else row.related_sources.forEach((ref,n)=>{
      const p=base+'.related_sources['+n+']';
      if(!object(ref)||typeof ref.type!=='string'||!ref.type.trim()||!id(ref.id))hard(p,'unverified-matter-source',rid);
      else if(!own(B1.MATTER_TYPES,ref.type))note('UNKNOWN_MATTER_TYPE',p,'WARN','P2-06.1.1-related-sources',rid);
      else if(Array.isArray(data[B1.MATTER_TYPES[ref.type]])&&!B1.findRecord(data[B1.MATTER_TYPES[ref.type]],ref.id))note('DANGLING_MATTER_SOURCE',p,'WARN','P2-06.1.1-reference',rid);
     });
    }
    // Same authoritative registry as B1; detailed paths/IDs supplement its shared
    // cross-collection diagnostics without removing or repairing any reference.
    for(const [field,target] of Object.entries(B1.REGISTRY.business[key].references)){
     if(!BUSINESS_KEYS.includes(target)||!own(row,field)||emptyRef(row[field])||!id(row[field]))continue;
     if(Array.isArray(data[target])&&!B1.findRecord(data[target],row[field]))note('DANGLING_REFERENCE',base+'.'+field,'WARN','P2-06.1.1-reference',rid);
    }
    for(const field of nestedFields)if(own(row,field)){
     const values=row[field],p=base+'.'+field;
     if(!Array.isArray(values)){hard(p,'unverified-nested-array',rid);continue;}
     values.forEach((item,n)=>{
      const q=p+'['+n+']';
      if(!object(item)){
       if(key==='purchases'&&field==='items'&&(typeof item==='string'||item===null||item===0))note('LEGACY_PURCHASE_ITEM',q,'WARN','P2-06.1.1-purchase-items',rid);
       else hard(q,'unverified-nested-item',rid);
       return;
      }
      if(own(item,'id')&&!id(item.id))hard(q+'.id','B1-nested-id',rid);
      if(key==='handovers'&&field==='items'){
       if(own(item,'quantity')&&!['number','string'].includes(typeof item.quantity))hard(q+'.quantity','unverified-handover-quantity',rid);
       if(own(item,'docType')&&typeof item.docType!=='string')hard(q+'.docType','unverified-handover-docType',rid);
       note('HISTORICAL_QUANTITY',q,'WARN','P2-06.1.1-handover-items',rid);
      }
      if(key==='purchases'&&field==='items')for(const f of ['qty','price'])if(own(item,f)&&item[f]!==null&&!['number','string'].includes(typeof item[f]))hard(q+'.'+f,'unverified-purchase-number',rid);
     });
    }
    if(key==='handovers'&&!own(row,'items')){
     if(own(row,'quantity')&&!['string','number'].includes(typeof row.quantity))hard(base+'.quantity','unverified-legacy-handover',rid);
     for(const f of ['content','docType'])if(own(row,f)&&typeof row[f]!=='string')hard(base+'.'+f,'unverified-legacy-handover',rid);
     note('LEGACY_HANDOVER_VIEW',base,'VIEW-only','P2-06.1.1-legacy-handover',rid);
    }
   });
  }
  for(const field of ['organizations','work_categories']){
   const rows=field==='organizations'?data.config?.organizations:data.config?.dictionaries?.work_categories;
   if(rows===undefined)continue;
   if(!Array.isArray(rows)){hard('config.'+field,'B1-config-rows');continue;}
   for(let i=0;i<rows.length;i++)if(object(rows[i])){
    const row=rows[i],p='config.'+field+'['+i+']';
    if(own(row,'disabled')&&typeof row.disabled!=='boolean')hard(p+'.disabled','unverified-config-disabled',row.id);
    if(own(row,'sortOrder')&&typeof row.sortOrder!=='number')hard(p+'.sortOrder','unverified-config-sort',row.id);
    for(const f of ['status','type'])if(own(row,f)&&row[f]!==null&&typeof row[f]!=='string')hard(p+'.'+f,'unverified-config-'+f,row.id);
    note('CONFIG_ALIAS_VIEW',p,'VIEW-only','P2-06.1.1-config',row.id);
   }
  }
  // Classification of an ACTIVE edit is a policy handoff, never a writer here.
  classifications.push({classification:'ACTIVE edit',path:'$explicit-edit',code:'USE_EXISTING_WRITER',evidenceRule:'B1-B4-frozen-writers',implemented:false});
  return {ok:!errors.length,errors,warnings,classifications};
 }
 function validateBusiness(data){
  const history=classifyHistory(data);if(!history.ok)return history;
  const checked=B1.preflight(data,{mode:'import',profile:'b5-history'});
  const errors=(checked.errors||[]).map(x=>({...diagnostic(x.code,x.path||x.message||'$','HARD','B1-shared-preflight')}));
  const warnings=(checked.warnings||[]).map(x=>({...diagnostic(x.code,x.path||x.message||'$','WARN',x.evidenceRule||'B1-shared-preflight')}));
  return {ok:!errors.length,errors,warnings:[...history.warnings,...warnings],classifications:history.classifications};
 }
 function validateOptions(value,path='businessOptions'){
  const errors=[];
  if(!object(value))return [diagnostic('INVALID_OPTIONS',path)];
  for(const key of Object.keys(value)){
   if(!OPTION_KEYS.includes(key))errors.push(diagnostic('UNREGISTERED_OPTION',path+'.'+key));
   else if(!Array.isArray(value[key]))errors.push(diagnostic('INVALID_OPTION_COLLECTION',path+'.'+key));
   else value[key].forEach((v,i)=>{if(typeof v!=='string')errors.push(diagnostic('UNVERIFIED_OPTION_ITEM',path+'.'+key+'['+i+']','HARD','P2-06.1.1-options-unverified'));});
  }
  return errors;
 }
 function validateMetadata(value,path=META_KEY){
  if(!object(value))return [diagnostic('INVALID_METADATA',path)];
  const errors=[];
  for(const key of Object.keys(value)){
   if(ROOT_KEYS.has(key)||MIRRORS.has(key)||MANAGED_KEYS.includes(key))errors.push(diagnostic('RESERVED_METADATA_KEY',path+'.'+key));
   else if(Array.isArray(value[key]))errors.push(diagnostic('UNREGISTERED_COLLECTION',path+'.'+key));
  }
  return errors;
 }
 function validateExchange(input,{mode='partial'}={}){
  const p=readInput(input);if(!p.ok)return p;const data=p.value;
  if(!object(data))return rejected([diagnostic('INVALID_ROOT','$')]);
  if(own(data,'backupFormat'))return rejected([diagnostic('RECOVERY_NOT_EXCHANGE','backupFormat')]);
  const version=B1.detectVersion(data);
  if(!version.ok)return rejected(version.errors.map(x=>diagnostic(x.code,'schemaVersion','HARD','B1-detectVersion')));
  const enhanced=own(data,'exchangeRevision'),profile=enhanced?'enhanced-v2':version.version===1?'legacy-v1':'legacy-v2';
  const errors=[];
  if(enhanced&&(version.version!==2||data.exchangeRevision!==1))errors.push(diagnostic('UNSUPPORTED_EXCHANGE_REVISION','exchangeRevision'));
  if(!['partial','import','full','legacy-full'].includes(mode))errors.push(diagnostic('INVALID_MODE','$mode'));
  if(mode==='legacy-full'&&enhanced)errors.push(diagnostic('LEGACY_MODE_FORBIDDEN','$mode'));
  if(own(data,'exportedAt')&&!timestamp(data.exportedAt))errors.push(diagnostic('INVALID_EXPORT_DATE','exportedAt'));
  const metadata=Object.fromEntries(Object.entries(data).filter(([key])=>!ROOT_KEYS.has(key)));
  errors.push(...validateMetadata(metadata,'$metadata'));
  if(own(data,'businessOptions'))errors.push(...validateOptions(data.businessOptions));
  const missing=[...BUSINESS_KEYS.filter(k=>!own(data,k)),...(!own(data,'config')?['config']:[]),...OPTION_KEYS.filter(k=>!object(data.businessOptions)||!own(data.businessOptions,k)).map(k=>'businessOptions.'+k)];
  if(mode==='full'&&missing.length)errors.push(diagnostic(enhanced?'MISSING_ENHANCED_FULL_FIELDS':'LEGACY_FULL_CONFIRM_REQUIRED','$'));
  if(errors.length)return {...rejected(errors),profile,missing};
  const checked=validateBusiness(data);
  return {...checked,profile,version:version.version,mode,missing,snapshot:data,metadata};
 }
 function keyProblems(key,value){
  const p=readInput(value);if(!p.ok)return p.errors;
  if(BUSINESS_KEYS.includes(key)){
   if(!Array.isArray(value))return [diagnostic('INVALID_COLLECTION',key)];
   return validateBusiness({[key]:value}).errors;
  }
  if(key==='wb_config')return validateBusiness({config:value}).errors;
  if(OPTION_KEYS.includes(key))return validateOptions({[key]:value});
  if(key===META_KEY)return validateMetadata(value);
  if(key===VERSION_KEY)return !Number.isInteger(value)||value<1||value>B1.SCHEMA_VERSION?[diagnostic(value>2?'FUTURE_VERSION':'INVALID_VERSION',key)]:[];
  return [diagnostic('UNMANAGED_STORAGE_KEY',key)];
 }
 function readKey(storage,key){
  if(!MANAGED_KEYS.includes(key))return {status:'invalid',key,errors:[diagnostic('UNMANAGED_STORAGE_KEY',key)]};
  let rawString;
  try{rawString=storage.getItem(key);}catch{return {status:'failed',key,errors:[diagnostic('READ_FAILED',key)]};}
  if(rawString===null)return {status:'absent',key,presence:false,errors:[]};
  if(typeof rawString!=='string')return {status:'invalid',key,errors:[diagnostic('READ_INVALID',key)]};
  let value;try{value=JSON.parse(rawString);}catch{return {status:'invalid',key,errors:[diagnostic('READ_INVALID',key)]};}
  const errors=keyProblems(key,value);
  if(errors.length)return {status:'invalid',key,errors:errors.map(x=>({...x,storageKey:key}))};
  return {status:'valid',key,presence:true,rawString,value,errors:[]};
 }
 function validateState(input){
  const p=readInput(input);if(!p.ok)return p;const state=p.value,errors=[];
  if(!object(state)||!object(state.values)||!object(state.presence))return rejected([diagnostic('INVALID_STATE','$state')]);
  if(Object.keys(state).some(k=>!['values','presence','rawStrings'].includes(k)))errors.push(diagnostic('UNMANAGED_STATE_FIELD','$state'));
  for(const field of ['values','presence','rawStrings'])if(own(state,field)){
   if(!object(state[field])){errors.push(diagnostic('INVALID_STATE_FIELD',field));continue;}
   for(const key of Object.keys(state[field]))if(!MANAGED_KEYS.includes(key))errors.push(diagnostic('UNMANAGED_STORAGE_KEY',field+'.'+key));
  }
  for(const key of MANAGED_KEYS){
   if(typeof state.presence[key]!=='boolean'){errors.push(diagnostic('INVALID_PRESENCE','presence.'+key));continue;}
   if(state.presence[key]){
    if(!own(state.values,key)){errors.push(diagnostic('MISSING_PRESENT_VALUE','values.'+key));continue;}
    errors.push(...keyProblems(key,state.values[key]));
    if(state.rawStrings){
     if(typeof state.rawStrings[key]!=='string'){errors.push(diagnostic('MISSING_RAW_STRING','rawStrings.'+key));continue;}
     const raw=readInput(state.rawStrings[key]);
     if(!raw.ok||canonical(raw.value)!==canonical(state.values[key]))errors.push(diagnostic('RAW_VALUE_MISMATCH','rawStrings.'+key));
    }
   }else if(own(state.values,key)||state.rawStrings&&own(state.rawStrings,key))errors.push(diagnostic('ABSENT_VALUE_PRESENT','values.'+key));
  }
  if(errors.length)return rejected(errors);
  return {ok:true,state,errors:[]};
 }
 function captureState(storage){
  const reads=MANAGED_KEYS.map(k=>readKey(storage,k)),errors=reads.flatMap(r=>r.errors);
  const summary=reads.map(({key,status})=>({key,status}));
  if(errors.length)return {...rejected(errors),reads:summary};
  const state={values:{},presence:{},rawStrings:{}};
  for(const r of reads){state.presence[r.key]=r.status==='valid';if(r.status==='valid'){state.values[r.key]=r.value;state.rawStrings[r.key]=r.rawString;}}
  return {ok:true,state,reads:summary,errors:[]};
 }
 function rawBusiness(state){return Object.fromEntries(BUSINESS_KEYS.map(k=>[k,state.presence[k]?clone(state.values[k]):[]]));}
 function exportExchange(input,{now=new Date().toISOString()}={}){
  const checked=validateState(input);if(!checked.ok)return checked;const state=checked.state;
  const result={...(state.presence[META_KEY]?clone(state.values[META_KEY]):{}),schemaVersion:2,exchangeRevision:1,exportedAt:now,
   ...Object.fromEntries(BUSINESS_KEYS.map(k=>[k,(state.presence[k]?clone(state.values[k]):[]).filter(r=>!r.deleted)])),
   config:state.presence.wb_config?clone(state.values.wb_config):emptyConfig(),
   businessOptions:Object.fromEntries(OPTION_KEYS.map(k=>[k,state.presence[k]?clone(state.values[k]):[]]))};
  const validation=validateExchange(result,{mode:'full'});
  if(!validation.ok)return validation;
  return {ok:true,exchange:result,initialAbsent:MANAGED_KEYS.filter(k=>!state.presence[k]),errors:[],warnings:validation.warnings};
 }
 function validateRecovery(input){
  const p=readInput(input);if(!p.ok)return p;const b=p.value,errors=[];
  if(!object(b)||!['g2-recovery-v1','g2-recovery-v2'].includes(b.backupFormat))return rejected([diagnostic('INVALID_BACKUP_FORMAT','backupFormat')]);
  const v2=b.backupFormat==='g2-recovery-v2';
  const rootNames=new Set(['backupFormat','createdAt','sourceSchemaVersion','businessRaw','config','businessOptions','meta',...(v2?['exchangeMeta']:[])]);
  for(const k of Object.keys(b))if(!rootNames.has(k))errors.push(diagnostic('UNSUPPORTED_RECOVERY_FIELD',k));
  if(v2&&!timestamp(b.createdAt))errors.push(diagnostic('INVALID_BACKUP_DATE','createdAt'));
  if(!Number.isInteger(b.sourceSchemaVersion)||b.sourceSchemaVersion<1||b.sourceSchemaVersion>2)errors.push(diagnostic('INVALID_BACKUP_VERSION','sourceSchemaVersion'));
  if(!object(b.businessRaw)||BUSINESS_KEYS.some(k=>!Array.isArray(b.businessRaw[k])))errors.push(diagnostic('INVALID_BACKUP_BUSINESS','businessRaw'));
  else for(const k of Object.keys(b.businessRaw))if(!BUSINESS_KEYS.includes(k))errors.push(diagnostic('UNREGISTERED_COLLECTION','businessRaw.'+k));
  if(!object(b.config))errors.push(diagnostic('INVALID_BACKUP_CONFIG','config'));
  errors.push(...validateOptions(b.businessOptions));
  const keys=v2?MANAGED_KEYS:MANAGED_KEYS.filter(k=>k!==META_KEY);
  if(!object(b.meta)||!object(b.meta.presence))errors.push(diagnostic('INVALID_BACKUP_PRESENCE','meta.presence'));
  else{
   for(const k of keys)if(typeof b.meta.presence[k]!=='boolean')errors.push(diagnostic('INVALID_BACKUP_PRESENCE','meta.presence.'+k));
   for(const k of Object.keys(b.meta.presence))if(!keys.includes(k))errors.push(diagnostic('UNMANAGED_PRESENCE_KEY','meta.presence.'+k));
  }
  if(own(b.meta||{},'appVersion')&&typeof b.meta.appVersion!=='string')errors.push(diagnostic('INVALID_APP_VERSION','meta.appVersion'));
  if(v2)errors.push(...validateMetadata(b.exchangeMeta,'exchangeMeta'));
  if(!v2){
   const old=B1.validateRecovery(b);
   if(!old.ok)errors.push(...old.errors.map(x=>diagnostic(x.code,'$recovery','HARD','B1-validateRecovery')));
  }
  if(errors.length)return rejected(errors);
  const business=validateBusiness({schemaVersion:b.sourceSchemaVersion,...b.businessRaw,config:b.config});
  if(!business.ok)return business;
  const values={...clone(b.businessRaw),wb_config:clone(b.config),...clone(b.businessOptions),[VERSION_KEY]:b.sourceSchemaVersion,...(v2?{[META_KEY]:clone(b.exchangeMeta)}:{})};
  for(const k of keys)if(b.meta.presence[k]&&!own(values,k))errors.push(diagnostic('MISSING_PRESENT_VALUE',k));
  // A false presence may only accompany the format's empty placeholder. Reject
  // hidden payloads that a restore would silently discard.
  for(const k of keys)if(!b.meta.presence[k]&&own(values,k)){
   const v=values[k],empty=Array.isArray(v)?v.length===0:object(v)?Object.keys(v).length===0:k===VERSION_KEY&&v===1;
   if(!empty)errors.push(diagnostic('ABSENT_BACKUP_PAYLOAD',k));
  }
  if(errors.length)return rejected(errors);
  return {ok:true,backup:b,format:b.backupFormat,errors:[],warnings:business.warnings,classifications:business.classifications};
 }
 function exportRecovery(input,{now=new Date().toISOString(),appVersion='g2-b5-i01'}={}){
  const checked=validateState(input);if(!checked.ok)return checked;const state=checked.state;
  const backup={backupFormat:'g2-recovery-v2',createdAt:now,sourceSchemaVersion:state.presence[VERSION_KEY]?state.values[VERSION_KEY]:1,
   businessRaw:rawBusiness(state),config:state.presence.wb_config?clone(state.values.wb_config):{},
   businessOptions:Object.fromEntries(OPTION_KEYS.filter(k=>state.presence[k]).map(k=>[k,clone(state.values[k])])),
   exchangeMeta:state.presence[META_KEY]?clone(state.values[META_KEY]):{},meta:{appVersion,presence:clone(state.presence)}};
  const validated=validateRecovery(backup);return validated.ok?{ok:true,backup,errors:[],warnings:validated.warnings}:validated;
 }
 async function digest(value){
  const p=readInput(value);if(!p.ok)throw new Error('Cannot digest invalid JSON');
  // Web Crypto is also available in current Node. No low-quality fallback hash.
  const subtle=globalThis.crypto?.subtle;
  if(!subtle)throw new Error('SHA-256 capability is unavailable');
  const bytes=new TextEncoder().encode(canonical(p.value));
  return Array.from(new Uint8Array(await subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 }
 function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const x of Object.values(value))freeze(x);Object.freeze(value);}
  return value;
 }
 const plans=new WeakSet(),confirmations=new WeakMap();
 function impact(before,stage,missing,warnings){
  const count=v=>Array.isArray(v)?v.length:object(v)?Object.keys(v).length:0;
  const changes=MANAGED_KEYS.filter(k=>before.presence[k]!==stage.presence[k]||stage.presence[k]&&canonical(before.values[k])!==canonical(stage.values[k]));
  const rows=changes.map(k=>({key:k,beforePresent:before.presence[k],afterPresent:stage.presence[k],beforeCount:count(before.values[k]),afterCount:count(stage.values[k]),beforeTombstones:Array.isArray(before.values[k])?before.values[k].filter(r=>r?.deleted===true).length:0,afterTombstones:Array.isArray(stage.values[k])?stage.values[k].filter(r=>r?.deleted===true).length:0}));
  const missingEffects=missing.map(path=>{
   const key=path.startsWith('businessOptions.')?path.slice('businessOptions.'.length):path==='config'?'wb_config':path;
   return {path,key,localCount:count(before.values[key]),clear:true,...(key==='wb_config'?{organizations:before.values.wb_config?.organizations?.length||0,workCategories:before.values.wb_config?.dictionaries?.work_categories?.length||0}:{})};
  });
  return {changes:rows,missingEffects,relationshipWarnings:warnings.filter(x=>/REFERENCE|MATTER|SUBCATEGORY/.test(x.code)).map(({code,path})=>({code,path})),metadataScope:'selected-source; full replaces; partial updates provided root keys only'};
 }
 async function finishPlan(kind,mode,source,before,stage,missing,warnings,markers){
  const m=readInput(markers);if(!m.ok)return m;
  const checked=validateState(stage);if(!checked.ok)return checked;
  // Validate the complete staged raw business, not just selected input arrays.
  const business=validateBusiness({schemaVersion:stage.presence[VERSION_KEY]?stage.values[VERSION_KEY]:1,...rawBusiness(stage),config:stage.presence.wb_config?stage.values.wb_config:{}});
  if(!business.ok)return business;
  try{
   const body={planFormat:'g2-b5-i01-plan-v1',kind,mode,sourceDigest:await digest(source),beforeDigest:await digest(before),stageDigest:await digest(stage),markerDigest:await digest(m.value),
    stage,impact:impact(before,stage,missing,[...warnings,...business.warnings]),warnings:[...warnings,...business.warnings],requiresConfirmation:true};
   const plan=freeze({...body,planDigest:await digest(body)});plans.add(plan);
   return {ok:true,phase:'prepared',plan,errors:[]};
  }catch{return rejected([diagnostic('DIGEST_UNAVAILABLE','$digest')]);}
 }
 async function prepareExchange(input,beforeInput,{mode='full',markers={guard:null,rescue:null}}={}){
  const beforeCheck=validateState(beforeInput);if(!beforeCheck.ok)return beforeCheck;
  const checked=validateExchange(input,{mode});if(!checked.ok)return checked;
  const before=beforeCheck.state,source=checked.snapshot,partial=mode==='partial'||mode==='import';
  const stage={values:clone(before.values),presence:clone(before.presence)};
  for(const k of BUSINESS_KEYS)if(!partial||own(source,k)){stage.values[k]=own(source,k)?clone(source[k]):[];stage.presence[k]=true;}
  if(!partial||own(source,'config')){stage.values.wb_config=own(source,'config')?clone(source.config):emptyConfig();stage.presence.wb_config=true;}
  for(const k of OPTION_KEYS)if(!partial||object(source.businessOptions)&&own(source.businessOptions,k)){stage.values[k]=own(source.businessOptions||{},k)?clone(source.businessOptions[k]):[];stage.presence[k]=true;}
  if(!partial){stage.values[META_KEY]=clone(checked.metadata);stage.presence[META_KEY]=true;}
  else if(Object.keys(checked.metadata).length){stage.values[META_KEY]={...(before.presence[META_KEY]?clone(before.values[META_KEY]):{}),...clone(checked.metadata)};stage.presence[META_KEY]=true;}
  stage.values[VERSION_KEY]=2;stage.presence[VERSION_KEY]=true;
  return finishPlan('exchange',mode,source,before,stage,partial?[]:checked.missing,checked.warnings,markers);
 }
 async function prepareRecovery(input,beforeInput,{markers={guard:null,rescue:null}}={}){
  const before=validateState(beforeInput);if(!before.ok)return before;
  const checked=validateRecovery(input);if(!checked.ok)return checked;const b=checked.backup;
  const all={...clone(b.businessRaw),wb_config:clone(b.config),...clone(b.businessOptions),[VERSION_KEY]:b.sourceSchemaVersion,...(b.backupFormat==='g2-recovery-v2'?{[META_KEY]:clone(b.exchangeMeta)}:{})};
  const presence={...clone(b.meta.presence),[META_KEY]:b.backupFormat==='g2-recovery-v2'?b.meta.presence[META_KEY]:false};
  const stage={values:Object.fromEntries(MANAGED_KEYS.filter(k=>presence[k]).map(k=>[k,all[k]])),presence};
  const missing=b.backupFormat==='g2-recovery-v1'?[META_KEY]:[];
  return finishPlan('recovery','recovery',b,before.state,stage,missing,checked.warnings,markers);
 }
 function bindConfirmation(plan){
  if(!plans.has(plan))return rejected([diagnostic('UNTRUSTED_PLAN','$plan')]);
  const confirmation=Object.freeze({planDigest:plan.planDigest,sourceDigest:plan.sourceDigest,beforeDigest:plan.beforeDigest,stageDigest:plan.stageDigest,markerDigest:plan.markerDigest,mode:plan.mode});
  confirmations.set(confirmation,plan);return {ok:true,confirmation};
 }
 async function recheckPlan(plan,input,beforeInput,{confirmation,cancelled=false,markers={guard:null,rescue:null}}={}){
  if(cancelled)return {ok:false,phase:'cancelled',errors:[]};
  if(!plans.has(plan)||confirmations.get(confirmation)!==plan)return rejected([diagnostic('CONFIRMATION_REQUIRED','$confirmation')]);
  const source=plan.kind==='recovery'?validateRecovery(input):validateExchange(input,{mode:plan.mode});
  if(!source.ok)return source;
  const before=validateState(beforeInput);if(!before.ok)return before;
  const m=readInput(markers);if(!m.ok)return m;
  try{
   const [s,b,t,g]=await Promise.all([digest(plan.kind==='recovery'?source.backup:source.snapshot),digest(before.state),digest(plan.stage),digest(m.value)]);
   if(s!==plan.sourceDigest||b!==plan.beforeDigest||t!==plan.stageDigest||g!==plan.markerDigest)return {ok:false,phase:'stale-plan',errors:[diagnostic('PLAN_STALE','$plan')]};
   return {ok:true,phase:'ready-pure-plan',stage:clone(plan.stage),errors:[]};
  }catch{return rejected([diagnostic('DIGEST_UNAVAILABLE','$digest')]);}
 }
 return Object.freeze({BUSINESS_KEYS,OPTION_KEYS,VERSION_KEY,META_KEY,MANAGED_KEYS,REGISTRY,readInput,classifyHistory,validateExchange,validateRecovery,validateState,readKey,captureState,exportExchange,exportRecovery,digest,prepareExchange,prepareRecovery,bindConfirmation,recheckPlan});
});
