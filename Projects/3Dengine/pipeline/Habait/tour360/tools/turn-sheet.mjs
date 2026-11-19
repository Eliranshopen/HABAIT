#!/usr/bin/env node
/* Habait Tour360 — tools/turn-sheet.mjs (T17a, TEST-PLAN.md §6) — the eye's sheet: a turns folder (the laptop host's
   apartments/<id>/_local/turns/, T17a's recording layer) or a matrix folder (tools/replace-matrix.mjs) → one index.html with the
   pictures of every turn in a row and the numbers beside them. Zero dependencies. The product photo is LINKED from catalog/_local/
   (a relative path from the sheet), never copied (D-T360-27, D-CAT-21).
   Usage (from the harness root):
     timeout 60 node Habait/tour360/tools/turn-sheet.mjs --turns Habait/tour360/apartments/demo-01/_local/turns [--out <html>]
     timeout 60 node Habait/tour360/tools/turn-sheet.mjs --matrix qa-evidence/tour360/T17/matrix/he [--out <html>] [--title "…"]
   The default output is <dir>/index.html. A folder is one row: every *.json in it is read, every image in it is a thumbnail. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const TURNS = arg('--turns', null), MATRIX = arg('--matrix', null);
const DIR = path.resolve(TURNS || MATRIX || path.join(ROOT, 'apartments', 'demo-01', '_local', 'turns'));
const OUT = path.resolve(arg('--out', path.join(DIR, 'index.html')));
const TITLE = arg('--title', MATRIX ? 'Tour360 — the replace matrix' : 'Tour360 — the recorded turns');
if (!fs.existsSync(DIR)) { console.error('turn-sheet: no such folder ' + DIR); process.exit(2); }

const items = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'items.json'), 'utf8')).items; } catch { return []; } })();
const itemOf = (id) => items.find((i) => i.id === id) || null;
const rel = (file) => path.relative(path.dirname(OUT), file).replace(/\\/g, '/');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const IMG = /\.(jpg|jpeg|png|webp)$/i;

/** The numbers worth a glance, pulled from whichever JSON files the folder holds. */
function summary(jsons) {
  const out = [];
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') out.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]); };
  for (const [name, j] of Object.entries(jsons)) {
    if (!j || typeof j !== 'object') continue;
    if (name === 'request.json') { add('op', j.op); add('seq', j.seq); add('item', j.item); add('attempt', j.attempt); add('instruction', j.instruction); if (j.piece) add('piece', `${j.piece.id || ''} ${j.piece.category} ×${j.piece.count} box ${JSON.stringify(j.piece.box)}`); }
    if (name === 'answer.json') { add('ok', j.ok); add('reason', j.reason); add('model', j.modelKey || j.model); add('reach', j.reach); if (j.held !== undefined) add('held', j.held); if (j.product_box) add('product_box', `${JSON.stringify(j.product_box)} kept ${j.box_kept} rest ${j.rest_unchanged}/3`); add('note', j.note); if (j.score !== undefined) add('likeness', `${j.score}/3 ${j.why || ''}`); add('usd', j.usd); if (j.settled) add('settled', `$${j.settled.usd} ${j.settled.status || ''} ${j.settled.seconds ? j.settled.seconds + 's' : ''}`); add('prompt', j.prompt); }
    if (name === 'turn.json' || name === 'account.json') {
      add('ok', j.ok); add('scene', j.scene); add('item', j.item); add('marker', typeof j.marker === 'string' ? j.marker : j.marker && j.marker.id); add('seqs', Array.isArray(j.seqs) ? j.seqs.join(',') : undefined); add('view', j.view);
      if (j.turn && Array.isArray(j.turn.attempts)) add('attempts', j.turn.attempts.map((a) => `#${a.attempt} ${a.model || ''} ring ${a.ring} changed ${a.fraction} ${a.judge ? 'judge ' + (a.judge.held ? 'held' : 'NOT held') + (a.judge.box_kept !== undefined ? ' kept ' + a.judge.box_kept : '') : ''} → ${a.held ? 'held' : 'refused'}`).join(' · '));
      if (j.turn && j.turn.likeness) add('likeness', `${j.turn.likeness.score}/3 ${j.turn.likeness.why || ''}`);
      if (j.turn && j.turn.region_fraction !== undefined) add('region/pasted', `${j.turn.region_fraction} / ${j.turn.pasted_fraction}`);
      if (j.message) add('message', `${j.message.key}: ${j.message.text}${j.message.error ? ' (' + j.message.error + ')' : ''}`);
      if (j.pill) add('pill', j.pill); if (j.landed !== undefined) add('landed', j.landed); add('ms_total', j.ms_total ?? j.ms); add('usd', j.usd); add('maxTexture', j.maxTexture); add('viewport', j.viewport);
      if (j.eye) add('eye', j.eye);
    }
  }
  return out;
}

