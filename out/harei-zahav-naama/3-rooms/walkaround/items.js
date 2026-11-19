// items.js — RAINBOW's features in the 3D walk (Eliran 2026-11-17: «אני רוצה את כל הפיצ'רים שקיימים בפרויקט של RAINBOW … שינוי ריהוט
// או אביזרים ע"י לחיצה על העיגול … שורת טקסט חופשי לעיצוב»). In a real 3D model a change is a scene operation, not a pixel edit:
//   ring on a piece → sheet: catalog alternatives (swap the GLB), colours, remove / bring back      ($0 per click)
//   free-text line → POST /api/design (scripts/17_walk_server.mjs, RAINBOW's text step + scope rule) → the same operations
//   floor finish · light · undo · compare (hold) · reset · plan with you-are-here · measure
// Data: items/registry.json (the movable pieces, written by the export), items/catalog.json (alternatives per category).
import * as THREE from 'three';

const W = window.__walk?.ready ? window.__walk : await new Promise((ok) => addEventListener('walk-ready', () => ok(window.__walk), { once: true }));
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const j = async (u, d) => { try { const r = await fetch(u); return r.ok ? r.json() : d; } catch { return d; } };
const REG = await j('./items/registry.json', { items: [], finishes: [], plan: null });
const CAT = await j('./items/catalog.json', {});
// the baked room went through the export's exposure and view transform; a piece lit by that room in linear light needs this gain to sit at the same brightness (set by eye against the bake)
const ITEM_GAIN = 2.4;
const SWATCH = [['#c9bfb1', 'פשתן'], ['#8a8f7a', 'זית'], ['#b8734f', 'טרקוטה'], ['#d9c9a3', 'חול'], ['#5c6670', 'אפור כחלחל'], ['#efebe4', 'לבן שבור']];

