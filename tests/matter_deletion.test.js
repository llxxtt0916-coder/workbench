const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const model=html.slice(html.indexOf('// A matter groups existing business records'),
  html.indexOf('// Configuration is one snapshot object'));
function sourceOf(name){
  const start=html.indexOf(`function ${name}(`);
  assert(start>=0,`${name} missing`);
  const end=html.indexOf('\n}',start);
  assert(end>start,`${name} end missing`);
  return html.slice(start,end+2);
}
const singleDeletions={
  todos:'deleteTodo',purchases:'deletePurchase',contracts:'deleteContract',expenses:'deleteExpense',
  agencys:'deleteAgency',meetings:'deleteMeeting',trainings:'deleteTraining'
};
const code=model+'\n'+Object.values(singleDeletions).map(sourceOf).join('\n')+'\n'+
  sourceOf('deleteActiveItem')+'\n'+sourceOf('deleteBulk');
function setup(seed={}){
  const rows={todos:[],purchases:[],contracts:[],expenses:[],agencys:[],meetings:[],trainings:[],matters:[],...structuredClone(seed)};
  const DB={raw:key=>structuredClone(rows[key]||[]),get:key=>structuredClone((rows[key]||[]).filter(row=>!row.deleted)),
    set:(key,value)=>{rows[key]=structuredClone(value);}};
  let selected=[];
  const sandbox={db:DB,Date,Math,confirmAction:()=>{},toast:()=>{},renderTodo:()=>{},renderTodos:()=>{},
    renderPurchases:()=>{},renderContracts:()=>{},renderExpenses:()=>{},renderFunds:()=>{},
    renderAgencys:()=>{},renderMeetings:()=>{},renderTrainings:()=>{},rerenderCurrent:()=>{},
    renderGlobalSearch:()=>{},visibleBulkInputs:()=>selected,currentPage:'',todoLedgerLabel:()=>''};
  const api=vm.runInNewContext('const DB=globalThis.db;function recordDisplayName(r){return r.name||r.content||"";}\n'+code+
    '\n({linkMatterRecords,cleanupDeletedMatterRecord,repairMatterRelations,...Object.fromEntries(['+
    Object.values(singleDeletions).map(name=>`'${name}'`).join(',')+
    ",'deleteActiveItem','deleteBulk'].map(name=>[name,eval(name)]))})",sandbox);
  return {api,rows,select:items=>{selected=items;}};
}

test('every supported single-record delete removes source references without deleting other records',()=>{
  for(const [ledger,method] of Object.entries(singleDeletions)){
    const {api,rows}=setup({todos:[{id:1,name:'工作'}],purchases:[{id:2,name:'采购'}],
      contracts:[{id:2,name:'合同'}],expenses:[{id:2,content:'报销'}],
      agencys:[{id:2,name:'委托'}],meetings:[{id:2,name:'会议'}],trainings:[{id:2,name:'培训'}]});
    if(ledger==='todos')api.linkMatterRecords('todos',1,'purchases',2);
    else api.linkMatterRecords(ledger,2,'todos',1);
    api[method](ledger==='todos'?1:2,true);
    const survivor=ledger==='todos'?rows.purchases[0]:rows.todos[0];
    assert.equal(survivor.deleted,undefined,`${ledger}: other record survives`);
    assert.deepEqual(survivor.related_sources||[],[],`${ledger}: stale source removed`);
    assert.equal(rows[ledger].find(row=>row.id===(ledger==='todos'?1:2)).deleted,true);
  }
});

test('bulk delete removes references to all selected sources and preserves surviving members',()=>{
  const {api,rows,select}=setup({todos:[{id:1,name:'工作'}],purchases:[{id:2,name:'采购'}],contracts:[{id:3,name:'合同'}]});
  api.linkMatterRecords('todos',1,'purchases',2);
  api.linkMatterRecords('purchases',2,'contracts',3);
  select([{checked:true,dataset:{bulkKey:'todos',bulkId:'1'}},
    {checked:true,dataset:{bulkKey:'purchases',bulkId:'2'}}]);
  api.deleteBulk('active',true);
  assert.equal(rows.todos[0].deleted,true);
  assert.equal(rows.purchases[0].deleted,true);
  assert.equal(rows.contracts[0].deleted,undefined);
  assert.deepEqual(rows.contracts[0].related_sources,[]);
  assert.equal(rows.matters.length,1);
});

test('bulk delete also cleans references when it removes an attached todo',()=>{
  const {api,rows,select}=setup({todos:[{id:1,name:'关联工作'}],
    purchases:[{id:2,name:'采购',todoRef:1}],contracts:[{id:3,name:'合同'}]});
  api.linkMatterRecords('todos',1,'contracts',3);
  api.linkMatterRecords('purchases',2,'contracts',3);
  select([{checked:true,dataset:{bulkKey:'purchases',bulkId:'2'}}]);
  api.deleteBulk('active',true);
  assert.equal(rows.todos[0].deleted,true);
  assert.equal(rows.purchases[0].deleted,true);
  assert.deepEqual(rows.contracts[0].related_sources,[]);
});

test('legacy records stay independent and invalid source references are pruned safely',()=>{
  const {api,rows}=setup({todos:[{id:1,name:'旧记录'},
    {id:2,name:'关联记录',matter_id:'matter_1',related_sources:[{type:'purchase',id:99}]}],
    matters:[{id:'matter_1',name:'事项'}]});
  api.repairMatterRelations();
  assert.equal(rows.todos[0].matter_id,undefined);
  assert.deepEqual(rows.todos[1].related_sources,[]);
  assert.equal(rows.matters.length,1);
});
