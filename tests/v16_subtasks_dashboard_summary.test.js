const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`找不到区段：${start}`);return html.slice(a,b);}
const source=section("let v16DraggedSubtaskId='';",'//  INIT');
const rows={todos:[],funds:[],fundRecords:[],expenses:[]};
const DB={raw:k=>structuredClone(rows[k]||[]),get:k=>structuredClone((rows[k]||[]).filter(r=>!r.deleted)),set:(k,v)=>rows[k]=structuredClone(v)};
const today='2026-09-18';
const doc={getElementById:()=>({innerHTML:'',textContent:'',value:'',style:{},querySelectorAll:()=>[]}),querySelectorAll:()=>[],addEventListener(){},createElement:()=>({}),body:{appendChild(){}}};
const sandbox={DB,doc,structuredClone,Date,Math,JSON,console,summaryDateRange:{start:'2026-09-01',end:'2026-09-30'}};
const api=vm.runInNewContext(`
const STATE={TODO:'TODO',DOING:'DOING',DONE:'DONE',CLOSED:'CLOSED'};
let statusWrites=0;
const LEDGER_META={todos:{label:'工作',page:'todo'},purchases:{label:'采购',page:'purchase'}};
function todayStr(){return '${today}';}
function fmtLocalDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function getDueDate(r){return r.due_date||r.deadline||'';}
function recordState(_k,r){return r.state||STATE.TODO;}
function isOverdue(r){const due=getDueDate(r);return !!due&&due<todayStr()&&![STATE.DONE,STATE.CLOSED].includes(recordState('',r));}
function getActiveItems(){return DB.get('todos').filter(r=>[STATE.TODO,STATE.DOING].includes(r.state)).map(r=>Object.assign({_ledger:'todos'},r));}
function getVisibleTodoItems(){return getActiveItems();}
function belongsToLedger(){return true;}
function stateBadge(){return '';}
function recordDisplayName(r){return r.name||r.title||'未命名';}
function esc(v){return String(v??'');}
function openStateModal(){} function openOrganizeModal(){} function renderReminders(){} function updateTodoBadge(){}
function renderTodo(){} function renderDashboard(){} function renderSummary(){} function expenseFundId(e){return e.fundItem||null;}
function fmtCNY(n){return '¥'+Number(n).toFixed(2);} function navigate(){} function toast(m){messages.push(m);} const messages=[];
function setState(key,id,state){statusWrites++;return {key,id,state};} function openModal(){} function closeModal(){} function saveTodo(){}
const document=doc; const navigator={}; const confirm=()=>true; const prompt=()=>null;
${source}
({normalizeSubtasks,workSubtasks,subtaskSummary,ensureV16Data,toggleSubtask,writeWorkSubtasks,moveSubtaskTo,setState,v16AlertData,v16MonthData,monthlySummaryText,dashboardCalendarEntries,modalFingerprint,v16ExpandedSubtasks,messages})`,sandbox);

// 历史数据无 subtasks 与旧 text/done 格式均应兼容，不改父记录 ID。
rows.todos=[
  {id:11,name:'历史空子任务',state:'DOING'},
  {id:12,name:'旧子任务',state:'DOING',subtasks:[{text:'旧步骤',done:false,addTime:'2026-09-01'}]}
];
api.ensureV16Data();
assert.deepEqual(rows.todos.map(t=>t.id),[11,12]);
assert.equal(api.workSubtasks(rows.todos[0]).length,0);
assert.equal(rows.todos[1].subtasks[0].name,'旧步骤');
assert.equal(rows.todos[1].subtasks[0].completed,false);
assert.ok(rows.todos[1].subtasks[0].id);

