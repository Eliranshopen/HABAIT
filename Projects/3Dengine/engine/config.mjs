// The engine's one settings file, resolved: engine.config.json, then engine.config.local.json
// over it, then the ENGINE_* env overrides. Every path comes back absolute with forward slashes.
// Keys are NAMED here and never read.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveFrom, toPosix } from './lib/paths.mjs';

export const ENGINE_HOME = resolveFrom('/', toPosix(fileURLToPath(new URL('..', import.meta.url))));
// The code's own version (package.json beside engine/); part of every job id.
export const ENGINE_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const PATH_FIELDS = ['pipelineRoot', 'python', 'requirements', 'appDepsDir', 'envRoot', 'blender',
  'blenderLock', 'chrome', 'legalDir', 'jobsDir', 'runtimeDir'];
const ASSET_FIELDS = ['source', 'catalogManifest', 'catalogModels', 'styleFile', 'hdriBase', 'packSource', 'packCache'];
const ENV_OVERRIDES = { ENGINE_PYTHON: 'python', ENGINE_BLENDER: 'blender', ENGINE_CHROME: 'chrome' };

function required(obj, field, label = field) {
  const v = obj[field];
  if (v === undefined || v === null || v === '') throw new Error(`engine config: missing required field "${label}"`);
  return v;
}

function merge(base, over) {
  const out = { ...base, ...over };
  for (const k of ['assets', 'stub', 'serve', 'runner', 'inspect', 'trace']) {
    if (base[k] || over[k]) out[k] = { ...(base[k] || {}), ...(over[k] || {}) };
  }
  return out;
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

// A number of the settings FILE is a JSON number (contract 1.4 §6; the review of 1.3, O-3). Every value used to go
// through Number(), which takes true, [4], "0x3" and "3" for numbers.
function intFrom(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`engine config: "${label}" must be an integer ${min}..${max}`);
  }
  return value;
}

// An environment override is text by nature: plain decimal digits, and nothing else. (A test may hand a number.)
function envInt(value, label, min, max) {
  if (typeof value === 'string' && /^\d{1,9}$/.test(value)) return intFrom(Number(value), label, min, max);
  return intFrom(value, label, min, max);
}

// The three blocks milestone 0.2 adds (contract §4): inbox, stub, serve, with their env overrides.
function stubBlocks(raw, home, env) {
  const inbox = required(raw, 'inbox');
  if (!Array.isArray(inbox) || inbox.length === 0) throw new Error('engine config: field "inbox" must be a non-empty array');
  const stub = required(raw, 'stub');
  const quote = required(stub, 'quote', 'stub.quote');
  const range = required(quote, 'range_usd', 'stub.quote.range_usd');
  if (!Array.isArray(range) || range.length !== 2) throw new Error('engine config: "stub.quote.range_usd" must be [low, high]');
  const stepSeconds = numberFrom(required(stub, 'stepSeconds', 'stub.stepSeconds'), 'stub.stepSeconds', 0, 86400);
  const stepMs = env.ENGINE_STUB_STEP_MS ? envInt(env.ENGINE_STUB_STEP_MS, 'ENGINE_STUB_STEP_MS', 1, 3600000)
    : Math.round(stepSeconds * 1000);
  const serve = required(raw, 'serve');
  return {
    inbox: inbox.map((p) => resolveFrom(home, p)),
    stub: {
      siteRoot: resolveFrom(home, required(stub, 'siteRoot', 'stub.siteRoot')),
      tourPath: String(required(stub, 'tourPath', 'stub.tourPath')).replace(/^\/+/, ''),
      stepSeconds,
      stepMs,
      rooms: intFrom(required(stub, 'rooms', 'stub.rooms'), 'stub.rooms', 1, 1000),
      quote: { estimate_usd: numberFrom(required(quote, 'estimate_usd', 'stub.quote.estimate_usd'), 'stub.quote.estimate_usd', 0, 1000000),
        range_usd: range.map((v, i) => numberFrom(v, `stub.quote.range_usd[${i}]`, 0, 1000000)) },
      callUsd: numberFrom(stub.callUsd ?? 0, 'stub.callUsd', 0, 1000),
    },
    serve: {
      host: String(required(serve, 'host', 'serve.host')),
      port: env.ENGINE_SERVE_PORT ? envInt(env.ENGINE_SERVE_PORT, 'ENGINE_SERVE_PORT', 1, 65535)
        : intFrom(required(serve, 'port', 'serve.port'), 'serve.port', 1, 65535),
    },
  };
}

function numberFrom(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`engine config: "${label}" must be a number ${min}..${max}`);
  }
  return value;
}

export const RUNNER_DEFAULTS = Object.freeze({ heartbeatSeconds: 2, staleSeconds: 10, heavyStages: ['rendering'], heavyLock: '.runtime/heavy.lock' });

