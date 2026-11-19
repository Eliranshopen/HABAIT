// build.js — the apartment as a real-time three.js scene, generated from geometry.json (the sheet-measured model of
// Building 10, floor 1, apartment 3). Same construction as scripts/05_build_scene.py (Blender): walls are the sheet's own wall
// fill extruded, sills and lintels close the openings, every fixture and piece of furniture sits on its drawn rectangle.
// Frame: plan x east, y north (m) -> three (x, height, -y).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TL = new THREE.TextureLoader();
const tex = (name, rep = 1, srgb = true) => {
  const t = TL.load(`./tex/${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.userData.rep = rep; return t;
};
// uv scale: texture repeats per metre
export const MAT = {};
function makeMaterials(maxAniso) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const P = (name, rep, extra = {}, normal = false, nscale = 0.6) => {
    const m = std({ map: tex(name, rep), roughness: 0.85, ...extra });
    if (normal) { m.normalMap = tex(`${name}_n`, rep, false); m.normalScale = new THREE.Vector2(nscale, nscale); }
    m.userData.rep = rep; return m;
  };
  Object.assign(MAT, {
    wall: P('wall', 0.5, { roughness: 0.92 }, true, 0.25),
    parapet: P('parapet', 0.5, { roughness: 0.95 }),
    tile80: P('tile80', 1 / 2.4, { roughness: 0.1, envMapIntensity: 1.3 }, true, 0.4),   // polished marble, 120 x 120 tiles (his pictures)
    tile60: P('tile60', 1 / 1.2, { roughness: 0.14, envMapIntensity: 1.2 }, true, 0.4),
    parquet: P('parquet', 0.55, { roughness: 0.55 }, true, 0.4),
    bathwall: P('bathwall', 1 / 1.2, { roughness: 0.12, envMapIntensity: 1.2 }, true, 0.5),   // grey marble 60 x 120
    deck: P('deck', 0.45, { roughness: 0.7 }, true, 0.6),
    rope: P('rope', 3.0, { roughness: 0.95 }),
    quartz: P('quartz', 0.5, { roughness: 0.12, envMapIntensity: 1.1 }),
    stone: P('stone', 0.5, { roughness: 0.85 }),
    oak_slat: P('oak_slat', 2.5, { roughness: 0.55 }, true, 0.8),
    oak: P('oak', 0.9, { roughness: 0.6 }, true, 0.3),
    entrance: P('entrance', 0.8, { roughness: 0.45 }),
    sofa: P('sofa', 2.0, { roughness: 0.95 }, true, 0.5),
    boucle: P('boucle', 2.5, { roughness: 1.0 }, true, 0.8),
    rug: P('rug', 1.5, { roughness: 1.0 }),
    linen_white: P('linen_white', 2.0, { roughness: 0.95 }),
    linen_grey: P('linen_grey', 2.0, { roughness: 0.95 }),
    chair: P('chair', 2.0, { roughness: 0.9 }),
    ceiling: std({ color: 0xf4f4f2, roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.2 }),   // white as in his pictures; the glow stands in for the bounce (daynight.js scales it)
    alu: std({ color: 0xc4c7ca, roughness: 0.32, metalness: 0.7 }),
    door: std({ color: 0xf2f1ee, roughness: 0.45 }),
    steel_door: std({ color: 0xb6b5b0, roughness: 0.45, metalness: 0.2 }),
    handle: std({ color: 0x141414, roughness: 0.35, metalness: 0.6 }),
    front: std({ color: 0xf0f0ee, roughness: 0.42 }),
    gap: std({ color: 0xb9b9b6, roughness: 0.6 }),
    vanity: std({ color: 0xf4f4f2, roughness: 0.35 }),
    spot: std({ color: 0xf4f4f2, roughness: 0.4, emissive: 0xfff1dc, emissiveIntensity: 0.9 }),
    black_glass: std({ color: 0x050505, roughness: 0.06, metalness: 0.0 }),
    steel: std({ color: 0xb8b8b8, roughness: 0.3, metalness: 1.0 }),
    sink: std({ color: 0x141414, roughness: 0.5 }),
    ceramic: std({ color: 0xf2f2ef, roughness: 0.08 }),
    blackmetal: std({ color: 0x0c0c0c, roughness: 0.4, metalness: 0.85 }),
    mirror: std({ color: 0xd3d7d9, roughness: 0.22, metalness: 0.35, envMapIntensity: 0.35 }),
    washer: std({ color: 0xebebeb, roughness: 0.3 }),
    shade: std({ color: 0xf6efe2, roughness: 0.8, emissive: 0xffd9a0, emissiveIntensity: 0.6 }),
    louvre: std({ color: 0xdcdcd8, roughness: 0.5 }),
    tglass: new THREE.MeshPhysicalMaterial({ color: 0xd9e6e3, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.4 }),
    curtain: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xeef3f4, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false, envMapIntensity: 1.2 }),
  });
  for (const [k, m] of Object.entries(MAT)) m.name = k;   // names travel into the GLB: the bake tells glass from baked surfaces by them
  for (const m of Object.values(MAT)) for (const k of ['map', 'normalMap']) if (m[k]) m[k].anisotropy = maxAniso;
}

// ---------------------------------------------------------------- geometry helpers
// box-projected uvs in metres (world space), the browser twin of the Blender box projection
function boxUV(g, rep) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * rep; uv[i * 2 + 1] = v * rep;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// static geometry is collected per material and merged at the end: few draw calls, shadows stay cheap
const bins = new Map();
// a swappable item (RAINBOW-style hotspot): while CUR is set, geometry goes into that item's own group with its own
// material copies (userData.mats by material name), so one sofa can change fabric without touching the other
let CUR = null;
function itemMat(mat) {
  const m = CUR.mats;
  if (!m[mat.name]) { m[mat.name] = mat.clone(); m[mat.name].name = mat.name; m[mat.name].userData = { ...mat.userData, base: mat.name }; }
  return m[mat.name];
}
function put(g, mat, { cast = true, receive = true } = {}) {
  if (CUR && mat.name !== 'glass') {
    boxUV(g, mat.userData.rep || 1);
    const o = new THREE.Mesh(g, itemMat(mat)); o.castShadow = cast; o.receiveShadow = receive; CUR.add(o); return;
  }
  const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
  if (!bins.has(key)) bins.set(key, { mat, cast, receive, list: [] });
  boxUV(g, mat.userData.rep || 1);
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  bins.get(key).list.push(g);
}
// box from plan coords: x0..x1 east, y0..y1 north, z0..z1 height
function box(x0, y0, z0, x1, y1, z1, mat, opt = {}) {
  const w = Math.abs(x1 - x0), d = Math.abs(y1 - y0), h = Math.abs(z1 - z0);
  if (w < 1e-4 || d < 1e-4 || h < 1e-4) return;
  const r = opt.bevel ? Math.min(opt.bevel, w / 2.01, d / 2.01, h / 2.01) : 0;
  const g = r > 0.001 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  g.translate((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
  if (opt.group) { const m = new THREE.Mesh(boxUV(g, mat.userData.rep || 1), mat); m.castShadow = m.receiveShadow = true; opt.group.add(m); return m; }
  put(g, mat, opt);
}
function cyl(x, y, z0, z1, r, mat, seg = 40, opt = {}) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.translate(x, (z0 + z1) / 2, -y); put(g, mat, opt);
}
function shapeOf(rings) {
  const s = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of rings.slice(1)) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}
function prism(rings, z0, z1, mat, opt) {
  const g = new THREE.ExtrudeGeometry(shapeOf(rings), { depth: z1 - z0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, z0, 0); put(g, mat, opt);
}
function slab(pts, z, mat, opt) {
  const g = new THREE.ShapeGeometry(shapeOf([pts])); g.rotateX(-Math.PI / 2); g.translate(0, z, 0); put(g, mat, opt);
}

// ---------------------------------------------------------------- the build
export async function buildApartment(scene, G, renderer, opts = {}) {
  makeMaterials(renderer.capabilities.getMaxAnisotropy());
  const H = G.meta.ceiling_m;
  const doors = new THREE.Group(); doors.name = 'BAKE_doors'; if (!opts.baked && !opts.skill) scene.add(doors);

  // walls (the sheet's fill), then sills + lintels across every opening
  for (const w of G.walls) prism([w.exterior, ...w.holes], 0, H, MAT.wall);
  for (const o of G.openings) {
    const [x0, y0, x1, y1] = o.r;
    if (o.sill > 0) box(x0, y0, 0, x1, y1, o.sill, MAT.wall);
    box(x0, y0, o.head, x1, y1, H, MAT.wall);
    if (o.kind === 'window' || o.kind === 'sliding_door') glazing(o);
    else door(o, doors);
  }
  // floors: one porcelain slab under everything, wet rooms and the parents' room as finish overlays 3 mm up; ceiling; slab above
  slab(G.footprint, 0, MAT.tile80, { cast: false });
  for (const r of G.rooms) if (r.floor === 'bathtile')
    for (const a of r.rects) box(a[0], a[1], 0, a[2], a[3], 0.003, r.floor === 'parquet' ? MAT.parquet : MAT.tile60, { cast: false });
  {
    MAT.ceiling.side = THREE.DoubleSide;
    const g = new THREE.ShapeGeometry(shapeOf([G.footprint])); g.rotateX(-Math.PI / 2); g.translate(0, H, 0); put(g, MAT.ceiling, { cast: false });
    const xs = G.footprint.map((p) => p[0]), ys = G.footprint.map((p) => p[1]);
    // the slabs above and below: never seen from inside, kept out of the light bake (their own material 'slab')
    if (!MAT.slab) { MAT.slab = MAT.parapet.clone(); MAT.slab.name = 'slab'; MAT.slab.userData.rep = MAT.parapet.userData.rep; }
    box(Math.min(...xs) - 0.3, Math.min(...ys) - 0.3, H + 0.002, Math.max(...xs) + 0.3, Math.max(...ys) + 0.3, H + 0.3, MAT.slab);
    box(Math.min(...xs) - 0.3, Math.min(...ys) - 0.3, -0.35, Math.max(...xs) + 0.3, Math.max(...ys) + 0.3, -0.002, MAT.slab, { receive: false });
  }
  wetWalls(G, H);
  exterior(G, H);
  fixtures(G, H);
  furniture(G, H, scene);
  dressing(G, H, opts.skill ? new THREE.Group() : scene);   // the curtain mesh is in the skill's baked model
  // the baked GLB of today still carries the furniture: in baked mode the swappable copies stay hidden (swap = real-time only)
  if (opts.baked) for (const it of ITEMS) it.group.visible = false;
  // merge the bins
  // opts.baked: the baked GLB carries every lit surface; only the glass is built here (and the plants, lit in real time)
  let n = 0;
  for (const b of bins.values()) {
    const glass = b.mat === MAT.glass;
    if (opts.baked && !glass && b.mat.name !== 'slab') continue;
    if (opts.skill) continue;   // skilllook.js: the skill's baked model is the shell (glass and curtain included)
    const m = new THREE.Mesh(mergeGeometries(b.list, false), b.mat); m.name = (glass ? 'GLASS_' : 'BAKE_') + b.mat.name + '_' + n++;
    m.castShadow = b.cast && b.mat !== MAT.glass; m.receiveShadow = b.receive; if (b.mat === MAT.glass) m.renderOrder = 2;
    scene.add(m);
  }
  await models(scene, G, H);
  await Promise.all(ITEMS.filter((it) => GEN[it.f.kind]).map((it) => { it.defaultModel = GEN[it.f.kind]; return placeItemModel(scene, it, null).catch((e) => { console.warn('gen model', it.f.id, e); it.defaultModel = null; it.group.visible = true; }); }));
  return { doors };
}

function glazing(o) {
  const [x0, y0, x1, y1] = o.r, FR = 0.06, zb = o.sill, zt = o.head;
  const ax = o.axis === 'x', L = ax ? x1 - x0 : y1 - y0, s0 = ax ? x0 : y0, c = ax ? (y0 + y1) / 2 : (x0 + x1) / 2;
  const mk = (a, b, z0, z1, d, mat) => ax ? box(s0 + a, c - d, z0, s0 + b, c + d, z1, mat) : box(c - d, s0 + a, z0, c + d, s0 + b, z1, mat);
  mk(0, L, zb, zb + FR, 0.035, MAT.alu); mk(0, L, zt - FR, zt, 0.035, MAT.alu);
  mk(0, FR, zb, zt, 0.035, MAT.alu); mk(L - FR, L, zb, zt, 0.035, MAT.alu);
  if (o.kind === 'sliding_door') {
    // three sashes: the right one slid open behind the middle one, so the balcony can be walked to
    const n = o.sashes || 3, sw = (L - 2 * FR) / n;
    for (let k = 1; k < n; k++) {   // the west sash (k = 0) is slid open behind its neighbour: the sheet draws the sofa in front of the east third
      const a = FR + k * sw, off = k % 2 ? 0.018 : -0.018;
      const m = (a1, b1, z0, z1, d, mat) => ax ? box(s0 + a1, c + off - d, z0, s0 + b1, c + off + d, z1, mat) : box(c + off - d, s0 + a1, z0, c + off + d, s0 + b1, z1, mat);
      m(a, a + 0.05, zb + FR, zt - FR, 0.02, MAT.alu); m(a + sw - 0.05, a + sw, zb + FR, zt - FR, 0.02, MAT.alu);
      m(a, a + sw, zt - FR - 0.05, zt - FR, 0.02, MAT.alu); m(a, a + sw, zb + FR, zb + FR + 0.05, 0.02, MAT.alu);
      m(a + 0.05, a + sw - 0.05, zb + FR + 0.05, zt - FR - 0.05, 0.004, MAT.glass);
    }
    o._open = [FR, FR + sw];   // the walkable part (plan metres along the wall from its start)
    return;
  }
  const n = o.sashes || 1;
  for (let k = 1; k < n; k++) { const a = (k * L) / n; mk(a - 0.025, a + 0.025, zb, zt, 0.03, MAT.alu); }
  mk(FR, L - FR, zb + FR, zt - FR, 0.004, MAT.glass);
  if (o.kind === 'window' && o.sill > 0) ax ? box(x0, y0 - 0.02, o.sill - 0.02, x1, y1 + 0.02, o.sill, MAT.quartz) : box(x0 - 0.02, y0, o.sill - 0.02, x1 + 0.02, y1, o.sill, MAT.quartz);
}

function door(o, doors) {
  const [x0, y0, x1, y1] = o.r, w = o.width_m, th = (o.kind === 'door') ? 0.04 : 0.05;
  const mat = o.kind === 'entrance_door' ? MAT.entrance : o.kind === 'mamad_door' ? MAT.steel_door : MAT.door;
  let hx, hy, d0, s;
  if (o.axis === 'x') { hx = o.hinge === 'W' ? x0 : x1; hy = o.swing === 'N' ? y1 : y0; d0 = [o.hinge === 'W' ? 1 : -1, 0]; s = [0, o.swing === 'N' ? 1 : -1]; }
  else { hy = o.hinge === 'S' ? y0 : y1; hx = o.swing === 'E' ? x1 : x0; d0 = [0, o.hinge === 'S' ? 1 : -1]; s = [o.swing === 'E' ? 1 : -1, 0]; }
  const cross = d0[0] * s[1] - d0[1] * s[0];
  const openDeg = o.kind === 'mamad_door' ? 88 : o.open_deg;
  const ang = Math.atan2(d0[1], d0[0]) + Math.sign(cross) * THREE.MathUtils.degToRad(openDeg);
  const piv = new THREE.Group(); piv.position.set(hx + s[0] * th / 2, 0, -(hy + s[1] * th / 2)); piv.rotation.y = ang;
  box(0, -th / 2, 0.01, w - 0.01, th / 2, o.head - 0.01, mat, { group: piv });
  box(w - 0.13, -th / 2 - 0.05, 1.0, w - 0.06, th / 2 + 0.05, 1.025, MAT.handle, { group: piv });
  doors.add(piv);
  o.axis === 'x' ? box(x0, y0 - 0.012, o.head, x1, y1 + 0.012, o.head + 0.06, MAT.door) : box(x0 - 0.012, y0, o.head, x1 + 0.012, y1, o.head + 0.06, MAT.door);
}

function wetWalls(G, H) {
  for (const r of G.rooms) {
    if (r.floor !== 'bathtile') continue;
    const a = r.rects[0], t = 0.006;
    const sides = [['S', a[0], a[1], a[2], a[1] + t], ['N', a[0], a[3] - t, a[2], a[3]], ['W', a[0], a[1], a[0] + t, a[3]], ['E', a[2] - t, a[1], a[2], a[3]]];
    for (const [sid, bx0, by0, bx1, by1] of sides) {
      let segs = [[bx0, by0, bx1, by1]];
      for (const o of G.openings) {
        const [ox0, oy0, ox1, oy1] = o.r;
        if (ox1 < bx0 - 0.01 || ox0 > bx1 + 0.01 || oy1 < by0 - 0.01 || oy0 > by1 + 0.01) continue;
        const nx = [];
        for (const q of segs) {
          if (sid === 'S' || sid === 'N') { if (ox0 > q[0]) nx.push([q[0], q[1], Math.min(ox0, q[2]), q[3]]); if (ox1 < q[2]) nx.push([Math.max(ox1, q[0]), q[1], q[2], q[3]]); }
          else { if (oy0 > q[1]) nx.push([q[0], q[1], q[2], Math.min(oy0, q[3])]); if (oy1 < q[3]) nx.push([q[0], Math.max(oy1, q[1]), q[2], q[3]]); }
        }
        segs = nx;
      }
      // his pictures: marble to 1.2 m, full height only by the shower and the bath
      const wet = ['pb-shower', 'b-tub'].map((id) => G.fixtures.find((f) => f.id === id)).filter(Boolean).map((f) => [f.r[0] - 0.1, f.r[1] - 0.1, f.r[2] + 0.1, f.r[3] + 0.1]);
      for (const q of segs) {
        if (q[2] - q[0] <= 0.01 || q[3] - q[1] <= 0.005) continue;
        box(q[0], q[1], 0.003, q[2], q[3], 1.2, MAT.bathwall);
        for (const w of wet) { const a0 = Math.max(q[0], w[0]), a1 = Math.min(q[2], w[2]), b0 = Math.max(q[1], w[1]), b1 = Math.min(q[3], w[3]); if (a1 - a0 > 0.005 && b1 - b0 > 0.004) box(a0, b0, 1.2, a1, b1, H - 0.002, MAT.bathwall); }
      }
    }
  }
}

function exterior(G, H) {
  const bal = G.balcony;
  slab(bal.deck, 0.004, MAT.deck, { cast: false });
  const pi = bal.parapet_inner, po = bal.parapet_outer;
  for (let k = 0; k < pi.length - 1; k++) {
    prism([[pi[k], pi[k + 1], po[k + 1], po[k]].reverse()], -0.3, 1.05, MAT.parapet);   // a solid rendered wall (Eliran's picture 12)
  }
  prism([bal.deck], H, H + 0.3, MAT.ceiling);   // covered: the balcony above (picture 12)
  const lw = G.lightwell.r; box(lw[0], lw[1], -0.3, lw[2], lw[3], 0, MAT.parapet, { cast: false });
  const la = G.laundry.r; box(la[0], la[1], -0.3, la[2], la[3], 0, MAT.parapet, { cast: false });
  for (let j = 0; j < 9; j++) { const x = la[0] + 0.03 + (j * (la[2] - la[0] - 0.06)) / 8; box(x - 0.01, la[1], 0, x + 0.01, la[3], H, MAT.louvre); }
  const nl = G.north_ledge.r; box(nl[0], nl[1], -0.3, nl[2], nl[3], 0.35, MAT.parapet);
}

const F = (G, id) => G.fixtures.find((f) => f.id === id).r;
function fixtures(G, H) {
  const TOP = 0.03, CNT = 0.87;
  for (const id of ['k-counter-N', 'k-counter-W', 'k-counter-S']) {
    const [x0, y0, x1, y1] = F(G, id);
    box(x0 + 0.05, y0 + 0.05, 0, x1 - 0.05, y1 - 0.05, 0.1, MAT.blackmetal);
    box(x0, y0, 0.1, x1, y1, CNT, MAT.front);
    box(x0 - 0.005, y0 - 0.005, CNT, x1 + 0.005, y1 + 0.005, CNT + TOP, MAT.quartz);
  }
  for (const [id, face] of [['k-counter-N', 'S'], ['k-counter-W', 'E'], ['k-counter-S', 'N']]) {
    const [x0, y0, x1, y1] = F(G, id);
    if (face !== 'E') {
      const yy = face === 'S' ? y0 : y1, n = Math.max(1, Math.round((x1 - x0) / 0.6));
      for (let j = 1; j < n; j++) { const x = x0 + (j * (x1 - x0)) / n; box(x - 0.002, yy - 0.002, 0.11, x + 0.002, yy + 0.002, CNT - 0.01, MAT.gap); }
      box(x0, yy - 0.002, CNT - 0.17, x1, yy + 0.002, CNT - 0.166, MAT.gap);
    } else {
      const n = Math.max(1, Math.round((y1 - y0) / 0.6));
      for (let j = 1; j < n; j++) { const y = y0 + (j * (y1 - y0)) / n; box(x1 - 0.002, y - 0.002, 0.11, x1 + 0.002, y + 0.002, CNT - 0.01, MAT.gap); }
      box(x1 - 0.002, y0, CNT - 0.17, x1 + 0.002, y1, CNT - 0.166, MAT.gap);
    }
  }
  let [x0, y0, x1, y1] = F(G, 'k-hob');
  box(x0 + 0.02, y0 + 0.02, CNT + TOP, x1 - 0.02, y1 - 0.02, CNT + TOP + 0.006, MAT.black_glass);
  for (const [u, v] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) cyl(x0 + u * (x1 - x0), y0 + v * (y1 - y0), CNT + TOP + 0.006, CNT + TOP + 0.02, 0.04, MAT.blackmetal, 20);
  for (const id of ['k-sink-1', 'k-sink-2']) {
    [x0, y0, x1, y1] = F(G, id);
    box(x0 + 0.01, y0 + 0.01, CNT + TOP - 0.004, x1 - 0.01, y1 - 0.01, CNT + TOP + 0.001, MAT.sink);
    cyl(x0 + 0.03, (y0 + y1) / 2, CNT + TOP, CNT + TOP + 0.32, 0.014, MAT.blackmetal, 12);
    box(x0 + 0.03, (y0 + y1) / 2 - 0.012, CNT + TOP + 0.3, x0 + 0.2, (y0 + y1) / 2 + 0.012, CNT + TOP + 0.325, MAT.blackmetal);
  }
  // the tall unit by the kitchen: in his pictures a light-stone column carrying the TV toward the living room
  [x0, y0, x1, y1] = F(G, 'k-fridge');
  box(x0, y0, 0, x1, y1, H, MAT.stone);
  { const cy = (y0 + y1) / 2, w = Math.min(0.78, y1 - y0 - 0.04) / 2; box(x1, cy - w, 1.02, x1 + 0.03, cy + w, 1.02 + w * 2 * 0.5625 + 0.02, MAT.black_glass); }
  // toilets: wall-hung pans on a concealed-cistern panel (the brochure's spec)
  for (const [id, fr] of [['pb-wc', 'S'], ['b-wc', 'S'], ['wc-wc', 'W']]) {
    [x0, y0, x1, y1] = F(G, id); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (fr === 'S') { const by = y1 - 0.02; box(x0, by - 0.06, 0, x1, by + 0.06, 1.15, MAT.bathwall); box(cx - 0.18, by - 0.55, 0.2, cx + 0.18, by - 0.06, 0.4, MAT.ceramic, { bevel: 0.06 }); box(cx - 0.18, by - 0.55, 0.4, cx + 0.18, by - 0.06, 0.42, MAT.ceramic, { bevel: 0.008 }); box(cx - 0.1, by - 0.066, 0.98, cx + 0.1, by - 0.058, 1.08, MAT.handle); }
    else { const bx = x1 - 0.02; box(bx - 0.06, y0, 0, bx + 0.06, y1, 1.15, MAT.bathwall); box(bx - 0.55, cy - 0.18, 0.2, bx - 0.06, cy + 0.18, 0.4, MAT.ceramic, { bevel: 0.06 }); box(bx - 0.55, cy - 0.18, 0.4, bx - 0.06, cy + 0.18, 0.42, MAT.ceramic, { bevel: 0.008 }); }
  }
  [x0, y0, x1, y1] = F(G, 'pb-shower');
  box(x0, y0, 0, x1, y1, 0.04, MAT.ceramic); box(x1 - 0.005, y0, 0.04, x1 + 0.005, y1, 2.0, MAT.glass); box(x1 - 0.01, y0, 2.0, x1 + 0.01, y1, 2.02, MAT.blackmetal);
  cyl(x0 + 0.2, y1 - 0.2, 2.05, 2.06, 0.12, MAT.blackmetal);
  for (const [id, fr] of [['pb-vanity', 'E'], ['b-vanity', 'N']]) {
    [x0, y0, x1, y1] = F(G, id); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    box(x0, y0, 0.3, x1, y1, 0.8, MAT.vanity); box(x0, y0, 0.8, x1, y1, 0.86, MAT.ceramic, { bevel: 0.008 });
    if (fr === 'N') { box(cx - 0.2, cy - 0.15, 0.855, cx + 0.2, cy + 0.15, 0.862, MAT.sink); box(x0 + 0.05, y0 + 0.005, 1.05, x1 - 0.05, y0 + 0.015, 1.85, MAT.mirror); }
    else { box(cx - 0.15, cy - 0.2, 0.855, cx + 0.15, cy + 0.2, 0.862, MAT.sink); box(x0 + 0.005, y0 + 0.02, 1.05, x0 + 0.015, y1 - 0.02, 1.85, MAT.mirror); }
  }
  [x0, y0, x1, y1] = F(G, 'b-tub');
  box(x0, y0, 0, x1, y1, 0.55, MAT.bathwall); box(x0, y0, 0.55, x1, y1, 0.58, MAT.ceramic, { bevel: 0.01 });
  box(x0 + 0.08, y0 + 0.08, 0.2, x1 - 0.08, y1 - 0.08, 0.581, MAT.sink === null ? MAT.ceramic : new THREE.MeshStandardMaterial({ color: 0xdedcd8, roughness: 0.1 }));
  box(x0 + 0.05, y0 - 0.005, 0.58, x0 + 0.85, y0 + 0.005, 2.0, MAT.glass);
  [x0, y0, x1, y1] = F(G, 'b-washer');
  box(x0 + 0.02, y0, 0, x1 - 0.02, y1, 0.85, MAT.washer, { bevel: 0.01 });
  { const g = new THREE.CylinderGeometry(0.16, 0.16, 0.01, 32); g.rotateX(Math.PI / 2); g.translate((x0 + x1) / 2, 0.45, -(y0 - 0.005)); put(g, MAT.blackmetal); }
  [x0, y0, x1, y1] = F(G, 'lobby-basin');
  box(x0, y0, 0.8, x1, y1, 0.86, MAT.ceramic, { bevel: 0.01 }); box(x1 - 0.015, y0, 1.0, x1 - 0.005, y1, 1.7, MAT.mirror);
  [x0, y0, x1, y1] = F(G, 'dining-ledge');
  box(x0, y0, 0, x1, y1, 0.45, MAT.oak); box(x0, y0, 0.45, x1, y1, 0.47, MAT.oak);
}

// what his pictures add that the sheet does not draw: a sheer curtain by the living-room slider, recessed ceiling spots
function dressing(G, H, scene) {
  const sd = G.openings.find((o) => o.kind === 'sliding_door');
  if (sd && sd.axis === 'x') {
    const [x0, y0, x1] = sd.r, w = 0.7, n = 60, g = new THREE.PlaneGeometry(w, H - 0.08, n, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + w / 2) / w; p.setZ(i, Math.sin(u * Math.PI * 9) * 0.035); }
    g.computeVertexNormals(); g.translate(x1 - 0.08 - w / 2, (H - 0.08) / 2 + 0.03, -(y0 - 0.12));
    const m = new THREE.Mesh(g, MAT.curtain); m.name = 'GLASS_curtain'; m.renderOrder = 3; scene.add(m);
    box(x0 - 0.1, y0 - 0.16, H - 0.05, x1 + 0.1, y0 - 0.08, H - 0.01, MAT.door);   // the curtain box under the ceiling
  }
  for (const r of G.rooms) for (const a of r.rects) {
    const w = a[2] - a[0], d = a[3] - a[1]; if (w < 0.9 || d < 0.9) continue;
    const nx = Math.max(1, Math.round(w / 1.7)), ny = Math.max(1, Math.round(d / 1.7));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = a[0] + ((i + 0.5) * w) / nx, y = a[1] + ((j + 0.5) * d) / ny;
      cyl(x, y, H - 0.012, H - 0.002, 0.045, MAT.spot, 20, { cast: false }); cyl(x, y, H - 0.006, H - 0.001, 0.055, MAT.ceiling, 20, { cast: false });
    }
  }
}

export const ITEMS = [];   // one entry per swappable piece: { f, group }
function drape(x0, y0, x1, y1, top, drop, head, mat) {
  // plan rect of the mattress top; the cloth hangs `drop` m over every side except the head side
  const ext = (s) => (s === head ? 0 : 0.09), ax0 = x0 - ext('W'), ax1 = x1 + ext('E'), ay0 = y0 - ext('S'), ay1 = y1 + ext('N');
  const nx = 48, ny = 48, g = new THREE.PlaneGeometry(1, 1, nx, ny), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, x = ax0 + u * (ax1 - ax0), y = ay0 + v * (ay1 - ay0);
    const out = Math.max(x0 - x, x - x1, y0 - y, y - y1, 0);   // how far past the mattress edge
    const fall = out > 0 ? Math.sin(Math.min(1, out / 0.09) * Math.PI / 2) * drop : 0;
    const wr = 0.012 * Math.sin(x * 9.1 + Math.sin(y * 3.7) * 2) * Math.sin(y * 6.3 + x * 1.3) + 0.006 * Math.sin(x * 23 + y * 17);
    const rim = out > 0 ? 0 : Math.min(1, Math.min(x - x0, x1 - x, y - y0, y1 - y) / 0.12);   // softly rounded edge on top
    p.setXYZ(i, x, top - fall + wr * (0.4 + 0.6 * rim) - (1 - rim) * 0.02, -y);
  }
  g.computeVertexNormals(); put(g, mat);
}

function furniture(G, H, scene) {
  for (const f of G.furniture) {
    if (f.kind !== 'plant') {
      CUR = new THREE.Group(); CUR.name = 'ITEM_' + f.id; CUR.mats = {}; CUR.userData = { item: f.id, kind: f.kind, walk_live: true };   // walk_live: the skill's bake keeps its shadow, the browser draws it live
      scene.add(CUR); ITEMS.push({ f, group: CUR });
    }
    try { furnitureOne(f, H); } finally { CUR = null; }
  }
}
function furnitureOne(f, H) {
  {
    const k = f.kind; let x0, y0, x1, y1, cx, cy;
    if (f.r) { [x0, y0, x1, y1] = f.r; cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; } else [cx, cy] = f.c;
    if (k === 'sofa') {
      const fr = f.front, ns = fr === 'S' || fr === 'N';
      box(x0 + 0.02, y0 + 0.02, 0.08, x1 - 0.02, y1 - 0.02, 0.4, MAT.sofa, { bevel: 0.045 });
      for (const [u, v] of [[0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94]]) cyl(x0 + u * (x1 - x0), y0 + v * (y1 - y0), 0, 0.08, 0.015, MAT.blackmetal, 10);
      if (ns) {
        const by = fr === 'S' ? [y1 - 0.2, y1] : [y0, y0 + 0.2];
        box(x0 + 0.02, by[0], 0.42, x1 - 0.02, by[1], 0.82, MAT.sofa, { bevel: 0.08 });
        for (const xa of [x0, x1 - 0.18]) box(xa + 0.01, y0 + 0.02, 0.42, xa + 0.17, y1 - 0.02, 0.62, MAT.sofa, { bevel: 0.075 });
        const yy = fr === 'S' ? [y0 + 0.02, y1 - 0.2] : [y0 + 0.2, y1 - 0.02], seg = (x1 - x0 - 0.36) / 2;
        for (let j = 0; j < 2; j++) box(x0 + 0.185 + j * seg, yy[0], 0.42, x0 + 0.175 + (j + 1) * seg, yy[1], 0.55, MAT.sofa, { bevel: 0.07 });
        for (const u of [0.3, 0.68]) { const px = x0 + u * (x1 - x0), py = fr === 'S' ? y1 - 0.29 : y0 + 0.29; box(px - 0.2, py - 0.07, 0.5, px + 0.2, py + 0.07, 0.88, MAT.boucle, { bevel: 0.06 }); }
      } else {
        const bx = fr === 'W' ? [x1 - 0.2, x1] : [x0, x0 + 0.2];
        box(bx[0], y0 + 0.02, 0.42, bx[1], y1 - 0.02, 0.82, MAT.sofa, { bevel: 0.08 });
        for (const ya of [y0, y1 - 0.18]) box(x0 + 0.02, ya + 0.01, 0.42, x1 - 0.02, ya + 0.17, 0.62, MAT.sofa, { bevel: 0.075 });
        const xx = fr === 'W' ? [x0 + 0.02, x1 - 0.2] : [x0 + 0.2, x1 - 0.02], seg = (y1 - y0 - 0.36) / 2;
        for (let j = 0; j < 2; j++) box(xx[0], y0 + 0.185 + j * seg, 0.42, xx[1], y0 + 0.175 + (j + 1) * seg, 0.55, MAT.sofa, { bevel: 0.07 });
        for (const u of [0.3, 0.68]) { const py = y0 + u * (y1 - y0), px = fr === 'W' ? x1 - 0.29 : x0 + 0.29; box(px - 0.07, py - 0.2, 0.5, px + 0.07, py + 0.2, 0.88, MAT.boucle, { bevel: 0.06 }); }
      }
    } else if (k === 'rug') box(x0, y0, 0.003, x1, y1, 0.015, MAT.rug, { bevel: 0.004, cast: false });
    else if (k === 'round_table') { cyl(cx, cy, 0.36, 0.4, f.radius, MAT.oak, 64); cyl(cx, cy, 0.015, 0.36, f.radius * 0.55, MAT.oak, 48); }
    else if (k === 'dining_table') {
      box(x0, y0, 0.745, x1, y1, 0.757, MAT.tglass); for (const [a, b, c, d] of [[x0 + 0.06, y0 + 0.06, x1 - 0.06, y0 + 0.09], [x0 + 0.06, y1 - 0.09, x1 - 0.06, y1 - 0.06], [x0 + 0.06, y0 + 0.06, x0 + 0.09, y1 - 0.06], [x1 - 0.09, y0 + 0.06, x1 - 0.06, y1 - 0.06]]) box(a, b, 0.7, c, d, 0.745, MAT.blackmetal);
      for (const [u, v] of [[0.08, 0.15], [0.92, 0.15], [0.08, 0.85], [0.92, 0.85]]) { const px = x0 + u * (x1 - x0), py = y0 + v * (y1 - y0); box(px - 0.025, py - 0.025, 0, px + 0.025, py + 0.025, 0.72, MAT.blackmetal); }
    } else if (k === 'dining_chair') {
      const d = f.front === 'S' ? 1 : -1;
      box(cx - 0.22, cy - 0.22, 0.43, cx + 0.22, cy + 0.22, 0.51, MAT.chair, { bevel: 0.04 });
      box(cx - 0.21, cy + d * 0.19 - 0.035, 0.48, cx + 0.21, cy + d * 0.19 + 0.035, 0.92, MAT.chair, { bevel: 0.034 });
      for (const [u, v] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) cyl(cx + u, cy + v, 0, 0.44, 0.012, MAT.blackmetal, 10);
    } else if (k === 'wardrobe') {
      box(x0, y0, 0, x1, y1, 2.4, MAT.oak_slat); box(x0, y0, 2.4, x1, y1, H, MAT.wall);
      if (f.front === 'E' || f.front === 'W') { const xx = f.front === 'E' ? x1 : x0, n = Math.max(2, Math.round((y1 - y0) / 0.5)); for (let j = 1; j < n; j++) { const y = y0 + (j * (y1 - y0)) / n; box(xx - 0.003, y - 0.002, 0.02, xx + 0.003, y + 0.002, 2.38, MAT.blackmetal); if (j % 2) { const o = f.front === 'E' ? 0.025 : -0.025; box(xx + o - 0.008, y - 0.045, 0.7, xx + o + 0.008, y - 0.03, 1.7, MAT.handle); box(xx + o - 0.008, y + 0.03, 0.7, xx + o + 0.008, y + 0.045, 1.7, MAT.handle); } } }
      else { const yy = f.front === 'S' ? y0 : y1, n = Math.max(2, Math.round((x1 - x0) / 0.5)); for (let j = 1; j < n; j++) { const x = x0 + (j * (x1 - x0)) / n; box(x - 0.002, yy - 0.003, 0.02, x + 0.002, yy + 0.003, 2.38, MAT.blackmetal); if (j % 2) { const o = f.front === 'N' ? 0.025 : -0.025; box(x - 0.045, yy + o - 0.008, 0.7, x - 0.03, yy + o + 0.008, 1.7, MAT.handle); box(x + 0.03, yy + o - 0.008, 0.7, x + 0.045, yy + o + 0.008, 1.7, MAT.handle); } } }
    } else if (k === 'bed_double' || k === 'bed_single') {
      const hd = f.head;
      box(x0, y0, 0.05, x1, y1, 0.3, MAT.sofa, { bevel: 0.01 });
      box(x0 + 0.02, y0 + 0.02, 0.3, x1 - 0.02, y1 - 0.02, 0.52, MAT.linen_white, { bevel: 0.04 });
      if (hd === 'E' || hd === 'W') {
        const hx = hd === 'E' ? [x1 - 0.06, x1] : [x0, x0 + 0.06];
        const hh = k === 'bed_double' ? 1.25 : 0.95, nc = Math.max(4, Math.round((y1 - y0 + 0.04) / 0.16)), cw = (y1 - y0 + 0.04) / nc, inX = hd === 'E' ? -1 : 1;
        box(hx[0], y0 - 0.02, 0.05, hx[1], y1 + 0.02, hh, MAT.sofa, { bevel: 0.02 });   // channel-tufted headboard (his pictures)
        for (let j = 0; j < nc; j++) { const a = y0 - 0.02 + j * cw, fx = inX > 0 ? hx[1] : hx[0]; box(Math.min(fx, fx + inX * 0.045), a + 0.006, 0.3, Math.max(fx, fx + inX * 0.045), a + cw - 0.006, hh - 0.03, MAT.sofa, { bevel: 0.022 }); }
        const tx = hd === 'E' ? [x0 - 0.02, x0 + (x1 - x0) * 0.74] : [x1 - (x1 - x0) * 0.74, x1 + 0.02];
        drape(hd === 'E' ? x0 : x1 - (x1 - x0) * 0.74, y0, hd === 'E' ? x0 + (x1 - x0) * 0.74 : x1, y1, 0.585, 0.22, hd, MAT.linen_grey);
        const n = k === 'bed_double' ? 2 : 1;
        for (let j = 0; j < n; j++) { const py0 = y0 + 0.08 + (j * (y1 - y0 - 0.16)) / n, py1 = py0 + (y1 - y0 - 0.16) / n - 0.04, px = hd === 'E' ? [x1 - 0.48, x1 - 0.1] : [x0 + 0.1, x0 + 0.48]; box(px[0], py0, 0.52, px[1], py1, 0.66, MAT.linen_white, { bevel: 0.06 }); }
      } else {
        const hy = hd === 'S' ? [y0, y0 + 0.06] : [y1 - 0.06, y1];
        const hh = k === 'bed_double' ? 1.25 : 0.95, nc = Math.max(4, Math.round((x1 - x0 + 0.04) / 0.16)), cw = (x1 - x0 + 0.04) / nc, inY = hd === 'S' ? 1 : -1;
        box(x0 - 0.02, hy[0], 0.05, x1 + 0.02, hy[1], hh, MAT.sofa, { bevel: 0.02 });
        for (let j = 0; j < nc; j++) { const a = x0 - 0.02 + j * cw, fy = inY > 0 ? hy[1] : hy[0]; box(a + 0.006, Math.min(fy, fy + inY * 0.045), 0.3, a + cw - 0.006, Math.max(fy, fy + inY * 0.045), hh - 0.03, MAT.sofa, { bevel: 0.022 }); }
        const ty = hd === 'S' ? [y1 - (y1 - y0) * 0.74, y1 + 0.02] : [y0 - 0.02, y0 + (y1 - y0) * 0.74];
        drape(x0, hd === 'S' ? y1 - (y1 - y0) * 0.74 : y0, x1, hd === 'S' ? y1 : y0 + (y1 - y0) * 0.74, 0.585, 0.22, hd, MAT.linen_grey);
        const py = hd === 'S' ? [y0 + 0.1, y0 + 0.48] : [y1 - 0.48, y1 - 0.1];
        box(x0 + 0.08, py[0], 0.52, x1 - 0.08, py[1], 0.66, MAT.linen_white, { bevel: 0.06 });
      }
    } else if (k === 'nightstand') {
      box(x0 + 0.02, y0 + 0.02, 0, x1 - 0.02, y1 - 0.02, 0.5, MAT.oak_slat, { bevel: 0.005 }); box(x0 + 0.02, y0 + 0.02, 0.5, x1 - 0.02, y1 - 0.02, 0.52, MAT.oak, { bevel: 0.004 });
      // the mushroom lamp is an accessory now (models(): gen_nightstand_lamp_tripo, from his picture 05)
    }
    else if (k === 'outdoor_table') { cyl(cx, cy, 0.7, 0.73, f.radius, MAT.quartz, 48); cyl(cx, cy, 0.05, 0.7, 0.025, MAT.blackmetal, 16); cyl(cx, cy, 0, 0.05, f.radius * 0.6, MAT.blackmetal, 24); }
    else if (k === 'outdoor_chair') {
      const g = []; const a = THREE.MathUtils.degToRad(f.yaw_deg || 0);
      const add = (bx0, by0, z0, bx1, by1, z1, mat, bev) => { const geo = bev ? new RoundedBoxGeometry(bx1 - bx0, z1 - z0, by1 - by0, 3, bev) : new THREE.BoxGeometry(bx1 - bx0, z1 - z0, by1 - by0); geo.translate((bx0 + bx1) / 2, (z0 + z1) / 2, -(by0 + by1) / 2); geo.rotateY(a); geo.translate(cx, 0, -cy); put(geo, mat); };
      add(-0.29, -0.27, 0.3, 0.29, 0.27, 0.38, MAT.rope, 0.03); add(-0.29, 0.2, 0.38, 0.29, 0.27, 0.78, MAT.rope, 0.03);   // woven frame: seat, back,
      add(-0.29, -0.27, 0.38, -0.23, 0.27, 0.62, MAT.rope, 0.025); add(0.23, -0.27, 0.38, 0.29, 0.27, 0.62, MAT.rope, 0.025);   // arms
      add(-0.23, -0.24, 0.38, 0.23, 0.2, 0.47, MAT.linen_grey, 0.04); add(-0.21, 0.1, 0.45, 0.21, 0.2, 0.74, MAT.linen_grey, 0.05);   // grey cushions
      for (const [u, v] of [[-0.25, -0.23], [0.25, -0.23], [-0.25, 0.23], [0.25, 0.23]]) add(u - 0.012, v - 0.012, 0, u + 0.012, v + 0.012, 0.3, MAT.blackmetal);
    }
  }
}

// CC0 models (Poly Haven): plants, pendant, a few objects on surfaces
// accessories are swappable too (RAINBOW baseline, root §8.10): ACCS = { id, kind, room, model, target, x, y, z, byHeight, group }
export const ACCS = [];
const GL = new GLTFLoader(), modelCache = new Map();
async function loadModel(id) {
  const gen = id.startsWith('gen_') || id.startsWith('hy_');   // made from his pictures: gen_ = Tripo round (19_fal_3d.py), hy_ = Hunyuan (24_item_3d.mjs)
  const url = gen ? `./models/${id}/${id}.web.glb` : `./models/${id}/${id}.gltf`;
  if (!modelCache.has(id)) modelCache.set(id, GL.loadAsync(url).then((r) => { if (gen) fixGen(r.scene, id); return r.scene; }));
  return (await modelCache.get(id)).clone(true);
}
// the pieces made from Eliran's pictures (fal Tripo, 2026-11-18): the default furniture of the apartment, as in the pictures
// 2026-11-18 Hunyuan round (Eliran's pick of the bake-off): studio photo from his picture -> Hunyuan 3D v3.1 Pro (PBR)
export const GEN = { bed_double: 'hy_bed_parents', bed_single: 'hy_bed_single', sofa: 'hy_sofa', round_table: 'hy_coffee_table', nightstand: 'hy_nightstand', dining_chair: 'hy_dining_chair',   // dining table: the built glass top on a black frame matches picture 03 better than Hunyuan's solid white top
  outdoor_chair: 'hy_balcony_chair', outdoor_table: 'hy_balcony_table' };
// their colour as sampled from his pictures (sRGB), and how matte: the generator's textures came out tinted and glossy
// which way each generated model faces, read off the walk (the generator picks its own axes): added to the piece's facing
const GEN_YAW = { gen_bed_parents_tripo: Math.PI, gen_bed_single_tripo: -Math.PI / 2, hy_bed_single: Math.PI };
const GEN_LOOK = { gen_bed_parents_tripo: ['#9a9a9e', 0.92], gen_bed_single_tripo: ['#a3a3a6', 0.92], gen_sofa_tripo: ['#9a9895', 0.95],
  gen_coffee_table_tripo: [null, 0.55], gen_balcony_chair_tripo: [null, 0.9], gen_balcony_table_tripo: [null, 0.4], gen_nightstand_lamp_tripo: [null, 0.35] };
function meanColor(img) {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data; const s = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { const k = new THREE.Color().setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); s[0] += k.r; s[1] += k.g; s[2] += k.b; }
  const n = d.length / 4; return new THREE.Color(s[0] / n, s[1] / n, s[2] / n);
}
function fixGen(root, id) {
  const [target, rough] = GEN_LOOK[id] || (id.startsWith('hy_') ? [null, null] : [null, 0.8]);
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material; m.metalness = 0; m.metalnessMap = null;
    if (rough != null) { m.roughness = rough; m.roughnessMap = null; }   // null: keep the model's own roughness map (Hunyuan PBR)
    if (target && m.map && m.map.image) {   // grey the texture (its weave and folds stay), then bring its mean to the picture's colour
      const img = m.map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), px = d.data;
      for (let i = 0; i < px.length; i += 4) { const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; px[i] = px[i + 1] = px[i + 2] = l; }
      x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = m.map.flipY; t.channel = m.map.channel; t.anisotropy = 8;
      m.map = t; const a = meanColor(c), w = new THREE.Color(target); m.color.setRGB(w.r / Math.max(a.r, 0.02), w.g / Math.max(a.g, 0.02), w.b / Math.max(a.b, 0.02));
    }
    m.needsUpdate = true; o.castShadow = o.receiveShadow = true;
  });
}
// place (or re-place) an accessory's model: sized to its target, standing on z, centred on (x, y)
export async function placeModel(scene, a, model = a.model) {
  const g = await loadModel(model);
  const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = a.byHeight ? a.target / s.y : Math.min(a.target / s.x, a.target / s.z);
  g.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); const wrap = new THREE.Group(); wrap.add(g); wrap.scale.setScalar(k); wrap.position.set(a.x, a.z, -a.y);
  wrap.traverse((o) => { if (o.isMesh) { o.castShadow = !a.hang; o.receiveShadow = true; } });
  if (a.hang) { const bb = new THREE.Box3().setFromObject(wrap); wrap.position.y = a.ceiling - (bb.max.y - bb.min.y); }
  wrap.name = 'PLANT_' + model; wrap.userData = { acc: a.id, walk_live: true };
  if (a.group) { scene.remove(a.group); }
  a.group = wrap; a.current = model; scene.add(wrap); return wrap;
}
// a furniture piece swapped for another model (CC0, Poly Haven — never RAINBOW's items, Eliran 2026-11-17): the model keeps
// its real size, shrinks only to fit the piece's drawn rectangle, and faces where the piece faced (models face +z = south)
const FACE = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
export async function placeItemModel(scene, it, model) {
  if (it.alt) { scene.remove(it.alt); it.alt = null; }
  if (model == null) model = it.defaultModel || null;   // "as in the pictures"
  if (model === 'built') model = null;                  // the drawn piece (its finishes can be changed)
  it.model = model || null;
  if (!model) { it.group.visible = true; return null; }
  const g = await loadModel(model), f = it.f;
  let r = f.r; if (!r) { const h = f.kind === 'dining_chair' ? 0.26 : (f.radius || 0.3); r = [f.c[0] - h, f.c[1] - h, f.c[0] + h, f.c[1] + h]; }
  const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  g.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
  const rw = r[2] - r[0], rd = r[3] - r[1];
  const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
  const fr = f.front || f._front || (f.head && OPP[f.head]);   // a bed faces away from its head; a nightstand where its bed's foot points
  const ry = fr in FACE ? FACE[fr] : f.yaw_deg != null ? THREE.MathUtils.degToRad(f.yaw_deg) : ((rw >= rd) === (s.x >= s.z) ? 0 : Math.PI / 2);
  const turned = Math.abs(Math.sin(ry + (GEN_YAW[model] || 0))) > 0.5, mx = turned ? s.z : s.x, mz = turned ? s.x : s.z;
  const k = model.startsWith('hy_') ? Math.min(rw / mx, rd / mz) : Math.min(1.1, rw / mx, rd / mz);   // Hunyuan models come normalised: fit the drawn piece
  const inner = new THREE.Group(); inner.add(g); inner.rotation.y = ry + (GEN_YAW[model] || 0);
  const wrap = new THREE.Group(); wrap.add(inner); wrap.scale.setScalar(k); wrap.position.set((r[0] + r[2]) / 2, 0, -(r[1] + r[3]) / 2);
  wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  wrap.name = 'ALT_' + f.id + '_' + model; wrap.userData = { walk_live: true }; scene.add(wrap); it.alt = wrap; it.group.visible = false; return wrap;
}
async function models(scene, G, H) {
  const add = (o) => { ACCS.push({ ...o, base: o.model }); return placeModel(scene, ACCS[ACCS.length - 1]); };
  const jobs = [];
  for (const f of G.furniture) if (f.kind === 'plant')
    jobs.push(add(f.room === 'balcony'   // his pictures: the tall black planter with its agave (picture 12), the palm in a white pot (picture 01)
      ? { id: f.id, kind: 'plant', room: f.room, model: 'hy_planter_agave', target: 1.45, byHeight: true, x: f.c[0], y: f.c[1], z: 0 }
      : { id: f.id, kind: 'plant', room: f.room, model: 'hy_plant_pachira', target: 1.05, byHeight: true, x: f.c[0], y: f.c[1], z: 0 }));
  const dt = G.furniture.find((f) => f.id === 'dining-table').r, dcx = (dt[0] + dt[2]) / 2, dcy = (dt[1] + dt[3]) / 2;
  jobs.push(add({ id: 'bowl', kind: 'decor', room: 'living', model: 'wooden_bowl_01', target: 0.3, x: dcx, y: dcy, z: 0.76 }));
  const ct = G.furniture.find((f) => f.id === 'coffee');
  jobs.push(add({ id: 'vase-coffee', kind: 'decor', room: 'living', model: 'ceramic_vase_01', target: 0.14, x: ct.c[0] + 0.12, y: ct.c[1] - 0.05, z: 0.4 }));
  for (const f of G.furniture) if (f.kind === 'nightstand') { const [x0, y0, x1, y1] = f.r;
    jobs.push(add({ id: f.id + '-lamp', kind: 'lamp_table', room: f.room, model: 'hy_mushroom_lamp', target: 0.4, byHeight: true, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 0.52 })); }
  const kn = F(G, 'k-counter-N'); jobs.push(add({ id: 'vase-kitchen', kind: 'decor', room: 'kitchen', model: 'ceramic_vase_03', target: 0.16, x: kn[0] + 1.2, y: (kn[1] + kn[3]) / 2, z: 0.9 }));
  const dl = F(G, 'dining-ledge'); jobs.push(add({ id: 'plant-ledge', kind: 'plant', room: 'living', model: 'potted_plant_02', target: 0.35, x: dl[0] + 0.3, y: (dl[1] + dl[3]) / 2, z: 0.47 }));
  await Promise.all(jobs);
}
