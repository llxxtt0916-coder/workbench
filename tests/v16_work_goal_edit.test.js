const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
assert(html.includes('<select class="form-control" id="todoGoal">'));
function section(a,b){
  const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
  assert(start>=0&&end>start,`找不到 ${a}`);
  return html.slice(start,end);
}
const goalFunctions=section('function activeGoalOptions(){','// 新建长期目标');
const editFunctions=section('function saveTodo(){','function deleteTodo(');
const nodes=new Map();
function element(id){
  if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',dataset:{},style:{},classList:{add(){},remove(){}}});
  return nodes.get(id);
}
const rows=[
  {id:1,name:'目标一',is_goal:true,state:'DOING',recurrence:'none'},
  {id:2,name:'目标二',is_goal:true,state:'DOING',recurrence:'none'},
  {id:3,name:'已完成目标',is_goal:true,state:'DONE',recurrence:'none'},
  {id:10,name:'原工作',type:'record',state:'TODO',priority:'重要且紧急',parent_goal:'todos:1',subtasks:[{id:11,name:'子任务'}],matter_id:'matter_1',related_sources:[{type:'purchase',id:4}]}
];
const DB={get:()=>structuredClone(rows.filter(r=>!r.deleted)),raw:()=>rows,nextId:a=>Math.max(0,...a.map(r=>r.id))+1,set:(_k,v)=>rows.splice(0,rows.length,...structuredClone(v))};
const sandbox={document:{getElementById:element},DB,Date,console};
vm.createContext(sandbox);
vm.runInContext(`
const STATE={TODO:'TODO',DOING:'DOING'};
function getAllLedgerItems(){return DB.get('todos').map(r=>Object.assign({_ledger:'todos'},r));}
function esc(v){return String(v??'');}
function normPriority(p){return p||'不重要不紧急';}
function subtaskSummary(r){return {total:(r.subtasks||[]).length,done:0};}
function normalizeSubtasks(s){return s;}
function getMultiSelected(){return [];}
function toArray(v){return Array.isArray(v)?v:v?[v]:[];}
function setMultiSelected(){}
function selectedWorkConfigIds(){return [];}
function selectedWorkSourceOrgIds(){return [];}
function existingRecord(key,id){return DB.raw(key).find(row=>row.id===id)||{};}
function validDateOrder(){return true;}
function finishWorkRecord(){}
function openModal(){} function closeModal(){} function onRecTypeChange(){}
function renderTodo(){} function renderTodos(){} function toast(){}
let currentPage='todo';
${goalFunctions}
${editFunctions}
`, sandbox);
const api=vm.runInContext('({editTodo,saveTodo,setTodoGoalOptions})',sandbox);
api.editTodo(10);
assert.equal(element('todoGoal').value,'1');
assert(element('todoGoal').innerHTML.includes('目标二'));
element('todoGoal').value='2';
api.saveTodo();
assert.equal(rows.find(r=>r.id===10).parent_goal,'todos:2');
assert.equal(rows.find(r=>r.id===10).subtasks.length,1);
assert.equal(rows.find(r=>r.id===10).matter_id,'matter_1');
assert.deepEqual(rows.find(r=>r.id===10).related_sources,[{type:'purchase',id:4}]);
api.editTodo(10);
element('todoGoal').value='';
api.saveTodo();
assert.equal(rows.find(r=>r.id===10).parent_goal,'');
rows.find(r=>r.id===10).parent_goal='todos:3';
api.editTodo(10);
assert.equal(element('todoGoal').value,'3');
assert(element('todoGoal').innerHTML.includes('已结束'));
api.saveTodo();
assert.equal(rows.find(r=>r.id===10).parent_goal,'todos:3');
const smartSave=section('function smartSave(){','// 智能录入作为统一入口');
const created=[];
const smartNodes=new Map();
function smartElement(id){
  if(!smartNodes.has(id))smartNodes.set(id,{value:''});
  return smartNodes.get(id);
}
const smartSandbox={document:{getElementById:smartElement},created,console};
vm.createContext(smartSandbox);
vm.runInContext(`
const STATE={TODO:'TODO',DOING:'DOING',DONE:'DONE',CLOSED:'CLOSED'};
const ENTRY_KEYS=['todos','purchases'];
let _smartDetected='{"cat":"todos","fields":{}}';
function normalizeDate(v){return v;}
function createLedgerItem(key,options){created.push({key,options});}
function smartClear(){} function closeModal(){} function toast(){}
${smartSave}
`,smartSandbox);
smartElement('smartInput').value='推进目标';
smartElement('smartCat').value='todos';
smartElement('smartState').value='TODO';
smartElement('smartGoal').value='2';
vm.runInContext('smartSave()',smartSandbox);
assert.equal(created[0].key,'todos');
assert.equal(created[0].options.parentGoal,2);
smartElement('smartCat').value='purchases';
smartElement('smartGoal').value='';
vm.runInContext('smartSave()',smartSandbox);
assert.equal(created[1].key,'purchases');
assert.equal(created[1].options.parentGoal,undefined);
console.log('v1.6 工作编辑长期目标查看、更换、解除及旧目标保留测试通过');
