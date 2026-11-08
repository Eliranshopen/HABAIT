/* Habait Tour360 — tools/file-ledger.mjs (T14b) — the laptop's exact file ledger and the by-name env loader, shared by the laptop
   host (tools/edit-server.mjs) and the probe (tools/catalog-probe.mjs). Moved out of edit-server.mjs unchanged in behaviour.
   The ledger is the same file tools/edit-pano.py writes: reserve before send, settle after, under the cap in the file. */
import fs from 'node:fs';
import path from 'node:path';

/** { cap, total(), reserve(row) → id, settle(id, usd, patch) } over apartments/<id>/_local/ledger.json. */
export function fileLedger(LEDGER) {
  return {
    get cap() { return this.load().cap_usd; },
    load() {
      if (fs.existsSync(LEDGER)) return JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
      return { $schema: 'tour360/ledger.v1', cap_usd: 3.0, note: 'reserve before send, settle after', rows: [] };
    },
    save(doc) { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.writeFileSync(LEDGER + '.tmp', JSON.stringify(doc, null, 1)); fs.renameSync(LEDGER + '.tmp', LEDGER); },
    total() { return this.load().rows.reduce((t, r) => t + (r.settled_usd ?? r.reserved_usd), 0); },
    reserve(row) { const doc = this.load(); doc.rows.push({ seq: doc.rows.length + 1, ...row }); this.save(doc); return doc.rows.length - 1; },
    settle(i, usd, patch) { const doc = this.load(); if (doc.rows[i]) Object.assign(doc.rows[i], patch, { settled_usd: usd }); this.save(doc); },
  };
}

/** The process environment plus the harness root .env, read BY NAME; values are never printed by anything in this folder. */
export function loadEnv(harnessRoot) {
  const env = { ...process.env };
  const envFile = path.join(harnessRoot, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
