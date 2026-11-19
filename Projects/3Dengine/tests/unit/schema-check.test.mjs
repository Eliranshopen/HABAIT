import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, assertSupported, formatErrors } from '../../mcp/schema-check.mjs';

const S = {
  type: 'object',
  required: ['id', 'n'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: '^[a-f]{2}$', minLength: 2, maxLength: 2 },
    n: { type: 'integer', minimum: 1, maximum: 3 },
    x: { type: 'number' },
    tag: { enum: ['a', 'b'] },
    k: { const: 'habait' },
    opt: { type: ['object', 'null'], required: ['a'], properties: { a: { type: 'boolean' } } },
    list: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
    free: { type: 'object', additionalProperties: { type: 'integer' } },
  },
};

test('a valid value has no errors', () => {
  assert.deepEqual(validate(S, { id: 'ab', n: 2, x: 1.5, tag: 'a', k: 'habait', opt: null, list: ['q'], free: { a: 1 } }), []);
  assert.deepEqual(validate(S, { id: 'ab', n: 1, x: 3, opt: { a: true } }), [], 'an integer is a number');
  assert.deepEqual(validate(true, 1), []);
  assert.deepEqual(validate(undefined, 1), []);
});

test('every keyword reports its error with a path', () => {
  const cases = [
    [{ id: 'ab' }, /missing required "n"/],
    [{ id: 'ab', n: 2, extra: 1 }, /unexpected property "extra"/],
    [{ id: 'zz', n: 2 }, /\$\.id: does not match/],
    [{ id: 'a', n: 2 }, /shorter than 2/],
    [{ id: 'abc', n: 2 }, /longer than 2/],
    [{ id: 'ab', n: 0 }, /below 1/],
    [{ id: 'ab', n: 4 }, /above 3/],
    [{ id: 'ab', n: 1.5 }, /expected integer, got number/],
    [{ id: 'ab', n: 1, tag: 'c' }, /must be one of a, b/],
    [{ id: 'ab', n: 1, k: 'x' }, /must be "habait"/],
    [{ id: 'ab', n: 1, opt: {} }, /\$\.opt: missing required "a"/],
    [{ id: 'ab', n: 1, opt: 3 }, /expected object or null/],
    [{ id: 'ab', n: 1, list: [] }, /fewer than 1 items/],
    [{ id: 'ab', n: 1, list: ['a', 'b', 'c'] }, /more than 2 items/],
    [{ id: 'ab', n: 1, list: [1] }, /\$\.list\[0\]: expected string/],
    [{ id: 'ab', n: 1, free: { a: 'x' } }, /\$\.free\.a: expected integer/],
    [[], /expected object, got array/],
    [null, /expected object, got null/],
  ];
  for (const [value, re] of cases) assert.match(formatErrors(validate(S, value)), re, JSON.stringify(value));
  assert.deepEqual(validate(false, 1), [{ path: '$', message: 'no value is allowed here' }]);
});

test('assertSupported accepts the subset and annotations, refuses anything else', () => {
  assert.doesNotThrow(() => assertSupported({ ...S, $schema: 'x', title: 't', description: 'd' }));
  assert.doesNotThrow(() => assertSupported(true));
  assert.throws(() => assertSupported({ type: 'object', properties: { a: { oneOf: [] } } }), /oneOf at \$\.properties\.a/);
  assert.throws(() => assertSupported({ type: 'array', items: { $ref: '#' } }), /\$ref at \$\.items/);
  assert.throws(() => assertSupported({ additionalProperties: { anyOf: [] } }), /anyOf/);
});
