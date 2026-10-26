/* B3 bridge to actual DB, legacy state reader, B1 patch/relations and formal exports. */
(() => {
 'use strict';if(!window.g2B2Enabled)return;
 const Q=G2B3,D=G2B2_VIEW,S=G2B2_SCHEMAS,A=G2B2_APP;
 const readState=(key,r)=>G2B1.readState(key,r)??recordState(key,r);
 const store=G2B5_APP.gateway.wrapStore('B3',Q.createStore({read:k=>DB.raw(k),write:(k,v)=>_origDBSet(k,v)},{stateReader:readState}));
 const f=(key,label,type='text',extra={})=>({key,label,type,...extra}),full={full:true};
 const organization=f('organizer','组织方','organization',{scope:'organizations'});
 S.records.training={fields:[f('owner','经办人'),f('name','培训名称','text',full),organization,f('type','类型','select',{options:['','线上','线下','混合']}),f('category','分类','select',{options:['','业务培训','继续教育','党建学习','其他']}),f('startDate','开始日期','date'),f('endDate','结束日期','date'),f('days','培训天数','number',{min:0,step:'any'}),f('credits','学分/学时','number',{step:0.01}),f('creditType','学分类别'),f('content','培训内容摘要','textarea',full),f('attachment','附件链接'),f('location','培训地点')]};
 S.records.meeting={fields:[f('owner','经办人'),f('name','会议名称','text',full),f('date','会议日期','date'),f('type','会议形式','select',{options:['线上','线下','混合']}),f('startTime','开始时间','time'),f('endTime','结束时间','time'),f('location','地点'),organization,f('attendees','参会人'),f('agenda','会议议程','textarea',full),f('minutes','会议纪要','textarea',full),f('actionItems','行动项','collection',{full:true,columns:[f('text','行动项内容'),f('assignee','负责人'),f('deadline','截止日期','date'),f('done','完成','checkbox')]})]};
 S.records.handover={fields:[f('owner','经办人'),f('date','交接日期','date'),f('note','备注'),f('giver','交出人'),f('receiver','接收人'),f('items','交接内容 / 物品','collection',{full:true,columns:[f('content','交接内容'),f('quantity','数量','number',{min:1,step:1}),f('docType','文档类型','select',{options:['','原件','复印件']})]})]};
 S.statusModules.push('meeting','training','handover');S.bulkModules.push('meeting','training','handover');
 const raw=type=>DB.raw(Q.keys[type]),typeForKey=key=>Object.keys(G2B2.businessKeys).find(t=>G2B2.businessKeys[t]===key);
 const priorRefresh=A.refresh;
 function refresh(){priorRefresh();for(const type of Object.keys(Q.keys)){D[type]=raw(type).filter(r=>!r.deleted).map(r=>Q.view(type,r,readState));for(const r of D.work.filter(r=>r.businessType===type)){const b=D[type].find(b=>G2B1.sameId(b._sourceId,r._sourceId));if(b){r.business=b;r.name=b.name;r.owner=b.owner;r.state=b.state;r.status=b.state;if(type==='handover')r.due='';}}
   if(type==='handover')continue;for(const r of D[type]){if(r.matter_id===undefined||r.matter_id===null||r.matter_id==='')continue;for(const member of matterMembers(r.matter_id)){if(member.ledger===r._key&&G2B1.sameId(member.record.id,r._sourceId))continue;const target=member.ledger==='todos'?(G2B2.ended(member.record)?'ledger':'work'):typeForKey(member.ledger);if(target)D.relations.push({fromType:type,fromId:r.id,toType:target,toId:String(member.record.id)});}}
  }}
 A.refresh=refresh;refresh();
 function exported(type,options={}){return Q.csv(type,Q.exportRows(type,raw(type),options));}
 function download(type,options={}){const rows=Q.exportRows(type,raw(type),options);if(!rows.length)throw Error('无数据可导出');const text=Q.csv(type,rows),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=type+'_'+G2B2.today()+'.csv';a.click();URL.revokeObjectURL(url);return text;}
 const oldExport=exportModuleCSV;exportModuleCSV=function(type,options){return Q.keys[type]?download(type,options||window.G2B3_UI?.exportOptions(type)||{}):oldExport(type);};
 function createLinked(source,type,draft){if(!LINKED_NEW_PATHS[source._key]?.includes(Q.keys[type]))throw Error('不支持该关联路径');const before=Object.fromEntries(G2B1.BUSINESS_KEYS.map(k=>[k,DB.raw(k)]));try{const r=store.create(type,draft),result=linkMatterRecords(source._key,source._sourceId,Q.keys[type],r.id);if(!['linked','already-linked'].includes(result.status))throw Error('关联未完成：'+result.status);return r;}catch(error){for(const [k,v]of Object.entries(before))_origDBSet(k,v);throw error;}}
 window.G2B3_APP={store,refresh,raw,readState,view:(type,r)=>Q.view(type,r,readState),stats:type=>Q.stats(type,raw(type),G2B2.today(),readState),filtered:(type,opts)=>Q.filter(type,raw(type),opts,G2B2.today(),readState).map(r=>Q.view(type,r,readState)),export:exported,download,createLinked:G2B5_APP.gateway.operation('B3.createLinked',createLinked),approvedNewPaths:source=>LINKED_NEW_PATHS[source._key]||[]};
})();
