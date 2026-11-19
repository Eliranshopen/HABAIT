// api/edit.mjs — the 360 version's live change (RAINBOW's model): the visitor's current view + an instruction (+ an optional picture
// of the new piece) → fal-ai/nano-banana/edit → the edited view, returned as a data URL (same origin, so the page can mask it).
// Eliran 2026-11-18: changes open to all, a daily cap of $5. The account has no free shared store (Blob: usage threshold), so the
// counter lives in the server copy's memory: 40 edits ($1.59) per copy per UTC day, reserved BEFORE the paid call, 15 per visitor.
// A quiet site runs one copy; an exact cap across copies needs a shared counter (Upstash, Eliran's click). FAL_KEY is a Vercel environment variable, never logged or returned.
// Plan: development/plans/2026-11-18-ahk-b10-two-versions.md.

export const config = { maxDuration: 60 };
const USD = 0.0398, CAP = 40, PER_IP = 15;
const EP = 'https://fal.run/fal-ai/nano-banana/edit';
const STRUCT = /\b(move|remove|add|build|demolish|enlarge|widen|shrink|resize|knock down)\s+(the\s+|a\s+)?(wall|window|door|room|ceiling)s?\b|(להזיז|להרוס|להגדיל|להקטין|להוסיף|לבנות|לפתוח|לסגור)\s+(את\s+)?ה?(קיר|חלון|דלת|חדר|תקרה)/i;
const ipSeen = new Map();

const used = new Map();   // UTC day -> edits reserved by this copy
const usage = (day) => used.get(day) || 0;
const setUsage = (day, n) => used.set(day, n);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reason: 'POST only' });
  const { view, ref, instruction } = req.body || {};
  if (typeof view !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(view) || view.length > 3_500_000) return res.status(400).json({ reason: 'bad view' });
  if (ref != null && (typeof ref !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(ref) || ref.length > 1_000_000)) return res.status(400).json({ reason: 'bad ref' });
  if (typeof instruction !== 'string' || !instruction.trim() || instruction.length > 400) return res.status(400).json({ reason: 'bad instruction' });
  if (STRUCT.test(instruction)) return res.status(422).json({ reason: 'structure' });
  if (!process.env.FAL_KEY) return res.status(503).json({ reason: 'not configured' });
  const day = new Date().toISOString().slice(0, 10);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown', k = day + ':' + ip;
  if ((ipSeen.get(k) || 0) >= PER_IP) return res.status(429).json({ reason: 'visitor limit' });
  const n = usage(day);
  if (n >= CAP) return res.status(429).json({ reason: 'daily cap' });
  setUsage(day, n + 1); ipSeen.set(k, (ipSeen.get(k) || 0) + 1);   // reserved before the paid call
  const prompt = `Image 1 is a photo of a real apartment interior. ${instruction.trim()} ${ref ? 'Image 2 shows the new piece: match its design, material and colour.' : ''} `
    + 'Keep the exact same camera, framing, perspective, light, walls, windows, doors, floor and every other object unchanged. Photorealistic, natural light. No text, no watermark.';
  try {
    const r = await fetch(EP, { method: 'POST', headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(55e3),
      body: JSON.stringify({ prompt, image_urls: ref ? [view, ref] : [view], num_images: 1, output_format: 'jpeg' }) });
    if (!r.ok) { if (r.status >= 400 && r.status < 500) setUsage(day, Math.max(0, usage(day) - 1)); return res.status(502).json({ reason: `editor ${r.status}` }); }
    const j = await r.json(); const u = j.images && j.images[0] && j.images[0].url; if (!u) return res.status(502).json({ reason: 'no image' });
    const buf = Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(20e3) })).arrayBuffer());
    return res.status(200).json({ url: 'data:image/jpeg;base64,' + buf.toString('base64'), left: CAP - n - 1 });
  } catch (e) { return res.status(504).json({ reason: 'timeout' }); }
}
