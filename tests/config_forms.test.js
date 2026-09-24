const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert(start>=0&&end>start);return html.slice(start,end);}
function setup(){
  const values=new Map(),nodes=new Map(),records={todos:[]};
  const element=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',innerHTML:'',dataset:{},style:{},getAttribute:key=>key==='list'?id+'Options':''});return nodes.get(id);};
  const sandbox={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,val)=>values.set(key,String(val))},
    document:{getElementById:element,querySelector:selector=>{
      const match=selector.match(/data-for="([^"]+)"/);return match?element('button-'+match[1]):null;
    }},DB:{get:key=>records[key]||[]},Date,Math,
    toArray:v=>Array.isArray(v)?v:v?[v]:[],esc:v=>String(v??'')};
  vm.createContext(sandbox);
  const source=section('// Configuration is one snapshot object','//  DATA LAYER v1.5')+'\n'+
    section('const OPTIONS_STORE=','// Close dropdowns when clicking outside');
  const api=vm.runInContext(source+'\n({upsertConfig,getConfig,activeOrganizations,setOrgInput,onOrgInput,orgIdForSave,validInternalOrgInput,getOptionStore,getMultiSelected,setMultiSelected,selectedWorkConfigIds})',sandbox);
  return {api,element,records,values};
}
test('one organization ID works for purchase, contract and reimbursement scopes',()=>{
  const {api,element}=setup();
  const supplier=api.upsertConfig('organizations',{name:'甲公司',type:'supplier'});
  const external=api.upsertConfig('organizations',{name:'乙单位',type:'external'});
  const internal=api.upsertConfig('organizations',{name:'财务科',type:'internal'});
  assert.deepEqual(Array.from(api.activeOrganizations('external'),r=>r.id),[supplier.id,external.id]);
  assert.deepEqual(Array.from(api.activeOrganizations('internal'),r=>r.id),[internal.id]);
  for(const field of ['purchaseSupplier','contractParty','expenseSupplier','agencyAgent','agencySupplier']){
    const input=element(field);input.dataset.orgScope='external';
    api.setOrgInput(field,'甲公司','');api.onOrgInput(input);
    assert.equal(api.orgIdForSave(field,{},'supplier_org_id','supplier'),supplier.id);
  }
  const dept=element('purchaseContractDept');dept.dataset.orgScope='internal';
  api.setOrgInput(dept.id,'财务科','');api.onOrgInput(dept);
  assert.equal(api.validInternalOrgInput(dept.id,{},'contractDept'),true);
  dept.value='甲公司';api.onOrgInput(dept);
  assert.equal(api.validInternalOrgInput(dept.id,{},'contractDept'),false);
  const agencyDept=element('agencyDept');agencyDept.dataset.orgScope='internal';
  api.setOrgInput(agencyDept.id,'财务科','');api.onOrgInput(agencyDept);
  assert.equal(api.validInternalOrgInput(agencyDept.id,{},'dept'),true);
});
test('manual new name stays out of config; old text and ID remain stable on passive edit',()=>{
  const {api,element}=setup();
  const row=api.upsertConfig('organizations',{name:'旧名',type:'external'});
  const old={party:'历史快照',counterparty_org_id:row.id};
  api.upsertConfig('organizations',{...row,name:'新名'});
  assert.equal(old.party,'历史快照');
  api.setOrgInput('contractParty',old.party,old.counterparty_org_id);
  assert.equal(element('button-contractParty').hidden,true,'更名后的历史快照不应提示重复保存常用单位');
  assert.equal(api.orgIdForSave('contractParty',old,'counterparty_org_id','party'),row.id);
  const input=element('contractParty');input.dataset.orgScope='external';input.value='临时新单位';api.onOrgInput(input);
  assert.equal(api.orgIdForSave('contractParty',old,'counterparty_org_id','party'),'');
  assert.equal(api.getConfig().organizations.length,1);
});
test('work dictionaries feed form and filter; historical values remain filterable and IDs require selection',()=>{
  const {api,element,records}=setup();
  records.todos=[{category:['历史类别','报告'],source:['旧来源']}];
  const category=api.upsertConfig('work_categories',{name:'专项工作'});
  api.setMultiSelected('todoCategory',['专项工作']);
  assert.equal(api.selectedWorkConfigIds('todoCategory',{},'work_category_ids').length,0);
  element('todoCategoryPlaceholder').dataset.configTouched='1';
  assert.deepEqual(Array.from(api.selectedWorkConfigIds('todoCategory',{},'work_category_ids')),[category.id]);
  assert(api.getOptionStore('todoCategory').includes('专项工作'));
  const filter=api.getOptionStore('todoF_cat');
  assert(filter.includes('历史类别')&&filter.includes('报告'));
  assert.equal(filter.filter(name=>name==='报告').length,1);
  assert(api.getOptionStore('todoF_src').includes('旧来源'));
  api.upsertConfig('work_categories',{...category,status:'inactive'});
  assert(api.getOptionStore('todoF_cat').includes('历史类别'));
});
