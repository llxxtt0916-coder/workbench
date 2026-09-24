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
    agencys:[{winSupplier:'旧成交单位'}]
  };
  const sandbox={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,val)=>values.set(key,String(val))},
    DB:{get:key=>records[key]||[]},Date,Math};
  vm.createContext(sandbox);
  const api=vm.runInContext(source+'\n({upsertConfig,setConfigStatus,unitFilterCandidates})',sandbox);
  const first=api.upsertConfig('organizations',{name:'甲公司',type:'supplier'});
  api.upsertConfig('organizations',{name:'乙单位',type:'external'});
  api.upsertConfig('organizations',{name:'财务科',type:'internal'});
  assert.deepEqual(Array.from(api.unitFilterCandidates('purchaseF_supplier')),['甲公司','乙单位','旧供应商']);
  assert.deepEqual(Array.from(api.unitFilterCandidates('contractF_party')),['甲公司','乙单位','旧对方单位']);
  assert(api.unitFilterCandidates('expenseF_supplier').includes('旧收款单位'));
  assert(api.unitFilterCandidates('agencyF_supplier').includes('旧成交单位'));
  assert(!api.unitFilterCandidates('purchaseF_supplier').includes('财务科'));
  api.setConfigStatus('organizations',first.id,'inactive');
  assert(api.unitFilterCandidates('purchaseF_supplier').includes('甲公司'),'停用但历史使用的值仍可筛选');
  assert(!api.unitFilterCandidates('contractF_party').includes('甲公司'),'停用且无历史值时不推荐');
  records.purchases.push({supplier:'新录入单位'});
  assert(api.unitFilterCandidates('purchaseF_supplier').includes('新录入单位'),'保存新记录后候选立即更新');
});
test('four unit filter controls accept typing and datalist selection',()=>{
  for(const id of ['purchaseF_supplier','contractF_party','expenseF_supplier','agencyF_supplier']){
    assert.match(html,new RegExp(`id="${id}"[^>]*list="${id}Options"|list="${id}Options"[^>]*id="${id}"`));
    assert.match(html,new RegExp(`id="${id}Options"`));
  }
  assert.match(html,/id="todoF_catSearch"/);
  assert.match(html,/id="todoF_srcSearch"/);
});
