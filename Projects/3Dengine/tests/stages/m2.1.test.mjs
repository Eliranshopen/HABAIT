// Milestone 2.1, the closing test (contract 2.1 §11; plan §7.1 row 2.1): the render as an engine stage, on REAL
// processes: the real reading tool, the real build tools and real Blender, at $0, on a temp home. A real job of the
// golden 846 PDF from the kept fixture reading, the render limited to TWO points at the smallest picture the chain
// renders (1024x512) and few samples: the mechanics do not depend on the picture's size (the full size was rendered
// once by hand, in the proof of task 01).
//
//   1. two rooms, the runner KILLED in the middle of the second, and a resume: the first room is not rendered again
//      (its row and its three files are the same bytes, and the tool was started for it once); the second is
//      rendered; the living room's three files are in the job; no process, no lock and no name of the job is left
//   2. a second run on the same input starts no tool
//   3. the same room rendered again is the same picture (contract 2.1 §7)
//   4. nothing the reading took from the drawing is in an answer, a job record, a room's row or the runner's log
//
// One Blender at a time on this machine (root CLAUDE.md §12): the stage waits for the machine's lock, and so does
// this test. A wait for another session's render is time, not a failure.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startRealHome, textsOf, FIXTURES, GOLDEN, GOLDEN_SHA } from './real-home.mjs';
import { workspaceOf, unlinkWorkspace, linkState, PARTS } from '../../engine/workspace.mjs';
import { builtPoints, BUILD_OUTPUTS } from '../../engine/build.mjs';
import { ROOM_FILES, roomInputs } from '../../engine/render.mjs';
import { heldRoom, roomName, ROOMS_REL, ROOM_SCHEMA_ID } from '../../engine/stages/rendering.mjs';
import { readLock, release } from '../../engine/blender-lock.mjs';
import { processesNaming, stopNaming } from '../../engine/lib/tool.mjs';
import { sha256FileSync } from '../../engine/lib/hash.mjs';
import { pidAlive } from '../../engine/lib/proc.mjs';

const READING = `${FIXTURES}/apt846/saved-reading.json`;
const LIMIT_MS = 25 * 60 * 1000;
const WAIT_MS = 20 * 60 * 1000;
const POINTS = ['cp-kitchen', 'cp-livingRoom'];
const RENDER = { res: '1024x512', samples: 4, points: POINTS, timeoutSeconds: 900, lockPollSeconds: 2 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let h;
let dir = null;
let ws = null;
let jobId = null;
let pdf = null;
let places = null;          // { first, second }: the places of the two rooms in the plan's order (the second is the living room)
const kept = (place, f) => `${dir}/${ROOMS_REL}/${roomName(place)}${f ? `/${f}` : '.json'}`;
const snapshot = (place) => [sha256FileSync(kept(place)), ...ROOM_FILES.map((f) => sha256FileSync(kept(place, f)))];
const toolLog = (place) => `${ws.logs}/render-${roomName(place)}.log`;
const doneLines = (file) => (fs.existsSync(file) ? (fs.readFileSync(file, 'utf8').match(/render done in \d+ s/g) || []).length : 0);
const until = async (what, said, ms = WAIT_MS) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = what();
    if (v) return v;
    const job = h.readJson(`${dir}/job.json`);
    if (job && ['failed', 'review', 'cancelled'].includes(job.state)) throw new Error(`the job ended ${job.state} (${job.reason?.code}: ${job.reason?.message}) while the test waited for ${said}`);
    if (Date.now() > end) throw new Error(`waited too long for ${said}; the job is in ${job?.state}${job?.waiting_for ? `, waiting for the ${job.waiting_for}` : ''}`);
    await sleep(500);
  }
};

before(async () => {
  h = await startRealHome({ prefix: 'm21-home-', readings: { [GOLDEN_SHA]: READING }, settings: { render: RENDER } });
});
after(async () => {
  if (ws) {
    stopNaming(ws.id);                        // whatever of this job's tools is still alive
    unlinkWorkspace(ws);                      // the job's three names in the pipeline tree, when a failure left them
  }
  if (h) {
    try {
      release(h.config.blenderLock);          // only when it names THIS process: it never does; a lock of a runner is the runner's
    } catch { /* the guard is busy */ }
    await h.stop();
  }
});

