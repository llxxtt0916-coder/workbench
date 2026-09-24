const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const begin=html.indexOf('// Configuration is one snapshot object');
const end=html.indexOf('//  DATA LAYER v1.5',begin);
assert(begin>=0&&end>begin);
const source=html.slice(begin,html.lastIndexOf('// ============================================================',end));
function context(seed={}){
  const values=new Map(Object.entries(seed));
  const records={todos:[],purchases:[],contracts:[],expenses:[],agencys:[]};
  const sandbox={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))},
    DB:{raw:key=>records[key]||[],get:key=>(records[key]||[]).filter(row=>!row.deleted)},Date,Math};
  vm.createContext(sandbox);
  const api=vm.runInContext(source+'\n({getConfig,saveConfig,upsertConfig,setConfigStatus,moveConfigRow,normalizeConfig,deleteConfigRow,configEntryUsed})',sandbox);
  return {api,values,records};
}
test('legacy options seed separate work dictionaries and persist stable IDs',()=>{
  const {api,values}=context({wb_opts_todoCategory:'["专项工作","会议"]'});
  assert.deepEqual(Array.from(api.getConfig().dictionaries.work_categories,row=>row.name),['专项工作','会议']);
  const row=api.upsertConfig('work_sources',{name:'领导交办'});
  assert.match(row.id,/^ws_/);
  assert.equal(api.getConfig().dictionaries.work_sources.at(-1).id,row.id);
  assert(values.has('wb_config'));
});
test('organizations share one master list with status, edits and order',()=>{
  const {api}=context();
  const a=api.upsertConfig('organizations',{name:'外部单位',type:'external',short_name:'外部'});
  const a2=api.upsertConfig('organizations',{name:'另一外部单位',type:'external'});
  const b=api.upsertConfig('organizations',{name:'本单位科室',type:'internal'});
  const c=api.upsertConfig('organizations',{name:'服务商',type:'supplier'});
  assert.deepEqual(Array.from(api.getConfig().organizations,row=>row.type),['external','external','internal','supplier']);
  api.upsertConfig('organizations',{...a,name:'更名单位'});
  assert.equal(api.getConfig().organizations[0].id,a.id);
  assert.equal(api.setConfigStatus('organizations',c.id,'inactive'),true);
  assert.equal(api.getConfig().organizations[3].status,'inactive');
  assert.equal(api.setConfigStatus('organizations',c.id,'active'),true);
  assert.equal(api.moveConfigRow('organizations',a2.id,-1),true);
  assert.deepEqual(Array.from(api.getConfig().organizations).filter(row=>row.type==='external').sort((x,y)=>x.sort_order-y.sort_order).map(row=>row.id),[a2.id,a.id]);
  assert.equal(api.moveConfigRow('organizations',b.id,-1),false);
  assert.throws(()=>api.upsertConfig('organizations',{name:'服务商',type:'external'}),/名称已存在/);
});
test('invalid or absent cloud configuration initializes safely',()=>{
  const {api}=context();
  assert.equal(api.normalizeConfig(null).organizations.length,0);
  assert(api.normalizeConfig(null).dictionaries.work_categories.length>0);
});
test('historical work values backfill once and link source by full name or alias',()=>{
  const {api,values,records}=context();
  const external=api.upsertConfig('organizations',{name:'重庆市疾病预防控制局',short_name:'市疾控局',type:'external'});
  const internal=api.upsertConfig('organizations',{name:'综合科',short_name:'综科',type:'internal'});
  api.upsertConfig('organizations',{name:'供应商',short_name:'供方',type:'supplier'});
  records.todos.push({category:['疾控监督员',''],source:['市疾控局','综合科','领导交办','供方','供应商']});
  const first=api.getConfig();
  assert(first.dictionaries.work_categories.some(row=>row.name==='疾控监督员'));
  const sources=first.dictionaries.work_sources;
  assert.equal(sources.find(row=>row.name==='市疾控局').organization_id,external.id);
  assert.equal(sources.find(row=>row.name==='综合科').organization_id,internal.id);
  assert.equal(sources.find(row=>row.name==='领导交办').organization_id,'');
  assert.equal(sources.find(row=>row.name==='供方').organization_id,'','供应商简称不可自动关联');
  assert.equal(sources.find(row=>row.name==='供应商').organization_id,'','供应商全称不可自动关联');
  const saved=values.get('wb_config');
  assert.deepEqual(Array.from(api.getConfig().dictionaries.work_sources,row=>row.id),Array.from(sources,row=>row.id));
  assert.equal(values.get('wb_config'),saved,'重复读取不得重复写入');
});
test('a device without configuration initializes from existing work records',()=>{
  const {api,records}=context();
  records.todos.push({category:'疾控监督员',source:'市疾控局'});
  const config=api.getConfig();
  assert(config.dictionaries.work_categories.some(row=>row.name==='疾控监督员'));
  assert(config.dictionaries.work_sources.some(row=>row.name==='市疾控局'));
  assert.equal(records.todos[0].source,'市疾控局','历史名称快照不得改写');
});
test('source association accepts external and internal, rejects supplier',()=>{
  const {api,records}=context();
  const external=api.upsertConfig('organizations',{name:'外部',type:'external'});
  const internal=api.upsertConfig('organizations',{name:'内部',type:'internal'});
  const supplier=api.upsertConfig('organizations',{name:'供方',type:'supplier'});
  assert.equal(api.upsertConfig('work_sources',{name:'外部来源',organization_id:external.id}).organization_id,external.id);
  assert.equal(api.upsertConfig('work_sources',{name:'内部来源',organization_id:internal.id}).organization_id,internal.id);
  assert.equal(api.upsertConfig('work_sources',{name:'领导交办',organization_id:''}).organization_id,'');
  api.upsertConfig('work_sources',{name:'外部',organization_id:''});
  records.todos.push({source:['外部']});
  assert.equal(api.getConfig().dictionaries.work_sources.find(row=>row.name==='外部').organization_id,'',
    '用户明确不关联后，历史回填不能重新关联');
  assert.throws(()=>api.upsertConfig('work_sources',{name:'错误来源',organization_id:supplier.id}),/只能关联/);
  assert.throws(()=>api.upsertConfig('organizations',{...external,type:'supplier'}),/已被工作来源关联/);
});
test('unused entries can be deleted; history and source links block deletion but allow disabling',()=>{
  const {api,records}=context();
  const unused=api.upsertConfig('organizations',{name:'未使用',type:'external'});
  assert.equal(api.deleteConfigRow('organizations',unused.id),true);
  const linked=api.upsertConfig('organizations',{name:'关联单位',type:'internal'});
  const source=api.upsertConfig('work_sources',{name:'来源',organization_id:linked.id});
  assert.equal(api.deleteConfigRow('organizations',linked.id),false);
  assert.equal(api.setConfigStatus('organizations',linked.id,'inactive'),true);
  records.todos.push({category:['历史类别'],source:['来源'],work_source_ids:[source.id]});
  assert.equal(api.deleteConfigRow('work_sources',source.id),false);
  assert.equal(api.setConfigStatus('work_sources',source.id,'inactive'),true);
  const historical=api.getConfig().dictionaries.work_categories.find(row=>row.name==='历史类别');
  assert.equal(api.deleteConfigRow('work_categories',historical.id),false);
  records.purchases.push({supplier:'历史单位',deleted:true});
  const oldOrg=api.upsertConfig('organizations',{name:'历史单位',type:'external'});
  assert.equal(api.deleteConfigRow('organizations',oldOrg.id),false,'软删除记录仍占用历史配置');
});
