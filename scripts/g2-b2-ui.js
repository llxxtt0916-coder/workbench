/* UI 2.0 G1.5 prototype. No production data, storage or network access. */
(() => {'use strict';
if(!window.g2B2Enabled)return;
const D=window.G2B2_VIEW,S=window.G2B2_SCHEMAS,C=window.G2B2_WORK_CORE;let page=location.hash.slice(1).split('?')[0]||'dashboard';
const params=new URLSearchParams(location.search),fixture=params.get('scene')==='b1',TODAY=C.TODAY;
const nav=[
 ['概览',[['dashboard','驾驶舱','grid','dashboard.html'],['monthly','月度摘要','calendar','monthly.html']]],
 ['工作',[['work','待办 / 工作','check','work.html'],['goals','长期目标','layers','goals.html'],['inspiration','灵感','spark','inspiration.html']]],
 ['业务记录',[['ledger','工作','archive','ledger.html'],['purchase','采购','briefcase','purchase.html'],['contract','合同','file','contract.html'],['expense','报销','wallet','expense.html'],['meeting','会议','calendar','meeting.html'],['training','培训','cap','training.html'],['handover','交接','handover','handover.html'],['agency','委托','briefcase','agency.html'],['fund','经费','wallet','fund.html']]],
 ['管理',[['config','配置中心','sliders','config.html'],['settings','设置','settings','settings.html']]]
];
const names=Object.fromEntries(nav.flatMap(g=>g[1]).map(x=>[x[0],x[1]]));
const icons={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 check:'<path d="m4 12 5 5L20 6"/>',archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
 file:'<path d="M6 2h8l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM14 2v6h5M8 13h8M8 17h8"/>',
 wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M16 13h5"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 cap:'<path d="m2 9 10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5M22 9v7"/>',
 handover:'<rect x="4" y="5" width="16" height="17" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 15h8M8 18h5"/>',
 sliders:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="16" cy="17" r="2" fill="white"/>',
 settings:'<path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 spark:'<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="M5 5l14 14M19 5 5 19"/>',
 chevron:'<path d="m9 6 6 6-6 6"/>',left:'<path d="m15 6-6 6 6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',edit:'<path d="m4 20 4.5-1 11-11a2 2 0 0 0-3-3l-11 11zM14.5 6.5l3 3"/>',
 trash:'<path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
 eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',alert:'<path d="m12 3 10 17H2z"/><path d="M12 9v5M12 17h.01"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a7 7 0 0 1 12-2l2 5M4 12l2 5a7 7 0 0 0 12-2"/>',
 link:'<path d="M10 13a5 5 0 0 0 7 .5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
 checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>'
};
const I=(name,cls='')=>'<svg class="icon '+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.info)+'</svg>';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={tab:'全部',status:'全部',query:'',filter:false,expanded:null,detail:null,config:null,configStatus:'全部',month:'本月',calendar:25};
const btn=(label,icon,act,kind='',attrs='')=>'<button class="button '+kind+'" data-action="'+act+'" '+attrs+'>'+(icon?I(icon):'')+E(label)+'</button>';
const iconBtn=(icon,act,label,attrs='')=>'<button class="icon-button ghost" data-action="'+act+'" aria-label="'+E(label)+'" title="'+E(label)+'" '+attrs+'>'+I(icon)+'</button>';
const dot=prio=>{const p=S.priorities.find(x=>x[0]===prio)||S.priorities[3];return '<span class="priority-dot '+p[0]+'" role="img" aria-label="优先级：'+p[1]+'" title="'+p[1]+'"></span>'};
const status=(value)=>{const tone={'已完成':'green','已报销':'green','已到货':'green','启用':'green','进行中':'blue','执行中':'blue','审批通过':'blue','已逾期':'red','已过期':'red','已拒绝':'red','逾期':'red','已取消':'gray','已关闭':'gray','停用':'gray','未开始':'gray','申请中':'yellow','待签':'yellow','待报销':'yellow'}[value]||'gray';return '<span class="status '+tone+'">'+E(value)+'</span>'};
const progress=(pct,label)=>'<span class="small-progress"><span class="progress-track"><span class="progress-fill '+(pct===100?'green':'')+'" style="width:'+Number(pct||0)+'%"></span></span>'+E(label??pct+'%')+'</span>';
const header=(title,description,actions='')=>'<div class="page-header"><div><h1 class="page-title">'+E(title)+'</h1><p class="page-description">'+E(description)+'</p></div><div class="page-actions">'+actions+'</div></div>';
const metrics=(arr)=>'<div class="metric-grid">'+arr.map(x=>'<div class="metric"><span class="metric-label">'+I(x.icon||'file')+E(x.label)+'</span><strong class="metric-value mono">'+E(x.value)+'</strong><span class="metric-foot '+(x.tone||'')+'">'+E(x.foot||'')+'</span></div>').join('')+'</div>';
const section=(title,body,action='',meta='')=>'<section class="section"><div class="section-head"><h2 class="section-title">'+E(title)+'<span class="section-meta">'+E(meta)+'</span></h2><div class="section-actions">'+action+'</div></div><div class="section-body">'+body+'</div></section>';
const detailList=entries=>'<dl class="detail-list">'+entries.map(([k,v])=>'<dt>'+E(k)+'</dt><dd>'+E(v)+'</dd>').join('')+'</dl>';
const relationCount=(type,id)=>D.relations.filter(x=>x.fromType===type&&x.fromId===id).length;
const relationButton=(type,id,compact=true)=>{if(window.G2B3_UI?.canRelate(type,id,D)===false||window.G2B4_UI?.canRelate(type,id,D)===false)return '';const count=relationCount(type,id),attrs='data-type="'+type+'" data-id="'+E(id)+'"';return '<button class="'+(compact?'icon-button ghost':'button')+' relation-action" data-action="relations" '+attrs+' aria-label="关联 '+count+' 条" title="关联 '+count+' 条">'+I('link')+'<span class="relation-count">'+count+'</span></button>'};
const actions=(type,id,del=true)=>'<div class="cell-actions">'+iconBtn('eye','detail','查看详情','data-type="'+type+'" data-id="'+E(id)+'"')+iconBtn('edit','edit','编辑','data-type="'+type+'" data-id="'+E(id)+'"')+(S.statusModules.includes(type)?iconBtn('refresh','status','状态','data-type="'+type+'" data-id="'+E(id)+'"'):'')+(del?iconBtn('trash','delete','删除','data-type="'+type+'" data-id="'+E(id)+'"'):'')+(type!=='config'?relationButton(type,id):'')+'</div>';
const bulk={};
const table=(heads,rows,group=page)=>{
 const allowed=S.bulkModules.includes(group),b=bulk[group]||{active:false,selected:new Set()};
 const body=document.createElement('tbody');body.innerHTML=rows;
 const records=[...body.children].filter(row=>row.tagName==='TR'&&!row.classList.contains('subtasks-row'));
 const ids=[];
 if(allowed){for(const row of records){const id=row.querySelector('[data-id]')?.dataset.id;if(id===undefined)continue;ids.push(id);row.dataset.recordId=id;if(b.active)row.insertAdjacentHTML('afterbegin','<td><input type="checkbox" data-bulk="'+E(group)+'" data-bulk-id="'+E(id)+'" aria-label="选择记录 '+E(record(group,id)?.name||'')+'" '+(b.selected.has(id)?'checked':'')+'></td>');}rows=body.innerHTML;}
 b.visible=ids;bulk[group]=b;
 const tools=allowed?'<div class="bulk-bar" data-bulk-group="'+group+'">'+btn(b.active?'退出批量':'批量处理','check','bulk-toggle','','data-group="'+group+'"')+(b.active?'<label><input type="checkbox" data-bulk-all="'+group+'" '+(ids.length&&ids.every(id=>b.selected.has(id))?'checked':'')+'> 全选当前列表</label><span>已选 '+ids.filter(id=>b.selected.has(id)).length+' 条</span>'+btn('删除所选','trash','bulk-delete','danger','data-group="'+group+'"'):'')+'</div>':'';
 return '<div class="data-area">'+tools+'<div class="table-scroll"><table class="data-table"><thead><tr>'+(allowed&&b.active?'<th>选择</th>':'')+heads.map(h=>'<th>'+E(h)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div><div class="table-footer"><span>'+(allowed?ids.length:records.length)+' 条记录</span><span></span></div></div>';
};
const searchBox=(placeholder)=>'<label class="search-input">'+I('search')+'<input type="search" id="local-query" placeholder="'+E(placeholder)+'" aria-label="'+E(placeholder)+'" value="'+E(state.query)+'"></label>';
const filterPanel=(fields)=>state.filter?'<div class="filter-panel">'+fields.map(f=>'<div class="form-group"><label class="field-label">'+E(f[0])+'</label><select class="select" data-filter="'+E(f[1])+'"><option value="全部">全部</option>'+f[2].map(v=>'<option '+(state[f[1]]===v?'selected':'')+'>'+E(v)+'</option>').join('')+'</select></div>').join('')+'<div class="form-group">'+btn('清除条件','close','clear-filter')+'</div></div>':'';
const matchesFilters=r=>['status','owner','source','category','type','fund','supplier','workType','priority','giver','receiver'].every(k=>!state[k]||state[k]==='全部'||asArray(state[k]).some(v=>asArray(r[k]).includes(v)));
const toolbar=(tabs,other='',extra='')=>'<div class="toolbar"><div class="toolbar-left tabs">'+tabs.map(t=>'<button class="tab '+(state.tab===t?'active':'')+'" data-action="tab" data-value="'+E(t)+'">'+E(t)+'</button>').join('')+'</div><div class="toolbar-right">'+extra+btn('筛选','filter','toggle-filter')+other+'</div></div>';
function shell(){return '<div class="nav-scrim" data-action="close-nav"></div><div class="app-shell"><aside class="sidebar"><a class="brand" href="dashboard.html"><span class="brand-mark">W.</span><span class="brand-name">Workbench<span class="brand-sub">Personal workspace</span></span></a><nav aria-label="主导航">'+nav.map(g=>'<div class="nav-group"><div class="nav-caption">'+g[0]+'</div>'+g[1].map(n=>'<a class="nav-link '+(page===n[0]?'active':'')+'" href="'+n[3]+'" '+(page===n[0]?'aria-current="page"':'')+'>'+I(n[2])+'<span>'+n[1]+'</span>'+(n[0]==='work'?'<span class="nav-count">'+C.active().length+'</span>':'')+'</a>').join('')+'</div>').join('')+'</nav><div class="sidebar-foot">个人工作台</div></aside><div class="app-main"><header class="topbar"><button class="icon-button ghost mobile-menu" data-action="open-nav" aria-label="打开导航">'+I('menu')+'</button><button class="top-search" data-action="global-search" aria-label="搜索工作、记录、经办人">'+I('search')+'<span>搜索工作、记录、经办人…</span><kbd>Ctrl K</kbd></button><div class="top-actions">'+syncMarkup()+''+btn('智能录入','spark','smart-input','primary')+'</div></header>'+backupMarkup()+'<main class="content" id="page-root"></main></div></div><div id="overlay-root"></div><div class="toast-stack" id="toast-stack" aria-live="polite"></div>'}

const core={calendarMonth:TODAY.slice(0,7),calendarDate:TODAY,month:TODAY.slice(0,7),rangeStart:TODAY.slice(0,7)+'-01',rangeEnd:TODAY,goalOpen:null,subEditor:null,drag:null,summaryText:''};
const coreEmpty=text=>'<div class="b2-empty">'+E(text||'本期暂无记录')+'</div>';
const coreLine=(r,meta='')=>'<div class="list-row">'+(r.type==='工作'?dot(r.priority):'')+'<div class="row-main"><div class="row-title">'+E(r.name)+'</div><div class="row-sub">'+E(meta||r.type+' · '+C.fact(r))+'</div></div><div class="row-side">'+status(lifecycle(C.business(r)))+iconBtn('eye','detail','查看详情','data-type="work" data-id="'+E(r.id)+'"')+'</div></div>';
function dashboard(){
 const active=C.active(),today=active.filter(r=>C.due(r)===TODAY),near=C.near(),late=C.overdue(),funds=C.fundProgress(TODAY,TODAY);
 const month=core.calendarMonth,range=C.monthRange(month),offset=(new Date(month+'-01T00:00:00').getDay()+6)%7,days=Number(range.end.slice(-2));
 let cells=['一','二','三','四','五','六','日'].map(x=>'<span class="weekday">'+x+'</span>').join('')+'<span></span>'.repeat(offset);
 for(let n=1;n<=days;n++){const day=month+'-'+String(n).padStart(2,'0');cells+='<button class="'+(day===core.calendarDate?'today ':'')+(C.calendar(day).length?'has-dot':'')+'" data-action="core-calendar-day" data-value="'+day+'" aria-label="'+day+'">'+n+'</button>';}
 const cal='<div class="b2-calendar-nav ui-adjust-calendar-nav">'+iconBtn('left','core-calendar-prev','上月')+'<input class="input" type="month" id="core-calendar-month" aria-label="日历月份" value="'+month+'">'+iconBtn('chevron','core-calendar-next','下月')+btn('回到本月',null,'core-calendar-today')+'</div><div class="calendar-grid">'+cells+'</div>';
 const dayRows=C.calendar(core.calendarDate),dayPart=done=>dayRows.filter(r=>r.done===done).map(r=>{const business=record(r.type,r.id),time=!done&&r.fact==='会议日程'?(r.startTime+(r.endTime?'–'+r.endTime:'')):!done&&r.fact==='培训安排'?'全天':done?'完成':'待办';return '<div class="agenda-row"><span class="agenda-time">'+E(time||'—')+'</span><div class="agenda-line"><strong>'+E(r.name)+'</strong><small>'+E(r.fact)+(business?.location?' · '+E(business.location):'')+'</small></div>'+iconBtn('eye','detail','查看详情','data-type="'+r.type+'" data-id="'+E(r.id)+'"')+'</div>';}).join('')||coreEmpty('当日暂无'+(done?'完成记录':'事项'));
 const focus=C.weeklyFocus.map(id=>D.work.find(r=>r.id===id)).filter(Boolean).map(r=>'<div class="list-row">'+dot(r.priority)+'<div class="row-main"><div class="row-title">'+E(r.name)+'</div><div class="row-sub">来源：'+E(r.source||'—')+' / 分类：'+E(r.category||'—')+'</div></div><div class="row-side">'+progress(r.pct,r.progress)+status(lifecycle(C.business(r)))+iconBtn('chevron','detail','查看详情','data-type="work" data-id="'+E(r.id)+'"')+'</div></div>').join('');
 return '<div class="ui-adjust-dashboard"><div class="dashboard-heading"><div><h1 class="page-title">上午好</h1><p class="page-description">查看当前事项、截止日期与业务进展。</p></div><span class="dashboard-date">'+E(TODAY)+'</span></div>'+
 metrics([{label:'今日待办',value:today.length,foot:'需要优先处理',icon:'file'},{label:'临期事项',value:near.length,foot:'工作 3 天 · 合同 30 天；其余按模块规则',icon:'clock'},{label:'逾期事项',value:late.length,foot:'请及时核对',icon:'alert',tone:'alert'},{label:'本周完成',value:C.weeklyCompleted,foot:'自然周完成工作',icon:'checkCircle'}])+
 '<div class="dashboard-grid"><div>'+section('本周重点推进',focus,'<a class="text-link" href="work.html">待办 / 工作 '+I('chevron','sm')+'</a>','')+
 section('经费使用进度','<div class="brief-list">'+funds.map(f=>'<div class="brief-row"><strong>'+E(f.name)+progress(f.pct??0,f.pct===null?'—':f.pct.toFixed(1)+'%')+'<small>已使用 ¥ '+(f.used===null?'—':f.used.toLocaleString())+' / 预算 ¥ '+(f.budget===null?'—':f.budget.toLocaleString())+'</small></strong>'+iconBtn('eye','detail','查看经费详情','data-type="fund" data-id="'+f.id+'"')+'</div>').join('')+'</div>','<a class="text-link" href="fund.html">经费</a>','未关闭项目 · 当前累计截至 '+TODAY)+'</div><aside>'+section('月度工作日历',cal)+
 section('当日明细','<div class="ui-adjust-agenda"><h3 class="split-list-title">当日事项</h3>'+dayPart(false)+'<h3 class="split-list-title">当日完成</h3>'+dayPart(true)+'</div>','',''+core.calendarDate)+'</aside></div></div>';
}
function monthly(){
 let range=C.monthRange(core.month);if(state.month==='本季度'){const q=Math.floor((Number(TODAY.slice(5,7))-1)/3)*3+1,first=TODAY.slice(0,4)+'-'+String(q).padStart(2,'0');range={start:first+'-01',end:C.monthRange(C.shiftMonth(first,2)).end};}if(state.month==='本年度')range={start:TODAY.slice(0,4)+'-01-01',end:TODAY.slice(0,4)+'-12-31'};if(state.month==='自定义')range={start:core.rangeStart,end:core.rangeEnd};
 const m=C.monthly(range.start,range.end),row=(name,sub,date)=>'<div class="summary-row"><div><strong>'+E(name)+'</strong><small> '+E(sub)+'</small></div><span class="right">'+E(date)+'</span></div>',workRows=(rows,completed=true)=>rows.map(r=>row(r.name,'工作 · '+(r.owner||'')+(completed?'':' · 期末未完成'),completed?r.completeDate:r.due||'')).join('')||coreEmpty();
 const labels={purchase:'采购',meeting:'会议',training:'培训',expense:'报销'};
 const lines=['工作摘要（'+range.start+' 至 '+range.end+'）','本期完成工作 '+m.done.length+' 项：'+(m.done.map(r=>r.name).join('、')||'无'),'重点完成情况：'+(m.focus.map(r=>r.name).join('、')||'无'),'长期工作子任务完成 '+m.children.length+' 项：'+(m.children.map(s=>s.parent+' / '+s.name+'（'+s.completed+'）').join('、')||'无'),'未完成 / 跨月 '+m.cross.length+' 项：'+(m.cross.map(r=>r.name).join('、')||'无'),'逾期 '+m.late.length+' 项：'+(m.late.map(r=>r.name).join('、')||'无')];
 for(const t of ['purchase','meeting','training','expense'])lines.push(labels[t]+'完成 '+m.modules[t].length+' 项：'+(m.modules[t].map(r=>r.name).join('、')||'无'));
 m.funds.forEach(f=>lines.push(f.name+'：本期支出 ¥ '+(f.period??'—')+'，期末累计 ¥ '+(f.periodEnd??'—')+'；当前累计 ¥ '+(f.used??'—')+' / 预算 ¥ '+(f.budget??'—')+'；本期/期末截至 '+(range.end>TODAY?TODAY:range.end)+'；未关闭项目；按当前有效记录及可信发生日期回算'));
 core.summaryText=lines.join('\n');
 const custom=state.month==='自定义'?'<div class="b2-range ui-adjust-custom"><label for="core-range-start">开始日期 <input class="input" id="core-range-start" type="date" value="'+core.rangeStart+'"></label><label for="core-range-end">结束日期 <input class="input" id="core-range-end" type="date" value="'+core.rangeEnd+'"></label>'+btn('应用日期范围',null,'core-range-apply')+'</div>':'';
 const businessRows=t=>m.modules[t].map(r=>row(r.name,r.amount?'¥ '+r.amount:'',r.completeDate)).join('')||coreEmpty();
 return '<div class="ui-adjust-monthly">'+header('月度摘要','回顾阶段工作进展、完成情况和下一步计划。')+'<div class="toolbar"><div class="toolbar-left tabs">'+['本月','上月','本季度','本年度','自定义'].map(t=>'<button class="tab '+(state.month===t?'active':'')+'" data-action="core-period" data-value="'+t+'">'+t+'</button>').join('')+'</div><div class="toolbar-right"><span class="muted" id="core-period-label">'+range.start+' 至 '+range.end+'</span></div></div>'+custom+
 metrics([{label:'完成工作',value:m.done.length+' 项',foot:'仅工作类记录',icon:'checkCircle'},{label:'未完成',value:m.pending.length+' 项',foot:'截至所选期末',icon:'clock'},{label:'逾期',value:m.late.length+' 项',foot:'截至所选期末',icon:'alert',tone:'alert'},{label:'本期支出',value:'¥ '+(m.funds.some(f=>f.period===null)?'—':m.funds.reduce((sum,f)=>sum+f.period,0).toLocaleString()),foot:'未关闭项目 · 可信发生日期',icon:'wallet'}])+
 '<div class="monthly-grid"><div>'+section('本期完成',workRows(m.done),'<a class="text-link" href="ledger.html">查看全部 '+I('chevron','sm')+'</a>',m.done.length+' 项工作')+
 section('仍需推进','<div class="split-list-title">未完成 / 跨月 · '+m.cross.length+' 项</div>'+workRows(m.cross,false)+'<div class="split-list-title">逾期 · '+m.late.length+' 项</div>'+workRows(m.late,false),'','截至所选期末')+
 section('工作摘要','<pre class="note-area b2-summary-text" id="core-summary-text">'+E(core.summaryText)+'</pre>',btn('复制为工作记录','file','summary-copy'))+'</div><aside>'+
 section('长期目标进展',D.goals.slice(0,2).map(g=>'<div class="brief-list"><div class="brief-row"><strong>'+E(g.name)+'</strong><small>'+g.progress+'%</small></div>'+progress(g.progress,'目标进度')+'</div>').join(''),'<a class="text-link" href="goals.html">查看全部 '+I('chevron','sm')+'</a>')+
 section('项目经费使用进度','<div class="brief-list">'+m.funds.map(f=>'<div class="brief-row"><strong>'+E(f.name)+progress(f.pct??0,f.pct===null?'—':f.pct.toFixed(1)+'%')+'<small>本期支出 ¥ '+(f.period===null?'—':f.period.toLocaleString())+'<br>期末累计 ¥ '+(f.periodEnd??'—')+'<br>当前累计 ¥ '+(f.used??'—')+' / 预算 ¥ '+(f.budget===null?'—':f.budget.toLocaleString())+'</small></strong></div>').join('')+'</div>','', '未关闭项目 · 本期/期末截至 '+(range.end>TODAY?TODAY:range.end)+'；当前记录回算')+
 section('采购',businessRows('purchase'),'',m.modules.purchase.length+' 项完成')+section('报销',businessRows('expense'),'',m.modules.expense.length+' 项完成')+
 section('会议与培训','<div class="split-list-title">会议 · '+m.modules.meeting.length+' 场完成</div>'+businessRows('meeting')+'<div class="split-list-title">培训 · '+m.modules.training.length+' 次完成</div>'+businessRows('training'))+
 section('重点完成情况',workRows(m.focus))+section('长期工作子任务完成',m.children.map(s=>row(s.name,s.parent,s.completed)).join('')||coreEmpty(),'','计入完成日期所在月份')+
 section('下一周期重点','<ol class="number-list">'+C.weeklyFocus.map(id=>D.work.find(r=>r.id===id)).filter(Boolean).map(r=>'<li>'+E(r.name)+'</li>').join('')+'</ol>')+'</aside></div></div>';
}
function coreSubtasks(r){return '<div class="b2-subtasks" data-parent="'+E(r.id)+'">'+r.sub.map((s,i)=>'<div class="b2-subtask-row" draggable="true" data-parent="'+E(r.id)+'" data-sub="'+E(s.id)+'"><span class="b2-drag-handle" aria-label="拖拽排序">⋮⋮</span><button class="icon-button ghost" data-action="core-sub-toggle" data-parent="'+E(r.id)+'" data-id="'+E(s.id)+'" aria-label="'+(s.done?'取消完成':'完成')+' '+E(s.name)+'">'+I(s.done?'checkCircle':'check')+'</button><div class="b2-subtask-main"><strong>'+E(s.name)+'</strong><small>开始 '+E(s.start||'—')+' · 截止 '+E(s.due||'—')+' · 完成 '+E(s.completed||'—')+'</small></div>'+status(s.done?'已完成':'未开始')+'<div class="cell-actions"><button class="icon-button ghost" data-action="core-sub-up" data-parent="'+E(r.id)+'" data-id="'+E(s.id)+'" aria-label="上移 '+E(s.name)+'" '+(i===0?'disabled':'')+'>↑</button><button class="icon-button ghost" data-action="core-sub-down" data-parent="'+E(r.id)+'" data-id="'+E(s.id)+'" aria-label="下移 '+E(s.name)+'" '+(i===r.sub.length-1?'disabled':'')+'>↓</button>'+iconBtn('edit','core-sub-edit','编辑子任务 '+s.name,'data-parent="'+E(r.id)+'" data-id="'+E(s.id)+'"')+iconBtn('trash','core-sub-delete','删除子任务 '+s.name,'data-parent="'+E(r.id)+'" data-id="'+E(s.id)+'"')+'</div></div>').join('')+'<div class="b2-subtask-foot">'+btn('新增子任务','plus','core-sub-add','','data-parent="'+E(r.id)+'"')+'<small>拖拽或使用 ↑ ↓ 调整顺序</small></div></div>';}
function work(){
 const tabs=['全部','工作','采购','合同','报销','会议','培训','委托','经费'],active=C.active();
 const rows=active.filter(r=>(state.tab==='全部'||r.type===state.tab)&&(!state.status||state.status==='全部'||lifecycle(C.business(r))===state.status)&&(!state.owner||state.owner==='全部'||r.owner===state.owner)&&(!state.category||state.category==='全部'||(Array.isArray(r.category)?r.category.includes(state.category):r.category===state.category))&&(!state.query||[r.name,r.source,r.category,r.owner].join(' ').includes(state.query)));
 const filters=state.filter?'<div class="filter-panel b2-work-filters">'+[['关键词','query'],['状态','status'],['经办人','owner'],['工作类别','category']].map(([label,key])=>'<div class="form-group"><label class="field-label" for="core-filter-'+key+'">'+label+'</label><div class="b2-filter-control">'+(key==='query'?'<input class="input" id="core-filter-query" data-core-filter="query" value="'+E(state.query)+'">':'<select class="select" id="core-filter-'+key+'" data-core-filter="'+key+'"><option value="全部">全部</option>'+(key==='status'?['未开始','进行中']:key==='owner'?[...new Set(active.map(r=>r.owner).filter(Boolean))]:['报告','会议','审批','调研','培训','材料']).map(v=>'<option '+(state[key]===v?'selected':'')+'>'+E(v)+'</option>').join('')+'</select>')+iconBtn('close','core-filter-clear','清除'+label,'data-value="'+key+'"')+'</div></div>').join('')+'</div>':'';
 const tr=rows.map(r=>'<tr class="'+(state.expanded===r.id?'work-row-open':'')+'" data-work-id="'+E(r.id)+'"><td><div class="work-name">'+(r.type==='工作'?dot(r.priority):'')+'<span class="cell-main">'+E(r.name)+'</span></div></td><td>'+E(r.type)+'</td><td>'+E(r.owner||'—')+'</td><td>'+E(C.fact(r))+'</td><td>'+status(lifecycle(C.business(r)))+'</td><td>'+(r.type==='工作'&&r.sub?.length?progress(r.pct,r.progress):'—')+'</td><td><div class="cell-actions">'+(r.type==='工作'&&r.sub?.length?iconBtn('chevron','expand','展开子任务','data-id="'+E(r.id)+'"'):'<span class="expand-spacer" aria-hidden="true"></span>')+iconBtn('eye','detail','查看详情','data-type="work" data-id="'+E(r.id)+'"')+iconBtn('edit','edit','编辑','data-type="work" data-id="'+E(r.id)+'"')+iconBtn('refresh','status','状态','data-type="work" data-id="'+E(r.id)+'"')+iconBtn('trash','delete','删除','data-type="work" data-id="'+E(r.id)+'"')+relationButton('work',r.id)+'</div></td></tr>'+(state.expanded===r.id&&r.type==='工作'&&r.sub?.length?'<tr class="subtasks-row"><td colspan="7">'+coreSubtasks(r)+'</td></tr>':'')).join('');
 return header('待办 / 工作','查看所有业务的未结束事项；工作子任务在列表维护。',btn('新增子任务','plus','core-sub-add'))+'<div class="work-summary"><span>未完成 <strong>'+active.length+'</strong></span><span>进行中 <strong>'+active.filter(r=>lifecycle(C.business(r))==='进行中').length+'</strong></span><span>临期 <strong>'+C.near().length+'</strong></span><span>逾期 <strong>'+C.overdue().length+'</strong></span><a class="text-link" href="ledger.html">历史工作</a></div>'+toolbar(tabs)+filters+'<div class="work-table">'+table(['事项','业务','经办人','截止日期','状态','子任务进度','操作'],tr)+'</div>';
}
function ledger(){
 const rows=D.ledger.filter(r=>(state.tab==='全部'||r.state===state.tab)&&matchesFilters(r)&&(!state.query||r.name.includes(state.query)));
 const filters=historyFilters();
 const filtered=rows.filter(r=>['start','due','completed'].every(k=>{const d=k==='completed'?r.completeDate:r[k];return (!state[k+'From']||d>=state[k+'From'])&&(!state[k+'To']||d<=state[k+'To']);}));
 historyVisible=filtered;
 const tr=filtered.map(r=>'<tr><td>'+dot(r.priority)+'</td><td>'+E(r.end||'—')+'</td><td class="cell-main">'+E(r.name)+'</td><td>'+E(asArray(r.source).join('、'))+'</td><td>'+E(asArray(r.category).join('、'))+'</td><td>'+E(r.owner)+'</td><td>'+E(r.start||'—')+'</td><td>'+E(r.due||'—')+'</td><td>'+status(r.state)+'</td><td><div class="b3-history-actions">'+iconBtn('chevron','formal-history-expand',(state.expanded===r.id?'收起':'展开')+'子任务 '+r.name,'data-id="'+E(r.id)+'"')+actions('ledger',r.id)+'</div></td></tr>'+(state.expanded===r.id?'<tr class="subtasks-row"><td colspan="'+(bulk.ledger?.active?11:10)+'">'+coreSubtasks(r)+'</td></tr>':'')).join('');
 return header('工作','查询、复盘已完成或已关闭的工作；子任务在列表展开维护。',btn('导出','download','formal-history-export'))+metrics([{label:'历史工作',value:D.ledger.length+' 项',icon:'archive'},{label:'已完成',value:D.ledger.filter(r=>r.state==='已完成').length+' 项',icon:'checkCircle'},{label:'已关闭',value:D.ledger.filter(r=>r.state==='已关闭').length+' 项',icon:'file'},{label:'本月完成',value:D.ledger.filter(r=>r.state==='已完成'&&r.completeDate.startsWith(TODAY.slice(0,7))).length+' 项',icon:'calendar'}])+toolbar(['全部','已完成','已关闭'],'',searchBox('搜索工作名称'))+filters+table(['','完成日期','工作名称','来源','分类','经办人','开始日期','截止日期','状态','操作'],tr,'ledger');
}
let historyVisible=[];
const historyMulti=new Set();
function historyFilters(){
 if(!state.filter)return '';
 const definitions=[{key:'workType',label:'类型',kind:'select',values:['工作','重点工作','周期工作']},{key:'status',label:'状态',kind:'select',values:['未开始','进行中','已完成','已关闭']},{key:'priority',label:'优先级',kind:'select',values:S.priorities},{key:'source',label:'来源',kind:'multi',values:[...new Set(D.ledger.flatMap(r=>asArray(r.source)))]},{key:'category',label:'分类',kind:'multi',values:[...new Set(D.ledger.flatMap(r=>asArray(r.category)))]},...['start','due','completed'].flatMap(key=>['From','To'].map(bound=>({key:key+bound,label:({start:'开始日期',due:'截止日期',completed:'完成日期'}[key])+(bound==='From'?'从':'至'),kind:'date'})))];
 return '<div class="filter-panel b2-work-filters">'+definitions.map(f=>{const id='b3-filter-'+f.key,v=state[f.key]||'',attr='data-history-filter="'+f.key+'"';let body='';if(f.kind==='select')body='<select class="select" id="'+id+'" '+attr+'><option value="全部">全部</option>'+f.values.map(x=>{const [val,label]=Array.isArray(x)?x:[x,x];return '<option value="'+E(val)+'" '+(v===val?'selected':'')+'>'+E(label)+'</option>';}).join('')+'</select>';else if(f.kind==='multi')body='<div class="b3-filter-multi"><button class="select" id="'+id+'" data-action="formal-history-multi" data-key="'+f.key+'" aria-expanded="'+historyMulti.has(f.key)+'">'+E(v&&v!=='全部'?asArray(v).join('、'):'全部')+I('chevron')+'</button>'+(historyMulti.has(f.key)?'<div class="b3-filter-options">'+f.values.map(x=>'<label><input type="checkbox" '+attr+' value="'+E(x)+'" '+(asArray(v).includes(x)?'checked':'')+'> '+E(x)+'</label>').join('')+'</div>':'')+'</div>';else body='<input class="input" id="'+id+'" type="date" '+attr+' value="'+E(v)+'">';return '<div class="form-group"><label class="field-label" for="'+id+'">'+E(f.label)+'</label><div class="b2-filter-control">'+body+iconBtn('close','formal-history-filter-clear','清除'+f.label,'data-key="'+f.key+'"')+'</div></div>';}).join('')+'<div class="form-group">'+btn('清除条件','close','formal-history-clear')+'</div></div>';
}

function goals(){
 C.refreshGoals();
 const rows=D.goals.filter(r=>(state.tab==='全部'||lifecycle(r)===state.tab)&&(!state.query||r.name.includes(state.query)));
 const tr=rows.map(r=>'<tr><td><div class="work-name">'+(C.linked(r.id).length?iconBtn('chevron','core-goal-expand','展开关联记录','data-id="'+E(r.id)+'"'):'<span class="expand-spacer"></span>')+'<span class="cell-main">'+E(r.name)+'<small class="cell-sub">'+E(r.note)+'</small></span></div></td><td>'+progress(r.progress,r.progress+'%')+'</td><td>'+E(r.subs)+'<span class="cell-sub">'+r.linkedCount+' 条关联记录</span></td><td>'+E(r.owner)+'</td><td>'+status(lifecycle(r))+'</td><td>'+E(r.due)+'</td><td>'+actions('goals',r.id)+'</td></tr>'+(core.goalOpen===r.id?'<tr class="subtasks-row"><td colspan="7"><div class="brief-list"><p class="field-hint">关联记录结束后自动计入进度；同一工作周期组按一项计数。</p>'+C.linked(r.id).map(w=>'<div class="brief-row"><strong>'+E(w.name)+'<small>'+E(w.type||'历史工作')+(w.type==='工作'&&w.sub?.length?' · 子任务 '+w.done+' / '+w.sub.length:'')+'</small></strong>'+status(lifecycle(C.business(w)))+iconBtn('eye','detail','查看关联记录','data-type="'+(D.work.includes(w)?'work':'ledger')+'" data-id="'+E(w.id)+'"')+'</div>').join('')+'</div></td></tr>':'')).join('');
 return header('长期目标','目标进度由关联记录的结束状态自动汇总。')+'<div class="toolbar"><div class="toolbar-left tabs">'+['全部','未开始','进行中','已完成','已关闭'].map(t=>'<button class="tab '+(state.tab===t?'active':'')+'" data-action="tab" data-value="'+t+'">'+t+'</button>').join('')+'</div><div class="toolbar-right">'+searchBox('搜索目标名称')+'</div></div>'+table(['目标名称','进度','已结束 / 总项数','经办人','状态','计划完成','操作'],tr);
}
function businessHooks(){return {D,S,C,state,bulk,E,I,btn,iconBtn,header,metrics,table,actions,status,toolbar,searchBox,modal,drawer,render,toast,closeOverlay,fieldsDetail,contextMarkup,recordTools,record,readEditor,redrawEditor,openDetail,openState,smartForm,smartInput,get page(){return page;},get editor(){return editor;},get smartContext(){return smartContext;},get stateContext(){return stateContext;},get relationContext(){return relationContext;}};}
const pages={dashboard,monthly,work,ledger,goals,config:()=>window.G2B5UI.render('config',businessHooks()),settings:()=>window.G2B5UI.render('settings',businessHooks()),training:()=>window.G2B3_UI.render('training',businessHooks()),meeting:()=>window.G2B3_UI.render('meeting',businessHooks()),handover:()=>window.G2B3_UI.render('handover',businessHooks()),...Object.fromEntries(['purchase','contract','expense','fund','agency','inspiration'].map(type=>[type,()=>window.G2B4_UI.render(type,businessHooks())]))};
function render(){
 if(!window.G2B5_BOOT_VERIFIED||window.G2B5_BOOT_VERIFIED!==window.G2B5Boot?.buildId)throw Error('BUILD_NOT_VERIFIED');
 const recoveryOnly=window.G2B5_APP?.gateway.requiresRecovery;
 if(!recoveryOnly)window.G2B2_APP.refresh();
 const focused=document.activeElement,keys=['action','type','id','value','key','group','parent','sub'];
 const selector=focused?.dataset.action?keys.filter(k=>focused.dataset[k]!==undefined).map(k=>'[data-'+k+'="'+CSS.escape(focused.dataset[k])+'"]').join(''):null;
 document.getElementById('page-root').innerHTML=recoveryOnly&&!['config','settings'].includes(page)?'<p role="alert">提交状态未确认，需要恢复检查。普通业务写入已阻止，请进入设置完成恢复。</p>':(pages[page]||dashboard)();routeLinks();const badge=document.querySelector('.nav-count');if(badge)badge.textContent=recoveryOnly?'—':C.active().length;document.title=names[page]+' · Workbench';
 if(selector&&!focused.isConnected){const target=document.getElementById('page-root').querySelector(selector);if(target?.getClientRects().length)target.focus();else focusPageFallback();}
 if(page==='settings'){const label=document.createElement('p');label.className='muted';label.dataset.buildId=window.G2B5Boot.buildId;label.textContent='构建 '+window.G2B5Boot.buildId+' · schemaVersion 2 · exchangeRevision 1';document.getElementById('page-root').append(label);}
}
function toast(message){const root=document.getElementById('toast-stack');const el=document.createElement('div');el.className='toast';el.textContent=message;root.append(el);setTimeout(()=>el.remove(),3200)}
let overlayTrigger=null,editor=null,stateContext=null,relationContext=null,smartContext=null;
function focusPageFallback(){const controls=[...document.querySelectorAll('#page-root button:not([disabled])'),...document.querySelectorAll('.topbar button:not([disabled])')];controls.find(e=>e.getClientRects().length&&!e.closest('[inert]'))?.focus();}
function closeOverlay(){document.getElementById('overlay-root').innerHTML='';document.querySelector('.app-shell').inert=false;let target=overlayTrigger;if(target&&!target.isConnected&&target.dataset.id)target=[...document.querySelectorAll('[data-action]')].find(x=>x.dataset.action===target.dataset.action&&x.dataset.type===target.dataset.type&&x.dataset.id===target.dataset.id&&x.dataset.parent===target.dataset.parent);if(target?.isConnected&&target!==document.body&&target.getClientRects().length)target.focus();else focusPageFallback();overlayTrigger=null}
function focusOverlay(){if(!overlayTrigger)overlayTrigger=document.activeElement;document.querySelector('.app-shell').inert=true;const root=document.getElementById('overlay-root');root.querySelector('input,select,textarea,button')?.focus()}
function modal(title,body,buttons=''){document.getElementById('overlay-root').innerHTML='<div class="overlay" data-action="close-overlay"></div><div class="modal" role="dialog" aria-modal="true" aria-label="'+E(title)+'"><div class="modal-head"><h2 class="modal-title">'+E(title)+'</h2>'+iconBtn('close','close-overlay','关闭')+'</div><div class="modal-body">'+body+'</div><div class="modal-foot">'+btn('取消',null,'close-overlay')+buttons+'</div></div>';focusOverlay()}
function drawer(title,kicker,body,footer=''){document.getElementById('overlay-root').innerHTML='<div class="overlay" data-action="close-overlay"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="'+E(title)+'"><div class="drawer-head"><div><div class="drawer-kicker">'+E(kicker)+'</div><h2 class="drawer-title">'+E(title)+'</h2></div>'+iconBtn('close','close-overlay','关闭')+'</div><div class="drawer-body">'+body+'</div><div class="drawer-foot">'+btn('关闭',null,'close-overlay')+footer+'</div></aside>';focusOverlay()}
function rawRecord(type,id){return (type==='config'?D.config[state.config||'external']:D[type]||[]).find(r=>G2B1.sameId(r.id,id))}
function record(type,id){const r=rawRecord(type,id);return r?.business||r}
const businessType=(type,r)=>r?.businessType||type;
function syncWorkSummary(type,id){const r=rawRecord(type,id);if(type==='work'&&r?.business){r.name=r.business.name;r.owner=r.business.owner;r.state=lifecycle(r.business)}}
const asArray=v=>Array.isArray(v)?v:(v?[v]:[]);
const iso=v=>{if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))return v;const m=String(v||'').match(/^(\d+)月(\d+)日$/);return m?'2026-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'):''};
const lifecycle=r=>r.state||({'执行中':'进行中','待签':'未开始','申请中':'未开始','审批通过':'进行中','已到货':'已完成','已报销':'已完成','待报销':'进行中'}[r.status])||r.status||'未开始';
function schemaFields(type,r){return S.records[businessType(type,r)]?.fields||[]}
function optionsFor(f,r={}){if(f.type==='goal')return [['','不关联'],...D.goals.map(r=>[r.id,r.name]),...(r.goalId&&!D.goals.some(g=>g.id===r.goalId)?[[r.goalId,'历史目标（未匹配）']]:[])];if(f.scope)return organizationOptions(f.scope).map(x=>x.name);if(f.optionsFrom==='funds')return [['','不选择'],...D.fund.map(x=>[String(x.id),x.name])];if(f.optionsFrom==='expenses')return [['','独立手工'],...D.expense.map(x=>[String(x.id),x.content||x.name])];if(f.optionsFrom==='fundSubcategories')return [['','不选择'],...(D.fund.find(x=>G2B1.sameId(x.id,r.fundItem))?.subcategories||[]).map(x=>[String(x.id),x.name])];return f.options||[]}
function organizationOptions(scope){return scope==='organizations'?[...D.config.external,...D.config.internal]:D.config[scope]||[]}
function visibleField(f,r){return !f.visibleWhen||r[f.visibleWhen.key]===f.visibleWhen.value}
function valueText(f,v,r={}){if(v==null||v==='')return '未填写';if(f.type==='goal')return D.goals.find(r=>r.id===v)?.name||'未关联';if(f.type==='select'){const item=optionsFor(f,r).find(x=>Array.isArray(x)&&x[0]===v);if(item)return item[1]}if(Array.isArray(v))return v.join('、');if(typeof v==='boolean')return v?'是':'否';return String(v)}
const numeric=v=>Number(String(v??0).replace(/,/g,''))||0;
function fieldValue(f,r){if(f.computed==='purchaseSubtotal'){const p=G2B4.number(r.price),q=G2B4.number(r.qty),n=p!==null&&q!==null?p*q:null;return n!==null&&p>=0&&q>0&&Number.isSafeInteger(q)&&Number.isFinite(n)?n.toFixed(2):'未知';}if(f.computed==='agencySavings')return numeric(r.budget)>0?((numeric(r.budget)-numeric(r.dealAmount))/numeric(r.budget)*100).toFixed(1)+'%':'0.0%';return r[f.key]}
function collectionValue(f,v){return asArray(v).map((x,i)=>typeof x==='string'?{name:x,done:i<(editor?.draft.done||0)}:x)}
function choiceControl(f,v,key,data){
 const multi=f.type==='multi',opts=[...new Set([...optionsFor(f),...asArray(v)])],label=asArray(v).join('、')||'请选择';
 const scope=f.scope||(f.key==='category'?'category':'external');
 return '<div class="choice-control" data-choice="'+f.key+'"><button type="button" class="select choice-trigger" id="'+key+'" role="combobox" aria-haspopup="dialog" aria-expanded="false" aria-controls="'+key+'-panel" data-action="choice-toggle" data-key="'+f.key+'"><span>'+E(label)+'</span>'+I('chevron')+'</button>'+(multi?'':'<input type="hidden" '+data+' value="'+E(v)+'">')+'<div class="choice-panel" id="'+key+'-panel" role="dialog" aria-label="'+E(f.label)+'选项" hidden><div class="choice-options">'+opts.map(x=>multi?'<label><input type="checkbox" '+data+' value="'+E(x)+'" '+(asArray(v).includes(x)?'checked':'')+'> '+E(x)+'</label>':btn(x,null,'choice-pick','ghost','data-key="'+f.key+'" data-name="'+E(x)+'"')).join('')+'</div>'+btn('输入新名称','plus','choice-new','ghost','data-key="'+f.key+'"')+'<div class="choice-new-name" hidden><label class="field-label" for="'+key+'-new">新'+E(f.label)+'名称</label><input class="input" id="'+key+'-new" data-choice-new="'+f.key+'" autocomplete="off">'+btn('使用此名称',null,'choice-use','','data-key="'+f.key+'"')+btn('保存为常用'+(f.key==='category'?'类别':'单位'),null,'choice-save','','data-key="'+f.key+'" data-scope="'+scope+'"')+'</div>'+(multi?btn('确定',null,'choice-close','','data-key="'+f.key+'"'):'')+'</div></div>';
}
function renderField(f,r,prefix='edit',rowIndex=null,parent=null){
 const key=prefix+'-'+f.key+(rowIndex===null?'':'-'+rowIndex),v=fieldValue(f,r),data=rowIndex===null?'data-field="'+f.key+'"':'data-collection="'+E(parent)+'" data-row="'+rowIndex+'" data-column="'+f.key+'"';
 let control='';
 if(f.type==='collection'){
  const values=collectionValue(f,v);
  control='<div class="collection-list">'+values.map((row,i)=>'<div class="collection-row"><strong>第 '+(i+1)+' 项</strong><div class="form-grid">'+f.columns.map(c=>renderField({...c,readOnly:f.readOnly||c.readOnly},row,'collection',i,f.key)).join('')+'</div>'+(!f.readOnly?btn('移除此项','close','collection-remove','','data-key="'+f.key+'" data-row="'+i+'"'):'')+'</div>').join('')+(!values.length?'<p class="muted">暂无明细</p>':'')+(!f.readOnly?btn('添加明细','plus','collection-add','','data-key="'+f.key+'"'):'<p class="field-hint">子任务在工作列表维护，此处只读。</p>')+'</div>';
 }else if(f.readOnly)control='<div class="readonly-value" '+(f.computed?'data-computed="'+f.key+'" '+data:'')+'>'+E(valueText(f,v,r))+'</div>';
 else if(['select','goal'].includes(f.type)){
  let opts=optionsFor(f,r);if(v&&!opts.some(x=>(Array.isArray(x)?x[0]:x)===v))opts=[...opts,[v,v+'（历史值）']];
  control='<select class="select" id="'+key+'" '+data+'>'+opts.map(x=>{const [value,label]=Array.isArray(x)?x:[x,x||'不选择'];return '<option value="'+E(value)+'" '+(value===v?'selected':'')+'>'+E(label)+'</option>'}).join('')+'</select>';
 }else if(['multi','organization'].includes(f.type)){control=choiceControl(f,v,key,data);if(f.key==='method')control=control.replace(btn('保存为常用单位',null,'choice-save','','data-key="method" data-scope="external"'),'');
 }else if(f.type==='textarea')control='<textarea class="textarea" id="'+key+'" '+data+'>'+E(v)+'</textarea>';
 else if(f.type==='checkbox')control='<input type="checkbox" id="'+key+'" '+data+' '+(v?'checked':'')+'>';
 else control='<input class="input" id="'+key+'" '+data+' type="'+f.type+'" '+(f.type==='number'?'step="'+(f.step??0.01)+'" '+(f.min==null?'':'min="'+f.min+'" '):'')+'value="'+E(f.type==='date'?iso(v):f.type==='number'?(v==null||v===''||!Number.isFinite(Number(String(v).replace(/,/g,'')))?'':Number(String(v).replace(/,/g,''))):v)+'">';
 return '<div class="form-group '+(f.full?'full':'')+'" '+(f.visibleWhen?'data-condition="'+f.key+'" '+(!visibleField(f,r)?'hidden':''):'')+'><label class="field-label" '+(f.type!=='collection'?'for="'+key+'"':'')+'>'+E(f.label)+'</label>'+control+(f.hint?'<p class="field-hint">'+E(f.hint)+'</p>':'')+'</div>';
}
function fieldsDetail(type,r){return schemaFields(type,r).filter(f=>f.key!=='sub'&&visibleField(f,r)).map(f=>{
 if(f.type==='collection')return '<div class="detail-section"><h3>'+E(f.label)+'</h3>'+asArray(r[f.key]).map(x=>typeof x==='string'?'<p>'+E(x)+'</p>':detailList(f.columns.map(c=>[c.label,valueText(c,fieldValue(c,x),x)]))).join('')+'</div>';
 return detailList([[f.label,valueText(f,fieldValue(f,r),r)]]);
 }).join('')+''+(['fund','fundRecords'].includes(type)?'':relationInfo(type,r.id))}
