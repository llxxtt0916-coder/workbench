const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`找不到区段：${start}`);return html.slice(a,b);}
const expenseFunctions=section('function expenseStateTotals','function renderExpenses');
const renderExpensesSource=section('function renderExpenses','function saveExpense');

function fixedDate(isoDate){
  return class FixedDate extends Date{
    constructor(...args){super(...(args.length?args:[isoDate+'T12:00:00.000Z']));}
    static now(){return new Date(isoDate+'T12:00:00.000Z').getTime();}
  };
}
function renderExpenseHeader(expenses,month){
  const elements={};
  const document={getElementById(id){return elements[id]||(elements[id]={value:'',textContent:'',innerHTML:'',style:{}});}};
  const DB={get:key=>key==='expenses'?structuredClone(expenses):[]};
  const api=vm.runInNewContext(`
    const STATE={TODO:'TODO',DOING:'DOING',DONE:'DONE',CLOSED:'CLOSED'};
    function recordState(_key,record){return record.state;}
    function belongsToLedger(){return true;}
    function formalLedgerItems(key){return DB.get(key).filter(record=>[STATE.DONE,STATE.CLOSED].includes(recordState(key,record)));}
    function fmt(value){return Number(value||0).toLocaleString('zh-CN');}
    function renderModuleStats(){} function expenseFundId(){return null;} function fundSubcategories(){return [];} function stateBadge(){return '';} function nativeStatusNote(){return '';} function esc(value){return String(value??'');} function updateGenericFilterCount(){} function refreshUnitFilterChoices(){} function matterActionButton(){return '';}
    ${expenseFunctions}
    ${renderExpensesSource}
    ({renderExpenses,getExpenseCompletedDate})
  `,{DB,document,Date:fixedDate(month+'-20'),structuredClone});
  api.renderExpenses();
  return {month:elements.expMonth.textContent,approved:elements.expApproved.textContent,getExpenseCompletedDate:api.getExpenseCompletedDate};
}
function amount(text){return Number(String(text).replace(/[^0-9.-]/g,''));}

const records=[
  {id:1,amount:200,state:'CLOSED',reimbDate:'2026-09-20'},
  {id:2,amount:100,state:'DONE',reimbDate:'2026-09-20'},
  {id:3,amount:2000,state:'DONE',reimbDate:'2026-09-18'},
  // 9 月点击状态完成，但实际报销日期在 8 月；closed_at 不得覆盖实际报销日期。
  {id:4,amount:5000,state:'DONE',reimbDate:'2026-08-28',closed_at:'2026-09-20T08:00:00.000Z'}
];

const september=renderExpenseHeader(records,'2026-09');
assert.equal(amount(september.month),2100,'页面顶部 2026 年 9 月本月支出必须是 ¥2,100');
assert.equal(amount(september.approved),7100,'页面顶部累计已报销必须是 ¥7,100');
assert.equal(september.getExpenseCompletedDate(records[3]),'2026-08-28','实际报销日期必须优先于状态完成时间');

const august=renderExpenseHeader(records,'2026-08');
assert.equal(amount(august.month),5000,'切换到 2026 年 8 月时，页面顶部本月支出必须是 ¥5,000');
assert.equal(amount(august.approved),7100,'切换月份不得改变累计已报销金额');

console.log('报销页顶部本月支出与累计已报销页面级回归测试通过');
