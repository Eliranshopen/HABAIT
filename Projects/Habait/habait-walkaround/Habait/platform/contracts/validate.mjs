#!/usr/bin/env node
// Validates a project folder (units.json + flow.json + project.json) against the v0 contracts
// and cross-checks the references between them. No dependencies: a small JSON-Schema subset
// (type, required, properties, additionalProperties, enum, min/max, pattern, items, $ref to #/$defs, oneOf).
//   node contracts/validate.mjs fixtures/rainbow
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const loadJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

export const unitsSchema = loadJSON(join(here, 'units.schema.json'));
export const flowSchema = loadJSON(join(here, 'flow.schema.json'));
// card 24: project.json (open schema; only the optional analytics block is strict)
export const projectSchema = loadJSON(join(here, 'project.schema.json'));

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

export function validateSchema(schema, data, root = schema, path = '$', errors = []) {
  if (schema.$ref) {
    const ref = schema.$ref;
    if (!ref.startsWith('#/')) { errors.push(`${path}: unsupported $ref ${ref}`); return errors; }
    const target = ref.slice(2).split('/').reduce((o, k) => (o ? o[k] : undefined), root);
    if (!target) { errors.push(`${path}: dangling $ref ${ref}`); return errors; }
    return validateSchema(target, data, root, path, errors);
  }
  if (schema.oneOf) {
    const ok = schema.oneOf.filter((s) => validateSchema(s, data, root, path, []).length === 0).length;
    if (ok !== 1) errors.push(`${path}: matches ${ok} of oneOf, expected exactly 1`);
    return errors;
  }
  if (schema.type) {
    const t = typeOf(data);
    const want = [].concat(schema.type);
    const okType = want.some((w) => (w === 'integer' ? Number.isInteger(data) : w === 'number' ? typeof data === 'number' && Number.isFinite(data) : t === w));
    if (!okType) { errors.push(`${path}: expected ${want.join('|')}, got ${t}`); return errors; }
  }
  if (schema.enum && !schema.enum.includes(data)) errors.push(`${path}: ${JSON.stringify(data)} not in ${JSON.stringify(schema.enum)}`);
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) errors.push(`${path}: ${data} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) errors.push(`${path}: ${data} > maximum ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) errors.push(`${path}: ${data} <= exclusiveMinimum ${schema.exclusiveMinimum}`);
  }
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errors.push(`${path}: "${data}" does not match /${schema.pattern}/`);
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) data.forEach((v, i) => validateSchema(schema.items, v, root, `${path}[${i}]`, errors));
  }
  if (typeOf(data) === 'object') {
    for (const k of schema.required || []) if (!(k in data)) errors.push(`${path}: missing required "${k}"`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(data)) {
      if (props[k]) validateSchema(props[k], v, root, `${path}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}: unexpected property "${k}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateSchema(schema.additionalProperties, v, root, `${path}.${k}`, errors);
    }
  }
  return errors;
}

// Cross-checks: every reference resolves, every src file exists, the story is well formed.
export function crossCheck({ units, flow, project, dir }) {
  const errors = [];
  const warnings = [];
  const segById = new Map(flow.segments.map((s) => [s.id, s]));
  if (units.project !== flow.project) errors.push(`units.project "${units.project}" != flow.project "${flow.project}"`);
  if (project && project.id !== flow.project) errors.push(`project.json id "${project.id}" != flow.project "${flow.project}"`);
  if (!segById.has(flow.start)) errors.push(`flow.start "${flow.start}" is not a segment`);
  const ids = new Set();
  for (const s of flow.segments) {
    if (ids.has(s.id)) errors.push(`duplicate segment id "${s.id}"`);
    ids.add(s.id);
    if (typeof s.next === 'string' && !['handoff', 'end'].includes(s.next) && !segById.has(s.next)) errors.push(`segment "${s.id}".next -> unknown "${s.next}"`);
    if (s.next === null && !s.loop) warnings.push(`segment "${s.id}" has next=null but loop=false: the flight will freeze on its last frame`);
    if (dir) {
      if (!existsSync(join(dir, s.src))) errors.push(`segment "${s.id}".src not found: ${s.src}`);
      if (s.poster && !existsSync(join(dir, s.poster))) errors.push(`segment "${s.id}".poster not found: ${s.poster}`);
    }
    if (s.kind === 'video' && !/\.(mp4|webm|m3u8)$/i.test(s.src)) warnings.push(`segment "${s.id}" is video but src is ${s.src}`);
    if (s.kind === 'still' && !/\.(png|jpe?g|webp|avif)$/i.test(s.src)) warnings.push(`segment "${s.id}" is still but src is ${s.src}`);
    for (const h of s.hotspots || []) {
      if (h.t_end < h.t_start) errors.push(`segment "${s.id}" hotspot "${h.id}": t_end < t_start`);
      if (h.t_end > s.duration_s + 1e-6) warnings.push(`segment "${s.id}" hotspot "${h.id}": t_end ${h.t_end} > duration ${s.duration_s}`);
      if (h.action.type === 'goto' && !segById.has(h.action.segment)) errors.push(`segment "${s.id}" hotspot "${h.id}": goto unknown "${h.action.segment}"`);
    }
  }
  for (const d of ['descend', 'enter']) if (flow.defaults?.[d] && !segById.has(flow.defaults[d])) errors.push(`flow.defaults.${d} -> unknown "${flow.defaults[d]}"`);
  const unitIds = new Set();
  const holdSegs = flow.segments.filter((s) => s.role === 'hold').map((s) => s.id);
  for (const u of units.units) {
    if (unitIds.has(u.id)) errors.push(`duplicate unit id "${u.id}"`);
    unitIds.add(u.id);
    const descend = u.segments?.descend || `descend-${u.id}`;
    const enter = u.segments?.enter || `enter-${u.id}`;
    if (!segById.has(descend) && !flow.defaults?.descend) errors.push(`unit "${u.id}": no segment "${descend}" and no flow.defaults.descend`);
    if (!segById.has(enter) && !flow.defaults?.enter) errors.push(`unit "${u.id}": no segment "${enter}" and no flow.defaults.enter`);
    if (!segById.has(descend) && flow.defaults?.descend) warnings.push(`unit "${u.id}" uses the placeholder descend "${flow.defaults.descend}"`);
    if (u.hotspots.length === 0) warnings.push(`unit "${u.id}" has no hotspots: it cannot be chosen from the flight`);
    for (const h of u.hotspots) {
      if (!segById.has(h.segment)) errors.push(`unit "${u.id}" hotspot -> unknown segment "${h.segment}"`);
      else if (h.t_end > segById.get(h.segment).duration_s + 1e-6) warnings.push(`unit "${u.id}" hotspot on "${h.segment}": t_end ${h.t_end} > duration ${segById.get(h.segment).duration_s}`);
      if (h.t_end < h.t_start) errors.push(`unit "${u.id}" hotspot on "${h.segment}": t_end < t_start`);
    }
    if (holdSegs.length && !u.hotspots.some((h) => holdSegs.includes(h.segment))) warnings.push(`unit "${u.id}" is not clickable on any hold segment (${holdSegs.join(', ')})`);
    if (!/^https?:\/\//.test(u.tour_url)) warnings.push(`unit "${u.id}".tour_url is not absolute: ${u.tour_url}`);
  }
  for (const s of flow.segments) if (s.unit && !unitIds.has(s.unit)) errors.push(`segment "${s.id}".unit -> unknown unit "${s.unit}"`);
  return { errors, warnings };
}

export function validateProjectDir(dir) {
  dir = resolve(dir);
  const units = loadJSON(join(dir, 'units.json'));
  const flow = loadJSON(join(dir, 'flow.json'));
  const project = existsSync(join(dir, 'project.json')) ? loadJSON(join(dir, 'project.json')) : null;
  const errors = [
    ...validateSchema(unitsSchema, units).map((e) => `units.json ${e}`),
    ...validateSchema(flowSchema, flow).map((e) => `flow.json ${e}`),
    ...(project ? validateSchema(projectSchema, project).map((e) => `project.json ${e}`) : []),
  ];
  let warnings = [];
  if (errors.length === 0) {
    const x = crossCheck({ units, flow, project, dir });
    errors.push(...x.errors);
    warnings = x.warnings;
  }
  return { errors, warnings, units, flow, project };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node contracts/validate.mjs <project dir>'); process.exit(2); }
  const { errors, warnings, units, flow } = validateProjectDir(dir);
  for (const w of warnings) console.log('warn  ' + w);
  for (const e of errors) console.log('ERROR ' + e);
  if (errors.length) { console.log(`\n${dir}: ${errors.length} error(s)`); process.exit(1); }
  console.log(`${dir}: OK - ${units.units.length} units, ${flow.segments.length} segments, ${warnings.length} warning(s)`);
}
