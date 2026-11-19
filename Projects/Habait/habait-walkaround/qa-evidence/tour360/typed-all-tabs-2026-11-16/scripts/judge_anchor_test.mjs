// Tries one judge wording ("the piece the change is at") on the six real follow answers whose border held, N runs each. PAID: one small
// vision call a run through the tour's own chat transport (booked $0.004 each). The key is read by NAME; nothing is printed of it.
//   node judge_anchor_test.mjs <tour360 dir> <evidence dir> <runs>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , ROOT, EV, RUNS] = process.argv;
const { chatFetch } = await import(pathToFileURL(path.join(ROOT, 'server', 'chat-transport.mjs')).href);
const { TEXT_MODEL } = await import(pathToFileURL(path.join(ROOT, 'server', 'handler.mjs')).href);
function falKey() {
  if (process.env.FAL_KEY && process.env.FAL_KEY.trim()) return process.env.FAL_KEY.trim();
  for (let d = path.resolve(ROOT); ; d = path.dirname(d)) {
    const f = path.join(d, '.env');
    if (fs.existsSync(f)) { const m = /^FAL_KEY=(.+)$/m.exec(fs.readFileSync(f, 'utf8')); if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, ''); }
    if (path.dirname(d) === d) return '';
  }
}
const env = { FAL_KEY: falKey() };
if (!env.FAL_KEY) { console.error('no FAL_KEY'); process.exit(3); }

const SYSTEM = `You compare two photos of the same room taken by the same camera. Image 1 is the original. Image 2 is an edited version in which
something was added or changed: usually people, sometimes an object. In image 2, find the piece of furniture the added or changed
thing is AT: the table the people sit at, the sofa they sit on, the surface the object stands on. Call it the anchor. Then find the
same anchor in image 1. Box the WHOLE anchor in each image (for a table: the table top and its legs or base; never the people, the
chairs or the dishes). Keep the answer short.
Return ONLY a JSON object: {"anchor": "short name", "box1": [ymin, xmin, ymax, xmax], "box2": [ymin, xmin, ymax, xmax], "found_in_1": true or false}
with box1 in image 1 and box2 in image 2, each normalized to 0-1000 of its own image.`;
const RULE = { iou: 0.5, minArea: 0.6, maxArea: 1.6 };

const PAIRS = [
  ['GOOD', 'real', 'living', 'a1'], ['GOOD', 'real', 'dining', 'a2'], ['GOOD', 'real-fast', 'dining', 'a1'], ['GOOD', 'real-fast-2', 'living', 'a2'],
  ['BAD too large', 'real-fast', 'living', 'a1'], ['BAD table redrawn', 'real-fast-2', 'dining', 'a2'],
];
const url = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
const find = (run, room, att, kind) => { const d = path.join(EV, run); const f = fs.readdirSync(d).find((n) => n.includes(`-follow-${room}-${att}-${kind}.jpg`)); return path.join(d, f); };
let booked = 0, right = 0, total = 0;
const rows = [];
for (const [label, run, room, att] of PAIRS) {
  const sent = url(find(run, room, att, 'sent')), ans = url(find(run, room, att, 'answer'));
  for (let r = 1; r <= Number(RUNS); r++) {
    const t0 = Date.now();
    booked += 0.004; total++;
    let verdict = 'unreadable', detail = '';
    try {
      const res = await chatFetch(env, fetch)('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: TEXT_MODEL, temperature: 0, max_tokens: 2400, reasoning: { max_tokens: 300 }, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: [{ type: 'text', text: 'Image 1 — the original:' }, { type: 'image_url', image_url: { url: sent } }, { type: 'text', text: 'Image 2 — the edit:' }, { type: 'image_url', image_url: { url: ans } }] }] }),
        signal: AbortSignal.timeout(60000),
      });
      const text = (await res.json()).choices?.[0]?.message?.content || '';
      const a = text.indexOf('{'), z = text.lastIndexOf('}');
      const p = JSON.parse(a >= 0 && z > a ? text.slice(a, z + 1) : text);
      const ok4 = (q) => Array.isArray(q) && q.length === 4 && q.every((n) => Number.isFinite(n));
      if (!ok4(p.box2)) { verdict = 'unreadable'; detail = 'no box2'; }
      else if (!ok4(p.box1) || p.found_in_1 === false) { verdict = 'NOT held'; detail = `${p.anchor}: not found in the original`; }
      else {
        const area = (q) => Math.max(0, q[2] - q[0]) * Math.max(0, q[3] - q[1]);
        const inter = Math.max(0, Math.min(p.box1[2], p.box2[2]) - Math.max(p.box1[0], p.box2[0])) * Math.max(0, Math.min(p.box1[3], p.box2[3]) - Math.max(p.box1[1], p.box2[1]));
        const iou = inter / (area(p.box1) + area(p.box2) - inter || 1), ratio = area(p.box2) / (area(p.box1) || 1);
        verdict = iou >= RULE.iou && ratio >= RULE.minArea && ratio <= RULE.maxArea ? 'HELD' : 'NOT held';
        detail = `${p.anchor}: iou ${iou.toFixed(2)} area x${ratio.toFixed(2)}`;
      }
    } catch (e) { detail = String(e.message).slice(0, 100); }
    const want = label === 'GOOD' ? 'HELD' : 'NOT held';
    if (verdict === want) right++;
    rows.push({ label, run, room, att, r, verdict, detail, s: Number(((Date.now() - t0) / 1000).toFixed(1)) });
    console.log(`${label.padEnd(18)} ${run.padEnd(12)} ${room} ${att} run ${r}: ${verdict.padEnd(10)} ${verdict === want ? 'right' : 'WRONG'} · ${detail} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
}
console.log(`\n${right} of ${total} verdicts right · booked $${booked.toFixed(3)}`);
fs.writeFileSync(path.join(EV, 'judge-anchor-test.json'), JSON.stringify({ when: new Date().toISOString(), system: SYSTEM, rule: RULE, booked_usd: Number(booked.toFixed(3)), right, total, rows }, null, 2) + '\n');
