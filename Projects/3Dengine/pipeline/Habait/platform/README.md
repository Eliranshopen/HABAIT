# Habait platform · lane D v0 (buyer-facing flow)

The flow the owner approved on 2026-11-02:

**open platform → choose project → a 360° flight around the building plays (the buyer rotates the view, the camera travels a scripted path) → at `hold-facade` the apartments are clickable → apartment card → `descend-<unit>` → `enter-<unit>` → hand-off to the apartment 360 tour (external URL).**

Everything in this folder is static: vanilla JS modules + three.js (the only dependency) served by a small Node server with HTTP Range support.

## Run

```bash
cd Habait/platform
npm install            # three.js only
npm start              # http://127.0.0.1:8850/   (PORT=... to change; 8846/8848 belong to other services)
```

- `http://127.0.0.1:8850/` – project chooser (white-label logo/colour from each `project.json`).
- `http://127.0.0.1:8850/flow.html?project=rainbow` – the flight.
- Dev/test query params on `flow.html`: `autostart=1` (skip the start tap; muted autoplay), `seg=<segment id>` (start there), `yaw=&pitch=` (initial view), `lang=he|en`. `window.__habait` exposes the state, `window.__habaitEvents` the analytics buffer.

Tests:

```bash
npm run validate       # contracts on fixtures/rainbow
npm test               # validate + node smoke test (schemas, Range server, lead/analytics helpers)
node test/browser.mjs  # end-to-end in headless Chrome against a running server (needs playwright-core + Chrome; see the file header)
```

## Layout

```
platform/
  index.html, flow.html          the two pages
  css/style.css                  mobile-first, RTL-aware (logical properties), themed by CSS vars
  js/viewer360.js                three.js sphere: VideoTexture / image, drag + wheel + pinch + keyboard + gyro, yaw/pitch -> screen projection
  js/flow.js                     segment sequencing, navigation hotspots, descend/enter, hand-off (apartments via picker.js)
  js/picker.js                   THE apartment picker: unit pills, status legend, unit card, units drawer, unit analytics (shared with :8899)
  js/config.js                   projects.json -> project.json + flow.json + units.json, white-label
  js/i18n.js                     he/en strings, dir switching, price formatting
  js/analytics.js                PostHog-compatible capture(); console unless window.POSTHOG_KEY
  js/lead.js                     wa.me link project|unit|session, lead form -> webhook (Apps Script style)
  contracts/units.schema.json    the units contract (v0)
  contracts/flow.schema.json     the flight contract (v0)
  contracts/validate.mjs         schema + cross-reference validator (no deps)
  fixtures/rainbow/              the Rainbow TLV fixture (see "fixture vs real")
  projects.json                  the list of projects the index shows
  serve.mjs                      static server with Range (206) support
  test/smoke.mjs, test/browser.mjs
```

## Contracts

**`units.json`** – `project`, `currency`, `units[]`: `id, floor, type, rooms, area_m2, outdoor_m2, price (0 = on request), status: for-sale|sold|reserved, tour_url, hotspots[]`, optional `segments: {descend, enter}` and `note`.
A hotspot = `{segment, t_start, t_end, yaw_deg, pitch_deg, polygon?}`: where the unit is on the equirect of that segment during that time window.

