// gate 2 rider (a): relative exterior.url in a real browser (route-intercepted apartment.json), fixed vs LIVE js/apartment.js
const { spawn } = require('child_process'); const fs=require('fs');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT='C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const LIVEJS=fs.readFileSync('C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/js/apartment.js','utf8');
const URLP='http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846';
(async()=>{
 const srv=spawn(process.execPath,['serve.mjs'],{cwd:PLAT,env:{...process.env,PORT:'8851'},stdio:'ignore'});
 await new Promise(r=>setTimeout(r,1200));
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const out=[];
 try{
  for(const [label,extUrl,useLive] of [['fixed + relative /hold','/hold',false],['fixed + absolute','http://127.0.0.1:8899/',false],['LIVE js + relative /hold (expect failure)','/hold',true]]){
   const ctx=await b.newContext(devices['iPhone 13']);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
   await p.route('**/apartment.json',async r=>{const resp=await r.fetch();const j=await resp.json();j.project=j.project||{};j.project.exterior={mode:'external',url:extUrl,params:{from:'platform'}};await r.fulfill({response:resp,json:j});});
   if(useLive) await p.route('**/js/apartment.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:LIVEJS}));
   await p.goto(URLP,{waitUntil:'load'});await p.waitForTimeout(3500);
   const s=await p.evaluate(()=>{const tabs=[...document.querySelectorAll('[role=tab],.tabs button,.tab')].filter(e=>e.offsetParent);const links=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/hold|8899|flow\.html/.test(h));return {tabs:tabs.length,tabText:tabs.map(t=>t.textContent.trim()).join('|'),links:[...new Set(links)].slice(0,6),bodyErr:/Invalid URL/.test(document.body.innerText)}});
   out.push(`${label}: tabs visible=${s.tabs} [${s.tabText}] links=${JSON.stringify(s.links)} "Invalid URL" on page=${s.bodyErr} pageerrors=${JSON.stringify(errs)}`);
   await p.screenshot({path:`C:/RnD/.wt/apartment-3d/after/gate2/urlfix_${useLive?'live':extUrl.startsWith('/')?'rel':'abs'}.png`});
   await ctx.close();}
 }finally{await b.close();srv.kill();}
 console.log(out.join('\n'));fs.writeFileSync(__dirname+'/gate2-urlfix.txt',out.join('\n')+'\n');
})();
