// The apartment minimap (card 10, B4b): the dollhouse top view (card 09's top.png) in a corner of the 360 tour, with a dot
// at the current panorama's camera and a cone for where the buyer is looking. The buyer always knows where they stand.
//
// Coordinate frames (all verified on apt846, see test/minimap.test.mjs):
//   plan cm      plan.general.json: x right, y down, origin = the plan crop's top-left, centimetres. The GLB uses the same
//                frame: glTF X = x_cm/100, glTF Z = y_cm/100, Y up (export_dollhouse.py report.frames.gltf).
//   cameras px   tour360 cameras.json `at` / `lookAt`: pixels of the same crop; plan cm = px / cameras.plan.pxPerCm (2.25).
//                No rotation between the two (the "rotated ~20 degrees" in cameras.json is the drawing vs the building grid,
//                shared by both files).
//   top.png px   export_dollhouse.py render_top(): orthographic, plan-up, W x H, centre (cx, cy) in Blender world metres
//                (world X = x_cm/100, world Y = -y_cm/100), ortho scale s = 1.06 * max extent:
//                  x_cm = 100*(cx + (u/W - 0.5)*s) ; y_cm = -100*(cy - (v/H - 0.5)*s)
//   bearing      degrees in plan space, 0 = up (-y), clockwise (cameras.json / scenes.json centreBearingDeg). The tour's
//                yaw 0 is the panorama centre, which faces centreBearingDeg; Pannellum yaw grows to the right (clockwise).
//
// The tour runs in an iframe (another origin, :8848). It talks to this page with postMessage (contract, habait-98 emits):
//   { type: 'habait:view', scene: '<scenes.json id>', yaw: <deg, Pannellum getYaw()>, fov: <deg, getHfov()>,
//     floor?: 'parquet'|'concrete'|'marble', pitch?: <deg> }
// sent on load, on every scene change, and while the view turns (throttled, about 10 per second is plenty).
// Optional back channel (this page -> tour): { type: 'habait:goto', scene } when the buyer taps a room on the minimap.

export const VIEW_MSG = 'habait:view';
export const GOTO_MSG = 'habait:goto';

// ---------- pure maths (node + browser) ----------

// the bounds of a glTF JSON chunk from the POSITION accessors' min/max (spec-required, Draco included); nodes must carry
// no transforms (card 09's export bakes them) -> { min:[x,y,z], max:[x,y,z] } in glTF metres
export function glbBounds(gltfJson) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const node of gltfJson.nodes || []) {
    if (node.mesh == null) continue;
    if (node.translation || node.rotation || node.scale || node.matrix) throw new Error(`node ${node.name}: transforms are not supported`);
    for (const p of gltfJson.meshes[node.mesh].primitives) {
      const a = gltfJson.accessors[p.attributes.POSITION];
      for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i]); max[i] = Math.max(max[i], a.max[i]); }
    }
  }
  return { min, max };
}

// the glTF JSON chunk of a GLB (Uint8Array / Buffer)
export function glbJson(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const n = dv.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + n)));
}

// export_dollhouse.py's top camera from the model bounds (used when report.json lost its `top` block to a later run)
export function topMapFromBounds({ min, max }, { W = 2048, H = 2048, pad = 1.06 } = {}) {
  const lo = [min[0], -max[2]]; // Blender world: X = glTF X, Y = -glTF Z
  const hi = [max[0], -min[2]];
  return { W, H, cx: (lo[0] + hi[0]) / 2, cy: (lo[1] + hi[1]) / 2, s: Math.max(hi[0] - lo[0], hi[1] - lo[1]) * pad };
}

// report.json `top` block -> map (null when absent or failed)
export function topMapFromReport(top) {
  if (!top || !top.ortho_scale_m || !top.centre_world_m) return null;
  const [W, H] = top.res_px || [2048, 2048];
  return { W, H, cx: top.centre_world_m[0], cy: top.centre_world_m[1], s: top.ortho_scale_m };
}

export function planCmToTopPx(x, y, m) {
  return [((x / 100 - m.cx) / m.s + 0.5) * m.W, (0.5 + (y / 100 + m.cy) / m.s) * m.H];
}
export function topPxToPlanCm(u, v, m) {
  return [100 * (m.cx + (u / m.W - 0.5) * m.s), -100 * (m.cy - (v / m.H - 0.5) * m.s)];
}

// plan cm -> pixel of an image cut from top.png at (x0, y0) and scaled by k: an axis-aligned affine { ax, bx, ay, by }
export function cmToImageAffine(m, { x0 = 0, y0 = 0, k = 1 } = {}) {
  const [u0, v0] = planCmToTopPx(0, 0, m);
  const [u1, v1] = planCmToTopPx(100, 100, m);
  const ax = ((u1 - u0) / 100) * k;
  const ay = ((v1 - v0) / 100) * k;
  return { ax, bx: (u0 - x0) * k, ay, by: (v0 - y0) * k };
}
export const cmToImg = (x, y, a) => [a.ax * x + a.bx, a.ay * y + a.by];
export const imgToCm = (u, v, a) => [(u - a.bx) / a.ax, (v - a.by) / a.ay];

// cameras.json scene -> plan cm
export function cameraCm(cameras, id) {
  const s = (cameras.scenes || []).find((c) => c.id === id);
  if (!s) return null;
  const k = cameras.plan?.pxPerCm || 2.25;
  return [s.at[0] / k, s.at[1] / k];
}

const norm360 = (d) => ((d % 360) + 360) % 360;
// the plan bearing the buyer looks at: the panorama centre's bearing + the tour yaw
export function viewBearing(point, yaw = 0) {
  return norm360((point?.bearing0 || 0) + (Number(yaw) || 0));
}

