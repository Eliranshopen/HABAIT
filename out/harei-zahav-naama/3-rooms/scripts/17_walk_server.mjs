/* Step 17 - the walkaround's local server: the static files of the job folder + POST /api/design (the free-text design line).
   Eliran 2026-11-17: RAINBOW's features in the Hatzav walk, among them «שורת טקסט חופשי לעיצוב».
   The text step is RAINBOW's (tour360/server/handler.mjs prepare: google/gemini-3.7-flash through fal's openrouter/router/vision,
   ≈ $0.003 a call) with RAINBOW's scope rule (object / surface yes, structure no). In a 3D walk the answer is not a pixel edit but
   a list of scene operations the browser applies: swap, colour, finish, light, remove, show — exact and free.
   Ledger items/design-ledger.json, reserved before the call; daily cap $1 (local). FAL_KEY by NAME via loadEnv, never sent to the browser.
   Usage: node scripts/17_walk_server.mjs [--port 8894]   then open http://127.0.0.1:8894/walkaround/                    */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../../../../../Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PORT = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : 8894);
const MODEL = 'google/gemini-3.7-flash';
const USD = 0.003;
const DAILY = 1.0;
const LEDGER = path.join(ROOT, 'items', 'design-ledger.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.css': 'text/css', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2' };

export const SYSTEM = `You turn ONE visitor request into operations on an interactive 3D model of an apartment (a concept visualisation).
The visitor typed in Hebrew, English or French. You get the list of the movable ITEMS in the model (id, category, room, name),
the CATALOG of alternative pieces per category (id, name, colour, material), the FLOOR FINISHES and the visitor's current ROOM.

OPERATIONS you may return (JSON objects):
 {"op":"swap","item":<item id>,"to":<catalog id>}      replace a piece by a catalog piece of the same category
 {"op":"color","target":<item id>,"hex":"#rrggbb"}       recolour a piece (keeps its texture); walls and ceiling cannot be recoloured here → "unsupported"
 {"op":"finish","to":<floor finish id>}                  change the floor of the whole apartment
 {"op":"light","warmth":2700..6500,"level":0.5..1.5}    the light of the whole apartment (kelvin, relative brightness)
 {"op":"remove","item":<item id>}  /  {"op":"show","item":<item id>}   take a piece away / bring it back
Pick the item the visitor means: prefer the current ROOM; "the sofa" = the sofa item; a colour word → its hex.
REFUSE with a reason, no operations:
 "structure"  walls, windows, doors, openings, ceiling height, the room's size or layout (this model follows the sales plan)
 "unsupported" something these operations cannot do (adding people or pets, a piece with no catalog alternative, moving a piece)
 "unsafe"     sexual, violent, hateful or illegal content;  "real_person" a named real person
Answer with the JSON object only:
{"allowed":bool,"reason":"ok"|"structure"|"unsupported"|"unsafe"|"real_person"|"unclear","ops":[...],"say_he":<one short Hebrew sentence
telling the visitor what changed or why not>,"say_en":<the same in English>}`;

function ledger() {
  return fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8'))
    : { $schema: 'tour360/ledger.v1', daily_cap_usd: DAILY, note: 'free-text design line, local server; reserve before send', rows: [] };
}
const today = () => new Date().toISOString().slice(0, 10);

export function validate(ans, ctx) {
  const items = new Set(ctx.items.map((i) => i.id));
  const cat = new Map(ctx.items.map((i) => [i.id, i.category]));
  const catalog = new Map(Object.entries(ctx.catalog || {}).flatMap(([c, xs]) => xs.map((x) => [x.id, c])));
  const fins = new Set((ctx.finishes || []).map((f) => f.id));
  const hex = (h) => /^#[0-9a-f]{6}$/i.test(String(h || ''));
  const ops = [];
  for (const o of Array.isArray(ans.ops) ? ans.ops : []) {
    if (o.op === 'swap' && items.has(o.item) && catalog.get(o.to) === cat.get(o.item)) ops.push({ op: 'swap', item: o.item, to: o.to });
    else if (o.op === 'color' && items.has(o.target) && hex(o.hex)) ops.push({ op: 'color', target: o.target, hex: o.hex.toLowerCase() });
    else if (o.op === 'finish' && fins.has(o.to)) ops.push({ op: 'finish', to: o.to });
    else if (o.op === 'light') ops.push({ op: 'light', warmth: Math.min(6500, Math.max(2700, Number(o.warmth) || 4000)), level: Math.min(1.5, Math.max(0.5, Number(o.level) || 1)) });
    else if ((o.op === 'remove' || o.op === 'show') && items.has(o.item)) ops.push({ op: o.op, item: o.item });
  }
  const allowed = ans.allowed === true && ans.reason === 'ok' && ops.length > 0;
  return { allowed, reason: allowed ? 'ok' : (ans.reason && ans.reason !== 'ok' ? ans.reason : 'unclear'), ops: allowed ? ops : [],
    say_he: String(ans.say_he || '').slice(0, 200), say_en: String(ans.say_en || '').slice(0, 200) };
}

async function design(body) {
  const text = String(body.text || '').trim().slice(0, 300);
  if (!text) return { status: 400, json: { error: 'empty' } };
  const ctx = { items: body.items || [], catalog: body.catalog || {}, finishes: body.finishes || [], room: String(body.room || '') };
  const L = ledger();
  const spentToday = L.rows.filter((r) => r.at.startsWith(today())).reduce((t, r) => t + (r.settled_usd ?? r.reserved_usd), 0);
  if (spentToday + USD > DAILY) return { status: 429, json: { error: 'daily cap', say_he: 'הגעת למכסת השינויים היומית' } };
  const env = loadEnv('C:/RnD');
  if (!env.FAL_KEY) return { status: 503, json: { error: 'no key', say_he: 'שורת העיצוב לא מחוברת כרגע' } };
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), op: 'design-text', model: MODEL, reserved_usd: USD, status: 'reserved', chars: text.length };
  L.rows.push(row);
  fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));
  const t0 = Date.now();
  try {
    const prompt = `ROOM: ${ctx.room}\nITEMS: ${JSON.stringify(ctx.items)}\nCATALOG: ${JSON.stringify(ctx.catalog)}\nFLOOR FINISHES: ${JSON.stringify(ctx.finishes)}\nRequest: ${text}`;
    const r = await fetch('https://fal.run/openrouter/router/vision', { method: 'POST',
      headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, system_prompt: SYSTEM + '\n\nAnswer with the JSON object only.', prompt, temperature: 0, max_tokens: 1500, reasoning: true }),
      signal: AbortSignal.timeout(40_000) });
    const raw = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${raw.slice(0, 200)}`);
    const out = String(JSON.parse(raw).output || '');
    const ans = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    const v = validate(ans, ctx);
    Object.assign(row, { status: 'settled', settled_usd: USD, seconds: (Date.now() - t0) / 1000, allowed: v.allowed, reason: v.reason, ops: v.ops.length });
    fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));
    return { status: 200, json: v };
  } catch (e) {
    Object.assign(row, { status: 'failed', error: String(e.message).slice(0, 200), seconds: (Date.now() - t0) / 1000 });
    fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));
    return { status: 502, json: { error: 'text step failed', say_he: 'השינוי לא נטען, נסו שוב' } };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/api/design') {
    let b = '';
    for await (const c of req) { b += c; if (b.length > 200_000) break; }
    let body = {};
    try { body = JSON.parse(b); } catch { /* empty */ }
    const { status, json } = await design(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(json));
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT) || /[\\/]\.env/i.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(PORT, '127.0.0.1', () => console.log(`walk server on http://127.0.0.1:${PORT}/walkaround/`));
}