// ---- light for the pieces: the baked room itself, captured once per room into a reflection map (their gloss matches the bake)
const pmrem = new THREE.PMREMGenerator(W.renderer);
const envs = new Map();
function envFor(room, at) {
  if (envs.has(room)) return envs.get(room);
  const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.05, 60, rt);
  cc.position.set(at.x, 1.3, at.z);
  cc.update(W.renderer, W.scene);   // the pieces live in W.overlay, so the room is captured without them
  const tex = pmrem.fromCubemap(rt.texture).texture;
  envs.set(room, tex);
  return tex;
}
const blob = (() => {   // the soft shadow under a piece (the bake has no piece in it, so a swap leaves nothing behind)
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

// ---- the pieces
const glbs = new Map();
const loadGlb = (u) => { if (!glbs.has(u)) glbs.set(u, W.loader.loadAsync(u).then((g) => g.scene)); return glbs.get(u); };
const live = new Map();   // id → { def, group, model, variant, color, removed, ring }
async function build(def, variant) {
  const src = variant === 'orig' ? (W.phone && def.glb_m ? def.glb_m : def.glb) : (Object.values(CAT).flat().find((c) => c.id === variant) || {}).glb;   // phones load the light copy
  const proto = await loadGlb(src);
  const model = proto.clone(true);
  model.traverse((o) => { if (o.isMesh) {
    o.material = o.material.clone();
    // fabric, wood and rattan are not metal: the generated metalness map would turn them into dark mirrors of the room
    o.material.metalness = 0; o.material.metalnessMap = null;
    if (o.material.specularColor) { o.material.specularColor.setScalar(1); o.material.specularIntensity = 0.5; }   // the GLB asks for 2.0: a glare that eats the colour
    o.material.userData.base = o.material.color.clone();
  } });
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  // the piece as designed takes Blender's own scale (place_items.py); an alternative is fitted to the original's footprint
  const s = variant === 'orig' && def.scale ? def.scale : def.fit === 'height' ? def.size[1] / size.y : Math.max(def.size[0], def.size[2]) / Math.max(size.x, size.z);
  model.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(model), c = b2.getCenter(new THREE.Vector3());
  model.position.set(-c.x, def.hang ? -b2.max.y : -b2.min.y, -c.z);
  const env = envFor(def.room, { x: def.pos[0], z: def.pos[2] });
  model.traverse((o) => { if (o.isMesh) { o.material.envMap = env; o.material.envMapIntensity = ITEM_GAIN; } });
  return model;
}
async function place(def) {
  const group = new THREE.Group();
  group.position.set(def.pos[0], def.pos[1], def.pos[2]);
  group.rotation.y = THREE.MathUtils.degToRad(def.yaw || 0);
  W.overlay.add(group);
  if (!def.hang) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(def.size[0] * 1.2, def.size[2] * 1.25), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.003 - def.pos[1]; sh.renderOrder = 1; sh.visible = false; group.add(sh);
  }   // the piece as designed is in the bake with its real shadow; the soft blob shows only under a swapped-in piece
  const p = { def, group, model: null, variant: 'orig', color: null, removed: false, blob: group.children[0] || null };
  live.set(def.id, p);
  p.model = await build(def, 'orig'); group.add(p.model);
  // upload its textures and build its shader now (the visitor stands still), not on the first frame it comes into view
  p.model.traverse((o) => { if (o.isMesh) for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap']) if (o.material[k]) W.renderer.initTexture(o.material[k]); });
  try { W.renderer.compile(W.overlay, W.camera); } catch { /* compile is an optimisation only */ }
  p.ring = el('button', 'w-ring', `<span class="w-ring-label">${def.name_he}</span>`); p.ring.type = 'button';
  p.ring.setAttribute('aria-label', def.name_he); p.ring.onclick = (e) => { e.stopPropagation(); openSwap(def.id); };
  $('rings').append(p.ring);
}

// ---- the operations (one engine for the rings, the sheet and the free-text line), each with its inverse for undo
const state = { finish: (REG.finishes[0] || {}).id || null, light: { warmth: 4000, level: 1 } };
const undo = [];
const kelvin = (k) => {   // a light colour, relative to 4000 K neutral
  const t = k / 100; const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332; const g = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * (t - 60) ** -0.0755;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305;
  return new THREE.Color(Math.min(255, r) / 255, Math.min(255, g) / 255, Math.min(255, b) / 255);
};
const N4000 = kelvin(4000);
const floors = () => { const out = []; W.shell.traverse((o) => { if (o.isMesh && o.name.startsWith('WALK_floor')) out.push(o); }); return out; };
async function apply(op) {   // → the inverse operation
  const p = op.item ? live.get(op.item) : op.target ? live.get(op.target) : null;
  if (op.op === 'swap' && p) {
    const inv = { op: 'swap', item: op.item, to: p.variant };
    const m = await build(p.def, op.to); p.group.remove(p.model); p.model = m; p.group.add(m); p.variant = op.to; p.color = null;
    if (p.blob) p.blob.visible = op.to !== 'orig';
    return inv;
  }
  if (op.op === 'color' && p) {
    const inv = { op: 'color', target: op.target, hex: p.color };
    p.model.traverse((o) => { if (o.isMesh) o.material.color.copy(o.material.userData.base); });
    if (op.hex) {   // keep the texture (weave, grain), move its tone toward the colour
      const want = new THREE.Color(op.hex);
      p.model.traverse((o) => { if (o.isMesh) o.material.color.copy(o.material.userData.base).multiply(want).multiplyScalar(1.9); });
    }
    p.color = op.hex; return inv;
  }
  if (op.op === 'color' && (op.target === 'walls' || op.target === 'ceiling')) {
    const inv = { op: 'color', target: op.target, hex: state[op.target] || null };
    for (const m of W.baked.filter((m) => m.userData.surface === op.target)) m.color.set(op.hex || '#ffffff');
    state[op.target] = op.hex; return inv;
  }
  if ((op.op === 'remove' || op.op === 'show') && p) {
    const inv = { op: p.removed ? 'remove' : 'show', item: op.item };
    p.removed = op.op === 'remove'; p.group.visible = !p.removed; return inv;
  }
  if (op.op === 'finish') {
    const f = REG.finishes.find((x) => x.id === op.to); if (!f) return null;
    const inv = { op: 'finish', to: state.finish };
    for (const fl of floors()) {
      const m = fl.material;
      if (!m.userData.light) continue;
      if (f.baked) {   // the finish as baked: the hour's atlases come back (daynight.js), or the one baked atlas
        m.userData.finishOn = false; m.lightMap = null; m.map = m.userData.bakedMap; m.needsUpdate = true;
        continue;
      }
      if (!fl.geometry.userData.planar) {   // a second UV set in metres for the tiled finish; the baked UVs keep the light
        const pos = fl.geometry.attributes.position, uv = new Float32Array(pos.count * 2), wp = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { wp.fromBufferAttribute(pos, i).applyMatrix4(fl.matrixWorld); uv[i * 2] = wp.x; uv[i * 2 + 1] = wp.z; }
        fl.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2)); fl.geometry.userData.planar = true;
      }
      const tex = await new THREE.TextureLoader().loadAsync(f.tex); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.channel = 1; tex.repeat.set(1 / f.tile_m, 1 / f.tile_m);
      m.map = tex; m.lightMap = m.userData.light; m.lightMapIntensity = m.userData.lightIntensity; m.needsUpdate = true;
      m.userData.finishOn = true; if (m.userData.u) m.userData.u.uMix.value = 0;   // one texture, the hour's light from the shading map
    }
    if (f.baked) await window.__daynight?.reapply();
    state.finish = op.to; renderDesign(); return inv;
  }
  if (op.op === 'light') {
    const inv = { op: 'light', warmth: state.light.warmth, level: state.light.level };
    const c = kelvin(op.warmth); c.r /= N4000.r; c.g /= N4000.g; c.b /= N4000.b; c.multiplyScalar(op.level);
    for (const m of W.baked) if (!m.userData.surface || m.userData.surface === 'floor' || m.userData.surface === 'walls') m.color.copy(c);
    for (const p2 of live.values()) p2.model.traverse((o) => { if (o.isMesh) o.material.envMapIntensity = op.level * ITEM_GAIN; });
    state.light = { warmth: op.warmth, level: op.level }; renderDesign(); return inv;
  }
  return null;
}
async function run(ops, label) {
  const invs = [];
  for (const op of ops) { const inv = await apply(op); if (inv) invs.unshift(inv); }
  if (invs.length) { undo.push({ label, invs }); renderBar(); }
}
async function undoLast() { const u = undo.pop(); if (!u) return; for (const inv of u.invs) await apply(inv); renderBar(); }
async function resetAll() { while (undo.length) await undoLast(); }
let comparing = null;   // hold «השוואה»: the house as designed; release: your changes come back

// ---- the UI (markup in index.html, look in ui.css — the Habait tour's design language)
const bUndo = $('b-undo'), bCmp = $('b-compare'), bReset = $('b-reset');
function renderBar() { bUndo.disabled = bCmp.disabled = bReset.disabled = !undo.length; }
bUndo.onclick = () => undoLast();
bReset.onclick = () => resetAll();
bCmp.onpointerdown = () => compareHold(true);
bCmp.onpointerup = bCmp.onpointerleave = bCmp.onpointercancel = () => compareHold(false);
$('b-full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
renderBar();
async function compareHold(on) {
  if (on && !comparing && undo.length) {
    comparing = undo.splice(0); bCmp.setAttribute('aria-pressed', 'true');
    for (const u of [...comparing].reverse()) { u.redo = []; for (const inv of u.invs) { const back = await apply(inv); if (back) u.redo.unshift(back); } }
  } else if (!on && comparing) {
    const c = comparing; comparing = null; bCmp.setAttribute('aria-pressed', 'false');
    for (const u of c) { for (const op of u.redo) await apply(op); undo.push({ label: u.label, invs: u.invs }); }
    renderBar();
  }
}

// the toast
function say(he) { const s = $('say'); s.textContent = he; s.classList.remove('hidden'); s.style.opacity = '1'; clearTimeout(say.t); say.t = setTimeout(() => { s.style.opacity = '0'; setTimeout(() => s.classList.add('hidden'), 400); }, 4500); }

// menus: one open at a time
const menus = { 'b-tools': 'm-tools', 'b-time': 'm-time', 'b-design': 'm-design' };
function closeMenus(except) { for (const [b, m] of Object.entries(menus)) if (b !== except) { $(m).classList.add('hidden'); $(b).setAttribute('aria-expanded', 'false'); } }
for (const [b, m] of Object.entries(menus)) $(b).onclick = () => { const open = $(m).classList.contains('hidden'); closeMenus(b); closeSwap(); $(m).classList.toggle('hidden', !open); $(b).setAttribute('aria-expanded', String(open)); if (open && m === 'm-design') setTimeout(() => !matchMedia('(pointer: coarse)').matches && $('i-type').focus(), 50); };
document.querySelectorAll('[data-close]').forEach((x) => { x.onclick = () => closeMenus(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenus(); closeSwap(); } });
$('b-help').onclick = () => say(matchMedia('(pointer: coarse)').matches
  ? 'החיצים למטה: הליכה ופנייה · גרירת אצבע: הסתכלות · הקשה על הרצפה: הליכה אליה · הקשה על עיגול: החלפת פריט'
  : 'חיצים / WASD להליכה · גרירה בעכבר להסתכלות · לחיצה על הרצפה להליכה אליה · לחיצה על עיגול להחלפת פריט');

// «שינוי עיצוב»: floor cards, light chips, the typed line
function renderDesign() {
  const f = REG.finishes.find((x) => x.id === state.finish);
  $('design-chip').textContent = f ? f.name_he.split(' ·')[0].split(' ')[0] : 'עיצוב';
  $('design-chip').classList.toggle('hidden', !f);
  const c = $('c-floor'); c.innerHTML = '';
  for (const x of REG.finishes) {
    const b = el('button', 'w-card', `<img src="${x.thumb}" alt=""><span>${x.name_he}</span>`); b.type = 'button';
    b.setAttribute('aria-pressed', String(state.finish === x.id)); b.onclick = () => run([{ op: 'finish', to: x.id }], x.name_he); c.append(b);
  }
  $('s-floor').classList.toggle('hidden', !REG.finishes.length);
  for (const b of $('c-light').children) b.setAttribute('aria-pressed', String(Number(b.dataset.k) === state.light.warmth));
}
for (const b of $('c-light').children) b.onclick = () => run([{ op: 'light', warmth: Number(b.dataset.k), level: Number(b.dataset.k) === 3000 ? 0.92 : 1 }], b.textContent);
renderDesign();
$('f-type').onsubmit = async (e) => {
  e.preventDefault(); const i = $('i-type'), go = $('b-type'), text = i.value.trim(); if (!text) return;
  go.disabled = true; go.textContent = '…';
  try {
    const items = [...live.values()].map((p) => ({ id: p.def.id, category: p.def.category, room: p.def.room, name: p.def.name_en, now: p.variant, removed: p.removed }));
    const catalog = Object.fromEntries(Object.entries(CAT).map(([c, xs]) => [c, xs.map((x) => ({ id: x.id, name: x.name_en, colour: x.colour, material: x.material }))]));
    const r = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, items, catalog, finishes: REG.finishes.map((f) => ({ id: f.id, name: f.name_en })), room: W.roomAt(W.me.x, W.me.z) }) });
    const a = await r.json().catch(() => ({}));
    if (r.status === 404 || r.status === 501) say('שורת העיצוב פועלת דרך השרת של ההליכה');
    else if (a.allowed) { await run(a.ops, text); say(a.say_he || 'בוצע'); i.value = ''; }
    else say(a.say_he || 'לא הצלחתי להבין את הבקשה, נסו לנסח אחרת');
  } catch { say('השינוי לא נטען, נסו שוב'); }
  go.disabled = false; go.textContent = 'שינוי';
};

