// The one definition of DEV (board platform-ui-ux, card 10; moved here unchanged from index.html, habait-98's rule of
// 2026-11-02): development artefacts (fixture badges, "תצוגת פיתוח", placeholder notes, backup-flow links, the v0 footer)
// show only on the laptop or with ?dev=1. Buyers never see them. Node-safe: test/landing.test.mjs imports js/landing.js in Node.
const loc = typeof location !== 'undefined' ? location : null;
export const DEV = Boolean(loc) && (new URLSearchParams(loc.search).get('dev') === '1' || ['127.0.0.1', 'localhost'].includes(loc.hostname));
// pages whose dev labels are toggled by a script this board may not edit (flow.js) hide them in CSS unless <html data-dev="1">
if (DEV && typeof document !== 'undefined') document.documentElement.dataset.dev = '1';
