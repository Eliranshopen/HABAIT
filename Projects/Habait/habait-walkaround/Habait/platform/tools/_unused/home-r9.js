// The Rainbow landing page at the site root (plan development/plans/2026-11-08-rainbow-landing.md).
// - the hero film: starts only after the page has loaded (the poster is the LCP), 720p on small screens, poster only on Save-Data,
//   pauses off-screen, a pause/play button (WCAG 2.2.2); prefers-reduced-motion = no autoplay, the button plays it;
// - the route: «לסיור בפרויקט» is computed from project.json with the same helper as the old home card (js/target.js projectHref),
//   so it keeps the route of 1a54ce0: the hold with the orbit intro → the stop → every apartment marked → pick → enter;
// - the strings: this page's own he/en table (js/i18n.js untouched: getLang/setLang only).
import { loadProjects, loadProjectMeta } from './config.js';
import { getLang, setLang, pick } from './i18n.js';
import { capture } from './analytics.js';
import { DEV } from './dev.js';
import { projectHref, extUrl } from './target.js';

const PROJECT = 'rainbow';
const STR = {
  he: {
    skip: 'דילוג לתוכן', nav: 'ניווט', 'nav.experience': 'החוויה', 'nav.place': 'המיקום', 'nav.arch': 'האדריכלות', cue: 'להמשך',
    'hero.eyebrow': 'תל אביב · על קו הים', 'hero.promise': 'טסים סביב המגדל, ומשם ישר אל תוך הדירה. הכול בהדמיה.',
    'cta.tour': 'לסיור בפרויקט',
    'video.pause': 'השהיית הסרטון', 'video.play': 'הפעלת הסרטון',
    'statement': 'בין נמל תל אביב למרינה, מול הים הפתוח. את המגדל הזה כבר אפשר לראות מבפנים, בהדמיה.',
    'place.eyebrow': 'המיקום', 'place.title': 'בין הנמל למרינה', 'place.lead': 'מה מקיף את המגדל, כפי שמסומן בהדמיה:',
    'place.list': 'מקומות בסביבה', 'place.port': 'נמל תל אביב', 'place.reading': 'פארק רידינג', 'place.marina': 'המרינה', 'place.beach': 'חוף הים', 'place.kochav': 'כוכב הצפון',
    'arch.eyebrow': 'האדריכלות', 'arch.title': 'מרפסות כמו גלים',
    'cap.the2': 'המגדל בשעת ערב', 'cap.the3': 'מהרחוב', 'cap.the6': 'מבט על הגגות',
    'badge.render': 'הדמיה', 'finish.parquet': 'פרקט', 'finish.marble': 'שיש',
    'steps.eyebrow': 'החוויה', 'steps.title': 'מהשמיים, ישר לסלון', 'steps.lead': 'סיור אחד, ארבע עצירות.',
    'step1.title': 'טיסה סביב המגדל', 'step1.text': 'המגדל והסביבה מהאוויר, מכל הכיוונים.',
    'step2.title': 'עצירה מול החזית', 'step2.text': 'הטיסה נעצרת, וכל הדירות מסומנות על המגדל. בוחרים אחת.',
    'step3.title': 'בתוך הדירה', 'step3.text': 'סיור 360° בחדרים, עם תכנית ותלת־ממד.',
    'step4.title': 'פרקט או שיש?', 'step4.text': 'מחליפים ריצוף וגימורים, והדירה משתנה מול העיניים.',
    'close.title': 'הטיסה מתחילה כאן.',
    'foot.dev': 'יזם:', credit: 'הדמיה ואתר:', 'legal.more': 'לפרטים', 'legal.less': 'סגירה',
    'alt.the1': 'המגדל והבניין הנמוך לצידו מול הים, עם סימון נמל תל אביב, פארק רידינג, המרינה, חוף הים וכוכב הצפון',
    'alt.the2': 'המגדל בשעת ערב, מול הים', 'alt.the3': 'הבניינים הנמוכים מהרחוב, והמגדל מאחוריהם', 'alt.the6': 'מבט על הגגות',
    'hero.l1': 'גבוה מעל הים.',
    'hero.l2': 'עוד לפני שהוא קם.',
    title: 'Rainbow תל אביב · Habait',
  },
  en: {
    skip: 'Skip to content', nav: 'Navigation', 'nav.experience': 'Experience', 'nav.place': 'Location', 'nav.arch': 'Architecture', cue: 'Scroll on',
    'hero.eyebrow': 'Tel Aviv · on the seafront', 'hero.promise': 'Fly around the tower, then straight into the apartment. All of it a visualisation.',
    'cta.tour': 'Tour the project',
    'video.pause': 'Pause the film', 'video.play': 'Play the film',
    'statement': 'Between the Tel Aviv Port and the marina, facing the open sea. You can already see this tower from the inside, as a visualisation.',
    'place.eyebrow': 'Location', 'place.title': 'Between the port and the marina', 'place.lead': 'What surrounds the tower, as marked on the render:',
    'place.list': 'Places nearby', 'place.port': 'Tel Aviv Port', 'place.reading': 'Reading Park', 'place.marina': 'The marina', 'place.beach': 'The beach', 'place.kochav': 'Kochav HaTsafon',
    'arch.eyebrow': 'Architecture', 'arch.title': 'Balconies like waves',
    'cap.the2': 'The tower at dusk', 'cap.the3': 'From the street', 'cap.the6': 'Over the rooftops',
    'badge.render': 'Render', 'finish.parquet': 'Parquet', 'finish.marble': 'Marble',
    'steps.eyebrow': 'The experience', 'steps.title': 'From the sky, straight to the living room', 'steps.lead': 'One tour, four stops.',
    'step1.title': 'Fly around the tower', 'step1.text': 'The tower and its surroundings from the air, from every side.',
    'step2.title': 'A stop at the facade', 'step2.text': 'The flight stops and every apartment is marked on the tower. Pick one.',
    'step3.title': 'Inside the apartment', 'step3.text': 'A 360° walk through the rooms, with the plan and a 3D view.',
    'step4.title': 'Parquet or marble?', 'step4.text': 'Swap floors and finishes and watch the apartment change.',
    'close.title': 'The flight starts here.',
    'foot.dev': 'Developer:', credit: 'Visualization & site by', 'legal.more': 'Details', 'legal.less': 'Close',
    'alt.the1': 'The tower and the low building beside it facing the sea, with Tel Aviv Port, Reading Park, the marina, the beach and Kochav HaTsafon marked',
    'alt.the2': 'The tower at dusk, facing the sea', 'alt.the3': 'The low buildings from the street, the tower behind them', 'alt.the6': 'Over the rooftops',
    'hero.l1': 'High above the sea.',
    'hero.l2': 'Before it rises.',
    title: 'Rainbow Tel Aviv · Habait',
  },
};
const s = (k) => (STR[getLang()] || STR.he)[k] ?? STR.he[k] ?? k;
const $ = (id) => document.getElementById(id);

