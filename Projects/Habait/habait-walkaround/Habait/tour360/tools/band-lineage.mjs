/* Habait Tour360 — tools/band-lineage.mjs (2026-11-05, parity R25: no visible band edge ships).
   A band repair (close-seam.mjs) repaints a vertical strip of a picture; where the repaint does not meet the picture, its edge shows
   as a vertical line, a step in a shelf or a counter, a sofa cut in two (apt846 02-kitchen 2026-11-05, found by Eliran's eye in the
   LIVE tour; the depth gate passed it). The gate cannot see that from depth, so it reads what close-seam recorded:

     v3 composites (`__seam3__`, tools/band_blend.py) carry <picture>.seam.json: per cut the STRUCTURE left where the answer and the
        picture meet (mean |band-pass difference|); a cut above fidelity.json band_edge.max_structure FAILS. The chain is walked through
        each sidecar's `parent`, so an older repair under a newer one is judged too.
     v1 (`__seam__`, 24-px cross-fade: ghosts) and v2 (`__seam2__`, hard cut: tone steps) composites record nothing a gate can
        read: they FAIL unless band_edge.eye_cleared names the file with its evidence crops (the audit looked at every edge by eye).
        The fix is a $0 re-composite: close-seam.mjs ... --raw <its .raw.png> (v3), or a fresh generation.
     A floor finish (finish-pano.mjs) is a whole-picture edit of its source: panos-<floor>/<asset>.source.json names the source pick,
        whose chain is judged; an unrecorded source is judged as the room's current pick and says so.

   bandLineage(APT, pictureFile, asset, cfg) → { verdict: 'PASS'|'FAIL', chain: [{ file, kind, cuts?, worst?, note? }], failures: [..] } */
import fs from 'node:fs';
import path from 'node:path';

export function bandLineage(APT, pictureFile, asset, cfg = {}) {
  const GEN = path.join(APT, '_local', 'generated');
  const maxS = Number(cfg.max_structure ?? 5.0);
  const maxL = Number(cfg.max_line_step_px ?? 4);
  const cleared = new Map((cfg.eye_cleared || []).map((e) => [e.file, e]));
  const picks = fs.existsSync(path.join(APT, '_local', 'picks.json')) ? JSON.parse(fs.readFileSync(path.join(APT, '_local', 'picks.json'), 'utf8')) : {};
  const chain = [], failures = [];
  // 1. the picture → the generated PNG it was made from
  let start = null, note = null, floorSource = null;
  const rel = path.relative(APT, path.resolve(pictureFile)).replace(/\\/g, '/');
  const floorSet = rel.match(/^_local\/panos-([a-z]+)\/([^/]+)\.webp$/);
  if (path.resolve(path.dirname(pictureFile)) === path.resolve(GEN)) start = path.basename(pictureFile);
  else if (floorSet) {
    const src = path.join(path.dirname(pictureFile), `${floorSet[2]}.source.json`);
    if (fs.existsSync(src)) { const j = JSON.parse(fs.readFileSync(src, 'utf8')); start = j.answer; floorSource = j.source; }
    else { start = picks[asset]; note = 'floor finish without a source record: judged as the current pick'; }
  } else { start = picks[asset]; note = 'set picture: judged as the current pick'; }
  if (!start) return { verdict: 'FAIL', chain, failures: [`${asset}: no source picture to judge`] };
  // 2. walk the repairs
  const seen = new Set();
  // a later band repaints everything between its two cuts: an older cut inside that span no longer exists in the picture
  const covered = [];
  const inside = (u) => covered.some(([a, b]) => (a <= b ? u > a + 0.002 && u < b - 0.002 : u > a + 0.002 || u < b - 0.002));
  for (let f = start; f && !seen.has(f); ) {
    seen.add(f);
    const side = path.join(GEN, f.replace(/\.png$/, '.seam.json'));
    if (/__seam3__/.test(f) && fs.existsSync(side)) {
      const j = JSON.parse(fs.readFileSync(side, 'utf8'));
      const live = (j.cuts || []).filter((c) => !inside(Number(c.u)));
      const worst = live.length ? Math.max(...live.map((c) => Number(c.structure ?? Infinity))) : 0;
      chain.push({ file: f, kind: 'band-v3', band: j.band, cuts: j.cuts, worst, ...(live.length < (j.cuts || []).length ? { overwritten: (j.cuts || []).filter((c) => inside(Number(c.u))).map((c) => c.u) } : {}) });
      if (!(worst <= maxS)) failures.push(`${f}: a band edge at u ${live.filter((c) => !(c.structure <= maxS)).map((c) => c.u).join(', ')} (structure ${worst} > ${maxS})`);
      // R25b: a line (skirting, counter, shelf, wall-ceiling) that steps at the cut; a sidecar without the measure is stale (re-composite with --raw)
      const steps = live.map((c) => c.line_step_px);
      if (steps.some((v) => v == null)) failures.push(`${f}: the sidecar predates the line check (re-composite it with close-seam --raw)`);
      else if (steps.length && Math.max(...steps) >= maxL) failures.push(`${f}: a line steps ${Math.max(...steps)} px at u ${live.filter((c) => c.line_step_px >= maxL).map((c) => c.u).join(', ')} (bar ${maxL} px)`);
      // R28 (a): a --ref band needs its transplant guard PASS (the object's width after vs before the repair, +-10 %)
      if (j.ref && j.ref_scale?.verdict !== 'PASS') failures.push(`${f}: a --ref repair without a passing transplant guard (${j.ref_scale ? j.ref_scale.verdict + ' ' + (j.ref_scale.ratio ?? '') : 'not run'})`);
      const us = (j.cuts || []).map((c) => Number(c.u)); if (us.length === 2) covered.push([us[0], us[1]]);
      f = j.parent;
    } else if (/__seam2?__/.test(f)) {
      const kind = /__seam2__/.test(f) ? 'band-v2' : 'band-v1';
      const e = cleared.get(f);
      chain.push({ file: f, kind, ...(e ? { note: `eye-cleared ${e.date}: ${e.evidence}` } : {}) });
      if (!e) failures.push(`${f}: a ${kind} composite records no cut a gate can read (re-composite with close-seam --raw, v3)`);
      if (floorSource) { f = floorSource; floorSource = null; continue; }   // a repair made on a floor finish: the finish's source is judged next
      break;   // v1/v2 keep no parent record; the eye clearance covers every edge of its chain
    } else if (/__floor-/.test(f) && floorSource) { chain.push({ file: f, kind: 'floor-finish' }); f = floorSource; floorSource = null;   // the finish is a whole-picture edit: its source's chain is judged next
    } else { chain.push({ file: f, kind: 'generated' }); break; }
  }
  return { verdict: failures.length ? 'FAIL' : 'PASS', chain, failures, ...(note ? { note } : {}) };
}
