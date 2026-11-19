// daynight.js — "שעה ביום": the day-night-keyframes skill (C:\RnD\.claude\skills\day-night-keyframes) in a real-time walk.
// Same four keyframes, hours and clock as the skill's walk viewer (daynight.example.json + walk_presets.example.json):
// light(h) = (1−t)·K_i + t·K_{i+1} between the two keyframes that bracket the clock. Built differently from the skill's
// mode B: the keyframes are LIGHT PARAMETERS mixed live (sun bearing/height/colour/strength, sky, lamps, exposure), not
// baked atlases — the swap circles need live lighting and this apartment's bake is still mottled (qa-report). $0.
// Light only: never geometry, materials or cameras. North = sheet up is ASSUMED (said in the caption).
import * as THREE from 'three';

const KEYS = [   // hours and bearings from the skill's presets; strengths tuned to this scene's real-time light
  { name: 'morning', he: 'בוקר', en: 'Morning', hour: 7.5, az: 100, el: 14, sun: 2.4, sunColor: [1.0, 0.84, 0.68], sky: 0.8, env: 0.45, hemi: 0.3, lamps: 1.0, shade: 0.6, exp: 0.95 },
  { name: 'noon', he: 'צהריים', en: 'Noon', hour: 12.5, az: 185, el: 55, sun: 3.4, sunColor: [1.0, 0.97, 0.93], sky: 0.95, env: 0.6, hemi: 0.38, lamps: 1.0, shade: 0.6, exp: 0.92 },
  { name: 'golden', he: 'שקיעה', en: 'Sunset', hour: 17.5, az: 262, el: 7, sun: 2.6, sunColor: [1.0, 0.62, 0.36], sky: 0.5, env: 0.32, hemi: 0.2, lamps: 1.5, shade: 1.2, exp: 0.98 },
  { name: 'night', he: 'לילה', en: 'Night', hour: 21.5, az: 262, el: -6, sun: 0.0, sunColor: [0.6, 0.7, 1.0], sky: 0.03, env: 0.05, hemi: 0.04, lamps: 3.6, shade: 2.6, exp: 1.05 },
];
const H0 = 6, H1 = 22, START = 14;
const LAMP_NIGHT = new THREE.Color(1.0, 0.76, 0.5);

export function bracket(h) {   // the two keyframes around hour h and the weight of the second
  if (h <= KEYS[0].hour) return [KEYS[0], KEYS[0], 0];
  for (let i = 0; i < KEYS.length - 1; i++) if (h <= KEYS[i + 1].hour) return [KEYS[i], KEYS[i + 1], (h - KEYS[i].hour) / (KEYS[i + 1].hour - KEYS[i].hour)];
  const k = KEYS[KEYS.length - 1]; return [k, k, 0];
}
const mix = (a, b, t) => a + (b - a) * t;