// ---------- strings ----------
let meta = null;
function render() {
  // an element js/landing-motion.js has split into words keeps its split while its text is unchanged (data-split-text)
  document.querySelectorAll('[data-t]').forEach((el) => { const v = s(el.dataset.t); if (el.dataset.splitText === v && el.querySelector('.rl-line, .rl-word-u')) return; el.textContent = v; });
  document.querySelectorAll('[data-t-alt]').forEach((el) => { el.alt = s(el.dataset.tAlt); });
  document.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', s(el.dataset.tAria)); });
  document.title = s('title');
  // the brand (round 9): the Hebrew tagline «הבית של כל הבתים» only in Hebrew; EN shows the wordmark (no vector «HOME IS HABAIT» exists)
  document.querySelectorAll('[data-logo-he]').forEach((img) => { const he = getLang() === 'he'; img.src = he ? img.dataset.logoHe : img.dataset.logoEn; img.alt = he ? img.dataset.altHe : img.dataset.altEn; });
  const toggle = $('langToggle');
  toggle.textContent = getLang() === 'he' ? 'EN' : 'עב';
  toggle.setAttribute('aria-label', getLang() === 'he' ? 'English' : 'עברית');
  syncToggle();
  if (meta) {
    // the developer's name (project.json `developer`, text only): the hero line and the footer; hidden when the project has none
    const dev = pick(meta.developer) || '';
    document.querySelectorAll('[data-dev-name]').forEach((el) => { el.textContent = dev; });
    document.querySelectorAll('[data-dev-row]').forEach((el) => { el.hidden = !dev; });
    const full = pick(meta.disclaimer) || '';
    $('legalLine').textContent = full.split(/(?<=\.)\s/)[0] || full;   // its own first sentence
    $('legalFull').textContent = full;
    $('legal').hidden = !full;
  }
  document.dispatchEvent(new CustomEvent('rl:rendered'));   // js/landing-motion.js re-splits the words it animates
}

