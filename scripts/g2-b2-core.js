/* G2-B2: derived work selectors and explicit todos actions. No startup writes/network. */
(function(root,factory){const api=factory(typeof module==='object'?require('./g2-b1-core.js'):root.G2B1);if(typeof module==='object')module.exports=api;else root.G2B2=api;})(globalThis,function(B){
 'use strict';
 const clone=x=>structuredClone(x),same=B.sameId,states=['未开始','进行中','已完成','已关闭'];
 const local=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const today=()=>local(new Date());
 function date(v){if(typeof v!=='string')return '';if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const d=new Date(v+'T00:00:00');return Number.isFinite(+d)&&local(d)===v?v:'';}return B.eventDate('todos',{state:'已完成',state_manual:true,completeDate:v})||'';}
 const addDays=(v,n)=>{const d=new Date(v+'T00:00:00');d.setDate(d.getDate()+n);return local(d);};
 const dayDiff=(a,b)=>Math.round((+new Date(a+'T00:00:00')-+new Date(b+'T00:00:00'))/86400000);
 const state=(r,key='todos')=>B.readState(key,r);
 const ended=(r,key='todos')=>['已完成','已关闭'].includes(state(r,key));
 const ownWork=r=>!r.deleted&&!r.is_goal&&(!r.owner_ledger||r.owner_ledger==='todos')&&!/^(contracts|purchases|expenses|meetings|trainings|agencys):/.test(r.origin||'');
 const works=rows=>rows.filter(ownWork);
 const activeWork=rows=>works(rows).filter(r=>r.type!=='record'&&['未开始','进行中'].includes(state(r)));
 const history=rows=>works(rows).filter(r=>ended(r));
 const goals=rows=>rows.filter(r=>!r.deleted&&r.is_goal===true);
 const due=r=>date(r.deadline||r.due_date);
 const completion=(r,key='todos')=>state(r,key)==='已完成'?B.eventDate(key,r)||'':'';
 const historyDate=r=>B.eventDate('todos',r)||'—';
 const subRows=r=>(r.subtasks||[]).map((s,i)=>({...clone(s),id:s.id??'legacy-'+i,name:s.name??s.text??'',done:!!(s.completed??s.done),start:date(s.start_date),due:date(s.due_date),completed:date(s.completed_date),_index:i}));
 function weekRange(day){const start=addDays(day,-((new Date(day+'T00:00:00').getDay()+6)%7));return {start,end:addDays(start,6)};}
 function weeklyCompleted(rows,day=today()){const {start,end}=weekRange(day);const selected=works(rows).filter(r=>{const d=completion(r);return d>=start&&d<=end&&r.reopened!==true&&!(date(r.reopened_at)&&date(r.reopened_at)>d);});return {count:selected.length,rows:selected,start,end};}
 function weeklyFocus(rows,day=today()){return activeWork(rows).filter(r=>r.type==='key').map((r,i)=>({r,i,d:due(r)})).sort((a,b)=>{const group=x=>x.d?(x.d<day?0:1):2;return group(a)-group(b)||(a.d&&b.d?a.d.localeCompare(b.d):0)||a.i-b.i;}).slice(0,5).map(x=>x.r);}
 function workStats(rows,day=today()){const active=activeWork(rows);return {active:active.length,doing:active.filter(r=>state(r)==='进行中').length,today:active.filter(r=>due(r)===day).length,near:active.filter(r=>due(r)>=day&&due(r)<=addDays(day,3)).length,overdue:active.filter(r=>due(r)&&due(r)<day).length};}
 const linked=(rows,id)=>rows.filter(r=>!r.deleted&&r.parent_goal==='todos:'+String(id));
 function goalProgress(rows,id){const list=linked(rows,id),groups=new Map();for(const r of list){const key=r.recurrence_group_id||'id:'+(r._ledger||'todos')+':'+String(r.id);if(!groups.has(key))groups.set(key,r);}const total=groups.size,done=[...groups.values()].filter(r=>ended(r,r._ledger||'todos')).length;return {progress:total?Math.round(100*done/total):0,subs:done+' / '+total,linkedCount:list.length,total,done};}
 const businessKeys={purchase:'purchases',contract:'contracts',expense:'expenses',meeting:'meetings',training:'trainings',agency:'agencys',handover:'handovers'};
 function calendar(data,day){const events=[];
  const event=(key,r,kind,extra={})=>events.push({sourceType:key,sourceId:r.id,eventType:kind,eventDate:day,title:r.name||r.content||r.matter||'',startTime:r.startTime||'',endTime:r.endTime||'',sourceState:state(r,key),navigationTarget:key==='todos'?(ended(r)?'ledger':'work'):Object.keys(businessKeys).find(t=>businessKeys[t]===key),...extra});
  for(const r of works(data.todos||[])){if(activeWork([r]).length&&due(r)===day)event('todos',r,'schedule');if(completion(r)===day)event('todos',r,'completed');for(const s of subRows(r))if(s.done&&s.completed===day)event('todos',r,'completed',{subtaskId:s.id,title:s.name+'（'+(r.name||'')+'）'});}
  for(const [type,key] of Object.entries(businessKeys))for(const r of (data[key]||[]).filter(x=>!x.deleted)){
   if(type==='meeting'&&date(r.date)===day)event(key,r,'schedule');
   if(type==='training'){const start=date(r.startDate),end=r.endDate?date(r.endDate):start;if(start&&end&&end>=start&&dayDiff(end,start)<366&&day>=start&&day<=end)event(key,r,'schedule');}
   if(completion(r,key)===day)event(key,r,'completed');
  }return events;
 }
 function monthly(data,start,end){const rows=works(data.todos||[]),inside=d=>!!d&&d>=start&&d<=end;
  const done=rows.filter(r=>inside(completion(r))),children=rows.flatMap(r=>subRows(r).filter(s=>s.done&&inside(s.completed)).map(s=>({...s,parent:r.name,parentId:r.id})));
  const pending=rows.filter(r=>{const born=date(r.issueDate||r.createdAt),event=B.eventDate('todos',r);return (!born||born<=end)&&(['未开始','进行中'].includes(state(r))||ended(r)&&!!event&&event>end);});
  const late=pending.filter(r=>due(r)&&due(r)<=end),cross=pending.filter(r=>!late.includes(r)&&((date(r.issueDate)&&date(r.issueDate)<start)||subRows(r).some(s=>s.start&&s.start<start)));
  const modules=Object.fromEntries(['purchase','expense','meeting','training'].map(t=>[t,(data[businessKeys[t]]||[]).filter(r=>!r.deleted&&inside(completion(r,businessKeys[t])))]));
  return {start,end,done,children,pending,late,cross,modules,focus:done.filter(r=>(r.type==='record'?r._prevType:r.type)==='key')};
 }
 const priority={red:'重要且紧急',blue:'重要不紧急',yellow:'紧急不重要',gray:'不重要不紧急'};
 function createStore(adapter,{now=()=>new Date(),regenerate}={}){
  const rows=()=>adapter.read('todos'),get=id=>{const r=B.findRecord(rows(),id);if(!r||r.deleted)throw Error('记录不存在');return r;};
  const save=r=>{const all=rows(),i=all.findIndex(x=>same(x.id,r.id));if(i<0)all.push(r);else all[i]=r;adapter.write('todos',all);return clone(r);};
  const validate=d=>{if(!String(d.name||'').trim())throw Error('请输入名称');if(d.start&&d.due&&d.start>d.due)throw Error('开始日期不能晚于截止日期');};
  function edit(id,draft){const old=get(id);validate({...draft,name:draft.name??old.name});const mapping={name:'name',owner:'assignee',start:'issueDate',due:'deadline',content:'content',note:'note',blocker:'blocker',category:'category',source:'source'};const patch={};for(const [ui,key]of Object.entries(mapping))if(Object.hasOwn(draft,ui)){const visible=ui==='due'?due(old):ui==='start'?date(old.issueDate):['category','source'].includes(ui)?[].concat(old[key]||[]):String(old[key]??'');const proposed=['category','source'].includes(ui)?[].concat(draft[ui]||[]):draft[ui];if(JSON.stringify(visible)!==JSON.stringify(proposed))patch[key]=clone(draft[ui]);}if('deadline'in patch)patch.due_date=draft.due;
   if('priority'in draft){const selected=priority[draft.priority]||draft.priority,legacy={important:'重要且紧急',high:'重要且紧急',mid:'重要不紧急',medium:'重要不紧急',urgent:'紧急不重要',normal:'不重要不紧急',low:'不重要不紧急'};if(selected!==(legacy[old.priority]||(Object.values(priority).includes(old.priority)?old.priority:'不重要不紧急')))patch.priority=selected;}
   const cfg=B.normalizeConfig(adapter.read('wb_config'));
   if('category'in patch){patch.work_category_ids=cfg.dictionaries.work_categories.filter(c=>[].concat(draft.category||[]).includes(c.name)).map(c=>c.id);}
   if('source'in patch){patch.source_org_ids=cfg.organizations.filter(c=>['external','internal'].includes(c.type)&&[].concat(draft.source||[]).includes(c.name)).map(c=>c.id);}
   if('goalId'in draft&&String(draft.goalId||'')!==String(old.parent_goal||'').replace(/^todos:/,'')){if(draft.goalId&&!goals(rows()).some(g=>same(g.id,draft.goalId)&&!same(g.id,old.id)))throw Error('请选择有效长期目标');let current=draft.goalId;const seen=new Set([String(old.id)]);while(current){if(seen.has(String(current)))throw Error('目标关联不能形成循环');seen.add(String(current));const p=B.findRecord(rows(),current)?.parent_goal;current=p?.startsWith('todos:')?p.slice(6):'';}patch.parent_goal=draft.goalId?'todos:'+draft.goalId:'';}
   if('workType'in draft&&!old.is_goal){const type={'重点工作':'key','周期工作':'recurring'}[draft.workType]||'';if(type!==(old.type==='record'?old._prevType||'':old.type||'')){if(old.type==='record')patch._prevType=type;else patch.type=type;}}
   return save(B.patchRecord(old,patch));
  }
  function changeState(id,next,{reason='',cycleTouched=false,recurrence}={}){const old=get(id);if(!states.includes(next))throw Error('无效状态');if(next==='已完成'&&!old.is_goal&&subRows(old).some(s=>!s.done))throw Error('存在未完成子任务');let r=state(old)===next?clone(old):B.transition('todos',old,next,now().toISOString());
   if(next==='已关闭'&&String(old.closed_reason??'')!==reason)r.closed_reason=reason;
   if(!ended(r)&&ended(old)){r.reopened_at=now().toISOString();r.reopened_by='user';r.completeDate='';r.closed_at='';}
   if(next==='已完成'&&state(old)!==next)r.reopened_at='';
   if(!r.is_goal){if(ended(r)&&r.type!=='record'){r._prevType=r.type||'';r.type='record';}else if(!ended(r)&&r.type==='record')r.type=r._prevType||'';}
   if(cycleTouched&&!r.is_goal){r.recurrence=clone(recurrence||'none');if(r.type==='record')r._prevType=r.recurrence==='none'?'':'recurring';else r.type=r.recurrence==='none'?'':'recurring';}
   const all=rows(),i=all.findIndex(x=>same(x.id,id));all[i]=r;if(next==='已完成'&&!old.is_goal&&regenerate){const length=all.length;regenerate(all,i,r);for(const n of all.slice(length)){n.parent_goal=r.parent_goal||'';n.type=r._prevType||'recurring';n.subtasks=clone(n.subtasks||[]).map(s=>B.patchRecord(s,{completed:false,...('done'in s?{done:false}:{}),completed_date:''}));}}
   adapter.write('todos',all);return clone(r);
  }
  function create(draft,{goal=false}={}){validate(draft);let r={id:B.nextNumericId(rows()),name:draft.name.trim(),state:'未开始',state_manual:true,status:'未开始',type:'',is_goal:goal,deleted:false,createdAt:local(now()),subtasks:[],recurrence:'none',parent_goal:''};save(r);try{r=edit(r.id,draft);if(draft.state&&draft.state!=='未开始')r=changeState(r.id,draft.state);return r;}catch(e){adapter.write('todos',rows().filter(x=>!same(x.id,r.id)));throw e;}}
  function subtask(parent,action,id,draft={}){const r=get(parent),items=clone(r.subtasks||[]),i=items.findIndex((s,j)=>same(s.id??'legacy-'+j,id)),s=items[i];if(action!=='add'&&i<0)throw Error('子任务不存在');
   const patch={};for(const [a,b]of Object.entries({name:'name',start:'start_date',due:'due_date'}))if(a in draft)patch[b]=draft[a];
   if((action==='edit'||action==='add')&&(!String(draft.name||'').trim()||draft.start&&draft.due&&draft.start>draft.due))throw Error('请输入有效子任务名称及日期');
   if(action==='add')items.push({id:B.nextNumericId(items.filter(x=>x.id!==undefined)),...patch,completed:false,completed_date:'',sort_order:items.length});
   if(action==='edit')items[i]=B.patchRecord(s,patch);
   if(action==='toggle'){const done=!!(s.completed??s.done);items[i]=B.patchRecord(s,{completed:!done,...('done'in s?{done:!done}:{}),completed_date:done?'':local(now())});}
   if(action==='delete')items.splice(i,1);
   if(action==='move'){const j=i+draft.delta;if(j>=0&&j<items.length)items.splice(j,0,items.splice(i,1)[0]);items.forEach((x,j)=>x.sort_order=j);}
   return save(B.patchRecord(r,{subtasks:items}));
  }
  function reorder(parent,ids){const r=get(parent),items=clone(r.subtasks||[]);if(ids.length!==items.length||new Set(ids.map(String)).size!==items.length)throw Error('子任务排序无效');const sorted=ids.map(id=>{const s=items.find((s,i)=>same(s.id??'legacy-'+i,id));if(!s)throw Error('子任务排序无效');return s;});sorted.forEach((s,i)=>s.sort_order=i);return save(B.patchRecord(r,{subtasks:sorted}));}
  return {get,read:rows,create,edit,state:changeState,subtask,reorder,delete:id=>save(B.patchRecord(get(id),{deleted:true}))};
 }
 return Object.freeze({today,date,local,addDays,dayDiff,state,ended,works,activeWork,history,goals,due,completion,historyDate,subRows,weekRange,weeklyCompleted,weeklyFocus,workStats,linked,goalProgress,calendar,monthly,businessKeys,createStore});
});