// the swap strip of a piece
let swapOpen = null;
function closeSwap() { $('swap')?.remove(); if (swapOpen) live.get(swapOpen)?.ring.classList.remove('on'); swapOpen = null; }
function openSwap(id) {
  closeMenus(); closeSwap();
  const p = live.get(id), d = p.def, alts = CAT[d.category] || [];
  swapOpen = id; p.ring.classList.add('on');
  const s = el('div', 'w-swap'); s.id = 'swap'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', d.name_he);
  const head = el('div', 'w-swap-head', `<h2 class="w-swap-title">${alts.length ? `בחרו פריט במקום ${d.name_he}` : d.name_he}</h2>`);
  const x = el('button', 'w-icon', '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'); x.type = 'button'; x.setAttribute('aria-label', 'סגירה'); x.onclick = closeSwap; head.append(x);
  s.append(head);
  const cards = el('div', 'w-cards');
  const card = (vid, name, img) => {
    const b = el('button', 'w-card', `<img src="${img}" alt=""><span>${name}</span>`); b.type = 'button'; b.title = name;
    b.setAttribute('aria-pressed', String(p.variant === vid));
    b.onclick = async () => { await run([{ op: 'swap', item: id, to: vid }], name); openSwap(id); };
    cards.append(b);
  };
  card('orig', 'כמו בהדמיה', d.thumb);
  for (const a of alts) card(a.id, a.name_he, a.thumb);
  s.append(cards);
  if (!alts.length) s.append(el('p', 'w-hint', 'חלופות לפריט הזה יתווספו בקרוב.'));
  const sw = el('div', 'w-swatches', '<b>צבע</b>');
  for (const [hex, nm] of SWATCH) { const b = el('button', 'w-sw'); b.type = 'button'; b.style.background = hex; b.title = nm; b.setAttribute('aria-label', nm); b.setAttribute('aria-pressed', String(p.color === hex)); b.onclick = async () => { await run([{ op: 'color', target: id, hex }], nm); openSwap(id); }; sw.append(b); }
  s.append(sw);
  const foot = el('div', 'w-swap-foot');
  const rm = el('button', 'w-link', p.removed ? 'החזרת הפריט' : 'הסרת הפריט'); rm.type = 'button';
  rm.onclick = async () => { await run([{ op: p.removed ? 'show' : 'remove', item: id }], 'הסרה'); openSwap(id); };
  const back = el('button', 'w-link', 'צבע מקורי'); back.type = 'button'; back.onclick = async () => { await run([{ op: 'color', target: id, hex: null }], 'צבע מקורי'); openSwap(id); };
  foot.append(rm, ...(p.color ? [back] : []), el('span', 'w-ai', 'הדמיה · פריט שנוצר בעזרת AI לפי הדמיות היזם'));
  s.append(foot);
  document.body.append(s);
}

