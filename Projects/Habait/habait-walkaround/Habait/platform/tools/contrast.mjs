#!/usr/bin/env node
// Contrast check of css/tokens.css (board platform-ui-ux, card 05). Prints every text-on-surface and UI-on-surface pair with
// its WCAG 2.x contrast ratio in both themes, then the white-label brand pairs with a project's brand colours.
// usage: node tools/contrast.mjs [--tokens css/tokens.css] [--project fixtures/rainbow/project.json]
// exit 0 = every theme pair passes (text ≥ 4.5:1, UI ≥ 3:1). A failing BRAND pair does not fail the run: it is named with the
// fallback rule the page applies (pages must apply it when they map project.json → --brand-*).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const tokensPath = resolve(here, '..', arg('--tokens', 'css/tokens.css'));
const projectPath = arg('--project', null) ? resolve(process.cwd(), arg('--project')) : resolve(here, '..', 'fixtures/rainbow/project.json');
const css = readFileSync(tokensPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ---- parse the three blocks: theme-independent :root, light (:root, [data-theme="light"]), dark ----
function block(selectorRe) {
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${selectorRe}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`block not found: ${selectorRe}`);
  const vars = {};
  for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
  return vars;
}
const base = block(':root');
const light = { ...base, ...block(':root,\\s*\\[data-theme="light"\\]') };
const dark = { ...base, ...block('\\[data-theme="dark"\\]') };

