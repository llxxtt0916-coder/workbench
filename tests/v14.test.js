// v1.4 纯逻辑单元测试（node 运行：node tests/v14.test.js）
// 注意：以下函数与 index.html 内联实现保持一致，用于验证算法正确性。
// 若 index.html 中对应函数有改动，需同步更新本文件。

const STATE = { TODO:'未开始', DOING:'进行中', DONE:'已完成', CLOSED:'已关闭' };

function mapStatusToState(ledgerKey, status){
  const s=String(status||'').trim();
  switch(ledgerKey){
    case 'todos':     return s==='进行中' ? STATE.DOING : (s==='已完成') ? STATE.DONE : (s==='已取消') ? STATE.CLOSED : STATE.TODO;
    case 'contracts': return s==='执行中' ? STATE.DOING : (s==='已完成') ? STATE.DONE : (s==='已终止') ? STATE.CLOSED : STATE.TODO;
    case 'purchases': return s==='申请中' ? STATE.TODO : (s==='已采购'||s==='已完成') ? STATE.DONE : (s==='已取消') ? STATE.CLOSED : STATE.DOING;
    case 'expenses':  return s==='待报销' ? STATE.TODO : (s==='已报销') ? STATE.DONE : (s==='已取消') ? STATE.CLOSED : STATE.DOING;
    case 'agencys':   return s==='待委托' ? STATE.TODO : s==='已委托' ? STATE.DOING : (s==='已完成') ? STATE.DONE : (s==='已流标'||s==='已取消') ? STATE.CLOSED : STATE.DOING;
    case 'handovers': return (s==='进行中'||s==='交接中') ? STATE.DOING : (s==='已完成'||s==='已结束') ? STATE.DONE : (s==='已取消') ? STATE.CLOSED : STATE.TODO;
    case 'funds':     return s==='进行中' ? STATE.DOING : (s==='已完成') ? STATE.DONE : (s==='已关闭') ? STATE.CLOSED : STATE.TODO;
    default:          return STATE.TODO;
  }
}

function getDueDate(rec, ledgerKey){
  if(rec.due_date) return rec.due_date;
  switch(ledgerKey){
    case 'todos':     return rec.deadline||'';
    case 'contracts': return rec.expiry||'';
    case 'purchases': return rec.date||'';
    case 'expenses':  return rec.appDate||'';
    case 'agencys':   return rec.date||'';
    case 'handovers': return rec.date||'';
    case 'funds':     return rec.deadline||'';
    default:          return '';
  }
}
function isOverdue(rec, ledgerKey){
  const due=getDueDate(rec, ledgerKey);
  if(!due) return false;
  return rec.state!==STATE.CLOSED && rec.state!==STATE.DONE && due < new Date().toISOString().slice(0,10);
}

