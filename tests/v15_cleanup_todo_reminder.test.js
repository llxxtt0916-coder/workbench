const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert(match,'找不到页面脚本');
const code=match[1];
const BUSINESS_KEYS=['todos','inspirations','contracts','purchases','expenses','meetings',
  'trainings','agencys','handovers','funds','fundRecords','quick_notes'];
const bundledData=JSON.parse(fs.readFileSync('data.json','utf8'));
BUSINESS_KEYS.forEach(key=>assert.deepEqual(bundledData[key],[],`data.json 中 ${key} 必须为空`));

function createRuntime(store){
  const nodes=new Map();
  function elFor(id){
    if(nodes.has(id))return nodes.get(id);
    const el={
      id,value:'',textContent:'',disabled:false,innerHTML:'',style:{display:'none'},dataset:{},options:[],
      className:'',classList:{add(){},remove(){},toggle(){},contains(){return false}},
      addEventListener(){},removeEventListener(){},appendChild(){},setAttribute(){},getAttribute(){return null},
      focus(){},click(){},querySelector(){return elFor(id+'-child')},querySelectorAll(){return []}
    };
    nodes.set(id,el);return el;
  }
  const localStorage={
    get length(){return store.size;},key:i=>Array.from(store.keys())[i]??null,
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)
  };
  const document={
    hidden:false,body:elFor('body'),getElementById:elFor,querySelector:()=>elFor('query'),querySelectorAll:()=>[],
    createElement:()=>elFor('created'),addEventListener(){},removeEventListener(){}
  };
  const sandbox={
    console:{log(){},warn(){},error(){}},localStorage,document,
    window:{addEventListener(){}},navigator:{userAgent:'node'},
    confirm:()=>true,alert:()=>{},fetch:async()=>({ok:false,status:404}),
    setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},queueMicrotask:fn=>fn(),
    Blob:class{},URL:{createObjectURL:()=>'',revokeObjectURL(){}},Date
  };
  vm.createContext(sandbox);
  vm.runInContext(code,sandbox,{filename:'index_inline.js'});
  return {sandbox,nodes,run:source=>vm.runInContext(source,sandbox)};
}

const store=new Map([
  ['wb_gitee_user','LingXngTian'],['wb_gitee_repo','workbench'],['wb_gitee_token','secret-kept'],
  ['wb_gitee_branch','master'],['wb_gitee_data_revision','{"sha":"old"}'],
  ['wb_backup_interval','30'],['wb_last_backup','2026-09-14T00:00:00.000Z'],
  ['wb_opts_todoCategory','["保留选项"]'],['wb_v14_snapshot','1'],
  ['wb_v14_restore','{"todos":"[{\\"id\\":99}]"}'],
  ['wb_v15_todos_before_mirror_cleanup','[{"id":98}]']
]);
BUSINESS_KEYS.forEach((key,index)=>store.set(key,JSON.stringify([{id:index+1,name:'旧测试 '+key}])));

let runtime=createRuntime(store);
BUSINESS_KEYS.forEach(key=>assert.deepEqual(JSON.parse(store.get(key)),[],`一次性清理 ${key}`));
assert.equal(store.get('wb_gitee_user'),'LingXngTian');
assert.equal(store.get('wb_gitee_repo'),'workbench');
assert.equal(store.get('wb_gitee_token'),'secret-kept');
assert.equal(store.get('wb_gitee_branch'),'master');
assert.equal(store.get('wb_backup_interval'),'30');
assert.equal(store.get('wb_last_backup'),'2026-09-14T00:00:00.000Z');
assert.equal(store.get('wb_opts_todoCategory'),'["保留选项"]');
assert.equal(store.get('wb_v15_test_data_cleared_20260915'),'1');
assert.equal(store.has('wb_v15_todos_before_mirror_cleanup'),false,'旧工作副本快照已清除');
const cleanRestore=JSON.parse(store.get('wb_v14_restore'));
BUSINESS_KEYS.forEach(key=>assert.deepEqual(JSON.parse(cleanRestore[key]),[],`新回退快照中的 ${key} 也为空`));

