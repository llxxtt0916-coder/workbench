// 待办关联长期目标 全流程验证（加载真实 index.html）
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
  removeItem: k => store.delete(k),
  key: i => Array.from(store.keys())[i] || null,
  get length(){ return store.size; }
};
const recs = {};
const elCache = new Map();
function elFor(id){
  const el = {
    _id:id, _html:'',
    set innerHTML(v){ this._html=v; recs[id]=v; },
    get innerHTML(){ return this._html; },
    value:'', textContent:'', disabled:false, style:{}, dataset:{},
    classList:{toggle(){},add(){},remove(){},contains(){return false}},
    options:[], addEventListener(){}, removeEventListener(){}, appendChild(){},
    setAttribute(){}, getAttribute(){}, focus(){}, click(){},
    querySelector(){return elFor('x')}, querySelectorAll(){return []}
  };
  return el;
}
function getEl(id){ if(!elCache.has(id)) elCache.set(id, elFor(id)); return elCache.get(id); }
const documentStub = {
  addEventListener:()=>{},
  getElementById:(id)=>getEl(id),
  querySelector:()=>getEl('q'),
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
['rerenderCurrent','toast','closeModal','openModal','onArchiveLedgerChange','updateTodoBadge','updateGoalBadge','updateRemindPermBtn','closePreview']
  .forEach(fn=>{ try{ vm.runInContext(fn+'=function(){};', sandbox); }catch(e){} });

const assertCode = `
DB.set('todos', []);
const R=globalThis.__RESULT;
function check(name, cond, info){ R.push({name:name, pass:!!cond, info:info||''}); }

// ===== 路径A：新建时直接关联（createLedgerItem parentGoal）=====
const G = createLedgerItem('todos', {title:'学Python', isGoal:true});
const t1 = createLedgerItem('todos', {title:'看第1章', parentGoal:G.id});
const t2 = createLedgerItem('todos', {title:'做练习', parentGoal:G.id});
const t3 = createLedgerItem('todos', {title:'写笔记', parentGoal:G.id});
R.push({name:'DEBUG', pass:true, info:'G.id='+G.id+' G.is_goal='+G.is_goal+' t1.pg='+t1.parent_goal+' count='+DB.raw('todos').length});
check('目标 is_goal=true', G.is_goal===true, '');
check('子任务 parent_goal 写入', t1.parent_goal==='todos:'+G.id, 't1.pg='+t1.parent_goal);
check('关联目标下拉含目标', activeGoalOptions().indexOf('学Python')!==-1, '');
let p = goalProgress(G.id);
check('初始 total=3/closed=0', p.total===3 && p.closed===0, 'total='+p.total+' closed='+p.closed);
setState('todos', t1.id, STATE.DONE);
p = goalProgress(G.id);
check('完成1后 closed=1/pct=33', p.closed===1 && p.pct===33, 'closed='+p.closed+' pct='+p.pct);
const card = goalCardHtml(G);
check('目标卡含“子任务 1/3”', card.indexOf('子任务 1/3')!==-1, 'card='+card.slice(0,80));

// ===== 路径B：待办页“整理”弹窗给已有待办关联目标（applyOrganize）=====
const t4 = createLedgerItem('todos', {title:'复习考试', state:STATE.TODO});
check('t4 初始未关联', t4.parent_goal==='', 't4.pg='+t4.parent_goal);
document.getElementById('archiveLedger').value='todos';
document.getElementById('archiveItemId').value=String(t4.id);
document.getElementById('archiveTitle').value=t4.name;
document.getElementById('archiveRequirement').value='';
document.getElementById('archiveDue').value='';
document.getElementById('archivePriority').value='不重要不紧急';
document.getElementById('archiveState').value='未开始';
document.getElementById('archiveGoal').value=String(G.id);
applyOrganize();
const t4b = DB.raw('todos').find(r=>String(r.id)===String(t4.id));
check('整理后 t4 关联目标', t4b.parent_goal==='todos:'+G.id, 't4b.pg='+t4b.parent_goal);
p = goalProgress(G.id);
check('关联后 total=4', p.total===4, 'total='+p.total);

// ===== 路径C：智能录入新建即关联（saveSmart）=====
document.getElementById('smartInput').value='写本周周报';
document.getElementById('smartCat').value='todos';
document.getElementById('smartGoal').value=String(G.id);
try{ _smartDetected='{"cat":"todo","fields":{}}'; }catch(e){}
smartSave();
const smartTodo = DB.raw('todos').filter(r=>r.name==='写本周周报').pop();
check('智能录入关联目标写入', smartTodo && smartTodo.parent_goal==='todos:'+G.id, 'pg='+(smartTodo&&smartTodo.parent_goal));
p = goalProgress(G.id);
check('智能录入后 total=5', p.total===5, 'total='+p.total);

// ===== 路径D：渲染分离与标签 =====
renderTodos();
const todoHtml = globalThis.__recs['todoActiveList'] || '';
check('待办卡含“目标子任务”标签', todoHtml.indexOf('目标子任务')!==-1, '');
check('待办页不含目标名', todoHtml.indexOf('学Python')===-1, 'todo含目标名='+(todoHtml.indexOf('学Python')!==-1));
renderGoals();
const goalHtml = globalThis.__recs['goalList'] || '';
check('目标页含目标名与进度', goalHtml.indexOf('学Python')!==-1 && goalHtml.indexOf('1/5')!==-1, 'goal含1/5='+(goalHtml.indexOf('1/5')!==-1));

// ===== 防御：目标不能自我关联（createLedgerItem 兜底 + 整理误选拦截）=====
document.getElementById('archiveLedger').value='todos';
document.getElementById('archiveItemId').value=String(G.id);
document.getElementById('archiveTitle').value=G.name;
document.getElementById('archiveRequirement').value='';
document.getElementById('archiveDue').value='';
document.getElementById('archivePriority').value='不重要不紧急';
document.getElementById('archiveState').value='进行中';
document.getElementById('archiveGoal').value=String(G.id); // 误选自己
applyOrganize();
const Gb = DB.raw('todos').find(r=>String(r.id)===String(G.id));
check('目标自我关联被拦截(整理)', Gb.parent_goal==='', 'G.pg='+Gb.parent_goal);
// createLedgerItem 关联其他目标为合法子目标，不应误伤（防御只拦“自身关联”）
const subGoal = createLedgerItem('todos', {title:'子目标-读书', isGoal:true, parentGoal:G.id});
const subGoalB = DB.raw('todos').find(r=>String(r.id)===String(subGoal.id));
check('新建目标关联其他目标合法(不误伤)', subGoalB.parent_goal==='todos:'+G.id, 'pg='+subGoalB.parent_goal);
`;

vm.runInContext(assertCode, sandbox, {filename:'goal_link_assert.js'});
const results = sandbox.__RESULT;
let fail=0;
console.log('==== 待办关联长期目标 全流程验证 ====');
results.forEach(r=>{ console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.info?'  ['+r.info+']':'')); if(!r.pass)fail++; });
console.log('==== 共 '+results.length+' 项，失败 '+fail+' 项 ====');
process.exit(fail?1:0);
