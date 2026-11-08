const fs=require('fs');
function pj(f){const b=fs.readFileSync(f);const l=b.readUInt32LE(12);return JSON.parse(b.subarray(20,20+l).toString());}
const a=pj('C:/RnD/Projects/Habait/habait-walkaround/Habait/engine/_local/apt846/dollhouse/apt846-parquet.glb'),b=pj('C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/engine/_local/apt846/dollhouse/apt846-parquet.glb');
const A={},B={};a.materials.forEach(m=>A[m.name]=m);b.materials.forEach(m=>B[m.name]=m);
for(const k of Object.keys(B)){const x=A[k]&&A[k].pbrMetallicRoughness,y=B[k].pbrMetallicRoughness;const same=JSON.stringify(x)===JSON.stringify(y)&&JSON.stringify(A[k].emissiveFactor)===JSON.stringify(B[k].emissiveFactor)&&A[k].alphaMode===B[k].alphaMode;console.log(k,same?'same':'DIFF '+JSON.stringify(x)+' -> '+JSON.stringify(y));}