// The runner block milestone 0.3 adds (contract 0.3 §4, §5). Every field has a default, so a settings
// file written for 0.2 still loads.
function runnerBlock(raw, home) {
  const r = { ...RUNNER_DEFAULTS, ...(raw.runner || {}) };
  const heartbeatSeconds = numberFrom(r.heartbeatSeconds, 'runner.heartbeatSeconds', 0.01, 3600);
  if (!Array.isArray(r.heavyStages) || r.heavyStages.some((s) => typeof s !== 'string')) {
    throw new Error('engine config: "runner.heavyStages" must be an array of stage names');
  }
  const heartbeatMs = Math.max(10, Math.round(heartbeatSeconds * 1000));
  // A runner (and the heavy lock's holder) that gave no sign of life for staleMs is treated as dead,
  // whatever its pid says (contract 0.3 §10.5): the larger of staleSeconds and five heartbeats.
  const staleSeconds = numberFrom(r.staleSeconds, 'runner.staleSeconds', 0.05, 86400);
  return {
    heartbeatSeconds,
    heartbeatMs,
    staleSeconds,
    staleMs: Math.max(Math.round(staleSeconds * 1000), 5 * heartbeatMs),
    heavyStages: [...r.heavyStages],
    heavyLock: resolveFrom(home, String(required(r, 'heavyLock', 'runner.heavyLock'))),
  };
}

export const INSPECT_DEFAULTS = Object.freeze({ minSidePx: 1000, vectorMinPaths: 200, timeoutSeconds: 30 });

// The inspect block milestone 1.1 adds (contract 1.1 §6): how the first look at a PDF tells a large image
// from a small one and a vector page from an empty one, and how long the scanner may take. Every field has
// a default, so an older settings file still loads.
function inspectBlock(raw) {
  const r = { ...INSPECT_DEFAULTS, ...(raw.inspect || {}) };
  return {
    minSidePx: intFrom(r.minSidePx, 'inspect.minSidePx', 1, 100000),
    vectorMinPaths: intFrom(r.vectorMinPaths, 'inspect.vectorMinPaths', 1, 100000000),
    timeoutSeconds: numberFrom(r.timeoutSeconds, 'inspect.timeoutSeconds', 0.1, 600),
  };
}

export const TRACE_DEFAULTS = Object.freeze({ timeoutSeconds: 1500, maxBudgetUsd: 1, judgeRuns: 3, rounds: 3 });
export const MODES = Object.freeze(['stub', 'real']);

// The trace block milestone 1.2 adds (contract 1.2 §5): how long the reading tool may take, the most a single
// reading may be allowed to cost, and how many runs of the judge the tool makes (only to say what a paid run
// would call). Every field has a default, so an older settings file still loads.
function traceBlock(raw) {
  const r = { ...TRACE_DEFAULTS, ...(raw.trace || {}) };
  return {
    timeoutSeconds: numberFrom(r.timeoutSeconds, 'trace.timeoutSeconds', 0.1, 7200),
    maxBudgetUsd: numberFrom(r.maxBudgetUsd, 'trace.maxBudgetUsd', 0.01, 5),
    judgeRuns: intFrom(r.judgeRuns, 'trace.judgeRuns', 1, 9),
    rounds: intFrom(r.rounds, 'trace.rounds', 1, 9),        // (1.3) the tool's self-correction rounds
  };
}

export const BUILD_DEFAULTS = Object.freeze({ timeoutSeconds: 600 });
export const RENDER_DEFAULTS = Object.freeze({ res: '2048x1024', samples: 32, timeoutSeconds: 1800, points: null, lockPollSeconds: 5 });
export const RENDER_MIN_WIDTH = 1024;        // the render tool's wrap pad of 512 px must be at most half the width
const RENDER_POINT_RE = /^cp-[A-Za-z0-9]{1,60}$/;

// The build block milestone 2.1 adds (contract 2.1 §9): how long the four build steps may take.
function buildBlock(raw) {
  const r = { ...BUILD_DEFAULTS, ...(raw.build || {}) };
  return { timeoutSeconds: numberFrom(r.timeoutSeconds, 'build.timeoutSeconds', 0.1, 7200) };
}

// The render block milestone 2.1 adds (contract 2.1 §9): the picture's size (width x height, the height half the
// width, the width at least 1024), the samples, the time one room may take, which camera points are rendered
// (absent or null: all), and how often a job that waits for the machine's Blender lock looks again.
function renderBlock(raw) {
  const r = { ...RENDER_DEFAULTS, ...(raw.render || {}) };
  const m = typeof r.res === 'string' ? /^([1-9]\d{2,4})x([1-9]\d{2,4})$/.exec(r.res) : null;
  if (!m || Number(m[1]) !== 2 * Number(m[2]) || Number(m[1]) < RENDER_MIN_WIDTH || Number(m[1]) > 16384) {
    throw new Error('engine config: "render.res" must be "<width>x<height>", the height half the width, the width from 1024 to 16384');
  }
  let points = null;
  if (r.points !== null && r.points !== undefined) {
    if (!Array.isArray(r.points) || r.points.length === 0 || r.points.some((p) => typeof p !== 'string' || !RENDER_POINT_RE.test(p)) || new Set(r.points).size !== r.points.length) {
      throw new Error('engine config: "render.points" must be null or a list of different camera point names (cp- and letters or digits)');
    }
    points = [...r.points];
  }
  return {
    res: r.res,
    samples: intFrom(r.samples, 'render.samples', 1, 4096),
    timeoutSeconds: numberFrom(r.timeoutSeconds, 'render.timeoutSeconds', 0.1, 86400),
    points,
    lockPollSeconds: numberFrom(r.lockPollSeconds, 'render.lockPollSeconds', 0.01, 600),
  };
}

