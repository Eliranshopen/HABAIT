import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTools, loadJobSchema, inlineRefs, TOOL_NAMES, TOOL_META, CONTRACTS } from '../../mcp/tools.mjs';
import { assertSupported } from '../../mcp/schema-check.mjs';

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, CONTRACTS), 'utf8'));
const strip = ({ $schema, $id, ...rest }) => rest;

test('exactly the eight tools of the contract, each with title, description, both schemas, annotations', () => {
  assert.deepEqual([...TOOL_NAMES], ['engine_status', 'inspect_plan', 'start_simulation', 'get_job', 'approve_paid_stage',
    'get_result', 'cancel_job', 'list_jobs']);
  const tools = loadTools();
  assert.equal(tools.length, 8);
  for (const t of tools) {
    assert.deepEqual(Object.keys(t), ['name', 'title', 'description', 'inputSchema', 'outputSchema', 'annotations']);
    assert.match(t.description, /stub/i);
    assert.match(t.description, /שחזור הדגמה/);
    assert.equal(t.annotations.openWorldHint, false);
    assert.equal(t.inputSchema.type, 'object');
    assert.equal(t.outputSchema.type, 'object');
    assert.ok(!JSON.stringify(t).includes('$ref'), `${t.name} has no $ref left`);
    assert.ok(!('$schema' in t.inputSchema) && !('$schema' in t.outputSchema));
  }
});

test('tools/list schemas are the contract files, with the Job inlined', () => {
  const job = strip(loadJobSchema());
  for (const t of loadTools()) {
    assert.deepEqual(t.inputSchema, strip(inlineRefs(read(`tools/${t.name}.input.schema.json`), job)));
    assert.deepEqual(t.outputSchema, strip(inlineRefs(read(`tools/${t.name}.output.schema.json`), job)));
  }
  const files = fs.readdirSync(new URL('tools/', CONTRACTS)).filter((f) => f.endsWith('.schema.json'));
  assert.equal(files.length, 16);
});

test('every contract schema uses only the keywords the checker implements', () => {
  assertSupported(loadJobSchema());
  for (const t of loadTools()) {
    assertSupported(t.inputSchema);
    assertSupported(t.outputSchema);
  }
});

test('read-only tools are marked read-only; approve and cancel are not; cancel is destructive', () => {
  const a = Object.fromEntries(TOOL_META.map((t) => [t.name, t.annotations]));
  for (const n of ['engine_status', 'inspect_plan', 'get_job', 'get_result', 'list_jobs']) assert.equal(a[n].readOnlyHint, true, n);
  for (const n of ['start_simulation', 'approve_paid_stage', 'cancel_job']) assert.equal(a[n].readOnlyHint, false, n);
  assert.equal(a.cancel_job.destructiveHint, true);
});

test('inlineRefs refuses any other $ref', () => {
  assert.throws(() => inlineRefs({ a: [{ $ref: 'other.json' }] }, {}), /unsupported \$ref: other\.json/);
  assert.deepEqual(inlineRefs({ a: [{ $ref: '../job.schema.json' }, 1] }, { type: 'object' }), { a: [{ type: 'object' }, 1] });
});