// «כלי עזר»: measure, plan, rings on / off
$('b-measure').onclick = () => { closeMenus(); toggleMeasure(); };
$('b-rings').onclick = () => { const on = $('b-rings').getAttribute('aria-pressed') !== 'true'; $('b-rings').setAttribute('aria-pressed', String(on)); $('rings').classList.toggle('hidden', !on); if (!on) closeSwap(); };
$('b-help2').onclick = () => { closeMenus(); $('b-help').click(); };
$('b-map').onclick = () => { const on = $('b-map').getAttribute('aria-pressed') !== 'true'; $('b-map').setAttribute('aria-pressed', String(on)); $('map')?.classList.toggle('hidden', !on); };

// the rooms: the strip of cards and the room capsule
const VIEWS = Object.keys(W.NAMES).filter((k) => W.grid.views[k]);
let here = 'living';
function setHere(k) {
  here = k; $('room-name').textContent = W.NAMES[k]; $('room-count').textContent = `${VIEWS.indexOf(k) + 1} / ${VIEWS.length}`;
  for (const c of $('strip').children) c.setAttribute('aria-current', String(c.dataset.v === k));
}
VIEWS.forEach((k, i) => {
  const c = el('button', 'w-room-card', `<i>${String(i + 1).padStart(2, '0')}</i><span>${W.NAMES[k]}</span>`); c.type = 'button'; c.dataset.v = k;
  c.style.backgroundImage = `url(./thumbs/${k}.jpg)`; c.setAttribute('role', 'listitem');
  c.onclick = () => { W.goTo(k); setHere(k); closeSwap(); };
  $('strip').append(c);
});
const step = (d) => { const k = VIEWS[(VIEWS.indexOf(here) + d + VIEWS.length) % VIEWS.length]; W.goTo(k); setHere(k); closeSwap(); };
$('b-next').onclick = () => step(1); $('b-prev').onclick = () => step(-1);
$('b-rooms').onclick = () => { const o = !$('bottom').classList.contains('open'); $('bottom').classList.toggle('open', o); $('b-rooms').setAttribute('aria-expanded', String(o)); };
W.onRoom = (he) => { const k = VIEWS.find((v) => W.NAMES[v] === he || (he && he.includes(W.NAMES[v]))); if (k) setHere(k); };
setHere(VIEWS[0]); W.onRoom(W.roomAt(W.me.x, W.me.z));

