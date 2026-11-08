const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const P2='file:///C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/media/dollhouse.html';
const OUT='C:/RnD/.wt/apartment-3d/after/gate2/';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{for(const [n,o] of [['desktop_dpr2',{viewport:{width:1000,height:700},deviceScaleFactor:2}],['desktop_dpr1_force2048',{viewport:{width:1000,height:700},deviceScaleFactor:1}]]){
 const ctx=await b.newContext(o);const p=await ctx.newPage();
 if(n.includes('force')) await p.route('**/*',r=>r.continue());
 await p.goto(P2,{waitUntil:'load'});await p.waitForFunction(()=>window.__dollhouse&&window.__dollhouse.loaded,null,{timeout:90000});
 console.log(n,JSON.stringify(await p.evaluate(()=>window.__dollhouse.lightmap)));
 await p.evaluate(()=>{window.__dollhouseView.setPreset('top',{animate:false});window.__dollhouseView.setPreset('top',{animate:false})});await p.waitForTimeout(1500);
 await p.screenshot({path:OUT+n+'_top.png'});await ctx.close();}}finally{await b.close();}})();
