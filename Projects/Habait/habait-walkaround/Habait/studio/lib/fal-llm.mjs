/* Habait Studio — lib/fal-llm.mjs: one call to a language model on fal.ai (plan development/plans/2026-11-03-studio-agent-fal.md).
   Endpoint `openrouter/router/vision` (a model of our choice through OpenRouter, billed on actual tokens; fal docs 2026-11-03):
     input  { prompt, system_prompt, model, pdf_urls[], image_urls[], temperature, max_tokens }   (data URIs accepted)
     output { output: string, usage: { cost, prompt_tokens, completion_tokens, total_tokens } }
   The key travels by NAME: the caller passes env.FAL_KEY; nothing here logs, prints or stores it (root §8.1).
   reasoning: on by default — the Claude 5.x models on this endpoint refuse a request with reasoning off (fal HTTP 400 'Reasoning is
   mandatory', 2026-11-03); with it on, `output` is still the answer alone (probe: development/tasks/studio-agent-fal/logs/probe-reasoning.txt).
   HABAIT_FAL_BASE overrides https://fal.run so the tests can answer from a local mock server ($0, no network). */
import fs from 'node:fs';

export const FAL_LLM_ENDPOINT = 'openrouter/router/vision';
export const DEFAULT_FAL_MODEL = 'anthropic/claude-sonnet-5.5';   // OpenRouter id, vision + PDF, picked 2026-11-03 from openrouter.ai/api/v1/models
const PDF_BUDGET = 28_000_000;                                     // the same total PDF budget as the API backend

export const dataUri = (file, mediaType) => `data:${mediaType};base64,${fs.readFileSync(file).toString('base64')}`;

/**
 * falLLM({ key, model, system, prompt, pdfs: [path], images: [{ file, mediaType }], maxTokens, temperature, base, log })
 *  -> { ok, text, usd, model, usage, note }
 */
export async function falLLM({ key, model = DEFAULT_FAL_MODEL, system = '', prompt, pdfs = [], images = [], maxTokens = 8000, temperature = 0, reasoning = true, base, log = () => {} }) {
  if (!key) return { ok: false, usd: 0, model, note: 'FAL_KEY missing' };
  const pdf_urls = [];
  let pdfBytes = 0;
  for (const f of pdfs) {
    const n = fs.statSync(f).size;
    if (pdfBytes + n > PDF_BUDGET) { log(`skipping ${f}: PDF budget exceeded`); continue; }
    pdfBytes += n; pdf_urls.push(dataUri(f, 'application/pdf'));
  }
  const image_urls = images.map((im) => dataUri(im.file, im.mediaType || 'image/png'));
  const body = { prompt, model, temperature, max_tokens: maxTokens };
  if (system) body.system_prompt = system;
  if (reasoning !== undefined) body.reasoning = reasoning;
  if (pdf_urls.length) body.pdf_urls = pdf_urls;
  if (image_urls.length) body.image_urls = image_urls;
  const url = `${(base || process.env.HABAIT_FAL_BASE || 'https://fal.run').replace(/\/$/, '')}/${FAL_LLM_ENDPOINT}`;
  log(`LLM via fal: ${model}, ${pdf_urls.length} pdf(s), ${image_urls.length} image(s)`);
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10 * 60 * 1000) });
  } catch (e) {
    return { ok: false, usd: 0, model, note: `fal request failed: ${e.message}` };
  }
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok) return { ok: false, usd: 0, model, note: `fal HTTP ${r.status}: ${String(j?.detail ? JSON.stringify(j.detail) : text).slice(0, 300)}` };
  if (!j || typeof j.output !== 'string') return { ok: false, usd: Number(j?.usage?.cost) || 0, model, note: 'fal answered without an output text' };
  return { ok: true, text: j.output, usd: Number(j.usage?.cost) || 0, model, usage: j.usage || null };
}