// 新增的标准字段、完成日期、取消完成、排序与父任务完成限制。
rows.todos[0].subtasks=[
  {id:'a',name:'先办',start_date:'2026-09-17',due_date:'2026-09-18',completed:false,sort_order:1,created_at:'2026-09-17',updated_at:'2026-09-17'},
  {id:'b',name:'后办',start_date:'2026-09-18',due_date:'2026-09-20',completed:false,sort_order:0,created_at:'2026-09-18',updated_at:'2026-09-18'}
];
let summary=api.subtaskSummary(rows.todos[0]);
assert.deepEqual(summary.list.map(s=>s.id),['b','a'],'人工排序应保留');
assert.equal(api.moveSubtaskTo(11,0,1),true,'上移/下移与拖拽共享同一持久化排序函数');
assert.deepEqual(rows.todos[0].subtasks.map(s=>s.id),['a','b'],'排序立即写回真实记录数组');
assert.deepEqual(rows.todos[0].subtasks.map(s=>s.sort_order),[0,1],'排序字段在刷新/Gitee snapshot 前已规范化保存');
api.toggleSubtask(11,0);
assert.equal(rows.todos[0].subtasks.find(s=>s.id==='a').completed_date,today,'完成默认写当天');
api.toggleSubtask(11,0);
assert.equal(rows.todos[0].subtasks.find(s=>s.id==='a').completed_date,'','取消完成清空日期');
assert.equal(api.setState('todos',11,'DONE'),false,'未完成子任务阻止父工作完成');
assert.equal(api.setState('todos',11,'CLOSED').state,'CLOSED','已关闭允许有未完成子任务');

// 展开 state 是 UI state，不会被写回、切换完成或重新排序影响。
api.v16ExpandedSubtasks.add('11');
api.toggleSubtask(11,0);
api.moveSubtaskTo(11,0,1);
assert(api.v16ExpandedSubtasks.has('11'),'子任务任何数据操作后应保持已展开');

// 子任务逾期纳入预警，但父工作统计按父工作去重。
rows.todos[0].subtasks=[
  {id:'o1',name:'逾期一',due_date:'2026-09-16',completed:false,sort_order:0,created_at:today,updated_at:today},
  {id:'o2',name:'逾期二',due_date:'2026-09-17',completed:false,sort_order:1,created_at:today,updated_at:today}
];
rows.todos[0].deadline='2026-09-25';
const alerts=api.v16AlertData().alerts.filter(x=>x.kind==='overdue');
assert.equal(alerts.length,2,'两个逾期子任务应产生两个明细预警');
assert.equal(new Set(alerts.map(x=>x.rec.id)).size,1,'统计可按父工作去重');

// 跨月创建、本月完成父工作与子任务均以各自实际完成日期统计。
rows.todos=[
  {id:21,name:'跨月完成父工作',state:'DONE',type:'key',completeDate:'2026-09-10',issueDate:'2026-08-20',subtasks:[]},
  {id:22,name:'长期推进',state:'DOING',type:'key',issueDate:'2026-08-01',subtasks:[{id:'s',name:'本月成果',completed:true,completed_date:'2026-09-12',sort_order:0,created_at:'2026-08-01',updated_at:'2026-09-12'}]},
  {id:23,name:'正常跨月',state:'DOING',type:'pending',issueDate:'2026-08-01',deadline:'2026-10-01',subtasks:[]},
  {id:24,name:'逾期工作',state:'DOING',type:'pending',issueDate:'2026-08-01',deadline:'2026-09-01',subtasks:[]}
];
// 直接以源码所用全局日期范围执行。
sandbox.summaryDateRange={start:'2026-09-01',end:'2026-09-30'};
const monthApi=api.v16MonthData();
assert.equal(monthApi.completed.length,1);
assert.equal(monthApi.subs.length,1);
assert.equal(monthApi.cross.length,2,'正常长期跨月不等于逾期');
assert.equal(monthApi.overdue.length,1);
assert(!monthApi.overdue.some(t=>t.name==='正常跨月'),'正常跨月事项不得混入逾期');
rows.funds=[{id:1,name:'示例项目',budget:10000}];
rows.fundRecords=[{fundId:1,date:'2026-09-15',amount:500}];
const copied=api.monthlySummaryText();
assert(copied.includes('跨月完成父工作')&&copied.includes('本月成果'),'月度摘要必须包含实际工作和子任务名称');
assert(copied.includes('示例项目')&&copied.includes('一、本月完成工作')&&copied.includes('六、项目经费'),'月度摘要必须使用结构化固定模板并包含实际项目名称');

