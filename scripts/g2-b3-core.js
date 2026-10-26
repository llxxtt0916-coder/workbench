/* B3 business views and explicit writes. Existing collections/B1 remain authoritative. */
(function(root,factory){const api=factory(typeof module==='object'?require('./g2-b1-core.js'):root.G2B1,typeof module==='object'?require('./g2-b2-core.js'):root.G2B2);if(typeof module==='object')module.exports=api;else root.G2B3=api;})(globalThis,function(B,Q){
 'use strict';
 const keys={meeting:'meetings',training:'trainings',handover:'handovers'},states=['未开始','进行中','已完成','已关闭'],clone=structuredClone;
 const fields={meeting:['name','owner','date','type','startTime','endTime','location','organizer','attendees','agenda','minutes','actionItems'],training:['owner','name','organizer','type','category','startDate','endDate','days','credits','creditType','content','attachment','location'],handover:['owner','date','note','giver','receiver','items']};
 const dates=new Set(['date','startDate','endDate']);
 function quantity(v){if(typeof v==='string'&&!/^[1-9]\d*$/.test(v))return null;const n=typeof v==='number'||typeof v==='string'?Number(v):NaN;return Number.isSafeInteger(n)&&n>0?n:null;}
 function items(r){if(Array.isArray(r.items)&&r.items.length)return clone(r.items);return ['content','quantity','docType'].some(k=>Object.hasOwn(r,k))?[{content:r.content??'',quantity:r.quantity??'',docType:r.docType??''}]:[];}
 const title=r=>items(r).map(x=>x.content).filter(Boolean).join('；')||'未填写交接内容';
 function state(type,r,reader){return B.readState(keys[type],r)??reader?.(keys[type],r)??'未开始';}
 function view(type,r,reader){const life=state(type,r,reader),v={...clone(r),id:String(r.id),_sourceId:r.id,_key:keys[type],businessType:type,owner:r.assignee||'',goalId:String(r.parent_goal||'').replace(/^todos:/,''),state:life,status:life,closeReason:r.closed_reason||'',completeDate:life==='已完成'?B.eventDate(keys[type],r)||'—':'',closeDate:life==='已关闭'?B.eventDate(keys[type],r)||'—':''};
  if(type==='training'){const t=B.readTraining(r);v.location=t.location;v.days=t.days;}
  for(const key of dates)if(Object.hasOwn(r,key))v[key]=Q.date(r[key]);
  if(type==='training'&&Object.hasOwn(r,'credits'))v.credits=r.credits!==null&&r.credits!==''&&Number.isFinite(Number(r.credits))?Number(r.credits):null;
  if(type==='meeting'){v.attendees=Array.isArray(r.attendees)?r.attendees.join(', '):String(r.attendees||'');v.actionItems=(r.actionItems||[]).map((x,i)=>({...clone(x),_b3key:'old:'+i}));}
  if(type==='handover'){v.name=title(r);v.items=items(r).map((x,i)=>({...x,quantity:quantity(x.quantity),_b3key:'old:'+i}));v.due='';}
  return v;
 }
 function stats(type,rows,day=Q.today(),reader){rows=rows.filter(r=>!r.deleted);const life=r=>state(type,r,reader),done=rows.filter(r=>life(r)==='已完成').length,todo=rows.filter(r=>life(r)==='未开始').length;
  if(type==='meeting')return {total:rows.length,month:rows.filter(r=>Q.date(r.date).startsWith(day.slice(0,7))).length,todo};
  if(type==='training')return {year:rows.filter(r=>Q.date(r.startDate).startsWith(day.slice(0,4)+'-')).length,month:rows.filter(r=>Q.date(r.startDate).startsWith(day.slice(0,7))).length,done,todo};
  const count={'原件':0,'复印件':0},warnings=[];for(const r of rows)for(const [i,x]of items(r).entries()){const n=quantity(x.quantity);if(n===null){warnings.push({id:r.id,index:i,value:x.quantity,reason:'数量未知或异常，未计入'});continue;}if(!Object.hasOwn(count,x.docType)){warnings.push({id:r.id,index:i,value:x.docType,reason:'未知文档类型，未归组'});continue;}if(!Number.isSafeInteger(count[x.docType]+n)){warnings.push({id:r.id,index:i,value:x.quantity,reason:'数量汇总超出安全整数范围，未计入'});continue;}count[x.docType]+=n;}return {total:rows.length,done,original:count['原件'],copy:count['复印件'],warnings};
 }
 const has=(v,q)=>String(v??'').toLocaleLowerCase().includes(String(q||'').trim().toLocaleLowerCase());
 function filter(type,rows,{query='',tab='全部',filters={}}={},day=Q.today(),reader){const f=filters,range=(v,k)=>{const d=Q.date(v);return (!f[k+'From']||d&&d>=f[k+'From'])&&(!f[k+'To']||d&&d<=f[k+'To']);};return rows.filter(r=>!r.deleted&&(tab==='全部'||state(type,r,reader)===tab)).filter(r=>{
  if(type==='meeting')return has([r.name,r.location,r.organizer,Array.isArray(r.attendees)?r.attendees.join(', '):r.attendees].join(' '),query)&&(!f.type||r.type===f.type)&&range(r.date,'date');
  if(type==='training')return has([r.name,r.organizer,r.content].join(' '),query)&&(!f.type||r.type===f.type)&&(!f.category||r.category===f.category)&&(!f.expiring||r.hasCertificate&&Q.date(r.certificateExpiry)>=day&&Q.date(r.certificateExpiry)<=Q.addDays(day,30));
  return has(title(r),query)&&has(r.giver,f.giver)&&has(r.receiver,f.receiver)&&has(title(r),f.content)&&(!f.docType||items(r).some(x=>x.docType===f.docType))&&range(r.date,'date');
 });}
 function exportRows(type,rows,{query='',filters:f={}}={}){return rows.filter(r=>!r.deleted).filter(r=>type==='meeting'?(!f.type||r.type===f.type)&&has([r.name,r.location].join(' '),query):type==='training'?(!f.type||r.type===f.type)&&(!f.category||r.category===f.category)&&has([r.name,r.organizer].join(' '),query):true);}
 const headers={meeting:['名称','日期','时间','地点','类型','组织方','参与人数','行动项数','下次会议'],training:['名称','组织方','类型','分类','开始日期','结束日期','学分','学分类型','有证书','证书到期','费用','费用状态','有考核','考核结果','培训地点','培训天数'],handover:['交接日期','交出人','接收人','交接内容','数量','原件/复印件','备注']};
 function itemCells(r){const list=items(r);if(!list.length)return ['','',''];if(list.length===1)return ['content','quantity','docType'].map(k=>list[0][k]??'');return ['content','quantity','docType'].map(k=>JSON.stringify(list.map(x=>x[k]??null)));}
 function decodeItemCells(cells){try{const a=cells.map(x=>JSON.parse(x));if(a.every(Array.isArray)&&a[0].length>=2&&a.every(x=>x.length===a[0].length))return a[0].map((content,i)=>({content,quantity:a[1][i],docType:a[2][i]}));}catch{}return cells.every(x=>x==='')?[]:[{content:cells[0],quantity:cells[1],docType:cells[2]}];}
 function decimal(value){if(value===null)return '';const text=String(value);if(!/[eE]/.test(text))return text;const [mantissa,power]=text.toLowerCase().split('e'),parts=mantissa.split('.'),digits=parts.join(''),point=parts[0].length+Number(power);return point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);}
 function csv(type,rows){const values=rows.map(r=>type==='meeting'?[r.name,r.date,(r.startTime||'')+'-'+(r.endTime||''),r.location,r.type,r.organizer,(r.attendees||[]).length,(r.actionItems||[]).length,r.nextMeetingDate]:type==='training'?[r.name,r.organizer,r.type,r.category,r.startDate,r.endDate,r.credits||'',r.creditType,r.hasCertificate?'是':'否',r.certificateExpiry,r.fee||'',r.feeStatus,r.hasExam?'是':'否',r.examResult,r.location||'',decimal(B.readTraining(r).days)]:[r.date,r.giver,r.receiver,...itemCells(r),r.note]);return '\uFEFF'+[headers[type],...values].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';}
 function createStore(adapter,{now=()=>new Date(),stateReader}={}){
  const read=type=>{if(!keys[type])throw Error('未批准的业务类型');return adapter.read(keys[type]);},get=(type,id)=>{const r=B.findRecord(read(type),id);if(!r||r.deleted)throw Error('记录不存在');return r;},write=(type,r)=>{const rows=read(type),i=rows.findIndex(x=>B.sameId(x.id,r.id));if(i<0)rows.push(r);else rows[i]=r;adapter.write(keys[type],rows);return clone(r);};
  function prepare(type,old,draft){const visible=view(type,old,stateReader),patch={};for(const field of fields[type]){if(!Object.hasOwn(draft,field)||['items','actionItems'].includes(field))continue;const target=field==='owner'?'assignee':field,proposed=draft[field];let current=dates.has(field)?Q.date(old[target]):visible[field]??'';if(['name','owner','organizer','location','attendees','creditType','attachment','giver','receiver','note'].includes(field)&&typeof current==='string')current=current.replace(/[\r\n]/g,'');if((proposed??'')===(current??''))continue;
    if(dates.has(field)&&proposed&&Q.date(proposed)!==proposed)throw Error('请输入有效日期');if(['startTime','endTime'].includes(field)&&proposed&&!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(proposed))throw Error('请输入有效时间');patch[target]=clone(proposed);
   }
   if('name'in patch&&!String(patch.name||'').trim())throw Error('请输入名称');
   if('organizer'in patch){const cfg=B.normalizeConfig(adapter.read('wb_config')),org=cfg.organizations.find(x=>x.status!=='inactive'&&(x.name===patch.organizer||x.shortName===patch.organizer));patch.organizer_org_id=org?.id||'';}
   if('attendees'in patch)patch.attendees=String(patch.attendees||'').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
   if('credits'in patch&&patch.credits!==null&&(typeof patch.credits!=='number'||!Number.isFinite(patch.credits)))throw Error('学分/学时必须是有效数值');
   const result=type==='training'?B.writeTraining(old,patch):B.patchRecord(old,patch);
   if(type==='training'&&(patch.startDate||patch.endDate)&&Q.date(result.startDate)&&Q.date(result.endDate)&&result.startDate>result.endDate)throw Error('开始日期不能晚于结束日期');
   if(type==='meeting'&&('startTime'in patch||'endTime'in patch)&&result.startTime&&result.endTime&&result.startTime>=result.endTime)throw Error('开始时间必须早于结束时间');
   const collection=type==='meeting'?'actionItems':type==='handover'?'items':null;
   if(collection&&Object.hasOwn(draft,collection)){const previous=type==='handover'?items(old):old.actionItems||[],columns=type==='handover'?['content','quantity','docType']:['text','assignee','deadline','done'];const next=draft[collection].map(row=>{const n=/^old:(\d+)$/.exec(row._b3key||''),prior=n?previous[Number(n[1])]:row.id!==undefined?B.findRecord(previous,row.id):null,edits={};for(const k of columns){if(!Object.hasOwn(row,k))continue;let baseline=k==='quantity'?quantity(prior?.quantity):prior?.[k]??(k==='done'?false:'');if(['text','content','assignee'].includes(k)&&typeof baseline==='string')baseline=baseline.replace(/[\r\n]/g,'');if((row[k]??'')!==(baseline??''))edits[k]=clone(row[k]);}
     if(type==='handover'){if(!prior&&!String(row.content||'').trim())throw Error('请输入交接内容');if(!prior||'quantity'in edits){const q=quantity(row.quantity);if(q===null)throw Error('数量必须是安全的正整数');edits.quantity=q;}}
     if(type==='meeting'&&!prior&&!String(row.text||'').trim())throw Error('请输入行动项内容');
     return B.patchRecord(prior||(type==='handover'?{content:'',quantity:null,docType:''}:{text:'',assignee:'',deadline:'',done:false}),edits);
    });if(type==='handover'&&previous.length&&!next.length)throw Error('请保留至少一项交接物品');if(JSON.stringify(next)!==JSON.stringify(previous))result[collection]=next;}
   return result;
  }
  function edit(type,id,draft){return write(type,prepare(type,get(type,id),draft));}
  function create(type,draft){if(type!=='handover'&&!String(draft.name||'').trim())throw Error('请输入名称');const r={id:B.nextNumericId(read(type)),state:'未开始',state_manual:true,deleted:false};if(draft.goalId){const goal=B.findRecord(adapter.read('todos'),draft.goalId);if(!goal||goal.deleted||!goal.is_goal)throw Error('请选择有效长期目标');r.parent_goal='todos:'+goal.id;}if(type==='training')Object.assign(r,{location:'',days:null});if(type==='meeting')Object.assign(r,{attendees:[],actionItems:[]});if(type==='handover'&&!draft.items?.length)throw Error('请输入交接内容');let result=prepare(type,r,draft);if(draft.state&&draft.state!=='未开始'){if(!states.includes(draft.state))throw Error('无效状态');result=B.transition(keys[type],result,draft.state,now().toISOString());}return write(type,result);}
  function changeState(type,id,next,reason=''){if(!states.includes(next))throw Error('无效状态');const old=get(type,id),previous=state(type,old,stateReader);let r=previous===next?clone(old):B.transition(keys[type],old,next,now().toISOString());if(next==='已关闭')r.closed_reason=reason;if(['未开始','进行中'].includes(next)&&['已完成','已关闭'].includes(previous)){r.closed_at='';for(const k of ['completeDate','completedDate','doneDate'])if(Object.hasOwn(r,k))r[k]='';}return write(type,r);}
  return {read,get,edit,create,state:changeState,delete:(type,id)=>write(type,B.patchRecord(get(type,id),{deleted:true}))};
 }
 return Object.freeze({keys,fields,quantity,items,title,state,view,stats,filter,exportRows,headers,itemCells,decodeItemCells,csv,createStore});
});
