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
  const sandbox={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))},Date,Math};
  vm.createContext(sandbox);
  const api=vm.runInContext(source+'\n({getConfig,saveConfig,upsertConfig,setConfigStatus,moveConfigRow,normalizeConfig})',sandbox);
  return {api,values};
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
  const b=api.upsertConfig('organizations',{name:'本单位科室',type:'internal'});
  const c=api.upsertConfig('organizations',{name:'服务商',type:'supplier'});
  assert.deepEqual(Array.from(api.getConfig().organizations,row=>row.type),['external','internal','supplier']);
  api.upsertConfig('organizations',{...a,name:'更名单位'});
  assert.equal(api.getConfig().organizations[0].id,a.id);
  assert.equal(api.setConfigStatus('organizations',c.id,'inactive'),true);
  assert.equal(api.getConfig().organizations[2].status,'inactive');
  assert.equal(api.setConfigStatus('organizations',c.id,'active'),true);
  assert.equal(api.moveConfigRow('organizations',b.id,-1),true);
  assert.deepEqual(Array.from(api.getConfig().organizations).sort((x,y)=>x.sort_order-y.sort_order).map(row=>row.id),[b.id,a.id,c.id]);
  assert.throws(()=>api.upsertConfig('organizations',{name:'服务商',type:'external'}),/名称已存在/);
});
test('invalid or absent cloud configuration initializes safely',()=>{
  const {api}=context();
  assert.equal(api.normalizeConfig(null).organizations.length,0);
  assert(api.normalizeConfig(null).dictionaries.work_categories.length>0);
});
