const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('// A matter groups existing business records');
const end=html.indexOf('// Configuration is one snapshot object',start);
assert(start>=0&&end>start);
const code=html.slice(start,end);
function setup(seed={}){
  const rows={todos:[],purchases:[],contracts:[],expenses:[],meetings:[],trainings:[],agencys:[],matters:[],...structuredClone(seed)};
  const writes=[];
  const DB={raw:key=>structuredClone(rows[key]||[]),set:(key,value)=>{rows[key]=structuredClone(value);writes.push(key);}};
  const api=vm.runInNewContext('const DB=globalThis.db;function recordDisplayName(r){return r.name||r.content||"未命名";}\n'+code+
    '\n({matterRecord,matterMembers,matterById,linkMatterRecords,renameMatter,unlinkMatterRecord})',{db:DB,Date,Math});
  return {api,rows,writes};
}
test('first link creates a minimal matter and typed stable source relation',()=>{
  const {api,rows}=setup({todos:[{id:11,name:'工作',status:'进行中'}],purchases:[{id:9,name:'采购',status:'申请中'}]});
  const result=api.linkMatterRecords('todos',11,'purchases',9);
  assert.equal(result.status,'linked');
  assert.match(result.matter.id,/^matter_/);
  assert.equal(result.matter.name,'工作');
  assert.deepEqual(Object.keys(rows.matters[0]).sort(),['created_at','id','name','remark']);
  assert.equal(rows.todos[0].matter_id,result.matter.id);
  assert.equal(rows.purchases[0].matter_id,result.matter.id);
  assert.deepEqual(rows.purchases[0].related_sources,[{type:'work',id:11}]);
  assert.equal(rows.todos[0].status,'进行中');
  assert.equal(rows.purchases[0].status,'申请中');
});
test('one matter accepts multiple same-type records and a record accepts multiple direct sources',()=>{
  const {api,rows}=setup({todos:[{id:1,name:'主工作'},{id:2,name:'另一个工作'}],purchases:[{id:3,name:'采购'}],contracts:[{id:4,name:'合同'}]});
  const first=api.linkMatterRecords('todos',1,'purchases',3);
  assert.equal(api.linkMatterRecords('todos',1,'todos',2).status,'linked');
  assert.equal(api.linkMatterRecords('purchases',3,'contracts',4).status,'linked');
  assert.equal(rows.matters.length,1);
  assert.equal(api.matterMembers(first.matter.id).length,4);
  assert.equal(api.linkMatterRecords('todos',2,'contracts',4).status,'already-linked');
  assert.equal(rows.contracts[0].related_sources.length,1);
});
test('independent records join, same matter is idempotent, different matters never merge',()=>{
  const {api,rows}=setup({todos:[{id:1,name:'A'},{id:2,name:'B'},{id:3,name:'C'},{id:4,name:'D'}]});
  const first=api.linkMatterRecords('todos',1,'todos',2);
  assert.equal(api.linkMatterRecords('todos',1,'todos',2).status,'already-linked');
  assert.equal(rows.todos[1].related_sources.length,1);
  assert.equal(api.linkMatterRecords('todos',2,'todos',3).status,'linked');
  assert.equal(rows.todos[2].matter_id,first.matter.id);
  const second=api.linkMatterRecords('todos',4,'contracts',99);
  assert.equal(second.status,'missing');
  rows.contracts.push({id:9,name:'E'});
  const other=api.linkMatterRecords('todos',4,'contracts',9);
  assert.equal(other.status,'linked');
  assert.equal(api.linkMatterRecords('todos',1,'contracts',9).status,'conflict');
  assert.equal(rows.matters.length,2);
});
test('renaming a matter leaves business titles; removing a member preserves records and states',()=>{
  const {api,rows}=setup({todos:[{id:1,name:'工作',state:'DOING'}],purchases:[{id:2,name:'采购',state:'TODO'}],contracts:[{id:3,name:'合同',state:'DONE'}]});
  const matter=api.linkMatterRecords('todos',1,'purchases',2).matter;
  api.linkMatterRecords('purchases',2,'contracts',3);
  assert.equal(api.renameMatter(matter.id,'新事项名'),true);
  assert.equal(rows.matters[0].name,'新事项名');
  assert.equal(rows.todos[0].name,'工作');
  assert.equal(api.unlinkMatterRecord('purchases',2),true);
  assert.equal(rows.purchases[0].matter_id,undefined);
  assert.equal(rows.purchases[0].state,'TODO');
  assert.equal(rows.contracts[0].matter_id,matter.id);
  assert.deepEqual(rows.contracts[0].related_sources,[]);
  assert.equal(rows.todos[0].state,'DOING');
});
test('legacy and excluded records remain independent and cannot create a matter',()=>{
  const {api,rows}=setup({todos:[{id:1,name:'旧工作'},{id:2,name:'长期目标',is_goal:true}],handovers:[{id:3,name:'交接'}]});
  assert.equal(api.matterRecord('todos',1).matter_id,undefined);
  assert.equal(api.linkMatterRecords('todos',1,'todos',2).status,'missing');
  assert.equal(api.linkMatterRecords('todos',1,'handovers',3).status,'missing');
  assert.equal(rows.matters.length,0);
});
