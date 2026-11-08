// Regression for the live bug rnd-ed reported (2026-11-03): a relative exterior.url ("/hold", stage_flow's rewrite)
// must not throw in backToBuildingUrl / apartmentTourUrl. Node: no `location`, so the neutral base is used.
import { backToBuildingUrl, apartmentTourUrl } from 'file:///C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform/js/apartment.js';
const out = [];
const p = { id: 'rainbow', exterior: { mode: 'external', url: '/hold', params: { scope: 'building' } } };
try { out.push(['relative exterior.url', backToBuildingUrl(p, { hold: 'h1' })]); } catch (e) { out.push(['relative exterior.url THROWS', e.message]); }
try { out.push(['absolute exterior.url', backToBuildingUrl({ ...p, exterior: { ...p.exterior, url: 'http://127.0.0.1:8848/tour/' } }, { hold: 'h1' })]); } catch (e) { out.push(['absolute THROWS', e.message]); }
try { out.push(['relative tour base', apartmentTourUrl('/tour/', { room: 'living' })]); } catch (e) { out.push(['relative tour base THROWS', e.message]); }
for (const [k, v] of out) console.log(`${/THROWS/.test(k) ? 'FAIL' : 'ok  '} ${k}: ${v}`);
process.exit(out.some(([k]) => /THROWS/.test(k)) ? 1 : 0);
