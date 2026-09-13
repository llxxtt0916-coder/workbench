// 长期目标独立：渲染分离验证（加载真实 index.html）
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('f:/workbuddy/workstation/workbench/index.html', 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let m, code = '';
while ((m = re.exec(html))) { if (m[1].length > code.length) code = m[1]; }

const store = new Map();
const localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
const recs = {};
function elFor(id){
  return {
    _id:id, _html:'',
    set innerHTML(v){ this._html=v; recs[id]=v; },
    get innerHTML(){ return this._html; },
    value:'', textContent:'', disabled:false, style:{}, dataset:{},
    classList:{toggle(){},add(){},remove(){},contains(){return false}},
    options:[], addEventListener(){}, removeEventListener(){}, appendChild(){},
    setAttribute(){}, getAttribute(){}, focus(){}, click(){},
    querySelector(){return elFor('x')}, querySelectorAll(){return []}
  };
}
const documentStub = {
  addEventListener:()=>{},
  getElementById:(id)=>elFor(id),
  querySelector:()=>elFor('q'),
  querySelectorAll:()=>[],
  createElement:()=>elFor('c'),
  body:elFor('b')
};
const sandbox = {
  console, localStorage, document:documentStub,
  window:{addEventListener:()=>{}}, navigator:{userAgent:'node'},
  confirm:()=>true, alert:()=>{},
  setTimeout:()=>0, setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},
  __RESULT:[], __recs: recs
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, {filename:'index_inline.js'});
vm.runInContext('try{rerenderCurrent=function(){};}catch(e){}', sandbox);
vm.runInContext('try{updateTodoBadge=function(){};}catch(e){}', sandbox);

const assertCode = `
// 种入：1 个长期目标(进行中) + 1 个普通待办(未开始)
DB.set('todos', [
  {id:1, name:'学Python', is_goal:true, state:'进行中', recurrence:'none', parent_goal:'', due_date:'', type:'pending', category:[], source:[], content:'', deadline:'', status:'进行中', subtasks:[]},
  {id:2, name:'写本周周报', is_goal:false, state:'未开始', recurrence:'none', parent_goal:'', due_date:'2026-07-25', type:'pending', category:[], source:[], content:'', deadline:'2026-07-25', status:'未开始', subtasks:[]}
]);
renderTodos();
renderGoals();
var todoHtml = globalThis.__recs['todoActiveList'] || '';
var goalHtml = globalThis.__recs['goalList'] || '';
var R=globalThis.__RESULT;
function check(name, cond, info){ R.push({name:name, pass:!!cond, info:info||''}); }
var dbg = 'active='+getActiveItems().length+' goals='+getAllLedgerItems().filter(r=>r.is_goal).length;
R.push({name:'DEBUG', pass:true, info:dbg+' | todo.len='+todoHtml.length+' goal.len='+goalHtml.length+' todo.slice='+todoHtml.slice(0,80)});
check('待办页不含长期目标', todoHtml.indexOf('学Python')===-1, 'todo含目标名='+(todoHtml.indexOf('学Python')!==-1));
check('待办页含普通待办', todoHtml.indexOf('写本周周报')!==-1, '');
check('长期目标页含目标且套用统一卡片', goalHtml.indexOf('学Python')!==-1 && goalHtml.indexOf('todo-card')!==-1 && goalHtml.indexOf('goal-card')===-1, 'goal含todo-card='+(goalHtml.indexOf('todo-card')!==-1)+' 残留旧goal-card='+(goalHtml.indexOf('goal-card')!==-1));
check('长期目标页不含普通待办', goalHtml.indexOf('写本周周报')===-1, '');
`;

vm.runInContext(assertCode, sandbox, {filename:'goals_assert.js'});
const results = sandbox.__RESULT;
let fail=0;
console.log('==== 长期目标独立 验证结果 ====');
results.forEach(r=>{ console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.info?'  ['+r.info+']':'')); if(!r.pass)fail++; });
console.log('==== 共 '+results.length+' 项，失败 '+fail+' 项 ====');
process.exit(fail?1:0);
