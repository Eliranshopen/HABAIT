const fs=require('fs');
const {chromium}=require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const B='https://habait-flow.vercel.app';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const out=[];
for(const vp of [1440,390]){
 for(const v of ['a','b']){const c=await b.newContext({viewport:{width:vp,height:vp==390?844:900},locale:'he-IL'});const p=await c.newPage();
  await p.goto(`${B}/landing.html?project=rainbow&v=${v}`,{waitUntil:'load'});await p.waitForTimeout(5000);
  await p.screenshot({path:`g-landing-v${v}-${vp}.png`});
  const gal=await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){scrollTo(0,y);await new Promise(r=>setTimeout(r,200))}await new Promise(r=>setTimeout(r,1500));
   const im=[...document.querySelectorAll('img')].filter(i=>i.getBoundingClientRect().width>0);return im.map(i=>({s:i.currentSrc.split('/').slice(-3).join('/'),ok:i.complete&&i.naturalWidth>0}))});
  out.push({vp,v,gal});await c.close();}
 const c=await b.newContext({viewport:{width:vp,height:vp==390?844:900},locale:'he-IL'});const p=await c.newPage();const bad=[];
 p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});
 await p.goto(`${B}/apartment.html?project=rainbow&unit=846`,{waitUntil:'load'});await p.waitForTimeout(2500);
 await p.getByText('תמונות',{exact:true}).first().click();await p.waitForTimeout(3500);
 await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){scrollTo(0,y);await new Promise(r=>setTimeout(r,200))}await new Promise(r=>setTimeout(r,1500))});
 const st=await p.evaluate(()=>{const im=[...document.querySelectorAll('img')].filter(i=>i.getBoundingClientRect().width>0);return {n:im.length,ok:im.filter(i=>i.complete&&i.naturalWidth>0).length,clay:im.filter(i=>/clay/i.test(i.currentSrc)).length,badges:[...document.querySelectorAll('.hb-ai-badge')].filter(e=>e.getBoundingClientRect().width>0).length}});
 await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`g-apt-stills-${vp}.png`});
 out.push({vp,apt:st,bad});await c.close();}
await b.close();fs.writeFileSync('results-b.json',JSON.stringify(out,null,1));console.log(JSON.stringify(out.map(o=>o.gal?{vp:o.vp,v:o.v,n:o.gal.length,ok:o.gal.filter(x=>x.ok).length,clay:o.gal.filter(x=>/clay/i.test(x.s)).length}:o)))})();
