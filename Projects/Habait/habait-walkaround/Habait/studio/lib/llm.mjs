/* Habait Studio — lib/llm.mjs: one structured-output call, two backends.
   1. 'api'  — the Anthropic SDK (ANTHROPIC_API_KEY present): PDFs as document blocks, images as image blocks,
               `client.messages.parse` with a zod (v4) output format. Metered on the key; the ledger gets the usd.
   2. 'cli'  — Eliran has a Claude subscription and no API key (2026-11-01, his words), so when the `claude`
               command (Claude Code) is on PATH we run it headless: `claude -p … --output-format json`, cwd =
               the intake folder, the files read by its own Read tool, the JSON schema in the prompt, the answer
               validated with the same zod schema. Covered by the subscription; the ledger row is $0 with the
               CLI's own cost figure kept as a note. ⚠ This is his own account on his own machine for his own
               project; a hosted multi-user product needs the API key path.
   Neither backend is used when HABAIT_MOCK_LLM=1 (fixtures). */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { z } from 'zod/v4';
import { falLLM } from './fal-llm.mjs';

let cliChecked = null;
export function claudeCliPath() {
  if (cliChecked !== null) return cliChecked;
  // on Windows the npm shim is claude.cmd, which Node only runs through a shell
  try {
    const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 20000, shell: process.platform === 'win32', windowsHide: true });
    if (r.status === 0 && /Claude Code/i.test(r.stdout || '')) { cliChecked = 'claude'; return 'claude'; }
  } catch { /* absent */ }
  cliChecked = '';
  return '';
}

export function backendFor(env) {
  if (env.MOCK_LLM) return 'mock';
  if (env.LLM_BACKEND) return env.LLM_BACKEND;
  if (env.FAL_KEY && env.ALLOW_SPEND) return 'fal';
  if (env.ANTHROPIC_API_KEY) return 'api';
  if (claudeCliPath()) return 'cli';
  return 'none';
}

const PRICE = { 'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2 }, 'claude-sonnet-5-5': { in: 2, out: 10, cacheRead: 0.2 }, 'claude-fable-5-1': { in: 10, out: 50, cacheRead: 0.25 } };
function usageUsd(model, u) {
  const p = PRICE[model] || PRICE['claude-opus-5-5'];
  return ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out + (u.cache_read_input_tokens || 0) * p.cacheRead) / 1e6;
}

const IMG_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const TEXT_TYPES = new Set(['.txt', '.md', '.json', '.csv']);

/** The readable uploads in a folder: [{ name, full, rel, kind: 'pdf'|'image'|'text' }], traced plan JSONs excluded.
    `rel` is the path the CLI backend's Read tool uses, relative to `cwd` (default: the folder itself). */
export function listInputs(dir, cwd = dir) {
  return fs.readdirSync(dir).filter((f) => !f.startsWith('.')).sort().map((f) => {
    const ext = path.extname(f).toLowerCase();
    const kind = ext === '.pdf' ? 'pdf' : IMG_TYPES[ext] ? 'image' : TEXT_TYPES.has(ext) && !/plan(\.general)?\.json$/i.test(f) ? 'text' : null;
    const full = path.join(dir, f);
    return kind ? { name: f, full, rel: path.relative(cwd, full).replace(/\\/g, '/'), kind, mediaType: IMG_TYPES[ext] } : null;
  }).filter(Boolean);
}

/** An input made from a derived image (a PDF page render or tile): { name, full, rel, kind:'image', note }. */
export function imageInput(full, cwd, note) {
  const ext = path.extname(full).toLowerCase();
  return { name: path.basename(full), full, rel: path.relative(cwd, full).replace(/\\/g, '/'), kind: 'image', mediaType: IMG_TYPES[ext] || 'image/png', note };
}

function stripFences(s) {
  const m = String(s).trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = m ? m[1] : String(s).trim();
  const i = body.indexOf('{'), j = body.lastIndexOf('}');
  return i >= 0 && j > i ? body.slice(i, j + 1) : body;
}

/**
 * structured({ env, log, dir, inputs, system, task, schema, prepImage })
 *  -> { ok, data, backend, model, usd, note, raw?, issues? }
 */
