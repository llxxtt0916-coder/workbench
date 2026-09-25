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
  const records={todos:[],purchases:[],contracts:[],expenses:[],agencys:[],meetings:[],trainings:[]};
  const sandbox={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))},
    DB:{raw:key=>records[key]||[],get:key=>(records[key]||[]).filter(row=>!row.deleted),set:(key,rows)=>{records[key]=rows;}},Date,Math};
  vm.createContext(sandbox);
  const api=vm.runInContext(source+'\n({getConfig,saveConfig,upsertConfig,setConfigStatus,moveConfigRow,normalizeConfig,deleteConfigRow,matchingSourceOrganization,unmatchedWorkSources,activeOrganizations})',sandbox);
  return {api,values,records};
}
test('work category is the only dictionary and old source configuration is ignored',()=>{
  const {api}=context({wb_opts_todoCategory:'["专项工作","会议"]'});
  assert.deepEqual(Array.from(api.getConfig().dictionaries.work_categories,row=>row.name),['专项工作','会议']);
  assert.deepEqual(Object.keys(api.getConfig().dictionaries),['work_categories']);
  assert.throws(()=>api.upsertConfig('work_sources',{name:'领导交办'}),/未知配置分组/);
});
test('organization master list retains status, editing and order',()=>{
  const {api}=context();
  const a=api.upsertConfig('organizations',{name:'外部单位',type:'external'});
  const b=api.upsertConfig('organizations',{name:'另一单位',type:'external'});
  api.upsertConfig('organizations',{name:'内部科',type:'internal'});
  api.upsertConfig('organizations',{...a,name:'更名单位'});
  assert.equal(api.getConfig().organizations[0].id,a.id);
  assert.equal(api.setConfigStatus('organizations',a.id,'inactive'),true);
  assert.equal(api.getConfig().organizations[0].status,'inactive');
  assert.equal(api.moveConfigRow('organizations',b.id,-1),true);
  assert.equal(api.moveConfigRow('organizations',b.id,-1),false);
  assert.throws(()=>api.upsertConfig('organizations',{name:'另一单位',type:'supplier'}),/名称已存在/);
});
test('invalid or absent config initializes safely',()=>{
  const {api}=context();
  assert.equal(api.normalizeConfig(null).organizations.length,0);
  assert(api.normalizeConfig(null).dictionaries.work_categories.length>0);
});
test('work history backfills category and links only eligible source organizations',()=>{
  const {api,values,records}=context();
  const external=api.upsertConfig('organizations',{name:'重庆市疾病预防控制局',short_name:'市疾控局',type:'external'});
  const internal=api.upsertConfig('organizations',{name:'综合科',type:'internal'});
  api.upsertConfig('organizations',{name:'供应商',short_name:'供方',type:'supplier'});
  records.todos.push({category:['疾控监督员'],source:['市疾控局','综合科','领导交办','供方','供应商']});
  const config=api.getConfig();
  assert(config.dictionaries.work_categories.some(row=>row.name==='疾控监督员'));
  assert.deepEqual(Array.from(records.todos[0].source_org_ids),[external.id,internal.id,'','','']);
  assert.deepEqual(Array.from(api.unmatchedWorkSources(config)),['领导交办','供方','供应商']);
  const saved=values.get('wb_config');
  assert.equal(api.getConfig().dictionaries.work_categories.length,config.dictionaries.work_categories.length);
  assert.equal(values.get('wb_config'),saved,'backfill is idempotent');
});
test('old local or Gitee source dictionary is removed without changing source text',()=>{
  const legacy={organizations:[{id:'org_a',name:'市疾控局',type:'external',status:'active',sort_order:10}],
    dictionaries:{work_categories:[],work_sources:[{id:'ws_a',name:'市疾控局',organization_id:'org_a'}]}};
  const {api,values,records}=context({wb_config:JSON.stringify(legacy)});
  records.todos.push({category:'疾控监督员',source:['市疾控局','领导交办'],work_source_ids:['ws_a','']});
  const config=api.getConfig();
  assert.deepEqual(Object.keys(config.dictionaries),['work_categories']);
  assert(!JSON.parse(values.get('wb_config')).dictionaries.work_sources);
  assert(config.dictionaries.work_categories.some(row=>row.name==='疾控监督员'));
  assert.deepEqual(Array.from(records.todos[0].source_org_ids),['org_a','']);
  assert.deepEqual(Array.from(records.todos[0].source),['市疾控局','领导交办']);
});
test('work source candidates are external and internal; supplier is excluded',()=>{
  const {api,records}=context();
  const external=api.upsertConfig('organizations',{name:'外部',type:'external'});
  const internal=api.upsertConfig('organizations',{name:'内部',type:'internal'});
  api.upsertConfig('organizations',{name:'供方',type:'supplier'});
  assert.deepEqual(Array.from(api.activeOrganizations('source'),row=>row.name),['外部','内部']);
  assert.equal(api.matchingSourceOrganization(api.getConfig(),'外部'),external.id);
  assert.equal(api.matchingSourceOrganization(api.getConfig(),'内部'),internal.id);
  assert.equal(api.matchingSourceOrganization(api.getConfig(),'供方'),'');
  api.upsertConfig('organizations',{...external,short_name:'供方'});
  assert.equal(api.matchingSourceOrganization(api.getConfig(),'供方'),'','供应商全称不可被另一组织简称误关联');
  records.todos.push({source:['外部']});api.getConfig();
  assert.throws(()=>api.upsertConfig('organizations',{...external,type:'supplier'}),/工作来源/);
});
test('every typed business ledger backfills one shared organization per name',()=>{
  const {api,records}=context();
  records.purchases.push({supplier:'甲单位',contractDept:'综合科',expenseDept:'财务科'});
  records.contracts.push({party:'甲单位'});
  records.expenses.push({supplier:'甲单位',expenseDept:'财务科'});
  records.agencys.push({agent:'甲单位',winSupplier:'乙单位',dept:'综合科'});
  records.meetings.push({organizer:'甲单位'});
  records.trainings.push({organizer:'待确认主办方'});
  const config=api.getConfig();
  assert.deepEqual(Array.from(config.organizations,row=>row.name).sort(),['乙单位','甲单位','综合科','财务科'].sort());
  assert.equal(config.organizations.filter(row=>row.name==='甲单位').length,1);
  assert.equal(config.organizations.find(row=>row.name==='甲单位').type,'supplier');
  assert.equal(config.organizations.find(row=>row.name==='综合科').type,'internal');
  assert(!config.organizations.some(row=>row.name==='待确认主办方'));
  assert.equal(api.getConfig().organizations.length,4);
});
test('unused rows delete; historical text and ID references block deletion but permit disabling',()=>{
  const {api,records}=context();
  const unused=api.upsertConfig('organizations',{name:'未使用',type:'external'});
  assert.equal(api.deleteConfigRow('organizations',unused.id),true);
  const linked=api.upsertConfig('organizations',{name:'关联单位',type:'internal'});
  records.todos.push({category:['历史类别'],source:['关联单位']});api.getConfig();
  assert.equal(api.deleteConfigRow('organizations',linked.id),false);
  assert.equal(api.setConfigStatus('organizations',linked.id,'inactive'),true);
  const category=api.getConfig().dictionaries.work_categories.find(row=>row.name==='历史类别');
  assert.equal(api.deleteConfigRow('work_categories',category.id),false);
  records.purchases.push({supplier:'历史单位',deleted:true});
  const org=api.getConfig().organizations.find(row=>row.name==='历史单位');
  assert(org);
  assert.equal(api.deleteConfigRow('organizations',org.id),false);
});
