/* Habait Tour360 — tools/scan-pieces.mjs (T16a, CATALOG-PLAN.md §10.3 step 1, D-CAT-12/15/16) — the scan at build time.
   Every scene is scanned once, ahead of the visitor: four views per scene (yaw = heading + 0/90/180/270, pitch -15, hfov 90,
   1264×848) cut from the balanced panorama with the page's own maths (tools/pano-geometry.mjs), one vision call per view for every
   piece of furniture (label, category, box, outline), the outline checked against its box (else the box), pieces seen twice kept
   once, chairs gathered into their table's set. The result is apartments/<id>/markers.json — directions on the sphere, never view
   pixels — which build-tour --catalog carries into the page as the markers a visitor taps.

     timeout 540 node Habait/tour360/tools/scan-pieces.mjs <apartment> [--scenes a,b] [--force] [--dry] [--budget 0.25]
       scans every scene whose panorama is new or changed (its SHA-256 against the file); --force rescans; --dry renders the views
       into the sheet folder and spends nothing. Every call is reserved and settled in apartments/<id>/_local/ledger.json
       (op "scan") and counted against --budget for this run.
     timeout 60  node Habait/tour360/tools/scan-pieces.mjs <apartment> --drop <pieceId> --why "<reason>"
       removes one piece the sheet showed wrong (recorded under "dropped", never a hand edit) and rewrites the scene's markers.
     timeout 60  node Habait/tour360/tools/scan-pieces.mjs <apartment> --sheet
       redraws qa-evidence/tour360/T16/scan/index.html from the file: every view with its outlines (markers red, the rest yellow).
     timeout 60  node Habait/tour360/tools/scan-pieces.mjs <apartment> --refinish
       recomputes the dedupe, the sets, the flags and the page's lists from the stored pieces, and redraws the sheet — $0.
     timeout 60  node Habait/tour360/tools/scan-pieces.mjs <apartment> --same <idA>=<idB> --why "<reason>"
       T18d (D-CAT-27): the two markers are ONE piece seen from two scenes (the living sofa, seen from the kitchen) — recorded under
       "identities" with the reason, applied as `piece` on both markers; a swap of one re-runs in every scene that sees the piece.
       Matching by hand for now: the scenes' plan positions and the pieces' directions could do it (an open question), the demo has one pair.
     timeout 120 node Habait/tour360/tools/scan-pieces.mjs <apartment> --probe <scene>-<k>
       T18c: runs the vision prompt on ONE stored view (e.g. terrace-0) and prints what it answers — label, category, placement,
       box — writing nothing to the file; one ledger row (op "scan-probe", ≈ $0.005). The way to read a prompt change before a re-scan.
   T18c (2026-10-08 night, the test report's F3): the prompt names each piece's PLACEMENT — in the room, or seen through a window, a
   glass door, a doorway or a pass-through — and a through-opening piece gets no marker (the terrace saw the living room's sofa, coffee
   table and dining table through the glass, and a swap landed inside the glass); the ring is anchored on the piece's VISIBLE top
   (30 % down its outline), not the box's centre (the hall table's ring sat on the kitchen island's edge that hides the table's base).
   The span floor stays at 12°: the hall's real dining table spans 16°.

   Secrets by name: OPENROUTER_API_KEY from the root .env (file-ledger.mjs' loadEnv); never printed. Prices: the vision call settles
   at the cost OpenRouter reports (usage.cost), else at the handler's TEXT_USD assumption. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import * as G from './pano-geometry.mjs';
import { TEXT_MODEL, TEXT_USD } from '../server/handler.mjs';
import { chatFetch, hasChat } from '../server/chat-transport.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = path.resolve(ROOT, '..', '..');
// project-runner 2026-11-04: a worktree has no .env — --env-root (or HABAIT_ENV_ROOT) names the tree whose .env holds the key (by name only)
const ENV_ROOT = (() => { const i = process.argv.indexOf('--env-root'); return i > 0 ? process.argv[i + 1] : (process.env.HABAIT_ENV_ROOT || HARNESS); })();
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const has = (name) => process.argv.includes(name);
const id = process.argv[2];
if (!id || id.startsWith('--')) { console.error('usage: scan-pieces.mjs <apartment> [--scenes a,b] [--force] [--dry] [--budget 0.25] | --drop <id> --why "<reason>" | --sheet'); process.exit(2); }

const APT = path.join(ROOT, 'apartments', id);
const PANOS = path.join(APT, 'panos', 'balanced');
const FILE = path.join(APT, 'markers.json');
const LEDGER = path.join(APT, '_local', 'ledger.json');
const SHEET = path.join(HARNESS, 'qa-evidence', 'tour360', 'T16', 'scan');
const W = 1264, H = 848;
const VIEWS = { yaws: [0, 90, 180, 270], pitch: -15, hfov: 90, size: [W, H] };
const CATEGORIES = ['sofa', 'armchair', 'coffee_table', 'dining_table', 'chair', 'bed', 'lamp', 'rug', 'shelf', 'other'];
const SET_REACH = 1.3; // a chair within 1.3 × the table's angular span of the table's centre belongs to its set
const MIN_SPAN = 12; // a marker needs a piece at least 12° across: smaller, it fills under a quarter of the zoomed crop (hfov floor 45°) — a sofa seen through a doorway is no target
const DEDUPE_DEG = 10;
const MAX_OUTLINE = 40;
const BUDGET = Number(arg('--budget', '0.25'));

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const { round, clamp, norm } = G;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const scenesDoc = readJson(path.join(APT, 'scenes.json'));
const catalog = readJson(path.join(ROOT, 'catalog', 'items.json'));
const withItems = [...new Set(catalog.items.map((it) => it.category))];
const loadDoc = () => (fs.existsSync(FILE) ? readJson(FILE) : { $schema: 'tour360/markers.v1', apartment: id, scanned_on: null, model: TEXT_MODEL, views: VIEWS, categories_with_items: withItems, scenes: {} });

/* ── the vision call ───────────────────────────────────────────────────────────────────────────────────────────────── */
const DETECT_SYSTEM = `You find the furniture in a photo of a room (a rendering of an apartment). Return ONLY a JSON object:
{"items":[{"label":"short name","category":"one of sofa, armchair, coffee_table, dining_table, chair, bed, lamp, rug, shelf, other","placement":"in_room or through_opening","box_2d":[ymin,xmin,ymax,xmax],"mask":[[x,y],[x,y],...]}]}
All coordinates are normalized to 0-1000 of the image. "box_2d" is the piece's bounding box. "mask" is the piece's outline: a polygon
of 10 to 40 points in order around its silhouette, following the actual shape (the backrest, the seat, the legs), not the box.
One entry per piece: each dining chair, each armchair and each table is its own entry; a corner or sectional sofa is ONE entry;
a bar stool is a "chair"; a side table, a bedside table, a desk, a TV unit or a kitchen island is "other". List only pieces that
are at least partly visible, including pieces cut by the edge of the photo. Omit kitchen cabinets, appliances, doors, curtains,
wall art and plants.
"placement" is "in_room" when the piece stands in the same space the camera stands in, and "through_opening" when it is seen
through a window, a glass door or wall, a doorway or a pass-through into ANOTHER room — a sofa behind a glass door, a dining table
seen from a balcony through the window. Decide by where the piece stands, not by its size.`;
async function detect(env, jpg) {
  const res = await chatFetch(env)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://habait.ai', 'X-Title': 'Habait Tour360 (scan)' },
    body: JSON.stringify({ model: TEXT_MODEL, temperature: 0, max_tokens: 9000, reasoning: { max_tokens: 200 }, response_format: { type: 'json_object' }, usage: { include: true }, messages: [{ role: 'system', content: DETECT_SYSTEM }, { role: 'user', content: [{ type: 'text', text: 'Find the furniture in this photo.' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + jpg.toString('base64') } }] }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`vision HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch { throw new Error('vision returned no JSON: ' + text.slice(0, 120)); }
  const items = (Array.isArray(parsed.items) ? parsed.items : []).map((it) => {
    const b = Array.isArray(it.box_2d) && it.box_2d.length === 4 && it.box_2d.every((n) => Number.isFinite(n)) ? it.box_2d.map((n) => clamp(Number(n), 0, 1000)) : null;
    const poly = Array.isArray(it.mask) ? it.mask.filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n))).map((p) => [clamp(Number(p[0]), 0, 1000), clamp(Number(p[1]), 0, 1000)]) : [];
    return b && b[2] > b[0] && b[3] > b[1] ? { label: String(it.label || '').slice(0, 40), category: CATEGORIES.includes(it.category) ? it.category : 'other', placement: it.placement === 'through_opening' ? 'through_opening' : 'in_room', box_2d: b, mask: poly.length >= 3 ? poly : null } : null;
  }).filter(Boolean);
  const cost = Number(json.usage?.cost);
  return { items, cost: Number.isFinite(cost) && cost > 0 ? cost : null, finish: json.choices?.[0]?.finish_reason || null };
}

/* ── a piece on the sphere ─────────────────────────────────────────────────────────────────────────────────────────── */
const toYP = (d) => [round(norm(G.yawOf(d)), 2), round(G.pitchOf(d), 2)];
function spans(dirs, centre) {
  const cy = G.yawOf(centre), cp = G.pitchOf(centre);
  let ymin = 0, ymax = 0, pmin = 0, pmax = 0;
  for (const d of dirs) { const dy = norm(G.yawOf(d) - cy), dp = G.pitchOf(d) - cp; ymin = Math.min(ymin, dy); ymax = Math.max(ymax, dy); pmin = Math.min(pmin, dp); pmax = Math.max(pmax, dp); }
  return [round(ymax - ymin, 1), round(pmax - pmin, 1)];
}
/** One detected item in one view → a piece record with its directions. */
function toPiece(it, view, sceneId, k, n) {
  const sphere = G.boxOnSphere(it.box_2d, view, W, H);
  const fit = G.fitPolygon(it.mask, it.box_2d);
  const polyPx = fit ? fit.poly.map(([x, y]) => [(x / 1000) * W, (y / 1000) * H]) : G.boxPolygon(it.box_2d, W, H);
  const step = Math.max(1, Math.ceil(polyPx.length / MAX_OUTLINE));
  const outline = polyPx.filter((_, i) => i % step === 0).map(([x, y]) => toYP(G.direction(x, y, view, W, H)));
  const [yaw, pitch] = toYP(sphere.centre);
  return { id: `${sceneId}-${k}-${n}`, category: it.category, label: it.label, placement: it.placement || 'in_room', yaw, pitch, span_deg: spans(sphere.corners, sphere.centre), area: round(sphere.area, 5), outline, outline_source: fit ? 'model' : 'box', fit: fit ? round(fit.fit, 2) : 0, box: { view: `${sceneId}-${k}`, box_2d: it.box_2d.map((v) => Math.round(v)) }, off_centre: round(G.angleBetween(sphere.centre, G.direction(W / 2, H / 2, view, W, H)), 1), marker: false, set: null };
}
const centreOf = (p) => G.dirOf(p.yaw, p.pitch);
/** T18a (the reviewer's sliver): the sides of its scan view a piece's box runs past — the piece continues beyond the outline there,
    and the page's crop must reach further on that side (the living sofa's chaise ran past the view's left edge). */
const cutSides = (p) => { const b = p.box && p.box.box_2d; if (!b) return []; const out = []; if (b[1] <= 8) out.push('left'); if (b[3] >= 992) out.push('right'); if (b[2] >= 992) out.push('bottom'); if (b[0] <= 8) out.push('top'); return out; };
/** T18c: where the ring sits — the outline's mean direction for the yaw, and 30 % down the outline's pitch range from its top for the
    pitch: the visible top of the piece (a sofa's back and seat, a table's top), never the box's centre, which an island or a chair in
    front can hide (the hall's dining table). The piece's own yaw/pitch (its centre) stay as they are. */
function ringAnchor(outline) {
  const dirs = outline.map(([y, p]) => G.dirOf(y, p));
  const mean = dirs.reduce((s, d) => [s[0] + d[0], s[1] + d[1], s[2] + d[2]], [0, 0, 0]);
  const mn = 1 / Math.hypot(...mean);
  const yaw = round(norm(G.yawOf(mean.map((v) => v * mn))), 2);
  const ps = outline.map(([, p]) => p);
  const pmax = Math.max(...ps), pmin = Math.min(...ps);
  return [yaw, round(pmax - 0.3 * (pmax - pmin), 2)];
}
/** Pieces of one category seen from neighbouring views are one piece when their centres lie within 10°, or within half the
    larger piece's span — a sofa or a coffee table close to the camera spans 60° and is cut differently by each view (the first
    scan kept the living's sectional twice and its coffee table three times). The one nearer its own view's centre is kept. */
function dedupe(pieces) {
  const out = [];
  const cutSide = (p) => p.box.box_2d[1] <= 8 || p.box.box_2d[3] >= 992;
  const radius = (a, b) => Math.max(DEDUPE_DEG, (cutSide(a) || cutSide(b) ? 0.75 : 0.5) * Math.max(...a.span_deg, ...b.span_deg));
  // the keeper: an outline the model drew over a box, then the one nearer its own view's centre (the least cut)
  const rank = (p) => (p.outline_source === 'box' ? 1000 : 0) + p.off_centre;
  for (const p of pieces.slice().sort((a, b) => rank(a) - rank(b))) {
    // only a piece from ANOTHER view can be the same piece; two in one view are two pieces
    const twin = out.findIndex((q) => q.category === p.category && q.box.view !== p.box.view && G.angleBetween(centreOf(q), centreOf(p)) < radius(q, p));
    if (twin < 0) out.push(p);
  }
  return out;
}
/** Chairs join the set of the dining table within reach; a chair at no table gets no marker (ODGER is a dining chair). */
function makeSets(sceneId, pieces) {
  const tables = pieces.filter((p) => p.category === 'dining_table');
  const sets = [];
  for (const p of pieces) p.set = null;
  tables.forEach((t, i) => {
    const reach = SET_REACH * Math.max(...t.span_deg, 5);
    const members = pieces.filter((p) => p.category === 'chair' && !p.set && G.angleBetween(centreOf(p), centreOf(t)) <= reach)
      .sort((a, b) => G.angleBetween(centreOf(a), centreOf(t)) - G.angleBetween(centreOf(b), centreOf(t)));
    if (members.length < 2) return;
    const sid = `${sceneId}-set-${i + 1}`;
    for (const m of members) m.set = sid;
    const anchor = members.slice().sort((a, b) => b.area - a.area)[0];
    const dirs = members.flatMap((m) => m.outline.map(([y, pch]) => G.dirOf(y, pch)));
    const mean = dirs.reduce((s, d) => [s[0] + d[0], s[1] + d[1], s[2] + d[2]], [0, 0, 0]);
    const mn = 1 / Math.hypot(...mean);
    const span = spans(dirs, mean.map((v) => v * mn));
    const ra = ringAnchor(anchor.outline);
    sets.push({ id: sid, category: 'chair', members: members.map((m) => m.id), count: members.length, table: t.id, yaw: ra[0], pitch: ra[1], span_deg: span, marker: withItems.includes('chair') && Math.max(...span) >= MIN_SPAN });
  });
  return sets;
}
/** The identity a marker belongs to (T18d): the group id of the identity that names it, else none. */
const pieceOf = (identities, id) => { const it = (identities || []).find((x) => Array.isArray(x.members) && x.members.includes(id)); return it ? it.piece : null; };
/** The flags and the page's own list, recomputed from the pieces and sets. */
function finish(scene, sceneId, identities = []) {
  scene.sets = makeSets(sceneId, scene.pieces);
  for (const p of scene.pieces) {
    const why = p.placement === 'through_opening' ? 'seen through an opening' : !withItems.includes(p.category) ? 'no catalog item' : p.category === 'chair' ? (p.set ? 'in a set' : 'a chair at no table') : Math.max(...p.span_deg) < MIN_SPAN ? `under ${MIN_SPAN}° across` : null;
    p.marker = why === null;
    p.marker_reason = why;
  }
  const byId = Object.fromEntries(scene.pieces.map((p) => [p.id, p]));
  scene.markers = [
    ...scene.pieces.filter((p) => p.marker).map((p) => { const ra = ringAnchor(p.outline); const cut = cutSides(p); const pc = pieceOf(identities, p.id); return { id: p.id, category: p.category, yaw: ra[0], pitch: ra[1], span_deg: p.span_deg, outlines: [p.outline], count: 1, ...(cut.length ? { cut_sides: cut } : {}), ...(pc ? { piece: pc } : {}) }; }),
    ...scene.sets.filter((s) => s.marker).map((s) => { const cut = [...new Set(s.members.flatMap((m) => cutSides(byId[m])))]; const pc = pieceOf(identities, s.id); return { id: s.id, category: 'chair', yaw: s.yaw, pitch: s.pitch, span_deg: s.span_deg, outlines: s.members.map((m) => byId[m].outline), count: s.count, members: s.members, ...(cut.length ? { cut_sides: cut } : {}), ...(pc ? { piece: pc } : {}) }; }),
  ];
}

/* ── the sheet ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
async function drawView(sharp, jpg, view, entries, file) {
  const shapes = entries.map((e) => {
    const pts = e.outline.map(([y, p]) => G.project(G.dirOf(y, p), view, W, H)).filter(Boolean);
    if (pts.length < 3) return '';
    const col = e.marker ? '#ff3b3b' : '#ffd23b';
    const top = pts.reduce((m, q) => (q.y < m.y ? q : m), pts[0]);
    return `<polygon points="${pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="${col}" fill-opacity="0.2" stroke="${col}" stroke-width="2.5"/><text x="${(top.x + 4).toFixed(1)}" y="${Math.max(22, top.y - 6).toFixed(1)}" font-family="sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="1">${esc(e.label)}</text>`;
  }).join('');
  await sharp(jpg).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${shapes}</svg>`), top: 0, left: 0 }]).jpeg({ quality: 86 }).toFile(file);
}
function sheet(doc) {
  fs.mkdirSync(SHEET, { recursive: true });
  let totalMarkers = 0, totalPieces = 0;
  const rows = [], sections = [];
  for (const s of scenesDoc.scenes) {
    const sc = doc.scenes[s.id];
    if (!sc) { rows.push(`<tr><td>${esc(s.id)}</td><td colspan="4">not scanned</td></tr>`); continue; }
    totalMarkers += sc.markers.length; totalPieces += sc.pieces.length;
    const counts = {}; for (const p of sc.pieces) counts[p.category] = (counts[p.category] || 0) + 1;
    rows.push(`<tr><td><a href="#${esc(s.id)}">${esc(s.id)}</a></td><td>${sc.pieces.length} — ${Object.entries(counts).map(([k, n]) => `${esc(k)} ${n}`).join(', ') || '—'}</td><td>${sc.markers.map((m) => `${esc(m.category)}${m.count > 1 ? ' ×' + m.count : ''}`).join(', ') || '—'}</td><td>${(sc.dropped || []).length}</td><td>$${round(sc.usd || 0, 4)}</td></tr>`);
    sections.push(`<section id="${esc(s.id)}"><h2>${esc(s.id)} <small>${esc(sc.scanned_on || '')} · ${sc.pieces.length} pieces · ${sc.markers.length} markers${sc.sets.length ? ' · sets ' + sc.sets.map((x) => x.count).join(', ') : ''}</small></h2><div class="row">${VIEWS.yaws.map((k) => `<figure><a href="${s.id}-${k}-outlines.jpg"><img src="${s.id}-${k}-outlines.jpg" alt=""></a><figcaption>${k}° · <a href="${s.id}-${k}.jpg">plain</a></figcaption></figure>`).join('')}</div>${(sc.dropped || []).length ? `<p class="drop">dropped: ${sc.dropped.map((d) => `${esc(d.id)} (${esc(d.why)})`).join(' · ')}</p>` : ''}</section>`);
  }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Tour360 — the scan of ${esc(id)} (T16a)</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#0A1330;color:#fff}h1{font-size:20px}h2{font-size:16px;margin:28px 0 8px}small{font-weight:400;color:#bcd}.row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}figure{margin:0}img{width:100%;height:auto;border-radius:6px;background:#000}figcaption{color:#bcd;font-size:12px;margin-top:4px}table{border-collapse:collapse;margin:8px 0 20px}td,th{border:1px solid #345;padding:4px 10px;text-align:start;vertical-align:top}a{color:#9cf}.drop{color:#fc9}</style>
<h1>Tour360 — the scan of ${esc(id)} (T16a, ${esc(doc.scanned_on || '')}): ${totalPieces} pieces, ${totalMarkers} markers. Red = a marker (a catalog category); yellow = found, no marker.</h1>
<table><tr><th>scene</th><th>pieces</th><th>markers</th><th>dropped</th><th>usd</th></tr>${rows.join('')}</table>
${(doc.identities || []).length ? `<p class="drop">one piece, several scenes (T18d): ${doc.identities.map((x) => `${esc(x.piece)} = ${x.members.map(esc).join(' + ')} (${esc(x.why)})`).join(' · ')}</p>` : ''}
${sections.join('\n')}</html>`;
  fs.writeFileSync(path.join(SHEET, 'index.html'), html);
  return { totalPieces, totalMarkers };
}

/* ── the scan ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
async function scan() {
  const dry = has('--dry');
  const only = arg('--scenes', '') ? arg('--scenes', '').split(',') : null;
  const env = loadEnv(ENV_ROOT);
  if (!dry && !hasChat(env)) { console.error('scan-pieces: neither OPENROUTER_API_KEY nor FAL_KEY is in the root .env'); process.exit(1); }
  const sharp = G.loadSharp(HARNESS);
  const ledger = fileLedger(LEDGER);
  const doc = loadDoc();
  fs.mkdirSync(SHEET, { recursive: true });
  let spent = 0, scanned = 0;
  for (const s of scenesDoc.scenes) {
    if (only && !only.includes(s.id)) continue;
    const file = path.join(PANOS, s.asset + '.webp');
    if (!fs.existsSync(file)) { console.error(`${s.id}: no pano ${file}`); process.exit(1); }
    const hash = sha256(fs.readFileSync(file));
    if (!dry && !has('--force') && doc.scenes[s.id] && doc.scenes[s.id].pano_sha256 === hash) { console.log(`${s.id}: unchanged (${hash.slice(0, 12)}), kept — $0`); continue; }
    const t0 = Date.now();
    const pano = await G.loadPano(sharp, file);
    const views = VIEWS.yaws.map((k) => ({ k, yaw: round(norm((s.heading || 0) + k), 2), pitch: VIEWS.pitch, hfov: VIEWS.hfov }));
    const jpgs = await Promise.all(views.map(async (v) => { const jpg = await sharp(G.render(pano, v.yaw, v.pitch, v.hfov, W, H), { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toBuffer(); fs.writeFileSync(path.join(SHEET, `${s.id}-${v.k}.jpg`), jpg); return jpg; }));
    if (dry) { console.log(`${s.id}: 4 views rendered ($0) in ${((Date.now() - t0) / 1000).toFixed(1)}s`); continue; }
    if (ledger.total() + 4 * TEXT_USD > ledger.cap) { console.error(`scan-pieces: the ledger's cap of $${ledger.cap} would be passed (at $${round(ledger.total())})`); process.exit(1); }
    if (spent + 4 * TEXT_USD > BUDGET) { console.error(`scan-pieces: this run's budget of $${BUDGET} would be passed (settled $${round(spent)})`); process.exit(1); }
    const found = await Promise.all(views.map(async (v, i) => {
      const row = ledger.reserve({ ts: new Date().toISOString(), op: 'scan', apartment: id, scene: s.id, view: `${s.id}-${v.k}`, reserved_usd: TEXT_USD, settled_usd: null, status: 'reserved' });
      try {
        const det = await detect(env, jpgs[i]);
        const usd = det.cost ?? TEXT_USD;
        ledger.settle(row, usd, { status: 'settled', items: det.items.length, finish: det.finish, seconds: round((Date.now() - t0) / 1000, 1) });
        return { v, usd, pieces: det.items.map((it, n) => toPiece(it, v, s.id, v.k, n + 1)) };
      } catch (e) { ledger.settle(row, 0, { status: 'failed', error: String(e && e.message || e).slice(0, 200) }); throw e; }
    }));
    const usd = found.reduce((t, f) => t + f.usd, 0);
    spent += usd; scanned += 1;
    const raw = found.flatMap((f) => f.pieces);
    const prev = doc.scenes[s.id] || {};
    const scene = { pano_sha256: hash, asset: s.asset, heading: s.heading || 0, scanned_on: new Date().toISOString(), usd: round(usd, 4), raw_count: raw.length, raw_pieces: raw, pieces: [], sets: [], markers: [], dropped: [] };
    for (const d of prev.dropped || []) { const i = scene.raw_pieces.findIndex((p) => p.id === d.id); if (i >= 0) { scene.raw_pieces.splice(i, 1); scene.dropped.push(d); } }
    scene.pieces = dedupe(scene.raw_pieces);
    finish(scene, s.id, doc.identities || []);
    doc.scenes[s.id] = scene;
    doc.scanned_on = new Date().toISOString();
    writeJson(FILE, doc);
    for (const f of found) await drawView(sharp, jpgs[VIEWS.yaws.indexOf(f.v.k)], f.v, scene.pieces.filter((p) => p.box.view === `${s.id}-${f.v.k}`).map((p) => ({ outline: p.outline, label: `${p.category}${p.set ? ' (set)' : ''}${p.placement === 'through_opening' ? ' (through)' : ''}`, marker: p.marker || Boolean(p.set) })), path.join(SHEET, `${s.id}-${f.v.k}-outlines.jpg`));
    const counts = {}; for (const p of scene.pieces) counts[p.category] = (counts[p.category] || 0) + 1;
    console.log(`${s.id}: ${scene.pieces.length} pieces (${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}) · ${scene.markers.length} markers${scene.sets.length ? ' · set of ' + scene.sets.map((x) => x.count).join(', ') : ''} · $${round(usd, 4)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  if (dry) return;
  const t = sheet(doc);
  console.log(`scan-pieces ${id}: ${scanned} scene(s) scanned, ${Object.keys(doc.scenes).length} in the file · ${t.totalPieces} pieces · ${t.totalMarkers} markers · this run $${round(spent, 4)} · ledger $${round(ledger.total())} of $${ledger.cap} · sheet ${path.relative(HARNESS, path.join(SHEET, 'index.html'))}`);
}
/** Recompute every scene from its stored pieces (the dedupe, the sets, the flags, the page's list) and redraw the sheet — $0. */
async function refinish() {
  const doc = loadDoc();
  for (const [sid, scene] of Object.entries(doc.scenes)) {
    const before = scene.pieces.length;
    // from the raw pieces when the scan stored them (every scan since 2026-10-07 late evening); a lossy pass over the kept ones before that
    scene.pieces = dedupe(scene.raw_pieces || scene.pieces);
    finish(scene, sid, doc.identities || []);
    console.log(`${sid}: ${before} → ${scene.pieces.length} pieces · ${scene.markers.length} markers${scene.sets.length ? ' · set of ' + scene.sets.map((x) => x.count).join(', ') : ''}`);
  }
  writeJson(FILE, doc);
  await redraw(doc);
  const t = sheet(doc);
  console.log(`refinish: ${t.totalPieces} pieces · ${t.totalMarkers} markers · $0`);
}
/** The outline views redrawn from the stored plain views, when they are there. */
async function redraw(doc) {
  const sharp = G.loadSharp(HARNESS);
  for (const [sid, scene] of Object.entries(doc.scenes)) {
    for (const k of VIEWS.yaws) {
      const plain = path.join(SHEET, `${sid}-${k}.jpg`);
      if (!fs.existsSync(plain)) continue;
      const view = { yaw: round(norm((scene.heading || 0) + k), 2), pitch: VIEWS.pitch, hfov: VIEWS.hfov };
      await drawView(sharp, fs.readFileSync(plain), view, scene.pieces.filter((p) => p.box.view === `${sid}-${k}`).map((p) => ({ outline: p.outline, label: `${p.category}${p.set ? ' (set)' : ''}${p.placement === 'through_opening' ? ' (through)' : ''}`, marker: p.marker || Boolean(p.set) })), path.join(SHEET, `${sid}-${k}-outlines.jpg`));
    }
  }
}
function drop() {
  const pid = arg('--drop', ''), why = arg('--why', '');
  if (!pid || !why) { console.error('scan-pieces: --drop <pieceId> --why "<reason>"'); process.exit(2); }
  const doc = loadDoc();
  const sceneId = Object.keys(doc.scenes).find((k) => doc.scenes[k].pieces.some((p) => p.id === pid));
  if (!sceneId) { console.error('scan-pieces: no piece ' + pid); process.exit(1); }
  const scene = doc.scenes[sceneId];
  const [p] = scene.pieces.splice(scene.pieces.findIndex((q) => q.id === pid), 1);
  if (scene.raw_pieces) { const i = scene.raw_pieces.findIndex((q) => q.id === pid); if (i >= 0) scene.raw_pieces.splice(i, 1); }
  scene.dropped.push({ id: pid, category: p.category, label: p.label, why, when: new Date().toISOString() });
  finish(scene, sceneId, doc.identities || []);
  writeJson(FILE, doc);
  sheet(doc);
  console.log(`dropped ${pid} (${p.category}) from ${sceneId}: ${scene.markers.length} markers now; run --sheet to redraw the outline views`);
}

/** T18c: the prompt on one stored view, the answer printed, nothing written — one ledger row. */
async function probe() {
  const key = arg('--probe', '');
  const m = /^(.+)-(0|90|180|270)$/.exec(key);
  if (!m) { console.error('scan-pieces: --probe <scene>-<0|90|180|270>'); process.exit(2); }
  const s = scenesDoc.scenes.find((x) => x.id === m[1]);
  if (!s) { console.error('scan-pieces: no scene ' + m[1]); process.exit(1); }
  const env = loadEnv(ENV_ROOT);
  if (!hasChat(env)) { console.error('scan-pieces: neither OPENROUTER_API_KEY nor FAL_KEY is in the root .env'); process.exit(1); }
  const sharp = G.loadSharp(HARNESS);
  const ledger = fileLedger(LEDGER);
  const k = Number(m[2]);
  const view = { k, yaw: round(norm((s.heading || 0) + k), 2), pitch: VIEWS.pitch, hfov: VIEWS.hfov };
  const pano = await G.loadPano(sharp, path.join(PANOS, s.asset + '.webp'));
  const jpg = await sharp(G.render(pano, view.yaw, view.pitch, view.hfov, W, H), { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
  if (ledger.total() + TEXT_USD > ledger.cap) { console.error(`scan-pieces: the ledger's cap of $${ledger.cap} would be passed`); process.exit(1); }
  const row = ledger.reserve({ ts: new Date().toISOString(), op: 'scan-probe', apartment: id, scene: s.id, view: key, reserved_usd: TEXT_USD, settled_usd: null, status: 'reserved' });
  const t0 = Date.now();
  try {
    const det = await detect(env, jpg);
    ledger.settle(row, det.cost ?? TEXT_USD, { status: 'settled', items: det.items.length, finish: det.finish, seconds: round((Date.now() - t0) / 1000, 1) });
    for (const it of det.items) console.log(`${key}: ${it.label.padEnd(24)} ${it.category.padEnd(13)} ${it.placement.padEnd(16)} box ${JSON.stringify(it.box_2d)}`);
    console.log(`probe ${key}: ${det.items.length} pieces, ${det.items.filter((it) => it.placement === 'through_opening').length} through an opening · $${round(det.cost ?? TEXT_USD, 4)} in ${((Date.now() - t0) / 1000).toFixed(1)}s · nothing written`);
  } catch (e) { ledger.settle(row, 0, { status: 'failed', error: String(e && e.message || e).slice(0, 200) }); throw e; }
}

/** T18d: two markers are one piece seen from two scenes — recorded with its reason, applied as `piece` on both. */
function same() {
  const spec = arg('--same', ''), why = arg('--why', '');
  const m = /^([a-z0-9-]+)=([a-z0-9-]+)$/.exec(spec);
  if (!m || !why) { console.error('scan-pieces: --same <idA>=<idB> --why "<reason>"'); process.exit(2); }
  const doc = loadDoc();
  const find = (id) => { for (const [sid, sc] of Object.entries(doc.scenes)) { const mk = (sc.markers || []).find((x) => x.id === id); if (mk) return { sid, mk }; } return null; };
  const a = find(m[1]), b = find(m[2]);
  if (!a || !b) { console.error(`scan-pieces: no marker ${!a ? m[1] : m[2]} (a dropped or unmarked piece cannot be one of two)`); process.exit(1); }
  if (a.sid === b.sid) { console.error('scan-pieces: the two markers are in one scene — two pieces, not one'); process.exit(1); }
  if (a.mk.category !== b.mk.category) { console.error(`scan-pieces: ${m[1]} is ${a.mk.category}, ${m[2]} is ${b.mk.category}`); process.exit(1); }
  doc.identities = doc.identities || [];
  let it = doc.identities.find((x) => x.members.includes(m[1]) || x.members.includes(m[2]));
  if (!it) { it = { piece: `piece-${doc.identities.length + 1}`, category: a.mk.category, members: [], why, when: new Date().toISOString() }; doc.identities.push(it); }
  for (const id of [m[1], m[2]]) if (!it.members.includes(id)) it.members.push(id);
  for (const sid of new Set([a.sid, b.sid])) finish(doc.scenes[sid], sid, doc.identities);
  writeJson(FILE, doc);
  sheet(doc);
  console.log(`${it.piece}: ${it.members.join(' + ')} (${it.category}) — one piece in ${it.members.length} scenes; the markers carry piece "${it.piece}"`);
}

if (has('--drop')) drop();
else if (has('--same')) same();
else if (has('--probe')) await probe();
else if (has('--refinish')) await refinish();
else if (has('--sheet')) { const doc = loadDoc(); await redraw(doc); const t = sheet(doc); console.log(`sheet: ${t.totalPieces} pieces · ${t.totalMarkers} markers`); }
else await scan();
