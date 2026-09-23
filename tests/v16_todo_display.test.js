const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function todoLedgerLabel(key)');
const end = html.indexOf('function toggleSubtasks(id)', start);
assert(start >= 0 && end > start);
const renderer = html.slice(start, end);
const colors = html.match(/const PRIORITY_COLOR=\{[^\n]+/)[0];
const priorityTag = html.slice(html.indexOf('function priorityTag(p){'), html.indexOf('const PERIOD =', html.indexOf('function priorityTag(p){')));
const nodes = new Map();
function element(id){
  if(!nodes.has(id)) nodes.set(id, {innerHTML:'', textContent:''});
  return nodes.get(id);
}
const records = [
  {_ledger:'purchases',id:101,name:'采购 A',priority:'重要且紧急',date:'2026-09-01',due_date:'2026-09-02'},
  {_ledger:'todos',id:1,name:'普通工作',state:'TODO',priority:'不重要不紧急',subtasks:[]},
  {_ledger:'todos',id:2,name:'重要不紧急 A',state:'TODO',priority:'重要不紧急',issueDate:'2026-09-01',deadline:'2026-09-30',assignee:'甲',subtasks:[]},
  {_ledger:'contracts',id:201,name:'合同 A',priority:'紧急不重要',date:'2026-09-01'},
  {_ledger:'expenses',id:301,name:'报销 A',priority:'重要且紧急',date:'2026-09-01'},
  {_ledger:'meetings',id:401,name:'会议 A',priority:'重要不紧急',date:'2026-09-01'},
  {_ledger:'trainings',id:501,name:'培训 A',priority:'不重要不紧急',startDate:'2026-09-01'},
  {_ledger:'todos',id:3,name:'紧急不重要 A',state:'TODO',priority:'紧急不重要',subtasks:[]},
  {_ledger:'todos',id:4,name:'重要且紧急 A',state:'TODO',priority:'重要且紧急',due_date:'2026-10-02',subtasks:[]},
  {_ledger:'todos',id:5,name:'重要且紧急 B',state:'TODO',priority:'重要且紧急',due_date:'2026-10-01',subtasks:[]},
  {_ledger:'todos',id:6,name:'未设置工作',state:'TODO',subtasks:[]},
  {_ledger:'purchases',id:102,name:'采购 B',due_date:'2026-09-01'}
];
const sandbox = {document:{getElementById:element}, Date, Set, console};
vm.createContext(sandbox);
vm.runInContext(`
const STATE={TODO:'TODO',DOING:'DOING'};
let v16TodoCategory='all', renderTodos;
const v16ExpandedSubtasks=new Set();
${colors}
function normPriority(p){return p||'不重要不紧急';}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');}
${priorityTag}
function getVisibleTodoItems(){return records;}
function renderReminders(){} function updateTodoBadge(){}
function todayStr(){return '2026-09-23';}
function getDueDate(r){return r.due_date||r.deadline||'';}
function isOverdue(){return false;}
function subtaskSummary(){return {pct:0,done:0,total:0,next:null};}
function renderSubtasks(){return '';}
function stateBadge(){return '';}
function recordDisplayName(r){return r.name;}
${renderer}
renderTodos();
`, Object.assign(sandbox,{records}));
const cards = element('todoActiveList').innerHTML;
const tabs = element('todoLedgerTabs').innerHTML;
const cardOrder = [...cards.matchAll(/data-bulk-key="([^"]+)" data-bulk-id="([^"]+)"/g)].map(m=>m[1]+':'+m[2]);
assert.deepEqual(cardOrder.slice(0,6), ['todos:5','todos:4','todos:3','todos:2','todos:1','todos:6']);
assert(cardOrder.indexOf('purchases:102')<cardOrder.indexOf('purchases:101'));
for(const key of ['contracts:201','expenses:301','meetings:401','trainings:501'])assert(cardOrder.slice(6).includes(key));
assert(tabs.indexOf("setTodoCategory('todos')") < tabs.indexOf("setTodoCategory('purchases')"));
const work = cards.match(/data-bulk-key="todos" data-bulk-id="2"[\s\S]*?class="todo-subtask-bar"/)[0];
assert(work.includes('开始 2026-09-01') && work.includes('截止 2026-09-30') && work.includes('经办人 甲'));
const empty = cards.match(/data-bulk-key="todos" data-bulk-id="6"[\s\S]*?class="todo-subtask-bar"/)[0];
assert(!empty.includes('todo-card-meta'));
for(const id of ['101','102','201','301','401','501']){
  const start=cards.indexOf(`data-bulk-id="${id}"`);
  const next=cards.indexOf('<div class="todo-card"',start);
  const nonWork=cards.slice(start,next<0?undefined:next);
  assert(!nonWork.includes('开始 ') && !nonWork.includes('截止 ') && !nonWork.includes('重要') && !nonWork.includes('经办人'));
}
assert(!cards.includes('未指定') && !cards.includes('>—<'));
for(const [label,color] of [['重要且紧急','#d93025'],['紧急不重要','#e8920c'],['重要不紧急','#2563eb'],['不重要不紧急','#9aa0a6']]){
  assert(cards.includes(`background:${color};color:#fff">${label}</span>`));
}
console.log('v1.6 待办分组排序、四象限颜色、空元数据及非工作展示测试通过');
