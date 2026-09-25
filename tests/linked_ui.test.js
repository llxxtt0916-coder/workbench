const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert(start>=0&&end>start);return html.slice(start,end);}
const model=section('// A matter groups existing business records','// Configuration is one snapshot object');
const panel=section('const MATTER_LABELS=','document.querySelectorAll(\'.modal-overlay\')');

function setup(seed={}){
  const rows={todos:[],purchases:[],contracts:[],expenses:[],meetings:[],trainings:[],agencys:[],matters:[],...structuredClone(seed)};
  const elements=new Map(),messages=[],opened=[];let confirmation=null;
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:''});return elements.get(id);};
  const DB={get:key=>structuredClone((rows[key]||[]).filter(r=>!r.deleted)),raw:key=>structuredClone(rows[key]||[]),
    set:(key,value)=>{rows[key]=structuredClone(value);}};
  const sandbox={db:DB,document:{getElementById:el},Date,Math,
    openModal:id=>opened.push(id),closeModal:()=>{},toast:message=>messages.push(message),
    confirmAction:(_message,action)=>{confirmation=action;},navigate:()=>{},openOrganizeModal:()=>{}};
  const api=vm.runInNewContext(`const DB=globalThis.db;
    const STATE={TODO:'未开始',DOING:'进行中',DONE:'已完成',CLOSED:'已关闭'};
    function recordDisplayName(r){return r.name||r.content||'未命名';}
    function recordState(_ledger,r){return r.state||STATE.TODO;}
    function esc(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    ${model}\n${panel}
    ({openMatterActions,matterSearchCandidates,matterChooseExisting,matterActionButton,saveMatterName,confirmRemoveFromMatter})`,sandbox);
  return {api,rows,el,messages,opened,confirm:()=>confirmation?.()};
}

test('every supported ledger exposes a lightweight entry; excluded ledgers do not',()=>{
  const renderers={todos:'function renderTodo()',purchases:'function renderPurchases()',contracts:'function renderContracts()',
    expenses:'function renderExpenses()',meetings:'function renderMeetingList(',trainings:'function renderTrainings()',agencys:'function renderAgencys()'};
  for(const [ledger,start] of Object.entries(renderers)){
    const part=html.slice(html.indexOf(start),html.indexOf('\nfunction ',html.indexOf(start)+1));
    assert(part.includes(`matterActionButton('${ledger}'`),`${ledger} list must expose matter entry`);
  }
  assert(html.slice(html.indexOf('function renderTodosV16()'),html.indexOf('renderTodos=renderTodosV16')).includes('matterActionButton(r._ledger,r)'));
  const {api}=setup({todos:[{id:1,name:'工作'}],handovers:[{id:2,name:'交接'}]});
  assert.match(api.matterActionButton('todos',{id:1}),/关联业务/);
  assert.equal(api.matterActionButton('handovers',{id:2}), '');
});

test('existing-record picker filters by type, keyword, status, date and assignee',()=>{
  const {api,el,opened}=setup({todos:[{id:1,name:'工作'}],purchases:[{id:2,name:'采购设备',state:'进行中',date:'2026-09-11',assignee:'小李',supplier:'甲公司'},
    {id:3,name:'采购纸张',state:'未开始',date:'2026-09-12',assignee:'小王'}],contracts:[{id:4,name:'设备合同',state:'进行中',signDate:'2026-09-11',assignee:'小李'}]});
  assert.equal(api.matterSearchCandidates('todos',1,{type:'purchases',keyword:'设备',status:'进行中',date:'2026-09-11',assignee:'小李'}).length,1);
  assert.equal(api.matterSearchCandidates('todos',1,{keyword:'甲公司'}).length,1);
  assert.equal(api.matterSearchCandidates('todos',1,{date:'2026-09-15'}).length,0);
  api.openMatterActions('todos',1);
  assert.deepEqual(opened,['matterPanel']);
  assert.match(el('matterPanelBody').innerHTML,/关联已有记录/);
  assert.match(el('matterCandidateResults').innerHTML,/采购设备/);
});

test('picker links, displays grouped matter, renames and removes without changing record state',()=>{
  const {api,rows,el,confirm}=setup({todos:[{id:1,name:'工作',state:'进行中'}],purchases:[{id:2,name:'采购',state:'未开始'}]});
  api.openMatterActions('todos',1);
  api.matterChooseExisting('purchases',2);
  assert.equal(rows.matters.length,1);
  assert.match(el('matterPanelBody').innerHTML,/事项内记录（2）/);
  assert.match(el('matterPanelBody').innerHTML,/采购/);
  el('matterNameInput').value='新事项名';api.saveMatterName();
  assert.equal(rows.matters[0].name,'新事项名');
  api.confirmRemoveFromMatter();confirm();
  assert.equal(rows.todos[0].matter_id,undefined);
  assert.equal(rows.todos[0].state,'进行中');
  assert.equal(rows.purchases[0].state,'未开始');
  assert.deepEqual(rows.purchases[0].related_sources,[]);
});

test('picker never merges two existing matters and remains idempotent within one matter',()=>{
  const {api,rows,el,messages}=setup({todos:[{id:1,name:'A'},{id:2,name:'B'},{id:3,name:'C'},{id:4,name:'D'}]});
  api.openMatterActions('todos',1);api.matterChooseExisting('todos',2);
  api.matterChooseExisting('todos',2);
  assert.equal(rows.matters.length,1);
  assert.equal(rows.todos[1].related_sources.length,1);
  api.openMatterActions('todos',3);api.matterChooseExisting('todos',4);
  assert.equal(rows.matters.length,2);
  api.openMatterActions('todos',1);
  assert.match(el('matterCandidateResults').innerHTML,/属于其他事项/);
  api.matterChooseExisting('todos',3);
  assert.equal(rows.matters.length,2);
  assert.equal(rows.todos[2].matter_id,rows.todos[3].matter_id);
  assert.notEqual(rows.todos[0].matter_id,rows.todos[2].matter_id);
  assert(messages.some(message=>message.includes('不同事项')));
});