// 下一期日期计算 + 月末钳制（cycle 任务，T6 用，提前验证）
// 重要：用本地时区计算与格式化，避免 toISOString 的 UTC 偏移导致差一天
function fmtLocal(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function addMonths(year, month0, day, add){
  let nm=month0+add, ny=year;
  while(nm>11){ nm-=12; ny++; }
  const last=new Date(ny, nm+1, 0).getDate(); // 当月最后一天
  const nd=Math.min(day, last);
  return fmtLocal(new Date(ny, nm, nd));
}
// 周期下一期推算辅助（与 index.html 保持一致）
function clampInt(s, lo, hi, dflt){ let v=parseInt(s,10); if(isNaN(v)) v=dflt; return Math.max(lo, Math.min(hi, v)); }
function dowLabelCn(x){ return ['','一','二','三','四','五','六','日'][x]||''; }
function nextMonthDay(base, day){
  const p=base.split('-'); if(p.length!==3) return '';
  const y=+p[0], mo=+p[1], da=+p[2];
  const baseD=new Date(y, mo-1, da);
  let candY=y, candMo=mo;
  let last=new Date(candY, candMo, 0).getDate();
  let cand=new Date(candY, candMo-1, Math.min(day, last));
  if(cand<=baseD){ candMo++; if(candMo>12){ candMo=1; candY++; } last=new Date(candY, candMo, 0).getDate(); cand=new Date(candY, candMo-1, Math.min(day, last)); }
  return fmtLocal(cand);
}
function nextWeekday(base, x){
  const p=base.split('-'); if(p.length!==3) return '';
  const d=new Date(+p[0], +p[1]-1, +p[2]);
  const targetJs=(x===7)?0:x;
  do { d.setDate(d.getDate()+1); } while(d.getDay()!==targetJs);
  return fmtLocal(d);
}
function nextQuarterDay(base, day){
  const p=base.split('-'); if(p.length!==3) return '';
  const y=+p[0], mo=+p[1], da=+p[2];
  const baseD=new Date(y, mo-1, da);
  const qIdx=Math.floor((mo-1)/3);
  function candForQuarter(yy, qi){
    const sm=qi*3+1;
    const qEnd=new Date(yy, sm+2, 0);
    const c=new Date(yy, sm-1, 1); c.setDate(c.getDate()+(day-1));
    if(c>qEnd) c.setTime(qEnd.getTime());
    return c;
  }
  let cand=candForQuarter(y, qIdx);
  if(cand<=baseD){ let qi=qIdx+1, yy=y; if(qi>3){ qi=0; yy++; } cand=candForQuarter(yy, qi); }
  return fmtLocal(cand);
}
function nextYearDate(base, M, D){
  const p=base.split('-'); if(p.length!==3) return '';
  const y=+p[0], mo=+p[1], da=+p[2];
  const baseD=new Date(y, mo-1, da);
  function candForYear(yy){ const last=new Date(yy, M, 0).getDate(); return new Date(yy, M-1, Math.min(D, last)); }
  let cand=candForYear(y);
  if(cand<=baseD) cand=candForYear(y+1);
  return fmtLocal(cand);
}
function nextDueDate(base, period){
  if(!base) return '';
  const legacy={weekly:'1w',monthly:'1m',quarterly:'3m',yearly:'1y'};
  if(legacy[period]) period=legacy[period];
  if(!period || period==='none') return '';
  if(period==='wd'){
    const p=base.split('-'); if(p.length!==3) return '';
    const d=new Date(+p[0], +p[1]-1, +p[2]);
    do { d.setDate(d.getDate()+1); } while(d.getDay()===0||d.getDay()===6);
    return fmtLocal(d);
  }
  if(period.indexOf('dom:')===0) return nextMonthDay(base, clampInt(period.slice(4),1,31,1));
  if(period.indexOf('dow:')===0) return nextWeekday(base, clampInt(period.slice(4),1,7,1));
  if(period.indexOf('doq:')===0) return nextQuarterDay(base, clampInt(period.slice(4),1,92,1));
  if(period.indexOf('yd:')===0){ const mm=period.slice(3).match(/^(\d{1,2})-(\d{1,2})$/); if(mm) return nextYearDate(base, +mm[1], +mm[2]); return ''; }
  const m=period.match(/^(\d+)([dwmqy])$/);
  if(!m) return '';
  const n=+m[1], u=m[2];
  const parts=base.split('-'); if(parts.length!==3) return '';
  const y=+parts[0], mo=+parts[1], da=+parts[2];
  const date=new Date(y, mo-1, da);
  if(u==='d'){ date.setDate(date.getDate()+n); return fmtLocal(date); }
  if(u==='w'){ date.setDate(date.getDate()+n*7); return fmtLocal(date); }
  if(u==='m'){ return addMonths(y, mo-1, da, n); }
  if(u==='q'){ return addMonths(y, mo-1, da, n*3); }
  if(u==='y'){ return addMonths(y, mo-1, da, n*12); }
  return '';
}
function formatLedgerRecurrence(period){
  const legacy={weekly:'1w',monthly:'1m',quarterly:'3m',yearly:'1y'};
  if(legacy[period]) period=legacy[period];
  if(!period||period==='none') return '';
  if(period==='wd') return '每工作日';
  if(period.indexOf('dom:')===0) return '每月'+clampInt(period.slice(4),1,31,1)+'日';
  if(period.indexOf('dow:')===0) return '每周'+dowLabelCn(clampInt(period.slice(4),1,7,1));
  if(period.indexOf('doq:')===0) return '每季第'+clampInt(period.slice(4),1,92,1)+'日';
  if(period.indexOf('yd:')===0){ const mm=period.slice(3).match(/^(\d{1,2})-(\d{1,2})$/); if(mm) return '每年'+mm[1]+'月'+mm[2]+'日'; }
  const m=period.match(/^(\d+)([dwmqy])$/);
  if(!m) return '';
  const n=+m[1], u=m[2];
  const unit={d:'天',w:'周',m:'月',q:'季',y:'年'}[u];
  return '每'+n+unit;
}

// ---------- 断言 ----------
let pass=0, fail=0;
function eq(name, got, exp){
  if(got===exp){ pass++; /*console.log('  ok',name);*/ }
  else { fail++; console.log('  FAIL', name, '=> got', JSON.stringify(got), 'exp', JSON.stringify(exp)); }
}

// 1) 原生 status → 统一 state（四态：完成类→DONE，取消/终止/流标/关闭→CLOSED）
eq('todos 进行中', mapStatusToState('todos','进行中'), STATE.DOING);
eq('todos 已完成', mapStatusToState('todos','已完成'), STATE.DONE);
eq('todos 已取消', mapStatusToState('todos','已取消'), STATE.CLOSED);
eq('todos 空',     mapStatusToState('todos',''),     STATE.TODO);
eq('contracts 执行中', mapStatusToState('contracts','执行中'), STATE.DOING);
eq('contracts 已完成', mapStatusToState('contracts','已完成'), STATE.DONE);
eq('contracts 已终止', mapStatusToState('contracts','已终止'), STATE.CLOSED);
eq('purchases 申请中', mapStatusToState('purchases','申请中'), STATE.TODO);
eq('purchases 已采购', mapStatusToState('purchases','已采购'), STATE.DONE);
eq('purchases 已完成', mapStatusToState('purchases','已完成'), STATE.DONE);
eq('purchases 已取消', mapStatusToState('purchases','已取消'), STATE.CLOSED);
eq('expenses 待报销',  mapStatusToState('expenses','待报销'), STATE.TODO);
eq('expenses 已报销',  mapStatusToState('expenses','已报销'), STATE.DONE);
eq('expenses 已取消',  mapStatusToState('expenses','已取消'), STATE.CLOSED);
eq('agencys 待委托',   mapStatusToState('agencys','待委托'), STATE.TODO);
eq('agencys 已委托',   mapStatusToState('agencys','已委托'), STATE.DOING);
eq('agencys 已完成',   mapStatusToState('agencys','已完成'), STATE.DONE);
eq('agencys 已流标',   mapStatusToState('agencys','已流标'), STATE.CLOSED);
eq('agencys 已取消',   mapStatusToState('agencys','已取消'), STATE.CLOSED);
eq('handovers 交接中', mapStatusToState('handovers','交接中'), STATE.DOING);
eq('handovers 已完成', mapStatusToState('handovers','已完成'), STATE.DONE);
eq('handovers 已结束', mapStatusToState('handovers','已结束'), STATE.DONE);
eq('handovers 已取消', mapStatusToState('handovers','已取消'), STATE.CLOSED);
eq('funds 进行中',     mapStatusToState('funds','进行中'), STATE.DOING);
eq('funds 已完成',     mapStatusToState('funds','已完成'), STATE.DONE);
eq('funds 已关闭',     mapStatusToState('funds','已关闭'), STATE.CLOSED);

// 2) 逾期判定
const today=new Date().toISOString().slice(0,10);
const past='2000-01-01';
eq('逾期-进行中过去', isOverdue({state:STATE.DOING, deadline:past},'todos'), true);
eq('逾期-已关闭过去', isOverdue({state:STATE.CLOSED, deadline:past},'todos'), false);
eq('逾期-已完成过去', isOverdue({state:STATE.DONE, deadline:past},'todos'), false);
eq('逾期-进行中无日期', isOverdue({state:STATE.DOING},'todos'), false);
eq('逾期-进行中未来', isOverdue({state:STATE.DOING, deadline:'2099-01-01'},'todos'), false);

// 3) 周期下一期 + 月末钳制（新格式 + 旧格式兼容）
eq('weekly 兼容', nextDueDate('2026-07-21','weekly'), '2026-07-28');
eq('monthly 普通 兼容', nextDueDate('2026-01-15','monthly'), '2026-02-15');
eq('monthly 月末钳制 1/31+月', nextDueDate('2026-01-31','monthly'), '2026-02-28');
eq('monthly 闰年2月 1/30+月', nextDueDate('2026-01-30','monthly'), '2026-02-28');
eq('quarterly 兼容', nextDueDate('2026-01-31','quarterly'), '2026-04-30');
eq('yearly 闰年被钳 2024-02-29', nextDueDate('2024-02-29','yearly'), '2025-02-28');
eq('yearly 普通 兼容', nextDueDate('2026-03-10','yearly'), '2027-03-10');

// 3b) 新灵活周期格式：每 N 天/周/月/季/年 + 工作日
eq('3d', nextDueDate('2026-07-21','3d'), '2026-07-24');
eq('7d', nextDueDate('2026-07-21','7d'), '2026-07-28');
eq('2w', nextDueDate('2026-07-21','2w'), '2026-08-04');
eq('1m', nextDueDate('2026-01-15','1m'), '2026-02-15');
eq('3m 季', nextDueDate('2026-01-31','3m'), '2026-04-30');
eq('6m 半年', nextDueDate('2026-01-31','6m'), '2026-07-31');
eq('1y', nextDueDate('2026-03-10','1y'), '2027-03-10');
eq('wd 周五→下周一', nextDueDate('2026-07-24','wd'), '2026-07-27');
eq('wd 周一→周二', nextDueDate('2026-07-27','wd'), '2026-07-28');
eq('none 不生成', nextDueDate('2026-07-21','none'), '');
eq('空 不生成', nextDueDate('2026-07-21',''), '');
eq('非法 不生成', nextDueDate('2026-07-21','foo'), '');
// 3b-2) 固定日期类：每月第N日 / 每周星期X / 每季第N日 / 每年M月D日
eq('dom 当月15日(月中)', nextDueDate('2026-07-21','dom:15'), '2026-08-15');
eq('dom 当月1日(月初已过的本月)', nextDueDate('2026-07-10','dom:1'), '2026-08-01');
eq('dom 月末钳制 2/30→2/28', nextDueDate('2026-01-31','dom:30'), '2026-02-28');
eq('dom 31日钳到小月30', nextDueDate('2026-03-31','dom:31'), '2026-04-30');
eq('dow 周三(7/21周二→7/22周三)', nextDueDate('2026-07-21','dow:3'), '2026-07-22');
eq('dow 周一(7/21周二→7/27周一)', nextDueDate('2026-07-21','dow:1'), '2026-07-27');
eq('dow 周日(7/21周二→7/26周日)', nextDueDate('2026-07-21','dow:7'), '2026-07-26');
eq('doq 季内第10日(7/21→Q3第10日=7/10已过→Q4 10/10)', nextDueDate('2026-07-21','doq:10'), '2026-10-10');
eq('doq 季内第1日(7/21→Q4 10/1)', nextDueDate('2026-07-21','doq:1'), '2026-10-01');
eq('yd 每年3-15(7/21→明年)', nextDueDate('2026-07-21','yd:3-15'), '2027-03-15');
eq('yd 每年1-1(7/21→明年)', nextDueDate('2026-07-21','yd:1-1'), '2027-01-01');
eq('yd 闰年2-29(2023→2024)', nextDueDate('2023-07-21','yd:2-29'), '2024-02-29');
eq('yd 2-29非闰年钳28(2024→2025)', nextDueDate('2024-07-21','yd:2-29'), '2025-02-28');

// 3c) formatLedgerRecurrence 人类可读
eq('fmt none', formatLedgerRecurrence('none'), '');
eq('fmt 3d', formatLedgerRecurrence('3d'), '每3天');
eq('fmt 2w', formatLedgerRecurrence('2w'), '每2周');
eq('fmt 1m', formatLedgerRecurrence('1m'), '每1月');
eq('fmt 3m', formatLedgerRecurrence('3m'), '每3月');
eq('fmt 1y', formatLedgerRecurrence('1y'), '每1年');
eq('fmt wd', formatLedgerRecurrence('wd'), '每工作日');
eq('fmt legacy monthly', formatLedgerRecurrence('monthly'), '每1月');
eq('fmt dom', formatLedgerRecurrence('dom:15'), '每月15日');
eq('fmt dow', formatLedgerRecurrence('dow:3'), '每周三');
eq('fmt doq', formatLedgerRecurrence('doq:10'), '每季第10日');
eq('fmt yd', formatLedgerRecurrence('yd:3-15'), '每年3月15日');

// 回归：归档/编辑弹窗 archiveState 选项值必须为中文 STATE 值（防四态化漏改）
(function(){
  const fs=require('fs'); const path=require('path');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const m=html.match(/id="archiveState"[^>]*>([\s\S]*?)<\/select>/);
  const vals=m?[...m[1].matchAll(/<option value="([^"]+)"/g)].map(x=>x[1]):[];
  eq('archiveState 四选项值为中文 STATE', JSON.stringify(vals)===JSON.stringify(['未开始','进行中','已完成','已关闭']), true);
})();

console.log(`\n[v14 逻辑测试] 通过 ${pass} / 失败 ${fail}`);
process.exit(fail?1:0);
