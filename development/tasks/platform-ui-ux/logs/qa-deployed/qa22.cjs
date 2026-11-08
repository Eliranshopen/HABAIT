const fs=require('fs');
const {chromium}=require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const BASE='https://habait-flow.vercel.app';
const OUT='C:/RnD/development/tasks/platform-ui-ux/logs/qa-deployed/';
const PAGES=['/','/landing.html?project=rainbow','/landing.html?project=rainbow&v=b','/apartment.html?project=rainbow&unit=846','/apartment.html?project=rainbow&unit=846&tab=3d','/flow.html?project=rainbow'];
(async()=>{
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[];let n=0;
for(const vp of [1440,390])for(const path of PAGES){
 const ctx=await b.newContext({viewport:{width:vp,height:vp===390?844:900},locale:'he-IL',isMobile:vp===390,hasTouch:vp===390});
 const p=await ctx.newPage();const net=[],errs=[],gf=[];
 p.on('response',r=>net.push({s:r.status(),u:r.url(),ct:r.headers()['content-type']||''}));
 p.on('request',r=>{if(/fonts\.(googleapis|gstatic)\.com/.test(r.url()))gf.push(r.url())});
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
 let status=0;
 try{const r=await p.goto(BASE+path,{waitUntil:'load',timeout:60000});status=r?r.status():0}catch(e){errs.push('goto '+e.message.split('\n')[0])}
 await p.waitForTimeout(3000);await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){scrollTo(0,y);await new Promise(r=>setTimeout(r,150))}scrollTo(0,0)}).catch(()=>{});await p.waitForTimeout(1500);
 const info=await p.evaluate(()=>{
  const txt=document.body?document.body.innerText:'';
  const imgs=[...document.querySelectorAll('img')].map(i=>({src:i.currentSrc||i.src,ok:i.complete&&i.naturalWidth>0,vis:i.getBoundingClientRect().width>0,alt:i.alt}));
  const bg=[...document.querySelectorAll('*')].map(e=>getComputedStyle(e).backgroundImage).filter(x=>x&&x!=='none'&&/url/.test(x));
  const badges=[...document.querySelectorAll('.hb-ai-badge')].map(e=>({t:e.textContent.trim(),vis:e.getBoundingClientRect().width>0}));
  return {fontsOk:document.fonts.check('16px Heebo'),devText:/תצוגת פיתוח|placeholders/.test(txt),sw:document.documentElement.scrollWidth,w:innerWidth,
   imgs,bgCount:bg.length,clayImgs:imgs.filter(i=>/clay/i.test(i.src)).map(i=>i.src).concat(bg.filter(x=>/clay/i.test(x))),brokenImgs:imgs.filter(i=>!i.ok).map(i=>i.src),
   badges,badgeBad:badges.filter(x=>!/הדמיה/.test(x.t)||!/AI-generated/.test(x.t)).length,
   canvasCount:document.querySelectorAll('canvas').length,title:document.title,len:txt.length};
 }).catch(e=>({evalErr:e.message}));
 const shot=`${OUT}f-${vp}-${n}.png`;await p.screenshot({path:shot}).catch(()=>{});
 const bad=net.filter(x=>x.s>=400);
 rows.push({vp,path,status,bad,errs,gf:gf.length,reqs:net.length,dist:net.filter(x=>/_local\/dist\//.test(x.u)).length,distBad:bad.filter(x=>/_local\/dist\//.test(x.u)).length,shot,...info});
 fs.writeFileSync(`${OUT}net-${vp}-${n}.json`,JSON.stringify(net,null,1));
 n++;await ctx.close();
}
await b.close();
fs.writeFileSync(OUT+'results.json',JSON.stringify(rows,null,1));
for(const r of rows){const {imgs,...s}=r;console.log(JSON.stringify({vp:r.vp,path:r.path,status:r.status,bad:r.bad.map(x=>x.s+' '+x.u.replace(BASE,'')),errs:r.errs,gf:r.gf,fonts:r.fontsOk,dev:r.devText,sw:r.sw+'/'+r.w,reqs:r.reqs,dist:r.dist,distBad:r.distBad,clay:r.clayImgs,broken:r.brokenImgs.length,badges:r.badges.length,badgeBad:r.badgeBad,imgs:r.imgs.length,canvas:r.canvasCount}))}
})();
