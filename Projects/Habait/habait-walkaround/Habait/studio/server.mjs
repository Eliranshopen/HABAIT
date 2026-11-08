/* Habait Studio — server.mjs: the dashboard host and the pipeline API. Zero dependencies beyond Node 24
   (multipart via the WHATWG Request.formData(), SSE for live logs). One pipeline run at a time per project.

   GET  /                                   the dashboard
   GET  /api/env                            capabilities (never values): llm, fal, blender, python, cap
   GET  /api/styles                         styles/presets.json
   GET  /api/stages                         the fixed stage list
   GET  /api/projects                       list
   POST /api/projects                       { name, address, developer, style, latlon?, notes?, panos_dir?, fixture? }
   GET  /api/projects/:id                   meta + state + files + ledger + derived summaries
   PATCH /api/projects/:id                  meta patch (style, address, latlon, options, …)
   POST /api/projects/:id/files             multipart upload (field "files")
   GET  /api/projects/:id/chat              the developer-agent conversation (lib/chat.mjs)
   POST /api/projects/:id/chat              { message } -> { reply, usd, model, messages } (a fal LLM, grounded on the project; paid, gated)
   DELETE /api/projects/:id/files/:name
   POST /api/projects/:id/run               { stages?: [...], force?: bool } → starts a run (202)
   POST /api/projects/:id/approve-plan      copies derived/plan.draft.json → plan.json after a human review
   GET  /api/projects/:id/events            SSE: log lines + stage/run events (replays the last 200 lines)
   GET  /api/projects/:id/derived/:name     a derived JSON
   GET  /projects/:id/<path>                static: intake files, renders, outputs (videos, keyframes) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { loadEnv, describeEnv, STUDIO, REPO } from './lib/env.mjs';
import { ProjectStore } from './lib/projects.mjs';
import { runPipeline, describeStages, STAGE_IDS } from './pipeline/index.mjs';
import { ask as chatAsk, history as chatHistory } from './lib/chat.mjs';

const env = loadEnv();
env.REPO = REPO;
const store = new ProjectStore(env.PROJECTS_DIR);
const DASH = path.join(STUDIO, 'dashboard');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.blend': 'application/octet-stream' };

// ------------------------------------------------------------------ live events per project
const logs = new Map();      // id -> ring buffer of events
const clients = new Map();   // id -> Set<res>
const running = new Set();
function emitFor(id) {
  return (ev) => {
    const row = { ...ev, project: id, at: ev.at || Date.now() };
    const buf = logs.get(id) || [];
    buf.push(row); if (buf.length > 400) buf.splice(0, buf.length - 400);
    logs.set(id, buf);
    for (const res of clients.get(id) || []) res.write(`data: ${JSON.stringify(row)}\n\n`);
  };
}

// ------------------------------------------------------------------ helpers
function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}
function serveFile(res, file, { inline = true } = {}) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'not found');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store', ...(inline ? {} : { 'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(file))}"` }) });
  fs.createReadStream(file).pipe(res);
}
function safeJoin(root, rel) {
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(path.normalize(root + path.sep)) && full !== path.normalize(root)) throw new Error('path escapes root');
  return full;
}
function projectSummary(id) {
  const meta = store.meta(id);
  if (!meta) return null;
  const p = store.paths(id);
  const derivedList = fs.existsSync(p.derived) ? fs.readdirSync(p.derived).filter((f) => f.endsWith('.json')) : [];
  const outputs = fs.existsSync(path.join(p.outputs, 'tour.json')) ? JSON.parse(fs.readFileSync(path.join(p.outputs, 'tour.json'), 'utf8')) : null;
  const intake = store.derived(id, 'intake.json');
  const shots = store.derived(id, 'shots.json');
  const keyframes = store.derived(id, 'keyframes.json');
  const clay = store.derived(id, 'clay.json');
  const video = store.derived(id, 'video.json');
  const site = store.derived(id, 'site.json');
  return { ...meta, state: store.state(id), files: store.files(id), ledger: store.ledger(id), ledger_usd: store.ledgerTotal(id), derived: derivedList,
    intake: intake ? { ...intake, _meta: intake._meta } : null, site: site ? { origin: site.origin, north_deg: site.north_deg, floor_of_unit: site.floor_of_unit, floors_total: site.floors_total, buildings: site.context?.buildings?.length || 0, notes: site.notes } : null,
    shots: shots ? shots.shots.map((s) => ({ id: s.id, kind: s.kind, duration_s: s.duration_s, room_name_he: s.room_name_he, room_name_en: s.room_name_en })) : null,
    clay: clay ? { res: clay.res, samples: clay.samples, engine: clay.engine, shots: clay.shots, failed: clay.failed } : null,
    keyframes: keyframes ? keyframes.picks : null, video: video ? { rows: video.rows, estimate_usd: video.estimate_usd, spent_usd: video.spent_usd } : null,
    outputs, running: running.has(id) };
}

// ------------------------------------------------------------------ routes
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (parts.length === 0) return serveFile(res, path.join(DASH, 'index.html'));
    if (parts[0] === 'api') {
      const [, kind, id, sub, name] = parts;
      if (kind === 'env') return send(res, 200, describeEnv(env));
      if (kind === 'styles') return serveFile(res, path.join(STUDIO, 'styles', 'presets.json'));
      if (kind === 'stages') return send(res, 200, describeStages());
      if (kind === 'projects' && !id) {
        if (req.method === 'GET') return send(res, 200, store.list().map((p) => ({ ...p, running: running.has(p.id) })));
        if (req.method === 'POST') { const body = await readJsonBody(req); if (!body.name) return send(res, 400, { error: 'name required' }); return send(res, 201, store.create(body)); }
      }
      if (kind === 'projects' && id) {
        if (!store.exists(id)) return send(res, 404, { error: 'no such project' });
        if (!sub && req.method === 'GET') return send(res, 200, projectSummary(id));
        if (!sub && req.method === 'PATCH') { const body = await readJsonBody(req); delete body.id; return send(res, 200, store.saveMeta(id, body)); }
        if (sub === 'files' && req.method === 'POST') {
          const webReq = new Request('http://localhost/upload', { method: 'POST', headers: req.headers, body: Readable.toWeb(req), duplex: 'half' });
          const form = await webReq.formData();
          const saved = [];
          for (const [field, value] of form.entries()) {
            if (typeof value === 'string' || !value.name) continue;
            saved.push(store.addFile(id, value.name, Buffer.from(await value.arrayBuffer())));
          }
          return send(res, 200, { saved, files: store.files(id) });
        }
        if (sub === 'files' && name && req.method === 'DELETE') { store.removeFile(id, name); return send(res, 200, { files: store.files(id) }); }
        if (sub === 'run' && req.method === 'POST') {
          if (running.has(id)) return send(res, 409, { error: 'already running' });
          const body = await readJsonBody(req);
          const stages = Array.isArray(body.stages) && body.stages.length ? body.stages.filter((s) => STAGE_IDS.includes(s)) : STAGE_IDS;
          running.add(id);
          const emit = emitFor(id);
          runPipeline(store, id, { stages, env, emit, force: Boolean(body.force) })
            .catch((e) => emit({ type: 'log', stage: 'runner', line: `runner error: ${e.message}` }))
            .finally(() => { running.delete(id); emit({ type: 'state', state: store.state(id) }); });
          return send(res, 202, { started: true, stages });
        }
        if (sub === 'chat' && req.method === 'GET') return send(res, 200, { messages: chatHistory(store, id) });
        if (sub === 'chat' && req.method === 'POST') {
          let body;
          try { body = await readJsonBody(req); } catch { return send(res, 400, { error: 'the body is not JSON' }); }
          const r = await chatAsk({ env, store, id, question: body?.message, log: (l) => emitFor(id)({ type: 'log', stage: 'chat', line: l }) });
          return send(res, r.ok ? 200 : 409, r.ok ? r : { error: r.error, messages: r.messages });
        }
        if (sub === 'approve-plan' && req.method === 'POST') {
          const draft = path.join(store.paths(id).derived, 'plan.draft.json');
          if (!fs.existsSync(draft)) return send(res, 404, { error: 'no plan.draft.json' });
          fs.copyFileSync(draft, path.join(store.paths(id).derived, 'plan.json'));
          store.setStage(id, 'plan', { status: 'done', note: 'draft approved by hand in the dashboard' });
          return send(res, 200, { ok: true });
        }
        if (sub === 'events') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write(': connected\n\n');
          for (const row of (logs.get(id) || []).slice(-200)) res.write(`data: ${JSON.stringify(row)}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'state', project: id, state: store.state(id), running: running.has(id) })}\n\n`);
          const set = clients.get(id) || new Set(); set.add(res); clients.set(id, set);
          const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 20000);
          req.on('close', () => { clearInterval(ping); set.delete(res); });
          return;
        }
        if (sub === 'derived' && name) return serveFile(res, safeJoin(store.paths(id).derived, name));
      }
      return send(res, 404, { error: 'unknown api route' });
    }
    if (parts[0] === 'projects' && parts[1]) {
      if (!store.exists(parts[1])) return send(res, 404, 'no such project');
      const rel = parts.slice(2).join('/');
      return serveFile(res, safeJoin(store.paths(parts[1]).dir, rel), { inline: url.searchParams.get('dl') !== '1' });
    }
    // dashboard static
    return serveFile(res, safeJoin(DASH, parts.join('/')));
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.message });
  }
}

const server = http.createServer((req, res) => { handle(req, res); });
server.listen(env.PORT, '127.0.0.1', () => {
  console.log(`Habait Studio  http://127.0.0.1:${env.PORT}/`);
  console.log(`projects: ${env.PROJECTS_DIR}`);
  console.log(`env: ${JSON.stringify(describeEnv(env))}`);
});