// ---------- routes (project.json → the same hrefs as the old home card) ----------
function setRoutes(p) {
  const ext = p.meta.exterior || {};
  const here = new URL('./', location.href).toString();
  const tourBase = ext.params && ext.params.tour ? new URL(ext.params.tour, location.href) : null;
  const routes = {
    'tour-project': projectHref(p),
    hold: ext.url ? extUrl(p, ext) : projectHref(p),
  };
  document.querySelectorAll('[data-route]').forEach((a) => {
    const r = a.dataset.route;
    if (routes[r]) a.href = routes[r];
    else if (r === 'tour-room' && tourBase) {
      const u = new URL(tourBase);
      u.searchParams.set('room', a.dataset.room || 'living');
      u.searchParams.delete('video');
      u.searchParams.set('return', here);
      u.searchParams.set('from', 'landing');
      a.href = u.toString();
    }
    a.addEventListener('click', () => capture('project_open', { project: p.id, from: `landing-${a.id || r}` }));
  });
}

// ---------- the hero film ----------
const hero = $('hero');
const video = $('heroVideo');
const btn = $('heroToggle');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = Boolean(navigator.connection && navigator.connection.saveData);
let userPaused = false;   // the visitor's choice wins over autoplay and the off-screen resume
let inView = true;
function syncToggle() {
  const playing = !video.paused && !video.ended && video.currentSrc;
  btn.dataset.state = playing ? 'playing' : 'paused';
  btn.setAttribute('aria-label', s(playing ? 'video.pause' : 'video.play'));
}
function pickSrc() {
  // portrait screens (phones): the 2:3 crop around the tower; small landscape screens: 720p; the rest: 1080p
  if (innerWidth / innerHeight <= 0.8) return video.getAttribute('data-src-portrait');
  const w = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio || 1, 2);
  return video.getAttribute(innerWidth <= 900 || w <= 1400 ? 'data-src-720' : 'data-src-1080');
}
function load() {
  if (video.getAttribute('src')) return;
  video.src = pickSrc();
  video.load();
}
async function play() {
  load();
  try { await video.play(); } catch (e) { /* autoplay refused: the button stays on «play» */ }
  syncToggle();
}
video.addEventListener('playing', () => { hero.classList.add('is-playing'); syncToggle(); });
video.addEventListener('pause', syncToggle);
video.addEventListener('error', () => { hero.classList.remove('is-playing'); syncToggle(); });   // the poster stays: the page never goes black
btn.addEventListener('click', () => {
  if (video.paused) { userPaused = false; play(); }
  else { userPaused = true; video.pause(); }
});
new IntersectionObserver((es) => {
  inView = es[0].isIntersecting;
  $('top').classList.toggle('is-solid', es[0].intersectionRatio < 0.12);
  if (!inView && !video.paused) video.pause();
  else if (inView && video.paused && video.getAttribute('src') && !userPaused && !reduce.matches) play();
}, { threshold: [0, 0.12] }).observe(hero);
function autostart() {
  if (reduce.matches || saveData) { syncToggle(); return; }
  play();
}
if (document.readyState === 'complete') autostart(); else addEventListener('load', autostart, { once: true });

// ---------- the bottom bar (round 9): the one action, shown once the hero has gone and hidden again at the closing screen / footer ----------
{
  const bar = $('bar');
  const seen = new Map();
  const sync = () => { const on = seen.get('hero') === false && !seen.get('close') && !seen.get('foot'); bar.classList.toggle('is-on', on); };
  const io = new IntersectionObserver((es) => { for (const e of es) seen.set(e.target.dataset.barKey, e.isIntersecting); sync(); }, { threshold: 0 });
  for (const [key, el] of [['hero', hero], ['close', document.querySelector('[data-close]')], ['foot', document.querySelector('.rl-foot')]]) { if (el) { el.dataset.barKey = key; io.observe(el); } }
}

// ---------- boot ----------
$('langToggle').addEventListener('click', () => { setLang(getLang() === 'he' ? 'en' : 'he'); render(); });
if (DEV) { $('devFoot').hidden = false; $('a11ySlot').innerHTML = '<span class="home-todo">TODO (dev only): accessibility-statement link — text and target are Eliran\'s (§6)</span>'; }
setLang(getLang());
render();
try {
  const entry = (await loadProjects()).find((x) => x.id === PROJECT);
  if (entry) { meta = await loadProjectMeta(entry.dir); setRoutes({ ...entry, meta }); render(); }
} catch (e) { console.warn('landing: project.json not loaded; the in-page fallbacks stay', e); }
window.__rl = { video, routes: () => [...document.querySelectorAll('[data-route]')].map((a) => ({ id: a.id, href: a.href })) };