// The mode of a NEW job (contract 1.3 §1): `stub` unless the settings say `real`.
function modeFrom(raw) {
  if (raw.mode === undefined || raw.mode === null) return 'stub';
  if (!MODES.includes(raw.mode)) throw new Error('engine config: "mode" must be "stub" or "real"');
  return raw.mode;
}

// `home` defaults to ENGINE_HOME, or to the ENGINE_HOME environment override (tests run a whole engine
// against a temp home that way). ENGINE_JOBS_DIR overrides jobsDir.
export function loadConfig({
  home,
  env = process.env,
  readFile = (p) => fs.readFileSync(p, 'utf8'),
  exists = fs.existsSync,
} = {}) {
  home = resolveFrom('/', home || env.ENGINE_HOME || ENGINE_HOME);
  const parse = (p) => JSON.parse(String(readFile(p)).replace(/^\uFEFF/, ''));
  let raw = parse(`${home}/engine.config.json`);
  const local = `${home}/engine.config.local.json`;
  if (exists(local)) raw = merge(raw, parse(local));
  raw = { ...raw };
  for (const [name, field] of Object.entries(ENV_OVERRIDES)) {
    if (typeof env[name] === 'string' && env[name] !== '') raw[field] = env[name];
  }

  const cfg = { home };
  for (const f of PATH_FIELDS) cfg[f] = resolveFrom(home, required(raw, f));
  cfg.basePython = required(raw, 'basePython');
  cfg.blenderVersion = String(required(raw, 'blenderVersion'));
  const assets = required(raw, 'assets');
  cfg.assets = {};
  for (const f of ASSET_FIELDS) cfg.assets[f] = resolveFrom(home, required(assets, f, `assets.${f}`));
  for (const f of ['keys', 'nodeLibs']) {
    const v = required(raw, f);
    if (!Array.isArray(v)) throw new Error(`engine config: field "${f}" must be an array`);
    cfg[f] = [...v];
  }
  const libs = required(raw, 'pythonLibs');
  if (typeof libs !== 'object' || Array.isArray(libs)) throw new Error('engine config: field "pythonLibs" must be an object');
  cfg.pythonLibs = { ...libs };
  if (typeof env.ENGINE_JOBS_DIR === 'string' && env.ENGINE_JOBS_DIR !== '') cfg.jobsDir = resolveFrom(home, env.ENGINE_JOBS_DIR);
  Object.assign(cfg, stubBlocks(raw, home, env));
  cfg.runner = runnerBlock(raw, home);
  cfg.inspect = inspectBlock(raw);
  cfg.trace = traceBlock(raw);
  cfg.build = buildBlock(raw);
  cfg.render = renderBlock(raw);
  cfg.mode = modeFrom(raw);
  // (1.3) where the engine looks for a saved reading of a PDF: <readingsDir>/<sha256 of the PDF>.json
  if (raw.readingsDir !== undefined && raw.readingsDir !== null && (typeof raw.readingsDir !== 'string' || raw.readingsDir.trim() === '')) {
    throw new Error('engine config: "readingsDir" must be a path (text)');
  }
  cfg.readingsDir = resolveFrom(home, raw.readingsDir === undefined || raw.readingsDir === null ? `${cfg.runtimeDir}/readings` : raw.readingsDir);
  return deepFreeze(cfg);
}

// The pointers the brought-in pipeline reads instead of its old C:/RnD/Projects/Habait defaults.
export function pipelineEnv(config) {
  return {
    HABAIT_PY: config.python,
    HABAIT_APP_DIR: config.appDepsDir,
    HABAIT_ENV_ROOT: config.envRoot,
    HABAIT_BLENDER_LOCK: config.blenderLock,
    HABAIT_ASSETS_ROOT: config.pipelineRoot,
    HABAIT_LEGAL_SRC: config.legalDir,
    HABAIT_LEGAL_DIR: config.legalDir,
    HABAIT_LEGAL_MD: `${config.legalDir}/disclaimer-he-en.md`,
    BLENDER: config.blender,
    CHROME: config.chrome,
    CHROME_PATH: config.chrome,
  };
}
