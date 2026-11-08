// gate 2: true A/B. P1 = fallback build (live Phase-1 GLB, no atlas); P2 = baked build. Same viewer code, same presets.
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs=require('fs');
const OUT='C:/RnD/.wt/apartment-3d/after/gate2/'; fs.mkdirSync(OUT,{recursive:true});
const P1='file:///C:/Users/elira/AppData/Local/Temp/claude/76e6db1160dffba0/14c075f3-6b12-4fcf-9ea7-0c64802c7db7/scratchpad/fallback-dist/media/dollhouse.html';
const P2='file:///C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/media/dollhouse.html';
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const log=[];
 try{
  for(const [dn,opts] of [['desktop',{viewport:{width:1440,height:900}}],['iphone13',devices['iPhone 13']]]){
   for(const [pn,url] of [['p1',P1],['p2',P2]]){
    const ctx=await b.newContext(opts);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    const reqs=[];p.on('request',r=>{if(!r.url().startsWith('file:')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))reqs.push(r.url())});
    await p.goto(url,{waitUntil:'load'});await p.waitForFunction(()=>window.__dollhouse&&window.__dollhouse.loaded,null,{timeout:90000});
    const info=await p.evaluate(()=>{const v=window.__dollhouseView;const lm=[],nolm=[];const seen=new Set();v.scene.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){if(seen.has(m))continue;seen.add(m);(m.lightMap?lm:nolm).push(m.name)}});return {lm,nolm,L:window.__dollhouse.lightmap,dpr:devicePixelRatio,mem:navigator.deviceMemory}});
    log.push(`${dn} ${pn}: lightMap on [${info.lm.join(',')}] none on [${info.nolm.join(',')}] info=${JSON.stringify(info.L)} dpr=${info.dpr} mem=${info.mem} errs=${errs.length} nonlocal reqs=${reqs.length}`);
    for(const pr of ['3d','top','outdoor']){
     await p.evaluate(id=>{window.__dollhouseView.setPreset(id,{animate:false});window.__dollhouseView.setPreset(id,{animate:false})},pr);
     await p.waitForTimeout(1200);
     await p.screenshot({path:`${OUT}${dn}_${pn}_${pr}.png`});
    }
    await ctx.close();
   }}
 }finally{await b.close();}
 console.log(log.join('\n'));fs.writeFileSync(__dirname+'/gate2-ab.txt',log.join('\n')+'\n');
})();
