// skilllook.js — the realistic look: the day-night-keyframes skill's mode B (walk_bake.py + walk_keyframes.py) baked the
// real light (Cycles: sun, sky, bounce between walls, soft shadows) and the colour of every wall, floor, ceiling and fixture
// into atlases, one set per keyframe of the clock, on the SAME model. Here the browser shows them and cross-fades the two
// keyframes around the hour in linear light — the skill viewer's mixMat, unchanged in idea. Furniture and accessories are
// 'walk_live' in the bake (their shadows are in the atlases) and stay live here, so the swap circles keep working. $0.
// Media: skill/model/walk.gltf + skill/media/<key>/bake_<g>.jpg (+ _1k on phones), written by the skill's sync_media.py.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadSkillLook({ scene, renderer, phone, MAT }) {
  let cfg;
  try { const r = await fetch('./skill/daynight.json'); if (!r.ok) return null; cfg = await r.json(); } catch { return null; }
  const loader = new GLTFLoader();
  if (phone) loader.manager.setURLModifier((u) => u.replace(/(bake_\d+)\.jpg$/, '$1_1k.jpg'));
  const gltf = await loader.loadAsync('./skill/model/walk.gltf');
  const baked = [];
  // the floor (the skill's floor group): kept LIVE — its marble texture and finish swaps — under the baked light only
  // (bake_<g>_shade.png = shade^2.2 / 5, linear; MeshBasic's lightmap carries a 1/PI, so the intensity is 5·PI)
  let floorCfg = null; try { const r = await fetch('./skill/model/floor.json'); if (r.ok) floorCfg = await r.json(); } catch {}
  const floor = { mats: [], baked: [], g: floorCfg ? floorCfg.group : -1 }; const baked_floor_list = [];
  function floorMat(geo, mw) {
    geo.setAttribute('uv1', geo.attributes.uv);   // the bake's own UVs -> the lightmap channel
    const p = geo.attributes.position, uv = new Float32Array(p.count * 2), v = new THREE.Vector3(), rep = MAT.tile80.userData.rep || 1;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mw); uv[i * 2] = v.x * rep; uv[i * 2 + 1] = v.z * rep; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mat = new THREE.MeshBasicMaterial({ map: MAT.tile80.map, color: MAT.tile80.color.clone(), lightMapIntensity: 5 * Math.PI });
    mat.userData.u = { lightMap2: { value: null }, uMix: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, mat.userData.u);
      sh.fragmentShader = 'uniform sampler2D lightMap2;\nuniform float uMix;\n' + sh.fragmentShader.replace('vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );',
        'vec4 lightMapTexel = mix( texture2D( lightMap, vLightMapUv ), texture2D( lightMap2, vLightMapUv ), uMix );');
    };
    floor.mats.push(mat); return mat;
  }
  function mixMat(map) {   // MeshBasic whose map is mix(map, map2, uMix): both sRGB, so the mix is in linear light
    const mat = new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.DoubleSide });   // the atlases are already display pictures (Blender's view transform)
    mat.userData.u = { map2: { value: map }, uMix: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, mat.userData.u);
      sh.fragmentShader = 'uniform sampler2D map2;\nuniform float uMix;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        '#ifdef USE_MAP\n vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(map2, vMapUv), uMix);\n diffuseColor *= sampledDiffuseColor;\n#endif');
    };
    return mat;
  }
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material, n = (m && m.name) || '';
    if (n.startsWith('WALK_baked') && +n.split('_').pop() === floor.g) {
      // the floor: its baked atlas (with the photo skin at noon) by default; the live marble under the baked light once the visitor swaps the finish
      o.updateWorldMatrix(true, false); const geoLive = o.geometry.clone(), live = floorMat(geoLive, o.matrixWorld); const baked = mixMat(m.map); const geoBaked = o.geometry;
      baked.userData.liveTwin = live; o.material = baked; baked.userData.mesh = o; baked.userData.baseMap = MAT.tile80.map;
      floor.baked.push({ mat: baked, g: floor.g, proto: m.map, mesh: o, live, geoLive, geoBaked }); baked_floor_list.push({ mat: baked, g: floor.g, proto: m.map });
    }
    else if (n.startsWith('WALK_baked')) { o.material = mixMat(m.map); baked.push({ mat: o.material, g: +n.split('_').pop(), proto: m.map }); }
    else if (n === 'WALK_glass') { o.material = MAT.glass; o.renderOrder = 2; }
    else if (/curtain/i.test(o.name) || /curtain/i.test(n)) { o.material = MAT.curtain; o.renderOrder = 3; }
    else if (/spot|shade/i.test(n)) { o.material = new THREE.MeshBasicMaterial({ color: 0xfff4e6 }); }
    o.castShadow = false; o.receiveShadow = false;
  });
  gltf.scene.name = 'SKILL_baked'; scene.add(gltf.scene);
  const tl = new THREE.TextureLoader(), cache = new Map();
  const atlas = (key, b) => {
    const url = `./skill/media/${key}/bake_${b.g}${phone ? '_1k' : ''}.jpg`;
    if (!cache.has(url)) cache.set(url, tl.loadAsync(url).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.wrapS = b.proto.wrapS; t.wrapT = b.proto.wrapT; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; }));
    return cache.get(url);
  };
  const shade = (key) => { const url = `./skill/media/${key}/bake_${floor.g}_shade.png`;
    if (!cache.has(url)) cache.set(url, tl.loadAsync(url).then((t) => { t.flipY = false; t.channel = 1; t.colorSpace = THREE.NoColorSpace; return t; }));
    return cache.get(url); };
  const have = new Set(cfg.keys.map((k) => k.name));
  let seq = 0;
  return {
    sync() {   // finish swaps: a changed floor finish switches the floor to the live marble (or parquet...) under the baked light
      for (const f of floor.baked) { const changed = MAT.tile80.map !== f.mat.userData.baseMap || !MAT.tile80.color.equals(new THREE.Color(1, 1, 1)); const want = changed ? f.live : f.mat; if (f.mesh.material !== want) { f.mesh.material = want; f.mesh.geometry = changed ? f.geoLive : f.geoBaked; } }
      for (const fm of floor.mats) { if (fm.map !== MAT.tile80.map) { fm.map = MAT.tile80.map; fm.needsUpdate = true; } fm.color.copy(MAT.tile80.color); }
    },
    keys: cfg.keys,
    async mix(a, b, t) {   // a, b: keyframe names (daynight.js uses the skill's names); a key not baked yet falls back to its neighbour
      if (!have.has(a)) a = b; if (!have.has(b)) b = a; if (!have.has(a)) return;
      const my = ++seq;
      const [ta, tb] = await Promise.all([Promise.all(baked.map((x) => atlas(a, x))), Promise.all(baked.map((x) => atlas(b, x)))]);
      if (my !== seq) return;
      baked.forEach((x, i) => { x.mat.map = ta[i]; x.mat.userData.u.map2.value = tb[i]; x.mat.userData.u.uMix.value = t; });
      if (baked_floor_list.length) { const [fa, fb] = await Promise.all([Promise.all(baked_floor_list.map((x) => atlas(a, x))), Promise.all(baked_floor_list.map((x) => atlas(b, x)))]); if (my !== seq) return;
        baked_floor_list.forEach((x, i) => { x.mat.map = fa[i]; x.mat.userData.u.map2.value = fb[i]; x.mat.userData.u.uMix.value = t; }); }
      if (floor.mats.length) { const [sa, sb] = await Promise.all([shade(a), shade(b)]); if (my !== seq) return;
        for (const fm of floor.mats) { const first = !fm.lightMap; fm.lightMap = sa; fm.userData.u.lightMap2.value = sb; fm.userData.u.uMix.value = t; if (first) fm.needsUpdate = true; } }
    },
  };
}
