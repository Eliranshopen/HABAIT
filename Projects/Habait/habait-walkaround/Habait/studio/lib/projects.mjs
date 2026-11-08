/* Habait Studio — lib/projects.mjs: one folder per project on disk, no database.
   <projects>/<id>/project.json   the meta the dashboard edits (name, address, style, latlon, options)
   <projects>/<id>/state.json     stage statuses written by the pipeline runner
   <projects>/<id>/ledger.json    every paid call (usd, endpoint, note) — the cap is enforced from here
   <projects>/<id>/intake/        what the user uploaded (sales plan PDF, images, a traced plan.json)
   <projects>/<id>/derived/       intake.json · site.json · plan.json · shots.json
   <projects>/<id>/renders/       scene.blend · clay/<shot>/ · keyframes/ · video/
   <projects>/<id>/outputs/       clips/<shot>.mp4 · master.mp4 · tour.json */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SUBDIRS = ['intake', 'derived', 'renders', 'outputs'];

export function slugify(s) {
  return String(s || 'project').toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export class ProjectStore {
  constructor(rootDir) {
    this.root = rootDir;
    fs.mkdirSync(rootDir, { recursive: true });
  }

  dir(id) {
    if (!/^[a-z0-9֐-׿-]+$/i.test(id)) throw new Error(`bad project id: ${id}`);
    return path.join(this.root, id);
  }
  paths(id) {
    const d = this.dir(id);
    const p = { dir: d };
    for (const s of SUBDIRS) p[s] = path.join(d, s);
    return p;
  }

  list() {
    if (!fs.existsSync(this.root)) return [];
    return fs.readdirSync(this.root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(this.root, e.name, 'project.json')))
      .map((e) => ({ ...this.meta(e.name), state: this.state(e.name) }))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  exists(id) { return fs.existsSync(path.join(this.dir(id), 'project.json')); }

  create(meta) {
    const base = slugify(meta.name);
    let id = base;
    while (this.exists(id)) id = `${base}-${crypto.randomBytes(2).toString('hex')}`;
    const d = this.dir(id);
    for (const s of SUBDIRS) fs.mkdirSync(path.join(d, s), { recursive: true });
    const full = {
      id, name: meta.name || id, developer: meta.developer || '', address: meta.address || '',
      latlon: meta.latlon || null, style: meta.style || 'tlv-golden-hour', notes: meta.notes || '',
      options: { variants: ['morning', 'evening'], clay: { res: '640x360', samples: 16, engine: 'CYCLES', fps: 24 }, video: { resolution: '720p', detail_refine: false, seeds: 1 },
        panos_dir: meta.panos_dir || null, fixture: meta.fixture || null, ...(meta.options || {}) },
      created_at: new Date().toISOString(),
    };
    writeJson(path.join(d, 'project.json'), full);
    writeJson(path.join(d, 'state.json'), { stages: {}, running: false, ledger_usd: 0 });
    writeJson(path.join(d, 'ledger.json'), []);
    return full;
  }

  meta(id) { return readJson(path.join(this.dir(id), 'project.json'), null); }
  saveMeta(id, patch) {
    const cur = this.meta(id);
    if (!cur) throw new Error(`no project ${id}`);
    const next = { ...cur, ...patch, id, options: { ...cur.options, ...(patch.options || {}) } };
    writeJson(path.join(this.dir(id), 'project.json'), next);
    return next;
  }

  state(id) { return readJson(path.join(this.dir(id), 'state.json'), { stages: {}, running: false, ledger_usd: 0 }); }
  saveState(id, state) { writeJson(path.join(this.dir(id), 'state.json'), state); return state; }
  setStage(id, stage, patch) {
    const st = this.state(id);
    st.stages[stage] = { ...(st.stages[stage] || {}), ...patch, at: new Date().toISOString() };
    return this.saveState(id, st);
  }
  setRunning(id, running) { const st = this.state(id); st.running = running; return this.saveState(id, st); }

  ledger(id) { return readJson(path.join(this.dir(id), 'ledger.json'), []); }
  ledgerTotal(id) { return this.ledger(id).reduce((s, r) => s + (Number(r.usd) || 0), 0); }
  spend(id, row) {
    const rows = this.ledger(id);
    rows.push({ at: new Date().toISOString(), ...row });
    writeJson(path.join(this.dir(id), 'ledger.json'), rows);
    const st = this.state(id);
    st.ledger_usd = rows.reduce((s, r) => s + (Number(r.usd) || 0), 0);
    this.saveState(id, st);
    return st.ledger_usd;
  }

  files(id) {
    const d = this.paths(id).intake;
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => !f.startsWith('.')).map((f) => {
      const s = fs.statSync(path.join(d, f));
      return { name: f, bytes: s.size, mtime: s.mtime.toISOString() };
    });
  }
  addFile(id, name, buffer) {
    const safe = path.basename(name).replace(/[\\/:*?"<>|]/g, '_');
    const file = path.join(this.paths(id).intake, safe);
    fs.writeFileSync(file, buffer);
    return { name: safe, bytes: buffer.length };
  }
  removeFile(id, name) {
    const file = path.join(this.paths(id).intake, path.basename(name));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  derived(id, name) { return readJson(path.join(this.paths(id).derived, name), null); }
  saveDerived(id, name, data) { writeJson(path.join(this.paths(id).derived, name), data); }
}

export { readJson, writeJson };