// the manifest block tools/build_zip.mjs writes: image + affine + one point per interior scene
export function buildMinimapData({ cameras, scenes, map, crop = {}, img, size, source }) {
  const affine = cmToImageAffine(map, crop);
  const points = {};
  for (const s of (scenes?.scenes || []).filter((x) => !x.exterior)) {
    const cm = cameraCm(cameras, s.id);
    if (!cm) continue;
    const [u, v] = cmToImg(cm[0], cm[1], affine);
    points[s.id] = {
      x_cm: +cm[0].toFixed(1), y_cm: +cm[1].toFixed(1), u: +u.toFixed(2), v: +v.toFixed(2),
      bearing0: norm360(s.centreBearingDeg || 0), name: s.name || null, // northOffset is Pannellum's compass only, not getYaw()
    };
  }
  return { schema: 'habait.minimap.v0', img, w: size[0], h: size[1], affine, top: map, crop, points, source: source || null };
}

// a validated view message, or null
export function parseViewMessage(d) {
  if (!d || typeof d !== 'object' || d.type !== VIEW_MSG || typeof d.scene !== 'string') return null;
  const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : null);
  return {
    scene: d.scene,
    yaw: num(d.yaw, -100000, 100000) ?? 0,
    fov: num(d.fov, 10, 170) ?? 100,
    floor: typeof d.floor === 'string' && /^[\w-]{1,32}$/.test(d.floor) ? d.floor : null,
    pitch: num(d.pitch, -90, 90),
  };
}

// ---------- the overlay (browser) ----------
const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};
// a wedge pointing up (bearing 0) from the origin, radius r, opening fov
function wedgePath(r, fov) {
  const h = (Math.min(fov, 170) / 2) * (Math.PI / 180);
  const x = r * Math.sin(h);
  const y = -r * Math.cos(h);
  return `M0 0 L${(-x).toFixed(2)} ${y.toFixed(2)} A${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

// container: a positioned element (the tour frame's wrapper). data: buildMinimapData() with `img` resolved to a URL.
// Returns { el, update(view), state, destroy }.
export function mountMinimap(container, data, { label = 'map', pick = (o) => (o && (o.he || o.en)) || '', onGoto = null } = {}) {
  const box = document.createElement('div');
  box.className = 'apt-minimap';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', label);
  const svg = svgEl('svg', { viewBox: `0 0 ${data.w} ${data.h}`, class: 'apt-minimap-svg', preserveAspectRatio: 'xMidYMid meet' });
  svg.appendChild(svgEl('image', { href: data.img, x: 0, y: 0, width: data.w, height: data.h }));
  // sizes relative to the image (it is drawn about 110-170 css px wide on a phone): dot ~ 7 px, cone ~ 22 px, rooms ~ 3.5 px
  const S = Math.max(data.w, data.h);
  const rDot = 0.045 * S;
  const rCone = 0.16 * S;
  const others = svgEl('g', { class: 'mm-others' });
  for (const [id, p] of Object.entries(data.points)) {
    const c = svgEl('circle', { cx: p.u, cy: p.v, r: 0.022 * S, class: 'mm-node', 'data-scene': id });
    const t = svgEl('title');
    t.textContent = pick(p.name) || id;
    c.appendChild(t);
    if (onGoto) c.addEventListener('click', (e) => { e.stopPropagation(); onGoto(id); });
    others.appendChild(c);
  }
  svg.appendChild(others);
  const me = svgEl('g', { class: 'mm-me', visibility: 'hidden' });
  const cone = svgEl('path', { class: 'mm-cone', d: wedgePath(rCone, 100) });
  const dot = svgEl('circle', { class: 'mm-dot', cx: 0, cy: 0, r: rDot });
  me.append(cone, dot);
  svg.appendChild(me);
  box.appendChild(svg);
  box.addEventListener('click', () => box.classList.toggle('is-big'));
  container.appendChild(box);

  const state = { scene: null, yaw: 0, fov: 100, bearing: null, u: null, v: null, updates: 0 };
  function update(view) {
    const p = data.points[view.scene];
    if (!p) { me.setAttribute('visibility', 'hidden'); state.scene = view.scene; state.u = state.v = null; return false; }
    const bearing = viewBearing(p, view.yaw);
    if (view.fov !== state.fov) cone.setAttribute('d', wedgePath(rCone, view.fov));
    me.setAttribute('transform', `translate(${p.u} ${p.v}) rotate(${bearing.toFixed(2)})`);
    me.setAttribute('visibility', 'visible');
    for (const n of others.children) n.classList.toggle('is-here', n.dataset.scene === view.scene);
    Object.assign(state, { scene: view.scene, yaw: view.yaw, fov: view.fov, bearing, u: p.u, v: p.v });
    state.updates++;
    return true;
  }
  return { el: box, svg, dot, update, state, destroy() { box.remove(); } };
}

// listen to one iframe's view messages; returns an unsubscribe function
export function listenTourView(frame, cb, win = window) {
  let origin = null;
  try { origin = new URL(frame.src, win.location.href).origin; } catch { /* set later */ }
  const onMsg = (e) => {
    if (e.source !== frame.contentWindow) return;
    if (origin && origin !== 'null' && e.origin !== origin) {
      try { origin = new URL(frame.src, win.location.href).origin; } catch { return; }
      if (e.origin !== origin) return;
    }
    const v = parseViewMessage(e.data);
    if (v) cb(v);
  };
  win.addEventListener('message', onMsg);
  return () => win.removeEventListener('message', onMsg);
}
