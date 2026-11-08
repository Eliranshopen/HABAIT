const { spawn } = require('child_process'); const fs=require('fs');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT='C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
(async()=>{const srv=spawn(process.execPath,['serve.mjs'],{cwd:PLAT,env:{...process.env,PORT:'8851'},stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const out={};
try{
 for(const [name,dev] of [['desktop',{viewport:{width:1440,height:900}}],['iphone13',devices['iPhone 13']]]){
  const orders=[['concrete','parquet'],['marble','concrete'],['parquet','marble','concrete','parquet'],['marble','parquet','marble'],['concrete','marble','parquet','concrete','marble']];
  const res=[];
  for(const seq of orders){
   const ctx=await b.newContext(dev);const p=await ctx.newPage();
   await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d');
   const fr=await(await p.$('#dollFrame')).contentFrame();
   await fr.waitForFunction(()=>window.__dollhouse&&window.__dollhouse.loaded,null,{timeout:90000});
   const r=await fr.evaluate(async(seq)=>{const v=window.__dollhouseView,st=window.__dollhouse;
     for(const s of seq)v.setFloor(s);
     await new Promise(q=>setTimeout(q,1500));
     return {seq,floor:st.floor,tex:st.floorTexture.current,color:st.floorColor};},seq);
   res.push(r);await ctx.close();
  }
  // D3 across floors, and timed-gap sequence
  const ctx=await b.newContext(dev);const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d');
  const fr=await(await p.$('#dollFrame')).contentFrame();
  await fr.waitForFunction(()=>window.__dollhouse&&window.__dollhouse.loaded,null,{timeout:90000});
  const d3=await fr.evaluate(async()=>{const v=window.__dollhouseView,st=window.__dollhouse;const o=[];
    for(const f of ['marble','concrete','parquet']){v.setFloor(f);await new Promise(q=>setTimeout(q,1200));o.push({f,floor:st.floor,tex:st.floorTexture.current,color:st.floorColor});}
    // staggered: request A, 30ms later B
    v.setFloor('marble');await new Promise(q=>setTimeout(q,30));v.setFloor('concrete');await new Promise(q=>setTimeout(q,1500));o.push({stag:1,floor:st.floor,tex:st.floorTexture.current});
    return o;});
  const ff=await fr.evaluate(()=>{const v=window.__dollhouseView;const o=[];v.scene.traverse(m=>{if(m.isMesh&&/floorfill|ceilfill/i.test(m.name+(m.parent&&m.parent.name))){for(const mm of [].concat(m.material))o.push({n:m.name,p:m.parent&&m.parent.name,mat:mm.name,po:mm.polygonOffset,pof:mm.polygonOffsetFactor,pou:mm.polygonOffsetUnits,vis:m.visible,cs:m.castShadow});}});return o.slice(0,12);});
  out[name]={race:res,d3,ff};await ctx.close();
 }
}finally{await b.close();srv.kill();}
console.log(JSON.stringify(out,null,1));})();
