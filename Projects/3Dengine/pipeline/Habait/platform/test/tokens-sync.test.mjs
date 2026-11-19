// The Studio's copies of the design tokens equal their platform source (board platform-ui-ux, card 06).
// usage: node test/tokens-sync.test.mjs      (exit 1 on drift; fix with: node tools/sync-tokens.mjs --write)
import { readFileSync, existsSync } from 'node:fs';
import { plan, header } from '../tools/sync-tokens.mjs';

let fail = 0;
for (const r of plan()) {
  const name = r.dst.replace(/\\/g, '/').split('/studio/dashboard/')[1];
  if (!existsSync(r.dst)) { fail++; console.log(`FAIL ${name}: missing`); continue; }
  const got = readFileSync(r.dst);
  if (name.endsWith('.css')) {
    const text = got.toString('utf8'); const h = header(name);
    if (!text.startsWith(h)) { fail++; console.log(`FAIL ${name}: header line missing`); continue; }
    if (text.slice(h.length) !== readFileSync(r.src, 'utf8')) { fail++; console.log(`FAIL ${name}: differs from its source after the header`); continue; }
  } else if (!got.equals(readFileSync(r.src))) { fail++; console.log(`FAIL ${name}: differs from its source`); continue; }
  console.log(`PASS ${name}`);
}
console.log(fail ? `${fail} FAIL` : 'all copies equal their source');
process.exit(fail ? 1 : 0);