// ---- plan with you-are-here
if (REG.plan) {
  const m = el('div', 'w-map glass'); m.id = 'map'; const cv = el('canvas'); m.append(cv); document.body.append(m);
  if (W.phone) { m.classList.add('hidden'); $('b-map').setAttribute('aria-pressed', 'false'); }   // the phone opens clean (2026-11-18); «כלי עזר» › «תכנית ומיקום» shows it
  m.title = 'תכנית ומיקום'; m.onclick = () => m.classList.toggle('big');
  const img = new Image(); img.src = REG.plan.src;
  img.onload = () => { cv.width = img.width * REG.plan.scale; cv.height = img.height * REG.plan.scale; };
  W.hooks.push(() => {
    if (!img.complete || !cv.width || m.classList.contains('hidden')) return;
    const g = cv.getContext('2d'), k = REG.plan.scale; g.drawImage(img, 0, 0, cv.width, cv.height);
    const c = REG.plan.px_per_cm;
    const x = (REG.plan.ox + W.me.x * 100 * c) * k, y = (REG.plan.oy + W.me.z * 100 * c) * k, a = -W.me.yaw - Math.PI / 2;
    const gr = g.createRadialGradient(x, y, 2, x, y, 180 * c * k); gr.addColorStop(0, 'rgba(0,93,131,.45)'); gr.addColorStop(1, 'rgba(0,93,131,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 180 * c * k, a - 0.6, a + 0.6); g.closePath(); g.fill();
    g.fillStyle = '#005d83'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); g.stroke();
  });
}

