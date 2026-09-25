const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`找不到代码段 ${start}`);
  return html.slice(a,b);
}
const source=section('// A matter groups existing business records','// Configuration is one snapshot object')+'\n'+
  section('// Configuration is one snapshot object','//  DATA LAYER v1.5')+'\n'+
  section('const SYNC_BUSINESS_KEYS=','function exportData(){')+'\n'+
  section('const GITEE={','//  SETTINGS')+'\n'+
  section('function repairData(){','//  NAVIGATION')+'\n'+
  section('function snapshotBeforeV14(){','// 从快照恢复 localStorage')+'\n'+
  section('function isLegacyLedgerMirror(rec){','function belongsToLedger(')+'\n'+
  section('async function manualPush(){','// deploy current HTML');
function response(status,data){
  return {status,ok:status>=200&&status<300,json:async()=>data,text:async()=>''};
}
function createServer(initial,options={}){
  let cloud=structuredClone(initial),sha='sha-a';
  const writes=[],reads=[];
  return {
    get data(){return cloud;},writes,reads,
    async fetch(url,opts={}){
      if(url.includes('/raw/')){
        reads.push(url);
        return cloud===null?response(404,{}):response(200,structuredClone(cloud));
      }
      if(!url.includes('/contents/'))return response(200,{default_branch:options.branch||'main'});
      if(!opts.method){
        reads.push(url);
        return cloud===null?response(404,{}):response(200,{sha,content:btoa(unescape(encodeURIComponent(JSON.stringify(cloud))))});
      }
      const body=JSON.parse(opts.body);
      assert.equal(opts.method,cloud===null?'POST':'PUT');
      if(cloud!==null)assert.equal(body.sha,sha,'推送应使用当前云端 SHA');
      if(options.conflict)return response(409,{});
      const submitted=JSON.parse(decodeURIComponent(escape(atob(body.content))));
      cloud=options.readback?structuredClone(options.readback):submitted;
      writes.push({method:opts.method,body,data:structuredClone(cloud),submitted});
      sha='sha-'+(writes.length+1);
      return response(200,{content:{sha}});
    }
  };
}
function createDevice(server,rows={},settings={},confirmResponse=true){
  const values=new Map(Object.entries({
    wb_gitee_user:'user',wb_gitee_repo:'repo',wb_gitee_token:'local-token',
    wb_backup_interval:'7',...settings
  }));
  for(const [key,value] of Object.entries(rows))values.set(key,JSON.stringify(value));
  const DB={
    get:key=>JSON.parse(values.get(key)||'[]').filter(r=>!r.deleted),
    raw:key=>JSON.parse(values.get(key)||'[]'),
    set:(key,value)=>values.set(key,JSON.stringify(value))
  };
  let scheduledPushes=0,renders=0;
  const logs=[],toasts=[],prompts=[];
  const localStorage={
    get length(){return values.size;},key:i=>Array.from(values.keys())[i],
    getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v))
  };
  const sandbox={
    localStorage,
    DB,document:{getElementById:id=>id==='globalSearch'?{value:''}:{className:'',textContent:''}},
    fetch:(...args)=>server.fetch(...args),refreshDataBadges:()=>{},renderCurrentPage:()=>{renders++;},
    renderGlobalSearch:()=>{},queueMicrotask:fn=>fn(),setTimeout:()=>{scheduledPushes++;return 1;},clearTimeout:()=>{},
    LEDGER_KEYS:['todos'],STATE:{CLOSED:'CLOSED',DONE:'DONE'},
    recordState:()=> 'DONE',getDueDate:()=>'',finishWorkRecord:()=>{},
    normPriority:x=>x||'',normalizeDate:x=>x?String(x).slice(0,10):'',
    _syncTimer:null,
    btoa,atob,escape,unescape,encodeURIComponent,decodeURIComponent,
    toast:message=>toasts.push(message),console:{log:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},Date
  };
  sandbox.confirm=message=>{prompts.push(message);return confirmResponse;};
  const api=vm.runInNewContext(source+'\n({GITEE,SYNC_BUSINESS_KEYS,dumpData,manualPush,manualPull,restart(){snapshotBeforeV14();GITEE._applyingSnapshot=true;try{repairData();retireVerifiedLegacyMirrors();}finally{GITEE._applyingSnapshot=false;}renderCurrentPage();}})',sandbox);
  return {gitee:api.GITEE,keys:Array.from(api.SYNC_BUSINESS_KEYS),values,DB,logs,toasts,prompts,
    dumpData:api.dumpData,manualPush:api.manualPush,manualPull:api.manualPull,restart:api.restart,
    get scheduledPushes(){return scheduledPushes;},get renders(){return renders;}};
}
function names(rows){return rows.map(r=>r.name);}

