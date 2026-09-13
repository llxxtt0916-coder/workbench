// 运行：node tests/v14_upgrade.test.js
// 用真实迁移函数验证旧记录的正文、关联、软删除标记不丢失。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function repairData(){');
const end = html.indexOf('//  NAVIGATION', start);
assert.ok(start >= 0 && end > start, '找不到迁移函数');

const data = {
  todos: [
    {id:'legacy-1',text:'旧工作',content:'原正文',note:'旧备注',category:'业务',source:'下发',subtasks:[{text:'旧步骤'}],deleted:true,extraField:'保留'},
    {id:'legacy-2',text:'活跃旧工作',note:'原备注',due:'2026-09-20',done:false,deleted:false}
  ],
  handovers: [{id:'handover-1',content:'旧交接内容',quantity:'2',docType:'纸质',deleted:false}],
  expenses: [{id:7,content:'旧报销',amount:100,invoice:'TEST',fundItem:3,deleted:false}],
  funds: [{id:3,name:'旧经费',budget:1000,category:'旧分类',deleted:false}],
  fundRecords: [{id:'manual-1',fundId:3,amount:50,content:'旧开支',deleted:false}]
};
const DB = {
  raw(key){return structuredClone(data[key] || []);},
  set(key, rows){data[key] = structuredClone(rows);}
};
const sandbox = {
  DB,
  normPriority: x => x || '不重要不紧急',
  normalizeDate: x => x ? String(x).slice(0, 10) : '',
  syncLedgerTodo: () => {},
  ensureV14: () => {},
  console: {log(){}},
};
vm.runInNewContext(html.slice(start, end) + '\nrepairData();', sandbox);

assert.equal(data.todos.length, 2);
assert.equal(data.todos[0].id, 'legacy-1');
assert.equal(data.todos[0].deleted, true);
assert.equal(data.todos[0].content, '原正文');
assert.equal(data.todos[0].note, '旧备注');
assert.equal(data.todos[0].extraField, '保留');
assert.deepEqual(Array.from(data.todos[0].category), ['业务']);
assert.deepEqual(Array.from(data.todos[0].source), ['下发']);
assert.equal(data.todos[0].subtasks[0].text, '旧步骤');
assert.equal(data.todos[1].deadline, '2026-09-20');
assert.equal(data.handovers[0].content, '旧交接内容');
assert.equal(data.handovers[0].items[0].quantity, '2');
assert.equal(data.expenses[0].fundItem, 3);
assert.equal(data.fundRecords[0].amount, 50);
assert.equal(data.funds[0].budget, 1000);
console.log('v1.4 旧数据迁移兼容测试通过');
