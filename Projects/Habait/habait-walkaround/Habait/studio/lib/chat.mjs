/* Habait Studio — lib/chat.mjs: the developer's agent for ONE project (plan development/plans/2026-11-03-studio-agent-fal.md).
   Grounded (root CLAUDE.md §6): it answers only from the project's own data on disk — meta, the uploaded files' names, what the
   intake read (derived/intake.json), the stages' states and the ledger total. It never invents rooms, prices or dates.
   Model: a fal LLM (lib/fal-llm.mjs), paid → gated by HABAIT_ALLOW_SPEND and the project cap BEFORE the call, ledgered after it.
   History: <project>/chat.json, the last 12 turns go back to the model. HABAIT_MOCK_LLM=1 answers from a fixed text ($0, tests). */
import fs from 'node:fs';
import path from 'node:path';
import { falLLM } from './fal-llm.mjs';

const MAX_TURNS = 12;
const inFlight = new Set();      // project ids with a paid answer under way (single server process)
const CHAT_MAX_TOKENS = 1200;
const EST_USD = 0.05;            // the gate's per-message estimate (a 1200-token answer on a $10/M model + the context)
const ROLE_LINE = /^\[roles\] \{.*\}\s*$/m;

export function historyFile(store, id) { return path.join(store.dir(id), 'chat.json'); }
export function history(store, id) {
  try { const h = JSON.parse(fs.readFileSync(historyFile(store, id), 'utf8')); return Array.isArray(h) ? h : []; } catch { return []; }
}
function saveHistory(store, id, rows) {
  const f = historyFile(store, id); const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows.slice(-200), null, 2)); fs.renameSync(tmp, f);
}

/** The project data the agent may use — and nothing else. */
export function context(store, id) {
  const meta = store.meta(id) || {};
  const st = store.state(id);
  const intake = store.derived(id, 'intake.json');
  const roles = (() => { const m = /^\[roles\] (\{.*\})\s*$/m.exec(meta.notes || ''); try { return m ? JSON.parse(m[1]) : {}; } catch { return {}; } })();
  const files = store.files(id).filter((f) => f.name !== 'CLAUDE.md').map((f) => `- ${f.name} (${Math.round(f.bytes / 1024)} KB${roles[f.name] ? `, role: ${roles[f.name]}` : ''})`);
  const stages = Object.entries(st.stages || {}).map(([k, v]) => `- ${k}: ${v.status}${v.note ? ` — ${String(v.note).slice(0, 160)}` : ''}`);
  const intakeText = intake ? JSON.stringify({ ...intake, _meta: undefined }, null, 1).slice(0, 24000) : '(the files have not been read yet)';
  return [
    `PROJECT: ${meta.name || id}`,
    `developer: ${meta.developer || '-'} · address: ${meta.address || '-'}`,
    `developer notes: ${String(meta.notes || '').replace(ROLE_LINE, '').trim() || '-'}`,
    `UPLOADED FILES:\n${files.join('\n') || '(none)'}`,
    `WHAT THE INTAKE READ FROM THE FILES (JSON):\n${intakeText}`,
    `PIPELINE STAGES:\n${stages.join('\n') || '(not started)'}`,
    `SPENT SO FAR: $${(store.ledgerTotal(id) || 0).toFixed(2)}`,
  ].join('\n\n');
}

export const SYSTEM = `You are the Habait Studio assistant for one real-estate project. The developer uploads the sales plan and renders; you answer their questions about THIS project.
Rules:
- Answer ONLY from the PROJECT DATA below. If the answer is not in it, say plainly that the data does not say, and what file or step would tell (e.g. "upload the sales plan", "run the reading step").
- Never invent rooms, areas, prices, dates, names or legal wording. Quote numbers exactly as they appear.
- Point out uncertainties the intake listed when they matter to the question.
- Reply in the language of the question (Hebrew by default), short and concrete. No marketing language.`;

/** ask({ env, store, id, question, log }) -> { ok, reply?, usd, model?, error?, messages } */
export async function ask({ env, store, id, question, log = () => {} }) {
  const q = String(question || '').trim().slice(0, 2000);
  if (!q) return { ok: false, error: 'empty question', usd: 0, messages: history(store, id) };
  const past = history(store, id);
  const turns = past.slice(-MAX_TURNS).map((m) => `${m.role === 'user' ? 'DEVELOPER' : 'ASSISTANT'}: ${m.content}`).join('\n\n');
  const system = `${SYSTEM}\n\n=== PROJECT DATA ===\n${context(store, id)}\n=== END OF PROJECT DATA ===`;
  const prompt = `${turns ? `Conversation so far:\n${turns}\n\n` : ''}DEVELOPER: ${q}\nASSISTANT:`;
  let r;
  if (env.MOCK_LLM) {
    r = { ok: true, text: `(mock) ${q}`, usd: 0, model: 'mock' };
  } else {
    if (!env.FAL_KEY) return { ok: false, error: 'הצ׳אט עובד דרך מודל ב-fal: חסר FAL_KEY בקובץ ‎.env', usd: 0, messages: past };
    if (!env.ALLOW_SPEND) return { ok: false, error: 'ההוצאה כבויה: כדי לשוחח עם הסוכן צריך HABAIT_ALLOW_SPEND=1 בקובץ ‎.env (יש תקרה לפרויקט)', usd: 0, messages: past };
    // one paid answer at a time per project: the cap check and the ledger row cannot be raced by concurrent POSTs (review 2b)
    if (inFlight.has(id)) return { ok: false, error: 'הסוכן עדיין עונה על השאלה הקודמת', usd: 0, messages: past };
    const total = store.ledgerTotal(id) || 0;
    if (total + EST_USD > env.CAP_USD) return { ok: false, error: `תקרת ההוצאה של הפרויקט: $${total.toFixed(2)} + $${EST_USD.toFixed(2)} > $${env.CAP_USD}`, usd: 0, messages: past };
    inFlight.add(id);
    try { r = await falLLM({ key: env.FAL_KEY, model: env.FAL_LLM_MODEL, system, prompt, maxTokens: CHAT_MAX_TOKENS, temperature: 0.2, log }); }
    finally { inFlight.delete(id); }
    if (r.usd) store.spend(id, { stage: 'chat', endpoint: `fal:${r.model}`, usd: Math.round(r.usd * 1e4) / 1e4, note: `chat answer (${(r.usage?.total_tokens || 0)} tokens)` });
    if (!r.ok) return { ok: false, error: r.note, usd: r.usd || 0, messages: past };
  }
  const now = new Date().toISOString();
  const rows = [...past, { role: 'user', content: q, at: now }, { role: 'assistant', content: r.text.trim(), at: new Date().toISOString(), model: r.model, usd: r.usd || 0 }];
  saveHistory(store, id, rows);
  return { ok: true, reply: r.text.trim(), usd: r.usd || 0, model: r.model, messages: rows };
}
