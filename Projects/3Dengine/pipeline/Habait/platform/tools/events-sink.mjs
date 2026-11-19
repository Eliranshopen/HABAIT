#!/usr/bin/env node
// First-party JSONL sink for js/analytics.js (card 24, D2). Until PostHog keys exist this is where the events live.
//
// Mounted in serve.mjs (since the card-24 wiring, 2026-11-02):
//     import { eventsSink } from './tools/events-sink.mjs';
//     // first line inside handle(req, res), BEFORE the GET/HEAD check:
//     if (await eventsSink(req, res)) return;
// What the mount does:
//   - POST /api/events (NDJSON or a JSON array, text/plain) -> appends one sanitised line per event to _local/events.jsonl
//     and answers 204 (X-Habait-Events: <n written>).
//   - every other response gets `Server-Timing: habait-sink;desc="/api/events"`, which is how analytics.js knows the
//     sink exists (no probe request; pages served without the mount never post, so no 405s).
// Limits (T2 review defect 3; the page never hits them, js/analytics.js posts <= 25 events / ~12 KB per request):
//   - Origin header REQUIRED and equal to the server's own origin (Host); no Origin / "null" / foreign -> 403.
//     (Browsers send Origin on every POST; curl and scripts do not.)
//   - one request <= 16 KB (else 413) and <= 50 events (else 413).
//   - per client IP a token bucket of 60 events/min (burst 60); events over the bucket are dropped silently
//     (204, X-Habait-Dropped: rate) so a buyer's page never shows a console error.
//   - the JSONL file stops growing at 50 MB (events dropped, X-Habait-Dropped: file-cap, one server warning).
//   - values go through the same sanitizeRecord as the page (js/analytics.js): allowlisted fields, short safe tokens,
//     anything that looks like a phone / e-mail / URL dropped.
// The dashboard reads the file through the normal static route: /_local/events.jsonl (never deploy _local/ publicly).
//
// Standalone (serve.mjs + a sink on another file / port, for tests):
//     node tools/events-sink.mjs [--port 8851] [--host 127.0.0.1] [--file _local/events.jsonl]
import { createServer } from 'node:http';
import { appendFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECORD_FIELDS, sanitizeRecord as sanitizeShared } from '../js/analytics.js';

const PLATFORM = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const SINK_PATH = '/api/events';
export const DEFAULT_FILE = resolve(PLATFORM, '_local/events.jsonl');
export const LIMITS = {
  maxBody: 16 * 1024,               // bytes per request
  maxEvents: 50,                    // events per request
  ratePerMin: 60,                   // events per client IP per minute (token bucket, burst = ratePerMin)
  maxFileBytes: 50 * 1024 * 1024,   // the JSONL stops growing here
};

// Same allowlist as analytics.js RECORD_FIELDS (server-side defence: a forged POST cannot add fields).
export const SINK_FIELDS = RECORD_FIELDS;

// the page's rules, applied again on the server
export function sanitizeRecord(r) { return sanitizeShared(r); }

export function parseBody(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (t.startsWith('[')) { try { const a = JSON.parse(t); return Array.isArray(a) ? a : []; } catch { return []; } }
  const out = [];
  for (const line of t.split(/\r?\n/)) { if (!line.trim()) continue; try { out.push(JSON.parse(line)); } catch { /* skip bad line */ } }
  return out;
}

