// fork E (rnd-9d, 2026-11-05): prove the portal's BUILD trigger on a PREVIEW deploy. The preview is protected (Vercel Authentication),
// so the browser part runs on PROD (same Clerk instance, same Blob store): sign up a Clerk TEST user → project → upload the sales
// plan → the agent reads it (paid, ledgered by the portal) → approve. Then the page's own session token is sent, through
// `vercel curl` (protection bypass by OIDC), to the PREVIEW's /api/studio-projects with { build:true, consent:true }: the preview's
// function queues the job AND boots its sandbox, and answers with the `worker` record. The prod page then shows the job's log line.
// Needs HEADED=1 (bot protection blocks headless sign-up). usage: HEADED=1 node studio-e2e-build.cjs <prod base> <preview base> <out dir> <pdf> <linked folder>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const { spawnSync } = require('child_process');
const [base, preview, out, pdf, linked] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: process.env.HEADED !== '1', args: ['--window-position=-2400,0'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
  await p.goto(base + '/studio/', { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const email = `studio-qa-${Date.now().toString(36)}+clerk_test@example.com`;
  const r = await p.evaluate(async (email) => {
    const C = window.Clerk;
    try {
      let su = await C.client.signUp.create({ emailAddress: email, password: 'Habait-QA-' + Math.random().toString(36).slice(2) + '!9', legalAccepted: true });
      await su.prepareEmailAddressVerification({ strategy: 'email_code' });
      su = await su.attemptEmailAddressVerification({ code: '424242' });
      if (su.status !== 'complete') { try { su = await su.update({ password: 'Hb!' + crypto.randomUUID() }); } catch (e) { return { ok: false, upd: String(e?.errors?.[0]?.longMessage || e?.message).slice(0, 200) }; } }
      if (su.status !== 'complete') return { ok: false, status: su.status, missing: su.missingFields, unverified: su.unverifiedFields, ver: su.verifications?.emailAddress?.status };
      await C.setActive({ session: su.createdSessionId });
      return { ok: true };
    } catch (e) { return { ok: false, err: String(e?.errors?.[0]?.longMessage || e?.message || e).slice(0, 200) }; }
  }, email);
  log('signup', JSON.stringify(r));
  if (!r.ok) { await b.close(); process.exit(3); }
  await p.waitForSelector('#st-list:not([hidden])', { timeout: 30000 });
  await p.fill('#st-new-name', 'sandbox-worker e2e · 846');
  await p.click('#st-new button[type=submit]');
  await p.waitForSelector('#st-project:not([hidden])', { timeout: 30000 });
  await p.waitForTimeout(1500);
  const pid = await p.evaluate(() => (location.hash.match(/p=([A-Za-z0-9_-]+)/) || [])[1] || null);
  log('project', pid);
  await p.setInputFiles('#st-file', pdf);
  await p.waitForFunction(() => [...document.querySelectorAll('#st-files li span:last-child')].some((s) => /KB|MB/.test(s.textContent)), null, { timeout: 180000 });
  log('uploaded');
  const t0 = Date.now();
  await p.click('#st-read');
  await p.waitForSelector('#st-spec-card:not([hidden])', { timeout: 300000 });
  log('read in', Math.round((Date.now() - t0) / 1000), 's');
  await p.click('#st-approve');
  await p.waitForFunction(() => document.getElementById('st-approve').disabled, null, { timeout: 30000 });
  log('approved');
  // the preview's build trigger, with the page's own session token (short-lived; written to a file for the one curl, then blanked)
  const tok = await p.evaluate(() => window.Clerk.session.getToken());
  const tf = require('path').resolve(out, '.clerk-token.tmp');   // absolute: the spawn below runs in the linked folder, not here
  fs.writeFileSync(tf, tok);
  const body = JSON.stringify({ id: pid, build: true, consent: true });
  // `vercel curl` replaced the Authorization header with its own (the first run answered {"reason":"login"}); the protection is
  // passed as x-vercel-trusted-oidc-idp-token instead (skill vercel:access-protected-vercel-deployment), under `vercel env run`
  const bf = require('path').resolve(out, 'build-body.json'); fs.writeFileSync(bf, body);
  const c = spawnSync('npx', ['--yes', 'vercel@65.9.0', 'env', 'run', '--scope', 'eliran-5390', '--', 'node', `${__dirname}/preview-post.mjs`, preview, tf, bf],
    { cwd: linked, encoding: 'utf8', shell: true, timeout: 120000, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  fs.writeFileSync(tf, '');
  const resp = `${c.stdout || ''}${c.status ? `\nstderr: ${(c.stderr || '').slice(-600)}` : ''}`.replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');
  fs.writeFileSync(`${out}/preview-build-response.json`, resp);
  log('preview build POST exit', c.status, resp.slice(0, 900).replace(/\s+/g, ' '));
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('st-job').hidden, null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const jobText = await p.evaluate(() => ({ stage: document.getElementById('st-job-stage')?.textContent, log: document.getElementById('st-job-log')?.innerText.slice(0, 600) }));
  log('job card on prod', JSON.stringify(jobText));
  await p.screenshot({ path: `${out}/job-card.png`, fullPage: true });
  log('page errors', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
