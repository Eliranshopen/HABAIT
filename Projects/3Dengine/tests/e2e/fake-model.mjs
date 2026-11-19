// A scripted stand-in for a language model: a loopback HTTP server that speaks the OpenAI
// chat-completions streaming protocol (the `openai-completions` api of Pi's models.json).
// It decides by the LAST message of each request only, so the same conversation always gets the
// same answers. No model, no network beyond 127.0.0.1, no key (Pi sends the dummy "x").
import http from 'node:http';

const T = 'mcp__habait_engine__';
const PDF_RE = /The original PDF is saved on disk at: (\S+\.pdf)/;
const APPROVE_RE = /מאשר את השלב בתשלום לעבודה ([0-9a-f]{16}) עד \$(\d+(?:\.\d+)?)/;

const textOf = (content) => (typeof content === 'string' ? content
  : Array.isArray(content) ? content.filter((p) => p?.type === 'text').map((p) => p.text).join('\n') : '');

/** The tool name a `tool` message answers, found through its tool_call_id in the earlier assistant messages. */
function toolNameOf(messages, msg) {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const c of messages[i].tool_calls ?? []) if (c.id === msg.tool_call_id) return c.function?.name ?? null;
  }
  return null;
}

/** The PDF path given in the newest user message that carries one. */
function pdfPathOf(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue;
    const m = PDF_RE.exec(textOf(messages[i].content));
    if (m) return m[1];
  }
  return null;
}

/** The scripted decision: `{ tool, args }` or `{ text }`. Exported for a reader of the script. */
export function decide(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const tools = new Set((body?.tools ?? []).map((t) => t?.function?.name).filter(Boolean));
  const last = messages[messages.length - 1];
  if (!last || !tools.has(`${T}inspect_plan`)) return { text: 'בסדר.', why: 'no-engine-tools' };
  if (last.role === 'user') {
    const text = textOf(last.content);
    const a = APPROVE_RE.exec(text);
    if (a) return { tool: `${T}approve_paid_stage`, args: { job_id: a[1], cap_usd: Number(a[2]) }, why: 'approval-message' };
    const pdf = PDF_RE.exec(text);
    if (pdf) return { tool: `${T}inspect_plan`, args: { pdf_path: pdf[1] }, why: 'upload' };
    return { text: 'בסדר.', why: 'other-user-message' };
  }
  if (last.role === 'tool') {
    const name = toolNameOf(messages, last);
    if (name === `${T}inspect_plan`) {
      // `apartment` is left out: the fixture is one sheet with one drawing, and the engine takes the only
      // candidate (contract 1.1 §2). The stub's old id `apt846` is no candidate any more.
      return { tool: `${T}start_simulation`, args: { pdf_path: pdfPathOf(messages) }, why: 'after-inspect' };
    }
    if (name === `${T}start_simulation`) return { text: 'התחלתי הדמיה של דירה 846. כשתגיע הערכת העלות אבקש את אישורכם.', why: 'after-start' };
    if (name === `${T}approve_paid_stage`) return { text: 'קיבלתי. ההדמיה ממשיכה.', why: 'after-approve' };
    return { text: 'בסדר.', why: `after-${name}` };
  }
  return { text: 'בסדר.', why: 'fallback' };
}

function chunk(id, delta, finish = null) {
  return { id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'm',
    choices: [{ index: 0, delta, finish_reason: finish }] };
}

/** Start the fake model on 127.0.0.1:<port> (0 = any). Resolves `{ port, requests, close }`. */
export function startFakeModel(port = 0) {
  const requests = []; // one summary per request: { at, last_role, decision, tools }
  let n = 0;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (d) => { raw += d; });
    req.on('end', () => {
      if (req.method !== 'POST' || !/\/chat\/completions$/.test(req.url ?? '')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'not found' } }));
        return;
      }
      let body;
      try { body = JSON.parse(raw); } catch { body = {}; }
      const d = decide(body);
      const msgs = body.messages ?? [];
      requests.push({ at: new Date().toISOString(), last_role: msgs[msgs.length - 1]?.role ?? null,
        engine_tools: (body.tools ?? []).map((t) => t?.function?.name).filter((x) => x?.startsWith(T)).sort(),
        decision: d.tool ? { tool: d.tool, args: d.args, why: d.why } : { text: d.text, why: d.why } });
      const id = `chatcmpl-fake-${++n}`;
      const out = [];
      if (d.tool) {
        const callId = `call_${n}_${d.tool.slice(T.length)}`;
        out.push(chunk(id, { role: 'assistant', content: null, tool_calls: [{ index: 0, id: callId, type: 'function', function: { name: d.tool, arguments: '' } }] }));
        out.push(chunk(id, { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(d.args) } }] }));
        out.push(chunk(id, {}, 'tool_calls'));
      } else {
        out.push(chunk(id, { role: 'assistant', content: d.text }));
        out.push(chunk(id, {}, 'stop'));
      }
      out.push({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'm', choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
      if (body.stream === false) {
        // Not used by Pi; answered for completeness.
        res.writeHead(200, { 'content-type': 'application/json' });
        const message = d.tool
          ? { role: 'assistant', content: null, tool_calls: [{ id: `call_${n}`, type: 'function', function: { name: d.tool, arguments: JSON.stringify(d.args) } }] }
          : { role: 'assistant', content: d.text };
        res.end(JSON.stringify({ id, object: 'chat.completion', model: 'm', choices: [{ index: 0, message, finish_reason: d.tool ? 'tool_calls' : 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      for (const c of out) res.write(`data: ${JSON.stringify(c)}\n\n`);
      res.end('data: [DONE]\n\n');
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({
      port: server.address().port,
      requests,
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
    }));
  });
}
