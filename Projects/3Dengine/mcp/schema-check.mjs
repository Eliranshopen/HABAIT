// A small JSON Schema checker for the subset the engine's contracts use (draft 2020-12 keywords):
// type (one or a list), enum, const, properties, required, additionalProperties (false or a schema),
// items, minItems, maxItems, minimum, maximum, minLength, maxLength, pattern. Object keywords apply
// only to objects, array keywords only to arrays, and so on, as the standard says. Annotations
// (title, description, default, format, $schema, $id, $comment) are accepted and not checked.
// `assertSupported` refuses a schema that uses any other keyword, so this checker is never silently partial.

export const KEYWORDS = new Set(['type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'items',
  'minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern']);
export const ANNOTATIONS = new Set(['title', 'description', 'default', 'format', '$schema', '$id', '$comment', 'examples']);

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
};

const typeMatches = (v, t) => {
  const got = typeOf(v);
  return got === t || (t === 'number' && got === 'integer');
};

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Returns a list of { path, message }; empty = valid.
export function validate(schema, value, at = '$') {
  const errors = [];
  const err = (message, p = at) => errors.push({ path: p, message });
  if (schema === true || schema === undefined) return errors;
  if (schema === false) return [{ path: at, message: 'no value is allowed here' }];
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) {
      err(`expected ${types.join(' or ')}, got ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.const !== undefined && !equal(schema.const, value)) err(`must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => equal(e, value))) err(`must be one of ${schema.enum.join(', ')}`);
  const t = typeOf(value);
  if (t === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) err(`shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) err(`longer than ${schema.maxLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) err(`does not match ${schema.pattern}`);
  }
  if (t === 'number' || t === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) err(`below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) err(`above ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) err(`fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) err(`more than ${schema.maxItems} items`);
    if (schema.items !== undefined) value.forEach((v, i) => errors.push(...validate(schema.items, v, `${at}[${i}]`)));
  }
  if (t === 'object') {
    const props = schema.properties || {};
    for (const k of schema.required || []) if (!(k in value)) err(`missing required "${k}"`);
    for (const [k, v] of Object.entries(value)) {
      if (k in props) errors.push(...validate(props[k], v, `${at}.${k}`));
      else if (schema.additionalProperties === false) err(`unexpected property "${k}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validate(schema.additionalProperties, v, `${at}.${k}`));
      }
    }
  }
  return errors;
}

// Throws when a schema uses a keyword this checker does not implement.
export function assertSupported(schema, at = '$') {
  if (typeof schema === 'boolean') return;
  for (const k of Object.keys(schema)) {
    if (!KEYWORDS.has(k) && !ANNOTATIONS.has(k)) throw new Error(`schema keyword not supported: ${k} at ${at}`);
  }
  for (const [k, v] of Object.entries(schema.properties || {})) assertSupported(v, `${at}.properties.${k}`);
  if (schema.items !== undefined) assertSupported(schema.items, `${at}.items`);
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    assertSupported(schema.additionalProperties, `${at}.additionalProperties`);
  }
}

export const formatErrors = (errors) => errors.map((e) => `${e.path}: ${e.message}`).join('; ');
