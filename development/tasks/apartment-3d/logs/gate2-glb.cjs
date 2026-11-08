const fs=require('fs'),crypto=require('crypto');
const WT='C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/engine/_local/apt846/dollhouse/';
const LV='C:/RnD/Projects/Habait/habait-walkaround/Habait/engine/_local/apt846/dollhouse/';
function parse(f){const b=fs.readFileSync(f);let o=12,json,bin;while(o<b.length){const l=b.readUInt32LE(o),t=b.readUInt32LE(o+4);const d=b.subarray(o+8,o+8+l);if(t==0x4E4F534A)json=JSON.parse(d.toString());else if(t==0x004E4942)bin=d;o+=8+l;}
 return {json,bin,hash:bin?crypto.createHash('sha256').update(bin).digest('hex'):null,len:bin&&bin.length};}
const out=[];const P=(s)=>{console.log(s);out.push(s)};
const names=['apt846-parquet','apt846-concrete','apt846-marble'];
const g={};for(const n of names){g[n]=parse(WT+n+'.glb');P(`${n} bin ${g[n].len} ${g[n].hash.slice(0,16)} nBuffers ${g[n].json.buffers.length}`);}
P('one shared BIN: '+(new Set(names.map(n=>g[n].hash)).size===1));
const live=parse(LV+'apt846-parquet.glb'); const wt=g['apt846-parquet'];
function nodes(j){const r={};j.nodes.forEach((n,i)=>{let b=null;if(n.mesh!=null){const m=j.meshes[n.mesh];let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],tris=0;for(const p of m.primitives){const a=j.accessors[p.attributes.POSITION];for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],a.min[k]);mx[k]=Math.max(mx[k],a.max[k]);}if(p.indices!=null)tris+=j.accessors[p.indices].count/3;}b={mn,mx,tris};}r[n.name]={b,t:n.translation,s:n.scale,r:n.rotation,ch:(n.children||[]).length};});return r;}
const A=nodes(live.json),B=nodes(wt.json);
let diffs=0;const ks=new Set([...Object.keys(A),...Object.keys(B)]);P('nodes live '+Object.keys(A).length+' wt '+Object.keys(B).length);
for(const k of ks){const a=A[k],b=B[k];if(!a||!b){P('MISSING '+k+' live '+!!a+' wt '+!!b);diffs++;continue;}
 if(JSON.stringify([a.t,a.s,a.r,a.ch])!==JSON.stringify([b.t,b.s,b.r,b.ch])){P('XFORM DIFF '+k);diffs++;}
 if(!!a.b!==!!b.b){P('MESH PRESENCE '+k);diffs++;continue;}
 if(a.b){if(a.b.tris!==b.b.tris){P(`TRIS ${k} ${a.b.tris} vs ${b.b.tris}`);diffs++;}
  let md=0;for(let i=0;i<3;i++){md=Math.max(md,Math.abs(a.b.mn[i]-b.b.mn[i]),Math.abs(a.b.mx[i]-b.b.mx[i]));}
  if(md>0.005){P(`BOUNDS ${k} maxdiff ${md}`);diffs++;}}}
P('node diffs: '+diffs);
// report.json
const rl=JSON.parse(fs.readFileSync(LV+'report.json')),rw=JSON.parse(fs.readFileSync(WT+'report.json'));
let rd=0;for(const k of new Set([...Object.keys(rl.nodes||{}),...Object.keys(rw.nodes||{})])){const a=rl.nodes[k],b=rw.nodes[k];if(JSON.stringify(a&&a.triangles)!==JSON.stringify(b&&b.triangles)){P('REPORT TRI DIFF '+k+' '+JSON.stringify(a)+' | '+JSON.stringify(b));rd++;}}
P('report nodes live '+Object.keys(rl.nodes).length+' wt '+Object.keys(rw.nodes).length+' tri diffs '+rd);
P('report totals live '+JSON.stringify(Object.fromEntries(Object.entries(rl).filter(([k,v])=>typeof v!=='object')))+'\n wt '+JSON.stringify(Object.fromEntries(Object.entries(rw).filter(([k,v])=>typeof v!=='object'))));
P('report keys wt-only: '+Object.keys(rw).filter(k=>!(k in rl)).join(','));
// materials & lightmap UV
P('wt materials '+wt.json.materials.map(m=>m.name).join(','));
const hasUV=wt.json.meshes.flatMap(m=>m.primitives).filter(p=>p.attributes.TEXCOORD_0!=null).length, tot=wt.json.meshes.flatMap(m=>m.primitives).length;
P(`wt prims with TEXCOORD_0 ${hasUV}/${tot}`);
const mats=new Set();wt.json.meshes.forEach(m=>m.primitives.forEach(p=>{if(p.attributes.TEXCOORD_0==null)mats.add(wt.json.materials[p.material].name)}));P('materials on prims WITHOUT UV: '+[...mats].join(','));
fs.writeFileSync(__dirname+'/gate2-geometry.txt',out.join('\n')+'\n');
