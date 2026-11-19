/* T18d stub host (scratch, $0): serves dist/demo-01 and answers api/edit WITHOUT any vendor — an edit returns the crop with a dark
   block drawn over the tapped piece's box (so the page has a change to paste), the replace judge holds with the piece's box, the
   likeness says 3, the piece is "seen" at the box. Proves the page's cross-scene follow-up (the quiet push, the linked record, the
   linked undo, the frames), never the editor's output. Usage: node t18d-stub-host.mjs <port>   (the matrix driver's --base) */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const REPO = 'D:/AgentTeams/RealEstateTeam';
const DIST = path.join(REPO, 'Habait/tour360/dist/demo-01');
const sharp = createRequire(path.join(REPO, 'qa-evidence/_tools/package.json'))('sharp');
const PORT = Number(process.argv[2] || 8770);
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.css': 'text/css' };
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
let turns = 0;
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/edit') {
    if (req.method === 'GET') return json(res, 200, { configured: true, catalog: { items: 5 }, record: false, stub: true });
    let body = '';
    for await (const c of req) body += c;
    let b; try { b = JSON.parse(body || '{}'); } catch { return json(res, 400, { ok: false, reason: 'bad_request' }); }
    if (b.op === 'replace_judge') return json(res, 200, { ok: true, item: b.item, held: true, original_present: false, product_present: true, product_box: b.box, product_box_raw: b.box, box_kept: 1, placed: true, count: b.count || 1, rest_unchanged: 3, note: 'stub', usd: 0 });
    if (b.op === 'likeness') return json(res, 200, { ok: true, found: true, score: 3, why: 'stub', usd: 0 });
    if (b.op === 'judge') return json(res, 200, { ok: true, held: true, iou: 0.9, ratio: 1, object: 'stub', usd: 0 });
    if (b.op === 'record') return json(res, 404, { ok: false, reason: 'not_recording' });
    if (!b.item || !b.piece) return json(res, 400, { ok: false, reason: 'catalog', message: 'the stub takes catalog turns by marker only' });
    turns++;
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(b.crop || ''));
    if (!m) return json(res, 400, { ok: false, reason: 'bad_request' });
    const src = Buffer.from(m[2], 'base64');
    const meta = await sharp(src).metadata();
    const W = meta.width, H = meta.height, box = b.piece.box;
    const left = Math.round((box[1] / 1000) * W), top = Math.round((box[0] / 1000) * H), width = Math.max(4, Math.round(((box[3] - box[1]) / 1000) * W)), height = Math.max(4, Math.round(((box[2] - box[0]) / 1000) * H));
    const block = await sharp({ create: { width, height, channels: 3, background: { r: 70, g: 72, b: 78 } } }).jpeg().toBuffer();
    const out = await sharp(src).composite([{ input: block, left, top }]).jpeg({ quality: 90 }).toBuffer();
    console.log(new Date().toISOString(), `stub edit #${turns} ${b.scene} ${b.item} box ${JSON.stringify(box)} attempt ${b.attempt || 1}`);
    return json(res, 200, { ok: true, image: 'data:image/jpeg;base64,' + out.toString('base64'), prompt: 'stub: a dark block over the piece', target: 'stub', change: 'stub', reach: 'object', living: false, attempt: b.attempt || 1, model: 'stub', modelKey: 'nb2', usd: 0, ms: 50, slow: false, catalog: true, item: b.item, piece: b.piece, piece_seen: { found: true, box: box, outline: null, touches_edge: [], note: 'stub', tries: 1 } });
  }
  let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`stub host on http://127.0.0.1:${PORT}/ (no vendor, no ledger)`));
