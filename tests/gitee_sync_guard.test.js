const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('const GITEE={');
const end=html.indexOf('//  AUTO SYNC ON SAVE',start);
assert(start>=0&&end>start,'找不到实际同步实现');
const source=html.slice(start,end);
const dumpStart=html.indexOf('function dumpData(){');
const dumpEnd=html.indexOf('function exportData(){',dumpStart);
assert(dumpStart>=0&&dumpEnd>dumpStart,'找不到实际上传数据构造函数');
const actualDumpData=vm.runInNewContext(html.slice(dumpStart,dumpEnd)+'\ndumpData',{
  DB:{get:()=>[]},Date
});
assert.equal(Object.keys(actualDumpData()).join(','),
  'todos,inspirations,contracts,purchases,expenses,meetings,trainings,agencys,handovers,funds,fundRecords,exportedAt');

function response(status,data){
  return {status,ok:status>=200&&status<300,json:async()=>data,text:async()=>''};
}
function createDevice(fetchImpl){
  const values=new Map([['wb_gitee_user','user'],['wb_gitee_repo','repo'],['wb_gitee_token','local-token']]);
  const messages=[];
  const sandbox={
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
    document:{getElementById:()=>({className:'',textContent:''})},
    fetch:fetchImpl,
    dumpData:actualDumpData,
    btoa,atob,escape,unescape,encodeURIComponent,decodeURIComponent,
    toast:message=>messages.push(message),
    console:{log(){},error(){}},Date
  };
  const gitee=vm.runInNewContext(source+'\nGITEE',sandbox);
  gitee._mergeData=()=> 'ok';
  return {gitee,values,messages};
}

(async()=>{
  let cloudSha='sha-a';
  let writes=[];
  const fetchImpl=async(url,opts={})=>{
    if(!url.includes('/contents/'))return response(200,{default_branch:'main'});
    if(!opts.method){
      if(url.includes('_t=')&&url.includes('ref=main')&&url.includes('access_token=')){
        return response(200,{sha:cloudSha,content:btoa('{"todos":[]}')});
      }
      return response(200,{sha:cloudSha});
    }
    writes.push({method:opts.method,body:JSON.parse(opts.body)});
    cloudSha='sha-b';
    return response(200,{content:{sha:cloudSha}});
  };
  const device=createDevice(fetchImpl);
  assert.equal(await device.gitee.pull(),'ok');
  assert.equal(device.gitee._knownSha(device.gitee.getConfig(),'main'),'sha-a');
  assert.equal(await device.gitee.push(),'ok');
  assert.equal(writes.length,1);
  assert.equal(writes[0].method,'PUT');
  assert.equal(writes[0].body.sha,'sha-a');
  assert.equal(device.gitee._knownSha(device.gitee.getConfig(),'main'),'sha-b');
  assert(!atob(writes[0].body.content).includes('local-token'),'Token 不得进入 data.json');

  cloudSha='sha-c';
  assert.equal(await device.gitee.push(),'conflict');
  assert.equal(writes.length,1,'云端变更后不得再次上传');
  assert(device.messages.some(x=>x.includes('请先拉取最新数据')));

  const fresh=createDevice(fetchImpl);
  assert.equal(await fresh.gitee.push(),'conflict','未拉取的设备不得覆盖已有云端文件');
  assert.equal(writes.length,1);

  const empty=createDevice(async(url,opts={})=>{
    if(!url.includes('/contents/'))return response(200,{default_branch:'main'});
    if(!opts.method)return response(404,{});
    assert.equal(opts.method,'POST');
    return response(201,{content:{sha:'sha-new'}});
  });
  assert.equal(await empty.gitee.push(),'ok');
  assert.equal(empty.gitee._knownSha(empty.gitee.getConfig(),'main'),'sha-new');

  let attemptedWrite=false;
  const failed=createDevice(async(url,opts={})=>{
    if(!url.includes('/contents/'))return response(200,{default_branch:'main'});
    if(opts.method)attemptedWrite=true;
    return response(500,{});
  });
  assert.equal(await failed.gitee.push(),false);
  assert.equal(attemptedWrite,false,'云端状态读取失败时不得上传');
  process.stdout.write('Gitee SHA 防覆盖测试通过（正常、冲突、首次创建、读取失败、Token 排除）\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
