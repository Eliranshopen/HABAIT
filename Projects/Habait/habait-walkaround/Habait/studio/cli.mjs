/* Habait Studio — cli.mjs: the same pipeline without the browser.
   node cli.mjs new  "<name>" [--address ..] [--latlon lat,lon] [--style id] [--fixture apt846] [--panos <dir>] [--file <path>]...
   node cli.mjs add  <id> <file>...                 copy files into the project's intake/
   node cli.mjs run  <id> [stage,stage,...] [--force] [--clay-res WxH] [--clay-samples N] [--max-frames N] [--engine CYCLES|EEVEE] [--shots a,b] [--resume]
   node cli.mjs show <id>                            state + ledger
   node cli.mjs list */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, describeEnv, REPO } from './lib/env.mjs';
import { ProjectStore } from './lib/projects.mjs';
import { runPipeline, STAGE_IDS } from './pipeline/index.mjs';

const env = loadEnv(); env.REPO = REPO;
const store = new ProjectStore(env.PROJECTS_DIR);
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; if (flags[k] === undefined) flags[k] = v; else flags[k] = [].concat(flags[k], v); }
  else pos.push(rest[i]);
}

if (cmd === 'list') { for (const p of store.list()) console.log(`${p.id}\t${p.name}\t${Object.entries(p.state.stages).map(([k, v]) => `${k}:${v.status}`).join(' ')}`); }
else if (cmd === 'new') {
  const meta = { name: pos[0], address: flags.address || '', developer: flags.developer || '', style: flags.style, notes: flags.notes || '', panos_dir: flags.panos || null, fixture: flags.fixture || null };
  if (flags.latlon) { const [lat, lon] = String(flags.latlon).split(',').map(Number); meta.latlon = { lat, lon }; }
  const p = store.create(meta);
  for (const f of [].concat(flags.file || [])) store.addFile(p.id, path.basename(f), fs.readFileSync(f));
  console.log(JSON.stringify({ id: p.id, dir: store.dir(p.id), files: store.files(p.id) }, null, 2));
} else if (cmd === 'add') { for (const f of pos.slice(1)) store.addFile(pos[0], path.basename(f), fs.readFileSync(f)); console.log(store.files(pos[0])); }
else if (cmd === 'show') { console.log(JSON.stringify({ meta: store.meta(pos[0]), state: store.state(pos[0]), ledger: store.ledger(pos[0]) }, null, 2)); }
else if (cmd === 'run') {
  const id = pos[0];
  if (!store.exists(id)) { console.error(`no project ${id}`); process.exit(2); }
  const stages = pos[1] ? pos[1].split(',') : STAGE_IDS;
  const patch = { options: {} };
  if (flags['clay-res'] || flags['clay-samples'] || flags['max-frames'] || flags.engine) patch.options.clay = { ...store.meta(id).options.clay, ...(flags['clay-res'] ? { res: flags['clay-res'] } : {}), ...(flags['clay-samples'] ? { samples: Number(flags['clay-samples']) } : {}), ...(flags['max-frames'] ? { max_frames: Number(flags['max-frames']) } : {}), ...(flags.engine ? { engine: flags.engine } : {}) };
  if (flags.shots) patch.options.clay = { ...(patch.options.clay || store.meta(id).options.clay), shots: String(flags.shots).split(',') };
  if (flags.resume) patch.options.clay = { ...(patch.options.clay || store.meta(id).options.clay), resume: true };
  if (Object.keys(patch.options).length) store.saveMeta(id, patch);
  console.log(`env: ${JSON.stringify(describeEnv(env))}`);
  const emit = (ev) => { if (ev.type === 'log') console.log(`[${ev.stage || '-'}] ${ev.line}`); else if (ev.type === 'stage') console.log(`== ${ev.stage}: ${ev.status}${ev.note ? ' — ' + ev.note : ''}`); };
  const results = await runPipeline(store, id, { stages, env, emit, force: Boolean(flags.force) });
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])), null, 0));
  process.exit(Object.values(results).some((r) => r.status === 'blocked') ? 1 : 0);
} else { console.log('usage: node cli.mjs list | new <name> [...] | add <id> <file>... | run <id> [stages] [--force] | show <id>'); }