runtime.run(`
const todayForTest=todayStr();
localStorage.setItem('todos',JSON.stringify([
  {id:101,name:'可见工作',state:STATE.TODO,state_manual:true,is_goal:false,deadline:todayForTest,due_date:todayForTest,createdAt:'2026-09-15',recurrence:'none',category:[],source:[]},
  {id:102,name:'长期目标',state:STATE.DOING,state_manual:true,is_goal:true,deadline:'',createdAt:'2026-09-15',recurrence:'none',category:[],source:[]},
  {id:103,name:'已完成工作',state:STATE.DONE,state_manual:true,is_goal:false,deadline:todayForTest,createdAt:'2026-09-15',recurrence:'none',category:[],source:[]}
]));
localStorage.setItem('contracts',JSON.stringify([
  {id:201,name:'可见合同',state:STATE.DOING,state_manual:true,expiry:todayForTest,due_date:todayForTest,createdAt:'2026-09-15',recurrence:'none'}
]));
localStorage.setItem('meetings',JSON.stringify([
  {id:301,name:'可见会议',state:STATE.TODO,state_manual:true,due_date:todayForTest,createdAt:'2026-09-15',recurrence:'none'}
]));
renderTodos();
renderRemindCenter();
`);
const todoHtml=runtime.nodes.get('todoActiveList').innerHTML;
const visibleCount=(todoHtml.match(/class="todo-card"/g)||[]).length;
const groupSum=[...todoHtml.matchAll(/todo-group-title">[^（]+（(\d+)）/g)].reduce((sum,item)=>sum+Number(item[1]),0);
assert.equal(runtime.run('getVisibleTodoItems().length'),3);
assert.equal(runtime.nodes.get('todoActiveCount').textContent,3,'左侧待办角标');
assert.equal(runtime.nodes.get('todoActiveSummary').textContent,'共 3 项进行中','待办页总数');
assert.equal(groupSum,3,'各分组数量之和');
assert.equal(visibleCount,3,'实际可见卡片数');
assert(!todoHtml.includes('长期目标'),'长期目标不能成为待办幽灵记录');

assert.equal(runtime.run('getDueReminderItems().length'),3,'三个动态到期提醒');
assert.equal(runtime.nodes.get('remindCount').textContent,3);
assert.equal((runtime.nodes.get('remindList').innerHTML.match(/忽略提醒/g)||[]).length,3);
assert.equal((runtime.nodes.get('remindList').innerHTML.match(/查看原记录/g)||[]).length,3,'查看原记录入口保留');
const originalCounts=BUSINESS_KEYS.map(key=>JSON.parse(store.get(key)).length);
runtime.run(`ignoreReminder(reminderKey(getDueReminderItems()[0],getDueReminderItems()[0]._due));`);
assert.equal(runtime.run('getDueReminderItems().length'),2,'忽略后立即移除一个提醒');
assert.equal(runtime.nodes.get('remindCount').textContent,2,'提醒角标立即更新');
assert.deepEqual(BUSINESS_KEYS.map(key=>JSON.parse(store.get(key)).length),originalCounts,'忽略提醒不得删除原业务记录');
assert.equal(JSON.parse(store.get('wb_ignored_reminders_v1')).length,1,'忽略标识已持久化');

runtime=createRuntime(store);
assert.equal(runtime.run('getVisibleTodoItems().length'),3,'再次启动不得清理新记录');
assert.equal(runtime.nodes.get('todoActiveCount').textContent,3,'重新启动后左侧待办角标立即正确');
assert.equal(runtime.run('getDueReminderItems().length'),2,'刷新后被忽略提醒不得重新出现');
runtime.run(`const todo=DB.raw('todos').find(r=>r.id===101);todo.deadline='2099-01-01';todo.due_date='2099-01-01';DB.set('todos',DB.raw('todos'));`);
assert.equal(runtime.run("isReminderIgnored(Object.assign({_ledger:'todos'},DB.get('todos').find(r=>r.id===101)),'2099-01-01')"),false,
  '截止日期实质变化后形成新的提醒标识');

console.log('v1.5 一次性清理、待办统一统计、提醒忽略持久化测试通过');
