// The readiness command: is everything the engine needs on this machine, and true?
// Keys are checked by NAME only: no value is ever returned, logged or stored.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pipelineEnv } from './config.mjs';
import { run as runProcess } from './lib/run.mjs';
import { sha256File } from './lib/hash.mjs';
import { listFiles as listFilesDefault } from './lib/files.mjs';
import { parseLock, normalizeName } from './lib/lock.mjs';
import { readJson } from './lib/json.mjs';

export const MIN_NODE = [22, 8];
export const PARITY_RE = /parity: (\d+) rows · PASS/;

// Names in <envRoot>/.env that carry a non-empty value. Returns names only.
export function readEnvNames(envRoot, { exists = fs.existsSync, readFile = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  const names = new Set();
  const file = `${envRoot}/.env`;
  if (!exists(file)) return names;
  for (const line of String(readFile(file)).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2].replace(/^["']|["']$/g, '') !== '') names.add(m[1]);
  }
  return names;
}

// The installed version of a Node library, resolved the way the pipeline resolves it.
export function resolveNodeLib(appDepsDir, name) {
  const req = createRequire(`${appDepsDir}/package.json`);
  let dir = path.dirname(req.resolve(name));
  for (;;) {
    const pj = path.join(dir, 'package.json');
    if (fs.existsSync(pj)) {
      const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
      if (j.name === name) return j.version;
    }
    const up = path.dirname(dir);
    if (up === dir) throw new Error(`${name}: package.json not found`);
    dir = up;
  }
}

function withDefaults(deps) {
  return {
    run: runProcess,
    exists: fs.existsSync,
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    env: process.env,
    hashFile: sha256File,
    listFiles: listFilesDefault,
    nodeVersion: process.versions.node,
    readEnvNames,
    resolveNodeLib,
    ...deps,
  };
}

const check = (id, kind, label, ok, detail) => ({ id, kind, label, ok: Boolean(ok), detail: String(detail) });

export function checkNode(config, d) {
  const [maj, min] = String(d.nodeVersion).replace(/^v/, '').split('.').map(Number);
  const ok = maj > MIN_NODE[0] || (maj === MIN_NODE[0] && min >= MIN_NODE[1]);
  return check('node', 'runtime', 'Node.js', ok, `v${String(d.nodeVersion).replace(/^v/, '')}${ok ? '' : ` < ${MIN_NODE.join('.')}`}`);
}

export function pythonSnippet(modules, dists) {
  return [
    'import json, importlib, importlib.metadata as md',
    `mods = ${JSON.stringify(modules)}`,
    `dists = ${JSON.stringify(dists)}`,
    'bad = []',
    'for m in mods:',
    '    try: importlib.import_module(m)',
    '    except Exception as e: bad.append(m + ": " + type(e).__name__)',
    'ver = {}',
    'for d in dists:',
    '    try: ver[d] = md.version(d)',
    '    except Exception: ver[d] = None',
    'print(json.dumps({"import_errors": bad, "versions": ver}))',
  ].join('\n');
}

export function checkPython(config, d) {
  const id = 'python';
  const label = 'Python environment';
  if (!d.exists(config.python)) return check(id, 'runtime', label, false, `not found: ${config.python}`);
  const pins = parseLock(d.readFile(config.requirements));
  const snippet = pythonSnippet(Object.keys(config.pythonLibs), pins.map((p) => p.dist));
  const r = d.run(config.python, ['-c', snippet], { timeoutMs: 120000 });
  if (r.status !== 0) return check(id, 'runtime', label, false, `probe exit ${r.status}: ${lastLine(r.stderr)}`);
  let out;
  try {
    out = JSON.parse(lastLine(r.stdout));
  } catch {
    return check(id, 'runtime', label, false, 'probe printed no JSON');
  }
  const installed = {};
  for (const [k, v] of Object.entries(out.versions || {})) installed[normalizeName(k)] = v;
  const problems = [...(out.import_errors || []).map((e) => `import ${e}`)];
  for (const p of pins) {
    const got = installed[p.name];
    if (got !== p.version) problems.push(`${p.name} ${got ?? 'absent'} != ${p.version}`);
  }
  const good = pins.length - problems.filter((x) => !x.startsWith('import ')).length;
  return check(id, 'runtime', label, problems.length === 0,
    problems.length ? problems.join('; ') : `${good}/${pins.length} pinned`);
}

export function checkNodeLibs(config, d) {
  const id = 'node-libs';
  const label = 'Node libraries';
  let lock;
  try {
    lock = readJson(`${config.appDepsDir}/package-lock.json`, d.readFile);
  } catch (e) {
    return check(id, 'runtime', label, false, `package-lock.json: ${e.message}`);
  }
  const parts = [];
  let ok = true;
  for (const name of config.nodeLibs) {
    const want = lock.packages?.[`node_modules/${name}`]?.version;
    let got;
    try {
      got = d.resolveNodeLib(config.appDepsDir, name);
    } catch {
      got = null;
    }
    if (!want || got !== want) {
      ok = false;
      parts.push(`${name} ${got ?? 'not resolvable'} != ${want ?? 'not locked'}`);
    } else parts.push(`${name} ${got}`);
  }
  return check(id, 'runtime', label, ok, parts.join(', '));
}

export function checkBlender(config, d) {
  const label = 'Blender';
  if (!d.exists(config.blender)) return check('blender', 'runtime', label, false, `not found: ${config.blender}`);
  const r = d.run(config.blender, ['--version'], { timeoutMs: 60000 });
  const first = firstLine(r.stdout);
  const ok = r.status === 0 && first.includes(config.blenderVersion);
  return check('blender', 'runtime', label, ok, ok ? first : `want ${config.blenderVersion}, got "${first || lastLine(r.stderr)}"`);
}

export function checkFile(id, kind, label, file, d) {
  const ok = d.exists(file);
  return check(id, kind, label, ok, ok ? file : `not found: ${file}`);
}

export function checkPipeline(config, d) {
  const tool = `${config.pipelineRoot}/Habait/tour360/tools/run-project.mjs`;
  const r = d.run(process.execPath, [tool, '--parity'], {
    cwd: config.pipelineRoot,
    env: { ...d.env, ...pipelineEnv(config) },
    timeoutMs: 120000,
  });
  const line = String(r.stdout).split(/\r?\n/).find((l) => PARITY_RE.test(l));
  const ok = r.status === 0 && Boolean(line);
  return check('pipeline', 'pipeline', 'Pipeline registry parity', ok,
    line ? line.trim() : `exit ${r.status}: ${lastLine(r.stderr) || lastLine(r.stdout)}`);
}

// A sealed row is present when some file under <catalogModels>/<id>/ carries its sha256.
export async function rowPresent(dir, sha256, d) {
  for (const f of d.listFiles(dir)) if ((await d.hashFile(f)) === sha256) return true;
  return false;
}

export async function checkCatalog(config, d) {
  const manifest = readJson(config.assets.catalogManifest, d.readFile);
  const rows = (manifest.assets || []).filter((r) => r.sha256);
  const missing = [];
  for (const row of rows) {
    if (!(await rowPresent(`${config.assets.catalogModels}/${row.id}`, row.sha256, d))) missing.push(row.id);
  }
  const ok = rows.length > 0 && missing.length === 0;
  const head = `${rows.length - missing.length}/${rows.length}`;
  return check('assets-catalog', 'assets', 'Catalog models (sealed sha256)', ok,
    missing.length ? `${head}; missing or mismatched: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}` : head);
}

// The sources whose rows come out of a pack zip that must be cached, by sha256.
export function packSources(manifest) {
  return (Array.isArray(manifest.sources) ? manifest.sources : []).filter((s) => s.pack_zip_sha256);
}

export async function checkPacks(config, d) {
  const packs = packSources(readJson(config.assets.catalogManifest, d.readFile));
  const bad = [];
  for (const s of packs) {
    const zip = `${config.assets.packCache}/${s.id}.zip`;
    if (!d.exists(zip)) bad.push(`${s.id}: not found`);
    else if ((await d.hashFile(zip)) !== s.pack_zip_sha256) bad.push(`${s.id}: sha256 mismatch`);
  }
  const head = `${packs.length - bad.length}/${packs.length}`;
  return check('assets-packs', 'assets', 'Catalog pack zips (sealed sha256)', bad.length === 0,
    bad.length ? `${head}; ${bad.join(', ')}` : head);
}

export async function checkHdri(config, d) {
  const style = readJson(config.assets.styleFile, d.readFile);
  const hdri = style.surfaces?.hdri;
  if (!hdri?.file || !hdri?.sha256) return check('assets-hdri', 'assets', 'HDRI', false, 'style file has no surfaces.hdri file/sha256');
  const file = `${config.assets.hdriBase}/${hdri.file}`;
  if (!d.exists(file)) return check('assets-hdri', 'assets', 'HDRI', false, `not found: ${file}`);
  const got = await d.hashFile(file);
  return check('assets-hdri', 'assets', 'HDRI', got === hdri.sha256, got === hdri.sha256 ? `${hdri.file} sha256 OK` : `${hdri.file} sha256 mismatch`);
}

export function checkKeys(config, d) {
  let fileNames = new Set();
  try {
    fileNames = d.readEnvNames(config.envRoot);
  } catch {
    fileNames = new Set();
  }
  const pairs = config.keys.map((name) => {
    const present = (typeof d.env[name] === 'string' && d.env[name] !== '') || fileNames.has(name);
    return { name, present };
  });
  return {
    ...check('keys', 'keys', 'Provider keys (by name)', pairs.every((p) => p.present),
      pairs.map((p) => `${p.name}: ${p.present ? 'present' : 'missing'}`).join(', ')),
    missing: pairs.filter((p) => !p.present).map((p) => p.name),
  };
}

async function guarded(id, kind, label, fn) {
  try {
    return await fn();
  } catch (e) {
    return check(id, kind, label, false, `error: ${e.message}`);
  }
}

export async function runDoctor(config, deps = {}) {
  const d = withDefaults(deps);
  const checks = [
    await guarded('node', 'runtime', 'Node.js', () => checkNode(config, d)),
    await guarded('python', 'runtime', 'Python environment', () => checkPython(config, d)),
    await guarded('node-libs', 'runtime', 'Node libraries', () => checkNodeLibs(config, d)),
    await guarded('blender', 'runtime', 'Blender', () => checkBlender(config, d)),
    await guarded('chrome', 'runtime', 'Chrome', () => checkFile('chrome', 'runtime', 'Chrome', config.chrome, d)),
    await guarded('legal', 'runtime', 'Legal disclaimer', () =>
      checkFile('legal', 'runtime', 'Legal disclaimer', `${config.legalDir}/disclaimer-he-en.md`, d)),
    await guarded('pipeline', 'pipeline', 'Pipeline registry parity', () => checkPipeline(config, d)),
    await guarded('assets-catalog', 'assets', 'Catalog models (sealed sha256)', () => checkCatalog(config, d)),
    await guarded('assets-packs', 'assets', 'Catalog pack zips (sealed sha256)', () => checkPacks(config, d)),
    await guarded('assets-hdri', 'assets', 'HDRI', () => checkHdri(config, d)),
    await guarded('keys', 'keys', 'Provider keys (by name)', () => checkKeys(config, d)),
  ];
  const ready = checks.every((c) => c.ok);
  const readyExceptKeys = checks.filter((c) => c.kind !== 'keys').every((c) => c.ok);
  return { at: new Date().toISOString(), ready, ready_except_keys: readyExceptKeys, checks };
}

export function formatReport(result) {
  const lines = result.checks.map((c) => {
    const status = c.ok ? 'ok' : c.kind === 'keys' ? 'MISSING' : 'FAIL';
    return `${status.padEnd(8)}${c.id.padEnd(16)}${c.detail}`;
  });
  if (result.ready) lines.push('READY');
  else if (result.ready_except_keys) {
    const keys = result.checks.find((c) => c.kind === 'keys');
    const names = keys?.missing?.length ? keys.missing : [];
    lines.push(`READY EXCEPT KEYS (${names.join(', ')})`);
  } else lines.push('NOT READY');
  return lines.join('\n');
}

function lastLine(s) {
  const l = String(s || '').trim().split(/\r?\n/);
  return l[l.length - 1] || '';
}

function firstLine(s) {
  return String(s || '').trim().split(/\r?\n/)[0] || '';
}
