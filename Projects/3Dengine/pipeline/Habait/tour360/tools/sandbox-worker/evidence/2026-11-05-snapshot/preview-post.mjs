// fork E: POST the portal's build request to a PROTECTED preview deploy. Runs under `vercel env run` so VERCEL_OIDC_TOKEN is in the
// process env; the deployment protection is passed with the x-vercel-trusted-oidc-idp-token header, the portal's own auth with the
// Clerk session token read from a file (never printed). usage: node preview-post.mjs <preview base> <token file> <json body>
import fs from 'node:fs';
const [base, tokenFile, bodyArg] = process.argv.slice(2);
const body = fs.existsSync(bodyArg) ? fs.readFileSync(bodyArg, 'utf8') : bodyArg;   // a file path (safe through any shell) or the JSON itself
const oidc = process.env.VERCEL_OIDC_TOKEN;
if (!oidc) { console.log(JSON.stringify({ ok: false, reason: 'no VERCEL_OIDC_TOKEN in the process env' })); process.exit(2); }
const clerk = fs.readFileSync(tokenFile, 'utf8').trim();
const r = await fetch(`${base}/api/studio-projects`, { method: 'POST', headers: { 'x-vercel-trusted-oidc-idp-token': oidc, Authorization: `Bearer ${clerk}`, 'Content-Type': 'application/json' }, body });
const t = await r.text();
console.log(JSON.stringify({ status: r.status, server: r.headers.get('server'), id: r.headers.get('x-vercel-id'), body: t.slice(0, 2500) }));
