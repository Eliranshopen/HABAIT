// daynight.js — «שעה ביום» in the walk (Eliran 2026-11-17: «תשתמש גם בסקיל הזה … day-night-keyframes ותטמיע אותו כפיצ'ר»).
// The skill's mode B: the light is baked once per keyframe on the SAME model (media/<key>/bake_<g>.jpg); the clock picks the two
// keyframes around it and the shader mixes them in linear light (walk.js mixMat). The live parts follow: sky, sun, the AI pieces'
// reflections (items.js re-captures them from the mixed room). The floor finish keeps the light of the nearer keyframe.
import * as THREE from 'three';

const W = window.__walk?.ready ? window.__walk : await new Promise((ok) => addEventListener('walk-ready', () => ok(window.__walk), { once: true }));
const $ = (id) => document.getElementById(id);
const DN = new URLSearchParams(location.search).get('dn') === '0' ? null : await fetch('./daynight.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (!DN || !Array.isArray(DN.keys)) $('b-time')?.classList.add('hidden');   // no keyframes baked for this walk: the time of day is off
else await init();
async function init() {
const KF = DN.keys.slice().sort((a, b) => a.hour - b.hour);
const mats = W.baked.filter((m) => m.userData.group != null);
const bracket = (h) => {
  if (h <= KF[0].hour) return [KF[0], KF[0], 0];
  const z = KF[KF.length - 1]; if (h >= z.hour) return [z, z, 0];
  for (let i = 0; i < KF.length - 1; i++) if (h >= KF[i].hour && h <= KF[i + 1].hour) return [KF[i], KF[i + 1], (h - KF[i].hour) / (KF[i + 1].hour - KF[i].hour)];
  return [KF[0], KF[0], 0];
};
const tl = new THREE.TextureLoader(), cache = new Map();
function tex(url, proto, color = true) {
  if (!cache.has(url)) cache.set(url, tl.loadAsync(url).then((t) => {
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false; if (proto) { t.wrapS = proto.wrapS; t.wrapT = proto.wrapT; }
    t.anisotropy = Math.min(4, W.renderer.capabilities.getMaxAnisotropy()); return t;
  }));
  return cache.get(url);
}
const atlas = (key, m) => tex(`./media/${key}/bake_${m.userData.group}${W.phone ? '_1k' : ''}.jpg`, m.userData.proto);
// the photo skin: skin/bake_<g>.jpg made in the light of DN.skin_key (its atlases are the reference the hours are divided by)
const SKIN = DN.skin_key && (await fetch(`./skin/bake_0${W.phone ? '_1k' : ''}.jpg`, { method: 'HEAD' }).then((r) => r.ok).catch(() => false));
if (SKIN) {
  const [sk, rf] = await Promise.all([Promise.all(mats.map((m) => tex(`./skin/bake_${m.userData.group}${W.phone ? '_1k' : ''}.jpg`, m.userData.proto))),
    Promise.all(mats.map((m) => (DN.skin_key === 'base' ? m.userData.proto : atlas(DN.skin_key, m))))]);
  mats.forEach((m, i) => { m.userData.u.skinMap.value = sk[i]; m.userData.u.refMap.value = rf[i]; m.userData.u.uSkin.value = 1; });
}
const lerp = (a, b, t) => a + (b - a) * t;
const dn = { hour: +(new URLSearchParams(location.search).get('hour') ?? DN.start), a: null, b: null, t: 0, ready: false };
let seq = 0, relightT = 0;
async function setHour(h) {
  h = THREE.MathUtils.clamp(h, DN.hours[0], DN.hours[1]);
  const my = ++seq, [a, b, t] = bracket(h);
  dn.hour = h; showClock(h);
  const [ta, tb] = await Promise.all([Promise.all(mats.map((m) => atlas(a.name, m))), Promise.all(mats.map((m) => atlas(b.name, m)))]);
  const near = t < 0.5 ? a : b;
  const shades = await Promise.all(mats.map((m) => (m.userData.surface === 'floor' ? tex(`./media/${near.name}/bake_${m.userData.group}_shade.png`, null, false).catch(() => null) : null)));
  if (my !== seq) return;   // a newer hour won
  mats.forEach((m, i) => {
    m.userData.bakedMap = ta[i];
    if (shades[i]) { m.userData.light = shades[i]; if (m.userData.finishOn) { m.lightMap = shades[i]; m.needsUpdate = true; return; } }
    m.map = ta[i]; m.userData.u.map2.value = tb[i]; m.userData.u.uMix.value = t;
  });
  W.scene.backgroundIntensity = lerp(a.sky, b.sky, t);
  W.hemi.intensity = lerp(a.hemi, b.hemi, t); W.sun.intensity = lerp(a.sun, b.sun, t);
  W.sun.color.setRGB(lerp(a.sunColor[0], b.sunColor[0], t), lerp(a.sunColor[1], b.sunColor[1], t), lerp(a.sunColor[2], b.sunColor[2], t));
  Object.assign(dn, { a: a.name, b: b.name, t, ready: true });
  $('t-mix').textContent = t < 0.005 || t > 0.995 ? (t > 0.995 ? b : a).label : `${a.label} ${Math.round((1 - t) * 100)}% · ${b.label} ${Math.round(t * 100)}%`;
  for (const c of $('t-keys').children) c.setAttribute('aria-pressed', String(Math.abs(Number(c.dataset.h) - h) < 0.26));
  clearTimeout(relightT); relightT = setTimeout(() => window.__items?.relight?.(lerp(a.items ?? 1, b.items ?? 1, t)), playing ? 600 : 120);
  if (W.phone) for (const [u, p] of cache) if (!u.includes(`/${a.name}/`) && !u.includes(`/${b.name}/`) && !u.includes('/skin/') && !u.includes(`/${DN.skin_key}/`)) { p.then((x) => x.dispose()); cache.delete(u); }
}
const hhmm = (h) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
function showClock(h) { $('time-chip').textContent = hhmm(h); $('t-clock').textContent = hhmm(h); $('t-hour').value = h; }
$('t-hour').min = DN.hours[0]; $('t-hour').max = DN.hours[1];
$('t-hour').addEventListener('input', (e) => { stop(); setHour(+e.target.value); });
for (const k of KF) { const b = document.createElement('button'); b.type = 'button'; b.textContent = k.label; b.dataset.h = k.hour; b.onclick = () => { stop(); setHour(k.hour); }; $('t-keys').append(b); }
let playing = false, lastPlay = 0;
const stop = () => { playing = false; $('t-play').setAttribute('aria-pressed', 'false'); $('t-play').setAttribute('aria-label', 'הפעלת היום'); };
$('t-play').onclick = () => { playing = !playing; $('t-play').setAttribute('aria-pressed', String(playing)); if (playing && dn.hour >= DN.hours[1] - 0.01) setHour(DN.hours[0]); };
W.hooks.push(() => {   // the day plays at one hour per second
  const t = performance.now();
  if (playing && t - lastPlay > 50) { lastPlay = t; const h = dn.hour + 0.05; if (h >= DN.hours[1]) stop(); setHour(Math.min(h, DN.hours[1])); }
});
for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'keydown']) $('m-time').addEventListener(ev, (e) => e.stopPropagation());
window.__daynight = { setHour, dn, reapply: () => setHour(dn.hour) };
await setHour(dn.hour);
}