// 旧首轮错误归属的长期目标在启动迁移后应与页面过滤口径一致。
rows.todos=[{id:31,name:'长期目标 A',is_goal:true,owner_ledger:'goals',state:'DOING'}];
api.ensureV16Data();
assert.equal(rows.todos[0].owner_ledger,'todos','长期目标迁移不得遗留不存在的 goals owner_ledger');

const expenseSource=section('function expenseStateTotals','function renderExpenses');
const expenseApi=vm.runInNewContext(`const STATE={TODO:'TODO',DOING:'DOING',DONE:'DONE',CLOSED:'CLOSED'};function recordState(_k,r){return r.state;}${expenseSource};expenseStateTotals`,{});
const totals=expenseApi([{amount:100,state:'TODO'},{amount:200,state:'DOING'},{amount:300,state:'DONE'},{amount:400,state:'CLOSED'}]);
assert.equal(totals.pendingAmount,300,'未开始/进行中才计入待报销金额');
assert.equal(totals.approvedAmount,300,'只有已完成计入已报销金额，已关闭不得混入');
assert.equal(totals.all.length,4,'已关闭记录仍属于报销台账总记录数');

rows.meetings=[{id:1,name:'例会',date:'2026-09-21',startTime:'09:00'}];
rows.trainings=[{id:2,name:'培训',startDate:'2026-09-21',endDate:'2026-09-22',organizer:'疾控'}];
const calendar=api.dashboardCalendarEntries('2026-09');
assert.equal(calendar.filter(x=>x.date==='2026-09-21').map(x=>x.kind).join(','),'会议,培训','驾驶舱月历须聚合当天会议和培训');
assert(calendar.some(x=>x.date==='2026-09-22'&&x.kind==='培训'),'跨日培训应在每个培训日期显示');

// snapshot 的 todos 数组必须原样保留子任务字段；表单保护不得再绑定遮罩关闭。
assert.equal(monthApi.subs[0].sub.completed_date,'2026-09-12','snapshot 序列化前不得遗漏子任务完成日期');
assert(!html.includes("if(e.target===this)closeModal(this.id)"),'遮罩点击不得关闭表单');
assert(html.includes("event.key!=='Escape'"),'ESC 必须进入统一未保存检查');
assert(html.includes('继续编辑')&&html.includes('放弃修改'),'未保存确认必须提供两种明确操作');
assert(html.includes('function requestModalClose(id)')&&html.includes('wireModalCloseEntrypoints()'),'× / 取消必须进入统一真实关闭入口');
assert(html.includes('v16TodoCategory')&&html.includes('todoLedgerTabs'),'待办必须从统一待办源提供所属板块分类');
assert(html.includes('deleteActiveItem')&&html.includes('todo-delete'),'每条待办必须保留删除入口');
assert(html.includes('开始 ${esc(r.issueDate||r.date||')&&html.includes('经办人 ${esc(r.assignee||'), '待办卡必须渲染开始日期、截止日期、经办人和优先级');
assert(!html.includes('meetingCalendarGrid')&&!html.includes('renderMeetingCalendar'),'会议页面不得保留月历 DOM 或专属渲染逻辑');
assert(html.includes('dashboardCalendarEntries')&&html.includes('v16DashboardCalendarGrid'),'驾驶舱月历必须直接汇总会议与培训数据');
console.log('v1.6 子任务、驾驶舱口径、本月摘要、同步字段与表单保护测试通过');
