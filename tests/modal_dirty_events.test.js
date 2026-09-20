const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('function modalFingerprint');
const end=html.indexOf('//  INIT',start);
assert(start>=0&&end>start,'找不到统一 Modal 关闭控制器');
const source=html.slice(start,end);

function classes(...names){const set=new Set(names);return {add:n=>set.add(n),remove:n=>set.delete(n),contains:n=>set.has(n)};}
function button(text,close=false){return {textContent:text,classList:classes(close?'close-btn':''),onclick:null};}
const input={id:'name',type:'text',value:'初始内容'};
const closeButton=button('×',true),cancelButton=button('取消');
const modal={id:'testModal',classList:classes(),inputs:[input],buttons:[closeButton,cancelButton],listeners:{},querySelectorAll(selector){if(selector==='input,textarea,select')return this.inputs;if(selector==='.close-btn,.modal-footer button')return this.buttons;return [];},addEventListener(type,fn){this.listeners[type]=fn;}};
const ids={testModal:modal};
const doc={listeners:{},getElementById(id){return ids[id]||null;},querySelectorAll(selector){if(selector==='.modal-overlay')return [modal];if(selector==='.modal-overlay.open')return [modal,...Object.values(ids).filter(x=>x!==modal&&x.classList?.contains('open'))];return [];},addEventListener(type,fn){this.listeners[type]=fn;},createElement(){const dialog={id:'v16UnsavedConfirm',className:'modal-overlay',classList:classes(),innerHTML:'',querySelectorAll(){return [];}};const continueButton=button('继续编辑'),discardButton=button('放弃修改');ids.v16UnsavedConfirm=dialog;ids.v16ContinueEdit=continueButton;ids.v16DiscardEdit=discardButton;return dialog;},body:{appendChild(dialog){dialog.classList.add(...dialog.className.split(' ').filter(Boolean));}}};
let rawCloseCount=0;
const sandbox={document:doc,V16_MODAL_BASELINES:{},openModal(id){ids[id].classList.add('open');},closeModal(id){ids[id].classList.remove('open');rawCloseCount++;}};
const api=vm.runInNewContext(`${source}\n({openModal,requestModalClose})`,sandbox);
const event=()=>({preventDefault(){}});

// Case 1：真实 × click → 自定义确认 → 继续编辑，字段和原 Modal 均保留。
api.openModal('testModal');input.value='已修改';closeButton.onclick(event());
assert(modal.classList.contains('open'));assert(ids.v16UnsavedConfirm.classList.contains('open'));assert.equal(input.value,'已修改');
ids.v16ContinueEdit.onclick();assert(!ids.v16UnsavedConfirm.classList.contains('open'));assert(modal.classList.contains('open'));assert.equal(input.value,'已修改');

// Case 2：真实取消 click 也进入同一入口；Case 3：ESC 同理。
cancelButton.onclick(event());assert(ids.v16UnsavedConfirm.classList.contains('open'));ids.v16ContinueEdit.onclick();
doc.listeners.keydown({key:'Escape',preventDefault(){}});assert(ids.v16UnsavedConfirm.classList.contains('open'));assert(modal.classList.contains('open'));

// Case 4：放弃修改只在确认后关闭；Case 5：未修改时三种入口直接关闭。
ids.v16DiscardEdit.onclick();assert(!modal.classList.contains('open'));assert(rawCloseCount===1);
api.openModal('testModal');closeButton.onclick(event());assert(!modal.classList.contains('open'));
api.openModal('testModal');cancelButton.onclick(event());assert(!modal.classList.contains('open'));
api.openModal('testModal');doc.listeners.keydown({key:'Escape',preventDefault(){}});assert(!modal.classList.contains('open'));

// Case 6：遮罩永不关闭，不论当前是否修改。
api.openModal('testModal');input.value='再次修改';modal.listeners.click({target:modal,preventDefault(){},stopPropagation(){}});assert(modal.classList.contains('open'));assert.equal(rawCloseCount,4);
console.log('Modal ×、取消、ESC、继续编辑、放弃修改、遮罩真实事件路径测试通过');
