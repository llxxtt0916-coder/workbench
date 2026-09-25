const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
function sourceBetween(start, end, from = 0) {
  const a = html.indexOf(start, from);
  const b = html.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Missing source section: ${start}`);
  return html.slice(a, b);
}
const ledgerSource = sourceBetween('function formalLedgerItems(key)', '// 取某台账条目');
const stateSource = sourceBetween('function mapStatusToState(ledgerKey, status)', 'function validDateOrder') +
  sourceBetween('function recordState(key, rec)', 'function finishWorkRecord');
const fundSource = sourceBetween('function expenseFundId(expense)', 'function toggleFundDetail(id)');
const dashboardStart = html.lastIndexOf('function renderDashboard(){');
const dashboardSource = sourceBetween('function renderDashboard(){', 'function shiftSummaryMonth', dashboardStart);
const summaryStart = html.lastIndexOf('function renderSummary(){');
const summarySource = sourceBetween('function renderSummary(){', 'function monthlySummaryText(){', summaryStart);
const summaryTextSource = sourceBetween('function monthlySummaryText(){', 'function copyMonthlySummary');

function renderCase(projectState, expenseStates = []) {
  const rows = {
    funds: [{ id: 10, name: '经费甲项目', state: projectState, budget: 1000 }],
    expenses: expenseStates.map((state, i) => ({
      id: 20 + i, fundItem: 10, state, amount: 100, appDate: '2026-09-12'
    })),
    fundRecords: [], meetings: [], trainings: []
  };
  const nodes = new Map();
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', innerHTML: '', textContent: '' });
    return nodes.get(id);
  } };
  const DB = {
    get: key => structuredClone((rows[key] || []).filter(r => !r.deleted)),
    raw: key => structuredClone(rows[key] || [])
  };
  const api = vm.runInNewContext(`
    const STATE = { TODO:'TODO', DOING:'DOING', DONE:'DONE', CLOSED:'CLOSED' };
    ${stateSource}
    function belongsToLedger(key, record) { return (record.owner_ledger || key) === key; }
    function fmtCNY(value) { return '¥' + Number(value); }
    function fmt(value) { return String(value); }
    function esc(value) { return String(value ?? ''); }
    function updateGenericFilterCount() {}
    function v16List(items, render, empty) { return items.length ? items.map(render).join('') : empty; }
    function v16AlertData() { return { alerts:[], today:'2026-09-18', soon:'2026-09-21' }; }
    function getActiveItems() { return []; }
    function renderDashboardCalendar() {}
    function fmtLocalDate(date) { return date.toISOString().slice(0,10); }
    function v16MonthData() { return { start:'2026-09-01', end:'2026-09-30', completed:[], subs:[], keyRelevant:[], cross:[], overdue:[], active:[] }; }
    ${ledgerSource}
    ${fundSource}
    ${dashboardSource}
    ${summarySource}
    ${summaryTextSource}
    ({ renderFunds, renderDashboard, renderSummary, monthlySummaryText, visibleFundProjects })
  `, { DB, document, window: {}, structuredClone, Date, Math, Set, Map });
  api.renderFunds();
  api.renderDashboard();
  api.renderSummary();
  return {
    selected: Array.from(api.visibleFundProjects(), f => f.id),
    fund: nodes.get('fundList').innerHTML,
    dashboard: nodes.get('v16Funds').innerHTML,
    monthly: nodes.get('v16MonthlyFunds').innerHTML,
    monthlyText: api.monthlySummaryText()
  };
}

test('经费项目四状态在三个当前进度位置使用同一可见集合', () => {
  for (const state of ['TODO', 'DOING', 'DONE', 'CLOSED']) {
    const actual = renderCase(state);
    const visible = state !== 'CLOSED';
    assert.deepEqual(actual.selected, visible ? [10] : [], `${state} selector`);
    for (const view of ['fund', 'dashboard', 'monthly']) {
      assert.equal(actual[view].includes('经费甲项目'), visible, `${state} ${view}`);
    }
    assert.equal(actual.monthlyText.includes('经费甲项目'), visible, `${state} monthly copy`);
  }
});

test('未开始经费项目的已使用金额在三处一致，且只计入已完成报销', () => {
  for (const [states, expected] of [
    [['DONE'], 100],
    [['TODO'], 0],
    [['DOING'], 0],
    [['TODO', 'DOING'], 0]
  ]) {
    const actual = renderCase('TODO', states);
    for (const view of ['fund', 'dashboard', 'monthly']) {
      assert(actual[view].includes('经费甲项目'), `${states} ${view} project`);
    }
    assert(actual.fund.includes(`¥${expected} / ¥1000`), `${states} fund used`);
    assert(actual.dashboard.includes(`已用 ¥${expected} ·`), `${states} dashboard used`);
    assert(actual.monthly.includes(`累计 ¥${expected} ·`), `${states} monthly used`);
  }
});