// Origin must exist and name this server (scheme-agnostic host:port match against the Host header).
export function sameOrigin(req, allowed = []) {
  const origin = req.headers.origin;
  if (!origin || origin === 'null') return false;
  if (allowed.includes(origin)) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function tokenBucket(ratePerMin) {
  const buckets = new Map();
  const perMs = ratePerMin / 60000;
  return (key, want, now = Date.now()) => {
    let b = buckets.get(key);
    if (!b) { b = { tokens: ratePerMin, t: now }; buckets.set(key, b); }
    b.tokens = Math.min(ratePerMin, b.tokens + (now - b.t) * perMs);
    b.t = now;
    const take = Math.max(0, Math.min(want, Math.floor(b.tokens)));
    b.tokens -= take;
    if (buckets.size > 10000) { for (const [k, v] of buckets) if (now - v.t > 120000) buckets.delete(k); }
    return take;
  };
}

export function createEventsSink({
  file = DEFAULT_FILE, path = SINK_PATH, announce = true, origins = [],
  maxBody = LIMITS.maxBody, maxEvents = LIMITS.maxEvents, ratePerMin = LIMITS.ratePerMin, maxFileBytes = LIMITS.maxFileBytes,
} = {}) {
  const target = isAbsolute(file) ? file : resolve(PLATFORM, file);
  const bucket = tokenBucket(ratePerMin);
  let chain = Promise.resolve();
  let ready = null;
  let size = null;
  let warned = false;
  const write = (lines) => {
    chain = chain.then(async () => {
      if (!ready) ready = mkdir(dirname(target), { recursive: true });
      await ready;
      await appendFile(target, lines, 'utf8');
    });
    return chain;
  };
  const fileSize = async () => {
    if (size === null) { try { size = (await stat(target)).size; } catch { size = 0; } }
    return size;
  };

  const sink = async function eventsSink(req, res) {
    const url = (req.url || '/').split('?')[0];
    if (url !== path) {
      if (announce && !res.headersSent) res.setHeader('Server-Timing', `habait-sink;desc="${path}"`);
      return false;
    }
    if (req.method === 'OPTIONS') { res.writeHead(204, { Allow: 'POST' }); res.end(); return true; }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return true; }
    if (!sameOrigin(req, origins)) { req.resume(); res.writeHead(403); res.end('origin'); return true; }
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > maxBody) { req.resume(); res.writeHead(413, { Connection: 'close' }); res.end(); return true; }
    let got = 0;
    const chunks = [];
    let tooBig = false;
    await new Promise((ok, fail) => {
      req.on('data', (c) => { got += c.length; if (got > maxBody) tooBig = true; else chunks.push(c); });
      req.on('end', ok);
      req.on('error', fail);
    });
    if (tooBig) { res.writeHead(413); res.end(); return true; }
    const parsed = parseBody(Buffer.concat(chunks).toString('utf8'));
    if (parsed.length > maxEvents) { res.writeHead(413); res.end('too many events'); return true; }
    let recs = parsed.map(sanitizeRecord).filter(Boolean);
    const headers = {};
    const ip = req.socket?.remoteAddress || 'unknown';
    const allowed = bucket(ip, recs.length);
    if (allowed < recs.length) { headers['X-Habait-Dropped'] = 'rate'; recs = recs.slice(0, allowed); }
    if (recs.length) {
      const received = new Date().toISOString();
      const text = recs.map((r) => JSON.stringify({ ...r, received })).join('\n') + '\n';
      const bytes = Buffer.byteLength(text);
      if ((await fileSize()) + bytes > maxFileBytes) {
        headers['X-Habait-Dropped'] = 'file-cap';
        if (!warned) { warned = true; console.warn(`[events-sink] ${target} reached ${maxFileBytes} bytes; new events are dropped (rotate the file by hand)`); }
        recs = [];
      } else {
        size += bytes;
        await write(text);
      }
    }
    res.writeHead(204, { ...headers, 'X-Habait-Events': String(recs.length) });
    res.end();
    return true;
  };
  sink.file = target;
  sink.flushed = () => chain;
  return sink;
}

export const eventsSink = createEventsSink();

// serve.mjs + its own sink on one port (tests; a sink with another file or other limits)
export async function startWithSink({ port = 8851, host = '127.0.0.1', file = DEFAULT_FILE, ...limits } = {}) {
  const { handle } = await import('../serve.mjs');
  const sink = createEventsSink({ file, ...limits });
  const server = createServer((req, res) => {
    (async () => { if (await sink(req, res)) return; await handle(req, res); })().catch((err) => {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end('server error');
    });
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, host, ok); });
  server.sink = sink;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
  const s = await startWithSink({ port: Number(arg('--port', process.env.PORT || 8851)), host: arg('--host', '127.0.0.1'), file: arg('--file', DEFAULT_FILE) });
  const { port } = s.address();
  console.log(`habait platform + events sink  http://127.0.0.1:${port}/   events -> ${s.sink.file}`);
}