function resolveVar(vars, v, depth = 0) {
  if (depth > 10) throw new Error(`var loop at ${v}`);
  const m = /^var\((--[\w-]+)\)$/.exec(v.trim());
  if (m) { if (!(m[1] in vars)) throw new Error(`undefined ${m[1]}`); return resolveVar(vars, vars[m[1]], depth + 1); }
  return v.trim();
}
const hexRgb = (h) => { const s = h.replace('#', ''); const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
const lum = (rgb) => { const [r, g, b] = rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(hexRgb(a)), lum(hexRgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const color = (vars, name) => { const v = resolveVar(vars, `var(${name})`); if (!/^#[0-9a-f]{3,6}$/i.test(v)) throw new Error(`${name} = ${v} is not a hex colour`); return v; };

// ---- the pairs (fg, bg, what it is) ----
const TEXT = [
  ['--text', '--surface', 'body text on page'], ['--text', '--surface-raised', 'body text on card'], ['--text', '--surface-sunken', 'text on well/input'],
  ['--text-muted', '--surface', 'muted text on page'], ['--text-muted', '--surface-raised', 'muted text on card'], ['--text-muted', '--surface-sunken', 'muted text on well (drop zone types)'],
  ['--brand-ink', '--surface', 'link on page'], ['--brand-ink', '--surface-raised', 'link on card'], ['--brand-ink', '--surface-sunken', 'ghost button on hover well'],
  ['--accent-ink', '--surface', 'eyebrow on page'], ['--accent-ink', '--surface-raised', 'eyebrow on card'],
  ['--brand-on-primary', '--brand-primary', 'primary button label'], ['--brand-on-accent', '--brand-accent', 'label on accent fill'],
  ['--on-whatsapp', '--whatsapp', 'WhatsApp button label'],
  ['--status-available-ink', '--status-available-bg', 'chip: available'], ['--status-reserved-ink', '--status-reserved-bg', 'chip: reserved'],
  ['--status-sold-ink', '--status-sold-bg', 'chip: sold'], ['--status-info-ink', '--status-info-bg', 'chip: info / role chip'],
  ['--status-available-ink', '--surface-raised', 'step state: done'], ['--status-reserved-ink', '--surface-raised', 'step state: needs you'],
  ['--danger-ink', '--surface-raised', 'error text on card / step failed'], ['--text-on-inverse', '--surface-inverse', 'inverse text'],
  ['--status-info-ink', '--status-info-bg', 'drop zone hover text'],
];
const UI = [
  ['--line-strong', '--surface', 'input / outline button border on page'], ['--line-strong', '--surface-raised', 'border on card'], ['--line-strong', '--surface-sunken', 'drop zone border on well'],
  ['--focus', '--surface', 'focus ring on page'], ['--focus', '--surface-raised', 'focus ring on card'],
  ['--status-available', '--surface-raised', 'step mark: done'], ['--status-reserved', '--surface-raised', 'step mark: needs you'],
  ['--danger', '--surface-raised', 'step mark: failed / error border'], ['--progress', '--surface-raised', 'step mark: running / progress bar'], ['--progress', '--surface-sunken', 'progress bar on its track'],
  ['--status-available-ink', '--status-available-bg', 'chip dot: available'], ['--status-reserved-ink', '--status-reserved-bg', 'chip dot: reserved'], ['--status-sold-ink', '--status-sold-bg', 'chip dot: sold'],
];
const ON_STATUS = [['--status-available', 'done mark glyph'], ['--danger', 'failed mark glyph']];

let fails = 0;
const out = [];
for (const [themeName, vars] of [['light', light], ['dark', dark]]) {
  out.push(`\n== theme: ${themeName} ==`);
  for (const [kind, min, list] of [['text', 4.5, TEXT], ['UI', 3, UI]]) {
    for (const [fg, bg, what] of list) {
      const r = ratio(color(vars, fg), color(vars, bg));
      const ok = r >= min; if (!ok) fails++;
      out.push(`${ok ? 'PASS' : 'FAIL'}  ${kind.padEnd(4)} ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${fg} ${color(vars, fg)} on ${bg} ${color(vars, bg)}  · ${what}`);
    }
  }
  for (const [bg, what] of ON_STATUS) {
    const r = ratio(color(vars, '--on-status'), color(vars, bg)); const ok = r >= 3; if (!ok) fails++;
    out.push(`${ok ? 'PASS' : 'FAIL'}  UI   ${r.toFixed(2).padStart(5)}:1 (min 3)  --on-status ${color(vars, '--on-status')} on ${bg} ${color(vars, bg)}  · ${what}`);
  }
}

// ---- white-label: the project's brand colours replace --brand-primary / --brand-accent ----
out.push('\n== brand (white-label) ==');
let brandNotes = 0;
if (!existsSync(projectPath)) out.push(`skip: no project.json at ${projectPath}`);
else {
  const brand = JSON.parse(readFileSync(projectPath, 'utf8')).brand || {};
  out.push(`project: ${projectPath} · brand.primary ${brand.primary || '-'} · brand.accent ${brand.accent || '-'} (brand.background is not a token; ignored)`);
  for (const [themeName, vars] of [['light', light], ['dark', dark]]) {
    const v = { ...vars, ...(brand.primary ? { '--brand-primary': brand.primary } : {}), ...(brand.accent ? { '--brand-accent': brand.accent } : {}) };
    const pairs = [
      ['--brand-on-primary', '--brand-primary', 4.5, 'primary button label', 'use #1a1713 as --brand-on-primary; if that also fails, keep Habait\'s --brand-primary'],
      ['--brand-on-accent', '--brand-accent', 4.5, 'label on accent fill', 'use #ffffff as --brand-on-accent; if that also fails, no text on the accent (decoration only)'],
      ...(themeName === 'light' ? [['--brand-ink', '--surface', 4.5, 'brand-coloured link on page (light: --brand-ink = --brand-primary)', 'keep --brand-ink at Habait\'s default; the brand colour stays on fills only']] : []),
      ['--progress', '--surface-raised', 3, `progress bar / running mark (--progress = ${themeName === 'light' ? '--brand-primary' : '--brand-ink, Habait-fixed'})`, "set --progress to Habait's --brand-ink for this project"],
    ];
    for (const [fg, bg, min, what, fallback] of pairs) {
      const r = ratio(color(v, fg), color(v, bg)); const ok = r >= min;
      if (!ok) brandNotes++;
      out.push(`${ok ? 'PASS' : 'BRAND-FAIL'}  ${themeName.padEnd(5)} ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${fg} ${color(v, fg)} on ${bg} ${color(v, bg)}  · ${what}${ok ? '' : `\n            fallback rule: ${fallback}`}`);
    }
  }
}
out.push(`\nsummary: ${fails} theme pair(s) failing · ${brandNotes} brand pair(s) needing their fallback rule`);
console.log(out.join('\n'));
process.exit(fails ? 1 : 0);