// ---- measure: two taps on any surface
let measuring = false, mPts = [], mObjs = [];
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function toggleMeasure() {
  measuring = !measuring; $('b-measure').setAttribute('aria-pressed', String(measuring)); mPts = [];
  for (const o of mObjs) W.scene.remove(o); mObjs = []; $('mlabel')?.remove(); $('mbar')?.remove();
  W.tapOverride = measuring ? measureTap : null;
  if (measuring) {
    const b = el('div', 'w-measure', '<span>הקישו על שתי נקודות כדי למדוד</span>'); b.id = 'mbar';
    const done = el('button', null, 'סיום'); done.type = 'button'; done.onclick = toggleMeasure; b.append(done); document.body.append(b);
  }
}
function measureTap(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, W.camera);
  const hit = ray.intersectObjects([...W.scene.children, ...W.overlay.children], true).sort((x, y) => x.distance - y.distance).find((h) => h.object.isMesh && h.object.material && !h.object.material.transparent && h.object.visible);
  if (!hit) return true;
  if (mPts.length === 2) { for (const o of mObjs) W.scene.remove(o); mObjs = []; mPts = []; $('mlabel')?.remove(); }
  mPts.push(hit.point.clone());
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })); dot.position.copy(hit.point); dot.renderOrder = 9; W.scene.add(dot); mObjs.push(dot);
  if (mPts.length === 2) {
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(mPts), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false })); ln.renderOrder = 9; W.scene.add(ln); mObjs.push(ln);
    const lab = el('div'); lab.id = 'mlabel'; lab.textContent = `${mPts[0].distanceTo(mPts[1]).toFixed(2)} m`; document.body.append(lab);
  }
  return true;
}

