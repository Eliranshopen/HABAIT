// The habait-engine MCP server (contract 0.2 §1): JSON-RPC 2.0 over stdio, one JSON object per line.
// stdout carries protocol messages ONLY; every log line goes to stderr. Node built-ins only, no SDK.
// `node mcp/server.mjs` (or `node engine/cli.mjs mcp`) runs it; importing this module runs nothing.
import readline from 'node:readline';
import { loadConfig, ENGINE_VERSION } from '../engine/config.mjs';
import { isMain } from '../engine/lib/main.mjs';
import { EngineError } from '../engine/inbox.mjs';
import { loadTools } from './tools.mjs';
import { validate, formatErrors } from './schema-check.mjs';
import { createStubEngine } from './stub-engine.mjs';

export const SERVER_NAME = 'habait-engine';
export const PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
export const DEFAULT_PROTOCOL = '2025-06-18';

export const ERR = Object.freeze({ PARSE: -32700, INVALID_REQUEST: -32600, METHOD: -32601, PARAMS: -32602, INTERNAL: -32603 });

const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } });
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });

export function negotiateProtocol(requested) {
  return PROTOCOL_VERSIONS.includes(requested) ? requested : DEFAULT_PROTOCOL;
}

export function toolSuccess(result) {
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
}

export function toolFailure(code, message) {
  return { isError: true, content: [{ type: 'text', text: `${code}: ${message}` }], structuredContent: { error: { code, message } } };
}

// handlers: { <tool name>: (args) => result | Promise<result> }; a handler throws EngineError for a reason code.
export function createServer({ handlers, tools = loadTools(), version = ENGINE_VERSION, log = () => {} }) {
  const byName = new Map(tools.map((t) => [t.name, t]));

  async function callTool(id, params) {
    const name = params?.name;
    const tool = typeof name === 'string' ? byName.get(name) : undefined;
    if (!tool || !handlers[name]) return rpcError(id, ERR.PARAMS, `unknown tool: ${String(name)}`);
    const args = params.arguments ?? {};
    const errors = validate(tool.inputSchema, args);
    if (errors.length) return rpcError(id, ERR.PARAMS, `invalid arguments for ${name}: ${formatErrors(errors)}`, { errors });
    try {
      return rpcResult(id, toolSuccess(await handlers[name](args)));
    } catch (e) {
      if (e instanceof EngineError) return rpcResult(id, toolFailure(e.code, e.message));
      log(`tool ${name} failed: ${e.stack || e.message}`);
      // A Node file error's message carries a local path, which never goes to the client: the code alone does
      // (an errno name, Windows' UNKNOWN, or one of Node's ERR_FS_ codes).
      const what = typeof e?.code === 'string' && /^(E[A-Z0-9]+|UNKNOWN|ERR_FS_[A-Z0-9_]+)$/.test(e.code) ? `a file error of the engine (${e.code})` : e?.message;
      return rpcError(id, ERR.INTERNAL, `internal error in ${name}: ${what}`);
    }
  }

  // One parsed message in, one response object out (or null for a notification).
  async function handleMessage(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      const id = msg && typeof msg === 'object' && !Array.isArray(msg) && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null;
      // A response from the client (it carries result or error and no method) needs no answer.
      if (msg && typeof msg === 'object' && !Array.isArray(msg) && !('method' in msg) && ('result' in msg || 'error' in msg)) return null;
      return rpcError(id, ERR.INVALID_REQUEST, 'invalid request');
    }
    const isNotification = !('id' in msg);
    const { id, method, params } = msg;
    if (isNotification) return null;
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: negotiateProtocol(params?.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version },
        });
      case 'ping':
        return rpcResult(id, {});
      case 'tools/list':
        return rpcResult(id, { tools });
      case 'tools/call':
        return callTool(id, params);
      default:
        return rpcError(id, ERR.METHOD, `method not found: ${method}`);
    }
  }

  async function handleLine(line) {
    const text = String(line).trim();
    if (!text) return null;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return rpcError(null, ERR.PARSE, 'parse error');
    }
    return handleMessage(msg);
  }

  return { handleMessage, handleLine, tools };
}

// Run on streams until stdin ends. Resolves with an exit code once every pending answer is written.
export async function runStdio({
  config = loadConfig(), stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, engine,
} = {}) {
  const log = (m) => stderr.write(`[${SERVER_NAME}] ${m}\n`);
  const eng = engine || createStubEngine(config);
  eng.doctor?.kick?.();
  const server = createServer({ handlers: eng.handlers, log });
  const rl = readline.createInterface({ input: stdin, crlfDelay: Infinity });
  const pending = new Set();
  rl.on('line', (line) => {
    const p = server.handleLine(line).then((res) => {
      if (res) stdout.write(JSON.stringify(res) + '\n');
    }).catch((e) => log(`error: ${e.message}`)).finally(() => pending.delete(p));
    pending.add(p);
  });
  await new Promise((resolve) => rl.once('close', resolve));
  await Promise.all([...pending]);
  eng.doctor?.stop?.();
  log('stdin closed; exiting');
  return 0;
}

if (isMain(process.argv[1], import.meta.url)) {
  process.exitCode = await runStdio();
}
