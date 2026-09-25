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
  const elements=new Map(),opened=[],messages=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',dataset:{}});return elements.get(id);};
  const clear=()=>{for(const el of elements.values())el.value='';};
  const DB={raw:key=>structuredClone(rows[key]||[]),set:(key,value)=>{rows[key]=structuredClone(value);}};
  const scope={db:DB,document:{getElementById:element},Date,Math,
    getConfig:()=>({organizations:[{id:'org_1',type:'supplier'}]}),
    setOrgInput:(id,name,orgId)=>{element(id).value=name;element(id).dataset.orgId=orgId;},
    openModal:id=>opened.push(id),toast:message=>messages.push(message)};
  for(const name of ['clearPurchaseForm','clearContractForm','clearExpenseForm','clearMeetingForm','clearTrainingForm','clearAgencyForm'])scope[name]=clear;
  const api=vm.runInNewContext('const DB=globalThis.db;function recordDisplayName(r){return r.name||r.content||"未命名";}\n'+code+
    '\n({linkedPrefillValues,openLinkedNewRecord,completePendingLinkedRecord,linkMatterRecords})',scope);
  return {api,rows,element,opened,messages};
}

test('all permitted new-record paths have title and assignee only unless a mapping is explicit',()=>{
  const {api}=setup();
  const source={name:'工作甲',assignee:'小李',importance:'高',category:'检查',source:'某局',startDate:'2026-01-01',amount:99};
  for(const target of ['purchases','contracts','expenses','meetings','trainings','agencys']){
    const values=api.linkedPrefillValues('todos',source,target,'事项甲');
    assert.equal(values.assignee,'小李');
    assert.equal(values[target==='expenses'?'content':'name'],'事项甲');
    assert.equal(values.amount,undefined);
    for(const field of ['importance','category','source','startDate','status','date'])assert.equal(values[field],undefined);
  }
  assert.equal(api.linkedPrefillValues('contracts',source,'meetings','事项甲'),null);
});

test('purchase and contract prefill subject, stable organization ID and editable amount',()=>{
  const {api,rows,element,opened}=setup({purchases:[{id:1,name:'采购甲',supplier:'甲公司',supplier_org_id:'org_1',amount:300,assignee:'小王',date:'2026-01-01'}]});
  assert.equal(api.openLinkedNewRecord('purchases',1,'contracts'),true);
  assert.deepEqual(opened,['contractModal']);
  assert.equal(element('contractName').value,'采购甲');
  assert.equal(element('contractParty').value,'甲公司');
  assert.equal(element('contractParty').dataset.orgId,'org_1');
  assert.equal(element('contractAmount').value,300);
  assert.equal(element('contractSignDate').value,'');
  element('contractAmount').value='250';
  rows.contracts.push({id:2,name:element('contractName').value,party:element('contractParty').value,
    counterparty_org_id:element('contractParty').dataset.orgId,amount:Number(element('contractAmount').value)});
  assert.equal(api.completePendingLinkedRecord('contracts',2).status,'linked');
  assert.equal(rows.contracts[0].amount,250);
  assert.equal(rows.purchases[0].amount,300);
  assert.equal(rows.contracts[0].counterparty_org_id,'org_1');
  assert.deepEqual(rows.contracts[0].related_sources,[{type:'purchase',id:1}]);
  const expense=api.linkedPrefillValues('contracts',rows.contracts[0],'expenses','事项甲');
  assert.equal(expense.subject,'甲公司');
  assert.equal(expense.subject_org_id,'org_1');
  assert.equal(expense.amount,250);
});

test('meeting, training and agency to expense use only semantically certain fields',()=>{
  const {api}=setup();
  const meeting=api.linkedPrefillValues('meetings',{name:'会议甲',assignee:'小陈',organizer:'主办局',date:'2026-02-01',budget:500},'expenses','事项');
  assert.equal(meeting.content,'会议甲');assert.equal(meeting.assignee,'小陈');
  assert.equal(meeting.subject,undefined);assert.equal(meeting.amount,undefined);
  const training=api.linkedPrefillValues('trainings',{name:'培训甲',assignee:'小周',organizer:'承办局',fee:180,startDate:'2026-03-01'},'expenses','事项');
  assert.equal(training.content,'培训甲');assert.equal(training.amount,180);assert.equal(training.subject,undefined);
  const agency=api.linkedPrefillValues('agencys',{name:'委托甲',assignee:'小吴',agent:'未成交候选',budget:900,winSupplier:'成交单位',win_supplier_org_id:'org_1',dealAmount:800},'expenses','事项');
  assert.equal(agency.content,'事项');assert.equal(agency.subject,'成交单位');
  assert.equal(agency.subject_org_id,'org_1');assert.equal(agency.amount,800);
  assert.equal(agency.date,undefined);assert.equal(agency.status,undefined);
});

test('a cancelled or unsupported new-record path creates no matter',()=>{
  const {api,rows,messages}=setup({todos:[{id:1,name:'工作'}]});
  assert.equal(api.openLinkedNewRecord('todos',1,'handovers'),false);
  assert.equal(api.completePendingLinkedRecord('handovers',5),null);
  assert.equal(rows.matters.length,0);
  assert.equal(messages.length,1);
});