test('1. two rooms, the runner killed in the middle of the second, a resume: the first room is not rendered again, the second is; nothing of the job is left running or locked', { timeout: LIMIT_MS }, async () => {
  pdf = `${h.inbox}/rainbow-846.pdf`;
  fs.copyFileSync(GOLDEN, pdf);
  const s = await h.ok('start_simulation', { pdf_path: pdf });
  assert.deepEqual([s.created, s.job.mode], [true, 'real']);
  jobId = s.job_id;
  dir = h.jobDir(jobId);
  ws = workspaceOf(h.config, dir, jobId);

  // the reading and the build, for real
  await until(() => fs.existsSync(`${dir}/stages/rendering`), 'the build to end');
  const all = builtPoints(ws);
  assert.equal(all.length, 10, 'ten camera points in the built plan of 846');
  places = { first: all.indexOf('cp-kitchen') + 1, second: all.indexOf('cp-livingRoom') + 1 };
  assert.ok(places.first > 0 && places.second > places.first, `the kitchen comes before the living room in the plan's order (${places.first}, ${places.second})`);

  // the first room is rendered and kept
  await until(() => fs.existsSync(kept(places.first)), 'the first room\'s row (the reading, the build, the machine\'s Blender lock, the scene, one render)');
  const first = snapshot(places.first);
  const firstRow = h.readJson(kept(places.first));
  assert.deepEqual([firstRow.schema, firstRow.place, firstRow.res, firstRow.samples, firstRow.attempt], [ROOM_SCHEMA_ID, places.first, '1024x512', 4, 1]);

  // in the middle of the second room: its tool has started; the runner is killed (its tool and Blender are not)
  await until(() => fs.existsSync(toolLog(places.second)), 'the tool of the second room to start');
  await sleep(6000);
  assert.equal(fs.existsSync(kept(places.second)), false, 'the second room has no row yet');
  const runner = Number(fs.readFileSync(`${dir}/runner.pid`, 'utf8').trim());
  assert.equal(pidAlive(runner), true);
  process.kill(runner, 'SIGKILL');
  await until(() => !pidAlive(runner), 'the runner to be gone', 20000);
  const left = { processes: processesNaming(ws.id).length, lock: readLock(h.config.blenderLock), names: PARTS.map((p) => linkState(ws.links[p], ws[p])) };
  assert.equal(h.readJson(`${dir}/job.json`).state, 'rendering', 'the job file still says rendering');
  if (left.lock.state === 'held') assert.deepEqual([left.lock.own, left.lock.pid, left.lock.alive, left.lock.mark], [true, runner, false, ws.id], 'the machine\'s lock is left in the dead runner\'s name');

  // the resume
  const again = await h.ok('start_simulation', { pdf_path: pdf });
  assert.deepEqual([again.created, again.job_id], [false, jobId]);
  const { job, seen } = await h.follow(jobId, ['awaiting_approval', 'failed', 'review', 'cancelled'], WAIT_MS);
  assert.equal(job.state, 'awaiting_approval', `the job ended ${job.state} (${job.reason?.code}: ${job.reason?.message}); it was seen in ${seen.join(' → ')}`);

  // the first room was NOT rendered again: the same bytes, and the tool was started for it once
  assert.deepEqual(snapshot(places.first), first, 'the first room\'s row and its three files are the same bytes');
  assert.equal(doneLines(toolLog(places.first)), 1, 'one render of the first room');
  assert.equal(doneLines(toolLog(places.second)), 1, 'one render of the second room that ended (the killed one did not)');
  // the living room: its three files are in the job, and its row says so
  const row = h.readJson(kept(places.second));
  assert.deepEqual([row.place, row.attempt, row.files.map((f) => f.name)], [places.second, 2, [...ROOM_FILES]]);
  for (const f of row.files) {
    assert.ok(f.bytes > 1000, `${f.name}: ${f.bytes} bytes`);
    assert.equal(sha256FileSync(kept(places.second, f.name)), f.sha256);
    assert.equal(sha256FileSync(`${ws.tour}/renders/cp-livingRoom/${f.name}`), f.sha256, 'the tool\'s own copy is the same bytes');
  }
  const sidecar = h.readJson(kept(places.second, 'pano.render.json'));
  assert.deepEqual([sidecar.projection.resolution, sidecar.render.samples, sidecar.render.seed], [[1024, 512], 4, 0]);
  // the manifest: three real rows; the render's outputs are named by place
  const rows = h.readJson(`${dir}/manifest.json`).rows.filter((r) => !r.superseded);
  assert.deepEqual(rows.map((r) => [r.stage, r.status, r.cost_usd]), [['tracing', 'done', 0], ['building', 'done', 0], ['rendering', 'done', 0]]);
  assert.deepEqual(rows[1].outputs.map((o) => o.path), BUILD_OUTPUTS.map((f) => `work/${f}`));
  assert.deepEqual(rows[2].outputs.map((o) => o.path), [places.first, places.second].flatMap((p) => [`${ROOMS_REL}/${roomName(p)}.json`, ...ROOM_FILES.map((f) => `${ROOMS_REL}/${roomName(p)}/${f}`)]));
  assert.deepEqual(h.readJson(`${dir}/job.json`).attempts, { tracing: 1, building: 1, rendering: 2 });
  assert.equal(heldRoom(dir, places.second, roomInputs(rows[2].inputs_sha256, 'cp-livingRoom', RENDER)).place, places.second, 'the row\'s input hash is the stage\'s, the point, the size and the samples');
  const log = fs.readFileSync(`${dir}/runner.log`, 'utf8');
  assert.match(log, new RegExp(`rendering: room ${places.first} of 10 rendered in [\\d.]+ s \\(1024x512, 4 samples\\)`));
  assert.match(log, /rendering: rendered: 2 of the plan's 10 rooms \(1 now, 1 held already\), [\d.]+ s/);
  if (left.lock.state === 'held') assert.match(log, /a Blender lock left by a dead engine runner was removed \(\d+ leftover processes stopped first\)/);
  // nothing of the job is left: no process, no lock of the engine, no name in the pipeline tree
  assert.deepEqual(processesNaming(ws.id), [], `no process of the job is alive (the killed runner had left ${left.processes})`);
  const lock = readLock(h.config.blenderLock);
  assert.equal(lock.state === 'held' && lock.own && lock.mark === ws.id, false, 'the machine\'s Blender lock is not left in this job\'s name');
  assert.deepEqual(PARTS.map((p) => linkState(ws.links[p], ws[p])), ['free', 'free', 'free'], 'no name of the job in the pipeline tree');
  assert.equal(job.cost.spent_usd, 0);
});

test('2. a second run on the same input starts no tool', { timeout: LIMIT_MS }, async () => {
  assert.ok(places, 'part 1 did not get as far as the rooms');
  const before = { logs: [places.first, places.second].map((p) => fs.statSync(toolLog(p)).size), build: fs.statSync(`${ws.logs}/build.log`).size,
    rooms: [snapshot(places.first), snapshot(places.second)], attempts: h.readJson(`${dir}/job.json`).attempts };
  await h.ok('cancel_job', { job_id: jobId });
  await h.runnersGone();            // the runner that waited for the approval ends with the cancel
  const s = await h.ok('start_simulation', { pdf_path: pdf });
  assert.deepEqual([s.created, s.job_id], [false, jobId]);
  const { job, seen } = await h.follow(jobId, ['awaiting_approval', 'failed', 'review'], 120000);
  assert.equal(job.state, 'awaiting_approval', `the job ended ${job.state} (${job.reason?.code}: ${job.reason?.message}); it was seen in ${seen.join(' → ')}`);
  assert.deepEqual(h.readJson(`${dir}/job.json`).attempts, before.attempts, 'no stage ran again');
  assert.deepEqual([places.first, places.second].map((p) => fs.statSync(toolLog(p)).size), before.logs, 'the render tool was not started');
  assert.equal(fs.statSync(`${ws.logs}/build.log`).size, before.build, 'the build tool was not started');
  assert.deepEqual([snapshot(places.first), snapshot(places.second)], before.rooms);
});

test('3. the same room rendered again is the same picture: the depth bit for bit, the colour picture within the tolerance', { timeout: LIMIT_MS }, async () => {
  assert.ok(places, 'part 1 did not get as far as the rooms');
  const save = `${h.home}/first-render`;
  fs.mkdirSync(save);
  for (const f of ROOM_FILES) fs.copyFileSync(kept(places.second, f), `${save}/${f}`);
  const firstKitchen = snapshot(places.first);
  // the job no longer holds the living room: its row is taken away, so the stage renders it again (contract 2.1 §4)
  await h.ok('cancel_job', { job_id: jobId });
  await h.runnersGone();            // the runner that waited for the approval ends with the cancel
  fs.rmSync(kept(places.second));
  const s = await h.ok('start_simulation', { pdf_path: pdf });
  assert.equal(s.job_id, jobId);
  const { job, seen } = await h.follow(jobId, ['awaiting_approval', 'failed', 'review'], WAIT_MS);
  assert.equal(job.state, 'awaiting_approval', `the job ended ${job.state} (${job.reason?.code}: ${job.reason?.message}); it was seen in ${seen.join(' → ')}`);
  assert.equal(doneLines(toolLog(places.second)), 2, 'the living room was rendered a second time');
  assert.equal(doneLines(toolLog(places.first)), 1, 'and the kitchen was not');
  assert.deepEqual(snapshot(places.first), firstKitchen);

  // the depth: the same file, and the same packed pixels by the tool's own record
  assert.equal(sha256FileSync(kept(places.second, 'depth.png')), sha256FileSync(`${save}/depth.png`), 'depth.png is the same bytes');
  const packed = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).depth_stats.packed_data_sha256;
  assert.equal(packed(kept(places.second, 'pano.render.json')), packed(`${save}/pano.render.json`));
  // the colour picture: at most 1 % of its values differ, and the mean difference is under 0.5 of 255
  const sharp = createRequire(`${h.config.appDepsDir}/`)('sharp');
  const raw = (f) => sharp(f).raw().toBuffer({ resolveWithObject: true });
  const [a, b] = [await raw(`${save}/pano.webp`), await raw(kept(places.second, 'pano.webp'))];
  assert.deepEqual([a.info.width, a.info.height, b.info.width, b.info.height], [1024, 512, 1024, 512]);
  let differ = 0;
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) {
    const d = Math.abs(a.data[i] - b.data[i]);
    if (d) {
      differ += 1;
      sum += d;
    }
  }
  const share = differ / a.data.length;
  const mean = sum / a.data.length;
  assert.ok(share <= 0.01 && mean < 0.5, `the colour picture: ${(100 * share).toFixed(4)} % of the values differ, mean difference ${mean.toFixed(5)} of 255`);
  // and it is a picture: not one flat colour
  assert.ok(new Set(a.data.subarray(0, 30000)).size > 20, 'the picture has many values');
  assert.deepEqual(processesNaming(ws.id), []);
  assert.deepEqual(PARTS.map((p) => linkState(ws.links[p], ws[p])), ['free', 'free', 'free']);
});

