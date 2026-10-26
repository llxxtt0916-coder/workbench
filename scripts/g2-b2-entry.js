/* I06: block legacy writes before any business script; release only a verified set. */
(()=>{
 'use strict';
 Object.defineProperty(window,'G2B5Enabled',{value:true,writable:false,configurable:false});
 window.g2B2Enabled=!new URLSearchParams(location.search).has('legacy');
 const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem,nativeClear=Storage.prototype.clear;
 let released=false;
 for(const [name,fn]of [['setItem',nativeSet],['removeItem',nativeRemove],['clear',nativeClear]])Storage.prototype[name]=function(...args){if(this===window.localStorage&&!released)throw Error('BUILD_VERIFICATION_REQUIRED');return fn.apply(this,args);};
 const c=window.G2B5_BOOT_CONTRACT;
 const ready=(async()=>{
  if(!c||c.version!==1||c.schemaVersion!==2||c.exchangeRevision!==1||!Array.isArray(c.assets)||!c.assets.length||!c.buildId)throw Error('BUILD_CONTRACT_MISSING');
  if(!window.crypto?.subtle||!window.fetch)throw Error('BUILD_VERIFICATION_UNSUPPORTED');
  const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),30000);let next=0;
  async function verify(a){
   if(!/^(scripts\/g2-[a-z0-9-]+\.js|styles\/[a-z0-9-]+\.css|assets\/ui2\/[a-z0-9-]+\.css|icons\/icon-\d+\.svg|manifest\.json)$/.test(a.path))throw Error('BUILD_PATH_REJECTED');
   const url=new URL(a.path,location.href);url.searchParams.set('g2build',c.buildId);
   const r=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:abort.signal});
   if(!r.ok||(r.headers.get('content-type')||'').split(';')[0].trim()!==a.mime)throw Error('BUILD_RESOURCE_INVALID');
   const bytes=await r.arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(bytes.byteLength!==a.bytes||digest!==a.sha256)throw Error('BUILD_FINGERPRINT_MISMATCH');
  }
  // Bounded parallel verification changes latency, never the required closure.
  try{await Promise.all(Array.from({length:Math.min(6,c.assets.length)},async()=>{while(next<c.assets.length){const a=c.assets[next++];await verify(a);}}));}
  catch(e){abort.abort();throw e;}finally{clearTimeout(deadline);}
  return c;
 })();
 // The boot caller waits before installing storage. No ordinary failure unlocks this fence.
 window.G2B5Boot=Object.freeze({ready,get buildId(){return c?.buildId||null;},release(){if(!c||window.G2B5_BOOT_VERIFIED!==c.buildId)throw Error('BUILD_NOT_VERIFIED');released=true;if(window.G2B5Preboot)window.G2B5Preboot.release(c.buildId);else{Storage.prototype.setItem=nativeSet;Storage.prototype.removeItem=nativeRemove;Storage.prototype.clear=nativeClear;}}});
 ready.catch(()=>{if(window.G2B5Startup){window.G2B5Startup.fail();return;}const show=()=>{const e=document.createElement('div');e.setAttribute('role','alert');e.textContent='版本或资源未通过核验，业务写入已阻止。请刷新完整版本后再试。';document.body.prepend(e);};if(document.body)show();else addEventListener('DOMContentLoaded',show,{once:true});});
})();
