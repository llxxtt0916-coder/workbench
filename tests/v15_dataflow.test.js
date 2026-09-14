const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`找不到代码段 ${start}`);
  return html.slice(a,b);
}
const rows={};
const saved=new Map();
const DB={
  raw:key=>structuredClone(rows[key]||[]),
  get:key=>structuredClone((rows[key]||[]).filter(r=>!r.deleted)),
  set:(key,value)=>{rows[key]=structuredClone(value);},
  nextId:items=>items.length?Math.max(0,...items.map(x=>typeof x.id==='number'?x.id:0))+1:1
};
const source=[
  section('const LEDGER_META = {','const PERIOD ='),
  section('const LEDGER_FIELDS = {','function validDateOrder('),
  section('function recordState(','// 取某台账'),
  section('function getAllLedgerItems(){','// v1.4 数据层保障'),
  section('function setState(','function stopRecurrenceGroup('),
  section('function ledgerDefaults(','// 当前活跃目标列表')
].join('\n');
const api=vm.runInNewContext(source+'\n({STATE,createLedgerItem,getActiveItems,formalLedgerItems,setState,retireVerifiedLegacyMirrors})',{
  DB,localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
  todayStr:()=> '2026-09-14',getDueDate:()=>'',rerenderCurrent:()=>{},toast:()=>{},
  maybeRegenerate:()=>{},stopRecurrenceGroup:()=>{},confirm:()=>true,console
});
const {STATE,createLedgerItem,getActiveItems,formalLedgerItems,setState,retireVerifiedLegacyMirrors}=api;
const contract=createLedgerItem('contracts',{title:'合同A',state:STATE.TODO,extra:{assignee:'张三'}});
assert.equal(getActiveItems().filter(x=>x._ledger==='contracts').length,1);
assert.equal(formalLedgerItems('contracts').length,0);
assert.equal(DB.get('todos').length,0,'合同不得生成工作记录副本');
assert.equal(contract.assignee,'张三');
setState('contracts',contract.id,STATE.DONE);
assert.equal(getActiveItems().filter(x=>x._ledger==='contracts').length,0);
assert.equal(formalLedgerItems('contracts').length,1);
assert.equal(DB.get('todos').length,0);
const purchase=createLedgerItem('purchases',{title:'采购A',state:STATE.DONE});
assert.equal(formalLedgerItems('purchases').length,1);
assert.equal(getActiveItems().filter(x=>x._ledger==='purchases').length,0);
const work=createLedgerItem('todos',{title:'工作A',state:STATE.DONE});
assert.equal(work.type,'record');
assert.equal(formalLedgerItems('todos').length,1);
assert.equal(getActiveItems().filter(x=>x._ledger==='todos').length,0);
rows.todos.push({id:99,name:'旧版未结束工作',status:'未开始',type:'pending',deleted:false});
assert.equal(formalLedgerItems('todos').length,1,'旧数据即使没有 state 也不能进入工作台账');
rows.todos.pop();
const meeting=createLedgerItem('meetings',{title:'会议A',state:STATE.DOING,extra:{assignee:'李四'}});
assert.equal(getActiveItems().filter(x=>x._ledger==='meetings').length,1);
setState('meetings',meeting.id,STATE.CLOSED);
assert.equal(formalLedgerItems('meetings').length,1);
const count=Object.values(rows).reduce((n,a)=>n+a.length,0);
getActiveItems();formalLedgerItems('contracts');
assert.equal(Object.values(rows).reduce((n,a)=>n+a.length,0),count,'重复读取不得复制记录');
const oldMirror={id:9,name:'采购副本',origin:'purchases:'+purchase.id,type:'record',state:STATE.DONE,deleted:false};
rows.todos.push(oldMirror);
rows.purchases[0].todoRef=9;
retireVerifiedLegacyMirrors();
assert.equal(rows.todos.find(x=>x.id===9).deleted,true,'仅已验证关联的旧副本软删除');
assert(saved.has('wb_v15_todos_before_mirror_cleanup'),'清理前应保存本地快照');
retireVerifiedLegacyMirrors();
assert.equal(rows.todos.length,2,'重复清理不得产生副本');
const organizeSource=section('function openOrganizeModal(ledgerKey, id){','function deleteQuickNote(id){');
const calls=[];
const hidden={style:{display:''}};
const modal={dataset:{},querySelectorAll:()=>[{closest:()=>hidden}]};
const organizeSandbox={document:{getElementById:()=>modal},toast:()=>{},
  hideLifecycleStatusField:()=>{hidden.style.display='none';}};
for(const [key,fn] of Object.entries({todos:'editTodo',contracts:'editContract',purchases:'editPurchase',expenses:'editExpense',
  agencys:'editAgency',handovers:'editHandover',funds:'editFund',meetings:'editMeeting',trainings:'editTraining',fundRecords:'editFundRecord'})){
  organizeSandbox[fn]=id=>calls.push([key,id]);
}
const openOrganize=vm.runInNewContext(organizeSource+'\nopenOrganizeModal',organizeSandbox);
for(const key of ['todos','contracts','purchases','expenses','agencys','handovers','funds','meetings','trainings','fundRecords']){
  hidden.style.display='';openOrganize(key,7);
  assert.equal(calls.at(-1)[0],key);
  assert.equal(hidden.style.display,'none','整理表单不显示状态字段');
}
const inspirationSource=section("let activeInspTag='';",'function handleTagInput(');
const inspirationRows=[{id:1,title:'阅读',content:'笔记',tags:["O'Reilly"],createdAt:'2026-09-14'}];
const nodes={inspSearch:{value:''},inspTagFilter:{innerHTML:''},inspList:{innerHTML:''}};
const inspiration=vm.runInNewContext(inspirationSource+'\n({renderInspiration,filterInspTag})',{
  DB:{get:()=>inspirationRows.filter(r=>!r.deleted)},
  document:{getElementById:id=>nodes[id]},
  esc:s=>String(s??'').replace(/'/g,'&#39;')
});
inspiration.renderInspiration();
assert(nodes.inspTagFilter.innerHTML.includes('data-tag="O&#39;Reilly"'),'含单引号的真实标签可安全选择');
inspirationRows[0].deleted=true;
inspiration.renderInspiration();
assert(!nodes.inspTagFilter.innerHTML.includes('O&#39;Reilly'),'删除最后一条灵感后标签立即消失');
inspirationRows.push({id:2,title:'新想法',content:'内容',tags:['新标签'],createdAt:'2026-09-14'});
inspiration.renderInspiration();
assert(nodes.inspTagFilter.innerHTML.includes('新标签'),'新增灵感后标签立即出现');
inspirationRows[1].tags=['已修改'];
inspiration.renderInspiration();
assert(!nodes.inspTagFilter.innerHTML.includes('新标签')&&nodes.inspTagFilter.innerHTML.includes('已修改'),'修改标签后立即重算');
console.log('v1.5 状态分流、所属板块、经办人、旧副本幂等清理测试通过');
