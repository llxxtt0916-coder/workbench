const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('// Configuration is one snapshot object');
const end=html.indexOf('//  DATA LAYER v1.5',start);
assert(start>=0&&end>start);
const source=html.slice(start,html.lastIndexOf('// ============================================================',end));
test('unit filters merge active configuration and actual history without duplicates',()=>{
  const values=new Map(),records={
    purchases:[{supplier:'甲公司'},{supplier:'旧供应商'}],
    contracts:[{party:'旧对方单位'}],expenses:[{supplier:'旧收款单位'}],
    agencys:[{winSupplier:'旧成交单位',agent:'旧代理机构',dept:'旧科室'}]
  };
  const sandbox={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,val)=>values.set(key,String(val))},
    DB:{get:key=>records[key]||[]},Date,Math};
  vm.createContext(sandbox);
  const api=vm.runInContext(source+'\n({getConfig,upsertConfig,setConfigStatus,unitFilterCandidates})',sandbox);
  const first=api.getConfig().organizations.find(row=>row.name==='甲公司');
  assert(first,'采购历史供应商应进入配置');
  api.upsertConfig('organizations',{name:'乙单位',type:'external'});
  api.upsertConfig('organizations',{name:'财务科',type:'internal'});
  const purchase=api.unitFilterCandidates('purchaseF_supplier');
  assert(purchase.includes('甲公司')&&purchase.includes('乙单位')&&purchase.includes('旧供应商'));
  assert.equal(purchase.filter(name=>name==='甲公司').length,1);
  const contract=api.unitFilterCandidates('contractF_party');
  assert(contract.includes('甲公司')&&contract.includes('乙单位')&&contract.includes('旧对方单位'));
  assert(api.unitFilterCandidates('expenseF_supplier').includes('旧收款单位'));
  assert(api.unitFilterCandidates('agencyF_supplier').includes('旧成交单位'));
  assert(api.unitFilterCandidates('agencyF_agent').includes('旧代理机构'));
  assert(api.unitFilterCandidates('agencyF_dept').includes('旧科室'));
  assert(!api.unitFilterCandidates('purchaseF_supplier').includes('财务科'));
  api.setConfigStatus('organizations',first.id,'inactive');
  assert(api.unitFilterCandidates('purchaseF_supplier').includes('甲公司'),'停用但历史使用的值仍可筛选');
  assert(api.unitFilterCandidates('contractF_party').includes('甲公司'),'停用配置的跨表历史值仍可筛选');
  records.purchases.push({supplier:'新录入单位'});
  assert(api.unitFilterCandidates('purchaseF_supplier').includes('新录入单位'),'保存新记录后候选立即更新');
});
test('unit filter controls accept typing and datalist selection',()=>{
  for(const id of ['purchaseF_supplier','contractF_party','expenseF_supplier','agencyF_supplier','agencyF_agent','agencyF_dept']){
    assert.match(html,new RegExp(`id="${id}"[^>]*list="${id}Options"|list="${id}Options"[^>]*id="${id}"`));
    assert.match(html,new RegExp(`id="${id}Options"`));
  }
  assert.match(html,/id="todoF_catSearch"/);
  assert.match(html,/id="todoF_srcSearch"/);
});
