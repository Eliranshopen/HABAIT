const { spawn } = require('child_process');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT='C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT='C:/RnD/.wt/apartment-3d/after/gate4/';
(async()=>{const srv=spawn(process.execPath,['serve.mjs'],{cwd:PLAT,env:{...process.env,PORT:'8851'},stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
const p=await ctx.newPage();await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d');
const fr=await(await p.$('#dollFrame')).contentFrame();await fr.waitForFunction(()=>window.__dollhouse&&window.__dollhouse.loaded,null,{timeout:90000});
const info=await fr.evaluate(async()=>{const v=window.__dollhouseView;const o={};
 for(const f of ['marble','parquet']){v.setFloor(f);await new Promise(q=>setTimeout(q,1500));
  const r=[];v.scene.traverse(m=>{if(!m.isMesh)return;const par=m.parent&&m.parent.name;if(/floorfill/.test(par||'')||/^floor/.test(par||'')&&m.material&&0){}
   if(/floorfill/.test(par||'')){const mm=[].concat(m.material)[0];r.push({n:m.name,col:mm.color.toArray().map(x=>+x.toFixed(2)),map:mm.map&&mm.map.name||!!mm.map,lm:!!mm.lightMap,po:mm.polygonOffset});}});
  o[f]=r;
  const fl=[];v.scene.traverse(m=>{if(m.isMesh&&m.material&&[].concat(m.material)[0].name==='web_floor_parquet'&&!/floorfill/.test(m.parent&&m.parent.name||'')){const mm=[].concat(m.material)[0];if(fl.length<2)fl.push({n:m.name,par:m.parent&&m.parent.name,col:mm.color.toArray().map(x=>+x.toFixed(2)),map:!!mm.map});}});o[f+'_floors']=fl;}
 return o;});
console.log(JSON.stringify(info));
// expose floorfill only: hide non-floorfill floor meshes (those with floor materials & not floorfill)
for(const f of ['parquet','marble']){
 await fr.evaluate(async(f)=>{const v=window.__dollhouseView;v.setFloor(f);v.setPreset('top',{animate:false});v.setPreset('top',{animate:false});
  v.scene.traverse(m=>{if(!m.isMesh)return;const par=m.parent&&m.parent.name||'';const mn=[].concat(m.material)[0].name||'';
   if(/^web_floor_/.test(mn)&&!/floorfill/.test(par)){m.__v=m.visible;m.visible=false;}});},f);
 await p.waitForTimeout(3500);await p.screenshot({path:OUT+'thresh_exposed_'+f+'.png'});
 await fr.evaluate(()=>{window.__dollhouseView.scene.traverse(m=>{if(m.__v!==undefined){m.visible=m.__v;delete m.__v;}});});
}
}finally{await b.close();srv.kill();}})();
