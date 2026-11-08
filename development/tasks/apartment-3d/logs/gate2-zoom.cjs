const sharp=require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/sharp');const A='C:/RnD/.wt/apartment-3d/after/gate2/';
(async()=>{const m=await sharp(A+'iphone13_p2_top.png').metadata();console.log(m.width,m.height);
 const L=Math.round(m.width*0.25),T=Math.round(m.height*0.3),W=Math.round(m.width*0.5),H=Math.round(m.height*0.3);
 const a=await sharp(A+'iphone13_p1_top.png').extract({left:L,top:T,width:W,height:H}).toBuffer();
 const b=await sharp(A+'iphone13_p2_top.png').extract({left:L,top:T,width:W,height:H}).toBuffer();
 await sharp({create:{width:W,height:H*2+6,channels:3,background:'#f00'}}).composite([{input:a,left:0,top:0},{input:b,left:0,top:H+6}]).png().toFile(A+'crop_ph_top_zoom.png');})();
