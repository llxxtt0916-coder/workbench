// 周期任务生成/关闭 端到端验证（加载真实 index.html 内联函数）
// 用法：node _temp_cycle_test.js
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('f:/workbuddy/workstation/workbench/index.html', 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let m, code = '';
while ((m = re.exec(html))) { if (m[1].length > code.length) code = m[1]; }
if (!code) { console.error('未找到内联脚本'); process.exit(1); }

// ---- 最小 DOM / 环境桩 ----
const store = new Map();
const localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
function makeEl() {
  const handler = {
    get(t, p) {
      if (p === 'classList') return { toggle(){}, add(){}, remove(){}, contains(){ return false; } };
      if (p === 'style') return {};
      if (p === 'dataset') return {};
      if (p === 'options') return [];
      if (p === 'value' || p === 'textContent' || p === 'innerHTML' || p === 'className') return '';
      if (p === 'disabled') return false;
      if (p === 'addEventListener' || p === 'removeEventListener' || p === 'appendChild' ||
          p === 'removeChild' || p === 'setAttribute' || p === 'getAttribute' ||
          p === 'focus' || p === 'blur' || p === 'click' || p === 'insertBefore') return () => {};
      if (p === 'querySelector') return () => makeEl();
      if (p === 'querySelectorAll') return () => [];
      return makeEl();
    },
    set() { return true; },
    apply() { return makeEl(); }
  };
  return new Proxy(function(){}, handler);
}
const documentStub = {
  addEventListener: () => {},
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: () => makeEl(),
  body: makeEl()
};
const windowStub = { addEventListener: () => {}, setTimeout: () => 0, clearTimeout: () => {} };

const sandbox = {
  console,
  localStorage,
  document: documentStub,
  window: windowStub,
  navigator: { userAgent: 'node' },
  confirm: () => true,
  alert: () => {},
  setTimeout: () => 0,
  setInterval: () => 0,
  clearTimeout: () => {},
  clearInterval: () => {},
  __RESULT: []
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'index_inline.js' });
// 把重渲染类函数置空，避免无谓的 DOM 渲染
vm.runInContext('try{rerenderCurrent=function(){};}catch(e){}', sandbox);
vm.runInContext('try{updateTodoBadge=function(){};}catch(e){}', sandbox);

// ---- 场景断言（在沙箱内运行，可访问真实 setState/DB/ledgerDefaults/STATE）----
const assertCode = `
function mk(due, rec, state){
  const arr=DB.raw('todos');
  const r=ledgerDefaults('todos');
  r.id=DB.nextId(arr);
  r.name='T'+r.id; r.due_date=due||''; if(due) r.deadline=due;
  r.recurrence=rec||'none'; r.state=state||STATE.TODO;
  arr.push(r); DB.set('todos', arr);
  return r.id;
}
function len(){ return DB.raw('todos').length; }
function findNew(originId){ return DB.raw('todos').find(r=>String(r.id)!==String(originId)); }
const R=globalThis.__RESULT;
function check(name, cond, info){ R.push({name:name, pass:!!cond, info:info||''}); }

// S1: 有截止日的周期项，完成应生成下一期
DB.set('todos', []);
var a=mk('2026-07-21','1w',STATE.TODO);
setState('todos', a, STATE.DONE);
var an=findNew(a);
check('S1 有截止日的周期项完成时生成下一期', len()===2 && an && an.due_date==='2026-07-28' && an.state===STATE.TODO, 'len='+len()+' newDue='+(an&&an.due_date));

// S2: 无截止日的周期项，完成也应生成下一期（当前有 bug：静默不生成）
DB.set('todos', []);
var b=mk('','1w',STATE.TODO);
setState('todos', b, STATE.DONE);
check('S2 无截止日的周期项完成时仍生成下一期', len()===2, 'len='+len());

// S3: 标"已关闭"应真正停止整条周期（当前有 bug：已生成的下一期完成会继续繁衍）
DB.set('todos', []);
var c=mk('2026-07-21','1w',STATE.TODO);
setState('todos', c, STATE.DONE);          // 生成 c2(待办, 仍周期)
var c2=findNew(c);
setState('todos', c, STATE.CLOSED);        // 用户想停周期，关闭原始项
setState('todos', c2.id, STATE.DONE);      // 完成已生成的下一期
check('S3 标已关闭后整条周期停止(完成下一期不再生成第三代)', len()===2, 'len='+len()+' (期望2：原项+下一期)');

// S4: 固定日期模式(每月第5日)完成应生成下一期
DB.set('todos', []);
var d=mk('2026-07-21','dom:5',STATE.TODO);
setState('todos', d, STATE.DONE);
var dn=findNew(d);
check('S4 固定日期(每月第5日)完成生成下一期', len()===2 && dn && /^2026-08-05$/.test(dn.due_date), 'newDue='+(dn&&dn.due_date));

// S5: 仅关闭、绝不成成
DB.set('todos', []);
var e=mk('2026-07-21','1w',STATE.TODO);
setState('todos', e, STATE.CLOSED);
check('S5 仅关闭不生成', len()===1, 'len='+len());

// S6: 关闭最新待办项后，重开并完成后不应复活周期
DB.set('todos', []);
var f=mk('2026-07-21','1w',STATE.TODO);
setState('todos', f, STATE.DONE);          // 生成 f2
var f2=findNew(f);
setState('todos', f2.id, STATE.CLOSED);    // 关掉待办中的下一期
// 模拟重新打开再完成
setState('todos', f2.id, STATE.TODO);
setState('todos', f2.id, STATE.DONE);
check('S6 已关停的待办项重开完成不再复活周期', len()===2, 'len='+len());
`;

vm.runInContext(assertCode, sandbox, { filename: 'assert.js' });

const results = sandbox.__RESULT;
let fail = 0;
console.log('==== 周期生成/关闭 验证结果 ====');
results.forEach(r => {
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.info ? '  [' + r.info + ']' : ''));
  if (!r.pass) fail++;
});
console.log('==== 共 ' + results.length + ' 项，失败 ' + fail + ' 项 ====');
process.exit(fail ? 1 : 0);
