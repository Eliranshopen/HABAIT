/* Habait Tour360 — the Vercel function `api/edit.mjs` (copied there by tools/build-tour.mjs beside `api/_handler.mjs`).
   GET  → { configured, models, limits }  (no secrets, ever)
   POST → one live edit turn through server/handler.mjs. Keys come from the project's environment — FAL_KEY, OPENROUTER_API_KEY
   and TOUR_EDIT_CODE — pasted by Slava, never by an agent (D-T360-18). Until they exist the function answers 503 and the page
   keeps the typed field disabled. The day's cap is counted in memory per instance (best effort on this host; the laptop server
   keeps the exact file ledger). */
import fs from 'node:fs';
import { describe, handleEdit, memoryLedger, catalogIndex, EditError } from './_handler.mjs';

export const config = { maxDuration: 300 };

const ledger = memoryLedger();
// plan 2026-11-04-apt-furniture-swap D5 (open to every visitor): at most PER_IP_HOUR POSTs per address per hour on this instance.
// One visitor's change is 2–4 POSTs (the edit, the judges, the likeness), so 40 ≈ 10–20 changes an hour.
const PER_IP_HOUR = 40;
const seen = new Map();
function overLimit(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
  const now = Date.now();
  const list = (seen.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (list.length >= PER_IP_HOUR) { seen.set(ip, list); return true; }
  list.push(now); seen.set(ip, list);
  if (seen.size > 5000) for (const k of seen.keys()) { seen.delete(k); if (seen.size < 4000) break; }
  return false;
}
// the catalog (T14b): build-tour.mjs --catalog writes api/catalog.json beside this file; without it there is no catalog turn
let catalog = null;
try { catalog = catalogIndex(JSON.parse(fs.readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'))); } catch { catalog = null; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method === 'GET') {
    res.status(200).json(describe(process.env, catalog, req.headers['x-tour-code'] === undefined ? undefined : String(req.headers['x-tour-code']))); // T18i: the code up front
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ ok: false, reason: 'method' });
    return;
  }
  if (overLimit(req)) { res.status(429).json({ ok: false, reason: 'cap' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const out = await handleEdit(body, process.env, ledger, { log: (m) => console.log('[tour-edit]', m), catalog });
    res.status(200).json(out);
  } catch (e) {
    if (e instanceof EditError) {
      res.status(e.status).json({ ok: false, reason: e.reason, message: e.reason === 'vendor' || e.reason === 'vendor_refused' ? undefined : e.message });
      return;
    }
    console.error('[tour-edit]', String(e && e.message || e).slice(0, 200));
    res.status(500).json({ ok: false, reason: 'error' });
  }
}
