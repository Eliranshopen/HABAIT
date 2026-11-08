// PostHog-compatible capture(). Logs to the console unless a PostHog key is configured.
// Card 24 (D2) adds, without changing the existing exports' signatures:
//   - one flat event record {event, ts, session_id, project, unit?, room?, floor?, src, dwell_ms?, ...} (toRecord)
//   - a first-party JSONL sink (tools/events-sink.mjs): records are batched to a SAME-ORIGIN url only, and only when
//     the page's server announces the sink (Server-Timing: habait-sink) or config.sink_url is set
//   - PostHog only when config.posthog_key exists, through js/posthog-adapter.js (loaded lazily, vendored SDK,
//     property allowlist). No key = zero requests to any third party.
//   - ?src=<campaign> kept per session; units viewed kept per session (for the lead); favorites; dwell helper
// Config sources (later wins): window.POSTHOG_KEY/POSTHOG_HOST (legacy), window.HABAIT_CONFIG (flat, or its .analytics
// block), initAnalytics({ config: project.analytics }). project.json "analytics" block (contracts/project.schema.json):
//   posthog_key, posthog_host, posthog_transport, whatsapp_viewed_line (default false), lead_secret.
// Values are sanitised per field (sanitizeRecord): free-text fields are short safe tokens; anything that looks like a
// phone number, an e-mail or a URL is dropped before it reaches the JSONL sink or PostHog.
// No key is shipped here.
// D2 (card 24): room_view / floor_switch / favorite folded in (EVENTS.length 14, pinned by test/smoke.mjs).
// D3 (card 25): setVariant('a'|'b') once per tab (landing.html); every later capture of the tab carries `variant`.
export const EVENTS_D2 = ['room_view', 'floor_switch', 'favorite'];
export const EVENTS = [
  'project_open', 'flight_start', 'segment_start', 'unit_hover', 'unit_click', 'unit_enter',
  'tour_handoff', 'lead_click', 'lead_submitted',
  'apartment_tab', 'zip_download', // apartment.html (D1b)
  ...EVENTS_D2,
];
export const KNOWN_EVENTS = EVENTS.slice();

const SESSION_KEY = 'habait.session';
const DISTINCT_KEY = 'habait.distinct';
const SRC_KEY = 'habait.src';
const VIEWED_KEY = 'habait.viewed';
const FAV_KEY = 'habait.favorites';
const isBrowser = typeof window !== 'undefined';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function stored(storage, key) {
  try {
    let v = storage.getItem(key);
    if (!v) { v = randomId(); storage.setItem(key, v); }
    return v;
  } catch {
    return randomId();
  }
}

let _session = null;
let _distinct = null;
export function sessionId() {
  if (_session) return _session;
  _session = isBrowser ? stored(window.sessionStorage, SESSION_KEY) : randomId();
  return _session;
}
export function distinctId() {
  if (_distinct) return _distinct;
  _distinct = isBrowser ? stored(window.localStorage, DISTINCT_KEY) : randomId();
  return _distinct;
}

const state = {
  key: null,
  host: 'https://us.i.posthog.com',
  base: {},         // properties sent with every event (project, lang, ...)
  buffer: [],       // every event of this page, for tests and the lead ("units viewed")
  debug: true,
};
if (isBrowser) window.__habaitEvents = state.buffer;

// ---- D2 state ----
const d2 = {
  transport: 'sdk',    // posthog transport: 'sdk' (vendored posthog-js) | 'http' (plain /capture/ calls)
  sinkUrl: null,       // same-origin url of the JSONL sink, or null
  sinkQueue: [],
  sinkTimer: null,
  sinkFlushMs: 2000,
  adapter: null,       // Promise<adapter> once a key exists
  adapterQueue: [],
  records: [],         // flat records of this page (tests / debugging)
  hooksInstalled: false,
  options: {},         // whatsapp_viewed_line, lead_secret (configValue)
};
if (isBrowser) window.__habaitRecords = d2.records;

function globalConfig() {
  const g = (isBrowser && window.HABAIT_CONFIG && typeof window.HABAIT_CONFIG === 'object') ? window.HABAIT_CONFIG : {};
  return g.analytics && typeof g.analytics === 'object' ? { ...g, ...g.analytics } : g;
}
const LEAD_SECRET_RE = /^[\w.-]{1,120}$/;