**`flow.json`** – `project`, `start`, `defaults: {descend, enter}` (placeholder segments for units that have none yet), `segments[]`: `{id, kind: video|still, src, poster?, duration_s, loop?, role?: approach|orbit|hold|descend|enter, unit?, title?, hotspots?, next}`.
`next` is a segment id, `"handoff"` (open the chosen unit's `tour_url`), `"end"`, or `null` (stay; use with `loop: true`).
Segment `hotspots` are navigational (`action: goto <segment>` / `continue`), unit hotspots live in `units.json`.

**Angles.** `yaw 0` = the centre of the equirect (u = 0.5), positive to the right (clockwise from above); `pitch` positive up. `yaw = (u − 0.5)·360`, `pitch = (0.5 − v)·180`. The same convention as the u/v in `tour360/apartments/apt846/exterior.json`.

**`project.json`** – `id, name{he,en}, tagline, brand{logo, primary, accent, background}, flow, units, cover, leads{whatsapp_number, webhook_url}, disclaimer, fixture`.

## Add a project

1. `mkdir fixtures/<id>` (or any folder) with `project.json`, `flow.json`, `units.json` and the media (equirect 2:1: mp4 for `video`, png/jpg/webp for `still`).
2. Add `{ "id": "<id>", "dir": "<folder>" }` to `projects.json`.
3. `node contracts/validate.mjs <folder>` until it is clean; warnings tell you which units still use the placeholder descend.
4. Per unit, add a hotspot on the `hold` segment (and optionally time windows on the moving segments). For a real render, the yaw/pitch per frame come from projecting the unit's bbox into the equirect (lane C, C4); for a still they can be read off the image.
5. Set `leads.whatsapp_number` and `leads.webhook_url` (a Google Apps Script web app that appends the JSON body to a sheet). Set `window.POSTHOG_KEY` (and optionally `window.POSTHOG_HOST`) in `flow.html` to ship analytics; without it every event is logged to the console.

## Fixture vs real (`fixtures/rainbow`)

| | fixture now | real later |
|---|---|---|
| `node-*.png` | clay exteriors from `studio/_local/projects/apt846-rainbow-tlv/renders/clay-pano`, downscaled 4096→2048 | skinned renders (lane C) |
| `approach.mp4` (8 s) | ffmpeg zoom + crossfade aerial→tower; not a camera path | EEVEE/Kaggle equirect flight, 4096×2048, HLS segments |
| `orbit` | a still of node-b-tower (3 s) | `orbit.mp4` |
| `hold-facade` | still, looping | short looping video |
| `descend-846.mp4` (4 s) | crossfade facade→terrace | the real descent |
| `enter-846` | still of the terrace (3 s) | `enter-846.mp4` ending at the living room |
| other 11 units | invented (floors 14–19, types K/L/M/PH, prices, statuses); they fall back to `descend-846` | from the developer's price list; own descend/enter per type×floor |
| `tour_url` | `http://127.0.0.1:8848/?room=living` (the tour360 server, run separately) | the published tour URL |
| `logo.svg`, colours | placeholder | the developer's brand after approval |
| WhatsApp number, webhook, PostHog key | `972500000000`, empty, none | real |

## What the player does

- One `<video muted playsinline>` is reused for every video segment (iOS unlocks it on the start tap); stills go through `TextureLoader`. A second hidden video preloads the next segment.
- Hotspots are DOM buttons positioned every frame from `yaw/pitch` through the camera projection, hidden when behind the camera; status dot green/amber/red; hover and click are captured.
- Gyro: on touch devices a ◎ button asks for `DeviceOrientationEvent` permission (iOS 13+) and switches to device orientation + drag yaw offset.
- Hand-off adds `from=flight&sid=<session>` to the tour URL.
- Fallback: a `still` segment behaves exactly like a video segment (same controls, timer-based hotspots), so a slow network can be served stills only.

## picker.js for other viewers

`js/picker.js` is the one implementation of the apartment picker: the pills (number + "קומה N · K חדרים" + status dot: for-sale green, reserved orange, sold red, unknown grey), the unit card, the units drawer grouped by floor, and the unit/lead analytics. `flow.html` uses it, and habait-89's three.js hold on :8899 loads the same file cross-origin. Fix the picker here, once, and both viewers get the fix. The module has no bundler and no dependencies: it imports `i18n.js`, `analytics.js` and `lead.js` relative to its own URL. `serve.mjs` answers every file with `Access-Control-Allow-Origin: *`, and `test/smoke.mjs` checks that header on `.js/.css/.json`.

Load it from another origin (the server must be running: `npm start`):

```html
<link rel="stylesheet" href="http://127.0.0.1:8850/css/style.css">
<div id="stage" style="position:fixed; inset:0"></div>   <!-- or document.body -->
<script type="module">
  import { createPicker } from 'http://127.0.0.1:8850/js/picker.js';
  import * as i18n from 'http://127.0.0.1:8850/js/i18n.js';            // same URLs as picker.js's own imports,
  import * as analytics from 'http://127.0.0.1:8850/js/analytics.js';  // so all of them share one module instance
  const get = (f) => fetch('http://127.0.0.1:8850/fixtures/rainbow/' + f).then((r) => r.json());
  const [units, project] = await Promise.all([get('units.json'), get('project.json')]);
  analytics.initAnalytics({ base: { project: project.id, lang: i18n.getLang() } });

  const picker = createPicker({ units, container: document.getElementById('stage'), i18n, analytics, project,
    onEnter(unit) { flyToApartment(unit); } });          // the card's "continue" button

  function frame() {
    // CSS px relative to the container. Return null when the unit is not in this shot (no pill, and the
    // title/legend/hint hide when every unit is null); return visible:false when it is behind the camera.
    picker.update((u) => {
      if (!atHold) return null;
      const v = unitWorldPos(u).clone().project(camera);
      return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
    });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // picker.select('846'); picker.close(); picker.setLang('en'); picker.destroy();
</script>
```

The contract:

| call | does |
|---|---|
| `createPicker({ units, container, i18n, analytics, project, onEnter })` | `units` = units.json (object or its `units` array); `container` = the element the pills, card, drawer and chrome are added to; `i18n` = the i18n module (`t, getLang, setLang, applyI18n`; `pick` and `formatPrice` are used when present); `analytics` = an object with `capture(event, props)` (`sessionId()` and `unitsViewed()` are used when present); `project` = project.json (`id, name, leads, disclaimer`) |
| `picker.update(projectFn)` | call every frame. `projectFn(unit)` returns `{ x, y, visible }` or `null`. It creates, moves and hides the pills and keeps the `selected` class on the open unit |
| `picker.select(unitId)` | highlights the pill and opens the card (sends `unit_click` with `from: 'api'`) |
| `picker.close()` | closes the card and the drawer (Escape does the same) |
| `picker.setLang('he' \| 'en')` | calls `i18n.setLang`, which flips `<html dir>`, then re-labels the pills, card, drawer and chrome and sets `dir` on the picker's own elements |
| `picker.destroy()` | removes its DOM and its listeners |

The card shows floor, rooms, m², outdoor m², the price (or "מחיר לפי פנייה"), the status badge and the type. Its buttons:
- "המשיכו אל הדירה" sends `unit_enter`, closes the card and calls `onEnter(unit)`.
- "לסיור 360°" links to `unit.tour_url` and sends `tour_handoff`.
- "עמוד הדירה" links to `<:8850>/apartment.html?project=&unit=&sid=&from=flight` and sends `unit_click {channel: 'apartment_page'}`.
- WhatsApp links to `wa.me/<number>?text=…<project>|<unit>|<session>` and sends `lead_click`.
- "השאירו פרטים" opens the lead form (`lead.js`), which sends `lead_click` and `lead_submitted`.

`project.disclaimer` is shown at the bottom of the card. A drawer row only selects the unit; it never calls `onEnter`. Events: `unit_hover` (once per unit until `resetHover()`), `unit_click`, `unit_enter`, `tour_handoff`, `lead_click`, `lead_submitted`, all through the `analytics` you pass, with the same props as before the split.

**Chrome.** By default (`chrome: true`) the picker draws:
- the title "מול החזית · בחרו דירה" (override it with `title: {he, en}`);
- a status legend of the statuses present;
- the hint (`hud.hintHold`);
- a "▤ דירות" button that opens the drawer;
- the legal line from `project.disclaimer`.

Pass `chrome: { legend: false, … }` to drop parts. Move the chrome clear of your own bars with the CSS variables `--picker-top` and `--picker-bottom`. `flow.html` passes `chrome: false` because its HUD already has all of this.

**Optional hooks.** `flow.js` uses these to keep its flight behaviour; other viewers can ignore them:
- `onSelect(unit, from)` runs before the card opens.
- `onTour(unit)`.
- `canEnter(unit)` returns false to disable "continue".
- `cardNote(unit)` adds a note under the actions.
- `enterProps(unit)` adds extra `unit_enter` props.
- `context()` adds extra hover/click props, for example `{ segment }`.
- `layer` is an existing element that hosts the pills.
- `apartmentUrl` is `(unit, sid) => url`; pass `false` to hide the link.

Extra methods: `enter(id)`, `closeCard()`, `toggleDrawer(force?)`, `resetHover()`, `relabel()`, `isCardOpen()`, `isDrawerOpen()`, `cardUnit`, `elements`.

**Notes for hosts.**
- The card and drawer keep the ids flow.html always had (`#unitSheet`, `#unitBody`, `#unitContinue`, `#unitTour`, `#unitPage`, `#unitsDrawer`), so use one picker per page.
- `css/style.css` also carries page-level rules: `* {box-sizing}`, `html, body {margin:0; height:100%}`, the `body` background/font, `button {font: inherit}` and `[hidden] {display:none !important}`. Load it before your own `<style>` if you want yours to win.
- The analytics session id comes from the host origin's `sessionStorage`, so :8899 has its own `session_id` unless it adopts the one :8850 passes in the URL.

`test/browser.mjs` section 4 covers this contract. It serves a blank page from a second origin, imports the picker from :8850 with units.json and a fake `projectFn`, and asserts:
- 12 pills, and one pill hidden by `visible: false`;
- the chrome;
- `select('846')`, the card, and its links;
- the events;
- `onEnter` firing from "continue" but not from the drawer;
- `setLang('en')`;
- `close()` and `destroy()`.

## Known gaps (v0)

- `polygon` in a hotspot is accepted but not drawn; v0 shows the marker only.
- No HLS; plain mp4 with Range. Fine for ≤ 30 s segments, switch to HLS for the full flight.
- Placeholder videos are crossfades of stills, so there is no real parallax while "flying".
- No availability turntable tab yet in the UI (C6: `Habait/flyover/turntable/_local/turntable.json` exists, card 21); ZIP per unit = `tools/build_zip.mjs` (card 23); admin = `build_units.mjs` (card 26, see "איך משנים סטטוס").
- Analytics without a key only logs; `unit_hover` is sent once per unit per segment.

## Level split (Eliran, 2026-11-02 afternoon)
- **Project level** (building + surroundings, pick an apartment): `project.json → exterior.mode = "external"` sends the project card to habait-89's interactive projection flyover (`http://127.0.0.1:8899/?tour=…&return=…&project=…`). `flow.html` stays as the internal placeholder player (`flow.html?project=rainbow`) and for tests.
- **Apartment level** (only that apartment's scenes in the strip): the flyover hands off to the tour with `scope=apartment&from=flight`; habait-16's viewer hides `exterior: true` scenes under that flag and shows a "back to the building" link to `return`.

## איך משנים סטטוס

1. פותחים את קובץ הסטטוסים (היום `Habait/platform/_local/units-status.csv`, נפתח ב-Excel; אחרי שתבחר Google Sheet, הגיליון שלך) ומשנים בשורה של הדירה את `status` ל-פנוי / שמור / נמכר ואת `price` למחיר בשקלים (0 = מחיר לפי בקשה). תא ריק = בלי שינוי.
2. שומרים, ומריצים מתיקיית `Habait/platform`: `node build_units.mjs --source _local/units-status.csv --units fixtures/rainbow/units.json` (או מבקשים מ-Claude "תעדכן סטטוסים").
3. אם משהו לא תקין (סטטוס לא מוכר, מחיר שאינו מספר, דירה כפולה) מופיעה הודעת FAIL בעברית והאתר לא משתנה; אחרת הבוחר וכרטיס הדירה מראים את הסטטוס החדש ברענון הדף, וגיבוי של הקובץ הקודם נשמר לידו (`units.json.bak-<תאריך-שעה>`).

Technical notes (card 26, D4; `build_units.mjs`, test `node test/build_units.test.mjs`):
- `--source`: a local CSV or `.json`; a published Google Sheet CSV (`https://docs.google.com/spreadsheets/d/e/<id>/pub?gid=<tab>&single=true&output=csv`); or an Apps Script `/exec` URL that returns `[{unit,status,price,note}]`, `{rows:[…]}` or `{values:[[header…],[row…]]}`. The card-24 `apps-script/lead-to-sheet.gs` does not serve this today (its `doGet` is a health check only).
- Columns by name (`unit,status,price,note` or `דירה,סטטוס,מחיר,הערה`), any order, extra columns ignored. Status → the existing units.v0 enum (`available`/`פנוי` → `for-sale`, `reserved`/`שמור`, `sold`/`נמכר`); prices → integer ILS (`₪7,950,000.00` → `7950000`). Note `-` clears it; a leading machine `box_source: …;` clause (Habait/engine) is kept. A sheet id `846` also matches `apt846`.
- Only `status`/`price`/`note` change: the three value spans are spliced into the original text, so every other byte (geometry, hotspots, key order, CRLF, escapes) stays identical. Validated with `contracts/validate.mjs` (+ the flow cross-check when `flow.json` sits next to the file) before writing. Exit 0 ok / 1 FAIL, nothing written / 2 usage. `--dry-run` prints the changes; `--out` writes elsewhere; `--dist _local/dist/rainbow` updates `unit.status`/`unit.price` in each `apartment.json` (the ZIP is not rebuilt).
- Copies of the status that do NOT follow automatically: `Habait/flyover/turntable/_local/turntable.json` (bakes `status` per hotspot; rerun `turntable.py`), the dist ZIP's `unit.json` (`tools/build_zip.mjs`), and the Vercel copy (redeploy).