const folders = fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const rows = [];
for (const f of folders) {
  const dir = path.join(DIR, f);
  const files = fs.readdirSync(dir).sort();
  const jsons = {};
  for (const n of files) if (n.endsWith('.json')) { try { jsons[n] = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); } catch { jsons[n] = null; } }
  const imgs = files.filter((n) => IMG.test(n));
  if (!imgs.length && !Object.keys(jsons).length) continue;
  const itemId = Object.values(jsons).map((j) => j && (typeof j.item === 'string' ? j.item : (j.turn && j.turn.item) || null)).find(Boolean) || (f.match(/-(kivik-3|strandmon|kragsta|skansnaes|odger)\b/) || [])[1] || null;
  const it = itemId ? itemOf(itemId) : null;
  const photo = it ? path.join(ROOT, 'catalog', '_local', it.image) : null;
  rows.push({ f, dir, imgs, jsons, it, photo: photo && fs.existsSync(photo) ? photo : null, summary: summary(jsons) });
}

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(TITLE)}</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:16px;color:#1b1f2a;background:#f6f6f4}
h1{font-size:20px;margin:0 0 4px}p.note{margin:0 0 16px;color:#555}
.row{background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px 12px;margin:0 0 12px}
.row h2{font-size:15px;margin:0 0 6px;font-family:ui-monospace,monospace}
.pics{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
figure{margin:0;text-align:center}figure img{max-width:300px;max-height:220px;display:block;border:1px solid #ccc;background:#eee}
figcaption{font-size:11px;color:#444;margin-top:2px;font-family:ui-monospace,monospace}
figure.product img{max-width:140px}
table{border-collapse:collapse;margin-top:8px;font-size:12px}td{padding:1px 8px 1px 0;vertical-align:top}td:first-child{color:#666;white-space:nowrap}
td.long{max-width:900px;word-break:break-word}
</style>
<h1>${esc(TITLE)}</h1>
<p class="note">${rows.length} rows from <code>${esc(rel(DIR) || '.')}</code>, written ${new Date().toISOString()}. Product photos are linked from <code>catalog/_local/</code> (reference-only, never copied). Click a picture for its full size.</p>
${rows.map((r) => `<section class="row"><h2>${esc(r.f)}${r.it ? ' · ' + esc(r.it.name) : ''}</h2>
<div class="pics">${r.photo ? `<figure class="product"><a href="${esc(rel(r.photo))}"><img loading="lazy" src="${esc(rel(r.photo))}" alt=""></a><figcaption>product photo (linked)</figcaption></figure>` : ''}${r.imgs.map((n) => `<figure><a href="${esc(rel(path.join(r.dir, n)))}"><img loading="lazy" src="${esc(rel(path.join(r.dir, n)))}" alt=""></a><figcaption>${esc(n)}</figcaption></figure>`).join('')}</div>
${r.summary.length ? `<table>${r.summary.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="long">${esc(v)}</td></tr>`).join('')}</table>` : ''}
</section>`).join('\n')}
</html>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`turn-sheet: ${rows.length} rows → ${path.relative(process.cwd(), OUT)}`);
