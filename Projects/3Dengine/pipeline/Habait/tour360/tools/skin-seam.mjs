/* Habait Tour360 — tools/skin-seam.mjs (2026-11-01, habait-de; WALKAROUND-QUALITY-PLAN.md OQ-2). Where a skin's own wrap seam is.
   A rolled skin (make-skin-prompts.mjs --roll auto) is rolled back into the camera frame by gen-pano.mjs, so the model's left/right
   join sits at u = roll.u_edge, NOT at x 0 (x 0 is then a column inside the answer and always looks continuous). Until this module,
   openings-test.mjs measured the seam row at x 0 and close-seam.mjs repainted x 0 for every rolled room (9 of apt846's 11): the
   kitchen's cut through the counter at the bedroom-2 hotspot passed the gate (6.2 < 10) and was never closed.
   skinSeamU: the pick's ledger row (inputs_hash = the 12-hex hash in the file name) carries roll_u_edge; else the skin entry's roll
   (by asset id or by camera); else 0 (an unrolled skin). seamLines: the geometric read the luminance step misses — the vertical-gradient
   row profiles of a 6-px strip on each side of the join must correlate (counters, shelves, skirting and ceiling lines continue). */
import fs from 'node:fs';
import path from 'node:path';

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** u in [0,1) of the skin's own join for `skinFile` of apartment dir `APT`; `key` = { asset } or { camera }. */
export function skinSeamU(APT, skinFile, key = {}) {
  const hash = (path.basename(skinFile).match(/__([0-9a-f]{12})\.(png|jpg|webp)$/) || [])[1];
  const ledger = readJson(path.join(APT, '_local', 'ledger.json'));
  const row = hash && ledger && ledger.rows.find((r) => r.inputs_hash === hash && r.roll_u_edge != null);
  if (row) return { u: row.roll_u_edge, from: `ledger row ${row.seq}` };
  const skins = readJson(path.join(APT, 'skin-prompts.json')) || [];
  const e = skins.find((s) => (key.asset && s.id === key.asset) || (key.camera && s.camera === key.camera));
  if (e && e.roll && e.roll.u_edge > 0) return { u: e.roll.u_edge, from: `skin-prompts ${e.id}` };
  return { u: 0, from: e ? `skin-prompts ${e.id} (not rolled)` : 'no roll found' };
}

/** g: greyscale bytes W×H. The join between column xs-1 and xs (wrapping). corr0: the correlation of the two sides' vertical-gradient
    row profiles (rows 12–90 %); 1 = every horizontal line continues, ~0 = nothing lines up. pct: share of the image's other joins that
    read less continuous (a low pct = this join is among the worst columns of the picture). */
export function seamLines({ g, W, H }, xs) {
  const r0 = Math.floor(H * 0.12), r1 = Math.floor(H * 0.9), S = 6;
  const gy = (r, c) => { c = ((c % W) + W) % W; return Math.abs(g[(r + 1) * W + c] - g[(r - 1) * W + c]); };
  const prof = (c0) => { const p = new Float64Array(r1 - r0); for (let r = r0; r < r1; r++) { let s = 0; for (let c = c0; c < c0 + S; c++) s += gy(r, c); p[r - r0] = s; } return p; };
  const corr = (a, b) => { let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length;
    let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; } return da * db > 1e-9 ? n / Math.sqrt(da * db) : 1; };
  const at = (x) => corr(prof(x - S), prof(x));
  const c0 = at(xs); let below = 0, m = 0;
  for (let x = 16; x < W; x += Math.max(1, Math.round(W / 55))) { const d = Math.min(Math.abs(x - xs), W - Math.abs(x - xs)); if (d <= 24 * W / 2048) continue; if (at(x) < c0) below++; m++; }
  return { corr0: +c0.toFixed(3), pct: +(100 * below / Math.max(1, m)).toFixed(1) };
}