export async function structured({ env, log = () => {}, dir, inputs, system, task, schema, prepImage, allowFal = false }) {
  let backend = backendFor(env);
  // fal is PAID: only a caller that gates and ledgers the call itself may use it (allowFal — today the intake stage), and only with
  // spending on. Anyone else (plan, pick_views…) falls back to the free paths, so no fal call can bypass the cap or the ledger.
  if (backend === 'fal' && (!allowFal || !env.ALLOW_SPEND)) {
    const next = env.ANTHROPIC_API_KEY ? 'api' : claudeCliPath() ? 'cli' : 'none';
    log(`fal not used here (${!allowFal ? 'this caller does not gate a paid call' : 'spending is off'}); backend ${next}`);
    backend = next;
  }
  if (backend === 'api') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');
    const content = [];
    let pdfBytes = 0;
    for (const f of inputs) {
      if (f.kind === 'pdf') {
        const buf = fs.readFileSync(f.full); pdfBytes += buf.length;
        if (pdfBytes > 28_000_000) { log(`skipping ${f.name}: PDF budget exceeded`); continue; }
        content.push({ type: 'text', text: `Document "${f.name}":` });
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') }, title: f.name });
      } else if (f.kind === 'image') {
        const prepped = prepImage ? await prepImage(f.full) : f.full;
        if (!prepped) continue;
        content.push({ type: 'text', text: `Image "${f.name}"${f.note ? ` (${f.note})` : ''}:` });
        content.push({ type: 'image', source: { type: 'base64', media_type: prepped === f.full ? f.mediaType : 'image/jpeg', data: fs.readFileSync(prepped).toString('base64') } });
      } else {
        content.push({ type: 'text', text: `Text file "${f.name}":\n${fs.readFileSync(f.full, 'utf8').slice(0, 20000)}` });
      }
    }
    content.push({ type: 'text', text: task });
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    log(`LLM via API: ${env.LLM_MODEL}, ${inputs.length} file(s)`);
    const response = await client.messages.parse({
      model: env.LLM_MODEL, max_tokens: 16000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
      output_config: { effort: 'high', format: zodOutputFormat(schema) },
    });
    const usd = usageUsd(env.LLM_MODEL, response.usage || {});
    if (response.stop_reason === 'refusal') return { ok: false, backend, model: env.LLM_MODEL, usd, note: `the model declined (${response.stop_details?.category || 'refusal'})` };
    if (!response.parsed_output) return { ok: false, backend, model: env.LLM_MODEL, usd, note: `structured output did not parse (stop ${response.stop_reason})`, raw: response.content.find((b) => b.type === 'text')?.text || '' };
    return { ok: true, data: response.parsed_output, backend, model: env.LLM_MODEL, usd, usage: response.usage };
  }

  if (backend === 'fal') {
    // plan studio-agent-fal: a model on fal.ai (openrouter/router/vision). PDFs and images go as data URIs, text inline,
    // the JSON schema in the prompt; the answer is parsed and checked with the same zod schema as the other backends.
    const pdfs = [], images = [], texts = [];
    for (const f of inputs) {
      if (f.kind === 'pdf') pdfs.push(f.full);
      else if (f.kind === 'image') { const prepped = prepImage ? await prepImage(f.full) : f.full; if (prepped) images.push({ file: prepped, mediaType: prepped === f.full ? f.mediaType : 'image/jpeg' }); }
      else texts.push(`Text file "${f.name}":\n${fs.readFileSync(f.full, 'utf8').slice(0, 20000)}`);
    }
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' });
    const listing = inputs.map((f) => `- ${f.name} (${f.kind}${f.note ? ': ' + f.note : ''})`).join('\n');
    const prompt = `${task}\n\n## Attached files (in this order: the PDFs, then the images)\n${listing}\n\n${texts.join('\n\n')}\n\n## Output\nAnswer with ONE JSON object that validates against this JSON Schema, and nothing else:\n${JSON.stringify(jsonSchema)}`;
    const r = await falLLM({ key: env.FAL_KEY, model: env.FAL_LLM_MODEL, system, prompt, pdfs, images, maxTokens: 16000, temperature: 0, log });
    if (!r.ok) return { ok: false, backend, model: r.model, usd: r.usd || 0, note: r.note };
    let obj;
    try { obj = JSON.parse(stripFences(r.text)); } catch { return { ok: false, backend, model: r.model, usd: r.usd, note: 'the answer was not a JSON object', raw: String(r.text).slice(0, 20000) }; }
    const parsed = schema.safeParse(obj);
    if (!parsed.success) return { ok: false, backend, model: r.model, usd: r.usd, note: `answer does not match the schema: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, raw: String(r.text).slice(0, 20000) };
    return { ok: true, data: parsed.data, backend, model: r.model, usd: r.usd, usage: r.usage, note: `fal ${r.model}` };
  }

  if (backend === 'cli') {
    const cmd = claudeCliPath();
    const model = env.CLI_MODEL || 'sonnet';
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' });
    const fileLines = inputs.map((f) => `- ${f.rel || f.name}  (${f.kind}${f.note ? ': ' + f.note : f.kind === 'pdf' ? ': the original document; its page renders and tiles are listed too' : f.kind === 'image' ? ': open it with Read' : ''})`).join('\n');
    const prompt = `${system}\n\n## Files to read (paths relative to the current directory — use the Read tool on EACH of them, by the exact path; read the high-resolution tiles before answering any number)\n${fileLines}\n\n## Task\n${task}\n\n## Output\nReturn ONLY one JSON object, no prose, no code fences, that validates against this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
    log(`LLM via Claude Code CLI (subscription): model ${model}, ${inputs.length} file(s), cwd ${dir}`);
    const t0 = Date.now();
    const out = await new Promise((resolve) => {
      const child = spawn(cmd, ['-p', 'Read every listed file, then answer exactly as the piped instructions say. Output only the JSON object.', '--model', model, '--output-format', 'json', '--max-turns', '30', '--allowedTools', 'Read'],
        { cwd: dir, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true, shell: process.platform === 'win32' });
      let so = '', se = '';
      child.stdout.on('data', (b) => { so += b.toString('utf8'); });
      child.stderr.on('data', (b) => { se += b.toString('utf8'); });
      const timer = setTimeout(() => { child.kill(); }, 10 * 60 * 1000);
      child.on('close', (code) => { clearTimeout(timer); resolve({ code, so, se }); });
      child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, so, se: e.message }); });
      child.stdin.end(prompt);
    });
    const seconds = Math.round((Date.now() - t0) / 100) / 10;
    if (out.code !== 0 && !out.so) return { ok: false, backend, model, usd: 0, note: `claude CLI exited ${out.code}: ${out.se.slice(0, 300)}` };
    let envelope;
    try { envelope = JSON.parse(out.so); } catch { return { ok: false, backend, model, usd: 0, note: 'claude CLI returned no JSON envelope', raw: out.so.slice(0, 2000) }; }
    if (envelope.is_error) return { ok: false, backend, model, usd: 0, note: `claude CLI error: ${String(envelope.result || '').slice(0, 300)}` };
    let obj;
    try { obj = JSON.parse(stripFences(envelope.result || '')); } catch { return { ok: false, backend, model, usd: 0, note: 'the answer was not a JSON object', raw: String(envelope.result || '').slice(0, 4000) }; }
    const parsed = schema.safeParse(obj);
    if (!parsed.success) return { ok: false, backend, model, usd: 0, note: `answer does not match the schema: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, raw: JSON.stringify(obj).slice(0, 4000), issues: parsed.error.issues };
    const cliModel = Object.keys(envelope.modelUsage || {})[0] || model;
    return { ok: true, data: parsed.data, backend, model: cliModel, usd: 0, note: `subscription; CLI reports ${envelope.num_turns} turns, ${seconds}s, nominal $${(envelope.total_cost_usd || 0).toFixed(2)}`, usage: envelope.usage };
  }

  return { ok: false, backend, model: null, usd: 0, note: backend === 'mock' ? 'mock mode' : 'no LLM backend: FAL_KEY with HABAIT_ALLOW_SPEND=1, or ANTHROPIC_API_KEY, or Claude Code (claude on PATH)' };
}
