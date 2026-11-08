// picker.js — the apartment picker at the hold: one pill per unit from units.json (the :8850 shell's contract), placed on the 3D facade.
// Positions: box_world centre when the unit has one; otherwise derived from apt 846's terrace point: floors step 2.9 m, bays (…5 / …6 / …7)
// step 9 m along the facade tangent — APPROXIMATE until card 03 delivers box_world per unit.
import * as THREE from './lib/three.module.js';

export async function loadUnits(q) {
  const url = q.get('units') || 'http://127.0.0.1:8850/fixtures/rainbow/units.json';
  let units = [];
  for (const u of [url, './data/units_fixture.json']) {
    try { const d = await (await fetch(u)).json(); units = (d.units || d); break; } catch (e) { console.warn('units fetch failed', u, e.message); }
  }
  // the engine's units.json (card 03) carries box_world per unit in plan-world metres: merge the boxes by id (ids like 'apt846' or '846')
  try {
    const real = await (await fetch(q.get('boxes') || './data/units_real.json')).json();
    for (const r of (real.units || real)) { const id = String(r.id).replace(/^apt/, ''); const u = units.find((x) => String(x.id) === id); if (u && r.box_world) u.box_world = r.box_world; }
  } catch (e) { console.warn('boxes not merged', e.message); }
  return units;
}

export function placeUnits(units, anchor846, facadeTangent, upZ = new THREE.Vector3(0, 0, 1)) {
  return units.map((u) => {
    let pos;
    if (u.box_world) { const b = u.box_world; pos = new THREE.Vector3((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); }
    else {
      const bay = { 5: -9, 6: 0, 7: 9 }[Number(String(u.id).slice(-1))] ?? 0;
      pos = anchor846.clone().addScaledVector(facadeTangent, bay).addScaledVector(upZ, (u.floor - 16) * 3.2);
    }
    return { ...u, pos, approx: !u.box_world };
  });
}

const heStatus = { 'for-sale': 'למכירה', reserved: 'שמורה', sold: 'נמכרה' };

export function buildPills(placed, layer, onPick) {
  layer.innerHTML = '';
  for (const u of placed) {
    const el = document.createElement('button'); el.type = 'button';
    el.className = `hotspot status-${u.status}`;
    el.innerHTML = `<span class="dot"></span><span>${u.id}</span><span class="sub">קומה ${u.floor} · ${u.rooms} חדרים</span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); onPick(u, el); });
    layer.appendChild(el); u.el = el;
  }
}

export function updatePills(placed, camera, visible) {
  const v = new THREE.Vector3();
  for (const u of placed) {
    if (!visible) { u.el.style.display = 'none'; continue; }
    v.copy(u.pos).project(camera);
    const ok = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    u.el.style.display = ok ? 'flex' : 'none';
    if (ok) { u.el.style.left = `${(v.x + 1) / 2 * innerWidth}px`; u.el.style.top = `${(1 - v.y) / 2 * innerHeight}px`; }
  }
}

export function showCard(u, canFly) {
  const fmt = (n) => (n ? n.toLocaleString('he-IL') + ' ₪' : 'מחיר לפי פנייה');
  document.getElementById('cardTitle').innerHTML = `דירה ${u.id} <span class="status ${u.status === 'for-sale' ? '' : u.status}">${heStatus[u.status] || u.status}</span>`;
  const rows = [['קומה', u.floor], ['חדרים', u.rooms], ['שטח', u.area_m2 ? `${u.area_m2} מ"ר` : '—'], ['מרפסת', u.outdoor_m2 ? `${u.outdoor_m2} מ"ר` : '—'], ['מחיר', fmt(u.price)]];
  document.getElementById('cardRows').innerHTML = rows.map(([k, val]) => `<div class="row"><span>${k}</span><span>${val}</span></div>`).join('');
  document.getElementById('cardFly').style.display = canFly ? '' : 'none';
  document.getElementById('card').style.display = 'block';
}

export function hideCard() { document.getElementById('card').style.display = 'none'; }