function relationInfo(type,id){const links=D.relations.filter(x=>x.fromType===type&&x.fromId===id);return '<section class="detail-section relation-info"><h3>关联信息 · '+links.length+' 条</h3>'+(links.length?links.map(x=>{const target=record(x.toType,x.toId);return '<div class="relation-row"><span>'+E(names[x.toType]||'业务记录')+' · '+E(target?.name||target?.content||'记录已移出')+'</span>'+iconBtn('eye','relation-view','查看关联记录','data-type="'+x.toType+'" data-id="'+E(x.toId)+'"')+'</div>'}).join(''):'<p class="muted">暂无关联信息</p>')+'</section>'}
function contextMarkup(type,r){
 if(['fund','fundRecords'].includes(businessType(type,r)))return '';
 const entries=[];if(r.goalId)entries.push(['关联目标',D.goals.find(g=>g.id===r.goalId)?.name||'关联目标已移出']);
 if(r.incomplete?.length)entries.push(['信息不完整',r.incomplete.join('；')]);
 if(lifecycle(r)==='已关闭'&&r.closeReason)entries.push(['关闭原因',r.closeReason]);
 if(S.cycleModules.includes(businessType(type,r))&&(!r.type||r.type==='工作')&&r.cycle)entries.push(['周期信息',r.cycle]);
 if(lifecycle(r)==='已完成'&&r.completeDate)entries.push(['完成日期',r.completeDate]);
 if(lifecycle(r)==='已关闭'&&r.closeDate)entries.push(['关闭日期',r.closeDate]);
 const due=iso(r.due);if(due&&['未开始','进行中'].includes(lifecycle(r))){const days=Math.round((Date.parse(due)-Date.parse(TODAY))/86400000);if(days<0)entries.push(['截止事实','已逾期 '+(-days)+' 天（日期基准 '+TODAY+'）']);else if(days<=3)entries.push(['截止事实','临期，剩余 '+days+' 天']);}
 return entries.length?'<div class="business-context">'+detailList(entries)+'</div>':'';
}
function recordTools(type,id){return (S.statusModules.includes(businessType(type,record(type,id)))?btn('状态','refresh','status','','data-type="'+type+'" data-id="'+E(id)+'"'):'')+(type!=='config'?relationButton(type,id,false):'')}
function openDetail(type,id,edit=false){
 const r=record(type,id);if(!r)return;
 if(['meeting','training','handover'].includes(type)&&!edit&&page===type){closeOverlay();state.detail={type,id};render();document.querySelector('.detail-pane')?.scrollIntoView({block:'nearest'});document.querySelector('.detail-pane button')?.focus();return}
 const fields=schemaFields(type,r).filter(f=>!(type==='config'&&state.config==='category'&&f.key==='short'));
 if(edit)editor={type,id,draft:structuredClone(r),fields};
 const body=edit?'<div class="form-grid">'+fields.map(f=>renderField(f,editor.draft)).join('')+''+'</div><p class="field-hint">保存仅作用于本机记录。</p>':fieldsDetail(type,r)+(['fund','fundRecords'].includes(type)?'':status(lifecycle(r)))+contextMarkup(type,r);
 drawer(r.name||r.content||'配置项',edit?'编辑':'记录详情',body,edit?btn('保存',null,'edit-save','primary'):btn('编辑','edit','edit','','data-type="'+type+'" data-id="'+E(id)+'"')+recordTools(type,id));focusOverlay();
}
function openState(type,id){
 const r=record(type,id);if(!r||!S.statusModules.includes(businessType(type,r)))return;stateContext={type,id};
 const cycle=S.cycleModules.includes(businessType(type,r))&&(!r.type||r.type==='工作');
 modal('状态操作',contextMarkup(type,r)+'<div class="form-grid"><div class="form-group full"><label class="field-label" for="lifecycle-state">状态</label><select id="lifecycle-state" class="select">'+['未开始','进行中','已完成','已关闭'].map(x=>'<option '+(lifecycle(r)===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="form-group full" id="close-reason-group" '+(lifecycle(r)!=='已关闭'?'hidden':'')+'><label class="field-label" for="close-reason">关闭原因</label><textarea id="close-reason" class="textarea">'+E(r.closeReason)+'</textarea></div>'+(cycle?'<div class="form-group full"><label><input id="cycle-enabled" type="checkbox" '+(r.cycle?'checked':'')+'> 周期工作</label></div><div id="cycle-fields" class="form-group full" '+(!r.cycle?'hidden':'')+'><label class="field-label" for="cycle-interval">周期间隔</label><input class="input" id="cycle-interval" type="number" min="1" value="'+Number(r.cycleInterval||1)+'"><label class="field-label" for="cycle-unit">周期单位</label><select class="select" id="cycle-unit">'+['天','周','月','年'].map(x=>'<option '+(r.cycleUnit===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>':'')+'</div><p class="field-hint">变更后可在详情中查看状态。</p>',btn('应用状态',null,'state-save','primary'));focusOverlay();stateContext.cycleInitial=cycleSnapshot();
}
function openRelations(type,id){relationContext={type,id};const r=record(type,id);if(!r)return;
 const rel=D.relations.filter(x=>x.fromType===type&&x.fromId===id);
 modal('关联业务 · '+(r.name||r.content),'<p>当前来源：'+E(names[type]||'经费开支')+' / '+E(r.name||r.content)+'</p><div class="relation-list">'+(rel.length?rel.map(x=>{const target=record(x.toType,x.toId);return '<div class="relation-row"><span>'+E(names[x.toType])+' · '+E(target?.name||target?.content||'记录已移出')+'</span>'+btn('查看',null,'relation-view','','data-type="'+x.toType+'" data-id="'+x.toId+'"')+btn('移出关联',null,'relation-remove','','data-type="'+x.toType+'" data-id="'+x.toId+'"')+'</div>'}).join(''):'<p class="muted">暂无关联</p>')+'</div>',btn('关联已有','link','relation-candidates')+btn('新建关联','plus','relation-new','primary'));focusOverlay();
}
function relationCandidates(){
 modal('关联已有','<label class="field-label" for="relation-query">筛选候选</label><input class="input" id="relation-query" placeholder="按名称筛选候选记录"><label class="field-label" for="relation-type">模块</label><select class="select" id="relation-type"><option value="">全部</option>'+Object.keys(G2B1.MATTER_TYPES).map(x=>'<option value="'+x+'">'+E(names[x])+'</option>').join('')+'</select><div id="relation-candidates"></div>',btn('返回关联',null,'relation-back'));renderCandidates();focusOverlay();
}
function renderCandidates(){const source=record(relationContext.type,relationContext.id),q=document.getElementById('relation-query').value,kind=document.getElementById('relation-type').value;const rows=matterSearchCandidates(source._key,source._sourceId,{keyword:q,type:kind?G2B1.MATTER_TYPES[kind]:''});document.getElementById('relation-candidates').innerHTML=rows.length?rows.map(x=>{const t=x.ledger==='todos'?(G2B2.ended(x.record)?'ledger':'work'):Object.keys(G2B2.businessKeys).find(k=>G2B2.businessKeys[k]===x.ledger);return '<div class="relation-row"><span>'+E(names[t])+' · '+E(x.record.name||x.record.content)+'</span>'+btn('关联',null,'relation-add','','data-type="'+t+'" data-id="'+E(x.record.id)+'"')+'</div>';}).join(''):'<p class="muted">无匹配候选</p>';}
function syncMarkup(){return window.G2B5UI.syncMarkup();}
function backupMarkup(){return window.G2B5UI.reminderMarkup();}
function openSearch(){modal('全局搜索','<label class="search-input" style="width:100%">'+I('search')+'<input id="global-query" placeholder="搜索工作、记录、经办人…" aria-label="搜索工作、记录、经办人…"></label><div id="search-results" aria-live="polite"><p class="muted">输入关键词查找记录</p></div>');focusOverlay();document.getElementById('global-query').focus()}
function renderSearch(){const q=document.getElementById('global-query').value.trim().toLocaleLowerCase(),terms=q.split(/\s+/).filter(Boolean);
 const searchable=v=>Array.isArray(v)?v.map(searchable).join(' '):v&&typeof v==='object'?['name','text','content','note','owner','supplier'].map(k=>searchable(v[k])).join(' '):typeof v==='string'?v:'';
 const hits=terms.length?Object.entries(S.searchFields).flatMap(([type,fields])=>(D[type]||[]).filter(r=>(type!=='work'||r._key==='todos'&&!G2B2.ended(r))&&terms.every(t=>fields.map(f=>searchable(r[f])).join(' ').toLocaleLowerCase().includes(t))).map(r=>({type,r}))):[];
 document.getElementById('search-results').innerHTML=!q?'<p class="muted">输入关键词查找记录</p>':hits.length?'<p>找到 '+hits.length+' 条记录</p>'+hits.map(x=>'<a class="search-hit" href="'+(x.type==='fundRecords'?'fund':x.type)+'.html?'+(fixture?'scene=b1&':'')+'record='+encodeURIComponent(x.r.id)+'&type='+x.type+'"><strong>'+E(x.r.name||x.r.content)+'</strong><span>'+E(names[x.type]||'经费开支')+'</span></a>').join(''):'<div class="empty-state"><strong>没有找到相关记录</strong>请尝试其他关键词。</div>';routeLinks();
}
let businessPresenter,threePagePresenter;
function smartInput(){
 modal('智能录入','<p class="muted">普通新增统一使用智能录入。</p><div class="config-grid">'+S.smartTypes.map(([type,label,icon])=>'<button class="config-tile" data-action="smart-type" data-value="'+type+'"><span class="tile-icon">'+I(icon)+'</span><strong>'+label+'</strong></button>').join('')+'</div>');focusOverlay();
}
function smartForm(type,linked=false){const item=S.smartTypes.find(x=>x[0]===type);smartContext={type,linked};
 const r=linked?record(relationContext.type,relationContext.id):null;
 const initial=type==='inspiration'?['当前灵感']:['未开始','进行中','已完成','已关闭'];
 drawer(item[1]+' · '+(linked?'新建关联':'智能录入'),linked?'来源：'+(names[relationContext.type]||'业务')+' / '+(r.name||r.content):'统一轻量录入','<div class="form-grid"><div class="form-group full"><label class="field-label" for="smart-name">名称 / 标题</label><input class="input" id="smart-name" placeholder="填写事项"></div><div class="form-group"><label class="field-label" for="smart-owner">经办人</label><input class="input" id="smart-owner"></div><div class="form-group"><label class="field-label" for="smart-state">初始状态</label><select class="select" id="smart-state">'+initial.map(x=>'<option>'+x+'</option>').join('')+'</select></div><div class="form-group full"><label class="field-label" for="smart-goal">关联目标</label><select class="select" id="smart-goal"><option value="">不关联</option>'+D.goals.map(g=>'<option value="'+E(g.id)+'" '+(r?.goalId===g.id?'selected':'')+'>'+E(g.name)+'</option>').join('')+'</select></div></div><p class="field-hint">'+(linked?'创建后保留当前来源关系，仅作用于本机记录。':'先录入名称、经办人和状态，保存后可补充详情。')+'</p>',btn(linked?'创建并关联':'保存',null,'smart-save','primary'));focusOverlay();
}

function clearFilters(){state.query='';state.status='全部';state.owner='全部';state.source='全部';state.category='全部';state.type='全部';state.fund='全部';state.supplier='全部';render()}
document.body.innerHTML='<div id="app"></div>';document.getElementById('app').innerHTML=shell();render();
/* Formal action handlers, inserted into the frozen G1.5 renderer below. */
function cycleSnapshot(){return JSON.stringify(['cycle-enabled','cycle-interval','cycle-unit'].map(id=>[id,document.getElementById(id)?.type==='checkbox'?document.getElementById(id).checked:document.getElementById(id)?.value]));}
function routeLinks(){for(const a of document.querySelectorAll('a[href]')){const match=a.getAttribute('href').match(/^([^/?#]+)\.html(?:\?(.*))?$/);if(!match)continue;const type=match[1];if(['dashboard','work','ledger','goals','monthly','training','meeting','handover','purchase','contract','expense','fund','agency','inspiration','config','settings'].includes(type)){const q=new URLSearchParams(match[2]||'');a.href='#'+type+(q.get('record')?'?record='+encodeURIComponent(q.get('record'))+(q.get('type')?'&type='+encodeURIComponent(q.get('type')):''):'');}else a.href='index.html?legacy=1#'+type;}}
async function formalAction(action,el){
 const id=el.dataset.id,type=el.dataset.type,parent=el.dataset.parent,value=el.dataset.value,A=window.G2B2_APP,Q=G2B2;
 const refresh=()=>{A.refresh();render();};
 const row=(t,i)=>record(t,i);
 try{
  el.disabled=true;el.setAttribute('aria-busy','true');
  if(await window.G2B5UI?.action(action,el,businessHooks()))return true;
  if(await window.G2B4_UI?.action(action,el,businessHooks()))return true;
  if(await window.G2B3_UI?.action(action,el,businessHooks()))return true;
  if(['detail','edit','status'].includes(action)){const r=row(type,id);if(r&&r._key!=='todos'){if(action==='detail'){drawer(r.name||r.content||'业务记录','记录详情',detailList([['状态',r.state],['日期',r.date||r.startDate||r.due||'—'],['开始时间',r.startTime||'—'],['结束时间',r.endTime||'—'],['完成日期',r.completeDate||'—']]));}else location.href='index.html?legacy=1#'+(r.businessType||type);return true;}}
  if(action==='smart-type'&&!['work','goals'].includes(value)){location.href='index.html?legacy=1#smart:'+value;return true;}
  if(action==='smart-save'){const title=document.getElementById('smart-name').value.trim(),goal=smartContext.type==='goals';await A.store.create({name:title,owner:document.getElementById('smart-owner').value,state:document.getElementById('smart-state').value,goalId:document.getElementById('smart-goal').value},{goal});closeOverlay();refresh();toast(G2B5_APP.feedback('已保存'));return true;}
  if(action==='edit-save'){readEditor();const r=row(editor.type,editor.id);await A.store.edit(r._sourceId,editor.draft);const t=editor.type,i=editor.id;closeOverlay();refresh();openDetail(t,i);toast(G2B5_APP.feedback('已保存'));return true;}
  if(action==='state-save'){const r=row(stateContext.type,stateContext.id),t=stateContext.type,i=stateContext.id,touched=stateContext.cycleInitial!==cycleSnapshot(),enabled=document.getElementById('cycle-enabled')?.checked,n=Number(document.getElementById('cycle-interval')?.value||1),unit=document.getElementById('cycle-unit')?.value;
   if(touched&&enabled&&(!Number.isInteger(n)||n<1))throw Error('周期间隔必须为正整数');
   await A.store.state(r._sourceId,document.getElementById('lifecycle-state').value,{reason:document.getElementById('close-reason').value,cycleTouched:touched,recurrence:enabled?String(n)+({'天':'d','周':'w','月':'m','年':'y'}[unit]):'none'});closeOverlay();refresh();openDetail(t==='work'&&G2B2.ended(A.store.get(r._sourceId))?'ledger':t==='ledger'&&!G2B2.ended(A.store.get(r._sourceId))?'work':t,i);toast(G2B5_APP.feedback('已应用状态'));return true;}
  if(action==='delete'){const r=row(type,id);if(r._key!=='todos'){location.href='index.html?legacy=1#'+r.businessType;return true;}pendingDelete=[r._sourceId];modal('删除记录','确认删除这条记录？',btn('确认删除','trash','formal-delete-confirm','danger'));return true;}
  if(action==='formal-delete-confirm'){await G2B5_APP.gateway.batch('B2.deleteMany',()=>{for(const i of pendingDelete)A.store.delete(i);});closeOverlay();refresh();toast('已删除');return true;}
  if(action==='bulk-delete'){const b=bulk[el.dataset.group],ids=b.visible.filter(i=>b.selected.has(i));if(!ids.length)throw Error('请先选择记录');pendingDelete=ids.map(i=>row(el.dataset.group,i)._sourceId);modal('删除所选','确认删除 '+ids.length+' 条记录？',btn('确认删除',null,'formal-delete-confirm','danger'));return true;}
  if(action==='choice-save'){const c=el.closest('.choice-control'),name=c.querySelector('[data-choice-new]').value.trim(),key=el.dataset.key;if(!name)throw Error('请先输入名称');readEditor();editor.draft[key]=[...new Set([...asArray(editor.draft[key]),name])];const cfg=A.readConfig(),which=key==='category'?cfg.dictionaries.work_categories:cfg.organizations;if(!which.some(r=>r.name===name)){const newId='ui2-'+Date.now();which.push(key==='category'?{id:newId,name,status:'active',sort_order:which.length}:{id:newId,name,shortName:'',type:'external',scopes:['external','internal'],status:'active',sort_order:which.length});await G2B5_APP.saveConfig(cfg);}A.refresh();redrawEditor();return true;}
  if(action.startsWith('core-sub-')){
   if(action==='core-sub-add'||action==='core-sub-edit'){editCoreSub(parent,action==='core-sub-edit'?id:null);document.getElementById('core-sub-completed').readOnly=true;return true;}
   if(action==='core-sub-save'){const p=document.getElementById('core-sub-parent')?.value||core.subEditor.parent;await A.store.subtask(p,core.subEditor.id===null?'add':'edit',core.subEditor.id,{name:document.getElementById('core-sub-name').value.trim(),start:document.getElementById('core-sub-start').value,due:document.getElementById('core-sub-due').value});closeOverlay();state.expanded=p;refresh();return true;}
   if(action==='core-sub-delete'){modal('删除子任务','确认删除子任务？',btn('确认删除子任务',null,'core-sub-confirm','danger','data-parent="'+E(parent)+'" data-id="'+E(id)+'"'));return true;}
   const kind={'core-sub-toggle':'toggle','core-sub-up':'move','core-sub-down':'move','core-sub-confirm':'delete'}[action];if(kind){await A.store.subtask(parent,kind,id,{delta:action.endsWith('up')?-1:1});if(action==='core-sub-confirm')closeOverlay();state.expanded=parent;refresh();return true;}
  }
  if(action==='relations'){const r=row(type,id);if(r.is_goal){drawer(r.name,'目标关联记录','<div class="brief-list">'+C.linked(id).map(w=>'<div class="brief-row">'+E(w.name)+status(w.state)+'</div>').join('')+'</div>');return true;}relationContext={type,id};openRelations(type,id);return true;}
  if(action==='relation-add'){const source=row(relationContext.type,relationContext.id),target=row(type,id);const result=await linkMatterRecords(source._key,source._sourceId,target._key,target._sourceId);if(!['linked','already-linked'].includes(result?.status))throw Error('关联未完成：'+(result?.status||'未知状态'));refresh();openRelations(relationContext.type,relationContext.id);return true;}
  if(action==='relation-remove'){const target=row(type,id);await unlinkMatterRecord(target._key,target._sourceId);refresh();openRelations(relationContext.type,relationContext.id);return true;}
  if(action==='relation-new'){const source=row(relationContext.type,relationContext.id),keys=LINKED_NEW_PATHS[source._key]||[];if(!keys.length)throw Error('此记录没有已批准的新建关联路径');modal('新建关联','<p>当前来源：'+E(source.name)+'</p><label for="formal-related-type">业务类型</label><select class="select" id="formal-related-type">'+keys.map(key=>'<option value="'+key+'">'+E(LEDGER_META[key].label)+'</option>').join('')+'</select>',btn('继续',null,'formal-related-next','primary'));return true;}
  if(action==='formal-related-next'){const source=row(relationContext.type,relationContext.id),key=document.getElementById('formal-related-type').value;if(!LINKED_NEW_PATHS[source._key]?.includes(key))throw Error('不支持该关联路径');location.href='index.html?legacy=1#linked/'+source._key+'/'+encodeURIComponent(source._sourceId)+'/'+key;return true;}
 }catch(error){toast(error.message);window.G2B5UI?.refreshStatus();return true;}finally{el.disabled=false;el.removeAttribute('aria-busy');}
 return false;
}
let pendingDelete=[];

window.addEventListener('hashchange',()=>{const next=location.hash.slice(1).split('?')[0]||'dashboard';if(!pages[next])return;closeOverlay();document.body.classList.remove('nav-open');page=next;state.tab='全部';state.query='';state.filter=false;state.status='全部';state.owner='全部';state.category='全部';state.source='全部';state.priority='全部';state.workType='全部';['start','due','completed'].forEach(k=>{delete state[k+'From'];delete state[k+'To'];});document.getElementById('app').innerHTML=shell();render();const q=new URLSearchParams(location.hash.split('?')[1]||'');if(q.has('record')||q.get('new')==='1')openHashRecord();});
function readEditor(){
 if(!editor)return;
 for(const f of editor.fields){
  if(f.readOnly||!visibleField(f,editor.draft))continue;
  if(f.type==='collection'){
   const rows=asArray(editor.draft[f.key]);document.querySelectorAll('[data-collection="'+f.key+'"]').forEach(el=>{const c=f.columns.find(x=>x.key===el.dataset.column);if(!c||c.readOnly)return;rows[Number(el.dataset.row)][c.key]=c.type==='checkbox'?el.checked:c.type==='number'?(el.value===''?null:Number(el.value)):el.value});continue;
  }
  const inputs=[...document.querySelectorAll('[data-field="'+f.key+'"]')];if(!inputs.length)continue;
  editor.draft[f.key]=f.type==='multi'?inputs.filter(x=>x.checked).map(x=>x.value):f.type==='checkbox'?inputs[0].checked:f.type==='number'?(inputs[0].value===''?null:Number(inputs[0].value)):inputs[0].value;
 }
}
function redrawEditor(){document.querySelector('.drawer-body .form-grid').innerHTML=editor.fields.map(f=>renderField(f,editor.draft)).join('')+''}
function prepareBusinessEdit(){return true;}
function refreshComputed(){
 if(!editor)return;
 document.querySelectorAll('[data-computed]').forEach(el=>{const collection=el.dataset.collection,f=collection?editor.fields.find(x=>x.key===collection)?.columns.find(x=>x.key===el.dataset.column):editor.fields.find(x=>x.key===el.dataset.computed),r=collection?editor.draft[collection][Number(el.dataset.row)]:editor.draft;if(f)el.textContent=fieldValue(f,r);});
}
let bulkPending=null;
function editCoreSub(parent,id){
 const works=C.active().filter(r=>r.type==='工作'),r=D.work.find(r=>r.id===parent)||D.ledger.find(r=>r.id===parent)||works[0];
 if(!r){toast('暂无可维护的活跃工作');return;}
 const s=r.sub.find(x=>x.id===id)||{name:'',start:'',due:'',completed:'',done:false};core.subEditor={parent:r.id,id:id||null};
 const field=(key,label,type='date')=>'<div class="form-group"><label class="field-label" for="core-sub-'+key+'">'+label+'</label><input class="input" id="core-sub-'+key+'" type="'+type+'" value="'+E(s[key])+'"></div>';
 const target=!parent?'<div class="form-group full"><label class="field-label" for="core-sub-parent">工作</label><select class="select" id="core-sub-parent">'+works.map(w=>'<option value="'+E(w.id)+'" '+(w.id===r.id?'selected':'')+'>'+E(w.name)+'</option>').join('')+'</select></div>':'';
 modal(id?'编辑子任务':'新增子任务','<div class="form-grid">'+target+field('name','名称','text')+field('start','开始日期')+field('due','截止日期')+field('completed','完成日期')+'</div>',btn('保存子任务',null,'core-sub-save','primary'));
}
async function coreSubChange(parent,change){try{const r=D.work.find(x=>x.id===parent)||D.ledger.find(x=>x.id===parent);if(!r||r._key!=='todos')return;change(r);await window.G2B2_APP.store.reorder(r._sourceId,r.sub.map(s=>s.id));state.expanded=r.id;render();}catch(error){toast(error.message);}}
function handleWorkCoreAction(action,el){
 const id=el.dataset.id,parent=el.dataset.parent,value=el.dataset.value;
 if(['detail','edit','status'].includes(action)&&el.dataset.type==='goals')C.refreshGoals();
 if(action==='state-save'&&stateContext?.type==='work'){
  const r=record('work',stateContext.id);
  if(businessType('work',r)==='work'&&document.getElementById('lifecycle-state').value==='已完成'&&(r.sub||[]).some(s=>!s.done)){toast('存在未完成子任务，不能将父工作标为已完成');return true;}
 }
 if(action==='summary-copy'){
  const text=document.createElement('textarea'),focus=document.activeElement;text.value=core.summaryText;text.className='b2-copy-buffer';text.setAttribute('aria-hidden','true');document.body.append(text);text.select();const copied=document.execCommand('copy');text.remove();focus?.focus();
  if(copied)toast('已复制当前摘要，请在工作记录中粘贴后编辑');else navigator.clipboard.writeText(core.summaryText).then(()=>toast('已复制当前摘要，请在工作记录中粘贴后编辑')).catch(()=>toast('复制失败，请允许剪贴板权限后重试'));return true;
 }
 if(!action.startsWith('core-'))return false;
 if(action==='core-calendar-prev'||action==='core-calendar-next'){core.calendarMonth=C.shiftMonth(core.calendarMonth,action.endsWith('prev')?-1:1);core.calendarDate=core.calendarMonth+'-01';render();}
 if(action==='core-calendar-today'){core.calendarMonth=TODAY.slice(0,7);core.calendarDate=TODAY;render();}
 if(action==='core-calendar-day'){core.calendarDate=value;render();}
 if(action==='core-month-prev'||action==='core-month-next'){core.month=C.shiftMonth(core.month,action.endsWith('prev')?-1:1);state.month=core.month===TODAY.slice(0,7)?'本月':core.month===C.shiftMonth(TODAY.slice(0,7),-1)?'上月':'浏览月份';render();}
 if(action==='core-period'){state.month=value;if(value==='本月')core.month=TODAY.slice(0,7);if(value==='上月')core.month=C.shiftMonth(TODAY.slice(0,7),-1);render();}
 if(action==='core-range-apply'){const start=document.getElementById('core-range-start').value,end=document.getElementById('core-range-end').value;if(!start||!end||start>end){toast('请选择有效的开始、结束日期');return true;}core.rangeStart=start;core.rangeEnd=end;render();}
 if(action==='core-filter-clear'){state[value]=value==='query'?'':'全部';render();}
 if(action==='core-goal-expand'){core.goalOpen=core.goalOpen===id?null:id;render();}

 return true;
}
document.addEventListener('change',e=>{
 const x=e.target;
 if(x.id==='core-calendar-month'&&x.value){core.calendarMonth=x.value;core.calendarDate=x.value+'-01';render();}
 if(x.id==='core-summary-month'&&x.value){core.month=x.value;state.month='浏览月份';render();}
 if(x.dataset.coreFilter){state[x.dataset.coreFilter]=x.value;render();}
});
document.addEventListener('dragstart',e=>{const row=e.target.closest('.b2-subtask-row');if(!row)return;core.drag={parent:row.dataset.parent,id:row.dataset.sub};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',row.dataset.sub);row.classList.add('b2-dragging');});
document.addEventListener('input',e=>{const x=e.target;if(x.id!=='core-filter-query')return;const pos=x.selectionStart;state.query=x.value;render();const next=document.getElementById('core-filter-query');next.focus();next.setSelectionRange(pos,pos);});
document.addEventListener('dragover',e=>{const row=e.target.closest('.b2-subtask-row');if(row&&core.drag?.parent===row.dataset.parent){e.preventDefault();e.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',e=>{const row=e.target.closest('.b2-subtask-row'),drag=core.drag;if(!row||!drag||drag.parent!==row.dataset.parent)return;e.preventDefault();if(drag.id!==row.dataset.sub)coreSubChange(drag.parent,r=>{const from=r.sub.findIndex(s=>s.id===drag.id),to=r.sub.findIndex(s=>s.id===row.dataset.sub);r.sub.splice(to,0,r.sub.splice(from,1)[0]);});core.drag=null;});
document.addEventListener('dragend',()=>{core.drag=null;document.querySelectorAll('.b2-dragging').forEach(r=>r.classList.remove('b2-dragging'));});
document.addEventListener('pointerdown',e=>{const handle=e.target.closest('.b2-drag-handle'),row=handle?.closest('.b2-subtask-row');if(!row||e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);core.pointer={parent:row.dataset.parent,id:row.dataset.sub,x:e.clientX,y:e.clientY};});
document.addEventListener('pointermove',e=>{if(!core.pointer)return;if(Math.abs(e.clientY-core.pointer.y)>5||Math.abs(e.clientX-core.pointer.x)>5)document.querySelector('.b2-subtask-row[data-sub="'+CSS.escape(core.pointer.id)+'"]')?.classList.add('b2-dragging');});
document.addEventListener('pointerup',e=>{const drag=core.pointer;if(!drag)return;core.pointer=null;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.b2-subtask-row');if(target&&target.dataset.parent===drag.parent&&target.dataset.sub!==drag.id)coreSubChange(drag.parent,r=>{const from=r.sub.findIndex(s=>s.id===drag.id),to=r.sub.findIndex(s=>s.id===target.dataset.sub);r.sub.splice(to,0,r.sub.splice(from,1)[0]);});document.querySelectorAll('.b2-dragging').forEach(r=>r.classList.remove('b2-dragging'));});
document.addEventListener('pointercancel',()=>{core.pointer=null;document.querySelectorAll('.b2-dragging').forEach(r=>r.classList.remove('b2-dragging'));});
document.addEventListener('click',async e=>{
 if(!e.target.closest('.choice-control')){document.querySelectorAll('.choice-panel').forEach(p=>p.hidden=true);document.querySelectorAll('.choice-trigger').forEach(p=>p.setAttribute('aria-expanded','false'));}
 const el=e.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action,id=el.dataset.id,type=el.dataset.type,value=el.dataset.value;
 if(await formalAction(action,el))return;
 if(handleWorkCoreAction(action,el))return;
 if(action==='formal-history-multi'){const k=el.dataset.key;historyMulti.has(k)?historyMulti.delete(k):historyMulti.add(k);render();return;}
 if(action==='formal-history-filter-clear'){delete state[el.dataset.key];render();return;}
 if(action==='formal-history-clear'){['workType','status','priority','source','category','startFrom','startTo','dueFrom','dueTo','completedFrom','completedTo'].forEach(k=>delete state[k]);historyMulti.clear();state.query='';state.tab='全部';render();return;}
 if(action==='formal-history-expand'){state.expanded=state.expanded===id?null:id;render();return;}
 if(action==='formal-history-export'){modal('工作导出','<p>选择正式已有导出范围。</p>'+['all','current','page'].map((scope,i)=>btn(['全部','当前筛选','当前页面'][i],null,'formal-export-scope','','data-value="'+scope+'"')).join(''));return;}
 if(action==='formal-export-scope'){const rows=value==='all'?D.ledger:historyVisible;const csv='\uFEFF'+[['完成日期','工作名称','状态','经办人','来源','分类','开始日期','截止日期'],...rows.map(r=>[r.end,r.name,r.state,r.owner,asArray(r.source).join('、'),asArray(r.category).join('、'),r.start,r.due])].map(line=>line.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='工作记录.csv';a.click();URL.revokeObjectURL(url);closeOverlay();return;}
 if(action==='open-nav'){document.body.classList.add('nav-open');return}
 if(action==='close-nav'){document.body.classList.remove('nav-open');return}
 if(action==='close-overlay'){closeOverlay();return}
 if(action==='global-search'){openSearch();return}
 if(action==='backup-settings'){location.href='settings.html';return}
 if(action==='smart-input'){smartInput();return}
 if(action==='smart-type'){smartForm(value);return}


 if(action==='collection-add'){readEditor();editor.draft[el.dataset.key]=[...asArray(editor.draft[el.dataset.key]),{}];redrawEditor();return}
 if(action==='collection-remove'){readEditor();editor.draft[el.dataset.key].splice(Number(el.dataset.row),1);redrawEditor();return}
 if(action==='choice-toggle'){const control=el.closest('.choice-control'),open=el.getAttribute('aria-expanded')==='true';document.querySelectorAll('.choice-panel').forEach(p=>p.hidden=true);document.querySelectorAll('.choice-trigger').forEach(p=>p.setAttribute('aria-expanded','false'));control.querySelector('.choice-panel').hidden=open;el.setAttribute('aria-expanded',String(!open));return}
 if(action==='choice-close'){const c=el.closest('.choice-control');c.querySelector('.choice-panel').hidden=true;c.querySelector('.choice-trigger').setAttribute('aria-expanded','false');c.querySelector('.choice-trigger').focus();return}
 if(action==='choice-new'){const c=el.closest('.choice-control');c.querySelector('.choice-options').hidden=true;c.querySelector('.choice-new-name').hidden=false;c.querySelector('[data-choice-new]').focus();return}
 if(['choice-pick','choice-use','choice-save'].includes(action)){
  const key=el.dataset.key,c=el.closest('.choice-control'),f=editor.fields.find(x=>x.key===key),name=action==='choice-pick'?el.dataset.name:c.querySelector('[data-choice-new]').value.trim();if(!name){toast('请先输入名称');return}
  readEditor();editor.draft[key]=f.type==='multi'?[...new Set([...asArray(editor.draft[key]),name])]:name;
    redrawEditor();document.querySelector('.choice-control[data-choice="'+key+'"] .choice-trigger')?.focus();return;
 }
 if(action==='status'){openState(type,id);return}


 if(action==='relation-candidates'){relationCandidates();return}
 if(action==='relation-back'){openRelations(relationContext.type,relationContext.id);return}


 if(action==='relation-view'){openDetail(type,id);return}

 if(action==='relation-new-form'){smartForm(document.getElementById('related-new-type').value,true);return}
 if(action==='tab'){state.tab=value;render();return}
 if(action==='toggle-filter'){state.filter=!state.filter;render();return}
 if(action==='clear-filter'){clearFilters();return}
 if(action==='bulk-toggle'){const b=bulk[el.dataset.group];b.active=!b.active;b.selected.clear();render();return}
 if(action==='expand'){state.expanded=state.expanded===id?null:id;render();return}
 if(action==='detail'){openDetail(type,id,false);return}
 if(action==='edit'){openDetail(type,id,true);return}









});
document.addEventListener('change',e=>{
 const input=e.target;
 if(input.id.startsWith('system-')){window.G2B5UI.input(input,businessHooks());return;}
 if(input.dataset.historyRange){state[input.dataset.historyRange]=input.value;render();return;}
 if(input.dataset.historyFilter){const key=input.dataset.historyFilter;if(input.type==='checkbox'){const prior=asArray(state[key]).filter(x=>x!=='全部'),next=input.checked?[...new Set([...prior,input.value])]:prior.filter(x=>x!==input.value);state[key]=next.length?next:'全部';}else state[key]=input.value;render();return;}
 if(input.matches('[data-filter]')){state[input.dataset.filter]=input.value;render()}
 if(input.dataset.bulk){const b=bulk[input.dataset.bulk];if(input.checked)b.selected.add(input.dataset.bulkId);else b.selected.delete(input.dataset.bulkId);render()}
 if(input.dataset.bulkAll){const b=bulk[input.dataset.bulkAll];b.visible.forEach(id=>input.checked?b.selected.add(id):b.selected.delete(id));render()}
 if(input.id==='lifecycle-state')document.getElementById('close-reason-group').hidden=input.value!=='已关闭';
 if(input.id==='cycle-enabled')document.getElementById('cycle-fields').hidden=!input.checked;
 if(input.id==='relation-type')renderCandidates();
 if(input.dataset.field){readEditor();if(input.closest('.choice-control'))input.closest('.choice-control').querySelector('.choice-trigger span').textContent=asArray(editor.draft[input.dataset.field]).join('、')||'请选择';editor.fields.filter(f=>f.visibleWhen).forEach(f=>{document.querySelector('[data-condition="'+f.key+'"]').hidden=!visibleField(f,editor.draft)});if(input.dataset.field==='fundItem'){editor.draft.subcategoryId='';redrawEditor();}if(['hasContract','hasExpense'].includes(input.dataset.field)){document.querySelectorAll('[data-purchase-link]').forEach(x=>x.remove());document.querySelector('.drawer-body > .form-grid').insertAdjacentHTML('beforeend','');}refreshComputed();}
 if(input.dataset.collection){readEditor();refreshComputed();}
});
document.addEventListener('input',e=>{
 const input=e.target;
 if(input.id.startsWith('system-')){window.G2B5UI.input(input,businessHooks());return;}
 if(input.closest('.drawer-body')&&(input.dataset.field||input.dataset.collection)){readEditor();refreshComputed();}
 if(input.id==='global-query'){renderSearch();return}
 if(input.id==='relation-query'){renderCandidates();return}
 if(input.id==='local-query'){const pos=input.selectionStart;state.query=input.value;render();const next=document.getElementById('local-query');if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch{}}}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){const open=document.querySelector('.choice-panel:not([hidden])');if(open){e.preventDefault();open.hidden=true;const trigger=open.closest('.choice-control').querySelector('.choice-trigger');trigger.setAttribute('aria-expanded','false');trigger.focus();return}closeOverlay();document.body.classList.remove('nav-open')}
 const dialog=document.querySelector('[role="dialog"]');
 if(e.key==='Tab'&&dialog){const nodes=[...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!dialog){e.preventDefault();document.querySelector('[data-action="global-search"]')?.click()}
});

function openHashRecord(){const q=new URLSearchParams(location.hash.split('?')[1]||''),id=q.get('record');if(window.G2B4_UI?.openHash(q,businessHooks()))return;if(q.get('new')==='1'&&G2B3?.keys[page]){smartForm(page);return;}if(!id)return;const trigger=[...document.querySelectorAll('#page-root [data-action="detail"]')].find(e=>e.dataset.type===page&&e.dataset.id===id);trigger?.focus();openDetail(page,id);}
window.G2B2_UI_OPEN_SMART=smartInput;
openHashRecord();
})();
