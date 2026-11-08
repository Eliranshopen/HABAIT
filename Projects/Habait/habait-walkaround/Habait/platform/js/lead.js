// Leads: a WhatsApp deep link carrying project|unit|session, and a minimal form that POSTs to a
// configurable webhook (Google Apps Script web-app style). No keys, no real numbers.
// Card 24 (D2), additive: the lead payload carries units_viewed + src (+ k = analytics.lead_secret when configured, checked
// by apps-script/lead-to-sheet.gs); the WhatsApp text CAN carry the units viewed (`viewed:846,857`), but only when
// project.analytics.whatsapp_viewed_line is true: a product decision for Eliran (T2), default OFF = today's message.
// The Sheet endpoint can come from config (window.HABAIT_CONFIG.sheet_endpoint) when the caller passes none.
// Without an endpoint the lead never leaves the device (console stub, as before).
import { capture, sessionId, unitsViewed, campaignSource, configValue } from './analytics.js';
import { t } from './i18n.js';

// wa.me/<number>?text=<project>|<unit>|<session_id>   (optional human line first)
// optional `viewed` (array of unit ids) adds a last line `viewed:846,857` so the salesperson sees what the buyer looked at
export function buildWhatsAppLink({ number, project, unit, session, message, viewed }) {
  const digits = String(number || '').replace(/\D/g, '');
  const tag = `${project}|${unit ?? '-'}|${session || sessionId()}`;
  let text = message ? `${message}\n${tag}` : tag;
  const list = Array.isArray(viewed) ? viewed.map(String).filter((u) => /^[\w.-]{1,20}$/.test(u)).slice(0, 20) : [];
  if (list.length) text += `\nviewed:${list.join(',')}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// POST the lead. Apps Script web apps accept a text/plain body without a CORS preflight and answer
// with a redirect the browser cannot read, so mode:'no-cors' + opaque response = "sent".
// The Google Sheet endpoint (Apps Script web app, see apps-script/README-he.md): project.leads > HABAIT_CONFIG.
// Only https (or a local http test endpoint) is accepted.
export function sheetEndpoint(project) {
  const g = typeof window !== 'undefined' && window.HABAIT_CONFIG ? window.HABAIT_CONFIG : {};
  const u = String(project?.leads?.sheet_endpoint || project?.leads?.webhook_url || g.sheet_endpoint || '');
  return /^https:\/\//.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) ? u : '';
}

// What the Sheet receives: the form fields + units_viewed + src + session_id + ts (fills the last four when missing),
// + k (the shared lead secret, only when analytics.lead_secret is configured; the Apps Script refuses a wrong one).
export function leadPayload(data = {}) {
  const out = {
    ...data,
    units_viewed: Array.isArray(data.units_viewed) ? data.units_viewed : unitsViewed(),
    src: data.src || campaignSource(),
    session_id: data.session_id || sessionId(),
    ts: new Date().toISOString(),
  };
  const k = data.k || configValue('lead_secret');
  if (k) out.k = k; else delete out.k;
  return out;
}

export async function submitLead({ webhookUrl, data, fetchImpl }) {
  const payload = leadPayload(data);
  if (!webhookUrl) webhookUrl = sheetEndpoint();
  if (!webhookUrl) {
    console.log('[lead] no webhook configured; lead =', payload);
    return { ok: true, stubbed: true, payload };
  }
  const f = fetchImpl || fetch;
  const res = await f(webhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return { ok: res.type === 'opaque' || res.ok, status: res.status, payload };
}

export function validateLead({ name, phone, consent }) {
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('name');
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) errors.push('phone');
  if (!consent) errors.push('consent');
  return errors;
}

// Renders the WhatsApp button + lead form into `container` for one unit.
// capture / t / unitsViewed / sessionId default to this folder's modules; js/picker.js passes the host's own
// (so a viewer on another origin, e.g. habait-89's :8899, sends lead events through its analytics object).
// viewedLine: add `viewed:<units>` to the WhatsApp text (default: analytics config whatsapp_viewed_line, which is false).
/** Eliran 2026-11-04: «תוריד את הכפתורים האלה לא צריך (טופס הפנייה וכפתור WhatsApp)» — the lead form and the WhatsApp button are
    off on every page (the unit card, the landing, the apartment page). The component stays for the day they return. */
export const LEADS_ON = false;

export function renderLeadBlock(container, {
  project, projectName, unit, whatsappNumber, webhookUrl,
  capture: cap = capture, t: tr = t, unitsViewed: viewed = unitsViewed, sessionId: sid = null,
  viewedLine = configValue('whatsapp_viewed_line') === true,
}) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'lead-form';

  const actions = document.createElement('div');
  actions.className = 'row';
  const wa = document.createElement('a');
  wa.className = 'btn btn-whatsapp';
  wa.target = '_blank';
  wa.rel = 'noopener';
  wa.textContent = tr('unit.whatsapp');
  const waLink = () => buildWhatsAppLink({
    number: whatsappNumber, project, unit: unit.id, session: sid ? sid() : undefined,
    message: tr('lead.whatsappText', { project: projectName || project, unit: unit.id }),
    viewed: viewedLine ? viewed() : undefined,
  });
  wa.href = waLink();
  wa.addEventListener('click', () => {
    wa.href = waLink(); // the units viewed may have grown since the card opened
    cap('lead_click', { project, unit: unit.id, channel: 'whatsapp', units_viewed: viewed() });
  });
  const formToggle = document.createElement('button');
  formToggle.type = 'button';
  formToggle.className = 'btn btn-ghost';
  formToggle.textContent = tr('unit.lead');
  // F20 (Eliran 2026-11-04, "להסתיר"): no real number in project.leads -> no WhatsApp button at all
  const hasNumber = /\d/.test(String(whatsappNumber || ''));
  if (hasNumber) actions.append(wa, formToggle); else actions.append(formToggle);
  wrap.appendChild(actions);

  const form = document.createElement('form');
  form.hidden = true;
  form.noValidate = true;
  form.innerHTML = `
    <div class="row">
      <input name="name" autocomplete="name" placeholder="${tr('lead.name')}" required>
      <input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="${tr('lead.phone')}" required>
    </div>
    <label class="check"><input type="checkbox" name="consent"> ${tr('lead.consent')}</label>
    <button class="btn btn-primary" type="submit">${tr('lead.send')}</button>
    <div class="lead-status" aria-live="polite"></div>`;
  wrap.appendChild(form);
  const status = form.querySelector('.lead-status');

  formToggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) {
      cap('lead_click', { project, unit: unit.id, channel: 'form', units_viewed: viewed() });
      form.querySelector('input[name=name]').focus();
    }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const data = { name: fd.get('name'), phone: fd.get('phone'), consent: fd.get('consent') === 'on' };
    const errors = validateLead(data);
    form.querySelectorAll('input').forEach((i) => { i.style.outline = errors.includes(i.name) ? '2px solid var(--sold)' : ''; });
    if (errors.length) return;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    status.className = 'lead-status';
    status.textContent = '…';
    try {
      const r = await submitLead({
        webhookUrl,
        data: { ...data, project, unit: unit.id, floor: unit.floor, price: unit.price, status: unit.status, units_viewed: viewed(), lang: document.documentElement.lang, url: location.href },
      });
      status.className = 'lead-status ok';
      status.textContent = r.stubbed ? `${tr('lead.sent')} ${tr('lead.stub')}` : tr('lead.sent');
      cap('lead_submitted', { project, unit: unit.id, channel: 'form', stubbed: !!r.stubbed });
      form.reset();
    } catch (e) {
      console.error(e);
      status.className = 'lead-status err';
      status.textContent = tr('lead.err');
    } finally {
      btn.disabled = false;
    }
  });

  container.appendChild(wrap);
  return { whatsappLink: hasNumber ? wa.href : null };
}
