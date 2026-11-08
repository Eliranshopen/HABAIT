const { spawn } = require('child_process'); const fs=require('fs');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT='C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
(async()=>{
 const srv=spawn(process.execPath,['serve.mjs'],{cwd:PLAT,env:{...process.env,PORT:'8851'},stdio:'ignore'});
 await new Promise(r=>setTimeout(r,1200));
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const out=[];
 try{
  for(const dev of ['Pixel 7','iPhone 13']){
   const ctx=await b.newContext(devices[dev]);await ctx.route('http://127.0.0.1:8848/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<p>stub</p>'}));
   const p=await ctx.newPage();await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d',{waitUntil:'load'});
   const fr=await(await p.$('#dollFrame')).contentFrame();
   await fr.waitForFunction(()=>window.__dollhouse&&window.__dollhouse.loaded,null,{timeout:90000});
   await fr.evaluate(()=>{window.__dollhouseView.setPreset('top',{animate:false});window.__dollhouseView.setPreset('top',{animate:false})});
   await p.waitForTimeout(2500);
   const r=await fr.evaluate(()=>{const v=window.__dollhouseView,st=window.__dollhouse;const V=v.camera.position.constructor;
    const cv=v.renderer.domElement.getBoundingClientRect();
    const labs=[...document.querySelectorAll('.dh-label')].map(l=>{const bb=l.getBoundingClientRect();return {id:l.dataset.room,hidden:l.hidden,vis:getComputedStyle(l).visibility,disp:getComputedStyle(l).display,x:bb.x+bb.width/2,y:bb.y+bb.height/2,w:bb.width,h:bb.height,l:bb.left,r:bb.right,t:bb.top,b:bb.bottom}});
    const res=labs.map(l=>{const room=st.rooms.find(q=>q.id===l.id);const pr=new V(room.centre[0],room.centre[1],room.centre[2]).project(v.camera);const ax=(pr.x*.5+.5)*cv.width+cv.left,ay=(-pr.y*.5+.5)*cv.height+cv.top;return {...l,ax,ay,d:Math.hypot(l.x-ax,l.y-ay)/l.h,inFrame:l.l>=-1&&l.r<=innerWidth+1&&l.t>=-1&&l.b<=innerHeight+1};});
    let ov=0;for(let i=0;i<res.length;i++)for(let j=i+1;j<res.length;j++){const a=res[i],c=res[j];if(a.hidden||c.hidden)continue;if(a.l<c.r&&c.l<a.r&&a.t<c.b&&c.t<a.b)ov++;}
    return {n:st.labelsVisible,total:res.length,shown:res.filter(x=>!x.hidden&&x.disp!=='none').length,maxd:Math.max(...res.map(x=>x.d)),far:res.filter(x=>x.d>2.5).map(x=>x.id+':'+x.d.toFixed(2)),outFrame:res.filter(x=>!x.inFrame).map(x=>x.id),overlaps:ov,ds:res.map(x=>x.id+'='+x.d.toFixed(2)).join(' ')}});
   out.push(`${dev}: labelsVisible=${r.n}, DOM shown ${r.shown}/${r.total}, max anchor distance ${r.maxd.toFixed(2)} label-heights, far(>2.5)=${JSON.stringify(r.far)}, outside frame=${JSON.stringify(r.outFrame)}, overlapping pairs=${r.overlaps}\n   ${r.ds}`);
   await p.screenshot({path:`C:/RnD/.wt/apartment-3d/after/gate2/labels_${dev.replace(/\s/g,'').toLowerCase()}_top.png`});await ctx.close();}
 }finally{await b.close();srv.kill();}
 console.log(out.join('\n'));fs.writeFileSync(__dirname+'/gate2-labels.txt',out.join('\n')+'\n');
})();
