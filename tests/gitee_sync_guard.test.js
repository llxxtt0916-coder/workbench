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
const source=section('const SYNC_BUSINESS_KEYS=','function exportData(){')+'\n'+
  section('const GITEE={','//  SETTINGS');
function response(status,data){
  return {status,ok:status>=200&&status<300,json:async()=>data,text:async()=>''};
}
function createServer(initial){
  let cloud=structuredClone(initial),sha='sha-a';
  const writes=[],reads=[];
  return {
    get data(){return cloud;},writes,reads,
    async fetch(url,opts={}){
      if(url.includes('/raw/')){
        reads.push(url);
        return cloud===null?response(404,{}):response(200,structuredClone(cloud));
      }
      if(!url.includes('/contents/'))return response(200,{default_branch:'main'});
      if(!opts.method){
        reads.push(url);
        return cloud===null?response(404,{}):response(200,{sha,content:btoa(unescape(encodeURIComponent(JSON.stringify(cloud))))});
      }
      const body=JSON.parse(opts.body);
      assert.equal(opts.method,cloud===null?'POST':'PUT');
      if(cloud!==null)assert.equal(body.sha,sha,'推送应使用当前云端 SHA');
      cloud=JSON.parse(decodeURIComponent(escape(atob(body.content))));
      writes.push({method:opts.method,body,data:structuredClone(cloud)});
      sha='sha-'+(writes.length+1);
      return response(200,{content:{sha}});
    }
  };
}
function createDevice(server,rows={},settings={}){
  const values=new Map(Object.entries({
    wb_gitee_user:'user',wb_gitee_repo:'repo',wb_gitee_token:'local-token',
    wb_backup_interval:'7',...settings
  }));
  for(const [key,value] of Object.entries(rows))values.set(key,JSON.stringify(value));
  const DB={
    get:key=>JSON.parse(values.get(key)||'[]').filter(r=>!r.deleted),
    set:(key,value)=>values.set(key,JSON.stringify(value))
  };
  let scheduledPushes=0;
  const sandbox={
    localStorage:{getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)},
    DB,document:{getElementById:id=>id==='globalSearch'?{value:''}:{className:'',textContent:''}},
    fetch:(...args)=>server.fetch(...args),refreshDataBadges:()=>{},renderCurrentPage:()=>{},
    renderGlobalSearch:()=>{},queueMicrotask:fn=>fn(),setTimeout:()=>{scheduledPushes++;return 1;},clearTimeout:()=>{},
    btoa,atob,escape,unescape,encodeURIComponent,decodeURIComponent,
    toast:()=>{},console:{log(){},error(){}},Date
  };
  const api=vm.runInNewContext(source+'\n({GITEE,SYNC_BUSINESS_KEYS,dumpData})',sandbox);
  return {gitee:api.GITEE,keys:Array.from(api.SYNC_BUSINESS_KEYS),values,DB,
    get scheduledPushes(){return scheduledPushes;}};
}
function names(rows){return rows.map(r=>r.name);}

(async()=>{
  const old=[{id:1,name:'A'},{id:2,name:'B'},{id:3,name:'C'}];
  const server=createServer({todos:old,trainings:[{id:10,name:'旧培训'}],otherMetadata:{kept:true}});
  const pc=createDevice(server,{todos:[{id:4,name:'D'}],trainings:[]});
  assert.equal(await pc.gitee.push(),'ok');
  assert.deepEqual(names(server.data.todos),['D'],'测试1：云端 A/B/C 应被本地 D 替换');
  assert.deepEqual(server.data.trainings,[],'测试2：本地空数组应清空云端旧培训');
  assert.deepEqual(server.data.inspirations,[],'缺失的标准业务键也应上传空数组');
  assert.deepEqual(server.data.quick_notes,[],'速记箱属于业务快照');
  assert.equal(server.data.otherMetadata.kept,true,'非业务元数据应保留');
  assert(!JSON.stringify(server.data).includes('local-token'),'Token 不得进入云端文件');
  assert.equal(pc.values.get('wb_gitee_token'),'local-token');

  const phone=createDevice(server,{todos:old,trainings:[{id:10,name:'旧培训'}],quick_notes:[{id:20,name:'旧速记'}]},
    {wb_gitee_token:'phone-token',wb_backup_interval:'30',wb_gitee_branch:'master'});
  assert.equal(await phone.gitee.pull(),'ok');
  assert(server.reads.at(-1).includes('ref=main'),'旧设备缓存分支不能抢在默认分支前拉取');
  assert.deepEqual(names(phone.DB.get('todos')),['D'],'测试4：拉取应覆盖手机 A/B/C');
  assert.deepEqual(phone.DB.get('trainings'),[]);
  assert.deepEqual(phone.DB.get('quick_notes'),[]);
  assert.equal(phone.values.get('wb_gitee_token'),'phone-token','测试5：手机凭据保留');
  assert.equal(phone.values.get('wb_backup_interval'),'30','测试5：设备偏好保留');
  assert.equal(phone.scheduledPushes,0,'拉取不得触发自动反向推送');
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
  assert.equal(invalid.gitee._mergeData({todos:'wrong'}),false,'损坏的云端数组不能清空本地');
  assert.deepEqual(names(invalid.DB.get('todos')),['本地']);
  process.stdout.write('Gitee 快照推送、空数组、删除传播、拉取覆盖、配置隔离测试通过\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
