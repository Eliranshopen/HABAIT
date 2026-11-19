/* Habait Tour360 — tour.js (T01 the tour, T08 the prepared changes, T09 the live typed change; board habait-tour360).
   Reads #tour-data ({ id, apartment, scenes, copy, edits, panoWidth }), builds the Pannellum multi-scene tour, the room strip,
   the floor-plan sheet, the language switch and the change panel. The three disclosure elements (#tour-badge, #tour-concept,
   #tour-ai-note) are re-filled from the copy pack in the current language on every render and are never hidden (root CLAUDE.md §6).
   Geometry: a room opens at its `heading`, pitch -2 (the source tour's visit()); a hotspot sits at yaw (u - 0.5) * 360 and pitch
   -12 - min(5, (v - 0.6) * 35) (the source tour's markerDirection) — PLAN.md D-T360-16, scenes.json coordinateNotes.
   Changes (PLAN.md §9): a prepared change is a small RGBA patch in panorama pixels, made offline by tools/edit-pano.py; a live
   change (viewer/edit-live.js, behind the unlock code) is a whole edited panorama kept only in this browser session. The page
   draws the chosen patches over the room's current look on a canvas and hands Pannellum the result as one more scene,
   `<room>[~liveN][~ids]`; the base panorama is never altered and the original is one tap away. */
