#!/usr/bin/env node
// One source for the design tokens (board platform-ui-ux, card 06). The Studio server serves only studio/dashboard/, so the
// dashboard carries GENERATED copies of platform/css/tokens.css, platform/css/components.css and platform/fonts/*.woff2.
// usage: node tools/sync-tokens.mjs            dry run: lists what is stale, exit 1 if anything is
//        node tools/sync-tokens.mjs --write    writes the copies (a header line on each CSS copy), exit 0
// test/tokens-sync.test.mjs asserts the copies equal their source after the header.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORM = join(dirname(fileURLToPath(import.meta.url)), '..');
const DASH = join(PLATFORM, '..', 'studio', 'dashboard');
export const header = (file) => `/* generated from Habait/platform/css/${file} by platform/tools/sync-tokens.mjs — do not edit */\n`;
export function plan() {
  const rows = ['tokens.css', 'components.css'].map((f) => ({ src: join(PLATFORM, 'css', f), dst: join(DASH, f), want: Buffer.from(header(f) + readFileSync(join(PLATFORM, 'css', f), 'utf8')) }));
  for (const f of readdirSync(join(PLATFORM, 'fonts')).filter((n) => n.endsWith('.woff2')).sort()) rows.push({ src: join(PLATFORM, 'fonts', f), dst: join(DASH, 'fonts', f), want: readFileSync(join(PLATFORM, 'fonts', f)) });
  return rows.map((r) => ({ ...r, stale: !existsSync(r.dst) || !readFileSync(r.dst).equals(r.want) }));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const write = process.argv.includes('--write');
  const rows = plan();
  for (const r of rows) {
    if (r.stale && write) { mkdirSync(dirname(r.dst), { recursive: true }); writeFileSync(r.dst, r.want); }
    console.log(`${r.stale ? (write ? 'wrote ' : 'STALE ') : 'ok    '} ${r.dst.slice(DASH.length + 1).replace(/\\/g, '/')}`);
  }
  const stale = rows.filter((r) => r.stale).length;
  console.log(`${rows.length} copies · ${stale} ${write ? 'written' : 'stale'}${!write && stale ? ' (run with --write)' : ''}`);
  process.exit(!write && stale ? 1 : 0);
}