export function initDayNight({ scene, renderer, sun, MAT, centre, phone, lang = () => 'he', onKeys = null, expScale = 1 }) {
  const lamps = scene.children.filter((o) => o.isPointLight).map((l) => ({ l, base: l.intensity, color: l.color.clone() }));
  const hemi = scene.children.find((o) => o.isHemisphereLight); const hemiBase = hemi ? hemi.intensity : 0;
  const shadeBase = MAT.shade ? MAT.shade.emissiveIntensity : 0;
  const S = { hour: START, playing: false, mixInfo: null };
  const sunCol = new THREE.Color(), c2 = new THREE.Color();

  function apply(h) {
    S.hour = THREE.MathUtils.clamp(h, H0, H1);
    const [a, b, t] = bracket(S.hour); S.mixInfo = { a: a.name, b: b.name, t };
    if (onKeys) onKeys(a.name, b.name, t);   // the skill's baked atlases of the same two keyframes
    const az = THREE.MathUtils.degToRad(mix(a.az, b.az, t)), el = THREE.MathUtils.degToRad(mix(a.el, b.el, t));
    sun.position.set(centre.x + Math.sin(az) * Math.cos(Math.max(el, 0.02)) * 30, Math.max(Math.sin(el), 0.02) * 30, -(centre.y + Math.cos(az) * Math.cos(Math.max(el, 0.02)) * 30));
    sun.intensity = mix(a.sun, b.sun, t) * (el > 0 ? 1 : 0); sun.castShadow = sun.intensity > 0.05;
    sun.color.copy(sunCol.setRGB(...a.sunColor).lerp(c2.setRGB(...b.sunColor), t));
    scene.backgroundIntensity = mix(a.sky, b.sky, t); scene.environmentIntensity = mix(a.env, b.env, t);
    if (hemi) hemi.intensity = mix(a.hemi, b.hemi, t) / 0.35 * hemiBase;
    const lk = mix(a.lamps, b.lamps, t), warm = THREE.MathUtils.clamp((lk - 1) / 2.6, 0, 1);
    for (const { l, base, color } of lamps) { l.intensity = l.userData.dn = base * lk; l.color.copy(color).lerp(LAMP_NIGHT, warm); }
    if (MAT.shade) MAT.shade.emissiveIntensity = shadeBase * mix(a.shade, b.shade, t) / 0.6;
    renderer.toneMappingExposure = mix(a.exp, b.exp, t) * expScale;   // with the baked shell only the live furniture takes this light
    if (MAT.ceiling) MAT.ceiling.emissiveIntensity = 0.2 * (mix(a.env, b.env, t) / 0.6) + 0.025 * Math.max(0, lk - 1);
    draw();
  }

  // ---------------------------------------------------------------- the clock bar (the skill's #light: label, clock, play, range, ticks)
  const bar = document.createElement('section'); bar.className = 'dn glass'; bar.id = 'daynight';
  bar.innerHTML = `<div class="dn-row"><b class="dn-t"></b><span class="dn-clock" dir="ltr"></span><button type="button" class="dn-play"></button></div>
    <input type="range" class="dn-range" min="${H0}" max="${H1}" step="0.05" dir="ltr"><div class="dn-ticks" dir="ltr"></div><small class="dn-note"></small>`;
  document.body.appendChild(bar);
  const range = bar.querySelector('.dn-range'), clock = bar.querySelector('.dn-clock'), play = bar.querySelector('.dn-play'), ticks = bar.querySelector('.dn-ticks');
  for (const k of KEYS) { const b = document.createElement('button'); b.type = 'button'; b.style.left = `${((k.hour - H0) / (H1 - H0)) * 100}%`; b.onclick = () => { stop(); apply(k.hour); }; b.dataset.k = k.name; ticks.appendChild(b); }
  range.addEventListener('input', () => { stop(); apply(+range.value); });
  let raf = 0, last = 0;
  function stop() { S.playing = false; cancelAnimationFrame(raf); label(); }
  function loop(t) { const dt = Math.min(0.1, (t - last) / 1000); last = t; let h = S.hour + dt * 1.0; if (h >= H1) { apply(H1); return stop(); } apply(h); raf = requestAnimationFrame(loop); }
  play.onclick = () => { if (S.playing) return stop(); S.playing = true; if (S.hour >= H1 - 0.1) apply(H0); last = performance.now(); raf = requestAnimationFrame(loop); label(); };
  function draw() {
    range.value = S.hour; const hh = Math.floor(S.hour), mm = Math.round((S.hour - hh) * 60) % 60;
    clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    for (const b of ticks.children) b.setAttribute('aria-pressed', String(S.mixInfo && (S.mixInfo.t < 0.5 ? S.mixInfo.a : S.mixInfo.b) === b.dataset.k));
  }
  function label() {
    const en = lang() === 'en';
    bar.querySelector('.dn-t').textContent = en ? 'Time of day' : 'שעה ביום'; range.setAttribute('aria-label', en ? 'Time of day' : 'שעה ביום');
    play.textContent = S.playing ? '❚❚' : '▶'; play.setAttribute('aria-label', en ? (S.playing ? 'Pause' : 'Play a whole day') : (S.playing ? 'עצירה' : 'נגן יום שלם'));
    for (const b of ticks.children) { const k = KEYS.find((q) => q.name === b.dataset.k); b.textContent = en ? k.en : k.he; }
    bar.querySelector('.dn-note').textContent = en ? 'Light simulated · north as drawn on the plan (assumed)' : 'אור מדומה · צפון לפי התכנית (הנחה)';
  }
  const setOpen = (on) => { bar.hidden = !on; S.open = on; };
  label(); apply(START); setOpen(!phone);
  return { apply, bracket, get hour() { return S.hour; }, get mixInfo() { return S.mixInfo; }, setOpen, get open() { return !!S.open; }, relabel: label, keys: KEYS };
}
