const sharp=require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/sharp');
const A='C:/RnD/.wt/apartment-3d/after/';
const pairs=['3d','top','outdoor'];
(async()=>{
 const rows=[];
 for(const dev of ['desktop','phone']){
  const H=dev==='desktop'?420:560;
  const cells=[];
  for(const p of pairs){
   for(const [ph,f] of [['P1',A+`gate2/${dev==='phone'?'iphone13':dev}_p1_${p}.png`],['P2',A+`gate2/${dev==='phone'?'iphone13':dev}_p2_${p}.png`]]){
    const b=await sharp(f).resize({height:H}).png().toBuffer();const m=await sharp(b).metadata();
    cells.push({b,w:m.width,h:H});
   }}
  const W=cells.reduce((s,c)=>s+c.w+8,0);
  let x=0;const comp=cells.map(c=>{const o={input:c.b,left:x,top:0};x+=c.w+8;return o;});
  rows.push({buf:await sharp({create:{width:W,height:H,channels:3,background:'#888'}}).composite(comp).png().toBuffer(),W,H});
 }
 const W=Math.max(...rows.map(r=>r.W));let y=0;
 await sharp({create:{width:W,height:rows.reduce((s,r)=>s+r.H+10,0),channels:3,background:'#444'}}).composite(rows.map(r=>{const o={input:r.buf,left:0,top:y};y+=r.H+10;return o;})).png().toFile('C:/RnD/.wt/apartment-3d/after/compare.png');
 console.log('ok',W);
})();
