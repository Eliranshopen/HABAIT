/* Habait Tour360 — server/chat-transport.mjs (plan development/plans/2026-11-04-apt-furniture-swap.md, P1).
   One door for every OpenRouter chat call in the tour (the scan, the edit's text step, the judges). With OPENROUTER_API_KEY it is
   plain fetch, unchanged. Without it, and with FAL_KEY, the same OpenAI-shaped request goes through fal's OpenRouter router
   (`openrouter/router/vision`: the same model ids, billed on tokens; the Studio's transport, studio/lib/fal-llm.mjs). The answer
   comes back in the OpenAI shape the callers already read: { choices: [{ message: { content }, finish_reason }], usage: { cost } }.
   The fal leg flattens a message's parts: the text parts become the prompt (each image marked "[image N]" where it stood) and
   the images become image_urls in the same order. response_format is not sent; the callers already strip ``` fences.
   Keys by NAME only (root §8.1): nothing here logs, prints or stores a key. HABAIT_FAL_BASE overrides https://fal.run for a mock. */
export const OPENROUTER_CHAT = 'https://openrouter.ai/api/v1/chat/completions';
const FAL_ENDPOINT = 'openrouter/router/vision';

function toFal(body) {
  const req = typeof body === 'string' ? JSON.parse(body) : body;
  const system = [], prompt = [], image_urls = [];
  for (const m of req.messages || []) {
    const parts = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content || []);
    const out = [];
    for (const p of parts) {
      if (p.type === 'text') out.push(p.text);
      else if (p.type === 'image_url' && p.image_url?.url) { image_urls.push(p.image_url.url); out.push(`[image ${image_urls.length}]`); }
    }
    (m.role === 'system' ? system : prompt).push(out.join('\n'));
  }
  // reasoning stays on: the endpoint refuses a request with it off (fal HTTP 400 'Reasoning is mandatory', 2026-11-03 and 2026-11-04)
  const fal = { model: req.model, prompt: prompt.join('\n\n'), temperature: req.temperature ?? 0, max_tokens: req.max_tokens ?? 4000, reasoning: true };
  if (system.length) fal.system_prompt = system.join('\n\n');
  if (image_urls.length) fal.image_urls = image_urls;
  if (req.response_format?.type === 'json_object') fal.system_prompt = (fal.system_prompt ? fal.system_prompt + '\n\n' : '') + 'Answer with the JSON object only.';
  return fal;
}

function answer(status, obj) {
  const text = JSON.stringify(obj);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => obj };
}

/** chatFetch(env, fetchImpl) → a fetch-shaped function for OPENROUTER_CHAT (any other URL passes straight through). */
export function chatFetch(env, fetchImpl = fetch) {
  return async (url, opts = {}) => {
    if (url !== OPENROUTER_CHAT || env.OPENROUTER_API_KEY || !env.FAL_KEY) return fetchImpl(url, opts);
    const base = (process.env.HABAIT_FAL_BASE || 'https://fal.run').replace(/\/$/, '');
    const res = await fetchImpl(`${base}/${FAL_ENDPOINT}`, {
      method: 'POST',
      headers: { Authorization: 'Key ' + env.FAL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(toFal(opts.body)),
      signal: opts.signal,
    });
    const raw = await res.text();
    let j = null;
    try { j = JSON.parse(raw); } catch { /* not JSON */ }
    if (!res.ok) return answer(res.status, { error: { message: String(j?.detail ? JSON.stringify(j.detail) : raw).slice(0, 300) } });
    if (!j || typeof j.output !== 'string') return answer(502, { error: { message: 'fal answered without an output text' } });
    return answer(200, { choices: [{ message: { content: j.output }, finish_reason: 'stop' }], usage: j.usage || {} });
  };
}

/** True when a chat call can be made at all (OpenRouter directly, or through fal). */
export const hasChat = (env) => Boolean(env.OPENROUTER_API_KEY || env.FAL_KEY);
