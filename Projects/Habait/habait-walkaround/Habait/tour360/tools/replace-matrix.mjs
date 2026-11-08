#!/usr/bin/env node
/* Habait Tour360 — tools/replace-matrix.mjs (T17a/T17d, TEST-PLAN.md §4) — the replace matrix driven in a real browser against
   a running laptop host: every marker of a scene × the catalog items of its category (or the pairs named), each a PAID turn
   (≈ $0.09–0.18) recorded as pictures and numbers for the eye and the judge.
   Per pair: look at the marker · the rings frame · tap the ring · the pick frame · tap the item (the turn) · wait for the live scene
   or the message · the page frame with the card · the same view at 45° and at 100° · the original toggled at the three fields · a
   second tap on the ring (the bar opens with the item selected; Escape) · undo · the host's recorded files of the turn copied in
   (crop, result-<attempt>, judge-<n>, likeness, before/after/before-wide/after-wide, account.json) · turn.json.
   Usage (from the harness root, Git Bash; the host started by the operator or inside the same bounded command, one scene per call):
     timeout 540 node Habait/tour360/tools/replace-matrix.mjs demo-01 --scene living --lang he --base http://127.0.0.1:<port>
       --key-file <scratch file with the unlock code> [--out qa-evidence/tour360/T17/matrix] [--pairs living-0-7:kragsta,…]
       [--repeat N] [--phone] [--fit-only]
   The terrace (8 pairs) wants `timeout 900`. The key is read from the file and never printed. Frames land as lossless WebP. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSharp } from './pano-geometry.mjs';
import { appRequire } from './app-require.mjs'; // a worktree has no Habait/MVP/app (board habait-walkaround T18)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--')) || 'demo-01';
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const SCENE = arg('--scene', null), PAIRS = arg('--pairs', null), LANG = arg('--lang', 'he'), REPEAT = Math.max(1, Number(arg('--repeat', 1)) || 1);
const PHONE = has('--phone'), FIT_ONLY = has('--fit-only');
const RINGS_ONLY = has('--rings-only'); // $0: look at every marker, file the rings frame and the ring boxes, send no turn (TEST-PLAN C17)
const base = String(arg('--base', '')).replace(/\/$/, '');
const keyFile = arg('--key-file', '');
const OUT = path.resolve(arg('--out', path.join(REPO, 'qa-evidence', 'tour360', 'T17', 'matrix')), LANG + (PHONE ? '-phone' : ''));
if (!base || !keyFile || (!SCENE && !PAIRS)) { console.error('usage: replace-matrix.mjs <apartment> --scene <s> | --pairs m:i,… --base <url> --key-file <file> [--lang he] [--repeat N] [--phone] [--out <dir>]'); process.exit(2); }
const key = fs.readFileSync(keyFile, 'utf8').trim();
if (key.length < 8) { console.error('replace-matrix: the key file holds no code'); process.exit(2); }

const APT = path.join(ROOT, 'apartments', id);
const TURNS = path.join(APT, '_local', 'turns');
const LEDGER = path.join(APT, '_local', 'ledger.json');
const markersDoc = JSON.parse(fs.readFileSync(path.join(APT, 'markers.json'), 'utf8'));
const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'items.json'), 'utf8')).items;
const allMarkers = Object.entries(markersDoc.scenes).flatMap(([scene, sc]) => (sc.markers || []).map((m) => ({ scene, m })));
let pairs = [];
if (PAIRS) {
  for (const p of PAIRS.split(',')) {
    const [mid, iid] = p.split(':'); const hit = allMarkers.find((x) => x.m.id === mid); const it = items.find((i) => i.id === iid);
    if (!hit || !it) { console.error(`replace-matrix: unknown pair ${p}`); process.exit(2); }
    pairs.push({ scene: hit.scene, marker: hit.m, item: it });
  }
} else {
  const wanted = SCENE === 'all' ? null : SCENE.split(',');
  for (const { scene, m } of allMarkers.filter((x) => !wanted || wanted.includes(x.scene))) for (const it of items.filter((i) => i.category === m.category)) pairs.push({ scene, marker: m, item: it });
}
if (!pairs.length) { console.error('replace-matrix: no pairs'); process.exit(2); }
const scenes = [...new Set(pairs.map((p) => p.scene))];

const sharp = loadSharp(REPO);
const { chromium } = appRequire(REPO)('playwright-core');
const readLedger = () => { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { rows: [] }; } };
const ledgerTotal = (d) => d.rows.reduce((t, r) => t + (r.settled_usd ?? r.reserved_usd ?? 0), 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, file) { const png = await page.screenshot({ type: 'png' }); await sharp(png).webp({ lossless: true }).toFile(file); }
const copyIf = (src, dst) => { if (fs.existsSync(src)) { fs.copyFileSync(src, dst); return path.basename(dst); } return null; };

const results = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
try {
  for (const scene of scenes) {
    const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).split('\n')[0]));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    const tap = (sel) => (PHONE ? page.tap(sel) : page.click(sel));
    const t0 = Date.now();
    await page.goto(`${base}/?key=${encodeURIComponent(key)}&lang=${LANG}&room=${encodeURIComponent(scene)}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__tour && window.__tour.ready === true && window.__tour.liveReady === true, null, { timeout: 90000 });
    const pageInfo = await page.evaluate(() => ({ maxTexture: window.__tour.maxTexture ?? null, recording: window.__tour.recording === true, markers: window.__tour.markers, fitHfov: window.__tour.viewer.getHfov() }));
    const readyMs = Date.now() - t0;
    console.log(`${scene}: ready ${readyMs} ms · recording ${pageInfo.recording} · maxTexture ${pageInfo.maxTexture} · fit hfov ${pageInfo.fitHfov.toFixed(1)}`);
    const look = (p, y, h) => page.evaluate(([pp, yy, hh]) => window.__tour.viewer.lookAt(pp, yy, hh, false), [p, y, h]);
    const rest = () => page.waitForFunction(() => !document.getElementById('pano').classList.contains('is-moving'), null, { timeout: 10000 }).catch(() => {});

    for (const pr of pairs.filter((p) => p.scene === scene)) {
      for (let rep = 1; rep <= REPEAT; rep++) {
        const tag = `${pr.marker.id}-${pr.item.id}${REPEAT > 1 ? '-r' + rep : ''}`;
        const dir = path.join(OUT, tag); fs.mkdirSync(dir, { recursive: true });
        const rec = { pair: tag, scene, lang: LANG, phone: PHONE, repeat: rep, marker: { id: pr.marker.id, category: pr.marker.category, count: pr.marker.count, span_deg: pr.marker.span_deg, yaw: pr.marker.yaw, pitch: pr.marker.pitch }, item: pr.item.id, when: new Date().toISOString(), steps: {}, errors: [] };
        const errAt = errors.length;
        try {
          // 1. the marker in front, the rings at rest
          await look(pr.marker.pitch, pr.marker.yaw, pageInfo.fitHfov); await sleep(500); await rest();
          const ringSel = `.t-mk[data-marker="${pr.marker.id}"]`;
          await page.waitForSelector(ringSel, { timeout: 10000 });
          rec.ring = await page.$eval(ringSel, (n) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width), onScreen: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, label: n.getAttribute('aria-label'), opacity: getComputedStyle(n).opacity }; });
          rec.ringsOnScreen = await page.$$eval('.t-mk', (ns) => ns.map((n) => { const b = n.getBoundingClientRect(); return { id: n.dataset.marker, x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), visible: getComputedStyle(n).opacity !== '0' && b.width > 0 }; }));
          if (rep === 1) await shot(page, path.join(dir, 'rings.webp'));
          if (RINGS_ONLY) {
            // the rings sheet: the ring at rest, then the bar opened and closed by Escape (no item tapped, nothing sent)
            await tap(ringSel);
            await page.waitForSelector('#t-pick:not([hidden]) .t-catalog-item', { timeout: 10000 });
            rec.pick = await page.evaluate(() => ({ chip: document.getElementById('t-pick-chip').textContent, items: [...document.querySelectorAll('#t-catalog-bar .t-catalog-item')].map((b) => ({ id: b.dataset.item, title: b.title })), open: document.querySelectorAll('.t-mk.is-open').length, hintHidden: document.getElementById('t-mk-hint').hidden }));
            await shot(page, path.join(dir, 'pick.webp'));
            await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('t-pick').hidden === true, null, { timeout: 5000 });
            rec.landed = null; rec.ringsOnly = true;
            rec.errors = errors.slice(errAt);
            fs.writeFileSync(path.join(dir, 'turn.json'), JSON.stringify(rec, null, 1) + '\n'); results.push(rec);
            console.log(`${tag.padEnd(34)} rings-only · ring at ${rec.ring.x},${rec.ring.y} on screen ${rec.ring.onScreen} · ${rec.ringsOnScreen.filter((r) => r.visible).length} rings visible · bar «${rec.pick.chip}» ${rec.pick.items.map((i) => i.id).join(',')}`);
            continue;
          }
          // 2. the tap, the pick bar
          await tap(ringSel);
          await page.waitForSelector(`#t-pick:not([hidden]) [data-item="${pr.item.id}"]`, { timeout: 10000 });
          rec.pick = await page.evaluate(() => ({ chip: document.getElementById('t-pick-chip').textContent, items: [...document.querySelectorAll('#t-catalog-bar .t-catalog-item')].map((b) => ({ id: b.dataset.item, selected: b.getAttribute('aria-selected') })), open: document.querySelectorAll('.t-mk.is-open').length, hintHidden: document.getElementById('t-mk-hint').hidden }));
          if (rep === 1) await shot(page, path.join(dir, 'pick.webp'));
          // 3. the turn
          const before = readLedger(); const n0 = await page.evaluate(() => Object.values(window.__tour.live || {}).reduce((a, l) => a + l.length, 0));
          const t1 = Date.now();
          await tap(`#t-catalog-bar [data-item="${pr.item.id}"]`);
          // T18j: the pill's words sampled through the wait — the steps a visitor reads, in order, with the second they first showed
          const steps = []; const sampler = setInterval(async () => { try { const t = await page.evaluate(() => document.getElementById('t-loading-text').textContent); if (t && (!steps.length || steps[steps.length - 1].text !== t)) steps.push({ s: Number(((Date.now() - t1) / 1000).toFixed(1)), text: t }); } catch (_) { /* the page is busy */ } }, 400);
          try { await page.waitForFunction((n0) => { const t = window.__tour; const live = Object.values(t.live || {}).reduce((a, l) => a + l.length, 0); return (t.lastTurn && t.lastTurn.error) || (live > n0 && t.applying === false && t.viewer.isLoaded()); }, n0, { timeout: 240000 }); } finally { clearInterval(sampler); }
          rec.pillSteps = steps;
          rec.steps.turnMs = Date.now() - t1;
          rec.lastTurn = await page.evaluate(() => window.__tour.lastTurn || null);
          rec.pill = await page.evaluate(() => document.getElementById('t-loading-text').textContent);
          rec.landed = !(rec.lastTurn && rec.lastTurn.error);
          await page.waitForFunction(() => window.__tour.applying === false, null, { timeout: 15000 }).catch(() => {});
          if (rec.landed) {
            await sleep(1200);
            rec.live = await page.evaluate(() => { const all = Object.values(window.__tour.liveMeta || {}).flat(); const m = all[all.length - 1]; return m ? { model: m.model, attempt: m.attempt, ring: m.ring, judge: m.judge, usd: m.usd, fraction: m.fraction, item: m.item || null, likeness: m.likeness || null, region_fraction: m.region_fraction ?? null, marker: m.marker ? { before: { yaw: m.marker.before.yaw, pitch: m.marker.before.pitch }, after: m.marker.after } : null } : null; });
            rec.card = await page.evaluate(() => { const c = document.getElementById('t-item-card'); return { shown: !c.hidden, name: document.getElementById('t-item-name').textContent, price: document.getElementById('t-item-price').textContent, note: document.getElementById('t-item-note').textContent, link: document.getElementById('t-item-link').href, linkText: document.getElementById('t-item-link').textContent }; });
            rec.markerAfter = await page.evaluate(([room, mid]) => { const st = window.__tour.hooks.markerState(room, mid); return st ? { item: st.item, yaw: st.yaw, pitch: st.pitch, count: st.count } : null; }, [scene, pr.marker.id]);
            rec.view = rec.lastTurn && rec.lastTurn.view ? rec.lastTurn.view : { yaw: pr.marker.yaw, pitch: pr.marker.pitch, hfov: pageInfo.fitHfov };
            await shot(page, path.join(dir, 'page-after.webp'));
            const views = FIT_ONLY ? [] : [['zoom', 45], ['wide', 100]];
            for (const [name, h] of views) { await look(rec.view.pitch, rec.view.yaw, h); await sleep(700); await shot(page, path.join(dir, `after-${name}.webp`)); }
            await look(rec.view.pitch, rec.view.yaw, pageInfo.fitHfov); await sleep(300);
            // the original at the same fields
            await tap('#t-compare');
            await page.waitForFunction(() => window.__tour.applying === false && window.__tour.original === true && window.__tour.viewer.isLoaded(), null, { timeout: 60000 });
            await sleep(900); await shot(page, path.join(dir, 'page-original.webp'));
            for (const [name, h] of views) { await look(rec.view.pitch, rec.view.yaw, h); await sleep(700); await shot(page, path.join(dir, `original-${name}.webp`)); }
            await look(rec.view.pitch, rec.view.yaw, pageInfo.fitHfov); await sleep(300);
            await tap('#t-compare');
            await page.waitForFunction(() => window.__tour.applying === false && window.__tour.original === false && window.__tour.viewer.isLoaded(), null, { timeout: 60000 });
            await sleep(600);
            // a second tap on the ring: the bar opens with the item selected (no turn sent); Escape closes it
            await rest(); const ringAgain = await page.$(ringSel);
            if (ringAgain) {
              await tap(ringSel).catch(() => {});
              const opened = await page.waitForSelector('#t-pick:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false);
              rec.secondTap = opened ? await page.evaluate(() => ({ chip: document.getElementById('t-pick-chip').textContent, selected: [...document.querySelectorAll('#t-catalog-bar .t-catalog-item')].filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.dataset.item) })) : { opened: false };
              if (opened) { await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('t-pick').hidden === true, null, { timeout: 5000 }).catch(() => {}); }
            } else rec.secondTap = { ring: 'gone' };
            // T18d: the other scenes that see the same piece — the follow-ups' records and a frame of each room with the product in it
            rec.linked = await page.evaluate(() => { const t = window.__tour.lastTurn || {}; return t.linked ? { linked: t.linked, followUps: t.followUps || [] } : null; });
            if (rec.linked) {
              for (const l of rec.linked.linked) {
                const st = await page.evaluate(([room, mid]) => { const s = window.__tour.hooks.markerState(room, mid); return s ? { item: s.item, yaw: s.yaw, pitch: s.pitch } : null; }, [l.room, l.id]);
                l.markerAfter = st;
                await page.evaluate((room) => { const t = window.__tour; const btn = [...document.querySelectorAll('#t-strip .t-card')].find((b) => (b.getAttribute('aria-label') || '').includes(t.hooks.roomName(room))); if (btn) btn.click(); }, l.room);
                await page.waitForFunction((room) => window.__tour.scene === room && window.__tour.applying === false && window.__tour.viewer.isLoaded(), l.room, { timeout: 60000 }).catch(() => {});
                if (st) { await look(st.pitch + 6, st.yaw, 70); await sleep(900); }
                await shot(page, path.join(dir, `linked-${l.room}.webp`));
              }
              await page.evaluate((room) => { const t = window.__tour; const btn = [...document.querySelectorAll('#t-strip .t-card')].find((b) => (b.getAttribute('aria-label') || '').includes(t.hooks.roomName(room))); if (btn) btn.click(); }, scene);
              await page.waitForFunction((room) => window.__tour.scene === room && window.__tour.applying === false && window.__tour.viewer.isLoaded(), scene, { timeout: 60000 }).catch(() => {});
              await sleep(600);
            }
            // undo
            await page.waitForSelector('#t-undo:not([hidden])', { timeout: 10000 });
            await tap('#t-undo');
            await page.waitForFunction((n0) => window.__tour.applying === false && Object.values(window.__tour.live || {}).reduce((a, l) => a + l.length, 0) === n0 && window.__tour.viewer.isLoaded(), n0, { timeout: 60000 });
            rec.markerRestored = await page.evaluate(([room, mid]) => { const st = window.__tour.hooks.markerState(room, mid); return st ? { item: st.item, yaw: st.yaw, pitch: st.pitch } : null; }, [scene, pr.marker.id]);
            // T18d: the linked rooms after the undo — their entries went with the swap, their markers back to the scan's
            if (rec.linked) rec.linkedAfterUndo = await page.evaluate((ls) => ls.map((l) => { const t = window.__tour; const st = t.hooks.markerState(l.room, l.id); return { room: l.room, id: l.id, item: st ? st.item : null, live: (t.live && t.live[l.room] ? t.live[l.room].length : 0) }; }), rec.linked.linked);
            rec.cardAfterUndo = await page.$eval('#t-item-card', (n) => !n.hidden);
          } else {
            await shot(page, path.join(dir, 'page-failed.webp'));
            await page.waitForFunction(() => window.__tour.applying === false, null, { timeout: 15000 }).catch(() => {});
            await page.keyboard.press('Escape').catch(() => {});
          }
          // 4. the ledger's rows of this pair, and the host's recorded files
          await sleep(2500); // the page's account arrives after the turn
          const after = readLedger();
          rec.ledger = { rows: after.rows.slice(before.rows.length).map((r) => ({ seq: r.seq, op: r.op, scene: r.scene, status: r.status, usd: r.settled_usd ?? r.reserved_usd, attempt: r.attempt, held: r.held, score: r.score, seconds: r.seconds, model: r.model })), usd: Number((ledgerTotal(after) - ledgerTotal(before)).toFixed(4)), total: Number(ledgerTotal(after).toFixed(4)) };
          rec.files = {};
          let edits = 0;
          for (const r of rec.ledger.rows) {
            const d = path.join(TURNS, `${String(r.seq).padStart(4, '0')}-${r.op === 'live_edit' ? 'edit' : r.op === 'live_judge' ? 'judge' : r.op === 'live_replace_judge' ? 'replace_judge' : r.op === 'live_likeness' ? 'likeness' : r.op}`);
            if (!fs.existsSync(d)) continue;
            const lk = r.scene && r.scene !== scene ? `linked-${r.scene}-` : ''; // T18d: a follow-up's files carry their scene
            if (lk && !rec.files[lk + 'crop'] && r.op === 'live_edit') rec.files[lk + 'crop'] = copyIf(path.join(d, 'crop.jpg'), path.join(dir, lk + 'crop.jpg'));
            if (r.op === 'live_edit') { if (!lk) edits++; if (!lk && edits === 1) rec.files.crop = copyIf(path.join(d, 'crop.jpg'), path.join(dir, 'crop.jpg')); const a = lk ? (Object.keys(rec.files).filter((k) => k.startsWith(lk + 'result-')).length + 1) : (r.attempt || edits); rec.files[`${lk}result-${a}`] = copyIf(path.join(d, 'result.jpg'), path.join(dir, `${lk}result-${a}.jpg`)); rec.files[`${lk}edit-${a}`] = copyIf(path.join(d, 'answer.json'), path.join(dir, `${lk}edit-${a}.json`)); }
            if (r.op === 'live_replace_judge' || r.op === 'live_judge') { const n = Object.keys(rec.files).filter((k) => k.startsWith(lk + 'judge-')).length + 1; rec.files[`${lk}judge-${n}`] = copyIf(path.join(d, 'answer.json'), path.join(dir, `${lk}judge-${n}.json`)); }
            if (r.op === 'live_likeness') rec.files[lk + 'likeness'] = copyIf(path.join(d, 'answer.json'), path.join(dir, lk + 'likeness.json'));
          }
          // T18d: the follow-ups' page accounts (their own -page folders, named by their first row) — before/after of the linked rooms
          for (const r of rec.ledger.rows) {
            if (!r.scene || r.scene === scene || r.op !== 'live_edit') continue;
            const pd = path.join(TURNS, `${String(r.seq).padStart(4, '0')}-page`);
            if (!fs.existsSync(path.join(pd, 'turn.json'))) continue;
            for (const [k, n] of [['before', 'before.jpg'], ['after', 'after.jpg'], ['after_wide', 'after-wide.jpg']]) rec.files[`linked-${r.scene}-${k}`] = copyIf(path.join(pd, n), path.join(dir, `linked-${r.scene}-${n}`));
          }
          const first = rec.ledger.rows[0] ? rec.ledger.rows[0].seq : 0;
          for (let i = 0; i < 4 && first; i++) { // the page folder may land a moment later
            const pd = path.join(TURNS, `${String(first).padStart(4, '0')}-page`);
            if (fs.existsSync(path.join(pd, 'turn.json'))) {
              for (const [k, n] of [['before', 'before.jpg'], ['after', 'after.jpg'], ['before_wide', 'before-wide.jpg'], ['after_wide', 'after-wide.jpg']]) rec.files[k] = copyIf(path.join(pd, n), path.join(dir, n));
              rec.files.account = copyIf(path.join(pd, 'turn.json'), path.join(dir, 'account.json'));
              break;
            }
            await sleep(1500);
          }
        } catch (e) {
          rec.failure = String(e && e.message || e).split('\n')[0];
          try { await shot(page, path.join(dir, 'page-failure.webp')); rec.pill = await page.evaluate(() => document.getElementById('t-loading-text').textContent); rec.lastTurn = rec.lastTurn || await page.evaluate(() => window.__tour.lastTurn || null); } catch (_) { /* the page is gone */ }
          // leave the room clean for the next pair: undo anything live
          try { await page.evaluate(() => { const t = window.__tour; if (t.live && Object.keys(t.live).length) document.getElementById('t-undo').click(); }); await page.waitForFunction(() => window.__tour.applying === false, null, { timeout: 30000 }); } catch (_) { /* best effort */ }
        }
        rec.errors = errors.slice(errAt);
        rec.ms = Date.now() - (rec.when ? Date.parse(rec.when) : Date.now());
        fs.writeFileSync(path.join(dir, 'turn.json'), JSON.stringify(rec, null, 1) + '\n');
        results.push(rec);
        const j = rec.live && rec.live.judge; const a = rec.lastTurn && rec.lastTurn.attempts ? rec.lastTurn.attempts.length : 0;
        console.log(`${tag.padEnd(34)} ${rec.failure ? 'FAILURE ' + rec.failure : rec.landed ? `held (attempt ${rec.live ? rec.live.attempt : '?'} of ${a}) ring ${rec.live ? rec.live.ring : '?'} kept ${j && j.box_kept !== undefined ? j.box_kept : '-'} rest ${j ? j.rest_unchanged : '-'}/3 likeness ${rec.live && rec.live.likeness ? rec.live.likeness.score : '-'} region ${rec.live ? rec.live.region_fraction : '-'} · 2nd ${rec.secondTap ? (rec.secondTap.opened === false ? '✗' : rec.secondTap.ring === 'gone' ? 'ring gone' : '✓') : '-'}` : `REFUSED after ${a} attempt(s): ${rec.lastTurn && rec.lastTurn.error ? rec.lastTurn.error.key : '?'} «${rec.pill}»`} · ${(rec.steps.turnMs / 1000 || 0).toFixed(1)} s · $${rec.ledger ? rec.ledger.usd : '?'}${rec.errors.length ? ' · page errors ' + rec.errors.length : ''}`);
      }
    }
    await ctx.close();
  }
} finally { await browser.close(); }
const held = results.filter((r) => r.landed && !r.failure).length, refused = results.filter((r) => r.landed === false && !r.failure).length, failed = results.filter((r) => r.failure).length;
const usd = results.reduce((t, r) => t + (r.ledger ? r.ledger.usd : 0), 0);
fs.writeFileSync(path.join(OUT, `matrix-${scenes.join('+')}-${LANG}${PHONE ? '-phone' : ''}${REPEAT > 1 ? '-r' + REPEAT : ''}.json`), JSON.stringify({ apartment: id, scenes, lang: LANG, phone: PHONE, repeat: REPEAT, when: new Date().toISOString(), pairs: results.length, held, refused, failed, usd: Number(usd.toFixed(4)), results }, null, 1) + '\n');
console.log(`DONE ${scenes.join('+')}: ${results.length} pairs, ${held} held, ${refused} refused, ${failed} driver failures, $${usd.toFixed(4)}`);
process.exit(failed ? 1 : 0);
