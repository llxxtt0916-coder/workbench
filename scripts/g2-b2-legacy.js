/* Keep existing B3/B4 pages reachable while all work-core navigation uses G1.5 surfaces. */
(() => {
 openSmartModal=function(){if(window.g2B2Enabled&&window.G2B2_UI_OPEN_SMART){window.G2B2_UI_OPEN_SMART();return;}location.href='index.html#work?smart=1';};
 if(window.g2B2Enabled)return;
 const original=navigate,core={dashboard:'dashboard',todo:'ledger','待办':'work','长期目标':'goals','monthly-summary':'monthly',meeting:'meeting',training:'training',handover:'handover',purchase:'purchase',contract:'contract',expense:'expense',agency:'agency',fund:'fund',inspiration:'inspiration',config:'config',settings:'settings'};
 navigate=function(page,...args){if(core[page]){location.href='index.html#'+core[page];return;}return original(page,...args);};
 function applyLegacyHash(){const target=location.hash.slice(1);if(core[target]){location.href='index.html#'+core[target];return;}if(target.startsWith('smart:')&&core[target.slice(6)]){location.href='index.html#'+core[target.slice(6)]+'?new=1';return;}if(target.startsWith('linked/')){const [,source,id,key]=target.split('/');if(LINKED_NEW_PATHS[source]?.includes(key))openLinkedNewRecord(source,decodeURIComponent(id),key);return;}if(target&&document.getElementById('page-'+target))original(target);}
 window.addEventListener('hashchange',applyLegacyHash);applyLegacyHash();
})();
