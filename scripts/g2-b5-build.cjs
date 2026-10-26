'use strict';
// Source-only static closure. No directory copying or reads outside the allowlist.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ASSETS=Object.freeze(['manifest.json','icons/icon-192.svg','icons/icon-512.svg',
 'styles/base.css','styles/layout.css','styles/components.css',
 'assets/ui2/foundations.css','assets/ui2/components.css','assets/ui2/pages.css','assets/ui2/business-records.css',
 ...['g2-b1-core','g2-b2-entry','g2-b2-core','g2-b2-bindings','g2-b2-ui','g2-b2-legacy','g2-b3-core','g2-b3-bindings','g2-b3-ui','g2-b4-core','g2-b4-bindings','g2-b4-ui','g2-b5-core','g2-b5-storage','g2-b5-bindings','g2-b5-sync','g2-b5-ui'].map(x=>'scripts/'+x+'.js')]);
const START='/* I06_BOOT_CONTRACT_START */',END='/* I06_BOOT_CONTRACT_END */';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const mime=p=>p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.json')?'application/json':'text/html';
function read(root,rel){if(!['index.html',...ASSETS].includes(rel))throw Error('NOT_ALLOWLISTED');const p=path.resolve(root,rel),s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isFile()||!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))throw Error('UNSAFE_SOURCE');return fs.readFileSync(p);}
function contract(root){const assets=ASSETS.map(p=>{const b=read(root,p);return {path:p,sha256:hash(b),bytes:b.length,mime:mime(p),required:true};});const template=read(root,'index.html').toString('utf8').replace(/\/\* I06_BOOT_CONTRACT_START \*\/[\s\S]*?\/\* I06_BOOT_CONTRACT_END \*\//,START+END).replace(/\s+integrity=["'][^"']*["']/g,'');return {version:1,buildId:'g2-b5-i06-'+hash(Buffer.from(JSON.stringify(assets)+template)).slice(0,16),schemaVersion:2,exchangeRevision:1,assets};}
function stamp(html,c){const a=html.indexOf(START),b=html.indexOf(END);if(a<0||b<a)throw Error('SOURCE_BOOT_MARKERS_MISSING');let result=html.slice(0,a+START.length)+'window.G2B5_BOOT_CONTRACT='+JSON.stringify(c)+';'+html.slice(b);return result.replace(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/g,(tag,url)=>{const asset=c.assets.find(x=>x.path===url.split(/[?#]/)[0]);if(!asset||!['application/javascript','text/css'].includes(asset.mime))return tag;return tag.replace(/\s+integrity=["'][^"']*["']/g,'').replace(/>$/,' integrity="sha256-'+Buffer.from(asset.sha256,'hex').toString('base64')+'">');});}
function closure(html,assets){const refs=[];const add=(from,url)=>{if(!url||url.startsWith('data:')||url.startsWith('#'))return;if(/^(https?:)?\/\//.test(url))throw Error('EXTERNAL_STATIC_DEPENDENCY');const rel=path.posix.normalize(path.posix.join(path.posix.dirname(from),url.split(/[?#]/)[0]));if(rel==='.'||rel==='index.html')return;if(!ASSETS.includes(rel))throw Error('UNDECLARED_RESOURCE:'+rel);refs.push({from,to:rel,required:true});};
 for(const m of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g))add('index.html',m[1]);
 for(const m of html.matchAll(/(?:['"])(scripts\/g2-[a-z0-9-]+\.js)(?:['"])/g))add('index.html',m[1]);
 for(const [rel,bytes]of assets)if(rel.endsWith('.css'))for(const m of bytes.toString().matchAll(/(?:url\(\s*['"]?([^)'"\s]+)|@import\s+['"]([^'"]+))/g))add(rel,m[1]||m[2]);
 const manifest=JSON.parse(assets.get('manifest.json'));for(const icon of manifest.icons||[])add('manifest.json',icon.src);
 return refs;
}
function build(root,dest){if(fs.existsSync(dest))throw Error('DESTINATION_EXISTS');const c=contract(root),html=read(root,'index.html').toString('utf8');const assets=new Map(ASSETS.map(p=>[p,read(root,p)])),relations=closure(html,assets);const output=stamp(html,c);fs.mkdirSync(dest,{recursive:true});for(const[p,b]of [['index.html',Buffer.from(output)],...assets]){const file=path.join(dest,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b,{flag:'wx'});}return {...c,index:{path:'index.html',sha256:hash(Buffer.from(output)),bytes:Buffer.byteLength(output),mime:'text/html',required:true},relations,source:'source index.html; never runtime outerHTML',excludedByAllowlist:['data.json','tests','docs','prototypes','.git','credentials','backups','logs'],published:false};}
module.exports={ASSETS,contract,stamp,closure,build,hash,mime};
if(require.main===module){const [root,dest,report]=process.argv.slice(2);if(!root||!dest||!report)throw Error('Explicit source, isolated destination and report required');fs.writeFileSync(report,JSON.stringify(build(path.resolve(root),path.resolve(dest)),null,2),{flag:'wx'});}