// ---- rings follow their pieces; hidden when far, behind you, behind a wall, or while measuring
const v = new THREE.Vector3(), occ = new THREE.Raycaster();
let frame = 0;
W.hooks.push(() => {
  frame++;
  if (mPts.length === 2 && $('mlabel')) { v.copy(mPts[0]).add(mPts[1]).multiplyScalar(0.5).project(W.camera); $('mlabel').style.left = ((v.x + 1) / 2) * innerWidth + 'px'; $('mlabel').style.top = ((1 - v.y) / 2) * innerHeight + 'px'; }
  for (const p of live.values()) {
    if (!p.ring) continue;
    const d = p.def; v.set(d.pos[0], d.ring_y ?? d.pos[1] + d.size[1] * 0.75, d.pos[2]);
    const dist = v.distanceTo(W.camera.position);
    let show = dist < 7.5 && !measuring && !p.removed;
    if (show && frame % 6 === 0) {
      occ.set(W.camera.position, v.clone().sub(W.camera.position).normalize()); occ.far = dist - 0.3;
      p.hidden = occ.intersectObject(W.shell, true).some((h) => h.object.material && !h.object.material.transparent);
    }
    show = show && !p.hidden;
    v.project(W.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02) show = false;
    p.ring.style.display = show || swapOpen === p.def.id ? '' : 'none';
    if (show) { p.ring.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; p.ring.style.top = ((1 - v.y) / 2) * innerHeight + 'px'; }
  }
});

// the pieces load: a desktop all at once; a phone one at a time, nearest first, and only while the visitor stands still
// (2026-11-18 «ההליכה עדיין זזה בתקיעות»: decoding a piece blocks the page for a moment — never in the middle of a step)
if (!W.phone) for (const def of REG.items) place(def).catch((e) => console.warn('item', def.id, e));
else (async () => {
  const left = [...REG.items];
  const still = () => !W.mv || (Math.abs(W.mv.v) < 0.02 && Math.abs(W.mv.t) < 0.02);
  const idle = () => new Promise((r) => { const f = () => (still() ? r() : setTimeout(f, 120)); f(); });
  while (left.length) {
    left.sort((a, b) => Math.hypot(a.pos[0] - W.me.x, a.pos[2] - W.me.z) - Math.hypot(b.pos[0] - W.me.x, b.pos[2] - W.me.z));
    await idle();
    const def = left.shift();
    await place(def).catch((e) => console.warn('item', def.id, e));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));   // let a frame draw between two pieces
  }
})();
function relight(level = 1) {   // daynight.js: the room's light changed — re-capture the pieces' reflections from the mixed room
  envs.clear();
  for (const p of live.values()) { if (!p.model) continue; const env = envFor(p.def.room, { x: p.def.pos[0], z: p.def.pos[2] }); p.model.traverse((o) => { if (o.isMesh) { o.material.envMap = env; o.material.envMapIntensity = level * ITEM_GAIN; } }); }
}
window.__items = { live, state, run, undo, REG, CAT, openSwap, relight };