// The sink is announced by the server on the page response (tools/events-sink.mjs sets
// `Server-Timing: habait-sink;desc="/api/events"`), so pages served without it never post (no 405s, no console noise).
function announcedSink() {
  if (!isBrowser || typeof performance === 'undefined' || !performance.getEntriesByType) return null;
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    const st = nav && nav.serverTiming ? nav.serverTiming.find((s) => s.name === 'habait-sink') : null;
    return st ? (st.description || '/api/events') : null;
  } catch { return null; }
}

// Only http(s) and only the page's own origin: the "local sink" can never become a third party by config.
function sameOriginUrl(u) {
  if (!isBrowser || !u) return null;
  try {
    if (!/^https?:$/.test(location.protocol)) return null;
    const url = new URL(u, location.href);
    return url.origin === location.origin ? url.toString() : null;
  } catch { return null; }
}

export function initAnalytics({ key, host, base, debug, ...rest } = {}) {
  const g = globalConfig();
  const cfg = { ...g, ...(rest.config || {}), ...rest };
  state.key = key || cfg.posthog_key || (isBrowser ? window.POSTHOG_KEY : null) || null;
  if (typeof state.key !== 'string' || !state.key.trim()) state.key = null;
  const h = host || cfg.posthog_host || (isBrowser ? window.POSTHOG_HOST : null);
  if (h) state.host = h;
  if (cfg.posthog_transport === 'http' || cfg.posthog_transport === 'sdk') d2.transport = cfg.posthog_transport;
  d2.allowBots = cfg.posthog_allow_bots === true; // test only (Playwright sets navigator.webdriver)
  const sink = cfg.sink_url !== undefined ? cfg.sink_url : announcedSink();
  d2.sinkUrl = sink === false || sink === null ? null : sameOriginUrl(sink);
  d2.options = {
    whatsapp_viewed_line: cfg.whatsapp_viewed_line === true, // product decision (Eliran, T2): off until he says so
    lead_secret: typeof cfg.lead_secret === 'string' && LEAD_SECRET_RE.test(cfg.lead_secret) ? cfg.lead_secret : null,
  };
  if (base) Object.assign(state.base, base);
  if (debug !== undefined) state.debug = debug;
  campaignSource(); // read ?src= on the landing page even if no event fires yet
  variant();        // card 25: an A/B variant registered earlier in this tab (landing.html) rides on every event
  installHooks();
  return state;
}

export function setBaseProps(props) { Object.assign(state.base, props); }

export function capture(event, props = {}) {
  if (!KNOWN_EVENTS.includes(event) && state.debug) console.warn('[analytics] unknown event', event);
  const properties = {
    ...state.base,
    ...props,
    session_id: sessionId(),
    src: props.src || campaignSource(),
    $lib: 'habait-platform',
  };
  const v = variant();
  if (v) properties.variant = v; // card 25: registered once per tab session; one session = one variant
  else delete properties.variant;
  const payload = { event, properties, timestamp: new Date().toISOString() };
  state.buffer.push(payload);
  if (state.buffer.length > 500) state.buffer.shift();
  rememberViewed(event, properties.unit);

  const rec = toRecord(payload);
  d2.records.push(rec);
  if (d2.records.length > 500) d2.records.shift();
  if (d2.sinkUrl) queueSink(rec);

  if (!state.key) {
    if (state.debug) console.log('[analytics]', event, props);
    return payload;
  }
  sendToPostHog(rec);
  return payload;
}

// units the buyer looked at in this session (this page + earlier pages of the same tab), for the WhatsApp text / lead
export function unitsViewed() {
  const seen = [...readViewed()];
  for (const e of state.buffer) {
    if ((e.event === 'unit_click' || e.event === 'unit_enter') && e.properties.unit && !seen.includes(e.properties.unit)) seen.push(e.properties.unit);
  }
  return seen;
}

// ======================= D2 additions (card 24) =======================

// The flat record: what the JSONL sink stores and what the PostHog adapter picks from. Allowlisted fields only;
// lead-form fields (name, phone, ...) never enter an event record.
export const RECORD_FIELDS = ['event', 'ts', 'session_id', 'project', 'unit', 'room', 'floor', 'finish', 'src', 'dwell_ms',
  'tab', 'channel', 'scene', 'prev', 'on', 'page', 'lang', 'via', 'mode', 'status', 'units_viewed', 'stubbed', 'path', 'test',
  'variant']; // card 25 (D3): landing A/B arm, 'a' | 'b' (set only through setVariant)