(async()=>{
  const old=[{id:1,name:'A'},{id:2,name:'B'},{id:3,name:'C'}];
  const server=createServer({todos:old,trainings:[{id:10,name:'旧培训'}],otherMetadata:{kept:true}});
  const syncedSubtask={id:'sub-1',name:'同步子任务',start_date:'2026-09-01',due_date:'2026-09-10',completed_date:'2026-09-09',completed:true,sort_order:0,created_at:'2026-09-01',updated_at:'2026-09-09'};
  const syncedMatter={id:'matter_sync',name:'同步事项',created_at:'2026-09-01T00:00:00.000Z',remark:''};
  const linkedPurchase={id:12,name:'关联采购',supplier:'关联单位',supplier_org_id:'org_linked',matter_id:syncedMatter.id,related_sources:[{type:'work',id:4}]};
  const pc=createDevice(server,{todos:[{id:4,name:'D',subtasks:[syncedSubtask],matter_id:syncedMatter.id}],purchases:[linkedPurchase],matters:[syncedMatter],trainings:[]});
  const linkedConfig={organizations:[{id:'org_linked',name:'关联单位',type:'external',status:'active',sort_order:10,remark:'',short_name:'单位'}],
    dictionaries:{work_categories:[],work_sources:[{id:'ws_linked',name:'单位来源',organization_id:'org_linked',status:'active',sort_order:10,remark:''}]}};
  pc.values.set('wb_config',JSON.stringify(linkedConfig));
  assert.equal(await pc.gitee.push(),'ok');
  const actualPut=server.writes[0];
  const decodedPut=JSON.parse(decodeURIComponent(escape(atob(actualPut.body.content))));
  assert.deepEqual(names(decodedPut.todos),['D'],'链路 Case 1：实际 PUT content 必须只有 D');
  assert.deepEqual(decodedPut.todos[0].subtasks,[syncedSubtask],'v1.6：实际 Gitee snapshot 必须完整保留子任务 ID、排序、状态和日期');
  assert.deepEqual(decodedPut.matters,[syncedMatter],'事项容器必须进入完整快照');
  assert.equal(decodedPut.todos[0].matter_id,syncedMatter.id,'事项关系必须保留在原业务记录');
  assert.deepEqual(decodedPut.purchases[0],linkedPurchase,'直接来源与组织稳定 ID 必须进入完整快照');
  assert.deepEqual(decodedPut.config,JSON.parse(JSON.stringify(pc.dumpData().config)),'配置必须进入完整快照');
  assert.equal(decodedPut.config.dictionaries.work_sources,undefined,'旧来源字典不得继续写入云端快照');
  assert.equal(decodedPut.config.organizations[0].id,'org_linked','组织稳定 ID 必须进入快照');
  pc.keys.forEach(key=>assert.deepEqual(decodedPut[key],JSON.parse(JSON.stringify(pc.dumpData()[key])),
    `链路 Case 1：实际 PUT ${key} 必须等于当前本机快照`));
  assert.equal(actualPut.body.branch,'main');
  assert.equal(server.reads.filter(url=>url.includes('/contents/')).length,2,'上传前读 SHA，上传后回读同一文件');
  assert(server.reads.filter(url=>url.includes('/contents/')).every(url=>url.includes('ref=main')));
  assert(pc.logs.some(entry=>entry[0]==='LOCAL SNAPSHOT'));
  assert(pc.logs.some(entry=>entry[0]==='REMOTE AFTER PUSH'));
  assert.deepEqual(names(server.data.todos),['D'],'测试1：云端 A/B/C 应被本地 D 替换');
  assert.deepEqual(server.data.trainings,[],'测试2：本地空数组应清空云端旧培训');
  assert.deepEqual(server.data.inspirations,[],'缺失的标准业务键也应上传空数组');
  assert.deepEqual(server.data.quick_notes,[],'速记箱属于业务快照');
  assert.equal(server.data.otherMetadata.kept,true,'非业务元数据应保留');
  assert(!JSON.stringify(server.data).includes('local-token'),'Token 不得进入云端文件');
  assert.equal(pc.values.get('wb_gitee_token'),'local-token');

  const staleReadback=createServer({todos:old},{readback:{todos:[...old,{id:4,name:'D'}]}});
  const staleDevice=createDevice(staleReadback,{todos:[{id:4,name:'D'}]});
  await staleDevice.manualPush();
  assert.equal(staleReadback.writes.length,1,'链路 Case 2：确实执行过 PUT');
  assert(staleDevice.toasts.some(message=>message.includes('推送未验证')),'回读仍有旧数据时界面必须报错');
  assert(!staleDevice.toasts.some(message=>message.includes('回读验证：云端业务数据与本机一致')));
  assert(staleDevice.logs.some(entry=>entry[0]==='Gitee push verification failed'&&entry[1].mismatchedKeys.includes('todos')),
    '诊断应指出回读不一致的业务数组');
  assert.deepEqual(names(staleDevice.DB.get('todos')),['D'],'验证失败不得改动本机');
  const conflictServer=createServer({todos:old},{conflict:true});
  const conflictDevice=createDevice(conflictServer,{todos:[{id:4,name:'D'}]});
  assert.equal(await conflictDevice.gitee.push(),'conflict','SHA 冲突应明确失败');
  assert.deepEqual(names(conflictDevice.DB.get('todos')),['D'],'SHA 冲突不得自动拉取旧数据');
  assert.equal(conflictServer.reads.filter(url=>url.includes('/contents/')).length,1);

  const phone=createDevice(server,{todos:old,trainings:[{id:10,name:'旧培训'}],quick_notes:[{id:20,name:'旧速记'}]},
    {wb_gitee_token:'phone-token',wb_backup_interval:'30',wb_gitee_branch:'master',
      wb_v14_snapshot:'1',wb_v14_restore:JSON.stringify({todos:JSON.stringify(old)})});
  assert.equal(await phone.gitee.pull(),'ok');
  assert(server.reads.at(-1).includes('ref=main'),'旧设备缓存分支不能抢在默认分支前拉取');
  assert.deepEqual(names(phone.DB.get('todos')),['D'],'测试4：拉取应覆盖手机 A/B/C');
  assert(phone.logs.some(entry=>entry[0]==='REMOTE BEFORE PULL'));
  assert(phone.logs.some(entry=>entry[0]==='LOCAL AFTER PULL'));
  assert.deepEqual(phone.DB.get('trainings'),[]);
  assert.deepEqual(phone.DB.get('quick_notes'),[]);
  assert.deepEqual(phone.DB.get('matters'),[syncedMatter]);
  assert.deepEqual(phone.DB.get('purchases')[0].related_sources,linkedPurchase.related_sources,'拉取后直接来源必须保持一致');
  assert.equal(phone.DB.get('purchases')[0].matter_id,syncedMatter.id,'拉取后事项 ID 必须保持一致');
  assert.equal(phone.DB.get('purchases')[0].supplier_org_id,'org_linked','拉取后组织 ID 必须保持一致');
  assert.deepEqual(JSON.parse(phone.values.get('wb_config')),server.data.config,'拉取必须恢复配置');
  assert.equal(phone.values.get('wb_gitee_token'),'phone-token','测试5：手机凭据保留');
  assert.equal(phone.values.get('wb_backup_interval'),'30','测试5：设备偏好保留');
  assert.equal(phone.scheduledPushes,0,'拉取不得触发自动反向推送');
  const completeDevice=createDevice(server,{todos:[{id:99,name:'本机旧工作',matter_id:'matter_local'}],
    matters:[{id:'matter_local',name:'本机事项'}]}, {wb_config:JSON.stringify(linkedConfig)});
  assert.equal(await completeDevice.gitee.pull(),'ok','完整新版本快照应直接覆盖本机旧配置和事项');
  assert.equal(completeDevice.prompts.length,0,'完整新版本快照不应额外确认');
  phone.restart();
  assert.deepEqual(names(phone.DB.get('todos')),['D'],'链路 Case 4：重新执行真实修复/镜像清理及渲染后仍只有 D');
  assert(phone.renders>=2);
  assert.equal(phone.scheduledPushes,0,'重新初始化也不得自动推送');
  assert(!JSON.stringify(phone.logs).includes('phone-token'),'诊断日志不能包含 Token');
  const masterServer=createServer({todos:[{id:4,name:'D'}]},{branch:'master'});
  const oldBranchDevice=createDevice(masterServer,{todos:old},{wb_gitee_branch:'main'});
  assert.equal(await oldBranchDevice.gitee.pull(),'ok');
  assert(masterServer.reads.at(-1).includes('ref=master'),'缓存中的 main 不得优先于仓库默认 master');
  assert.deepEqual(names(oldBranchDevice.DB.get('todos')),['D']);
  const staleConfig={organizations:[{id:'org_stale',name:'本机旧配置',type:'external',status:'active',sort_order:10}],dictionaries:{work_categories:[],work_sources:[]}};
  const legacyCloudDevice=createDevice(masterServer,{todos:old},{wb_config:JSON.stringify(staleConfig)});
  assert.equal(await legacyCloudDevice.gitee.pull(),'ok','旧云端无 config 时应安全拉取');
  assert(legacyCloudDevice.prompts[0].includes('配置中心'),'旧快照覆盖本机配置前必须明确警告');
  assert.deepEqual(JSON.parse(legacyCloudDevice.values.get('wb_config')).organizations,[],'旧云端无 config 不应保留本机陈旧配置');
  assert(JSON.parse(legacyCloudDevice.values.get('wb_config')).dictionaries.work_categories.length>0,'旧云端无 config 时默认工作类别不能消失');
  assert.deepEqual(legacyCloudDevice.DB.raw('matters'),[],'旧云端无 matters 时安全初始化为空');
  const localMatter={id:'matter_local',name:'本机事项'};
  const cancelDevice=createDevice(masterServer,{todos:[{id:31,name:'本机工作',matter_id:localMatter.id}],matters:[localMatter]},
    {wb_config:JSON.stringify(staleConfig)},false);
  const beforeCancel={todo:cancelDevice.DB.raw('todos'),matters:cancelDevice.DB.raw('matters'),config:cancelDevice.values.get('wb_config')};
  assert.equal(await cancelDevice.manualPull(),undefined);
  assert(cancelDevice.prompts[0].includes('配置中心')&&cancelDevice.prompts[0].includes('事项关联'),'旧快照应同时告知缺失的数据类型');
  assert.deepEqual(cancelDevice.DB.raw('todos'),beforeCancel.todo,'取消不得覆盖工作');
  assert.deepEqual(cancelDevice.DB.raw('matters'),beforeCancel.matters,'取消不得覆盖事项');
  assert.equal(cancelDevice.values.get('wb_config'),beforeCancel.config,'取消不得覆盖配置');
  assert(cancelDevice.toasts.some(message=>message.includes('已取消拉取')),'取消应提示本机未修改');
  assert.equal(phone.prompts.length,0,'完整新版本云端快照不应额外确认');
  assert.equal(await oldBranchDevice.gitee.push(),'ok');
  assert.equal(masterServer.writes[0].body.branch,'master','同一设备推送也应写入 master');
  assert(masterServer.reads.at(-1).includes('ref=master'),'推送回读也应使用 master');
  const legacySourceServer=createServer({
    todos:[{id:8,name:'旧工作',category:['报告'],source:['市疾控局','领导交办'],work_source_ids:['ws_old','']}],
    config:{organizations:[{id:'org_old',name:'重庆市疾病预防控制局',short_name:'市疾控局',type:'external',status:'active',sort_order:10}],
      dictionaries:{work_categories:[],work_sources:[{id:'ws_old',name:'市疾控局',organization_id:'org_old'}]}}
  });
  const legacySourceDevice=createDevice(legacySourceServer);
  assert.equal(await legacySourceDevice.gitee.pull(),'ok','带旧来源字典的 Gitee 快照可拉取');
  assert.equal(JSON.parse(legacySourceDevice.values.get('wb_config')).dictionaries.work_sources,undefined);
  assert.deepEqual(legacySourceDevice.DB.raw('todos')[0].source,['市疾控局','领导交办']);
  assert.deepEqual(legacySourceDevice.DB.raw('todos')[0].source_org_ids,['org_old','']);
  const readOnlyPhone=createDevice(server,{todos:old},{wb_gitee_token:'',wb_gitee_branch:'master'});
  assert.equal(await readOnlyPhone.gitee.pull(),'ok','无令牌设备应可从公开仓库拉取');
  assert.deepEqual(names(readOnlyPhone.DB.get('todos')),['D']);
  assert(server.reads.at(-1).includes('/raw/main/'),'无令牌设备也应优先读默认分支');

  const deleteServer=createServer({todos:[{id:1,name:'A'}]});
  const desktop=createDevice(deleteServer,{todos:[]});
  assert.equal(await desktop.gitee.push(),'ok');
  const another=createDevice(deleteServer,{todos:[{id:1,name:'A'}]});
  assert.equal(await another.gitee.pull(),'ok');
  assert.deepEqual(another.DB.get('todos'),[],'测试3：删除应传播到另一设备');

  const softDeleteServer=createServer({todos:[{id:1,name:'A'}]});
  const softDeleteDevice=createDevice(softDeleteServer,{todos:[{id:1,name:'A',deleted:true}]});
  assert.equal(await softDeleteDevice.gitee.push(),'ok');
  assert.deepEqual(softDeleteServer.data.todos,[],'软删除也应在业务快照中表达为不存在');

  const freshServer=createServer(null);
  assert.equal(await createDevice(freshServer).gitee.push(),'ok','首次推送应创建文件');
  const failedServer={fetch:async(url,opts={})=>url.includes('/contents/')?response(500,{}):response(200,{default_branch:'main'})};
  assert.equal(await createDevice(failedServer).gitee.push(),false,'云端读取失败时不得写入');
  const invalid=createDevice(createServer(null),{todos:[{id:7,name:'本地'}]});
  assert.equal(invalid.gitee._applySnapshot({todos:'wrong'}),false,'损坏的云端数组不能清空本地');
  assert.deepEqual(names(invalid.DB.get('todos')),['本地']);
  process.stdout.write('Gitee 实际 push/pull 路径、PUT 内容、远端回读、冲突、存储覆盖及重启迁移测试通过\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