test('4. no answer of a tool, no job record, no room\'s row and no line of the runner\'s log holds a name the reading took from the drawing', () => {
  assert.ok(places, 'part 1 did not get as far as the rooms');
  const names = textsOf(JSON.parse(fs.readFileSync(READING, 'utf8')));
  assert.ok(names.length >= 10, `the reading names ${names.length} things`);
  // the point names are made from the reading's room names: they count as its text too
  const words = [...names, 'cp-kitchen', 'cp-livingRoom', 'livingRoom', 'masterBedroom'];
  const places2 = [places.first, places.second];
  const texts = {
    'the tools\' answers': h.lines.join('\n'),
    'job.json': fs.readFileSync(`${dir}/job.json`, 'utf8'),
    'manifest.json': fs.readFileSync(`${dir}/manifest.json`, 'utf8'),
    'runner.log': fs.readFileSync(`${dir}/runner.log`, 'utf8'),
    ...Object.fromEntries(places2.map((p) => [`the row of room ${p}`, fs.readFileSync(kept(p), 'utf8')])),
  };
  for (const [where, text] of Object.entries(texts)) {
    const found = words.filter((w) => text.includes(w));
    assert.deepEqual(found.length, 0, `${where} holds ${found.length} of the drawing's names`);
  }
  // (the tools' own files in the job's workspace do hold names, as the reading's folder does; no answer copies from them)
  assert.equal(fs.readFileSync(`${ws.apartment}/plan.general.json`, 'utf8').includes('cp-livingRoom'), true);
});
