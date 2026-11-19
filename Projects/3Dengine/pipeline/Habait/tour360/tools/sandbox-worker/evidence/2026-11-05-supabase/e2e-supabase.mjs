// fork G: the portal end to end on a PROTECTED PREVIEW with the Supabase store. Runs under `vercel env run -e preview` (the OIDC token
// passes the preview's protection, added ONLY to requests for the preview host; the Supabase keys stay in this process for the
// store checks). Clerk test user (+clerk_test, code 424242), HEADED=1 off-screen (bot protection blocks headless sign-up).
// fal is LOCKED (403 TOP_UP): the reading is tried and recorded as blocked; spec.json is then seeded from the hand 846 intake
// (Habait/studio/_local/projects/apt846-rainbow-tlv/derived/intake.json) so the approve → build → sandbox chain can be proven.
// usage: HEADED=1 node e2e-supabase.mjs <preview base> <out dir> <pdf>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openStore, toKey } from 'file:///C:/RnD/.wt/studio-supabase/Projects/Habait/habait-walkaround/Habait/studio-web/api/_store.mjs';
const require = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json');
const { chromium } = require('playwright-core');
const [base, out, pdf] = process.argv.slice(2);
const host = new URL(base).host;
const oidc = process.env.VERCEL_OIDC_TOKEN;
if (!oidc) { console.log('no VERCEL_OIDC_TOKEN'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const log = (...a) => { const l = `${new Date().toISOString().slice(11, 19)} ${a.join(' ')}`; console.log(l); fs.appendFileSync(path.join(out, 'e2e.log'), `${l}\n`); };
const store = await openStore();
const rep = { store: store.kind, preview: base };

const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: process.env.HEADED !== '1', args: ['--window-position=-2400,0'] });
async function ctxFor(vp, mobile) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  await ctx.route((u) => u.host === host, (route) => route.continue({ headers: { ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': oidc } }));
  return ctx;
}
const ctx = await ctxFor({ width: 1440, height: 900 }, false);
const p = await ctx.newPage(); const errs = []; const puts = [];
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
p.on('response', (r) => { const u = r.url(); if (u.includes('/storage/v1/object/upload/sign/')) puts.push(r.status()); if (r.status() >= 400 && !u.includes('/storage/v1/')) errs.push(`${r.status()} ${u.replace(base, '').slice(0, 80)}`); });
await p.goto(`${base}/studio/`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 60000 });
await p.waitForTimeout(1500);
const email = `studio-supa-${Date.now().toString(36)}+clerk_test@example.com`;
const su = await p.evaluate(async (email) => {
  const C = window.Clerk;
  try {
    let s = await C.client.signUp.create({ emailAddress: email, password: 'Habait-QA-' + Math.random().toString(36).slice(2) + '!9', legalAccepted: true });
    await s.prepareEmailAddressVerification({ strategy: 'email_code' });
    s = await s.attemptEmailAddressVerification({ code: '424242' });
    if (s.status !== 'complete') return { ok: false, status: s.status };
    await C.setActive({ session: s.createdSessionId });
    return { ok: true, uid: C.user?.id || null };
  } catch (e) { return { ok: false, err: String(e?.errors?.[0]?.longMessage || e?.message || e).slice(0, 200) }; }
}, email);
log('signup', JSON.stringify(su)); if (!su.ok) { await b.close(); process.exit(3); }
await p.waitForSelector('#st-list:not([hidden])', { timeout: 30000 });
await p.fill('#st-new-name', 'Supabase e2e · 846');
await p.click('#st-new button[type=submit]');
await p.waitForSelector('#st-project:not([hidden])', { timeout: 30000 });
await p.waitForTimeout(1500);
const uid = await p.evaluate(() => window.Clerk.user.id);
const pid = await p.evaluate(() => (location.hash.match(/p=([A-Za-z0-9_-]+)/) || [])[1] || null);
rep.uid = uid; rep.pid = pid; log('project', pid);
const pre = `studio/u/${uid}/p/${pid}/`;
rep.meta_in_supabase = Boolean(await store.getJson(`${pre}meta.json`));
rep.projects_index = (await store.getJson(`studio/u/${uid}/projects.json`))?.projects?.map((x) => x.id) || null;

const t0 = Date.now();
await p.setInputFiles('#st-file', pdf);
await p.waitForFunction(() => [...document.querySelectorAll('#st-files li span:last-child')].some((s) => /KB|MB/.test(s.textContent)), null, { timeout: 240000 });
rep.upload_seconds = Math.round((Date.now() - t0) / 1000);
const name = path.basename(pdf);
const fl = await store.getJson(`${pre}files.json`);
rep.files_index = fl?.files?.map((f) => `${f.name} ${f.bytes} pages:${f.pages}`) || null;
rep.pdf_key = toKey(`${pre}files/${name}`);
rep.pdf_in_supabase_bytes = (await store.getBytes(`${pre}files/${name}`))?.length || 0;
rep.pdf_local_bytes = fs.statSync(pdf).size;
const pidx = await store.getJson(`${pre}files/.pages/${name}/index.json`);
rep.page_renders = pidx ? (Array.isArray(pidx) ? pidx.length : (pidx.images || []).length) : 0;
rep.signed_upload_statuses = puts;
log('uploaded', rep.upload_seconds, 's ·', rep.pdf_in_supabase_bytes, 'bytes ·', rep.page_renders, 'renders');
await p.screenshot({ path: `${out}/1-uploaded-1440.png`, fullPage: true });

// the reading (paid, fal) — expected to fail while fal is locked
await p.waitForTimeout(4000);   // the page renders finish uploading
await p.click('#st-read').catch(() => {});
for (let i = 0; i < 40 && !(await store.getJson(`${pre}ledger.json`))?.some?.((r) => r.state !== 'open'); i++) await new Promise((r) => setTimeout(r, 2000));
const readState = (await store.getJson(`${pre}meta.json`))?.steps?.read || null;
rep.read = readState ? { state: readState.state, note: readState.note || null } : null;
rep.read_ledger = ((await store.getJson(`${pre}ledger.json`)) || []).map((r) => `${r.step} ${r.state} ${r.note || ''}`.slice(0, 160));
log('read', JSON.stringify(rep.read));
const specNow = await store.getJson(`${pre}spec.json`);
if (!specNow) {
  const intake = JSON.parse(fs.readFileSync('C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/derived/intake.json', 'utf8'));
  await store.putJson(`${pre}spec.json`, { ...intake, _seeded: 'fork G 2026-11-05: fal locked (403 TOP_UP); seeded from the hand 846 intake to prove approve → build → sandbox on Supabase' });
  const meta = await store.getJson(`${pre}meta.json`);
  meta.steps = { ...(meta.steps || {}), read: { state: 'done', at: new Date().toISOString(), note: 'seeded (fal locked)' } };
  await store.putJson(`${pre}meta.json`, meta);
  rep.read_blocked = 'blocked: fal (403 TOP_UP) — spec.json seeded from the hand 846 intake';
  log('spec seeded');
}
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 60000 });
await p.waitForSelector('#st-spec-card:not([hidden])', { timeout: 60000 });
await p.click('#st-approve');
for (let i = 0; i < 20 && (await store.getJson(`${pre}meta.json`))?.steps?.approve?.state !== 'done'; i++) await new Promise((r) => setTimeout(r, 1500));
log('approved');
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 60000 });
await p.waitForSelector('#st-build-card:not([hidden])', { timeout: 60000 });
await p.check('#st-consent');
const tb = Date.now();
await p.click('#st-build');
await p.waitForFunction(() => !document.getElementById('st-job').hidden, null, { timeout: 60000 });
log('build clicked');
// the sandbox claims the job and writes its state into Supabase
let job = null;
for (let i = 0; i < 24; i++) {
  job = await store.getJson(`${pre}job.json`);
  if (job && job.state !== 'queued' && (job.executor || job.heartbeat)) break;
  await new Promise((r) => setTimeout(r, 5000));
}
rep.job = job ? { id: job.id, state: job.state, stage: job.stage, executor: job.executor || null, sandbox: job.sandbox ? { name: job.sandbox.name, stage: job.sandbox.stage } : null, claimed_after_s: Math.round((Date.now() - tb) / 1000), log: (job.log || []).slice(-6).map((l) => l.line), blob_ops: job.blob_ops || null } : null;
log('job', JSON.stringify(rep.job));
rep.job_index = Boolean(job && await store.getJson(`studio/jobs/${job.id}.json`));
rep.queue_pointer = Boolean(job && await store.getJson(`studio/queue/${job.id}.json`));
await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/2-job-1440.png`, fullPage: true });
rep.job_card = await p.evaluate(() => ({ stage: document.getElementById('st-job-stage')?.textContent, log: document.getElementById('st-job-log')?.innerText.slice(0, 500) }));
// the same project on a phone
const st = await ctx.storageState();
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: st });
await ctx2.route((u) => u.host === host, (route) => route.continue({ headers: { ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': oidc } }));
const m = await ctx2.newPage();
await m.goto(`${base}/studio/#p=${pid}`, { waitUntil: 'load', timeout: 90000 });
await m.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 60000 }).catch(() => {});
await m.waitForTimeout(5000);
rep.phone = await m.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > innerWidth + 1, project: !document.getElementById('st-project').hidden }));
await m.screenshot({ path: `${out}/3-job-390.png`, fullPage: true });
rep.ops_this_script = store.OPS;
rep.page_errors = errs;
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep, null, 1));
await b.close();