const OPTIONAL = ['unit', 'room', 'floor', 'finish', 'dwell_ms', 'tab', 'channel', 'scene', 'prev', 'on', 'page', 'lang', 'via', 'mode', 'status', 'units_viewed', 'stubbed'];

// ---- value-level sanitising (T2 review defect 1): RECORD_FIELDS limits field NAMES; this limits VALUES ----
// Free-text fields carry short machine tokens only (unit ids, tab / room / finish names, campaign tags). A value that looks
// like a phone number (7+ digits), an e-mail or a URL is dropped; any other value outside the token charset becomes "other".
export const TOKEN_RE = /^[A-Za-z0-9_.:-]{1,40}$/;
export const TEXT_FIELDS = ['project', 'unit', 'room', 'finish', 'src', 'tab', 'channel', 'scene', 'prev', 'page', 'lang', 'via', 'mode', 'status',
  'variant'];
const BOOL_FIELDS = ['on', 'stubbed', 'test'];
const EVENT_RE = /^[a-z][a-z0-9_]{1,39}$/;
const SESSION_RE = /^[A-Za-z0-9-]{6,80}$/;
const PATH_RE = /^\/[A-Za-z0-9_.\/-]{0,119}$/;
const TLD = 'com|net|org|io|co|il|ly|me|app|ai|info|biz|xyz|link|site|online|ru|uk|de|fr|tv|gl|gle|to|in|us';
const URL_RE = new RegExp(`(^|[^a-z])(https?|ftp|mailto|tel|sms|wa|whatsapp|file|data|javascript):|//|www\\.|[a-z0-9-]\\.(${TLD})(?![a-z0-9])`, 'i');

// true = the value may identify a person (phone / id / card number, e-mail, URL): never stored, never sent
export function looksPersonal(v) {
  const s = String(v);
  if (s.includes('@')) return true;
  if ((s.match(/\d/g) || []).length >= 7) return true;
  return URL_RE.test(s);
}

// a free-text value -> safe token | 'other' | undefined (dropped)
export function safeToken(v) {
  if (v === null || v === undefined || typeof v === 'object' || typeof v === 'function') return undefined;
  if (typeof v === 'number' && !Number.isFinite(v)) return undefined;
  const s = String(v).trim();
  if (!s || looksPersonal(s)) return undefined;
  return TOKEN_RE.test(s) ? s : 'other';
}

// One record (built here or POSTed to the sink) -> the allowlisted, value-checked record; null when the event is invalid.
// Shared with tools/events-sink.mjs so the server applies exactly the same rules.
export function sanitizeRecord(r) {
  if (!r || typeof r !== 'object' || !EVENT_RE.test(String(r.event || ''))) return null;
  const out = { event: String(r.event) };
  if (typeof r.ts === 'string' && r.ts.length <= 40 && !Number.isNaN(Date.parse(r.ts))) out.ts = r.ts;
  if (typeof r.session_id === 'string' && SESSION_RE.test(r.session_id)) out.session_id = r.session_id;
  for (const k of TEXT_FIELDS) { const v = safeToken(r[k]); if (v !== undefined) out[k] = v; }
  if (typeof r.floor === 'number') { if (Number.isFinite(r.floor) && Math.abs(r.floor) <= 500) out.floor = r.floor; }
  else { const v = safeToken(r.floor); if (v !== undefined) out.floor = v; }
  if (r.dwell_ms !== undefined && r.dwell_ms !== null && r.dwell_ms !== '') {
    const n = Math.round(Number(r.dwell_ms));
    if (Number.isFinite(n)) out.dwell_ms = Math.max(0, Math.min(86400000, n));
  }
  for (const k of BOOL_FIELDS) if (typeof r[k] === 'boolean') out[k] = r[k];
  if (Array.isArray(r.units_viewed)) {
    const a = r.units_viewed.map(safeToken).filter((x) => x !== undefined && x !== 'other').slice(0, 50);
    if (a.length) out.units_viewed = a;
  }
  if (typeof r.path === 'string') out.path = PATH_RE.test(r.path) && !looksPersonal(r.path) ? r.path : '/other';
  for (const k of Object.keys(out)) if (!RECORD_FIELDS.includes(k)) delete out[k];
  return out;
}

