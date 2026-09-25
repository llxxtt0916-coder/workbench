const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const slice=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert(start>=0&&end>start);return html.slice(start,end);};
test('configuration page manages organizations and the sole category dictionary',()=>{
  assert.match(html,/<div class="nav-section">管理<\/div>[\s\S]*?navigate\('config'/);
  assert.match(html,/id="page-config"/);
  const values=new Map(),nodes=new Map(),messages=[],confirmations=[];
  const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',style:{},classList:{toggle(){}}});return nodes.get(id);};
  const sandbox={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,val)=>values.set(key,String(val))},
    document:{getElementById:element,querySelectorAll:()=>[]},DB:{get:()=>[]},Date,Math,
    esc:value=>String(value??''),toast:message=>messages.push(message),openModal:()=>{},closeModal:()=>{},
    confirmAction:(message,action)=>confirmations.push({message,action})};
  vm.createContext(sandbox);
  const model=slice('// Configuration is one snapshot object','//  DATA LAYER v1.5');
  const ui=slice('const CONFIG_TABS=','const pageTitles=');
  const api=vm.runInContext(model+'\n'+ui+'\n({upsertConfig,selectConfigGroup,selectConfigTab,renderConfigPage,toggleConfigEntry,moveConfigEntry,visibleConfigRows,openConfigEditor,deleteConfigEntry,getConfig})',sandbox);
  api.renderConfigPage();
  assert.match(element('configTabs').innerHTML,/外部单位/);
  assert.match(element('configTabs').innerHTML,/供应商/);
  const unit=api.upsertConfig('organizations',{name:'甲单位',type:'external'});
  const second=api.upsertConfig('organizations',{name:'乙单位',type:'external'});
  api.renderConfigPage();
  assert.match(element('configTableBody').innerHTML,/甲单位/);
  api.moveConfigEntry(second.id,-1);
  assert.equal(api.visibleConfigRows()[0].id,second.id);
  api.toggleConfigEntry(unit.id);
  assert.match(element('configTableBody').innerHTML,/停用/);
  api.selectConfigTab('supplier');
  assert.doesNotMatch(element('configTableBody').innerHTML,/甲单位/);
  api.selectConfigGroup('dictionaries');
  assert.match(element('configTabs').innerHTML,/工作类别/);
  assert.doesNotMatch(element('configTabs').innerHTML,/工作来源/);
  assert.match(element('configTableBody').innerHTML,/报告/);
  assert.equal(messages.length,0);
  assert.doesNotMatch(element('configTabs').innerHTML,/work_sources/);
  assert.match(element('configTableBody').innerHTML,/删除/);
  api.selectConfigGroup('organizations');
  api.deleteConfigEntry(second.id);
  assert.equal(confirmations.length,1,'未使用组织先确认');
  assert.match(confirmations[0].message,/永久删除/);
  confirmations[0].action();
  assert(!api.getConfig().organizations.some(row=>row.id===second.id));
});
