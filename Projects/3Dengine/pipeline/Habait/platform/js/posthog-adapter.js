// PostHog backend for js/analytics.js (card 24, D2). Loaded lazily by analytics.js ONLY when config.posthog_key exists;
// without a key this file is never fetched and nothing leaves the device.
//
// Two transports, both sending exactly the allowlist below (nothing else from the page):
//   'sdk'  (default) the vendored posthog-js 1.444.2 slim no-external ESM build (js/vendor/, Apache-2.0/MIT, byte-identical
//          to the npm tarball, sha256 f5f29337...). Autocapture, pageviews, session recording, surveys, heatmaps, flags,
//          remote config and every external script load are off; persistence is memory-only (no cookie, no localStorage);
//          before_send rebuilds every event's properties from the allowlist, drops $set/$set_once and unknown events.
//   'http' one POST per event to <host>/capture/ in the PostHog capture format (https://posthog.com/docs/api/capture).
//
// distinct_id = the tab's session_id (no cross-visit device id); $process_person_profile = false (no person profiles).

export const POSTHOG_SDK_VERSION = '1.444.2';
export const POSTHOG_SDK_FILE = 'vendor/posthog-js-1.444.2.module.slim.no-external.js';
export const POSTHOG_SDK_SHA256 = 'f5f293375ced7f5be1cf1cba68bf5d8267d3e38b61a42b2bcba58bf4ad485eb7';

// Event properties that may leave the device (key mode only). Values are already cleaned by analytics.toRecord().
export const OUTBOUND_FIELDS = ['session_id', 'project', 'unit', 'room', 'floor', 'finish', 'src', 'dwell_ms', 'tab', 'channel',
  'scene', 'prev', 'on', 'page', 'lang', 'via', 'mode', 'status', 'units_viewed', 'stubbed', 'path', 'test',
  'variant']; // card 25 (D3): landing A/B arm 'a' | 'b'
// Added by this adapter / required by PostHog to accept the event.
export const ENVELOPE_FIELDS = ['token', 'distinct_id', '$lib', '$process_person_profile'];
// Events that may leave the device (anything else is dropped in key mode).
export const OUTBOUND_EVENTS = ['project_open', 'flight_start', 'segment_start', 'unit_hover', 'unit_click', 'unit_enter',
  'tour_handoff', 'lead_click', 'lead_submitted', 'apartment_tab', 'zip_download', 'room_view', 'floor_switch', 'favorite'];

export function outboundProperties(rec) {
  const out = {};
  for (const k of OUTBOUND_FIELDS) if (rec[k] !== undefined && rec[k] !== null) out[k] = rec[k];
  return out;
}

// One event in the PostHog /capture/ format.
export function captureBody(rec, key) {
  return {
    api_key: key,
    event: rec.event,
    timestamp: rec.ts,
    properties: { distinct_id: rec.session_id, $lib: 'habait-platform', $process_person_profile: false, ...outboundProperties(rec) },
  };
}

function sdkConfig({ host, sessionId, debug, allowBots }) {
  return {
    api_host: host,
    // nothing automatic
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    capture_exceptions: false,
    rageclick: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_conversations: true,
    disable_product_tours: true,
    disableDeviceModel: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    advanced_disable_decide: true,
    advanced_disable_feature_flags: true,
    advanced_disable_feature_flags_on_first_load: true,
    advanced_disable_toolbar_metrics: true,
    // nothing stored on the device, no referrer / campaign sniffing
    persistence: 'memory',
    disable_persistence: true,
    save_referrer: false,
    store_google: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    person_profiles: 'identified_only',
    bootstrap: { distinctID: sessionId },
    // the SDK drops bot / webdriver traffic (keeps the quota clean); allowBots is for the Playwright test only
    opt_out_useragent_filter: !!allowBots,
    disable_compression: true, // readable bodies (auditable, testable); events are small
    request_queue_config: { flush_interval_ms: 1000 },
    debug: false,
    before_send: (ev) => {
      if (!ev || !OUTBOUND_EVENTS.includes(ev.event)) return null;
      const p = ev.properties || {};
      ev.properties = {
        token: p.token,
        distinct_id: sessionId,
        $lib: 'habait-platform',
        $process_person_profile: false,
        ...outboundProperties(p),
      };
      delete ev.$set;
      delete ev.$set_once;
      if (debug) console.log('[posthog-adapter] out', ev.event, ev.properties);
      return ev;
    },
  };
}

export async function createPostHogAdapter({ key, host = 'https://us.i.posthog.com', transport = 'sdk', sessionId, fetchImpl, debug = false, allowBots = false } = {}) {
  if (!key) throw new Error('posthog-adapter: no key');
  const base = String(host).replace(/\/$/, '');
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);

  if (transport === 'sdk') {
    try {
      const mod = await import(new URL(`./${POSTHOG_SDK_FILE}`, import.meta.url).toString());
      const ph = mod.default || mod.posthog;
      const inst = ph.init(key, sdkConfig({ host: base, sessionId, debug, allowBots }), 'habait') || ph;
      return {
        transport: 'sdk',
        send(rec) { inst.capture(rec.event, outboundProperties(rec), { timestamp: new Date(rec.ts) }); },
        flush() { try { inst._requestQueue?.unload?.(); } catch { /* best effort */ } },
        instance: inst,
      };
    } catch (e) {
      if (debug) console.warn('[posthog-adapter] SDK failed, using plain HTTP capture', e);
    }
  }

  const pending = new Set();
  return {
    transport: 'http',
    send(rec) {
      if (!f) return;
      const p = f(`${base}/capture/`, {
        method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(captureBody(rec, key)),
      }).catch((e) => debug && console.warn('[posthog-adapter] send failed', e));
      pending.add(p);
      p.finally(() => pending.delete(p));
    },
    async flush() { await Promise.all([...pending]); },
  };
}