export function toRecord(payload) {
  const p = payload.properties || {};
  const raw = { ...p, event: String(payload.event || ''), ts: payload.timestamp || new Date().toISOString(), room: p.room ?? p.scene };
  if (isBrowser) {
    raw.path = location.pathname.slice(0, 120);
    try { if (navigator.webdriver) raw.test = true; } catch { /* no navigator */ }
  }
  const rec = sanitizeRecord(raw) || { event: 'other' };
  // fixed head: these keys always exist (null when missing or dropped)
  return { ...rec, event: rec.event, ts: rec.ts || new Date().toISOString(), session_id: rec.session_id || null, project: rec.project ?? null, src: rec.src ?? 'direct' };
}

// ?src=<campaign> (also utm_campaign / utm_source), kept for the whole tab session; 'direct' when none.
let _src = null;
const SRC_RE = /^[\w.\-]{1,64}$/;
export function campaignSource() {
  if (_src) return _src;
  let v = null;
  if (isBrowser) {
    try {
      const q = new URLSearchParams(location.search);
      const fromUrl = q.get('src') || q.get('utm_campaign') || q.get('utm_source');
      if (fromUrl && SRC_RE.test(fromUrl) && !looksPersonal(fromUrl)) { v = fromUrl; window.sessionStorage.setItem(SRC_KEY, v); }
      else v = window.sessionStorage.getItem(SRC_KEY);
    } catch { /* private mode */ }
  }
  _src = v && SRC_RE.test(v) && !looksPersonal(v) ? v : 'direct';
  return _src;
}
export function setCampaignSource(src) {
  if (!src || !SRC_RE.test(src) || looksPersonal(src)) return campaignSource();
  _src = src;
  if (isBrowser) { try { window.sessionStorage.setItem(SRC_KEY, src); } catch { /* private mode */ } }
  return _src;
}

// ---- A/B variant (card 25, D3): landing.html registers it once; every later capture in the tab carries it ----
// Stored in sessionStorage, so a same-origin iframe (flow.html inside landing.html) and the next pages of the tab
// (apartment.html after the hand-off) report the same arm. Only 'a' | 'b'; anything else is ignored.
const VARIANT_KEY = 'habait.variant';
export const VARIANT_RE = /^[ab]$/;
let _variant;
export function variant() {
  if (_variant !== undefined) {
    if (_variant) state.base.variant = _variant;
    return _variant;
  }
  let v = null;
  if (isBrowser) { try { v = window.sessionStorage.getItem(VARIANT_KEY); } catch { /* private mode */ } }
  _variant = v && VARIANT_RE.test(v) ? v : null;
  if (_variant) state.base.variant = _variant;
  return _variant;
}
export function setVariant(v) {
  if (!VARIANT_RE.test(String(v))) return variant();
  _variant = String(v);
  state.base.variant = _variant;
  if (isBrowser) { try { window.sessionStorage.setItem(VARIANT_KEY, _variant); } catch { /* private mode */ } }
  return _variant;
}

