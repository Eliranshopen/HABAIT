const sharp=require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/sharp');const A='C:/RnD/.wt/apartment-3d/after/gate2/';
(async()=>{for(const [n,l,t,w,h] of [['crop_desk3d',60,80,900,620],['crop_ph3d',0,200,1170,900]]){
 const f=n.includes('desk')?'desktop':'iphone13';
 const a=await sharp(A+`${f}_p1_3d.png`).extract({left:l,top:t,width:Math.min(w,1440-l),height:h}).toBuffer();
 const b=await sharp(A+`${f}_p2_3d.png`).extract({left:l,top:t,width:Math.min(w,1440-l),height:h}).toBuffer();
 const m=await sharp(a).metadata();
 await sharp({create:{width:m.width*2+6,height:m.height,channels:3,background:'#f00'}}).composite([{input:a,left:0,top:0},{input:b,left:m.width+6,top:0}]).png().toFile(A+n+'.png');}})();
