// Hebrew / English strings + direction switching. Default: Hebrew (RTL).
const KEY = 'habait.lang';

export const STR = {
  he: {
    'index.title': 'בחרו פרויקט',
    'index.sub': 'טיסת 360° סביב הבניין והסביבה, בחירת דירה מתוך הטיסה וכניסה אליה.',
    'index.open': 'לטיסה',
    'index.fixture': 'fixture',
    'index.none': 'אין פרויקטים ב-projects.json',
    'index.error': 'שגיאה בטעינת הפרויקטים',
    'index.foot': 'Habait · v0 · תצוגת פיתוח',
    // platform-ui-ux card 11: the home page (copy = draft for Eliran)
    'home.hero': 'סיור בבניין, לפני שהוא קם.',
    'home.heroSub': 'טיסה סביב הפרויקט, בחירת דירה מתוך הטיסה, וכניסה פנימה.',
    'home.projects': 'הפרויקטים',
    'home.units': '{n} דירות',
    'home.available': '{n} פנויות',
    'home.units1': 'דירה אחת',
    'home.available1': 'פנויה אחת',
    'home.cta': 'לסיור בפרויקט',
    'home.emptyTitle': 'עוד אין פרויקטים להצגה',
    'home.emptyText': 'כאן יופיעו הפרויקטים שבשיווק, כל אחד עם טיסה סביב הבניין וסיור בדירות.',
    'home.emptyCta': 'לנסות שוב',
    'home.ai': 'הדמיה',
    'home.foot': 'Habait · סיורים בפרויקטים שעוד לא נבנו',
    'start.cta': 'התחילו את הטיסה',
    'start.note': '360° · גררו או סובבו את הטלפון כדי להסתכל סביב',
    'start.fixture': 'תצוגת פיתוח: קטעי הטיסה הם placeholders (clay), לא ההדמיה הסופית',
    'hud.hint': 'גררו כדי להסתכל סביב',
    'hud.hintHold': 'לחצו על דירה',
    'hud.toFacade': 'אל החזית · בחירת דירה',
    'hud.units': 'דירות',
    'hud.gyro': 'ג׳ירו',
    'units.title': 'דירות',
    'unit.apt': 'דירה',
    'unit.floor': 'קומה',
    'unit.rooms': 'חדרים',
    'unit.area': 'מ״ר',
    'unit.outdoor': 'מ״ר מרפסת',
    'unit.type': 'טיפוס',
    'unit.poa': 'מחיר לפי פנייה',
    'unit.continue': 'המשיכו אל הדירה',
    'unit.continueSold': 'הדירה נמכרה · צפייה בדוגמה',
    'unit.openTour': 'לסיור 360°',
    'unit.whatsapp': 'וואטסאפ',
    'unit.lead': 'השאירו פרטים',
    'unit.placeholder': 'הטיסה אל הדירה הזו עדיין לא רונדרה; מוצגת הטיסה אל דירה 846 כ-placeholder.',
    'status.for-sale': 'למכירה',
    'status.reserved': 'שמורה',
    'status.sold': 'נמכרה',
    'status.unknown': 'לא ידוע',
    'lead.name': 'שם',
    'lead.phone': 'טלפון',
    'lead.consent': 'מאשר/ת יצירת קשר לגבי הדירה',
    'lead.send': 'שליחה',
    'lead.sent': 'תודה! נחזור אליכם בקרוב.',
    'lead.err': 'השליחה נכשלה, נסו שוב או בוואטסאפ.',
    'lead.stub': 'נשמר מקומית (אין webhook מוגדר).',
    'lead.whatsappText': 'שלום, אני מתעניין/ת בפרויקט {project}, דירה {unit}.',
    'handoff.title': 'הגענו אל דירה {unit}',
    'handoff.sub': 'הסיור 360° של הדירה נפתח בנגן נפרד.',
    'handoff.cta': 'היכנסו לדירה',
    'handoff.back': 'חזרה אל החזית',
    'end.title': 'סוף הטיסה',
    'err.webgl': 'הדפדפן לא תומך ב-WebGL; לא ניתן להציג את הטיסה.',
    'err.load': 'שגיאה בטעינת הפרויקט',
    'err.noProject': 'לא נבחר פרויקט',
    'toast.gyroOn': 'הג׳ירו פעיל: סובבו את הטלפון',
    'toast.gyroDenied': 'אין הרשאה לחיישני התנועה',
  },
  en: {
    'index.title': 'Choose a project',
    'index.sub': 'A 360° flight around the building and its surroundings, pick an apartment from the flight and go in.',
    'index.open': 'Take the flight',
    'index.fixture': 'fixture',
    'index.none': 'No projects in projects.json',
    'index.error': 'Could not load the projects',
    'index.foot': 'Habait · v0 · development view',
    'home.hero': 'Walk through a building before it rises.',
    'home.heroSub': 'Fly around the project, pick an apartment from the flight, and step inside.',
    'home.projects': 'Projects',
    'home.units': '{n} apartments',
    'home.available': '{n} available',
    'home.units1': '1 apartment',
    'home.available1': '1 available',
    'home.cta': 'Tour the project',
    'home.emptyTitle': 'No projects to show yet',
    'home.emptyText': 'Projects on sale will appear here, each with a flight around the building and tours of its apartments.',
    'home.emptyCta': 'Try again',
    'home.ai': 'Visualization',
    'home.foot': 'Habait · tours of projects not built yet',
    'start.cta': 'Start the flight',
    'start.note': '360° · drag or turn your phone to look around',
    'start.fixture': 'Development view: the flight segments are placeholders (clay), not the final visualization',
    'hud.hint': 'Drag to look around',
    'hud.hintHold': 'Tap an apartment',
    'hud.toFacade': 'To the facade · choose an apartment',
    'hud.units': 'Apartments',
    'hud.gyro': 'Gyro',
    'units.title': 'Apartments',
    'unit.apt': 'Apartment',
    'unit.floor': 'Floor',
    'unit.rooms': 'Rooms',
    'unit.area': 'm²',
    'unit.outdoor': 'm² outdoor',
    'unit.type': 'Type',
    'unit.poa': 'Price on request',
    'unit.continue': 'Continue to the apartment',
    'unit.continueSold': 'Sold · view as example',
    'unit.openTour': '360° tour',
    'unit.whatsapp': 'WhatsApp',
    'unit.lead': 'Leave details',
    'unit.placeholder': 'The flight to this apartment is not rendered yet; the flight to 846 is shown as a placeholder.',
    'status.for-sale': 'For sale',
    'status.reserved': 'Reserved',
    'status.sold': 'Sold',
    'status.unknown': 'Unknown',
    'lead.name': 'Name',
    'lead.phone': 'Phone',
    'lead.consent': 'I agree to be contacted about this apartment',
    'lead.send': 'Send',
    'lead.sent': 'Thank you! We will be in touch shortly.',
    'lead.err': 'Sending failed; try again or use WhatsApp.',
    'lead.stub': 'Saved locally (no webhook configured).',
    'lead.whatsappText': 'Hi, I am interested in {project}, apartment {unit}.',
    'handoff.title': 'Welcome to apartment {unit}',
    'handoff.sub': 'The apartment 360° tour opens in its own player.',
    'handoff.cta': 'Enter the apartment',
    'handoff.back': 'Back to the facade',
    'end.title': 'End of the flight',
    'err.webgl': 'This browser has no WebGL; the flight cannot be shown.',
    'err.load': 'Could not load the project',
    'err.noProject': 'No project selected',
    'toast.gyroOn': 'Gyro on: turn your phone',
    'toast.gyroDenied': 'Motion sensors permission denied',
  },
};

let lang = null;

export function getLang() {
  if (lang) return lang;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
  if (saved === 'he' || saved === 'en') lang = saved;
  else {
    const q = new URLSearchParams(location.search).get('lang');
    lang = q === 'en' || q === 'he' ? q : 'he';
  }
  return lang;
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'he';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  return lang;
}

export function t(key, vars = {}) {
  const s = (STR[getLang()] && STR[getLang()][key]) || STR.en[key] || key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// pick a {he, en, ...} object
export function pick(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[getLang()] || obj.en || obj.he || Object.values(obj)[0] || '';
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
}

export function formatPrice(n, currency = 'ILS') {
  if (!n) return t('unit.poa');
  try {
    return new Intl.NumberFormat(getLang() === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}