function readViewed() {
  if (!isBrowser) return [];
  try { const a = JSON.parse(window.sessionStorage.getItem(VIEWED_KEY) || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}
function rememberViewed(event, unit) {
  if (!isBrowser || !unit || (event !== 'unit_click' && event !== 'unit_enter')) return;
  try {
    const a = readViewed();
    if (!a.includes(String(unit))) { a.push(String(unit)); window.sessionStorage.setItem(VIEWED_KEY, JSON.stringify(a.slice(-50))); }
  } catch { /* private mode */ }
}

// Favorites live on the device only (localStorage); the event says which unit and on/off.
export function favorites() {
  if (!isBrowser) return [];
  try { const a = JSON.parse(window.localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}
export function isFavorite(unit) { return favorites().includes(String(unit)); }
// stores the favorite on the device without an event (picker.js uses it when its host's analytics has no setFavorite)
export function storeFavorite(unit, on = true) {
  const id = String(unit);
  if (isBrowser) {
    try {
      const a = favorites().filter((u) => u !== id);
      if (on) a.push(id);
      window.localStorage.setItem(FAV_KEY, JSON.stringify(a.slice(-100)));
    } catch { /* private mode */ }
  }
  return favorites();
}
export function setFavorite(unit, on = true, props = {}) {
  const id = String(unit);
  storeFavorite(id, on);
  return capture('favorite', { ...props, unit: id, on: !!on });
}

// floor_switch: `finish` = the floor finish in the tour (parquet|concrete|marble); `floor` = a building floor (picker drawer)
export function floorSwitch({ finish, floor, prev, ...props } = {}) {
  return capture('floor_switch', { ...props, finish, floor, prev });
}

// room_view with dwell: const stop = startDwell('living', {unit:'846'}); ... stop()  -> room_view {room, dwell_ms}
export function startDwell(room, props = {}) {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const t0 = now();
  let done = false;
  return (extra = {}) => {
    if (done) return null;
    done = true;
    return capture('room_view', { ...props, ...extra, room, dwell_ms: Math.round(now() - t0) });
  };
}

export function analyticsConfig() {
  return {
    posthog: !!state.key, posthog_host: state.key ? state.host : null, transport: state.key ? d2.transport : null,
    sink_url: d2.sinkUrl, src: campaignSource(), whatsapp_viewed_line: configValue('whatsapp_viewed_line') === true,
  };
}
// one option of the analytics config ('whatsapp_viewed_line' | 'lead_secret'); read by lead.js and picker.js
export function configValue(name) {
  if (name in d2.options) return d2.options[name];
  const g = globalConfig(); // a page that never called initAnalytics
  if (name === 'whatsapp_viewed_line') return g.whatsapp_viewed_line === true;
  if (name === 'lead_secret') return typeof g.lead_secret === 'string' && LEAD_SECRET_RE.test(g.lead_secret) ? g.lead_secret : null;
  return undefined;
}

// ---- JSONL sink (first party, same origin) ----
function queueSink(rec) {
  d2.sinkQueue.push(rec);
  if (d2.sinkQueue.length >= 25) { flushEvents({ beacon: true }); return; }
  if (!d2.sinkTimer && typeof setTimeout === 'function') d2.sinkTimer = setTimeout(() => flushEvents({ beacon: true }), d2.sinkFlushMs);
}

// Sends what is queued. beacon:true = fire-and-forget (page hide); otherwise awaits the fetch (tests).
export async function flushEvents({ beacon = false } = {}) {
  if (d2.sinkTimer) { clearTimeout(d2.sinkTimer); d2.sinkTimer = null; }
  const out = [];
  // the sink takes <= 50 events and <= 16 KB per request: post in chunks of <= 25 events / ~12 KB
  while (d2.sinkUrl && d2.sinkQueue.length) {
    const lines = [];
    let bytes = 0;
    while (d2.sinkQueue.length && lines.length < 25) {
      const line = JSON.stringify(d2.sinkQueue[0]);
      if (lines.length && bytes + line.length + 1 > 12000) break;
      d2.sinkQueue.shift();
      if (line.length > 12000) continue; // cannot happen with sanitised records; never send an oversized line
      lines.push(line);
      bytes += line.length + 1;
    }
    if (!lines.length) continue;
    const body = lines.join('\n') + '\n';
    let sent = false;
    if (beacon && isBrowser && navigator.sendBeacon) {
      try { sent = navigator.sendBeacon(d2.sinkUrl, new Blob([body], { type: 'text/plain;charset=utf-8' })); } catch { sent = false; }
    }
    if (!sent) {
      out.push(fetch(d2.sinkUrl, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body })
        .then((r) => r.ok)
        .catch((e) => { if (state.debug) console.warn('[analytics] sink failed', e); return false; }));
    }
  }
  if (d2.adapter) out.push(d2.adapter.then((a) => (a && a.flush ? a.flush() : null)).catch(() => null));
  await Promise.all(out);
  return { queued: d2.sinkQueue.length };
}

function installHooks() {
  if (!isBrowser || d2.hooksInstalled) return;
  d2.hooksInstalled = true;
  const hide = () => { flushEvents({ beacon: true }); };
  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hide(); });
}

// ---- PostHog (only with a key) ----
function sendToPostHog(rec) {
  if (!d2.adapter) {
    const opts = { key: state.key, host: state.host, transport: d2.transport, sessionId: rec.session_id, debug: state.debug, allowBots: d2.allowBots };
    d2.adapter = import('./posthog-adapter.js')
      .then((m) => m.createPostHogAdapter(opts))
      .catch((e) => { if (state.debug) console.warn('[analytics] posthog adapter unavailable; events stay local', e); return null; });
  }
  d2.adapter.then((a) => { if (a) a.send(rec); });
}
