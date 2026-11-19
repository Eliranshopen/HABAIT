// Shared fakes for the unit tests: a config object and an all-good doctor deps set.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toPosix } from '../../engine/lib/paths.mjs';

export const SECRET = 'sk-FAKE-VALUE-must-never-appear-0123456789';

export function fakeConfig(over = {}) {
  const h = 'C:/eng';
  return {
    home: h,
    pipelineRoot: `${h}/pipeline`,
    python: `${h}/.venv/Scripts/python.exe`,
    basePython: 'python',
    requirements: `${h}/requirements.lock.txt`,
    appDepsDir: `${h}/appdeps`,
    envRoot: h,
    blender: 'C:/B/blender.exe',
    blenderVersion: '4.5.10',
    blenderLock: 'C:/lock',
    chrome: 'C:/C/chrome.exe',
    legalDir: `${h}/house/legal`,
    jobsDir: `${h}/jobs`,
    runtimeDir: `${h}/.runtime`,
    assets: {
      source: 'C:/backup/360walkaround',
      catalogManifest: `${h}/pipeline/360walkaround/catalog/catalog.manifest.json`,
      catalogModels: `${h}/pipeline/360walkaround/catalog/models`,
      styleFile: `${h}/pipeline/360walkaround/catalog/style.json`,
      hdriBase: `${h}/pipeline/360walkaround`,
      packSource: 'C:/backup/packs',
      packCache: `${h}/pipeline/360walkaround/catalog/.cache`,
    },
    keys: ['FAL_KEY', 'OPENROUTER_API_KEY'],
    nodeLibs: ['sharp', 'playwright-core'],
    pythonLibs: { numpy: 'numpy', PIL: 'pillow' },
    serve: { host: '127.0.0.1', port: 8891 },
    trace: { timeoutSeconds: 1500, maxBudgetUsd: 1, judgeRuns: 3, rounds: 3 },
    readingsDir: `${h}/.runtime/readings`,
    ...over,
  };
}

export const LOCK_TEXT = '# pins\nnumpy==2.5.4\npillow==13.0.0\nlazy_loader==0.6\n';
export const PKG_LOCK = JSON.stringify({ packages: {
  'node_modules/sharp': { version: '0.34.4' }, 'node_modules/playwright-core': { version: '1.56.1' } } });
export const MANIFEST = JSON.stringify({
  sources: [{ id: 'free' }, { id: 'kit', pack_zip_sha256: 'h-kit' }],
  assets: [
  { id: 'a', sha256: 'h-a' }, { id: 'b', sha256: 'h-b' }, { id: 'nosha' }] });
export const STYLE = JSON.stringify({ surfaces: { hdri: { file: 'p/sky.hdr', sha256: 'h-sky' } } });

export const PY_OK = JSON.stringify({ import_errors: [],
  versions: { numpy: '2.5.4', pillow: '13.0.0', lazy_loader: '0.6' } });

// Doctor deps where every check passes; override any member per test.
export function goodDeps(config = fakeConfig(), over = {}) {
  const files = {
    [config.requirements]: LOCK_TEXT,
    [`${config.appDepsDir}/package-lock.json`]: PKG_LOCK,
    [config.assets.catalogManifest]: MANIFEST,
    [config.assets.styleFile]: STYLE,
  };
  const tree = {
    [`${config.assets.catalogModels}/a`]: ['x/a1.blend', 'x/a2.png'],
    [`${config.assets.catalogModels}/b`]: ['x/b1.blend'],
  };
  const hashes = { 'x/a2.png': 'h-a', 'x/b1.blend': 'h-b', [`${config.assets.hdriBase}/p/sky.hdr`]: 'h-sky',
    [`${config.assets.packCache}/kit.zip`]: 'h-kit' };
  return {
    nodeVersion: '24.22.1',
    env: { FAL_KEY: SECRET, OPENROUTER_API_KEY: SECRET },
    exists: () => true,
    readFile: (p) => {
      if (!(p in files)) throw new Error(`ENOENT ${p}`);
      return files[p];
    },
    run: (cmd, args) => {
      if (args[0] === '-c') return { status: 0, stdout: `noise\n${PY_OK}\n`, stderr: '' };
      if (args[0] === '--version') return { status: 0, stdout: 'Blender 4.5.10 LTS\nbuild date: x\n', stderr: '' };
      if (args[1] === '--parity') return { status: 0, stdout: 'x\nparity: 41 rows · PASS\n', stderr: '' };
      return { status: 1, stdout: '', stderr: 'unexpected' };
    },
    resolveNodeLib: (dir, name) => ({ sharp: '0.34.4', 'playwright-core': '1.56.1' })[name],
    listFiles: (dir) => tree[dir] || [],
    hashFile: async (f) => hashes[f] || 'other',
    readEnvNames: () => new Set(),
    ...over,
  };
}

export function tempDir(prefix = 'eng-') {
  return toPosix(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

export function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// A real config for the job layer in a temp home: inbox, jobs, runtime and a tiny site, all on disk.
export function stubConfig(over = {}) {
  const h = tempDir('stub-');
  const site = `${h}/site`;
  writeFile(`${site}/tour/index.html`, '<!doctype html><p>tour</p>\n');
  fs.mkdirSync(`${h}/inbox`, { recursive: true });
  return fakeConfig({
    home: h,
    jobsDir: `${h}/jobs`,
    runtimeDir: `${h}/.runtime`,
    inbox: [`${h}/inbox`],
    stub: { siteRoot: site, tourPath: 'tour/?scope=apartment', stepSeconds: 6, stepMs: 5, rooms: 11, callUsd: 0,
      quote: { estimate_usd: 48, range_usd: [40, 60] } },
    serve: { host: '127.0.0.1', port: 1 },
    runner: { heartbeatSeconds: 2, heartbeatMs: 2000, staleSeconds: 10, staleMs: 10000, heavyStages: ['rendering'], heavyLock: `${h}/.runtime/heavy.lock` },
    ...over,
  });
}

export const PDF_BYTES = '%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF\n';

export function sink() {
  const s = { text: '', write(x) { s.text += x; return true; } };
  return s;
}

// A lock that somebody HOLDS (contract 1.4 §11): the lock's folder with one entry named after its holder. For the
// tests that need a busy lock, or one left by a process that died. `pid` = the holder (this process: alive, so the
// lock is busy until it is `staleMs` old); `at` = when it was taken. Remove it with fs.rmSync(lock, { recursive: true }).
export function holdLock(lock, { pid = process.pid, at = Date.now() } = {}) {
  fs.mkdirSync(lock, { recursive: true });
  fs.writeFileSync(`${lock}/h.${pid}.${at}.abcdef01`, '');
  return lock;
}
