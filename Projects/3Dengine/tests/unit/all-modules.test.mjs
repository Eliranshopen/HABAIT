// Imports every engine and MCP module so that no file is missing from the coverage table, and proves
// that importing one has no side effects (the server and the runner run their main only when executed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { listFiles } from '../../engine/lib/files.mjs';

const ENGINE = fileURLToPath(new URL('../../engine', import.meta.url));
const MCP = fileURLToPath(new URL('../../mcp', import.meta.url));

test('every engine/**/*.mjs and mcp/**/*.mjs imports cleanly', async () => {
  const files = [...listFiles(ENGINE), ...listFiles(MCP)].filter((f) => f.endsWith('.mjs'));
  assert.ok(files.length >= 20, `found ${files.length} modules`);
  assert.ok(files.some((f) => f.endsWith('mcp/server.mjs')) && files.some((f) => f.endsWith('engine/runner.mjs')));
  const writes = [];
  const orig = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) {
    writes.push(String(chunk));
    return orig.call(this, chunk, ...rest);
  };
  try {
    for (const f of files) {
      const mod = await import(pathToFileURL(f).href);
      assert.ok(Object.keys(mod).length > 0, `${f} exports something`);
    }
  } finally {
    process.stdout.write = orig;
  }
  assert.ok(!writes.some((w) => w.includes('"jsonrpc"')), 'no module started a server on import');
});