(() => {
  'use strict';

  const data = JSON.parse(document.getElementById('tour-data').textContent);
  const params = new URLSearchParams(location.search);
  // an in-tour reload (the floor switch re-opens the page in that floor's panorama set) carries a one-shot ?ir=1: the walkthrough does not
  // open again for it (Eliran 2026-11-08: «כל פעם שאני משנה עיצוב זה מתחיל מחדש את הסשן של ההסבר… אני לא רוצה שזה יקרה»). The mark is
  // stripped from the address at once, so a manual reload, a new tab or a pasted link is a new visit and opens it (as he asked before).
  const internalReload = params.get('ir') === '1';
  if (internalReload) { try { const u = new URL(window.location.href); u.searchParams.delete('ir'); window.history.replaceState(window.history.state, '', String(u)); } catch (_) { /* a sandbox */ } }
  /* 2026-11-02 (Eliran via habait-ab: "שלא יהיה בלבול"): two levels. The project level = the building and its surroundings (the
     flyover on :8899, or this tour's own exterior nodes); the apartment level = this apartment only. `?scope=apartment` keeps
     only the apartment's scenes (strip, counter, plan, doors) and shows a "back to the building" link to `return`
     (default: the flyover). Without the param the tour is as before: it opens on the aerial node and walks the whole chain. */
  const scope = params.get('scope') === 'apartment' ? 'apartment' : 'project';
  // ?ui=min (habait-ba, 2.11 evening, Eliran: the buyer flow must feel calm): only the room name, the room strip, the floor switch,
  // the way back and the language stay; the tool cluster, the look toggle, the AI note, the counter/hint and the badge are hidden.
  // ?ui=min, or any arrival from the buyer flow (?from=flight | hold | platform, 1d's flow.html and ba's hold): the quiet chrome
  if (params.get('ui') === 'min' || ['flight', 'hold', 'platform'].includes(params.get('from'))) document.documentElement.classList.add('ui-min');
  if (['flight', 'hold', 'platform'].includes(params.get('from'))) document.documentElement.classList.add('ui-enter');   // the chrome fades in after the landing (1d, M1 v2)
  const scenes = scope === 'apartment' ? data.scenes.filter((s) => !s.exterior) : data.scenes;
  const copy = data.copy;
  const apt = data.apartment;
  // the way back out of the apartment: ?return= wins; else the apartment's own returnUrl (run-project.mjs writes the project page);
  // the :8899 literal is apt846's laptop hold and stays only as the last fallback (project-runner, 2026-11-04)
  const returnUrl = scope === 'apartment' ? (params.get('return') || apt.returnUrl || 'http://127.0.0.1:8899/') : null;
  const edits = data.edits || {};
  const byId = Object.create(null);
  scenes.forEach((s, i) => { s.index = i; byId[s.id] = s; });

  const LANGS = ['he', 'en', 'fr'];
  let lang = LANGS.includes(params.get('lang')) ? params.get('lang') : 'he';
  const firstId = byId[params.get('room')] ? params.get('room') : (byId[apt.defaultScene] ? apt.defaultScene : scenes[0].id);
  /* the landing yaw of a deep link (2026-11-02, habait-98): `?yaw=` wins; else a room reached by `?room=` (the :8899 / :8850
     hand-off lands on terraceLiving) opens with the yaw the automatic hop lands with (its predecessor's autoYaw in exterior.json,
     so the hand-off and the descent face the same way: the slider and the living room, not the blank side wall at heading 0);
     else the scene's heading. */
  const firstYaw = (() => {
    const q = parseFloat(params.get('yaw'));
    if (Number.isFinite(q)) return q;
    if (!params.get('room')) return null;
    const pred = data.scenes.find((x) => x.autoNext === firstId && Number.isFinite(x.autoYaw));
    return pred ? pred.autoYaw : null;
  })();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const $ = (id) => document.getElementById(id);
  const pick = (map) => (map && (map[lang] || map.he)) || '';
  const ui = (key) => (copy.ui[key] ? pick(copy.ui[key]) : ''); // a key the pack lacks reads as nothing (T18l: `catalogRefused` until his words)
  // board dollhouse-in-tour (2026-11-03): the 3D dollhouse over the tour, shown when the build carried it (data.dollhouse).
  // 2026-11-06 (Eliran: «פעם לחיצה על הכפתור הזה הייתה מובילה לתלת מימד»): in EVERY context (/tour/, the apartment page, the /hold/
  // overlay) the map button opens it with the rise; the plan sheet is the map button's job only when there is no dollhouse
  const DH_UI = { title: { he: 'תלת-ממד', en: '3D view', fr: 'Vue 3D' }, close: { he: 'סגירה', en: 'Close', fr: 'Fermer' } };
  const dhOn = Boolean(data.dollhouse);
  // 2026-11-08: the «שינוי עיצוב» panel's words (he/en/fr like DH_UI)
  let designReady = false;
  let coachReady = false;   // the guided tour of the buttons (set up at the end)
  let coachMusicStop = null;   // the walkthrough's music (set up at the end); the voice tour and a video stop it
  const DESIGN_UI = { title: { he: 'שינוי עיצוב', en: 'Change design', fr: 'Modifier le design' }, close: { he: 'סגירה', en: 'Close', fr: 'Fermer' },
    look: { he: 'תצוגה', en: 'View', fr: 'Affichage' }, floor: { he: 'ריצוף', en: 'Floor', fr: 'Sol' }, type: { he: 'שינוי בהקלדה', en: 'Describe a change', fr: 'Décrire un changement' } };
  // direction C (Eliran's pick, 2026-11-08): the visible words of the labelled actions and of the view switch (research.md finding #2:
  // icon-only controls were guesswork). Long words on a desktop capsule, short ones in the phone's action bar.
  const ACT_UI = {
    ruler: { he: 'מדידה', en: 'Measure', fr: 'Mesurer' },
    guide: { he: 'סיור קולי', en: 'Audio tour', fr: 'Visite audio' }, guideShort: { he: 'סיור', en: 'Tour', fr: 'Visite' },
    designShort: { he: 'עיצוב', en: 'Design', fr: 'Design' },
    modes: { he: 'סגנונות צפייה', en: 'View modes', fr: 'Modes d’affichage' }, viewGroup: { he: 'סגנונות צפייה', en: 'View modes', fr: 'Modes d’affichage' },
    tools: { he: 'כלי עזר', en: 'Tools', fr: 'Outils' },
    plan: { he: 'תוכנית', en: 'Plan', fr: 'Plan' },
    rooms: { he: 'רשימת החדרים', en: 'Room list', fr: 'Liste des pièces' },
  };
  const aui = (k) => pick(ACT_UI[k]);
  const nameOf = (s) => pick(s.name);

  /* ── changes: prepared patches per room (edits.json) and live edits per room (this session only) ── */
  const roomEdits = (room) => (Array.isArray(edits[room]) ? edits[room] : []);
  const editDef = (room, id) => roomEdits(room).find((e) => e.id === id) || null;
  const byOrder = (room) => (a, b) => editDef(room, a).order - editDef(room, b).order;
  const active = Object.create(null);    // room → [prepared edit id]
  const live = Object.create(null);      // room → [{ url, img, label, meta }]  the live stack, newest last
  const original = Object.create(null);  // room → true while the visitor looks at the original again
  const composed = Object.create(null);  // scene key → blob: URL of the composed panorama
  const roomOf = (key) => String(key).split('~')[0];
  const activeIds = (room) => active[room] || [];
  const liveStack = (room) => live[room] || [];
  const changeCount = (room) => activeIds(room).length + liveStack(room).length;
  const editedKey = (room) => room + (liveStack(room).length ? '~live' + liveStack(room).length : '') + (activeIds(room).length ? '~' + activeIds(room).join('+') : '');
  /* WALKAROUND-QUALITY-PLAN.md card Q09 (D-WQ-17; the wording is his, OQ-1): the Original/Designed switch — the plain CG render of
     the room (the build's originalSet: the model the designed picture was skinned from, so both share one yaw frame) under its
     label, the designed picture under the AI label. It exists only when the build carries that set AND the copy pack carries his
     four strings; until then the page is exactly as before. In Original the change controls rest (changes are drawn on the
     designed picture) and every door leads to the next room's original. */
  const LOOK_KEYS = ['lookDesigned', 'lookOriginal', 'lookDesignedNote', 'lookOriginalNote'];
  const hasOriginal = Boolean(data.originalSet && data.originalSet.dir) && LOOK_KEYS.every((k) => copy.ui[k] && LANGS.every((l) => copy.ui[k][l]));
  let look = hasOriginal && params.get('look') === 'original' ? 'original' : 'designed';
  const origKey = (room) => room + '~orig';
  const sceneKey = (room) => (look === 'original' ? origKey(room) : original[room] ? room : editedKey(room));
  let pending = (params.get('change') || '').split(',').filter((id) => editDef(firstId, id));

  // The test hook the smoke screenshots and the paint proof read.
  const state = {
    ready: false, scene: firstId, sceneKey: firstId, lang, visited: [], viewer: null, rotating: false, interacted: false, loads: 0,
    edits: {}, live: {}, liveMeta: {}, original: false, applying: false, unlocked: false, hooks: null,
    catalog: Array.isArray(data.catalog) ? data.catalog : null, // the catalog items of a --catalog build (T14e), read by edit-live.js
    marker: null, // the marker the visitor tapped (T16c), its id while the pick bar is open
    markers: scenes.reduce((n, s) => n + (Array.isArray(s.markers) ? s.markers.length : 0), 0), // the count a proof reads
    // T17a (TEST-PLAN.md C9): the GPU's largest texture — the one number that says whether this device can show a 7K panorama
    maxTexture: (() => { try { const c = document.createElement('canvas'); const gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (!gl) return null; const n = gl.getParameter(gl.MAX_TEXTURE_SIZE); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return n; } catch (_) { return null; } })(),
  };
  state.look = look;
  state.lookSwitch = hasOriginal ? 'on' : data.originalSet ? 'waiting for the wording (OQ-1)' : 'no original set';
  window.__tour = state;

  // T18g (D-CAT-28): the 7K set on a desktop that can hold it — a wide, tall screen that is not a narrow touch device, and a GPU texture
  // limit above the set's width — the balanced set everywhere else; chosen once at load, read through one path by the scene config
  // and the live-change compose (the patches scale by panoWidth)
  const useFull = Boolean(data.fullSet && data.fullSet.dir) && window.innerWidth >= 1000 && window.innerHeight >= 600
    && !(navigator.maxTouchPoints > 1 && window.innerWidth < 1200) && (state.maxTexture || 0) >= (data.fullSet ? data.fullSet.width : Infinity);
  // a floor finish with its own panorama set (data.floorSets[floor].dir, Habait studio 2026-11-01) replaces the balanced set
  const floorParam = params.get('floor');
  const floorDir = data.floorSets && floorParam && data.floorSets[floorParam] && data.floorSets[floorParam].dir ? data.floorSets[floorParam].dir : null;
  const panoPath = (asset) => (floorDir || (useFull ? data.fullSet.dir : 'panos')) + '/' + asset + '.webp';
  state.panoSet = useFull ? 'full' : 'balanced';
  state.fullSet = data.fullSet || null;
  /* WALKAROUND-QUALITY-PLAN.md card Q06: the scene's picture as tools/make-tiles.mjs's cube (build-tour carries it with --engine when
     the apartment has it). The engine streams it while the scene shows exactly that picture (`of`); a composed (changed) scene is a
     plain panorama as before, and Pannellum never sees tiles. The equirect set above stays what the changes are drawn on. */
  const canTile = Boolean(data.tiles && data.tiles.assets && window.pannellum && window.pannellum.tiles === true);
  const tilesOf = (s) => {
    const t = canTile ? data.tiles.assets[s.asset] : null;
    return t ? { of: panoPath(s.asset), dir: data.tiles.dir + '/' + s.asset, levels: t.levels, preview: t.preview, ext: t.ext || 'webp', noMipmapFrom: t.noMipmapFrom || null } : null;
  };
  state.tiles = canTile;
  const visited = new Set();
  let viewer = null;
  let firstLoad = true;
  let walkPill = 0; // card Q08: the loading pill during a walk-in waits 700 ms (the walk hides the swap) and shows only for a slow room
  const hsEntries = [];
  const hsByTarget = Object.create(null);
  const pscenes = {};
  /* ── the markers (T16c, CATALOG-PLAN.md §10.3): a ring on every replaceable piece of a --catalog build, a Pannellum hotspot of
     its own kind. Its direction, outline and name follow the room's live stack: a replacement moves the ring onto the product and
     names it after the item (meta.marker.after); undo, reset and the original fall back through the stack to the scan's record.
     The rings show only once the live change is unlocked (a tap is a paid turn) and hide while the view moves. ── */
  const TARGET_KEY = { sofa: 'catalogTargetSofa', armchair: 'catalogTargetArmchair', coffee_table: 'catalogTargetCoffeeTable', dining_table: 'catalogTargetDiningTable', chair: 'catalogTargetChair', bed: 'catalogTargetBed', lamp: 'catalogTargetLamp', rug: 'catalogTargetRug' };
  const mkEntries = [];
  const markerHs = Object.create(null); // room/id → the hotspot config (shared by the room's live scenes, like the door markers)
  const roomMarkers = (room) => (byId[room] && Array.isArray(byId[room].markers) ? byId[room].markers : []);
  const itemOf = (id) => (state.catalog ? state.catalog.find((i) => i.id === id) || null : null);
  const targetWords = (category) => ui(TARGET_KEY[category] || '') || String(category || '').replace('_', ' ');
  /** The marker as it stands now: the scan's record, then every live change of the room that moved it, in order; the original shows the scan's. */
  function markerState(room, id) {
    const def = roomMarkers(room).find((m) => m.id === id);
    if (!def) return null;
    let st = { id, category: def.category, yaw: def.yaw, pitch: def.pitch, span_deg: def.span_deg, outlines: def.outlines, count: def.count, cut_sides: def.cut_sides || null, piece: def.piece || null, item: null }; // cut_sides: the scan's record of the view sides the piece ran past (T18a); piece: one piece seen from several scenes (T18d)
    if (!original[room]) for (const e of liveStack(room)) if (e.meta && e.meta.marker && e.meta.marker.id === id && e.meta.marker.after) st = Object.assign({}, st, e.meta.marker.after, { id, category: def.category });
    return st;
  }
  const markerName = (st) => { const it = st.item ? itemOf(st.item) : null; return it ? (lang === 'he' && it.name_he ? it.name_he : it.name) : targetWords(st.category); };
  function makeMarker(div, args) {
    const ring = el('span', { class: 't-mk-ring', 'aria-hidden': 'true' });
    const chip = el('span', { class: 't-mk-chip', dir: 'auto' });
    chip.hidden = true;
    div.append(ring, chip);
    div.setAttribute('role', 'button');
    // T18k (F11): a ring is the page's first keyboard stop once the page is unlocked (a positive tabindex, on purpose: the chrome's
    // twenty-odd controls came before the rings, 26 Tabs to the first); a locked page's rings are invisible and take no focus at all
    div.tabIndex = state.unlocked ? 1 : -1;
    div.dataset.marker = args.id;
    div.dataset.room = args.room;
    const entry = { div, chip, room: args.room, id: args.id };
    mkEntries.push(entry);
    paintMarker(entry);
    div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); markerClick(e, args); } });
  }
  function paintMarker(entry) {
    const st = markerState(entry.room, entry.id);
    if (!st) return;
    const name = markerName(st);
    entry.div.setAttribute('aria-label', ui('catalogMarker').replace('{target}', name));
    entry.div.title = name;
    entry.chip.textContent = name;
    entry.div.classList.toggle('is-open', state.marker === entry.id && state.scene === entry.room);
    entry.chip.hidden = !(state.marker === entry.id && state.scene === entry.room);
  }
  function markerClick(e, args) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!state.unlocked || state.applying || args.room !== state.scene) return;
    document.dispatchEvent(new CustomEvent('tour:marker', { detail: { room: args.room, id: args.id } }));
  }
  /** The hotspots follow the state: a ring moves with its piece; every label is re-painted. Called from renderChange (every look change). */
  function refreshMarkers() {
    for (const k of Object.keys(markerHs)) {
      const [room, id] = k.split('/');
      const st = markerState(room, id);
      if (!st) continue;
      markerHs[k].yaw = st.yaw;
      markerHs[k].pitch = st.pitch;
    }
    for (let i = mkEntries.length - 1; i >= 0; i--) {
      if (!mkEntries[i].div.isConnected) mkEntries.splice(i, 1);
      else { mkEntries[i].div.tabIndex = state.unlocked ? 1 : -1; paintMarker(mkEntries[i]); }
    }
  }
  function setMoving(on) { $('pano').classList.toggle('is-moving', Boolean(on)); }

  /* ── geometry ───────────────────────────────────────────────────────────────── */
  const fitHfov = () => {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const v = (85 * Math.PI) / 180; // 2026-11-01 (Eliran): a wider first look — the room arrives more zoomed out
    const h = (2 * Math.atan(Math.tan(v / 2) * aspect) * 180) / Math.PI;
    return Math.max(60, Math.min(118, h));
  };
  const hsYaw = (u) => (u - 0.5) * 360;
  // R23b (2026-11-06): beyond v 0.743 (pitch −17°) the marker follows the true floor line (180°/unit), so a door marker can sit on the
  // floor in front of a near wall instead of on the wall; every v ≤ 0.743 maps exactly as before. tools/hotspot-hit.mjs mirrors this line.
  const hsPitch = (v) => -12 - Math.min(5, (v - 0.6) * 35) - Math.max(0, (v - 0.6 - 5 / 35) * 180);
  /* arrival-maths:begin — engine/test/run.mjs evaluates this block as written, against tools/make-scenes.mjs's bearing */
  const bearing = (a, b) => (Math.atan2(b.plan.x - a.plan.x, a.plan.y - b.plan.y) * 180) / Math.PI;
  const wrap180 = (d) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r; };
  /** WALKAROUND-QUALITY-PLAN.md card Q08: where a door leaves the visitor looking — the direction of travel (this camera → that
      camera on the plan) in the target panorama's yaw frame, whose yaw 0 looks at plan bearing centreBearingDeg (scenes.json,
      tools/make-scenes.mjs); a scene without that bearing keeps its own heading, as before */
  const arriveYaw = (s, t) => (Number.isFinite(t.centreBearingDeg) && s.plan && t.plan ? wrap180(bearing(s, t) - t.centreBearingDeg) : t.heading); // an exterior node (no plan position, 2026-11-02) keeps its heading
  /* arrival-maths:end */

  /* ── small DOM helpers ──────────────────────────────────────────────────────── */
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    if (children) n.append(...children);
    return n;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    return n;
  }
  /** Writes a "{n} / {total} …" template with the number run isolated LTR (an RTL paragraph would otherwise show 13 / 1). */
  function countInto(node, tpl, n, total) {
    node.textContent = '';
    const token = '{n} / {total}';
    const num = el('span', { class: 't-num', dir: 'ltr', text: n + ' / ' + total });
    const i = tpl.indexOf(token);
    if (i < 0) { node.append(num); return; }
    node.append(tpl.slice(0, i), num, tpl.slice(i + token.length));
  }

  /* ── the room strip and the plan sheet (built once, re-labelled per language) ─ */
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const UNDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
  const cards = [];
  const strip = $('t-strip');
  const layerIndex = (s) => scenes.filter((x) => Boolean(x.exterior) === Boolean(s.exterior)).indexOf(s); // numbering within the layer (2026-11-02)
  for (const s of scenes) {
    const num = el('span', { class: 't-card-num', text: String(layerIndex(s) + 1).padStart(2, '0') });
    const name = el('span', { class: 't-card-name' });
    const check = el('span', { class: 't-card-check', 'aria-hidden': 'true' });
    check.innerHTML = CHECK;
    check.hidden = true;
    const img = el('img', { src: 'thumbs/' + s.asset + '.webp', alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
    const btn = el('button', { type: 'button', class: 't-card' }, [img, num, name, check]);
    btn.addEventListener('click', () => go(s.id, true));
    strip.append(el('div', { role: 'listitem' }, [btn]));
    cards.push({ s, btn, name, check });
  }

  const plan = $('t-plan');
  const [vbX, vbY, vbW, vbH] = apt.plan.viewBox;
  plan.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
  plan.append(svg('image', { href: 'plan/' + apt.plan.image.split('/').pop(), x: 0, y: 0, width: apt.plan.imageSize[0], height: apt.plan.imageSize[1] }));
  const pins = [];
  for (const s of scenes) {
    if (!s.plan) continue; // an exterior 360 node (the flyover chain, 2026-11-02) has no place on the apartment plan
    const g = svg('g', { class: 't-pin', role: 'button', tabindex: '0' });
    g.append(svg('circle', { cx: s.plan.x, cy: s.plan.y, r: 30 }));
    const t = svg('text', { x: s.plan.x, y: s.plan.y + 1 });
    t.textContent = String(layerIndex(s) + 1);
    g.append(t);
    const enter = () => { closeSheet(); go(s.id, true); };
    g.addEventListener('click', enter);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } });
    plan.append(g);
    pins.push({ s, g });
  }
  /* WALKAROUND-QUALITY-PLAN.md card Q09: the view cone on the plan sheet — where the visitor looks, PSV's yaw mapped to the plan
     bearing (a panorama's yaw 0 looks at its centreBearingDeg), opening as wide as the view; under the pins. Drawn only for a scene
     that carries that bearing (no guessed direction). The compass waits for the plan's north (no north angle in the data yet). */
  const CONE_R = 150; // plan pixels: about 1.7 m on apt846's sheet (0.9 px a cm)
  const cone = svg('path', { class: 't-cone', 'aria-hidden': 'true', d: '' });
  plan.insertBefore(cone, pins.length ? pins[0].g : null);
  function renderCone() {
    const s = byId[state.scene];
    if (!viewer || !s || !Number.isFinite(s.centreBearingDeg)) { cone.setAttribute('d', ''); return; }
    const b = s.centreBearingDeg + viewer.getYaw();
    const h = Math.min(170, viewer.getHfov());
    const D = Math.PI / 180, x = s.plan.x, y = s.plan.y;
    const p = (deg) => (x + CONE_R * Math.sin(deg * D)).toFixed(1) + ' ' + (y - CONE_R * Math.cos(deg * D)).toFixed(1);
    cone.setAttribute('d', `M ${x} ${y} L ${p(b - h / 2)} A ${CONE_R} ${CONE_R} 0 0 1 ${p(b + h / 2)} Z`);
    state.cone = { bearing: wrap180(b), hfov: h, compassBearing: Number.isFinite(apt.plan.northDeg) ? ((b - apt.plan.northDeg) % 360 + 360) % 360 : null }; // what a proof reads
  }
  /* card Q09: the compass — the plan's north (apartment.json plan.northDeg, read off the sales plan's own north arrow), a needle in
     the sheet's top-left corner with the letter of the language; none when the apartment carries no north */
  let compassText = null;
  if (Number.isFinite(apt.plan.northDeg)) {
    const n = apt.plan.northDeg, DR = Math.PI / 180;
    const g = svg('g', { class: 't-compass', 'aria-hidden': 'true', transform: `translate(${vbX + 92} ${vbY + 92})` });
    g.append(svg('circle', { r: 46 }));
    g.append(svg('path', { d: 'M 0 -40 L 13 12 L 0 3 L -13 12 Z', transform: `rotate(${n})` }));
    compassText = svg('text', { x: (72 * Math.sin(n * DR)).toFixed(1), y: (-72 * Math.cos(n * DR)).toFixed(1) });
    g.append(compassText);
    plan.append(g);
  }
  const list = $('t-plan-list');
  const items = [];
  for (const s of scenes) {
    const nm = el('span');
    const b = el('button', { type: 'button', class: 't-plan-item' }, [el('span', { class: 't-plan-num', text: String(s.index + 1) }), nm]);
    b.addEventListener('click', () => { closeSheet(); go(s.id); });
    list.append(el('div', { role: 'listitem' }, [b]));
    items.push({ s, b, nm });
  }

  /* Floor arrows (Eliran 2026-11-12: the room buttons «בצורה מסודרת על הרצפה עם חץ שקוף»): every room arrow of a room stands in ONE
     row on the floor, at a height seen without tilting the view (2026-11-12 level-view rule: lower than about -20° hides under the
     controls). Two rooms less than FLOOR_GAP degrees apart cannot share a row: the nearer room keeps the near row, the farther one
     moves to the row behind it (higher on the picture, smaller), as a farther spot on a real floor would. */
  const FLOOR_ROWS = [{ pitch: -17 }, { pitch: -6 }, { pitch: 3 }], FLOOR_GAP = 15;   // rows 11° apart: two arrows in one direction never touch on a phone
  function floorRows(s, links) {
    if (s.exterior) return links.map((h) => ({ h, row: 0 }));
    const yawOf = (h) => (h.u == null ? bearing(s, byId[h.to]) : hsYaw(h.u));
    const far = (h) => (s.plan && byId[h.to].plan ? Math.hypot(byId[h.to].plan.x - s.plan.x, byId[h.to].plan.y - s.plan.y) : 0);
    const placed = [];
    for (const h of links.slice().sort((a, b) => far(a) - far(b))) {
      const y = yawOf(h); let row = 0;
      while (row < FLOOR_ROWS.length - 1 && placed.some((p) => p.row === row && Math.abs(wrap180(p.y - y)) < FLOOR_GAP)) row++;
      placed.push({ h, y, row });
    }
    return links.map((h) => ({ h, row: placed.find((p) => p.h === h).row }));
  }

  /* ── hotspots: Pannellum calls this for each link of the scene it is drawing ─── */
  function makeHotspot(div, args) {
    const toId = typeof args === 'string' ? args : args.to;
    const door = typeof args === 'string' ? null : args.hs;
    const floor = typeof args === 'object' && args && args.floor;   // a room of the apartment: a transparent arrow lying on the floor
    const ring = floor ? el('span', { class: 't-hs-arrow', 'aria-hidden': 'true' }) : el('span', { class: 't-hs-ring' });
    const label = el('span', { class: 't-hs-label', dir: 'auto' });
    div.append(ring, label);
    div.setAttribute('role', 'button');
    div.tabIndex = 0;
    const entry = { div, label, toId, nameId: (door && door.nameAs) || toId };   // a door may carry the name of the room it leads on to (scenes.json `as`)
    hsEntries.push(entry);
    paintHotspot(entry);
    div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterDoor(door, toId); } });
  }
  /** A door taken from the keyboard goes the way a tap does (card Q08): the engine walks in (walkTo); Pannellum swaps as its own
      click does. Both arrive facing the direction of travel (the hotspot's targetYaw). */
  function enterDoor(hs, toId) {
    if (!viewer) return;
    if (!hs) { go(toId); return; }
    if (roomOf(hs.sceneId) === roomOf(viewer.getScene())) return;
    state.interacted = true;
    if (typeof viewer.walkTo === 'function') viewer.walkTo(hs);
    else viewer.loadScene(hs.sceneId, hs.targetPitch, hs.targetYaw, hs.targetHfov);
  }
  function paintHotspot(entry) {
    const nm = nameOf(byId[entry.nameId || entry.toId]);
    entry.label.textContent = nm;
    entry.div.setAttribute('aria-label', ui('enterRoom').replace('{room}', nm));
  }
  /** A marker's target is read by Pannellum at click time, so a room with changes is entered with them still on. */
  function retarget(room) {
    for (const hs of hsByTarget[room] || []) hs.sceneId = sceneKey(room);
  }

  /* ── render ─────────────────────────────────────────────────────────────────── */
  function renderStatic() {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = ui('title') + ' · ' + pick(apt.title);
    // the disclosure — permanent, every language, every scene
    $('tour-badge').textContent = pick(copy.badge); $('t-badge-mini').textContent = pick(copy.badge);
    $('tour-concept').textContent = pick(copy.conceptLine);
    $('t-ai-text').textContent = pick(copy.aiNote);
    // chrome labels
    $('pano').setAttribute('aria-label', ui('panoLabel'));
    $('t-lang').setAttribute('aria-label', ui('language'));
    for (const b of document.querySelectorAll('#t-lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    const label = (id, key) => { const n = $(id); n.setAttribute('aria-label', ui(key)); n.title = ui(key); };
    // the view switch: «360°» · «תוכנית» · «תלת-ממד». #t-plan-btn is the 3D control with the dollhouse, the plan without it (one id, the
    // map→3D path and map3d-check.mjs unchanged)
    const planBtn = $('t-plan-btn');
    planBtn.classList.toggle('is-plan', !dhOn);
    $('t-plan-label').textContent = dhOn ? pick(DH_UI.title) : aui('plan');
    planBtn.setAttribute('aria-label', dhOn ? pick(DH_UI.title) : ui('floorPlan'));
    $('t-map-label').textContent = aui('plan'); $('t-map-btn').setAttribute('aria-label', ui('floorPlan'));
    $('t-view-title').textContent = aui('modes'); $('t-view-label').textContent = aui('modes');
    $('t-tools-title').textContent = aui('tools'); $('t-tools-label').textContent = aui('tools');
    for (const c of document.querySelectorAll('[data-menu-close]')) c.setAttribute('aria-label', ui('close'));
    $('t-ruler-label').textContent = aui('ruler');
    $('t-guide-label').textContent = aui('guide'); $('t-guide-short').textContent = aui('guideShort');
    $('t-design-short').textContent = aui('designShort');
    if (designReady) renderDesign();
    if (coachReady) renderCoachLabels();
    if (coachReady) renderNavLabels();   // the joystick (set up beside the walkthrough, further down)   // the panel is set up further down (its controls are moved once the page is built)
    { const t3 = pick(DH_UI.title); const b3 = $('t-3d-btn'); b3.setAttribute('aria-label', t3); b3.title = t3; $('t-3d-title').textContent = t3; $('t-3d-close').setAttribute('aria-label', pick(DH_UI.close)); }
    label('t-zoom-in', 'zoomIn');
    label('t-zoom-out', 'zoomOut');
    label('t-rotate', 'autoRotate');
    label('t-reset', 'resetView');
    label('t-full', 'fullscreen');
    label('t-prev', 'prev');
    label('t-next', 'next');
    if (byId[state.scene]) renderReturn(byId[state.scene]);
    label('t-sheet-close', 'close');
    label('t-change-close', 'close');
    strip.setAttribute('aria-label', ui('rooms'));
    $('t-sheet-title').textContent = ui('floorPlan');
    $('t-sheet-hint').textContent = ui('floorPlanHint');
    plan.setAttribute('aria-label', ui('floorPlan'));
    if (compassText) compassText.textContent = ui('north'); // card Q09
    list.setAttribute('aria-label', ui('rooms'));
    $('t-retry').textContent = ui('tryAgain');
    $('t-error-text').textContent = ui('error');
    // the change panel
    $('t-change-btn-text').textContent = ui('changeOpen');
    $('t-change-title').textContent = ui('changeTitle');
    $('t-change-hint').textContent = ui('changeHint');
    $('t-change-list').setAttribute('aria-label', ui('changeExamples'));
    const input = $('t-change-input');
    input.placeholder = ui(state.unlocked ? 'changeType' : 'changeSoon');
    input.setAttribute('aria-label', input.placeholder);
    $('t-change-apply').textContent = ui('changeApply');
    const bar = $('t-bar-input');
    bar.placeholder = ui('changeType');
    bar.setAttribute('aria-label', ui('changeType'));
    $('t-bar-apply').textContent = ui('changeApply');
    $('t-undo-text').textContent = ui('changeUndo');
    $('t-undo').title = ui('changeUndo');
    $('t-change-note').textContent = ui('changeScope');
    $('t-change-reset').textContent = ui('changeReset');
    for (const c of cards) {
      c.name.textContent = nameOf(c.s);
      c.btn.setAttribute('aria-label', ui('enterRoom').replace('{room}', nameOf(c.s)));
    }
    for (const p of pins) p.g.setAttribute('aria-label', (p.s.index + 1) + ' · ' + nameOf(p.s));
    for (const it of items) it.nm.textContent = nameOf(it.s);
    for (let i = hsEntries.length - 1; i >= 0; i--) {
      if (!hsEntries[i].div.isConnected) hsEntries.splice(i, 1);
      else paintHotspot(hsEntries[i]);
    }
    refreshMarkers();
    renderLook();
    if (!state.ready) $('t-loading-text').textContent = ui('loadingFirst');
  }

  /** card Q09: the switch's two buttons and the label line under it, in the current language (his words, OQ-1) */
  function renderLook() {
    const box = $('t-look');
    if (!hasOriginal || (byId[state.scene] && byId[state.scene].exterior)) { box.hidden = true; $('t-look-note').hidden = true; return; } // an exterior node has no "original" to show (2026-11-02)
    box.hidden = false; $('t-look-note').hidden = false;   // the note lives in the disclosure strip now (direction C)
    box.setAttribute('aria-label', ui('lookDesigned') + ' / ' + ui('lookOriginal'));
    for (const b of document.querySelectorAll('button[data-look]')) {   // 2026-11-08: the buttons live in the «שינוי עיצוב» panel now
      b.textContent = ui(b.dataset.look === 'original' ? 'lookOriginal' : 'lookDesigned');
      b.setAttribute('aria-pressed', String(b.dataset.look === look));
    }
    $('t-look-note').textContent = ui(look === 'original' ? 'lookOriginalNote' : 'lookDesignedNote');
  }
  /** card Q09: the same view, the other picture of the room; the doors follow; the tour's own fade (instant under reduced motion) */
  function setLook(next) {
    if (!hasOriginal || next === look || !viewer || !state.ready || state.applying || !viewer.isLoaded()) return;
    look = next;
    state.look = next;
    for (const s of scenes) retarget(s.id);
    renderLook();
    renderChange();
    syncUrl();
    viewer.loadScene(sceneKey(state.scene), viewer.getPitch(), viewer.getYaw(), viewer.getHfov());
  }

  /** The change row and the panel's list, for the room on screen. */
  function renderChange() {
    const room = state.scene;
    const defs = roomEdits(room);
    const ids = activeIds(room);
    const stack = liveStack(room);
    const n = ids.length + stack.length;
    const unlocked = state.unlocked;
    $('t-actions').hidden = (defs.length === 0 && !unlocked) || look === 'original'; // card Q09: no change controls on the original
    if (unlocked) $('t-change-bar').hidden = look === 'original'; // Eliran 2026-11-04: the typed bar shows on the phone too, always
    $('t-undo').hidden = !(unlocked && stack.length);
    const count = $('t-change-count');
    count.hidden = n === 0;
    count.textContent = String(n);
    const cmp = $('t-compare');
    cmp.hidden = n === 0;
    cmp.setAttribute('aria-pressed', String(Boolean(original[room])));
    $('t-compare-text').textContent = original[room] ? ui('changeShowChanges') : ui('changeShowOriginal');
    $('t-change-reset').hidden = n === 0;
    const box = $('t-change-list');
    box.textContent = '';
    stack.forEach((entry, i) => {
      const isLast = i === stack.length - 1;
      const mark = el('span', { class: 't-change-mark', 'aria-hidden': 'true' });
      mark.innerHTML = isLast ? UNDO : CHECK;
      const b = el('button', { type: 'button', class: 't-change-item is-live', 'aria-pressed': 'true' },
        [el('span', { class: 't-change-label', dir: 'auto' }, [el('span', { class: 't-change-tag', text: ui('changeLiveTag') }), document.createTextNode(entry.label)]), mark]);
      if (isLast) { b.title = ui('changeUndo'); b.setAttribute('aria-label', ui('changeUndo') + ': ' + entry.label); b.addEventListener('click', () => undoLive(room)); }
      else b.disabled = true;
      box.append(b);
    });
    for (const d of defs) {
      const on = ids.includes(d.id);
      const mark = el('span', { class: 't-change-mark', 'aria-hidden': 'true' });
      mark.innerHTML = on ? CHECK : PLUS;
      const b = el('button', { type: 'button', class: 't-change-item', 'aria-pressed': String(on), 'data-edit': d.id },
        [el('span', { class: 't-change-label', dir: 'auto', text: pick(d.label) }), mark]);
      b.addEventListener('click', () => toggleEdit(room, d.id));
      box.append(b);
    }
    const snap = {};
    for (const r of Object.keys(active)) if (active[r].length) snap[r] = active[r].slice();
    state.edits = snap;
    const liveSnap = {}; const metaSnap = {};
    for (const r of Object.keys(live)) if (live[r].length) { liveSnap[r] = live[r].map((e) => e.label); metaSnap[r] = live[r].map((e) => e.meta); }
    state.live = liveSnap; state.liveMeta = metaSnap;
    state.original = Boolean(original[room]);
    refreshMarkers();
    document.dispatchEvent(new CustomEvent('tour:change')); // the live script redraws the item card from liveMeta (T14e)
  }

  /* 2026-11-02 (Eliran via habait-98, 12:05): two layers that never share a strip — the project layer (the exterior 360 nodes:
     the intro orbit, the hold at the tower, the descent) and the apartment layer (its rooms). The strip, the counter and the
     arrows work inside the current layer; from the rooms a "back to the building" pill returns to the hold node. */
  const layerOf = (s) => (s.exterior ? 'project' : 'apartment');
  const layerScenes = (s) => scenes.filter((x) => layerOf(x) === layerOf(s));
  const holdId = (scenes.find((x) => x.exterior && x.hold) || scenes.find((x) => x.exterior) || {}).id || null;
  function renderRoom() {
    const s = byId[state.scene];
    $('t-zone').textContent = pick(s.zone);
    $('t-room').textContent = nameOf(s);
    $('t-apt').textContent = pick(apt.title);
    const layer = layerScenes(s);
    // the room pill (direction C): the room's name and «n / total»; the full sentence stays its accessible name
    $('t-pill-name').textContent = nameOf(s);
    countInto($('t-count'), '{n} / {total}', layer.indexOf(s) + 1, layer.length);
    { const full = el('span'); countInto(full, ui('viewpoints'), layer.indexOf(s) + 1, layer.length); $('t-rooms-btn').setAttribute('aria-label', `${nameOf(s)} · ${full.textContent} · ${aui('rooms')}`); }
    const sub = $('t-hint');
    const seen = layer.filter((x) => visited.has(x.id)).length;
    if (!state.interacted && visited.size <= 1) sub.textContent = fine ? ui('dragHint') + ' · ' + ui('markerHint') : ui('dragHint');
    else countInto(sub, ui('explored'), seen, layer.length);
    for (const c of cards) {
      const cur = c.s.id === s.id;
      c.btn.parentElement.hidden = layerOf(c.s) !== layerOf(s);
      if (cur) c.btn.setAttribute('aria-current', 'true'); else c.btn.removeAttribute('aria-current');
      c.check.hidden = !visited.has(c.s.id) || cur;
    }
    $('t-plan-btn').hidden = Boolean(s.exterior); // no plan sheet outside the apartment
    $('t-map-btn').hidden = !dhOn || Boolean(s.exterior);   // the plan has its own segment only when #t-plan-btn is the 3D one
    $('t-view-btn').hidden = Boolean(s.exterior); if (s.exterior && !$('t-view').hidden) menuOpen(null);
    $('t-3d-btn').hidden = true; // 2026-11-06: the map button opens the 3D view (one button, Eliran); the cube stays in the markup
    renderReturn(s);
    for (const p of pins) p.g.classList.toggle('is-current', p.s.id === s.id);
    renderCone();
    for (const it of items) { if (it.s.id === s.id) it.b.setAttribute('aria-current', 'true'); else it.b.removeAttribute('aria-current'); }
    renderChange();
    if (state.ready) renderVideoBar();
    const curCard = cards[s.index].btn;
    // the strip scrolls ITSELF to centre the current card — scrollIntoView would also scroll every ancestor that can scroll, the clipped
    // tour root included, and in RTL that pushes the place card off the right edge (Eliran's 1741 px screenshot, 2026-11-08)
    { const st = $('t-strip'), cr = curCard.getBoundingClientRect(), sr = st.getBoundingClientRect();
      try { st.scrollBy({ left: (cr.left + cr.width / 2) - (sr.left + sr.width / 2), behavior: reduced || !state.ready ? 'auto' : 'smooth' }); } catch (_) { st.scrollLeft += (cr.left + cr.width / 2) - (sr.left + sr.width / 2); } }
  }

  function showLoading(on, text, final) {
    const box = $('t-loading');
    box.classList.toggle('is-final', Boolean(on && final)); // T18j: a final message shows no spinner
    if (on) {
      $('t-loading-text').textContent = text || (firstLoad ? ui('loadingFirst') : ui('loadingRoom').replace('{room}', nameOf(byId[state.scene])));
      box.classList.toggle('is-small', !firstLoad);
      box.classList.remove('is-hidden');
    } else {
      box.classList.add('is-hidden');
      if (firstLoad) { firstLoad = false; window.setTimeout(() => box.classList.add('is-small'), 450); }
    }
  }
  function showError() {
    state.applying = false;
    showLoading(false);
    $('t-error-text').textContent = ui('error');
    $('t-retry').textContent = ui('tryAgain');
    $('t-error').hidden = false;
  }

  function syncUrl() {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('room', state.scene);
      if (lang === 'he') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
      const ids = activeIds(state.scene);
      if (ids.length) u.searchParams.set('change', ids.join(',')); else u.searchParams.delete('change');
      if (look === 'original') u.searchParams.set('look', 'original'); else u.searchParams.delete('look'); // card Q09
      if (floor && floors.length > 1) u.searchParams.set('floor', floor); else u.searchParams.delete('floor');
      window.history.replaceState(null, '', u);
    } catch (_) { /* file:// or a sandbox: the URL is a convenience only */ }
  }

  /* the way back to the project level: in scope=apartment an outside link (`return`, the flyover); otherwise, from a room, the
     hold node of this tour's own project layer. The pack's `backToBuilding` wording when it has one; the skip pill likewise. */
  const WORDS = { backToBuilding: { he: 'חזרה לבניין', en: 'Back to the building', fr: "Retour à l'immeuble" }, skipIntro: { he: 'דלג', en: 'Skip', fr: 'Passer' } };
  const word = (k) => ui(k) || WORDS[k][lang] || WORDS[k].he;
  function renderReturn(s) {
    const r = $('t-return');
    const inRoom = !s.exterior && holdId && scope !== 'apartment';
    r.hidden = !(returnUrl || inRoom);
    // embedded (the platform's apartment page puts the tour in an iframe, card 23): the way back must replace the PAGE, not the frame
    if (returnUrl) { r.href = returnUrl; r.onclick = null; if (window.self !== window.top) r.target = '_top'; else r.removeAttribute('target'); }
    else if (inRoom) { r.href = '#'; r.onclick = (e) => { e.preventDefault(); autoOff = true; go(holdId); }; }
    r.textContent = word('backToBuilding');
    const k = $('t-skip'); k.hidden = !(auto.running && holdId); k.textContent = word('skipIntro');
  }

  /* ── the automatic passages (2026-11-02): a scene with `autoNext` moves on by itself after `autoDwellMs` — the intro orbit of the
     project (aerial → o1…o5 → the hold at the tower) and, after the tap on the apartment, the descent (45 m → 25 m → facade →
     outside the terrace → the sun terrace). The buyer looks around meanwhile: the view direction is carried from node to node.
     Choosing a card, an arrow or a pin means browsing by hand: the automatics stop until the next door tap. `?auto=0` disables. */
  const auto = { timer: 0, running: false };
  let autoOff = params.get('auto') === '0';
  function autoArm() {
    window.clearTimeout(auto.timer);
    const s = byId[state.scene];
    const next = s && s.autoNext && byId[s.autoNext];
    auto.running = Boolean(next) && !autoOff;
    if (!auto.running) { if (state.ready) renderReturn(s); return; }
    renderReturn(s);
    auto.timer = window.setTimeout(() => {
      if (autoOff || !viewer || roomOf(viewer.getScene()) !== s.id) return;
      // outside, the look direction is carried (the tower stays where the eye left it); the last hop into a room faces the room
      if (next.exterior) viewer.loadScene(sceneKey(next.id), viewer.getPitch(), viewer.getYaw(), viewer.getHfov());
      else viewer.loadScene(sceneKey(next.id), -2, Number.isFinite(s.autoYaw) ? s.autoYaw : next.heading, fitHfov()); // autoYaw: the room's view, placed by hand
    }, Number.isFinite(s.autoDwellMs) ? s.autoDwellMs : 1000);
  }
  function autoSkip() { autoOff = true; window.clearTimeout(auto.timer); auto.running = false; if (holdId) go(holdId); }

  /* ── navigation ─────────────────────────────────────────────────────────────── */
  function go(id, byHand) {
    if (!viewer || !byId[id] || id === roomOf(viewer.getScene())) return;
    state.interacted = true;
    if (byHand) { autoOff = true; window.clearTimeout(auto.timer); auto.running = false; }
    viewer.loadScene(sceneKey(id), -2, byId[id].heading, fitHfov());
  }
  function step(delta) {
    const layer = layerScenes(byId[state.scene]);
    const i = (layer.indexOf(byId[state.scene]) + delta + layer.length) % layer.length;
    go(layer[i].id, true);
  }
  function setRotating(on) {
    state.rotating = Boolean(on) && !reduced;
    if (viewer) { if (state.rotating) viewer.startAutoRotate(-2.2); else viewer.stopAutoRotate(); }
    $('t-rotate').setAttribute('aria-pressed', String(state.rotating));
    if (!state.rotating) window.setTimeout(() => { if (!state.rotating) setMoving(false); }, 500); // T18k (F11): the rings stay on through the auto-rotate; a drag hides them
  }
  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    state.lang = next;
    renderStatic();
    renderRoom();
    syncUrl();
  }

  /* ── the sheets (floor plan · change panel) ─────────────────────────────────── */
  const SHEETS = ['t-sheet', 't-change'];
  let returnFocus = null;
  function openSheet(id, focusId) {
    closeSheet();
    returnFocus = document.activeElement;
    $(id).hidden = false;
    document.documentElement.classList.add('has-dialog'); // T18m (F16, D-CAT-26): the permanent lines rise above the backdrop
    if (id === 't-sheet') renderCone(); // card Q09: the cone as the view stands now
    placeSheet();
    $(focusId).focus({ preventScroll: true });
  }
  /** board habait-walkaround T15: the sheet starts below the concept line wherever it ends (two lines in he/fr, three in en);
      T19c (F-5): the plan then gives up height until all thirteen rooms are in view, as on the design link. T19d re-check: where
      even a 140 px plan cannot make them fit (a phone on its side, a small phone) the plan keeps its full size and the sheet
      scrolls, as the design link's does — a thin strip of a plan helped no one */
  function placeSheet() {
    document.documentElement.style.setProperty('--concept-bottom', Math.ceil($('tour-concept').getBoundingClientRect().bottom) + 'px');
    if ($('t-sheet').hidden) return;
    const panel = $('t-sheet').querySelector('.t-sheet-panel');
    const plan = $('t-plan');
    plan.style.maxHeight = 'none';
    const over = panel.scrollHeight - panel.clientHeight;
    const fit = Math.floor(plan.getBoundingClientRect().height - over);
    if (over > 0 && fit >= 140) plan.style.maxHeight = fit + 'px';
  }
  window.addEventListener('resize', () => { if (document.documentElement.classList.contains('has-dialog')) placeSheet(); });
  function closeSheet() {
    let was = false;
    for (const id of SHEETS) { if (!$(id).hidden) { $(id).hidden = true; was = true; } }
    document.documentElement.classList.remove('has-dialog');
    if (was && returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
  }
  for (const n of document.querySelectorAll('[data-close]')) n.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  /* ── the changes: compose the panorama, turn to the object, swap the scene ───── */
  const imgCache = new Map();
  function loadImage(src) {
    if (!imgCache.has(src)) {
      imgCache.set(src, new Promise((resolve, reject) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => resolve(im);
        im.onerror = () => { imgCache.delete(src); reject(new Error('image failed: ' + src)); };
        im.src = src;
      }));
    }
    return imgCache.get(src);
  }
  /** The room's current look as a canvas: the newest live edit (or the original) with the chosen patches drawn over it.
      Patch x/y/w/h are in balanced-panorama pixels; a live panorama has the same size. */
  async function composeCanvas(room, ids) {
    const s = byId[room];
    const defs = ids.map((id) => editDef(room, id)).filter(Boolean).sort((a, b) => a.order - b.order);
    const top = liveStack(room)[liveStack(room).length - 1];
    const imgs = await Promise.all([top ? Promise.resolve(top.img) : loadImage(panoPath(s.asset))].concat(defs.map((d) => loadImage('panos/patches/' + d.patch))));
    const base = imgs[0];
    const c = document.createElement('canvas');
    c.width = base.naturalWidth || base.width;
    c.height = base.naturalHeight || base.height;
    const g = c.getContext('2d');
    g.drawImage(base, 0, 0);
    const k = c.width / (data.panoWidth || c.width);
    defs.forEach((d, i) => g.drawImage(imgs[i + 1], d.x * k, d.y * k, d.w * k, d.h * k));
    return c;
  }
  const canvasToUrl = (c) => new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('encode failed'))), 'image/jpeg', 0.92));
  async function composePano(room, ids) {
    const c = await composeCanvas(room, ids);
    const url = await canvasToUrl(c);
    c.width = 0;
    c.height = 0;
    return url;
  }
  /** Where to look so the changed object is in front of the visitor: a phone may widen by 15 degrees, a desktop by 6. */
  function aim(def) {
    const fit = fitHfov();
    return {
      pitch: (0.5 - def.look.v) * 180,
      yaw: (def.look.u - 0.5) * 360,
      hfov: Math.max(fit, Math.min(fit + (fine ? 6 : 15), (def.spanDeg || 60) + 12)),
    };
  }
  const canChange = () => Boolean(viewer) && state.ready && !state.applying && viewer.isLoaded() && look !== 'original';
  let applySeq = 0;
  async function applyRoom(room, focusDef, revert, keepText) {
    const seq = ++applySeq;
    const key = sceneKey(room);
    state.applying = true;
    state.interacted = true;
    if (state.rotating) setRotating(false);
    renderChange();
    showLoading(true, keepText || ui('changeApplying'));
    const target = focusDef ? aim(focusDef) : { pitch: viewer.getPitch(), yaw: viewer.getYaw(), hfov: viewer.getHfov() };
    const turned = new Promise((resolve) => {
      if (!focusDef || reduced) { resolve(); return; }
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      viewer.lookAt(target.pitch, target.yaw, target.hfov, 700, fin);
      window.setTimeout(fin, 1200);
    });
    try {
      if (key !== room && !composed[key]) {
        const url = await composePano(room, activeIds(room));
        if (composed[key]) URL.revokeObjectURL(url);
        else {
          composed[key] = url;
          viewer.addScene(key, Object.assign({}, pscenes[room], { panorama: url }));
        }
      }
      await turned;
      if (seq !== applySeq) return;
      retarget(room);
      if (viewer.getScene() === key) {
        state.applying = false;
        showLoading(false);
        renderChange();
        syncUrl();
        return;
      }
      viewer.loadScene(key, target.pitch, target.yaw, target.hfov);
    } catch (_) {
      if (seq !== applySeq) return;
      if (revert) revert();
      state.applying = false;
      retarget(room);
      renderChange();
      showLoading(true, ui('changeFailed'));
      window.setTimeout(() => { if (!state.applying) showLoading(false); }, 2600);
    }
  }
  function toggleEdit(room, id) {
    const def = editDef(room, id);
    if (!def || !canChange()) return;
    const prev = activeIds(room).slice();
    const ids = prev.slice();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
    ids.sort(byOrder(room));
    active[room] = ids;
    const wasOriginal = Boolean(original[room]);
    original[room] = false;
    closeSheet();
    applyRoom(room, def, () => { active[room] = prev; original[room] = wasOriginal; });
  }
  function toggleOriginal() {
    const room = state.scene;
    if (!changeCount(room) || !canChange()) return;
    original[room] = !original[room];
    applyRoom(room, null, () => { original[room] = !original[room]; });
  }
  function dropLive(entries) {
    for (const e of entries) { try { URL.revokeObjectURL(e.url); } catch (_) { /* already gone */ } }
  }
  function resetEdits() {
    const room = state.scene;
    if (!changeCount(room) || !canChange()) return;
    const prev = activeIds(room).slice();
    const prevLive = liveStack(room).slice();
    const wasOriginal = Boolean(original[room]);
    active[room] = [];
    live[room] = [];
    original[room] = false;
    closeSheet();
    applyRoom(room, null, () => { active[room] = prev; live[room] = prevLive; original[room] = wasOriginal; });
  }
  /** A live change lands: the edited panorama (a canvas) becomes the room's new base for this session. */
  async function pushLive(room, canvas, label, meta) {
    const url = await canvasToUrl(canvas);
    const img = await loadImage(url);
    const entry = { url, img, label: String(label || '').slice(0, 120), meta: meta || {} };
    live[room] = liveStack(room).concat([entry]);
    original[room] = false;
    closeSheet();
    await applyRoom(room, null, () => { live[room] = liveStack(room).filter((e) => e !== entry); dropLive([entry]); }, ui('changeApplying'));
    return entry;
  }
  function undoLive(room) {
    const stack = liveStack(room);
    if (!stack.length || !canChange()) return;
    const popped = stack[stack.length - 1];
    live[room] = stack.slice(0, -1);
    closeSheet();
    // T18d: the entries this swap pushed onto OTHER rooms' stacks go with it, when they are still on top there
    for (const l of (popped.meta && Array.isArray(popped.meta.linked) ? popped.meta.linked : [])) {
      const st2 = liveStack(l.room); const top = st2[st2.length - 1];
      if (top && top.meta && top.meta.linked_to && top.meta.linked_to.room === room && l.ok !== false) { live[l.room] = st2.slice(0, -1); dropLive([top]); void ensureComposed(l.room); }
    }
    applyRoom(room, null, () => { live[room] = stack; }).then(() => { if (!liveStack(room).includes(popped)) dropLive([popped]); });
  }
  /** T18d: a room's edited scene composed and registered without loading it — the visitor stays where they are; entering the room
      finds it ready. Also the way a linked undo leaves the other room consistent. */
  async function ensureComposed(room) {
    const key = sceneKey(room);
    if (key === room || composed[key]) return;
    const url = await composePano(room, activeIds(room));
    if (composed[key]) { URL.revokeObjectURL(url); return; }
    composed[key] = url;
    viewer.addScene(key, Object.assign({}, pscenes[room], { panorama: url }));
    retarget(room);
  }
  /** T18d: a live change pushed onto a room that is NOT on screen (the follow-up of a swap seen from there). */
  async function pushLiveQuiet(room, canvas, label, meta) {
    const url = await canvasToUrl(canvas);
    const img = await loadImage(url);
    const entry = { url, img, label: String(label || '').slice(0, 120), meta: meta || {} };
    live[room] = liveStack(room).concat([entry]);
    original[room] = false;
    await ensureComposed(room);
    sweep(room);
    renderChange();
    return entry;
  }
  /** Drop the composed panoramas of this room that no state points at any more. */
  function sweep(room) {
    const keep = editedKey(room);
    const cur = viewer.getScene();
    for (const k of Object.keys(composed)) {
      if (roomOf(k) !== room || k === keep || k === cur) continue;
      viewer.removeScene(k);
      URL.revokeObjectURL(composed[k]);
      delete composed[k];
    }
  }

  /* ── wiring ─────────────────────────────────────────────────────────────────── */
  // Eliran 2026-11-04 (phone parity): at <=640 px only the current language shows (EN/FR ran off the screen); a tap on it moves to the next
  // the language (direction C): ONE button, the current language. Desktop: it opens a small list of the three under it; phone: a tap
  // moves to the next language (unchanged since 2026-11-04). Escape or a tap outside closes the list.
  const langBox = $('t-lang');
  const langOpen = (on) => { langBox.classList.toggle('is-open', on); for (const x of langBox.querySelectorAll('button')) if (x.dataset.lang === lang) x.setAttribute('aria-expanded', String(on)); else x.removeAttribute('aria-expanded'); };
  for (const b of document.querySelectorAll('#t-lang button')) b.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 640px)').matches && b.dataset.lang === lang) { const order = [...document.querySelectorAll('#t-lang button')].map((x) => x.dataset.lang); setLang(order[(order.indexOf(lang) + 1) % order.length]); return; }
    if (b.dataset.lang === lang) { const open = !langBox.classList.contains('is-open'); if (open) { menuOpen(null); if (typeof closeDesign === 'function') closeDesign(false); } langOpen(open); return; }
    langOpen(false); setLang(b.dataset.lang);
    const cur = langBox.querySelector('button[aria-pressed="true"]'); if (cur) cur.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', (e) => { if (langBox.classList.contains('is-open') && !langBox.contains(e.target)) langOpen(false); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && langBox.classList.contains('is-open')) { langOpen(false); const cur = langBox.querySelector('button[aria-pressed="true"]'); if (cur) cur.focus({ preventScroll: true }); } });
  for (const b of document.querySelectorAll('#t-look button')) b.addEventListener('click', () => setLook(b.dataset.look)); // card Q09
  // HUD clearance (Eliran 2026-11-04, a ring label cut under the typed bar): every 250 ms, a ring or room marker whose label box meets a
  // HUD control (the bar, the pick bar, the item card, the travel row, the strip, the two rails) fades out; it returns once the view
  // moves it clear. Cheap: ~60 rect reads, skipped while the tab is hidden.
  setInterval(() => {
    if (document.hidden) return;
    const hud = ['#t-change-bar', '#t-pick', '#t-item-card', '.t-travel > *', '#t-strip', '#t-tools', '#t-design', '#t-floor-seg', '#t-place', '.t-head > *', '#t-view', '#t-disclose']
      .flatMap((q) => [...document.querySelectorAll(q)]).filter((e) => !e.closest('[hidden]') && !e.closest('[inert]')).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const h of document.querySelectorAll('.t-pano .t-mk, .t-pano .t-hs')) {
      const boxes = [h, ...h.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      h.classList.toggle('is-under-hud', boxes.length > 0 && boxes.some((r) => hud.some((q) => meets(r, q))));
    }
    const cx = innerWidth / 2, cy = innerHeight / 2, kept = [];
    const floorHs = [...document.querySelectorAll('.t-pano .t-hs-floor')].map((h) => ({ h, l: h.querySelector('.t-hs-label') })).filter((o) => o.l)
      .map((o) => { const r = o.h.getBoundingClientRect(); return { ...o, d: Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) }; }).sort((a, b) => a.d - b.d);
    for (const o of floorHs) {
      if (o.h.classList.contains('is-under-hud')) continue;
      const r = o.l.getBoundingClientRect(); if (!r.width) continue;
      const pad = { left: r.left - 6, right: r.right + 6, top: r.top - 4, bottom: r.bottom + 4 };
      const quiet = kept.some((q) => meets(pad, q)) && !o.h.classList.contains('is-aim') && !o.h.matches(':hover, :focus-visible');
      o.h.classList.toggle('is-quiet', quiet); if (!quiet) kept.push(pad);
    }
  }, 250);
  // Eliran 2026-11-04 («גם בדסקטופ וגם בנייד»): on phones the right rail shows each switch as ONE button, its current value; a tap on it
  // moves to the next value (the same pattern as the language button). Capture phase: the active button's own handler never runs.
  for (const seg of [document.querySelector('#t-look .t-look-seg'), $('t-floor-seg')]) if (seg) seg.addEventListener('click', (e) => {
    if (!window.matchMedia('(max-width: 640px)').matches || seg.closest('#t-design')) return;
    const btn = e.target.closest('button');
    if (!btn || btn.getAttribute('aria-pressed') !== 'true') return;
    const all = [...seg.querySelectorAll('button')].filter((x) => !x.hidden && !x.disabled);
    if (all.length < 2) return;
    e.stopImmediatePropagation(); e.preventDefault();
    all[(all.indexOf(btn) + 1) % all.length].click();
  }, true);
  $('t-plan-btn').addEventListener('click', () => { viewOpen(false); if (dhOn) openDh(); else openSheet('t-sheet', 't-sheet-close'); });
  /* 2026-11-08 (Eliran: «…תחת כפתור ראשי "כלי עזר" ליד כפתור שינוי עיצוב… עוד כפתור… "סגנונות צפייה"»): two menus beside «שינוי עיצוב».
     Desktop: a small menu 8 px under its button (like the design panel); phone: a bottom sheet that ends above the AI strip. One menu at
     a time (the design panel and the language list close too); an outside tap or Esc closes it (focus back on its button); keyboard:
     the button is aria-expanded, the first item takes focus. «כלי עזר» lights while the ruler or the voice tour is on. */
  const phoneMq = window.matchMedia('(max-width: 640px)');
  const MENUS = { view: ['t-view-btn', 't-view'], tools: ['t-tools-btn', 't-tools-menu'] };
  const menuIsOpen = () => Object.keys(MENUS).find((k) => !$(MENUS[k][1]).hidden) || null;
  function menuPlace(name) {
    const [bId, mId] = MENUS[name]; const m = $(mId), btn = $(bId);
    if (phoneMq.matches) { m.style.left = m.style.right = m.style.top = ''; return; }
    const r = btn.getBoundingClientRect(), w = m.offsetWidth, M = 12, rtl = document.documentElement.dir === 'rtl';
    const left = Math.min(Math.max(M, rtl ? r.right - w : r.left), innerWidth - w - M);
    Object.assign(m.style, { top: `${Math.round(r.bottom + 8)}px`, left: `${Math.round(left)}px`, right: 'auto' });
  }
  function menuOpen(name, focus) {
    for (const [k, [bId, mId]] of Object.entries(MENUS)) { const on = k === name; $(mId).hidden = !on; $(bId).setAttribute('aria-expanded', String(on)); }
    if (!name) return;
    if (typeof closeDesign === 'function') closeDesign(false);
    langOpen(false); menuPlace(name);
    if (focus) { const first = [...$(MENUS[name][1]).querySelectorAll('.t-menu-item')].find((x) => !x.hidden); if (first) first.focus({ preventScroll: true }); }
  }
  function viewOpen(on) { if (on) menuOpen('view'); else if (menuIsOpen() === 'view') menuOpen(null); }   // the 3D / plan handlers close it
  for (const [k, [bId, mId]] of Object.entries(MENUS)) {
    $(bId).addEventListener('click', (e) => menuOpen(menuIsOpen() === k ? null : k, e.detail === 0));   // a keyboard click focuses the first item
    for (const it of $(mId).querySelectorAll('.t-menu-item')) it.addEventListener('click', () => { if (menuIsOpen() === k) menuOpen(null); });
    for (const c of $(mId).querySelectorAll('[data-menu-close]')) c.addEventListener('click', () => { menuOpen(null); $(bId).focus({ preventScroll: true }); });
  }
  window.addEventListener('resize', () => { const k = menuIsOpen(); if (k) menuPlace(k); });
  document.addEventListener('pointerdown', (e) => {
    const k = menuIsOpen(); if (!k) return;
    const [bId, mId] = MENUS[k];
    if ($(mId).contains(e.target) || $(bId).contains(e.target) || e.target.closest('#t-coach')) return;   // the walkthrough opens menus itself
    menuOpen(null);
  }, true);
  document.addEventListener('keydown', (e) => { const k = menuIsOpen(); if (e.key === 'Escape' && k && !(typeof coach !== 'undefined' && coach.open)) { menuOpen(null); $(MENUS[k][0]).focus({ preventScroll: true }); } });
  $('t-map-btn').addEventListener('click', () => { viewOpen(false); openSheet('t-sheet', 't-sheet-close'); });
  $('t-view-360').addEventListener('click', () => viewOpen(false));   // the panorama is the view on screen: the menu just closes
  // «כלי עזר»: there only when one of its tools is (the ruler needs depth maps, the voice tour its steps); lit while one is on
  const toolsSync = () => {
    const r = $('t-ruler'), g = $('t-guide'), b = $('t-tools-btn');
    b.hidden = r.hidden && g.hidden;
    const on = r.getAttribute('aria-pressed') === 'true' || g.getAttribute('aria-pressed') === 'true';
    b.classList.toggle('is-on', on); b.setAttribute('aria-label', aui('tools') + (on ? ` · ${on && r.getAttribute('aria-pressed') === 'true' ? aui('ruler') : aui('guide')}` : ''));
  };
  for (const id of ['t-ruler', 't-guide']) new MutationObserver(toolsSync).observe($(id), { attributes: true, attributeFilter: ['hidden', 'aria-pressed'] });
  toolsSync();
  // the strip: open on a desktop, folded on a phone (the room pill opens it); the pill's caret shows which
  function stripOpen(on) { document.documentElement.classList.toggle('t-strip-closed', !on); $('t-rooms-btn').setAttribute('aria-expanded', String(on)); }
  stripOpen(!phoneMq.matches);
  $('t-rooms-btn').addEventListener('click', () => stripOpen(document.documentElement.classList.contains('t-strip-closed')));
  // the layout measures the CSS stacks on: the place card's height, the disclosure strip's height (the phone's action bar, the design
  // sheet and the guide card all end above it — research.md finding #9), the action bar's height
  const measureLayout = () => {
    const root = document.documentElement.style, h = (id) => Math.ceil($(id).getBoundingClientRect().height);
    root.setProperty('--place-h', h('t-place') + 'px'); root.setProperty('--ai-h', h('t-disclose') + 'px'); root.setProperty('--acts-h', h('t-acts') + 'px');
  };
  if (window.ResizeObserver) { const ro = new ResizeObserver(measureLayout); for (const id of ['t-place', 't-disclose', 't-acts']) ro.observe($(id)); }
  window.addEventListener('resize', measureLayout); measureLayout();
  /* ── 2026-11-08 (Eliran, screenshots: «אני רוצה שכל הפיצ'רים האלה יכנסו תחת כפתור 'שינוי עיצוב' שהכפתור יופיע למעלה, ככה זה לא יכסה לי את
     המסך»): the look switch, the floor finishes and the typed bar leave the panorama for ONE panel behind a header button. The controls
     are MOVED (same nodes, ids and handlers), so the look, the finishes, the edits and the catalog work as before. The look NOTE stays on
     the screen: it is part of the disclosure row (root §6). Desktop: a panel under the header; phone: a bottom sheet (CSS). Esc, the
     close button and a click outside close it; the button shows the current floor (or the original look) and its expanded state. ── */
  const design = $('t-design'), designBtn = $('t-design-btn');
  const lookSeg = document.querySelector('#t-look .t-look-seg');
  if (lookSeg) $('t-design-look').appendChild(lookSeg);
  $('t-design-floor').appendChild($('t-floor-seg'));
  $('t-design-type').appendChild($('t-change-bar'));
  function renderDesign() {
    const t = pick(DESIGN_UI.title);
    $('t-design-label').textContent = t; $('t-design-title').textContent = t;
    $('t-design-close').setAttribute('aria-label', pick(DESIGN_UI.close)); $('t-design-close').title = pick(DESIGN_UI.close);
    $('t-design-look-h').textContent = pick(DESIGN_UI.look); $('t-design-floor-h').textContent = pick(DESIGN_UI.floor); $('t-design-type-h').textContent = pick(DESIGN_UI.type);
    syncDesign();
  }
  function syncDesign() {
    const fseg = $('t-floor-seg');
    const lookOk = Boolean(lookSeg) && !$('t-look').hidden;
    const floorOk = !fseg.hidden && fseg.querySelectorAll('button:not([hidden])').length > 1 && !(byId[state.scene] && byId[state.scene].exterior);
    const typeOk = !$('t-change-bar').hidden;
    $('t-design-look').hidden = !lookOk; $('t-design-floor').hidden = !floorOk; $('t-design-type').hidden = !typeOk;
    designBtn.hidden = !(lookOk || floorOk || typeOk);
    if (designBtn.hidden && !design.hidden) closeDesign(false);
    const on = fseg.querySelector('button[aria-pressed="true"]');
    const stateText = look === 'original' ? ui('lookOriginal') : (floorOk && on ? on.textContent.replace(/\s*⇄\s*$/, '').trim() : '');
    $('t-design-state').textContent = stateText;
    $('t-design-state').hidden = !stateText;
    const t = pick(DESIGN_UI.title);
    designBtn.setAttribute('aria-label', stateText ? `${t} · ${stateText}` : t); designBtn.title = designBtn.getAttribute('aria-label');
  }
  // research.md finding #8: on a desktop the panel hangs from its own button (its inline-start edge on the button's), clamped inside
  // the screen; on a phone it is the bottom sheet (CSS), so the inline position is dropped
  function placeDesign() {
    if (design.hidden) return;
    if (phoneMq.matches) { design.style.left = design.style.right = design.style.top = ''; return; }
    const r = designBtn.getBoundingClientRect(), w = design.offsetWidth, M = 12, rtl = document.documentElement.dir === 'rtl';
    const left = Math.min(Math.max(M, rtl ? r.right - w : r.left), innerWidth - w - M);
    Object.assign(design.style, { top: `${Math.round(r.bottom + 8)}px`, left: `${Math.round(left)}px`, right: 'auto' });
  }
  window.addEventListener('resize', placeDesign);
  function designShow(on) {
    if (on) { if (design.hidden) { syncDesign(); design.hidden = false; designBtn.setAttribute('aria-expanded', 'true'); placeDesign(); } }
    else if (!design.hidden) closeDesign(false);
  }
  function openDesign() {
    syncDesign();
    menuOpen(null); design.hidden = false; designBtn.setAttribute('aria-expanded', 'true'); placeDesign();
    const first = design.querySelector('.t-design-sec:not([hidden]) button[aria-pressed="true"], .t-design-sec:not([hidden]) button, .t-design-sec:not([hidden]) input');
    (first || $('t-design-close')).focus({ preventScroll: true });
  }
  function closeDesign(back = true) {
    if (design.hidden) return;
    design.hidden = true; designBtn.setAttribute('aria-expanded', 'false');
    if (back) designBtn.focus({ preventScroll: true });
  }
  designBtn.addEventListener('click', () => (design.hidden ? openDesign() : closeDesign()));
  $('t-design-close').addEventListener('click', () => closeDesign());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !design.hidden) { e.stopPropagation(); closeDesign(); } });
  document.addEventListener('pointerdown', (e) => { if (!design.hidden && !design.contains(e.target) && !designBtn.contains(e.target) && !e.target.closest('#t-coach')) closeDesign(false); }, true);
  // the controls change state elsewhere (a room without an original, an exterior node, the unlock, the finish chosen): the button follows
  new MutationObserver(syncDesign).observe($('t-look'), { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(syncDesign).observe($('t-floor-seg'), { attributes: true, subtree: true, childList: true, attributeFilter: ['hidden', 'aria-pressed'] });
  new MutationObserver(syncDesign).observe($('t-change-bar'), { attributes: true, attributeFilter: ['hidden'] });
  if (lookSeg) new MutationObserver(syncDesign).observe(lookSeg, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
  designReady = true;
  renderDesign();
  $('t-change-btn').addEventListener('click', () => {
    if (roomEdits(state.scene).length || state.unlocked) openSheet('t-change', 't-change-close');
  });
  $('t-undo').addEventListener('click', () => undoLive(state.scene));
  $('t-compare').addEventListener('click', toggleOriginal);
  $('t-change-reset').addEventListener('click', resetEdits);
  $('t-zoom-in').addEventListener('click', () => viewer && viewer.setHfov(viewer.getHfov() - 12));
  $('t-zoom-out').addEventListener('click', () => viewer && viewer.setHfov(viewer.getHfov() + 12));
  $('t-reset').addEventListener('click', () => viewer && viewer.lookAt(-2, byId[state.scene].heading, fitHfov(), reduced ? false : 800));
  $('t-rotate').addEventListener('click', () => setRotating(!state.rotating));
  $('t-skip').addEventListener('click', autoSkip);
  $('t-prev').addEventListener('click', () => step(-1));
  $('t-next').addEventListener('click', () => step(1));
  $('t-retry').addEventListener('click', () => {
    $('t-error').hidden = true;
    if (!viewer) { window.location.reload(); return; }
    try { viewer.loadScene(sceneKey(state.scene), -2, byId[state.scene].heading, fitHfov()); } catch (_) { window.location.reload(); }
  });
  if (reduced) $('t-rotate').hidden = true;
  if (!document.fullscreenEnabled) $('t-full').hidden = true;
  else $('t-full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });

  /* ── the videos (Habait studio, 2026-11-01): the flyover intro (bird's eye → the facade → in through the terrace) and a clip
     per room, each in up to three floor finishes (data.videos.sets[floor]); a floor switch in the bar and in the overlay. When
     the build also carries a panorama set per floor (data.floorSets), the switch re-opens the page in that set. ── */
  const videos = data.videos && data.videos.sets ? data.videos : null;
  const floors = videos && Array.isArray(videos.floors) && videos.floors.length ? videos.floors : [];
  let floor = (() => { const q = params.get('floor'); return floors.some((f) => f.id === q) ? q : (videos && videos.defaultFloor) || (floors[0] ? floors[0].id : null); })();
  state.floor = floor;
  const VUI = {
    videoPlay: { he: 'סרטון החדר', en: 'Room video', fr: 'Vidéo de la pièce' },
    videoSkip: { he: 'דלג', en: 'Skip', fr: 'Passer' },
    videoClose: { he: 'סגור', en: 'Close', fr: 'Fermer' },
  };
  const vui = (k) => ui(k) || pick(VUI[k]);
  const vset = () => (videos ? videos.sets[floor] || videos.sets[Object.keys(videos.sets)[0]] : null);
  const roomVideo = (room) => { const s = vset(); return s && s.rooms && s.rooms[room] ? s.rooms[room] : null; };
  let videoAfter = null;
  const videoEl = () => $('t-video-el');
  let videoFade = false;
  function playVideo(src, title, after, fade) {
    if (coachMusicStop) coachMusicStop(true);   // one sound at a time
    const v = videoEl();
    videoAfter = after || null;
    videoFade = Boolean(fade);
    $('t-video').classList.remove('is-fading');
    $('t-video-title').textContent = title || '';
    $('t-video-skip-text').textContent = after ? vui('videoSkip') : vui('videoClose');
    $('t-video').hidden = false;
    document.documentElement.classList.add('has-video');
    v.muted = true; v.loop = false; v.src = src;
    $('t-video-play').hidden = true;
    if (state.rotating) setRotating(false);
    const p = v.play();
    if (p && p.catch) p.catch(() => { $('t-video-play').hidden = false; }); // autoplay refused: a tap starts it, with sound
  }
  function endVideo() {
    const v = videoEl();
    const box = $('t-video');
    const after = videoAfter; videoAfter = null;
    const finish = () => {
      try { v.pause(); } catch (_) { /* nothing to pause */ }
      v.removeAttribute('src');
      try { v.load(); } catch (_) { /* old engines */ }
      box.hidden = true; box.classList.remove('is-fading');
      document.documentElement.classList.remove('has-video');
    };
    if (videoFade && after) {
      // the panorama takes the landing view UNDER the still last frame, then the frame fades away over it
      try { v.pause(); } catch (_) { /* keep the last frame */ }
      after();
      box.classList.add('is-fading');
      window.setTimeout(finish, reduced ? 0 : 900);
      return;
    }
    finish();
    if (after) after();
  }
  function renderFloorSeg(node) {
    if (!node) return;
    node.textContent = '';
    if (floors.length < 2) return;
    for (const f of floors) {
      const b = el('button', { type: 'button', 'aria-pressed': String(f.id === floor) }, [pick(f.name)]);
      b.addEventListener('click', () => setFloor(f.id));
      node.appendChild(b);
    }
  }
  function setFloor(id) {
    if (!floors.some((f) => f.id === id) || id === floor) return;
    floor = id; state.floor = id;
    if (data.floorSets && data.floorSets[id] && data.floorSets[id].dir) {
      // the panoramas change with the floor: the page re-opens in this room, in that set, without the intro
      try { const u = new URL(window.location.href); u.searchParams.set('floor', id); u.searchParams.set('room', state.scene); u.searchParams.set('video', '0'); u.searchParams.set('ir', '1'); window.location.href = String(u); } catch (_) { window.location.reload(); }
      return;
    }
    renderFloorSeg($('t-floor-seg')); renderFloorSeg($('t-video-floors'));
    const v = videoEl();
    if (!$('t-video').hidden) {
      // the clip that is playing swaps to the same clip in the chosen floor, at the same moment (the intro or a room clip)
      const src = v.dataset.room ? roomVideo(v.dataset.room) : (vset() || {}).intro;
      if (src && !String(v.currentSrc || '').endsWith(src)) {
        const at = v.currentTime;
        v.src = src;
        v.addEventListener('loadedmetadata', () => { try { v.currentTime = Math.min(at, Math.max(0, v.duration - 0.1)); } catch (_) { /* not seekable yet */ } }, { once: true });
        const p = v.play(); if (p && p.catch) p.catch(() => {});
      }
    }
    syncUrl();
  }
  function renderVideoBar() {
    if (!videos) return;
    const src = roomVideo(state.scene);
    // the floor finish (concrete / parquet / marble) belongs to the apartment only: the building and surroundings nodes never
    // show it (Eliran, 2026-11-04)
    const ext = Boolean(byId[state.scene] && byId[state.scene].exterior);
    $('t-floor-seg').hidden = ext;
    $('t-video-bar').hidden = !src && (floors.length < 2 || ext);
    $('t-video-btn').hidden = !src;
    $('t-video-btn-text').textContent = vui('videoPlay');
    renderFloorSeg($('t-floor-seg'));
  }
  function playRoomVideo() {
    const src = roomVideo(state.scene);
    if (!src) return;
    videoEl().dataset.room = state.scene;
    playVideo(src, nameOf(byId[state.scene]), null);
  }
  function maybeIntro() {
    const s = vset();
    if (!s || !s.intro || params.get('video') === '0') return;
    let seen = false;
    try { seen = sessionStorage.getItem('t-intro-seen') === '1'; sessionStorage.setItem('t-intro-seen', '1'); } catch (_) { /* private mode */ }
    if (seen && params.get('video') !== '1') return;
    videoEl().dataset.room = '';
    const land = videos.land || {};
    // one continuous visualization (Eliran 2026-11-02): the flight's last frame IS the landing view of the panorama (same point,
    // same heading, the flight's 28 mm lens = 65.5° hfov), so the overlay fades over the live panorama already set to that view,
    // then the lens eases out to the tour's own width
    document.documentElement.classList.add('is-intro');
    playVideo(s.intro, '', () => {
      document.documentElement.classList.remove('is-intro');
      if (!(land.scene && byId[land.scene] && viewer)) return;
      state.interacted = true;
      const yaw = typeof land.yaw === 'number' ? land.yaw : byId[land.scene].heading;
      const hf = typeof land.hfov === 'number' ? land.hfov : 65.5;
      if (roomOf(viewer.getScene()) === land.scene) { viewer.setYaw(yaw, false); viewer.setPitch(-2, false); viewer.setHfov(hf, false); }
      else viewer.loadScene(sceneKey(land.scene), -2, yaw, hf);
      window.setTimeout(() => { try { viewer.setHfov(fitHfov(), 1500); } catch (_) { /* old engine */ } }, 900);
    }, true);
  }
  // sound: browsers autoplay only muted; the visitor's first tap on the speaker (or the play button) turns the music on, and the
  // choice sticks for the session
  let soundOn = false;
  try { soundOn = sessionStorage.getItem('t-sound') === '1'; } catch (_) { /* private mode */ }
  function renderSound() { const b = $('t-video-sound'); if (b) b.setAttribute('aria-pressed', String(soundOn)); }
  function setSound(on) {
    soundOn = Boolean(on);
    try { sessionStorage.setItem('t-sound', soundOn ? '1' : '0'); } catch (_) { /* private mode */ }
    const v = videoEl(); v.muted = !soundOn;
    if (soundOn && v.paused && !$('t-video').hidden) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    renderSound();
  }
  if (videos) {
    $('t-video-btn').addEventListener('click', playRoomVideo);
    $('t-video-skip').addEventListener('click', endVideo);
    $('t-video-sound').addEventListener('click', () => setSound(!soundOn));
    videoEl().addEventListener('play', () => { if (soundOn) { try { videoEl().muted = false; } catch (_) { /* no gesture yet */ } } renderSound(); });
    $('t-video-play').addEventListener('click', () => { $('t-video-play').hidden = true; setSound(true); const p = videoEl().play(); if (p && p.catch) p.catch(() => {}); });
    videoEl().addEventListener('ended', endVideo);
    videoEl().addEventListener('error', endVideo);
    renderFloorSeg($('t-video-floors'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('t-video').hidden) endVideo(); });
  }
  state.videos = videos ? { floors: floors.map((f) => f.id), rooms: Object.keys((vset() || {}).rooms || {}), intro: Boolean((vset() || {}).intro) } : null;

  /* ── the viewer ─────────────────────────────────────────────────────────────── */
  function onLoad() {
    window.clearTimeout(walkPill);
    state.sceneKey = viewer.getScene();
    state.scene = roomOf(state.sceneKey);
    visited.add(state.scene);
    state.visited = Array.from(visited);
    state.loads += 1;
    state.ready = true;
    state.applying = false;
    sweep(state.scene);
    showLoading(false);
    renderRoom();
    if (state.rotating) viewer.startAutoRotate(-2.2);
    syncUrl();
    autoArm();
    if (state.loads === 1) maybeIntro(); // the flyover plays over the first room while it loads behind
    if (pending.length && state.scene === firstId && look !== 'original') {
      // a shared link: ?change=sofa,table opens the room, then the change lands in front of the visitor
      const ids = pending.slice().sort(byOrder(firstId));
      pending = [];
      active[firstId] = ids;
      applyRoom(firstId, editDef(firstId, ids[0]), () => { active[firstId] = []; });
    }
  }

  renderStatic();
  renderRoom();

  if (typeof window.pannellum === 'undefined') { showError(); return; }
  const hf = fitHfov();
  for (const s of scenes) {
    pscenes[s.id] = {
      type: 'equirectangular',
      panorama: panoPath(s.asset),
      tiles: tilesOf(s),
      yaw: s.id === firstId && Number.isFinite(firstYaw) ? firstYaw : s.heading, // the deep-link landing (see firstYaw)
      pitch: -2,
      hfov: hf,
      minHfov: 40,
      maxHfov: 130,
      hotSpots: (state.catalog ? (s.markers || []).map((m) => {
        // a replaceable piece (T16c): the ring sits on the scan's direction until a live change moves it (refreshMarkers); the rings
        // come before the door markers so the keyboard reaches them first (T18k, F11)
        const hs = { type: 'info', yaw: m.yaw, pitch: m.pitch, cssClass: 't-mk', createTooltipFunc: makeMarker, createTooltipArgs: { room: s.id, id: m.id }, clickHandlerFunc: markerClick, clickHandlerArgs: { room: s.id, id: m.id } };
        markerHs[s.id + '/' + m.id] = hs;
        return hs;
      }) : []).concat(floorRows(s, s.hotspots.filter((h) => byId[h.to])).map(({ h, row }) => {
        const t = byId[h.to]; const floor = !s.exterior;
        const hs = {
          type: 'scene',
          sceneId: t.id,
          nameAs: byId[h.as] ? h.as : null,
          yaw: h.u == null ? bearing(s, t) : hsYaw(h.u),
          pitch: floor ? FLOOR_ROWS[row].pitch : (h.v == null ? -14 : hsPitch(h.v)),
          targetYaw: arriveYaw(s, t), // card Q08: arrive facing the direction of travel (Pannellum's own click reads it too)
          targetPitch: -2,
          targetHfov: hf,
          clickHandlerFunc: () => { autoOff = params.get('auto') === '0'; }, // a door tap re-arms the automatics (the descent after the tap on the apartment)
          cssClass: floor ? 't-hs t-hs-floor t-hs-row' + row : 't-hs',
          createTooltipFunc: makeHotspot,
          createTooltipArgs: null,
        };
        hs.createTooltipArgs = { to: t.id, hs, floor }; // the keyboard's Enter takes the same door (enterDoor)
        (hsByTarget[t.id] = hsByTarget[t.id] || []).push(hs);
        return hs;
      })),
    };
  }
  // card Q09: each room's original picture as one more scene, sharing the room's doors (they are retargeted by the switch)
  if (hasOriginal) for (const s of scenes) pscenes[origKey(s.id)] = Object.assign({}, pscenes[s.id], { panorama: data.originalSet.dir + '/' + s.asset + '.webp', tiles: null });
  if (look === 'original') for (const s of scenes) retarget(s.id);
  try {
    viewer = window.pannellum.viewer('pano', {
      default: {
        firstScene: look === 'original' ? origKey(firstId) : firstId,
        sceneFadeDuration: reduced ? 0 : 650,
        // card Q08, D-WQ-14 tier 1: a door turns, moves forward with a blur and fades in, facing the direction of travel (the engine;
        // Pannellum ignores the key); under reduced motion the swap stays instant
        walkIn: reduced ? false : { moveMs: 650 },
        autoLoad: true,
        showControls: false,
        compass: false,
        keyboardZoom: true,
        mouseZoom: true,
        friction: 0.15,
      },
      scenes: pscenes,
    });
  } catch (_) {
    showError();
    return;
  }
  state.viewer = viewer;
  viewer.on('scenechange', (id, info) => {
    state.sceneKey = id;
    state.scene = roomOf(id);
    window.clearTimeout(walkPill);
    // a walk-in hides the swap under its moving frame: the pill shows only if the room is slow to come (card Q08)
    if (info && info.walk) walkPill = window.setTimeout(() => { if (!viewer.isLoaded()) showLoading(true, ''); }, 700);
    else showLoading(true, state.applying ? ui('changeApplying') : '');
    renderRoom();
  });
  viewer.on('load', onLoad);
  viewer.on('error', showError);
  /* ── board dollhouse-in-tour (2026-11-03, Eliran: "1 ואחריו 3"): the 3D dollhouse over the tour ──
     The 3D button opens a full-screen layer with the apartment's dollhouse (dist/<id>/3d/dollhouse.html, the same file as the
     apartment page's 3D tab), loaded on the first open. The tour tells it where the buyer stands and looks:
     {type:'habait:you-are-here', scene, bearing (plan degrees, 0 = up, clockwise = centreBearingDeg + yaw), fov} -> a dot and a
     view cone on that room's camera point; and the floor finish ({type:'habait:floor', floor}). A room's "view in 360" in the
     dollhouse posts {type:'habait:enter-room', scene} -> the tour goes there and the layer closes. Messages only to and from that
     frame (same origin). ── */
  const dh = { open: false, ready: false, last: '', back: null, inerted: [] };
  const dhFrame = () => $('t-3d-frame');
  const dhPost = (msg) => { try { const w = dhFrame().contentWindow; if (w) w.postMessage(msg, '*'); } catch (_) { /* not loaded */ } };
  function dhHere(force) {
    if (!dh.open || !dh.ready || !viewer || !viewer.isLoaded()) return;
    const s = byId[state.scene];
    if (!s || s.exterior || !Number.isFinite(s.centreBearingDeg)) return;
    const bearing = ((s.centreBearingDeg + viewer.getYaw()) % 360 + 360) % 360;
    const fov = viewer.getHfov();
    const key = state.scene + '|' + bearing.toFixed(1) + '|' + fov.toFixed(0);
    if (!force && key === dh.last) return;
    dh.last = key;
    dhPost({ type: 'habait:you-are-here', scene: state.scene, bearing, fov });
  }
  /* board transition-rise (2026-11-04): the 3D rises out of this very view. The dollhouse loads hidden (#defer: parsed, not drawn)
     once the tour is idle; it gets the scenes (pano, depth, bearing0, heading), and on open the view to rise from. The layer stays
     invisible until the dollhouse has drawn the first frame of the move (= this panorama), so the hand-off has no flash. */
  const dhAbs = (rel) => new URL(rel, window.location.href).href;
  const dhScenes = () => {
    const out = {};
    for (const s of scenes) {
      if (s.exterior || !Number.isFinite(s.centreBearingDeg)) continue;
      const dep = data.depth && data.depth.scenes && data.depth.scenes[s.id];
      out[s.id] = { pano: dhAbs(panoPath(s.asset)), depth: dep ? dhAbs(data.depth.dir + '/' + dep) : null, bearing0: s.centreBearingDeg, heading: s.heading };
    }
    return { type: 'habait:scenes', eye: (data.apartment && data.apartment.eye_m) || 1.6, hfov: fitHfov(), scenes: out };
  };
  function dhRise() {
    if (!dh.ready || !viewer || !viewer.isLoaded()) return false;
    const cfg = viewer.getConfig ? viewer.getConfig() : {};
    const msg = dhScenes();
    if (cfg && cfg.panorama && msg.scenes[state.scene]) msg.scenes[state.scene].pano = dhAbs(cfg.panorama); // the picture on screen
    dhPost(msg);
    dhPost({ type: 'habait:3d-show' });
    dhPost({ type: 'habait:rise', scene: state.scene, yaw: viewer.getYaw(), pitch: viewer.getPitch(), hfov: viewer.getHfov() });
    return true;
  }
  function dhReveal() { if (dh.revealT) { clearTimeout(dh.revealT); dh.revealT = 0; } $('t-3d').style.opacity = ''; }
  function openDh() {
    if (!dhOn) return;
    const f = dhFrame();
    if (!f.getAttribute('src')) f.setAttribute('src', data.dollhouse);
    dh.back = document.activeElement;
    $('t-3d').style.opacity = '0';                      // until the first frame of the rise (or 2.5 s, or no rise)
    dh.revealT = window.setTimeout(dhReveal, 2500);
    $('t-3d').hidden = false;
    dh.open = true;
    if (dh.ready && !dhRise()) dhReveal();
    // a modal layer (gate D1): the tour behind it leaves the tab order and the screen reader's reach until it closes
    // (the page lives in main#t-root together with the layer: its siblings go inert, never the layer or an ancestor of it)
    for (const n of $('t-3d').parentElement.children) if (n.id !== 't-3d' && n.tagName !== 'SCRIPT' && !n.inert) { n.inert = true; dh.inerted.push(n); }
    $('t-3d-close').focus({ preventScroll: true });
    if (dh.ready) dhHere(true);
  }
  function closeDh() {
    if (!dh.open) return;
    $('t-3d').hidden = true;
    dh.open = false;
    dhPost({ type: 'habait:3d-hide' }); // gate D1: a dive still playing in there is dropped (no enter-room after the buyer left)
    for (const n of dh.inerted) n.inert = false;
    dh.inerted = [];
    if (dh.back && dh.back.focus) dh.back.focus({ preventScroll: true });
  }
  $('t-3d-btn').addEventListener('click', openDh);
  $('t-3d-close').addEventListener('click', closeDh);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dh.open) closeDh(); });
  window.addEventListener('message', (e) => {
    if (!dhOn || e.source !== dhFrame().contentWindow) return;
    const m = e.data && typeof e.data === 'object' ? e.data : {};
    if (m.type === 'habait:3d-ready') {
      dh.ready = true;
      if (state.floor) dhPost({ type: 'habait:floor', floor: state.floor });
      dhPost(dhScenes());
      if (dh.open && !dhRise()) dhReveal();
      dhHere(true);
    } else if (m.type === 'habait:rise-ready') {
      dhReveal();
    } else if (m.type === 'habait:escape') {
      closeDh(); // Esc pressed inside the 3D (focus was in the frame), nothing selected there
    } else if (m.type === 'habait:enter-room' && typeof m.scene === 'string' && byId[m.scene]) {
      // gate D1 (transition-rise): the buyer closed the layer (Esc, ×) while the dive played -> they backed out; stay put
      if (!dh.open) return;
      // after a dive the layer shows that room's opening view: the tour switches under it and the layer closes on the loaded
      // panorama (same frame), else at once
      if (m.dove && m.scene === state.scene) {
        // gate N2: the dive into the room the buyer stands in ends on its opening view -> the tour takes that view, then closes
        viewer.setPitch(-2, false); viewer.setYaw(byId[m.scene].heading, false); viewer.setHfov(fitHfov(), false);
        closeDh();
      } else if (m.dove) {
        let done = false;
        const fin = () => { if (!done) { done = true; closeDh(); } };
        viewer.on('load', function once() { viewer.off && viewer.off('load', once); window.setTimeout(fin, 60); });
        window.setTimeout(fin, 2500);
        go(m.scene, true);
      } else {
        closeDh();
        if (m.scene !== state.scene) go(m.scene, true);
      }
    }
  });
  window.setInterval(() => dhHere(false), 120);
  // preload the dollhouse (parsed, not drawn) once the tour has been idle a moment, so the 3D opens straight into the rise
  if (dhOn) viewer.on('load', function preload() { viewer.off && viewer.off('load', preload); window.setTimeout(() => { const f = dhFrame(); if (!f.getAttribute('src')) f.setAttribute('src', data.dollhouse + '#defer'); }, 2500); });
  viewer.on('load', () => dhHere(true));

  /* the minimap bridge (card 10, 2026-11-02): when the tour is embedded (the platform's apartment page), tell the parent where the
     visitor is: {type:'habait:view', scene, yaw, fov, pitch, floor} on load, on every scene change and ~10/s while the view turns
     (posted only when something changed); answer {type:'habait:view-request'}; honour {type:'habait:goto', scene} (a tap on a room
     in the minimap). Nothing is posted at top level. '*' because the parent may be another origin on the laptop (:8850 vs :8848). */
  if (window.self !== window.top) {
    let lastView = '';
    const postView = (force) => {
      if (!state.ready || !viewer.isLoaded()) return;
      const yaw = viewer.getYaw(), fov = viewer.getHfov(), pitch = viewer.getPitch();
      const key = [state.scene, yaw.toFixed(1), fov.toFixed(1), pitch.toFixed(1), floor].join('|');
      if (!force && key === lastView) return;
      lastView = key;
      try { window.parent.postMessage({ type: 'habait:view', scene: state.scene, yaw, fov, pitch, floor: floor || null }, '*'); } catch (_) { /* no parent */ }
    };
    window.setInterval(() => postView(false), 100);
    viewer.on('load', () => postView(true));
    window.addEventListener('message', (e) => {
      const m = e && e.data && typeof e.data === 'object' ? e.data : {};
      if (m.type === 'habait:view-request') postView(true);
      else if (m.type === 'habait:goto' && typeof m.scene === 'string' && byId[m.scene]) go(m.scene, true);
    });
  }
  const touched = () => {
    if (state.rotating) setRotating(false);
    if (!state.interacted) { state.interacted = true; if (state.ready) renderRoom(); }
  };
  viewer.on('mousedown', touched);
  viewer.on('touchstart', touched);
  // the rings hide while the view moves (a drag, its inertia, a lookAt, the auto-rotate) and show when it rests (T16c)
  viewer.on('mousedown', () => setMoving(true));
  viewer.on('touchstart', () => setMoving(true));
  viewer.on('animatefinished', () => { setMoving(false); renderCone(); });
  viewer.on('load', () => setMoving(false)); // T18k: the rings show as soon as the scene is up

  /* ── the ruler (2026-11-03, Eliran: "למדוד מרחקים של כל דבר בעצמאות … שהמידות יהיו בהתאם לתכנית מכר") ──
     data.depth = per-room equirect depth (rgb24-be centimetres, radial) rendered from the plan-true furnished scene in the panorama's
     own yaw frame (yaw 0 = u 0.5). Two taps → the straight-line distance between the two surface points. Walls, floors and openings
     are the sales plan's; the furniture is the designed picture's (the clay's proxies sit where the plan furnishes). ── */
  const measure = { on: false, cache: {}, pending: null, items: [], n: 0, downAt: null };
  const M_UI = {
    hint: { he: 'לחצו על שתי נקודות למדידת המרחק ביניהן', en: 'Tap two points to measure the distance between them', fr: 'Touchez deux points pour mesurer la distance entre eux' },
    second: { he: 'עכשיו הנקודה השנייה', en: 'Now the second point', fr: 'Maintenant le second point' },
    none: { he: 'אין מדידה בחדר הזה', en: 'No measuring in this room', fr: 'Pas de mesure dans cette pièce' },
    sky: { he: 'אין משטח בנקודה הזו', en: 'No surface at that point', fr: 'Pas de surface à cet endroit' },
    clear: { he: 'נקה', en: 'Clear', fr: 'Effacer' },
    note: { he: 'המידות לפי תכנית המכר (DBLK, 15.10.2025) · הריהוט להמחשה', en: 'Dimensions per the sales plan (DBLK, 15.10.2025) · furniture is illustrative', fr: 'Cotes selon le plan de vente (DBLK, 15.10.2025) · mobilier indicatif' },
    title: { he: 'מדידה', en: 'Measure', fr: 'Mesurer' },
  };
  const mui = (k) => pick(M_UI[k]);
  const fmtM = (m) => (m < 1 ? `${Math.round(m * 100)} ${pick({ he: 'ס״מ', en: 'cm', fr: 'cm' })}` : `${m.toFixed(2)} ${pick({ he: 'מ׳', en: 'm', fr: 'm' })}`);
  function depthFor(room) {
    const d = data.depth; if (!d || !d.scenes[room]) return Promise.resolve(null);
    if (!measure.cache[room]) measure.cache[room] = new Promise((res) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data; const v = new Uint32Array(c.width * c.height); for (let i = 0, j = 0; i < v.length; i++, j += 4) v[i] = (px[j] << 16) | (px[j + 1] << 8) | px[j + 2]; res({ w: c.width, h: c.height, v }); };
      im.onerror = () => res(null); im.src = d.dir + '/' + d.scenes[room];
    });
    return measure.cache[room];
  }
  function surfacePoint(dm, pitch, yaw) {                                   // metres in the camera frame: x right, y forward, z up
    const u = ((yaw / 360) % 1 + 1.5) % 1, vv = Math.min(0.9999, Math.max(0, 0.5 - pitch / 180));
    const col = Math.min(dm.w - 1, Math.floor(u * dm.w)), row = Math.min(dm.h - 1, Math.floor(vv * dm.h));
    const vals = [];                                                          // 3×3 median: a tap on an edge must not read the far wall
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = Math.min(dm.h - 1, Math.max(0, row + dr)), c = (col + dc + dm.w) % dm.w; const x = dm.v[r * dm.w + c]; if (x > 0 && x < 60 * data.depth.scale) vals.push(x); }
    if (!vals.length) return null; vals.sort((a, b) => a - b); const dist = vals[vals.length >> 1] / data.depth.scale;
    const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180, cp = Math.cos(p);
    return { x: Math.sin(y) * cp * dist, y: Math.cos(y) * cp * dist, z: Math.sin(p) * dist, dist, pitch, yaw };
  }
  const toAngles = (q) => { const r = Math.hypot(q.x, q.y, q.z); return { pitch: Math.asin(q.z / r) * 180 / Math.PI, yaw: Math.atan2(q.x, q.y) * 180 / Math.PI }; };
  function addMark(room, pitch, yaw, cls, text) {
    const id = 'measure-' + (++measure.n); const mk = { id, room, div: null };
    viewer.addHotSpot({ id, pitch, yaw, cssClass: cls, createTooltipFunc: (div) => { mk.div = div; if (text) { div.textContent = text; div.setAttribute('lang', lang); } }, createTooltipArgs: null }, sceneKey(room));
    return mk;
  }
  function renderMeasureBar() {
    const bar = $('t-measure-bar'); if (!bar) return;
    bar.hidden = !measure.on;
    if (!measure.on) return;
    const has = Boolean(data.depth && data.depth.scenes[state.scene]);
    $('t-measure-hint').textContent = !has ? mui('none') : measure.pending ? mui('second') : mui('hint');
    $('t-measure-clear').textContent = mui('clear'); $('t-measure-clear').hidden = !measure.items.length;
    $('t-measure-note').textContent = mui('note');
  }
  function setMeasure(on) {
    measure.on = Boolean(on); measure.pending = null;
    document.documentElement.classList.toggle('t-ruler-on', measure.on);
    const b = $('t-ruler'); if (b) { b.setAttribute('aria-pressed', String(measure.on)); b.title = mui('title'); b.setAttribute('aria-label', mui('title')); }
    if (measure.on && state.rotating) setRotating(false);
    renderMeasureBar();
  }
  function clearMeasures() {
    for (const it of measure.items) for (const mk of [it.a, it.b, it.label]) { try { viewer.removeHotSpot(mk.id, sceneKey(it.room)); } catch (_) { /* gone with the scene */ } }
    measure.items = []; measure.pending = null; renderMeasureBar();
  }
  async function measureTap(ev) {
    if (!measure.on || !viewer || !viewer.isLoaded()) return;
    const room = state.scene; const dm = await depthFor(room); if (!dm) { renderMeasureBar(); return; }
    let pitch, yaw; try { [pitch, yaw] = viewer.mouseEventToCoords(ev); } catch (_) { return; }
    const q = surfacePoint(dm, pitch, yaw);
    if (!q) { $('t-measure-hint').textContent = mui('sky'); return; }
    if (!measure.pending) { measure.pending = { room, q, mk: addMark(room, pitch, yaw, 't-mk-measure') }; renderMeasureBar(); return; }
    if (measure.pending.room !== room) { measure.pending = null; renderMeasureBar(); return; }
    const a = measure.pending; measure.pending = null;
    const b = { q, mk: addMark(room, pitch, yaw, 't-mk-measure') };
    const d = Math.hypot(a.q.x - b.q.x, a.q.y - b.q.y, a.q.z - b.q.z);
    const mid = toAngles({ x: (a.q.x + b.q.x) / 2, y: (a.q.y + b.q.y) / 2, z: (a.q.z + b.q.z) / 2 });
    measure.items.push({ room, a: a.mk, b: b.mk, label: addMark(room, mid.pitch, mid.yaw, 't-measure-label', fmtM(d)), metres: d });
    renderMeasureBar();
  }
  // a tap = a press that did not drag (6 px), on the panorama itself (not on a door or a marker)
  const panoEl = $('pano');
  const isPanoTarget = (t) => t && (t.classList.contains('pnlm-dragfix') || t.classList.contains('pnlm-render-container') || t.tagName === 'CANVAS');
  panoEl.addEventListener('pointerdown', (e) => { measure.downAt = { x: e.clientX, y: e.clientY, t: e.target }; }, true);
  panoEl.addEventListener('pointerup', (e) => { const d = measure.downAt; measure.downAt = null; if (!measure.on || !d || !isPanoTarget(d.t)) return; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return; measureTap({ clientX: e.clientX, clientY: e.clientY }); }, true);
  (function drawMeasureLines() {                                            // the dashed line between the two marks of each measurement in this room
    const svg = $('t-measure-svg');
    if (svg) {
      const root = $('t-root').getBoundingClientRect(); let html = '';
      for (const it of measure.items) {
        if (it.room !== state.scene || !it.a.div || !it.b.div) continue;
        if (it.a.div.style.visibility === 'hidden' || it.b.div.style.visibility === 'hidden') continue;
        const ra = it.a.div.getBoundingClientRect(), rb = it.b.div.getBoundingClientRect();
        html += `<line x1="${(ra.left + ra.width / 2 - root.left).toFixed(1)}" y1="${(ra.top + ra.height / 2 - root.top).toFixed(1)}" x2="${(rb.left + rb.width / 2 - root.left).toFixed(1)}" y2="${(rb.top + rb.height / 2 - root.top).toFixed(1)}"/>`;
      }
      if (svg.innerHTML !== html) svg.innerHTML = html;
    }
    window.requestAnimationFrame(drawMeasureLines);
  })();
  if (data.depth && $('t-ruler')) { $('t-ruler').hidden = false; $('t-ruler').title = mui('title'); $('t-ruler').addEventListener('click', () => setMeasure(!measure.on)); $('t-measure-clear').addEventListener('click', clearMeasures); }
  viewer.on('scenechange', () => { measure.pending = null; renderMeasureBar(); });

  /* ── "מצב סיור" (2026-11-03, Eliran: "רואים באמת דמות שעושה סיור מחדר לחדר ומסבירה על כל חדר") ──
     data.guide[lang].steps = [{scene, text, audio, seconds}] (apartments/<id>/guide, narration by edge-tts). The guide walks the rooms in
     order: go to the room, the presenter card shows the narration and plays it, the view turns slowly; when the narration ends the next
     room follows. "הבא" skips, "עצירה" ends. The presenter is a stylised figure for now (a photoreal talking presenter = a paid model). ── */
  const guide = { on: false, i: -1, audio: null, token: 0 };
  const G_UI = {
    title: { he: 'מצב סיור', en: 'Guided tour', fr: 'Visite guidée' }, stop: { he: 'עצירה', en: 'Stop', fr: 'Arrêter' }, next: { he: 'הבא', en: 'Next', fr: 'Suivant' },
    of: { he: 'מתוך', en: 'of', fr: 'sur' }, muted: { he: 'הקול כבוי בדפדפן · לחצו להפעלה', en: 'Sound is blocked · tap to enable', fr: 'Son bloqué · touchez pour activer' },
  };
  const gui = (k) => pick(G_UI[k]);
  const guideDoc = () => (data.guide && (data.guide[lang] || data.guide.he)) || null;
  const guideSteps = () => { const g = guideDoc(); return g ? g.steps.filter((s) => byId[s.scene]) : []; };
  function guideRender() {
    const card = $('t-guide-card'); if (!card) return;
    card.hidden = !guide.on;
    const b = $('t-guide'); if (b) { b.setAttribute('aria-pressed', String(guide.on)); b.title = gui('title'); b.setAttribute('aria-label', gui('title')); }
    if (!guide.on) return;
    const steps = guideSteps(), st = steps[guide.i], g = guideDoc();
    $('t-guide-name').textContent = (g && g.name) || '';
    $('t-guide-text').textContent = st ? st.text : '';
    $('t-guide-count').textContent = st ? `${guide.i + 1} ${gui('of')} ${steps.length} · ${nameOf(byId[st.scene])}` : '';
    $('t-guide-next').textContent = gui('next'); $('t-guide-stop').textContent = gui('stop');
  }
  const waitLoaded = () => new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; const t0 = Date.now(); const poll = () => { if (viewer.isLoaded() && Date.now() - t0 > 250) return fin(); if (Date.now() - t0 > 7000) return fin(); window.setTimeout(poll, 100); }; window.setTimeout(poll, 300); });
  async function guideGo(i) {
    const token = ++guide.token; const steps = guideSteps();
    if (guide.audio) { guide.audio.pause(); guide.audio = null; }
    if (i >= steps.length) { guideStop(); return; }
    guide.i = i; const st = steps[i];
    if (state.scene !== st.scene) { go(st.scene, true); await waitLoaded(); }
    if (token !== guide.token) return;
    guideRender();
    document.documentElement.classList.add('t-guide-speaking');
    const vid = $('t-guide-video'), fig = $('t-guide-figure');
    if (st.video && vid) {                                                   // the talking presenter clip carries its own voice
      fig.hidden = true; vid.hidden = false; vid.src = st.video; vid.muted = false; vid.playsInline = true; guide.audio = vid;
      vid.onended = () => { if (token !== guide.token) return; document.documentElement.classList.remove('t-guide-speaking'); window.setTimeout(() => { if (token === guide.token) guideGo(i + 1); }, 900); };
      vid.onerror = () => { if (token === guide.token) window.setTimeout(() => guideGo(i + 1), Math.max(4000, (st.seconds || 8) * 1000)); };
      const pv = vid.play(); if (pv && pv.catch) pv.catch(() => { $('t-guide-text').textContent = gui('muted') + ' — ' + st.text; });
      if (!reduced) setRotating(true);
      return;
    }
    if (vid) { vid.hidden = true; vid.removeAttribute('src'); } if (fig) fig.hidden = false;
    const a = new Audio(st.audio); guide.audio = a; a.preload = 'auto';
    a.addEventListener('ended', () => { if (token !== guide.token) return; document.documentElement.classList.remove('t-guide-speaking'); window.setTimeout(() => { if (token === guide.token) guideGo(i + 1); }, 900); });
    a.addEventListener('error', () => { if (token === guide.token) window.setTimeout(() => guideGo(i + 1), Math.max(4000, (st.seconds || 8) * 1000)); });
    const pr = a.play(); if (pr && pr.catch) pr.catch(() => { $('t-guide-text').textContent = gui('muted') + ' — ' + st.text; });
    if (!reduced) setRotating(true);                                        // a slow turn while she speaks; a drag stops it, the narration goes on
  }
  function guideStart() { if (!guideSteps().length) return; if (coachMusicStop) coachMusicStop(true); guide.on = true; if (measure.on) setMeasure(false); document.documentElement.classList.add('t-guide-on'); guideGo(0); }
  function guideStop() {
    guide.token++; guide.on = false; if (guide.audio) { guide.audio.pause(); guide.audio = null; } const vid = $('t-guide-video'); if (vid) { vid.pause(); vid.hidden = true; vid.removeAttribute('src'); }
    document.documentElement.classList.remove('t-guide-on'); document.documentElement.classList.remove('t-guide-speaking');
    if (state.rotating) setRotating(false); guideRender();
  }
  if (guideSteps().length && $('t-guide')) {
    $('t-guide').hidden = false; $('t-guide').title = gui('title');
    $('t-guide').addEventListener('click', () => (guide.on ? guideStop() : guideStart()));
    $('t-guide-stop').addEventListener('click', guideStop);
    $('t-guide-next').addEventListener('click', () => { if (guide.on) guideGo(guide.i + 1); });
    // a room chosen by hand while the guide runs: the narration of THAT room, from its start
    viewer.on('scenechange', (id) => { if (!guide.on) return; const r = roomOf(id); const k = guideSteps().findIndex((s) => s.scene === r); if (k >= 0 && k !== guide.i) guideGo(k); });
  }
  state.hooks_guide = { start: guideStart, stop: guideStop, go: guideGo, get i() { return guide.i; }, get on() { return guide.on; } };   // for the QA
  /* ── The button walkthrough and the button tooltips (one text table, COACH_UI).
     2026-11-08 (Eliran: «שכל הדמייה תפתח בסיור וירטואלי על הכפתורים…», then «כמו הדמיה רצה… ושיהיה אופציה של דלג», then «רץ מהר. אני רוצה
     UI הסבר על כל כפתור שברגע שמתחיל הסבר הכפתור מודגש, שהמעבר בין כפתור לכפתור יהיה עם סדר כרונולוגי יותר טוב… ובעמידה יפתח לי גם ריבוע
     קטן של הסבר»):
     · the walkthrough plays by itself on the FIRST visit only (Eliran's pick with direction C, 2026-11-08; it was every open before),
       after the first panorama paints and never over the intro video, the 3D or a panel (?coach=0: never by itself — QA, embeds;
       ?coach=1: even when seen); one control at a time: the spotlight GLIDES to it (0.3 s, transform only), the control is lit (a bright
       ring that pulses twice, a 1.08 scale-up, the rest dimmed to ~70%), a card with an arrow at it, a counter and a progress bar; each
       step runs 6.5 s; «דלג» always ends it; «הבא/הקודם» or any manual click stops the autoplay; a hover or a touch on the card pauses
       it; reduced motion: no glide, pulse, scale or auto-advance (manual only), it still opens; the (?) button replays it;
     · the order is the reading order of an RTL screen, never zig-zagging: the top bar right to left, the left rail top to bottom, the
       scene (a door marker, then a furniture ring), the bottom (the arrows, then the strip); absent controls are skipped;
     · every control also explains itself in a small dark tooltip with the SAME sentence: after a 400 ms hover, at once on keyboard
       focus, after a 500 ms long-press on touch (that press does not click); never off-screen, never over the control.
     Every sentence was read off the control's own handler. ── */
  const COACH_UI = {
    help: { he: 'הסבר על הכפתורים: מפעיל שוב את ההדגמה הזאת.', en: 'How the buttons work: plays this walkthrough again.', fr: 'Mode d’emploi : relance cette présentation.' },
    helpLabel: { he: 'הסבר על הכפתורים', en: 'How the buttons work', fr: 'Mode d’emploi des boutons' },
    next: { he: 'הבא', en: 'Next', fr: 'Suivant' }, prev: { he: 'הקודם', en: 'Back', fr: 'Précédent' },
    skip: { he: 'דלג', en: 'Skip', fr: 'Passer' }, done: { he: 'סיום', en: 'Done', fr: 'Terminer' },
    map3d: { he: 'תלת-ממד: הדירה כולה במודל תלת-ממדי, ומשם נכנסים לכל חדר.', en: '3D: the whole apartment as a 3D model; step into any room from there.', fr: 'Vue 3D : tout l’appartement en 3D ; entrez dans n’importe quelle pièce.' },
    plan: { he: 'תוכנית: תוכנית הדירה, ומעבר מהיר לכל חדר.', en: 'Plan: the apartment’s floor plan, with a quick jump to any room.', fr: 'Plan : le plan de l’appartement, pour aller vite dans chaque pièce.' },
    zoomIn: { he: 'קירוב התמונה.', en: 'Zoom in.', fr: 'Zoom avant.' },
    zoomOut: { he: 'הרחקת התמונה.', en: 'Zoom out.', fr: 'Zoom arrière.' },
    rotate: { he: 'סיבוב איטי של החדר מעצמו; לחיצה נוספת עוצרת.', en: 'Turns the room slowly by itself; tap again to stop.', fr: 'Fait tourner la pièce lentement ; touchez à nouveau pour arrêter.' },
    reset: { he: 'החזרת המבט לנקודת הפתיחה של החדר.', en: 'Brings the view back to the room’s starting direction.', fr: 'Ramène la vue vers le point de départ de la pièce.' },
    full: { he: 'מסך מלא; לחיצה נוספת או Esc יוצאות.', en: 'Full screen; tap again or press Esc to leave.', fr: 'Plein écran ; touchez à nouveau ou Échap pour sortir.' },
    ruler: { he: 'מדידה: שתי לחיצות על התמונה מראות את המרחק ביניהן לפי תוכנית הדירה.', en: 'Measure: two taps on the picture show the distance between them, from the plan.', fr: 'Mesure : deux touches sur l’image donnent la distance, d’après le plan.' },
    guide: { he: 'סיור מודרך: מעבר בין החדרים עם הסבר קולי.', en: 'Guided tour: room by room, with a spoken explanation.', fr: 'Visite guidée : pièce par pièce, avec une explication parlée.' },
    design: { he: 'שינוי עיצוב: מעוצב או מקור ובחירת ריצוף.', en: 'Change design: designed or original, and the floor finish.', fr: 'Modifier le design : décoré ou d’origine, et le sol.' },
    designType: { he: 'שינוי עיצוב: מעוצב או מקור, בחירת ריצוף ותיאור שינוי בחדר במילים.', en: 'Change design: designed or original, the floor finish, and a change described in words.', fr: 'Modifier le design : décoré ou d’origine, le sol, et un changement décrit en mots.' },
    lang: { he: 'החלפת שפה: עברית, English, Français.', en: 'Language: עברית, English, Français.', fr: 'Langue : עברית, English, Français.' },
    back: { he: 'חזרה לבניין: יציאה מהדירה אל מבט הבניין.', en: 'Back to the building: leave the apartment for the building view.', fr: 'Retour à l’immeuble : quitter l’appartement pour la vue de l’immeuble.' },
    hotspot: { he: 'מעבר לחדר: הקשה על חץ ברצפה עם שם חדר עוברת לחדר הזה.', en: 'To another room: tap an arrow on the floor with a room’s name to go there.', fr: 'Vers une autre pièce : touchez une flèche au sol avec le nom d’une pièce pour y aller.' },
    ring: { he: 'עיגול על רהיט: לחיצה מציעה רהיטים חלופיים ומחליפה אותו בתמונה.', en: 'A ring on a piece of furniture: tap it to pick another piece and swap it in.', fr: 'Un cercle sur un meuble : touchez pour choisir un autre meuble et le remplacer.' },
    hotspotKeys: { he: 'מעבר לחדר: לחיצה על חץ ברצפה עם שם חדר עוברת לחדר הזה. אפשר גם ללכת עם חיצי המקלדת: ↑ צעד קדימה, ← → סיבוב, ↓ צעד אחורה.', en: 'To another room: click an arrow on the floor with a room’s name to go there. You can also walk with the arrow keys: ↑ a step forward, ← → turn, ↓ a step back.', fr: 'Vers une autre pièce : cliquez sur une flèche au sol avec le nom d’une pièce pour y aller. On peut aussi marcher avec les flèches du clavier : ↑ avancer, ← → tourner, ↓ reculer.' },
    arrows: { he: 'חיצים: מעבר לחדר הבא או הקודם.', en: 'Arrows: the next or the previous room.', fr: 'Flèches : la pièce suivante ou précédente.' },
    strip: { he: 'רצועת החדרים: מעבר ישר לכל חדר.', en: 'The room strip: straight to any room.', fr: 'La bande des pièces : directement vers chaque pièce.' },
    // direction C (2026-11-08): the room pill, the view switch and the phone's «תצוגה» button
    start: { he: '▶ התחילו את ההסבר', en: '▶ Start the walkthrough', fr: '▶ Lancer la présentation' },
    pill: { he: 'החדר שבו אתם נמצאים: החיצים עוברים לחדר הבא או הקודם, ולחיצה על השם פותחת או מקפלת את רצועת החדרים.', en: 'The room you are in: the arrows go to the next or previous room; tap the name to open or fold the room strip.', fr: 'La pièce où vous êtes : les flèches vont à la suivante ou à la précédente ; touchez le nom pour ouvrir ou replier la bande des pièces.' },
    rooms: { he: 'פותח או מקפל את רצועת החדרים.', en: 'Opens or folds the room strip.', fr: 'Ouvre ou replie la bande des pièces.' },
    mode360: { he: '360°: החדר עצמו, כפי שאתם רואים אותו עכשיו.', en: '360°: the room itself, as you see it now.', fr: '360° : la pièce elle-même, telle que vous la voyez.' },
    music: { he: 'מוזיקה', en: 'Music', fr: 'Musique' },
    musicOn: { he: 'הפעלת מוזיקת רקע', en: 'Turn the background music on', fr: 'Activer la musique de fond' },
    musicOff: { he: 'השתקת מוזיקת הרקע', en: 'Mute the background music', fr: 'Couper la musique de fond' },
    lookDesigned: { he: 'מעוצב: הדירה בהדמיה המעוצבת — ריהוט, גימורים ותאורה, להמחשה.', en: 'Designed: the apartment as the designed visualization — furniture, finishes and light, for illustration.', fr: 'Décoré : l’appartement dans la visualisation décorée — mobilier, finitions et lumière, à titre d’illustration.' },
    lookOriginal: { he: 'מקור: מודל הדירה מהתוכנית, בלי עיצוב — המידות לפי תוכנית המכר.', en: 'Original: the apartment’s model from the plan, undesigned — dimensions per the sales plan.', fr: 'Origine : le modèle de l’appartement d’après le plan, sans décoration — cotes selon le plan de vente.' },
    floor_parquet: { he: 'פרקט: רצפת עץ בכל הדירה.', en: 'Parquet: a wood floor throughout the apartment.', fr: 'Parquet : un sol en bois dans tout l’appartement.' },
    floor_concrete: { he: 'בטון: רצפת בטון מוחלק בכל הדירה.', en: 'Concrete: a smooth concrete floor throughout the apartment.', fr: 'Béton : un sol en béton lissé dans tout l’appartement.' },
    floor_marble: { he: 'שיש: רצפת שיש בכל הדירה.', en: 'Marble: a marble floor throughout the apartment.', fr: 'Marbre : un sol en marbre dans tout l’appartement.' },
    lookGroup: { he: 'שינוי תצוגה: מעוצב או מקור.', en: 'Change the view: designed or original.', fr: 'Changer la vue : décoré ou d’origine.' },
    floorGroup: { he: 'שינוי ריצוף: {list}.', en: 'Change the floor: {list}.', fr: 'Changer le sol : {list}.' },
    typeGroup: { he: 'שינוי בהקלדה: כותבים מה לשנות בחדר ולוחצים «החלה».', en: 'Describe a change: type what to change in the room and press «Apply».', fr: 'Décrire un changement : écrivez ce qu’il faut changer et touchez «Appliquer».' },
    floorAny: { he: 'ריצוף: בוחרים את גימור הרצפה בכל הדירה.', en: 'Floor: choose the floor finish for the whole apartment.', fr: 'Sol : choisissez la finition du sol pour tout l’appartement.' },
    typeBar: { he: 'שינוי בהקלדה: כותבים מה לשנות בחדר, למשל ספה אפורה, והשינוי מוצג על התמונה.', en: 'Describe a change: type what to change in the room — a grey sofa, say — and it appears on the picture.', fr: 'Décrire un changement : écrivez ce qu’il faut changer — un canapé gris, par exemple — et il apparaît sur l’image.' },
    modes: { he: 'סגנונות צפייה: בוחרים איך לראות את הדירה — 360°, תוכנית או תלת-ממד.', en: 'View modes: choose how to see the apartment — 360°, the plan or 3D.', fr: 'Modes d’affichage : choisissez comment voir l’appartement — 360°, le plan ou la 3D.' },
    tools: { he: 'כלי עזר: מדידה בין שתי נקודות, וסיור קולי מודרך בין החדרים.', en: 'Tools: measure between two points, and the guided audio tour.', fr: 'Outils : mesurer entre deux points, et la visite audio guidée.' },
  };
  const floorList = () => { const n = floors.map((f) => pick(f.name)); const or = { he: ' או ', en: ' or ', fr: ' ou ' }[lang] || ' או '; return n.length > 1 ? n.slice(0, -1).join(', ') + or + n[n.length - 1] : (n[0] || ''); };
  const cui = (k) => (k === 'floorGroup' ? pick(COACH_UI.floorGroup).replace('{list}', floorList()) : pick(COACH_UI[k]));
  // 2026-11-08 (Eliran: «…שמותאמת לקצב מעבר ההסבר על הכפתורים», then «אפשר לקצר את זמן ההשהייה»): one step = 2 bars of 4/4 at 108 BPM =
  // 4444 ms (glide 300 + 4144; was 3 bars = 6667 ms, before that 6500 + 300), so the music changes bar exactly where the highlight moves.
  // research.md #12: UI motion ≤ 300 ms.
  const COACH_STEP_MS = 4144, COACH_GLIDE_MS = reduced ? 0 : 300;
  // the ONE text source for a control: its key in COACH_UI (the walkthrough and the tooltips both ask here)
  function tipKey(el) {
    if (!el || !el.closest) return null;
    const id = (el.closest('[id]') || {}).id || '';
    if (el.closest('#t-design-btn')) return !$('t-change-bar').hidden ? 'designType' : 'design';
    if (el.closest('#t-help, #t-help-rail')) return 'help';
    if (el.closest('#t-guide')) return 'guide';
    if (el.closest('#t-ruler')) return 'ruler';
    if (el.closest('#t-return')) return 'back';
    if (el.closest('#t-lang')) return 'lang';
    if (el.id === 't-floor-seg') return 'floorGroup';   // (it carries .t-look-seg too: checked first)
    if (el.matches && el.matches('#t-design-look .t-look-seg')) return 'lookGroup';
    if (el.id === 't-change-bar') return 'typeGroup';
    if (el.closest('#t-design button[data-look]')) return el.closest('button').dataset.look === 'original' ? 'lookOriginal' : 'lookDesigned';
    if (el.closest('#t-floor-seg button')) { const f = floors[[...$('t-floor-seg').querySelectorAll('button')].indexOf(el.closest('button'))]; return f && COACH_UI['floor_' + f.id] ? 'floor_' + f.id : 'floorAny'; }
    if (el.closest('#t-change-bar')) return 'typeBar';
    if (el.closest('#t-plan-btn')) return dhOn ? 'map3d' : 'plan';
    if (el.closest('#t-map-btn')) return 'plan';
    if (el.closest('#t-view-360')) return 'mode360';
    if (el.closest('#t-view-btn')) return 'modes';
    if (el.closest('#t-tools-btn')) return 'tools';
    if (el.closest('#t-rooms-btn')) return 'rooms';
    if (el.id === 't-travel') return 'pill';
    if (el.closest('#t-zoom-in')) return 'zoomIn';
    if (el.closest('#t-zoom-out')) return 'zoomOut';
    if (el.closest('#t-rotate')) return 'rotate';
    if (el.closest('#t-reset')) return 'reset';
    if (el.closest('#t-full')) return 'full';
    if (el.closest('#t-prev, #t-next')) return 'arrows';
    if (el.closest('#t-strip')) return 'strip';
    if (el.closest('.t-pano .t-hs')) return fine ? 'hotspotKeys' : 'hotspot';   // a mouse screen has no joystick: the keys are told with the door marker
    if (el.closest('.t-pano .t-mk')) return 'ring';
    return null;
  }
  const TIP_TARGETS = '#t-design button[data-look], #t-floor-seg button, #t-change-bar, #t-view-btn, #t-tools-btn, #t-view-360, #t-map-btn, #t-rooms-btn, #t-design-btn, #t-help, #t-help-rail, #t-guide, #t-ruler, #t-return, #t-lang button, #t-plan-btn, #t-zoom-in, #t-zoom-out, #t-rotate, #t-reset, #t-full, #t-prev, #t-next, #t-strip [role="listitem"], #t-strip button, .t-pano .t-hs, .t-pano .t-mk';
  // a control is "on screen" when it is laid out, not inside a hidden ancestor, visible and inside the viewport
  const onScreen = (el, margin = 0) => {
    if (!el || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    return r.right > margin && r.left < innerWidth - margin && r.bottom > margin && r.top < innerHeight - margin;
  };
  const firstOnScreen = (sel) => [...document.querySelectorAll(sel)].find((e) => onScreen(e, 40) && !e.classList.contains('is-under-hud')) || null;
  // the steps in the reading order of the RTL screen (direction C, 2026-11-08), never zig-zagging; each lights ONE control (the room pill
  // and the strip are one control each). Desktop: the tool bar right to left (its DOM order in the RTL row: the actions capsule, help,
  // the way back, the language), the camera capsule top to bottom, the scene (a door, then a furniture ring), the bottom right to left
  // (the strip, the room pill, then the view switch at the bottom inline-end). Phone: the top bar (the way back, the language), the
  // camera capsule, the scene, the room pill and the strip, then the action bar right to left. Absent controls are skipped.
  const coachScene = () => [
    { els: () => [firstOnScreen('.t-pano .t-hs')] },
    { els: () => ($('pano').classList.contains('has-markers') ? [firstOnScreen('.t-pano .t-mk')] : []) },
  ];
  const coachRail = () => ['t-zoom-in', 't-zoom-out', 't-rotate', 't-reset', 't-full', 't-help-rail'].map((id) => ({ els: () => [$(id)] }));
  // the two menus' openers and their items (the walkthrough opens the menu for its items, closes it after): «סגנונות צפייה» → תוכנית,
  // תלת-ממד; «כלי עזר» → מדידה, סיור קולי (360° is the view on screen: the opener's sentence names it)
  const coachMenus = () => [
    { els: () => [$('t-view-btn')] }, { els: () => [$('t-map-btn')], menu: 'view' }, { els: () => [$('t-plan-btn')], menu: 'view' },
    { els: () => [$('t-tools-btn')] }, { els: () => [$('t-ruler')], menu: 'tools' }, { els: () => [$('t-guide')], menu: 'tools' },
  ];
  // «שינוי עיצוב» and its panel (Eliran 2026-11-08: «ההסבר על הכפתורים צריך להסביר גם על כל דבר בתוך כפתור ה"שינוי עיצוב"»): the walkthrough
  // opens the panel (desktop) / the sheet (phone) for its controls and closes it after; a section the room does not offer is skipped
  const coachDesign = () => [
    { els: () => [$('t-design-btn')] },
    { els: () => [document.querySelector('#t-design-look .t-look-seg')], panel: 'design' },     // «שינוי תצוגה (מעוצב או מקור)»
    { els: () => [$('t-floor-seg')], panel: 'design' },                                   // «שינוי ריצוף (פרקט, בטון או שיש)»
    { els: () => [$('t-change-bar')], panel: 'design' },                                  // «שינוי בהקלדה» — whenever the field shows
  ];
  const coachSteps = () => (phoneMq.matches ? [
    { els: () => [$('t-help')] }, { els: () => [$('t-return')] }, { els: () => [$('t-lang')] },
    ...coachRail(), ...coachScene(),
    { els: () => [$('t-travel')] }, { els: () => [$('t-strip')] },
    ...coachMenus(), ...coachDesign(),
  ] : [
    ...coachMenus(), ...coachDesign(), { els: () => [$('t-help')] },
    { els: () => [$('t-return')] }, { els: () => [$('t-lang')] },
    ...coachRail(), ...coachScene(),
    { els: () => [$('t-strip')] }, { els: () => [$('t-travel')] },
  ]);
  const coach = { open: false, card_focus: false, steps: [], i: 0, back: null, playing: false, paused: false, left: 0, at: 0, t: 0, log: [], lit: [] };
  // the autoplay clock: one timer for the step on screen (the glide + the step); a pause keeps what is left, the bar pauses with it
  function coachTimerStop() { if (coach.t) { clearTimeout(coach.t); coach.t = 0; } musicAccentCancel(); }   // a step change that will not come takes its accent with it
  function coachTimerRun() { coachTimerStop(); if (!coach.open || !coach.playing || coach.paused || document.hidden) return; coach.left = musicSnapStep(coach.left); coach.at = Date.now(); coach.t = window.setTimeout(() => { coach.t = 0; coach.left = 0; musicAccentCommit(); coachGo(coach.i + 1, true); }, coach.left); $('t-coach-fill').style.animationPlayState = 'running'; }
  function coachPause() { if (!coach.playing || coach.paused) return; coach.paused = true; if (coach.t) { coach.left = Math.max(0, coach.left - (Date.now() - coach.at)); coachTimerStop(); } $('t-coach-fill').style.animationPlayState = 'paused'; }
  function coachResume() { if (!coach.playing || !coach.paused) return; coach.paused = false; coachTimerRun(); }
  function coachManual() { coach.playing = false; coachTimerStop(); $('t-coach-bar').hidden = true; }   // a hand on «הבא/הקודם»: the demo stops, the walkthrough stays
  function coachBarRestart() { const f = $('t-coach-fill'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; f.style.animationDuration = `${COACH_STEP_MS}ms`; f.style.animationDelay = `${COACH_GLIDE_MS}ms`; f.style.animationPlayState = coach.paused || document.hidden ? 'paused' : 'running'; }
  const inPanelOk = (e) => Boolean(e) && !e.hidden && !e.closest('.t-design-sec[hidden]') && (e.id !== 't-change-bar' || !$('t-change-bar').hidden)
    && (e.id !== 't-floor-seg' || e.querySelectorAll('button:not([hidden])').length > 1);
  const coachAvail = (s) => s.els().filter((e) => (s.menu ? e && !e.hidden && onScreen($(MENUS[s.menu][0])) : s.panel ? inPanelOk(e) && onScreen(designBtn) : onScreen(e)));
  const coachLive = () => coachSteps().map((s) => ({ s, menu: s.menu || null, panel: s.panel || null, els: coachAvail(s) })).filter((x) => x.els.length);
  // the lit control's box (union of a pair), grown by the 1.08 scale-up a single small control gets
  function coachRect(els, scaled) {
    const rs = els.map((e) => e.getBoundingClientRect());
    let l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top)), r = Math.max(...rs.map((x) => x.right)), b = Math.max(...rs.map((x) => x.bottom));
    if (scaled) { const cx = (l + r) / 2, cy = (t + b) / 2, hw = (r - l) * 0.54, hh = (b - t) * 0.54; l = cx - hw; r = cx + hw; t = cy - hh; b = cy + hh; }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }
  const canScale = (els) => els.length === 1 && !els[0].closest('.t-pano') && els[0].getBoundingClientRect().width < 240;
  function coachLight(els) {
    for (const e of coach.lit) e.classList.remove('t-coach-lit');
    coach.lit = canScale(els) && !reduced ? els : [];
    for (const e of coach.lit) e.classList.add('t-coach-lit');
  }
  function coachPlace() {
    if (!coach.open) return;
    const step = coach.steps[coach.i]; const els = step.els.filter((e) => onScreen(e));
    if (!els.length) { coachGo(coach.i + 1, true); return; }   // the control left the screen (the view moved): the next one
    const r = coachRect(els, canScale(els) && !reduced), pad = 7, gap = 16, M = 12, vw = innerWidth, vh = innerHeight;
    const spot = $('t-coach-spot');
    // transform only (research.md #12): the box takes its size at once and glides to its place in 300 ms
    Object.assign(spot.style, { width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px`, transform: `translate(${Math.round(r.left - pad)}px, ${Math.round(r.top - pad)}px)` });
    spot.classList.remove('is-pulse'); void spot.offsetWidth; if (!reduced) spot.classList.add('is-pulse');
    const card = $('t-coach-card'); const phone = vw <= 640;
    card.style.width = phone ? `${vw - 2 * M}px` : '360px';
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const below = vh - (r.bottom + pad) - gap - M, above = (r.top - pad) - gap - M;
    let top, left, side;
    if (below >= ch) { top = r.bottom + pad + gap; side = 'top'; }
    else if (above >= ch) { top = r.top - pad - gap - ch; side = 'bottom'; }
    else { top = below >= above ? Math.max(M, vh - M - ch) : M; side = below >= above ? 'top' : 'bottom'; }   // never over the control: the larger free side
    left = phone ? M : Math.min(Math.max(M, (r.left + r.right) / 2 - cw / 2), vw - cw - M);
    if (!phone && below < ch && above < ch) {   // a tall control on a desktop: beside it
      const rightSide = vw - r.right - pad - gap - M, leftSide = r.left - pad - gap - M;
      if (rightSide >= cw || leftSide >= cw) { const toRight = rightSide >= cw; left = toRight ? r.right + pad + gap : r.left - pad - gap - cw; top = Math.min(Math.max(M, (r.top + r.bottom) / 2 - ch / 2), vh - ch - M); side = toRight ? 'left' : 'right'; }
    }
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    // the arrow at the control: on the card's edge facing it, aimed at the control's centre (clamped inside the card's corners)
    card.dataset.arrow = side;
    const ax = Math.min(Math.max(22, (r.left + r.right) / 2 - left), cw - 22), ay = Math.min(Math.max(22, (r.top + r.bottom) / 2 - top), ch - 22);
    card.style.setProperty('--ax', `${ax}px`); card.style.setProperty('--ay', `${ay}px`);
  }
  function coachRender() {
    renderMusicBtn();
    menuOpen(coach.steps[coach.i] && coach.steps[coach.i].menu ? coach.steps[coach.i].menu : null);   // the step's menu open, or none
    designShow(Boolean(coach.steps[coach.i] && coach.steps[coach.i].panel === 'design'));            // the design panel for its controls
    const n = coach.steps.length, step = coach.steps[coach.i];
    $('t-coach-count').textContent = `${coach.i + 1}/${n}`;
    $('t-coach-text').textContent = cui(tipKey(step.els[0]));
    $('t-coach-prev').textContent = cui('prev'); $('t-coach-prev').hidden = coach.i === 0;
    $('t-coach-next').textContent = cui(coach.i === n - 1 ? 'done' : 'next');
    $('t-coach-skip').textContent = cui('skip'); $('t-coach-skip').hidden = false;   // «דלג» is always there
    $('t-coach-bar').hidden = !coach.playing;
    $('t-coach-card').classList.toggle('is-gate', Boolean(coach.gate));
    if (coach.gate) $('t-coach-next').textContent = cui('start');
    coachLight(step.els.filter((e) => onScreen(e)));
    coachPlace();
  }
  function coachGo(i, auto = false) {
    coach.stepAt = performance.now();
    if (!auto && i !== coach.i && i >= 0) musicAccentNow();
    if (i < 0) return;
    if (i >= coach.steps.length) { coachClose(); return; }
    coach.i = i; coach.log.push(i); coachRender();
    if (coach.playing) { coach.left = COACH_GLIDE_MS + COACH_STEP_MS; coachBarRestart(); coachTimerRun(); }
    if (!auto || coach.card_focus) $('t-coach-next').focus({ preventScroll: true });
  }
  // every load (Eliran 2026-11-08, second ruling: «כל פעם שאכנס ללינק מחדש יתחיל לי ההסבר על הכפתורים»): no seen-key any more; «דלג» closes
  // it for this visit, (?) replays it, ?coach=0 keeps it off (QA, embeds)
  function coachOpen(auto = false) {
    coach.steps = coachLive();
    if (!coach.steps.length) return;
    const glide = [$('t-coach-spot'), $('t-coach-card')];
    for (const g of glide) g.classList.add('no-glide');   // the first step appears in place; the glide is from control to control
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => { for (const g of glide) g.classList.remove('no-glide'); }));
    tipHide();
    if (!design.hidden) closeDesign(false);
    if (state.rotating) setRotating(false);   // the view stays put under the spotlight
    if (chromeOff) setChrome(false);
    coach.back = document.activeElement; coach.open = true; coach.i = 0; coach.log = [0]; coach.stepAt = performance.now();
    // phones arriving with no gesture yet (a direct link, the apartment page) and no running parent audio: the first card is a start card
    { const H = hostAudio(); coach.gate = auto && immersiveMq.matches && !(H && H.ac.state === 'running') && !musicRunning(); }
    coach.playing = !reduced && !coach.gate; coach.paused = false; coach.left = COACH_GLIDE_MS + COACH_STEP_MS;
    if (!coach.gate && musicMayStart()) window.setTimeout(musicStart, 0);   // after the first render: the step's start is known
    $('t-coach').hidden = false; document.documentElement.classList.add('t-coach-on');
    coachRender(); $('t-coach-next').focus({ preventScroll: true });
    if (coach.playing) { coachBarRestart(); coachTimerRun(); }
  }
  function coachClose() {
    if (!coach.open) return;
    coach.open = false; coach.gate = false; coachTimerStop(); coach.playing = false; coachLight([]); musicStop(); menuOpen(null); designShow(false);
    $('t-coach').hidden = true; document.documentElement.classList.remove('t-coach-on');
    const helpBtn = [$('t-help'), $('t-help-rail')].find((b) => b && b.getBoundingClientRect().width > 0);
    const back = coach.back && document.contains(coach.back) && !coach.back.closest('[hidden]') && coach.back.getBoundingClientRect().width > 0 ? coach.back : helpBtn;
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  function renderCoachLabels() { for (const h of [$('t-help'), $('t-help-rail')]) if (h) { h.setAttribute('aria-label', cui('helpLabel')); h.removeAttribute('title'); } if (coach.open) coachRender(); if (coachReady) tapHintText(false); }
  function coachUngate() {   // the start card's tap: the autoplay starts here, with the music (the window listener already unlocked it)
    coach.gate = false; musicUnlock(); musicStart();
    coach.playing = !reduced; coach.paused = false; coach.left = COACH_GLIDE_MS + COACH_STEP_MS; coach.stepAt = performance.now();
    coachRender(); if (coach.playing) { coachBarRestart(); coachTimerRun(); }
  }
  $('t-coach-next').addEventListener('click', () => { if (coach.gate) { coachUngate(); return; } coachManual(); coachGo(coach.i + 1); });
  $('t-coach-prev').addEventListener('click', () => { coachManual(); coachGo(coach.i - 1); });
  // a hover or a touch on the card holds the demo (it runs on when the pointer leaves / the finger lifts)
  $('t-coach-card').addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') coachPause(); });
  $('t-coach-card').addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') coachResume(); });
  $('t-coach-card').addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') coachPause(); });
  $('t-coach-card').addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') window.setTimeout(coachResume, 1200); });
  $('t-coach-card').addEventListener('focusin', () => { coach.card_focus = true; });
  document.addEventListener('visibilitychange', () => { if (!coach.open || !coach.playing) return; if (document.hidden) coachPause(); else coachResume(); });
  $('t-coach-skip').addEventListener('click', coachClose);
  $('t-coach-block').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });   // the tour behind waits; «דלג» leaves
  $('t-coach').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); coachClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...$('t-coach-card').querySelectorAll('button')].filter((b) => !b.hidden);
    const k = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(k + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => coachPlace());
  for (const h of [$('t-help'), $('t-help-rail')]) { h.hidden = false; h.addEventListener('click', () => { if (coach.open) { coachClose(); return; } coachOpen(); musicUnlock(); musicStart(); }); }

  /* the tooltips: ONE component (#t-tip), the same sentences. Desktop: after 400 ms over a control; keyboard: at once on focus; touch:
     a 500 ms long-press shows it and that press does not click. Placed above the control (below when there is no room), clamped inside
     the screen, never over the control; hidden while the walkthrough runs. The controls' native title boxes are retired (the aria-label
     stays their accessible name). */
  const tip = { el: null, t: 0, lp: 0, lpTarget: null, swallow: false, x: 0, y: 0 };
  function tipHide() { if (tip.t) { clearTimeout(tip.t); tip.t = 0; } if (tip.el) { tip.el.removeAttribute('aria-describedby'); tip.el = null; } $('t-tip').hidden = true; }
  function tipShow(el) {
    if (coach.open || !el || !onScreen(el)) return;
    const k = tipKey(el); if (!k) return;
    const box = $('t-tip'); $('t-tip-text').textContent = cui(k);
    if (el.hasAttribute('title')) { el.dataset.title = el.getAttribute('title'); el.removeAttribute('title'); }
    box.hidden = false; box.style.left = '0px'; box.style.top = '0px';
    const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, M = 8, gap = 8;
    let top = r.top - gap - h, side = 'bottom';
    if (top < M) { top = r.bottom + gap; side = 'top'; }
    if (top + h > innerHeight - M) { top = Math.max(M, r.top - gap - h); side = 'bottom'; }
    const left = Math.min(Math.max(M, (r.left + r.right) / 2 - w / 2), innerWidth - w - M);
    Object.assign(box.style, { left: `${left}px`, top: `${top}px` });
    box.dataset.arrow = side; box.style.setProperty('--ax', `${Math.min(Math.max(12, (r.left + r.right) / 2 - left), w - 12)}px`);
    tip.el = el; el.setAttribute('aria-describedby', 't-tip');
  }
  const tipTarget = (n) => (n && n.closest ? n.closest(TIP_TARGETS) : null);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = tipTarget(e.target); if (!el || el === tip.el) return;
    tipHide(); tip.t = window.setTimeout(() => { tip.t = 0; tipShow(el); }, 400);
  });
  document.addEventListener('pointerout', (e) => { if (e.pointerType !== 'mouse') return; const el = tipTarget(e.target); if (el && !el.contains(e.relatedTarget)) tipHide(); });
  document.addEventListener('focusin', (e) => { const el = tipTarget(e.target); if (el && el.matches(':focus-visible')) { tipHide(); tipShow(el); } });
  document.addEventListener('focusout', (e) => { if (tipTarget(e.target) === tip.el) tipHide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tip.el) tipHide(); });
  // touch: a long-press explains, a tap clicks
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { tipHide(); return; }
    tipHide(); const el = tipTarget(e.target); if (!el || coach.open) return;
    tip.lpTarget = el; tip.x = e.clientX; tip.y = e.clientY;
    tip.lp = window.setTimeout(() => { tip.lp = 0; tip.swallow = true; tipShow(el); }, 500);
  }, true);
  document.addEventListener('pointermove', (e) => { if (tip.lp && Math.hypot(e.clientX - tip.x, e.clientY - tip.y) > 10) { clearTimeout(tip.lp); tip.lp = 0; } }, true);
  document.addEventListener('pointerup', () => { if (tip.lp) { clearTimeout(tip.lp); tip.lp = 0; } if (tip.swallow) { window.setTimeout(() => { tip.swallow = false; }, 700); window.setTimeout(tipHide, 2600); } }, true);
  document.addEventListener('pointercancel', () => { if (tip.lp) { clearTimeout(tip.lp); tip.lp = 0; } }, true);
  // the click that ends a long-press is not a click (also Pannellum's own pointer path for the door markers and the rings)
  for (const type of ['click', 'mousedown', 'mouseup', 'pointerup']) document.addEventListener(type, (e) => { if (!tip.swallow) return; if (type === 'click') tip.swallow = false; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }, true);
  document.addEventListener('contextmenu', (e) => { if (tipTarget(e.target)) e.preventDefault(); });
  window.addEventListener('scroll', tipHide, true);

  /* ── 2026-11-08 (Eliran: «שבשלב ההסבר על הכפתורים כשנכנסים להדמיה יהיה כמו מוזיקה רקע עם קצב משהו נעים ... שקט לא נותן תחושה נעימה»,
     then «אני רוצה מוזיקת רקע עם קצת יותר קצב שמותאמת לקצב מעבר ההסבר על הכפתורים לא מוזיקה מרדימה»): music under the walkthrough, made
     in the browser with the Web Audio API — no audio file, no third-party track, no licence question. v2: light house / upbeat lounge at
     108 BPM, LOCKED to the walkthrough: one step = 2 bars, the music's bar grid is aligned to the step on screen when it starts, the step
     timer then snaps to that grid (after a pause too), so every step change lands on a bar line and carries a soft accent (a rising
     three-note chime and a shimmer); «הבא» by hand gets its accent on the next beat. A fixed score, deterministic (no Math.random: the
     drums' noise comes from a fixed-seed LCG): a soft kick on 1 and 3, a shaker on the 8ths, a clap on 2 and 4, a bright plucked
     arpeggio, a moving bassline, bright add9 chords (Cadd9 · Gadd9 · Am(add9) · Fadd9, one a bar), a light pad.
     · sound starts only on the visitor's own gesture while the walkthrough is open (a tap or click anywhere, «הבא», «דלג», a key, or the
       (?) button) — the browser's autoplay rule is never worked around; the AudioContext is created on that first gesture only;
     · 1.5 s fade-in, 1.5 s fade-out when the walkthrough ends, is skipped or closes, then the context is suspended; (?) plays it again;
     · a speaker toggle on the card (its word «מוזיקה» shows on the first step), remembered in localStorage: muted stays muted;
     · the voice tour or a video stops it; a hidden tab suspends the context. The same musicBar() renders the preview WAV (musicRender). ── */
  const MUSIC_BPM = 108, MUSIC_VOL = 0.18, MUSIC_FADE = 1.5, MUSIC_KEY = 'habait-tour-music-muted-v1';
  const MUSIC_BEAT = 60 / MUSIC_BPM, MUSIC_BAR = 4 * MUSIC_BEAT, MUSIC_8TH = MUSIC_BEAT / 2;
  const MUSIC_CHORDS = [[48, 52, 55, 62], [43, 47, 50, 57], [45, 48, 52, 59], [41, 45, 48, 55]];   // Cadd9 · Gadd9 · Am(add9) · Fadd9: root, 3rd, 5th, 9th
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const musicNoiseCache = new WeakMap();
  function musicNoise(ac) {   // half a second of white noise from a fixed-seed LCG: the same bytes on every run
    if (musicNoiseCache.has(ac)) return musicNoiseCache.get(ac);
    const len = Math.round(ac.sampleRate * 0.5), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let x = 20261108; for (let i = 0; i < len; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; d[i] = x / 2147483648 - 1; }
    musicNoiseCache.set(ac, buf); return buf;
  }
  // the persistent chain of a context: a gentle compressor (glue and a ceiling), the master volume
  function musicChain(ac, dest) {
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -26; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.2;
    const g = ac.createGain(); g.gain.value = MUSIC_VOL; comp.connect(g); g.connect(dest); return comp;
  }
  // the buses of one run, under that run's fade gain: each family through its own filter
  function musicBuses(ac, run) {
    const bus = (type, f, q) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q || 0.7; n.connect(run); return n; };
    return { pad: bus('lowpass', 2200), arp: bus('lowpass', 5200), bass: bus('lowpass', 700), hat: bus('highpass', 6500), clap: bus('bandpass', 1700, 0.9), kick: bus('lowpass', 900), fx: bus('highpass', 300) };
  }
  // bar n of the endless loop at time t (events before `from` are skipped: a bar joined half-way) — live and offline call the same code
  function musicBar(ac, B, n, t, from = -1) {
    const c = MUSIC_CHORDS[((n % 4) + 4) % 4], nx = MUSIC_CHORDS[(((n + 1) % 4) + 4) % 4], noise = musicNoise(ac);
    const ok = (t0) => t0 >= from;
    const pan = (node, v, out) => { if (v && ac.createStereoPanner) { const sp = ac.createStereoPanner(); sp.pan.value = v; node.connect(sp); sp.connect(out); } else node.connect(out); };
    const tone = (out, type, f, t0, dur, peak, attack, release, detune, pv) => {
      if (!ok(t0)) return;
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; o.detune.value = detune || 0;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + attack);
      if (release) { g.gain.setValueAtTime(peak, Math.max(t0 + attack, t0 + dur - release)); g.gain.linearRampToValueAtTime(0, t0 + dur); }
      else g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); pan(g, pv, out); o.start(t0); o.stop(t0 + dur + 0.05);
    };
    const hit = (out, t0, dur, peak, off, pv) => {
      if (!ok(t0)) return;
      const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = noise;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(g); pan(g, pv, out); src.start(t0, off % 0.4); src.stop(t0 + dur + 0.02);
    };
    // the kick: 1 and 3 — a sine falling 120 → 48 Hz, soft
    for (const k of [0, 2]) { const t0 = t + k * MUSIC_BEAT; if (!ok(t0)) continue; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + 0.12); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34); o.connect(g); g.connect(B.kick); o.start(t0); o.stop(t0 + 0.36); }
    // the shaker: every 8th, the off-beats a little louder
    for (let e = 0; e < 8; e++) hit(B.hat, t + e * MUSIC_8TH, e % 2 ? 0.07 : 0.045, e % 2 ? 0.16 : 0.1, 0.05 * ((n * 8 + e) % 7), 0.25);
    // the clap: 2 and 4 — three quick bursts and a short tail
    for (const k of [1, 3]) { const t0 = t + k * MUSIC_BEAT; for (const [dt, d, pk] of [[0, 0.02, 0.22], [0.011, 0.02, 0.2], [0.022, 0.14, 0.26]]) hit(B.clap, t0 + dt, d, pk, 0.11 + 0.03 * k + dt, 0); }
    // the bassline: off-beat house bass on root / octave / fifth, a step toward the next chord at the bar's end
    for (const [e, m, len] of [[1, c[0] - 12, 0.3], [3, c[0], 0.22], [4, c[0] - 12, 0.3], [5, c[2] - 12, 0.25], [7, nx[0] - 11 + (nx[0] > c[0] ? -2 : 0), 0.18]])
      { tone(B.bass, 'triangle', midiHz(m), t + e * MUSIC_8TH, len, 0.3, 0.008, 0.06); tone(B.bass, 'sine', midiHz(m - 12), t + e * MUSIC_8TH, len, 0.22, 0.008, 0.06); }
    // the arpeggio: bright plucks on the 8ths over the chord's 9th and 3rd, two octaves up, panned left / right
    const arp = [c[0] + 24, c[2] + 12, c[3] + 12, c[1] + 24, c[0] + 24, c[3] + 12, c[2] + 24, c[1] + 24];
    arp.forEach((m, e) => tone(B.arp, 'triangle', midiHz(m), t + e * MUSIC_8TH, 0.32, e % 4 === 0 ? 0.085 : 0.06, 0.004, 0, 0, e % 2 ? 0.35 : -0.35));
    // the pad: the chord, light, a bar long, two detuned voices a note
    for (const [k, m] of [c[1], c[2], c[3], c[0] + 12].entries()) {
      tone(B.pad, 'sawtooth', midiHz(m + 12), t, MUSIC_BAR + 0.15, 0.022, 0.12, 0.35, -7, k % 2 ? 0.2 : -0.2);
      tone(B.pad, 'triangle', midiHz(m + 12), t, MUSIC_BAR + 0.15, 0.03, 0.12, 0.35, 6, k % 2 ? -0.2 : 0.2);
    }
  }
  // the step-change accent: a rising three-note chime (G5 · C6 · E6) and a short shimmer; returns its nodes (a pending one can be cancelled)
  function musicAccent(ac, B, t) {
    const nodes = [];
    [79, 84, 88].forEach((m, k) => { for (const [mul, pk] of [[1, 0.07], [2, 0.018]]) { const o = ac.createOscillator(), g = ac.createGain(); const t0 = t + k * 0.06; o.type = 'sine'; o.frequency.value = midiHz(m) * mul;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(pk, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1); o.connect(g); g.connect(B.fx); o.start(t0); o.stop(t0 + 1.15); nodes.push(o); } });
    const src = ac.createBufferSource(), g = ac.createGain(), hp = ac.createBiquadFilter(); src.buffer = musicNoise(ac); hp.type = 'highpass'; hp.frequency.setValueAtTime(5000, t); hp.frequency.linearRampToValueAtTime(9000, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); src.connect(hp); hp.connect(g); g.connect(B.fx); src.start(t, 0.2); src.stop(t + 0.62); nodes.push(src);
    return nodes;
  }
  const music = { ac: null, input: null, run: null, buses: null, on: false, waiting: false, origin: 0, k: 0, timer: 0, off: 0, pending: null, accents: 0 };
  const musicMuted = () => { try { return window.localStorage.getItem(MUSIC_KEY) === '1'; } catch (_) { return false; } };
  const musicSetMuted = (on) => { try { if (on) window.localStorage.setItem(MUSIC_KEY, '1'); else window.localStorage.removeItem(MUSIC_KEY); } catch (_) { /* not remembered */ } };
  const musicBarAt = (k) => music.origin + k * MUSIC_BAR;
  function musicTick() {
    if (!music.on || !music.run) return;
    const now = music.ac.currentTime;
    while (musicBarAt(music.k) < now + 1.2) { musicBar(music.ac, music.buses, music.k, musicBarAt(music.k), now + 0.02); music.k++; }
  }
  // the walkthrough's step timer while the music plays: the step ends on the bar line nearest its due time, and that bar line's accent
  // is scheduled now, sample-exact (cancelled if the step change does not come: a pause, a hand on «הבא», a close)
  function musicSnapStep(leftMs) {
    if (!music.on || !music.ac || music.ac.state !== 'running') return leftMs;
    const now = music.ac.currentTime; let target = music.origin + Math.round((now + leftMs / 1000 - music.origin) / MUSIC_BAR) * MUSIC_BAR;
    if (target < now + 0.08) target += MUSIC_BAR;
    musicAccentCancel(); music.pending = musicAccent(music.ac, music.buses, target);
    return Math.max(0, (target - now) * 1000);
  }
  function musicAccentCancel() { if (!music.pending) return; for (const nd of music.pending) { try { nd.stop(0); } catch (_) { /* not started */ } } music.pending = null; }
  function musicAccentCommit() { if (music.pending) music.accents++; music.pending = null; }
  function musicAccentNow() {   // a step changed by hand: its accent on the next beat (less jarring than a jump to the bar)
    if (!music.on || !music.ac) return;
    const now = music.ac.currentTime, t = music.origin + Math.ceil((now + 0.03 - music.origin) / MUSIC_BEAT) * MUSIC_BEAT;
    musicAccent(music.ac, music.buses, t); music.accents++;
  }
  // may sound start now without a tap? Only the browser knows (the autoplay policy is never worked around): where it answers
  // (navigator.getAutoplayPolicy) we follow; where it does not, we ASK by creating the context and calling resume() — it runs if the browser
  // already allows sound here (the same-origin /hold/ parent that embeds the tour with allow="autoplay" had the visitor's click «המשיכו אל
  // הדירה»; an activation carried over a same-origin navigation; Chrome's media engagement), else it stays suspended until the first tap.
  function musicMayStart() {
    try { if (navigator.getAutoplayPolicy) return navigator.getAutoplayPolicy('audiocontext') === 'allowed'; } catch (_) { /* not there */ }
    return true;
  }

  /* ── phones (Eliran 2026-11-08: «במובייל המוזיקה של ההסבר על הכפתורים לא עובדת»). iOS Safari unlocks Web Audio only inside a touchend /
     click handler, synchronously; its ringer switch mutes Web Audio unless the audio session is "playback"; a tap in the /hold/ parent
     does not unlock the tour's frame there. So every gesture while the walkthrough is open runs musicUnlock() synchronously — create /
     resume the context (nothing awaited before resume()), play a one-sample silent buffer, set navigator.audioSession.type = 'playback'
     (Safari 17+), and on iOS start a tiny silent looping <audio> element (the older iOS way to the playback session; paused when the music
     stops). The listeners stay until the context runs, and a context left suspended / "interrupted" (iOS) by the tab or a call is resumed
     on the next gesture. Never around the autoplay rule: all of it happens inside the visitor's own tap. ── */
  // iPhone / iPad Safari in any UA mode: a touch screen AND WebKit (the -webkit-touch-callout property exists only there) — capability, not UA
  const IS_IOS = navigator.maxTouchPoints > 0 && typeof CSS !== 'undefined' && CSS.supports && CSS.supports('-webkit-touch-callout', 'none');
  let silentEl = null;
  const silentWavUrl = () => {   // 0.1 s of 8-bit silence, 8 kHz mono, built here (no file)
    const n = 800, bytes = new Uint8Array(44 + n), v = new DataView(bytes.buffer);
    const w = (o, t) => { for (let i = 0; i < t.length; i++) bytes[o + i] = t.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); bytes.fill(128, 44);
    let bin = ''; for (const x of bytes) bin += String.fromCharCode(x); return 'data:audio/wav;base64,' + btoa(bin);
  };
  // the context: the /hold/ parent's when it runs (it was unlocked inside the visitor's «המשיכו אל הדירה» tap — one source, no tap here),
  // else this frame's own (unlocked by a tap here). A run keeps its context; the two are never used at once.
  const ctxInputs = new WeakMap();
  function hostAudio() { try { if (window.parent === window) return null; const H = window.parent.__habaitAudio; return H && H.ac ? H : null; } catch (_) { return null; } }
  function useCtx(ac, host) {
    if (!ctxInputs.has(ac)) {
      ctxInputs.set(ac, musicChain(ac, ac.destination));
      // the context may only start running later (the browser's own decision, or the visitor's tap): the music begins then
      ac.addEventListener('statechange', () => { if (music.ac === ac && ac.state === 'running' && music.waiting) musicBegin(); renderMusicBtn(); });
    }
    music.ac = ac; music.input = ctxInputs.get(ac); music.host = host; return ac;
  }
  function musicCtx() {
    if (music.on && music.ac) return music.ac;
    const H = hostAudio();
    if (H && H.ac.state === 'running') return useCtx(H.ac, 'parent');
    if (!music.own) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; music.own = new AC(); }
    return useCtx(music.own, 'frame');
  }
  function musicUnlock() {
    if (musicMuted()) return;
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (_) { /* not there */ }
    const ac = musicCtx(); if (!ac) return;
    const iosNeedsEl = IS_IOS && music.host !== 'parent' && (!silentEl || silentEl.paused);
    if (ac.state === 'running' && !iosNeedsEl) return;
    try {
      if (ac.state !== 'running') ac.resume().catch(() => {});   // synchronous, first thing: iOS counts only a resume inside the gesture
      const src = ac.createBufferSource(); src.buffer = ac.createBuffer(1, 1, 22050); src.connect(ac.destination); src.start(0);
    } catch (_) { /* a refused gesture: the next one tries again */ }
    if (iosNeedsEl) { try { if (!silentEl) { silentEl = new Audio(silentWavUrl()); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.preload = 'auto'; } silentEl.play().catch(() => {}); } catch (_) { /* old engine */ } }
  }
  const musicRunning = () => Boolean(music.on && music.ac && music.ac.state === 'running');
  function musicStart() {
    if (music.on || musicMuted() || !coach.open || guide.on || !$('t-video').hidden) return;
    try {
      if (!musicCtx()) return;
      clearTimeout(music.off);
      if (music.ac.state === 'running') { musicBegin(); return; }
      music.waiting = true;
      if (!document.hidden) music.ac.resume().then(() => { if (music.ac.state === 'running' && music.waiting) musicBegin(); }).catch(() => {});
    } catch (_) { music.on = false; }
  }
  function musicBegin() {
    music.waiting = false;
    if (music.on || musicMuted() || !coach.open || guide.on || !$('t-video').hidden) return;
    const now = music.ac.currentTime, run = music.ac.createGain();   // each run fades on its own gain: a quick replay never doubles a bar
    run.gain.setValueAtTime(0, now); run.gain.linearRampToValueAtTime(1, now + MUSIC_FADE); run.connect(music.input);
    // the bar grid starts where the step on screen started: its bar lines are the step changes (2 bars a step)
    const origin = now - Math.max(0, (performance.now() - (coach.stepAt || performance.now())) / 1000);
    Object.assign(music, { run, buses: musicBuses(music.ac, run), on: true, origin, k: Math.floor((now - origin) / MUSIC_BAR) });
    musicTick(); music.timer = window.setInterval(musicTick, 250);
    renderMusicBtn();
    const retime = (min = 0) => { if (!(music.on && coach.playing && !coach.paused && coach.t)) return; const left = Math.max(0, coach.left - (Date.now() - coach.at)); if (left < min) return; coach.left = left; coachTimerRun(); };
    retime(); window.setTimeout(() => retime(400), 800);   // once more when the new context's clock has settled
  }
  function musicStop(fast) {
    if (!music.ac) return;
    musicAccentCancel();
    window.clearInterval(music.timer); music.timer = 0; music.on = false; music.waiting = false; renderMusicBtn();
    const run = music.run; music.run = null; music.buses = null; if (!run) return;
    const now = music.ac.currentTime, d = fast ? 0.25 : MUSIC_FADE;
    run.gain.cancelScheduledValues(now); run.gain.setValueAtTime(run.gain.value, now); run.gain.linearRampToValueAtTime(0, now + d);
    window.clearTimeout(music.off);
    const stopAc = music.ac, stopHost = music.host;
    music.off = window.setTimeout(() => { try { run.disconnect(); } catch (_) { /* gone */ } if (!music.on) { if (silentEl) silentEl.pause(); if (stopHost === 'parent') { const H = hostAudio(); if (H && H.silent) H.silent.pause(); } if (stopAc.state === 'running') stopAc.suspend().catch(() => {}); } }, d * 1000 + 150);
  }
  coachMusicStop = musicStop;
  function renderMusicBtn() {
    if (typeof music === 'undefined') return;
    const b = $('t-coach-music'), on = !musicMuted();
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', cui(on ? 'musicOff' : 'musicOn'));
    $('t-coach-music-text').textContent = cui('music'); b.classList.toggle('is-hint', coach.i === 0);
    b.classList.toggle('is-invite', on && coach.open && !musicRunning());
  }
  // the toggle: while the music waits for its first tap (the pulse invites it), a tap STARTS it — it does not mute; once it plays, a tap mutes
  $('t-coach-music').addEventListener('click', () => {
    if (!musicMuted() && !musicRunning()) { musicUnlock(); musicStart(); renderMusicBtn(); return; }
    const mute = !musicMuted(); musicSetMuted(mute); if (mute) musicStop(true); else { musicUnlock(); musicStart(); } renderMusicBtn();
  });
  // the visitor's gestures while the walkthrough is open start it: touchend / click (iOS), pointerup / pointerdown (Android, desktop), a key;
  // capture phase on window, so a tap on the panorama or on the card's buttons reaches here before anything stops it; kept until it runs
  for (const type of ['touchend', 'click', 'pointerup', 'pointerdown', 'keydown']) window.addEventListener(type, (e) => {
    if (!coach.open || musicMuted() || (e.target && e.target.closest && e.target.closest('#t-coach-music'))) return;   // the toggle unlocks itself
    if (coach.gate && !(e.target && e.target.closest && e.target.closest('#t-coach-next'))) return;   // the phone's start card: its button starts it
    if (music.on && music.host === 'parent' && music.ac.state !== 'running') musicStop(true);         // the parent's context stuck: take this tap
    musicUnlock();
    if (!music.on) musicStart();
  }, true);
  // the tab hidden / the page left: suspend (and the silent element); back: try to resume — iOS may insist on the next tap, which musicUnlock() serves
  const musicAway = () => { if (!music.ac) return; music.ac.suspend().catch(() => {}); if (silentEl) silentEl.pause(); if (music.host === 'parent') { const H = hostAudio(); if (H && H.silent) H.silent.pause(); } };
  document.addEventListener('visibilitychange', () => { if (!music.ac) return; if (document.hidden) musicAway(); else if (music.on) { music.ac.resume().catch(() => {}); renderMusicBtn(); } });
  window.addEventListener('pagehide', musicAway);
  window.setInterval(() => { if (coach.open && !music.on && !musicMuted() && !coach.gate) { const H = hostAudio(); if (H && H.ac.state === 'running') musicStart(); } }, 500);
  // the preview: the same score rendered offline, the walkthrough simulated — a step change every 2 bars (4.444 s) with its accent, as
  // the live music schedules it (QA writes it as a WAV for Eliran to hear before a deploy); 16-bit PCM, base64
  async function musicRender(secs = 27.5, rate = 44100) {
    const ac = new OfflineAudioContext(2, Math.round(secs * rate), rate);
    const run = ac.createGain(); run.connect(musicChain(ac, ac.destination)); const B = musicBuses(ac, run);
    run.gain.setValueAtTime(0, 0); run.gain.linearRampToValueAtTime(1, MUSIC_FADE); run.gain.setValueAtTime(1, secs - MUSIC_FADE); run.gain.linearRampToValueAtTime(0, secs);
    const t0 = 0.1, steps = [];
    for (let n = 0, t = t0; t < secs; n++, t += MUSIC_BAR) { musicBar(ac, B, n, t); if (n > 0 && n % 2 === 0) { musicAccent(ac, B, t); steps.push(+t.toFixed(3)); } }
    const buf = await ac.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), N = L.length;
    const out = new DataView(new ArrayBuffer(44 + N * 4)); let peak = 0;
    const str = (o, t) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + N * 4, true); str(8, 'WAVE'); str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, N * 4, true);
    for (let i = 0; i < N; i++) for (const [k, ch] of [[0, L], [1, R]]) { const v = Math.max(-1, Math.min(1, ch[i])); peak = Math.max(peak, Math.abs(v)); out.setInt16(44 + i * 4 + k * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    const bytes = new Uint8Array(out.buffer); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), peak, secs, rate, bpm: MUSIC_BPM, stepSec: +(2 * MUSIC_BAR).toFixed(4), steps };
  }

  /* ── phones (Eliran 2026-11-08: «במובייל… בלחיצה על המסך יופיעו הכפתורים ובלחיצה נוספת הם ייעלמו, ככה יהיה אפשר לראות את ההדמיה יותר טוב»):
     on a touch screen up to 960 px wide, a TAP on the panorama hides the chrome (the place card, the tool bar and action bar, the camera
     rail with (?), the room pill and the strip) and the next tap brings it back. A tap = one finger, < 10 px, < 300 ms; a drag or a pinch
     never toggles; a tap on a door marker or a furniture ring keeps its own action; a second tap within 300 ms cancels (no double-tap toggle).
     Nothing hides while the walkthrough, a menu, a sheet, the design panel, 3D, the ruler, the voice tour or a furniture pick is up. Hidden
     controls are inert and aria-hidden. The disclosure stays: the AI line, and a small הדמיה badge in the corner.
     No auto-hide on a timer: controls vanishing while a visitor is reading or deciding feels wrong; a tap is predictable.
     The tap hint (2026-11-09, Eliran: «כשהכפתורים מופיעים… "להסתרת הכפתורים לחץ על המסך" וכשהכפתורים מוסתרים "להצגת הכפתורים לחץ על
     המסך"… למטה בעיצוב זכוכית חום בהיר מעל המשפט "תמונות שנוצרו בבינה מלאכותית"»): a small light-brown glass pill, the first line of the
     disclosure block, always says what the next tap does (house plural «לחצו»); it steps back, keeping its place so nothing jumps,
     whenever a tap would not toggle. It replaces the once-a-session toast. ── */
  const immersiveMq = window.matchMedia('(pointer: coarse) and (max-width: 960px)');
  const CHROME_GROUPS = () => [$('t-place'), ...document.querySelectorAll('#t-head > *'), $('t-tools'), $('t-travel'), $('t-strip')].filter(Boolean);
  const IMM_UI = {
    hide: { he: 'להסתרת הכפתורים לחצו על המסך', en: 'Tap the screen to hide the controls', fr: 'Touchez l’écran pour masquer les commandes' },
    show: { he: 'להצגת הכפתורים לחצו על המסך', en: 'Tap the screen to show the controls', fr: 'Touchez l’écran pour afficher les commandes' },
  };
  let chromeOff = false, immTap = null, immTimer = 0, hintT = 0, immBusyDown = false;
  const immBusy = () => coach.open || Boolean(menuIsOpen()) || !design.hidden || document.documentElement.classList.contains('has-dialog') || !$('t-3d').hidden
    || measure.on || guide.on || !$('t-pick').hidden || !$('t-item-card').hidden || !$('t-video').hidden || langBox.classList.contains('is-open');
  function setChrome(off) {
    chromeOff = Boolean(off);
    document.documentElement.classList.toggle('t-chrome-off', chromeOff);
    for (const el of CHROME_GROUPS()) { el.inert = chromeOff; if (chromeOff) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }
    $('t-badge-mini').setAttribute('aria-hidden', String(!chromeOff));   // the disclosure is announced by whichever badge shows
    tapHintText(true); tapHintSync();
  }
  // the hint's line: what the next tap does; on a toggle a short cross-fade (out 70 ms, the new words, in 70 ms), reduced motion = instant
  function tapHintText(fade) {
    const t = $('t-tap-hint-text'), words = pick(chromeOff ? IMM_UI.show : IMM_UI.hide);
    if (t.textContent === words && !t.classList.contains('is-swap')) return;
    clearTimeout(hintT);
    if (!fade || reduced || !t.textContent) { t.textContent = words; t.classList.remove('is-swap'); return; }
    t.classList.add('is-swap'); hintT = window.setTimeout(() => { t.textContent = words; t.classList.remove('is-swap'); }, 70);
  }
  // the hint steps back whenever a tap would not toggle (the same test the tap uses): the walkthrough, a menu, a sheet, the design panel,
  // plan/3D, the ruler, the voice tour, a furniture pick, the video, the language list. Watched on the elements that carry those states.
  let hintRaf = 0;
  function tapHintSync() { hintRaf = 0; document.documentElement.classList.toggle('t-hint-busy', immBusy()); }
  const tapHintLater = () => { if (!hintRaf) hintRaf = window.requestAnimationFrame(tapHintSync); };
  { const mo = new MutationObserver(tapHintLater);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    for (const el of [$('t-coach'), $('t-design'), $('t-3d'), $('t-pick'), $('t-item-card'), $('t-video'), $('t-measure-bar'), $('t-guide-card'), langBox, ...document.querySelectorAll('.t-menu')])
      if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] }); }
  window.addEventListener('pointerdown', () => { immBusyDown = immBusy(); }, true);   // before the menus' outside-tap closes them
  // the panorama's own pointer stream, capture phase (the viewer's handlers come after): track the one finger, decide on its lift
  const pano = $('pano');
  pano.addEventListener('pointerdown', (e) => {
    if (!immersiveMq.matches || e.pointerType === 'mouse') { immTap = null; return; }
    if (immTap && immTap.id !== e.pointerId) { immTap.multi = true; return; }   // a second finger: a pinch
    immTap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, multi: false, onMarker: Boolean(e.target.closest && e.target.closest('.t-hs, .t-mk')) };
  }, true);
  pano.addEventListener('pointermove', (e) => { if (immTap && e.pointerId === immTap.id && Math.hypot(e.clientX - immTap.x, e.clientY - immTap.y) > 10) immTap.moved = true; }, true);
  pano.addEventListener('pointercancel', () => { immTap = null; }, true);
  pano.addEventListener('pointerup', (e) => {
    const t = immTap; if (!t || e.pointerId !== t.id) return; immTap = null;
    const isTap = !t.moved && !t.multi && !t.onMarker && performance.now() - t.t < 300 && Math.hypot(e.clientX - t.x, e.clientY - t.y) <= 10;
    if (!isTap) { clearTimeout(immTimer); immTimer = 0; return; }
    if (immTimer) { clearTimeout(immTimer); immTimer = 0; return; }   // a double tap: neither tap toggles
    const busyAtTap = immBusyDown || immBusy();   // the tap that closes a menu (or a panel) does not also hide everything
    immTimer = window.setTimeout(() => { immTimer = 0; if (busyAtTap && !chromeOff) return; setChrome(!chromeOff); }, 300);
  }, true);
  // a phone turned into a wider screen, or a state that needs the controls: they come back
  immersiveMq.addEventListener('change', () => { if (!immersiveMq.matches && chromeOff) setChrome(false); });
  /* ── point-to-point movement (plan development/plans/2026-11-11-tour-point-move.md; Eliran 2026-11-10: «התקדמות ותזוזה בהדמייה ע"י
     העכבר אם זה בדסקטופ או ע"י חצים שיופיע במסך אם זה בגרסת המובייל … לפי יכולת עצמאית של המשתמש», «נלך על התקדמות בין נקודות»).
     The viewpoints and their links are the tour's own (scenes.json hotspots, the door rings). Added on top:
       · a mouse (hover + fine pointer): a click on the picture — no drag, not on a ring, a marker or a control, nothing else holding the
         screen (immBusy) — goes to the linked viewpoint nearest the click, if one lies within NAV_AIM degrees of it; the ring it would
         take is lit while the mouse moves; a click with no way that side pulses the rings;
       · every screen: the four directions (below) — the keyboard's arrow keys, each press
         is named on the screen. On a phone a tap on the picture stays the controls' hide / show.
     The move: the view turns to the way out and closes in, then the next viewpoint fades in facing the direction of travel (the
     engine build walks in with its own walkTo). Reduced motion: the plain swap. `?nav=off` turns the click, the keys and the joystick off; ── */
  const NAV_UI = {
    pad: { he: 'תנועה בדירה', en: 'Move around the apartment', fr: 'Se déplacer dans l’appartement' },
    to: { he: 'אל {room}', en: 'To {room}', fr: 'Vers {room}' },
    up: { he: 'קדימה', en: 'Forward', fr: 'Avancer' }, down: { he: 'אחורה', en: 'Back', fr: 'Reculer' },
    left: { he: 'שמאלה', en: 'Left', fr: 'À gauche' }, right: { he: 'ימינה', en: 'Right', fr: 'À droite' },
    turnLeft: { he: 'פנייה שמאלה', en: 'Turning left', fr: 'On tourne à gauche' }, turnRight: { he: 'פנייה ימינה', en: 'Turning right', fr: 'On tourne à droite' },
    turnBack: { he: 'פנייה לאחור', en: 'Turning around', fr: 'Demi-tour' },
    none: { he: 'אין מעבר קדימה', en: 'No way ahead', fr: 'Pas de passage devant' },
    noneBack: { he: 'אין מעבר מאחור', en: 'No way behind', fr: 'Pas de passage derrière' },
    backTo: { he: 'אחורה אל {room}', en: 'Back to {room}', fr: 'Reculer vers {room}' },
  };
  const NAV_AIM = 40;
  const navMode = params.get('nav') === 'off' ? 'off' : 'keys';
  const navClick = navMode !== 'off' && fine;   // the click on the picture is a mouse's
  const nav = { mode: navMode, busy: false, aim: null, to: null, moves: 0, timer: 0 };
  state.nav = nav;
  const navWrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const navExits = () => {
    const cfg = viewer && viewer.getConfig ? viewer.getConfig() : null;
    return ((cfg && cfg.hotSpots) || []).filter((h) => h.type === 'scene' && h.createTooltipArgs && byId[h.createTooltipArgs.to]);
  };
  const navNearest = (yaw, max) => { let best = null, bd = max; for (const h of navExits()) { const d = Math.abs(navWrap(h.yaw - yaw)); if (d <= bd) { bd = d; best = h; } } return best; };
  const navFree = () => Boolean(viewer) && state.ready && viewer.isLoaded() && !nav.busy && !state.applying && !immBusy();
  function navAim(hs) {
    if (nav.aim === hs) return;
    if (nav.aim && nav.aim.div) nav.aim.div.classList.remove('is-aim');
    nav.aim = hs || null;
    if (hs && hs.div) hs.div.classList.add('is-aim');
    pano.classList.toggle('can-go', Boolean(hs) && navClick);
  }
  function navMove(hs, back) {
    if (!hs || !navFree()) return false;
    const toId = hs.createTooltipArgs.to;
    if (typeof hs.clickHandlerFunc === 'function') hs.clickHandlerFunc();   // what a tap on the ring itself does (the automatics)
    state.interacted = true;
    if (state.rotating) setRotating(false);
    nav.moves += 1; nav.to = toId;
    const backYaw = hs.targetYaw + 180;   // a step back arrives facing the way the visitor faced, not the direction of travel
    if (back && (reduced || typeof viewer.walkTo === 'function')) { navAim(null); viewer.loadScene(hs.sceneId, hs.targetPitch, backYaw, hs.targetHfov); return true; }
    if (reduced || typeof viewer.walkTo === 'function') { navAim(null); enterDoor(hs, toId); return true; }
    nav.busy = true;
    const from = viewer.getScene();
    const turn = Math.abs(navWrap(hs.yaw - viewer.getYaw()));
    const ms = Math.round(280 + Math.min(1, turn / 120) * 320);
    if (back) viewer.lookAt(viewer.getPitch(), hs.yaw + 180, Math.min(125, viewer.getHfov() * 1.12), ms);   // the picture opens: stepping away
    else viewer.lookAt(-3, hs.yaw, Math.max(45, viewer.getHfov() * 0.8), ms);
    window.clearTimeout(nav.timer);
    nav.timer = window.setTimeout(() => {
      nav.busy = false; navAim(null);
      if (viewer.getScene() === from) viewer.loadScene(hs.sceneId, hs.targetPitch, back ? backYaw : hs.targetYaw, hs.targetHfov);
    }, ms + 30);
    return true;
  }
  viewer.on('scenechange', () => { window.clearTimeout(nav.timer); nav.busy = false; navAim(null); });
  function navNowhere() {
    pano.classList.remove('is-nowhere'); void pano.offsetWidth; pano.classList.add('is-nowhere');
    window.setTimeout(() => pano.classList.remove('is-nowhere'), 700);
  }
  if (navClick) {
    let down = null, raf = 0, last = null;
    const coords = (e) => { try { const c = viewer.mouseEventToCoords(e); return c && Number.isFinite(c[1]) ? c : null; } catch (_) { return null; } };
    pano.addEventListener('pointerdown', (e) => { down = e.pointerType === 'mouse' && e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now(), el: e.target } : null; }, true);
    pano.addEventListener('pointerup', (e) => {
      const d = down; down = null;
      if (!d || e.pointerType !== 'mouse' || !isPanoTarget(d.el) || !navFree()) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 500) return;
      const c = coords(e); if (!c) return;
      const hs = navNearest(c[1], NAV_AIM);
      if (hs) navMove(hs); else if (navExits().length) navNowhere();
    }, true);
    pano.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      last = e;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!last || last.buttons || !isPanoTarget(last.target) || !navFree()) { if (!nav.busy) navAim(null); return; }
        const c = coords(last); navAim(c ? navNearest(c[1], NAV_AIM) : null);
      });
    }, true);
    pano.addEventListener('pointerleave', () => { last = null; if (!nav.busy) navAim(null); });
  }
  /* the four directions, as a person walking the apartment (Eliran 2026-11-11: «יכולת לנוע גם בדירה עם החצים של המקלדת וכל פעם שלוחצים
     על חץ … יהיה חיווי במסך לאיזה כיוון מתקדמים … ובמובייל … 4 חצים קטנים בשחור מצד ימין … כמו ג'ויסטיק»; then «החיצים אמורים לפעול
     כמו בן אדם שצועד בדירה» and «במובייל … כפתורי החיצים האלה לא אמורים להיעלם כשכל הכפתורים האחרים נעלמים»).
     The keyboard's arrow keys:
       ↑ = a step forward: to the way out the visitor faces (the nearest to the look direction, within NAV_FWD degrees);
       ← → = the body turns: the view turns to that side for as long as the key / button is held (a short press = a small turn);
       ↓ = a step back: to the way out behind (within NAV_BACK degrees of straight behind), arriving still facing the same way.
     No way ahead / behind: the press stays and says so, and the door rings pulse. The ring of the way ahead is lit, so the visitor
     sees where ↑ leads before pressing. Every press is named on the screen (#t-nav-hud). The arrow keys no longer pan the view by
     the viewer's own handler; a key pressed in a field, a menu, the room strip or a sheet is left alone.
     2026-11-11 (later), Eliran: «נוריד את הכפתורי התקדמות כמו הליכה במובייל» — the phone joystick #t-joy is REMOVED (a press still
     jumps to a room's fixed viewpoint, which is not walking); a phone moves by the door rings, the room strip and ‹ ›. The keys stay. */
  const NAV_KEYS = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };
  const NAV_FWD = 50, NAV_BACK = 60, NAV_TURN = 85, NAV_TURN_MIN = 180;   // degrees, degrees, degrees a second, the shortest turn in ms
  const navHudEl = $('t-nav-hud');
  function navPick(dir) {
    const yaw = viewer.getYaw() + (dir === 'down' ? 180 : 0); let best = null, bd = dir === 'down' ? NAV_BACK : NAV_FWD;
    for (const h of navExits()) { const d = Math.abs(navWrap(h.yaw - yaw)); if (d <= bd) { bd = d; best = h; } }
    return best;
  }
  nav.pick = (dir) => { const h = dir === 'up' || dir === 'down' ? navPick(dir) : null; return h ? h.createTooltipArgs.to : null; };
  function navHud(dir, kind, words) {
    nav.hud = { dir, kind, words, n: (nav.hud ? nav.hud.n : 0) + 1 };
    if (!navHudEl) return;
    navHudEl.dataset.dir = dir; navHudEl.dataset.kind = kind;
    $('t-nav-hud-text').textContent = words;
    navHudEl.hidden = false; void navHudEl.offsetWidth; navHudEl.classList.add('is-on');
    window.clearTimeout(nav.hudTimer);
    nav.hudTimer = window.setTimeout(() => { navHudEl.classList.remove('is-on'); }, 1100);
  }
  const navFaced = () => { if (navFree() && nav.keys) navAim(navPick('up')); };
  function navStep(dir) {   // 'up' | 'down'
    if (!navFree()) return null;
    navTurnStop();
    const hs = navPick(dir);
    if (!hs) { navHud(dir, 'none', pick(NAV_UI[dir === 'up' ? 'none' : 'noneBack'])); navNowhere(); return 'none'; }
    const nm = nameOf(byId[hs.nameAs || hs.createTooltipArgs.to]);
    navHud(dir, 'go', pick(NAV_UI[dir === 'up' ? 'to' : 'backTo']).replace('{room}', nm));
    navAim(hs); navMove(hs, dir === 'down');
    return 'go';
  }
  const turn = { side: 0, raf: 0, last: 0, since: 0, stopAt: 0 };
  function navTurnFrame(now) {
    turn.raf = 0;
    if (!turn.side) return;
    if (turn.stopAt && now >= turn.stopAt) { turn.side = 0; turn.stopAt = 0; navFaced(); return; }
    if (!navFree()) { turn.side = 0; turn.stopAt = 0; return; }
    const dt = Math.min(60, now - turn.last); turn.last = now;
    viewer.lookAt(viewer.getPitch(), viewer.getYaw() + (turn.side * NAV_TURN * dt) / 1000, undefined, false);
    navFaced();
    turn.raf = window.requestAnimationFrame(navTurnFrame);
  }
  function navTurnStart(side) {
    if (!navFree()) return;
    state.interacted = true; if (state.rotating) setRotating(false);
    nav.keys = true;
    navHud(side > 0 ? 'right' : 'left', 'turn', pick(NAV_UI[side > 0 ? 'turnRight' : 'turnLeft']));
    if (reduced) { viewer.lookAt(viewer.getPitch(), viewer.getYaw() + side * 30, undefined, false); navFaced(); return; }
    turn.side = side; turn.stopAt = 0; turn.since = turn.last = performance.now();
    if (!turn.raf) turn.raf = window.requestAnimationFrame(navTurnFrame);
  }
  /** the turn ends when the key / button is let go, but never before NAV_TURN_MIN ms: a tap is a small turn, not nothing */
  function navTurnStop(side) {
    if (!turn.side || (side && side !== turn.side)) return;
    const end = turn.since + NAV_TURN_MIN;
    if (performance.now() >= end) { turn.side = 0; turn.stopAt = 0; navFaced(); } else turn.stopAt = end;
  }
  function renderNavLabels() { /* the keys have no labels of their own; the on-screen word is written at each press */ }
  if (navMode !== 'off') {
    const mine = (e) => {
      const dir = NAV_KEYS[e.key];
      if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], .t-menu, .t-strip, .t-sheet, .t-design')) return null;
      return dir;
    };
    window.addEventListener('keydown', (e) => {
      const dir = mine(e); if (!dir || immBusy()) return;
      e.preventDefault(); e.stopPropagation();   // the viewer's own handler would pan the view
      if (e.repeat) return;
      nav.keys = true;
      if (dir === 'up' || dir === 'down') navStep(dir); else navTurnStart(dir === 'right' ? 1 : -1);
    }, true);
    window.addEventListener('keyup', (e) => { const dir = NAV_KEYS[e.key]; if (dir === 'left' || dir === 'right') navTurnStop(dir === 'right' ? 1 : -1); }, true);
    window.addEventListener('blur', () => navTurnStop());
    viewer.on('load', () => window.setTimeout(navFaced, 60));
  }
  renderNavLabels();
  tapHintText(false); tapHintSync();
  coachReady = true; renderCoachLabels();
  // the tour's frame is really on screen: inside /hold/ the tour loads in an iframe at opacity 0 BEHIND the building film and the descent
  // and fades in when they end; inside the apartment page it sits in a tab. A hidden frame never opens the walkthrough.
  const framedHidden = () => {
    try {
      let el = window.frameElement; if (!el) return false;
      const r = el.getBoundingClientRect(); if (r.width < 50 || r.height < 50) return true;
      for (; el; el = el.parentElement) { const cs = el.ownerDocument.defaultView.getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.98) return true; }
      return false;
    } catch (_) { return false; }   // another origin: nothing to read, trust the page
  };
  // on every load: after the first panorama paints and when nothing else holds the screen. Waiting for the intro video, a hidden frame
  // or a hidden tab costs nothing and never gives up; other holds (a panel, the 3D, the voice tour) give up after 2 minutes.
  viewer.on('load', function coachFirst() {
    if (viewer.off) viewer.off('load', coachFirst);
    if (params.get('coach') === '0') return;   // QA and embeds
    if (internalReload) return;                 // the floor switch's own reload: this visit's walkthrough already ran (or was skipped)
    let n = 0;
    const tick = () => {
      if (coach.open) return;
      const waitFree = document.hidden || !$('t-video').hidden || document.documentElement.classList.contains('is-intro') || framedHidden() || !state.ready;
      if (waitFree) { window.setTimeout(tick, 500); return; }
      const busy = !$('t-3d').hidden || !design.hidden || guide.on || state.applying || document.documentElement.classList.contains('has-dialog');
      if (busy) { if (++n <= 240) window.setTimeout(tick, 500); return; }
      coachOpen(true);
    };
    window.setTimeout(tick, reduced ? 600 : 1800);   // the landing fade (ui-enter, 1.7 s) ends first
  });
  state.hooks_coach = { open: coachOpen, close: coachClose, go: coachGo, get i() { return coach.i; }, get open_() { return coach.open; }, get steps() { return coach.steps.map((x) => tipKey(x.els[0])); }, get playing() { return coach.playing; }, get paused() { return coach.paused; }, get log() { return coach.log.slice(); }, tipShow, tipHide,
    music: { get state() { return music.ac ? music.ac.state : 'none'; }, get on() { return music.on; }, get muted() { return musicMuted(); }, get gain() { return music.run ? music.run.gain.value : 0; }, get accents() { return music.accents; }, get waiting() { return music.waiting; }, get invite() { return $('t-coach-music').classList.contains('is-invite'); }, get mayStart() { return musicMayStart(); }, get silent() { return silentEl ? !silentEl.paused : null; }, get session() { return navigator.audioSession ? navigator.audioSession.type : null; }, get ios() { return IS_IOS; }, get host() { return music.on ? music.host : null; }, get gate() { return Boolean(coach.gate); }, get internalReload() { return internalReload; }, get pending() { return Boolean(music.pending); }, grid: () => (music.ac ? { origin: music.origin, now: music.ac.currentTime, bar: MUSIC_BAR } : null), render: musicRender } };   // for the QA
  state.hooks_immersive = { get off() { return chromeOff; }, get active() { return immersiveMq.matches; }, set: setChrome, get hint() { return $('t-tap-hint-text').textContent; }, get hintBusy() { return document.documentElement.classList.contains('t-hint-busy'); } };   // for the QA
  state.hooks_measure = { setMeasure, clearMeasures, surfacePoint, depthFor, tap: measureTap, get items() { return measure.items; } };   // for the QA

  // what viewer/edit-live.js needs: the viewer, the room's current look, the copy, and the way a live change lands
  state.hooks = {
    viewer: () => viewer,
    room: () => state.scene,
    lang: () => lang,
    ui,
    canChange,
    currentCanvas: (room) => composeCanvas(room, activeIds(room)),
    pushLive,
    pushLiveQuiet,
    roomName: (id) => (byId[id] ? nameOf(byId[id]) : String(id)),
    // T18d: the other scenes' markers of the same piece
    samePiece: (piece, room, id) => (piece ? scenes.flatMap((s) => roomMarkers(s.id).filter((m) => m.piece === piece && !(s.id === room && m.id === id)).map((m) => ({ room: s.id, id: m.id }))) : []),
    busy: (on, text, final) => { state.applying = Boolean(on); renderChange(); showLoading(Boolean(on), text, final); },
    /** The host carries keys and the link carries the code: the typed field comes out onto the main screen, and the rings show. */
    setUnlocked: () => {
      state.unlocked = true;
      $('t-change-bar').hidden = false; // Eliran 2026-11-04: «הרבה פונקציות שקיימות בדסקטופ לא קיימות בטלפון, כמו שורת ההקלדה» — never folded
      $('t-change-row').hidden = true;
      $('pano').classList.add('has-markers');
      renderStatic();
      renderChange();
    },
    renderStatic,
    renderChange,
    closeSheet,
    // the markers (T16c): the room's markers as they stand, the words for a category, and which ring is open
    markers: (room) => roomMarkers(room).map((m) => markerState(room, m.id)),
    markerState,
    targetWords,
    openMarker: (id) => { state.marker = id || null; refreshMarkers(); },
    reduced: () => reduced,
  };
})();
