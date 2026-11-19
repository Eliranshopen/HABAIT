// studio.js — the RAINBOW baseline features (root CLAUDE.md §8.10, checklist docs/rainbow-baseline-features.md) for the
// real-time walk. RAINBOW makes its swaps and typed changes with paid image generation; here the 3D model itself changes,
// so every change is instant, exact and costs $0 (Eliran 2026-11-17: no generation without his pictures).
//  · circles on furniture and accessories → pick sheet: finishes / other models / remove (RAINBOW: markers + catalog)
//  · free-text design line, read locally (Hebrew + English): target + colour/material; structure changes refused
//  · undo · show original · reset · list of my changes · prepared examples · floor / walls / kitchen / counter sets
//  · measure · 3D dollhouse · zoom · slow turn · reset view · full screen · hide controls · he/en · share link · coach
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// ---------------------------------------------------------------- catalog ($0: finishes of the same model, CC0 models)
const FAB = [
  ['charcoal', 'אפור כהה', 'Charcoal', '#4b4b4d'], ['lightgrey', 'אפור בהיר', 'Light grey', '#b3b1ac'], ['beige', 'בז׳', 'Beige', '#cbb79c'],
  ['cream', 'שמנת', 'Cream', '#ebe4d6'], ['olive', 'ירוק זית', 'Olive', '#6d7147'], ['navy', 'כחול נייבי', 'Navy', '#2e3c58'],
  ['terracotta', 'טרקוטה', 'Terracotta', '#b2623f'], ['mustard', 'חרדל', 'Mustard', '#c69c3c'], ['dustypink', 'ורוד עתיק', 'Dusty pink', '#c39d96'],
].map(([k, he, en, c]) => ({ k, he, en, sw: c, look: { color: c } }));
const WOOD = [
  { k: 'oak', he: 'אלון טבעי', en: 'Natural oak', sw: '#b98f62', look: { tex: 'oak', color: null, rough: 0.6 } },
  { k: 'walnut', he: 'אגוז', en: 'Walnut', sw: '#6e4a30', look: { tex: 'oak', color: '#6e4a30', rough: 0.55 } },
  { k: 'darkwood', he: 'עץ כהה', en: 'Dark wood', sw: '#3e2a1e', look: { tex: 'oak', color: '#3e2a1e', rough: 0.5 } },
  { k: 'white', he: 'לבן מט', en: 'Matte white', sw: '#ece8e1', look: { tex: null, color: '#ece8e1', rough: 0.6 } },
  { k: 'black', he: 'שחור מט', en: 'Matte black', sw: '#1e1e1e', look: { tex: null, color: '#1e1e1e', rough: 0.5 } },
  { k: 'marble', he: 'שיש', en: 'Marble', sw: '#e9e6e1', look: { tex: 'quartz', color: null, rough: 0.2 } },
];
// slatted oak keeps its slats: a finish only tints it
const WOOD_SLAT = WOOD.filter((w) => w.k !== 'marble').map((w) => ({ ...w, look: { color: w.look.color, rough: w.look.rough } }));
const SURF = {
  floor: { he: 'ריצוף', en: 'Flooring', mats: ['tile80', 'parquet'], opts: [
    { k: 'porcelain', he: 'שיש אפור בהיר', en: 'Light grey marble', sw: '#d6d6d5', look: { tex: 'tile80', color: null, rough: 0.1 } },
    { k: 'parquet', he: 'פרקט', en: 'Parquet', sw: '#a9784c', look: { tex: 'parquet', color: null, rough: 0.55 } },
    { k: 'concrete', he: 'בטון', en: 'Concrete', sw: '#9a9894', look: { tex: 'parapet', color: '#9a9894', rough: 0.8 } },
    { k: 'marble', he: 'שיש', en: 'Marble', sw: '#ece9e4', look: { tex: 'quartz', color: null, rough: 0.15 } },
    { k: 'darkporcelain', he: 'פורצלן כהה', en: 'Dark porcelain', sw: '#6d6a66', look: { tex: 'tile80', color: '#6d6a66', rough: 0.35 } }] },
  walls: { he: 'קירות', en: 'Walls', mats: ['wall'], opts: [
    { k: 'white', he: 'לבן', en: 'White', sw: '#f1efea', look: { color: null } },
    { k: 'warmgrey', he: 'אפור חם', en: 'Warm grey', sw: '#cfc9c0', look: { color: '#cfc9c0' } },
    { k: 'beige', he: 'בז׳', en: 'Beige', sw: '#dccbb0', look: { color: '#dccbb0' } },
    { k: 'sage', he: 'ירוק מרווה', en: 'Sage', sw: '#a9b59b', look: { color: '#a9b59b' } },
    { k: 'bluegrey', he: 'כחול אפרפר', en: 'Blue grey', sw: '#9fafbd', look: { color: '#9fafbd' } },
    { k: 'terracotta', he: 'טרקוטה', en: 'Terracotta', sw: '#c7896b', look: { color: '#c7896b' } }] },
  kitchen: { he: 'חזיתות המטבח', en: 'Kitchen fronts', mats: ['front'], opts: [
    { k: 'greige', he: 'לבן חלק', en: 'Plain white', sw: '#f0f0ee', look: { tex: null, color: null } },
    ...WOOD.filter((w) => w.k !== 'marble'),
    { k: 'olive', he: 'ירוק זית', en: 'Olive', sw: '#5e6444', look: { tex: null, color: '#5e6444', rough: 0.5 } },
    { k: 'navy', he: 'כחול נייבי', en: 'Navy', sw: '#2b3a52', look: { tex: null, color: '#2b3a52', rough: 0.5 } }] },
  counter: { he: 'משטח המטבח', en: 'Countertop', mats: ['quartz'], opts: [
    { k: 'quartz', he: 'קוורץ בהיר', en: 'Light quartz', sw: '#e6e3dd', look: { tex: 'quartz', color: null, rough: 0.18 } },
    { k: 'concrete', he: 'בטון', en: 'Concrete', sw: '#8f8d89', look: { tex: 'parapet', color: '#8f8d89', rough: 0.7 } },
    { k: 'oak', he: 'עץ אלון', en: 'Oak', sw: '#b98f62', look: { tex: 'oak', color: null, rough: 0.5 } },
    { k: 'black', he: 'שחור', en: 'Black', sw: '#202020', look: { tex: 'quartz', color: '#262626', rough: 0.25 } }] },
};
const KIND = {   // which materials of a piece a finish changes, and which list it offers
  sofa: { parts: ['sofa'], opts: FAB, he: 'הספה', en: 'the sofa', models: [['Sofa_01', 'ספה קלאסית', 'Classic sofa'], ['sofa_02', 'ספה מודרנית', 'Modern sofa'], ['sofa_03', 'ספה רכה', 'Soft sofa']] },
  rug: { parts: ['rug'], opts: FAB, he: 'השטיח', en: 'the rug' },
  round_table: { parts: ['oak'], opts: WOOD, he: 'שולחן הקפה', en: 'the coffee table', models: [['coffee_table_round_01', 'שולחן עגול', 'Round table'], ['modern_coffee_table_01', 'שולחן מודרני', 'Modern table'], ['modern_coffee_table_02', 'שולחן זכוכית', 'Glass table']] },
  dining_table: { parts: ['oak'], opts: WOOD, he: 'שולחן האוכל', en: 'the dining table', models: [['dining_table', 'שולחן עץ', 'Wooden table'], ['gallinera_table', 'שולחן כפרי', 'Farmhouse table'], ['round_wooden_table_01', 'שולחן עגול', 'Round table']] },
  dining_chair: { parts: ['chair'], opts: FAB, he: 'הכיסאות', en: 'the chairs', models: [['dining_chair_02', 'כיסא מרופד', 'Upholstered chair'], ['gallinera_chair', 'כיסא קש', 'Rush chair'], ['painted_wooden_chair_02', 'כיסא עץ', 'Wooden chair']] },
  wardrobe: { parts: ['oak_slat'], opts: WOOD_SLAT, he: 'הארון', en: 'the wardrobe' },
  bed_double: { parts: ['sofa', 'linen_grey'], opts: FAB, he: 'המיטה', en: 'the bed' },
  bed_single: { parts: ['sofa', 'linen_grey'], opts: FAB, he: 'המיטות', en: 'the beds' },
  nightstand: { parts: ['oak_slat', 'oak'], opts: WOOD_SLAT, he: 'השידות', en: 'the bedside tables', models: [['ClassicNightstand_01', 'שידה קלאסית', 'Classic'], ['painted_wooden_nightstand', 'שידה צבועה', 'Painted'], ['side_table_01', 'שולחן צד', 'Side table']] },
  outdoor_chair: { parts: ['linen_white'], opts: FAB, he: 'כיסאות המרפסת', en: 'the balcony chairs' },
};
const MODELS = {
  plant: [['hy_plant_pachira', 'דקל בעציץ לבן', 'Palm in white pot'], ['hy_planter_agave', 'אגבה בעציץ שחור', 'Agave in black planter'], ['pachira_aquatica_01', 'עץ כסף', 'Money tree'], ['potted_plant_02', 'צמח שולחני', 'Table plant'], ['potted_plant_04', 'צמח בעציץ', 'Potted plant'], ['potted_plant_01', 'צמח גדול', 'Large plant'], ['planter_pot_clay', 'עציץ חרס', 'Clay pot']],
  decor: [['ceramic_vase_01', 'אגרטל קרמיקה', 'Ceramic vase'], ['ceramic_vase_03', 'כד קרמיקה', 'Ceramic jug'], ['ceramic_vase_02', 'אגרטל לבן', 'White vase'], ['ceramic_vase_04', 'אגרטל גבוה', 'Tall vase'], ['brass_vase_03', 'אגרטל נחושת', 'Brass vase'], ['wooden_bowl_01', 'קערת עץ', 'Wooden bowl']],
  lamp_table: [['hy_mushroom_lamp', 'מנורת פטרייה', 'Mushroom lamp'], ['ceramic_vase_02', 'אגרטל לבן', 'White vase'], ['potted_plant_02', 'צמח קטן', 'Small plant']],
  lamp: [['modern_ceiling_lamp_01', 'מנורה מודרנית', 'Modern pendant'], ['hanging_industrial_lamp', 'מנורה תעשייתית', 'Industrial pendant']],
};
const ACC_NAME = { lamp_table: ['המנורה', 'the lamp'], plant: ['הצמח', 'the plant'], decor: ['האביזר', 'the accessory'], lamp: ['המנורה', 'the lamp'] };
const TEX_REP = { oak: 0.9, quartz: 0.5, parquet: 0.55, parapet: 0.5, tile80: 1 / 2.4, tile60: 1 / 1.2, wall: 0.5 };
const HAS_N = new Set(['oak', 'parquet', 'tile80', 'tile60', 'wall', 'sofa', 'boucle', 'deck']);
const PRESETS = [
  { he: 'סקנדינבי בהיר', en: 'Light Scandi', ops: [['surf:floor', 'parquet'], ['surf:walls', 'white'], ['surf:kitchen', 'white'], ['surf:counter', 'oak'], ['kind:sofa', 'lightgrey'], ['kind:dining_table', 'oak'], ['kind:dining_chair', 'cream'], ['kind:rug', 'cream']] },
  { he: 'כהה ואלגנטי', en: 'Dark and elegant', ops: [['surf:floor', 'darkporcelain'], ['surf:walls', 'warmgrey'], ['surf:kitchen', 'black'], ['surf:counter', 'quartz'], ['kind:sofa', 'navy'], ['kind:dining_table', 'darkwood'], ['kind:dining_chair', 'charcoal'], ['kind:rug', 'charcoal']] },
  { he: 'חם וטבעי', en: 'Warm and natural', ops: [['surf:floor', 'concrete'], ['surf:walls', 'beige'], ['surf:kitchen', 'olive'], ['surf:counter', 'concrete'], ['kind:sofa', 'terracotta'], ['kind:dining_table', 'walnut'], ['kind:dining_chair', 'olive'], ['kind:rug', 'mustard']] },
];

// ---------------------------------------------------------------- copy (he first, en second)
const T = {
  he: { design: 'שינוי עיצוב', tools: 'כלים', apply: 'החלה', ph: 'תארו שינוי, למשל: ספה אפורה כהה וקירות בירוק מרווה', undo: 'ביטול השינוי האחרון',
    orig: 'הצגת המקור', mine: 'הצגת השינויים', reset: 'איפוס השינויים', presets: 'דוגמאות מוכנות', yours: 'השינויים שלכם', none: 'עוד לא שיניתם דבר.',
    tag: 'שינוי שלכם', close: 'סגירה', remove: 'הסרת הפריט', restore: 'החזרת הפריט', pick: (t) => `בחרו דגם או גימור ל${t}`, pickM: (t) => `בחרו במקום ${t}`,
    card: 'פריט לדוגמה להמחשה · לא מוצר למכירה. הצבעים על המסך משוערים.', ringHint: 'לחצו על עיגול כדי להחליף רהיט או אביזר',
    measure: 'מדידה', mHint: 'לחצו על שתי נקודות כדי למדוד', mNote: 'מידה מהמודל, לא תחליף למדידה בשטח', m: 'מ׳', doll: 'תלת-ממד', walk: 'חזרה להליכה',
    zin: 'הגדלה', zout: 'הקטנה', spin: 'סיבוב איטי', resetv: 'איפוס תצוגה', full: 'מסך מלא', hide: 'הסתרת הכפתורים', show: 'הצגת הכפתורים',
    lang: 'EN', share: 'שיתוף קישור', copied: 'הקישור הועתק', coach: 'הסבר על הכפתורים', skip: 'דלג', next: 'הבא', done: 'סיום',
    applied: (s) => `הוחל: ${s}`, all: 'בכל הדירה', refScope: 'שינויי מבנה (קירות, חלונות, גודל חדר) לא אפשריים בהדמיה — רק ריהוט, צבעים וחומרים.',
    refAdd: 'הוספת פריטים חדשים עוד לא אפשרית כאן — אפשר להחליף צבע, חומר או דגם של מה שקיים.', unclear: 'לא הצלחנו להבין. נסו למשל: "ספה בז׳", "רצפת פרקט", "קירות אפור חם".',
    origPiece: 'כמו בתמונות', dayTime: 'שעה ביום', walkMode: 'הליכה בדירה', planMode: 'תוכנית הדירה', views: 'סגנונות צפייה', helpers: 'כלי עזר', area: 'שטח החדר', sqm: 'מ״ר', prev: 'החדר הקודם',
    sub: 'דירה 3 · קומה 1 · בניין 10 · אבני חפץ קדם (הדמיה)', foot: 'מודל תלת־ממדי לפי תכנית המכר · לא צילום של הנכס', by: 'הדמיה מאת:',
    hintPhone: 'גררו כדי להסתכל · הקישו על הרצפה כדי ללכת לשם<small>לחצו על עיגול כדי להחליף רהיט או אביזר</small>',
    hintDesk: '↑ ↓ הליכה · ← → פנייה · גרירה: הסתכלות · לחיצה על הרצפה: הליכה<small>לחיצה על עיגול: החלפת רהיט או אביזר · לחיצה על שם חדר: הליכה אליו</small>',
    c1: 'עיגול על רהיט או אביזר: לחיצה מציעה גימור או דגם אחר, או הסרה.', c2: 'שינוי עיצוב: הקלדת שינוי חופשי, דוגמאות מוכנות, ריצוף, קירות ומטבח; ביטול, הצגת המקור ואיפוס.',
    c3: 'סגנונות צפייה: הליכה, תלת-ממד מלמעלה, תוכנית הדירה.', c4: 'כלי עזר: מדידה, שיתוף קישור, הסתרת הכפתורים.', c5: 'הגדלה, הקטנה, סיבוב איטי, איפוס תצוגה ומסך מלא.',
    c7: 'שעה ביום: גררו את השעון או לחצו ▶ כדי לראות את הדירה בבוקר, בצהריים, בשקיעה ובלילה.',
    c6: 'החדרים: לחיצה הולכת לחדר דרך הדלתות. אפשר גם ללחוץ על שם חדר שעל הרצפה.',
    noTarget: 'לא מצאנו את הפריט הזה בדירה.', badge: 'הדמיה', note: 'הדמיה ממודל תלת־ממדי לפי תכנית המכר. הריהוט והגימור להמחשה בלבד. גובה תקרה, אדני חלונות והנוף — הנחה.' },
  en: { design: 'Change design', tools: 'Tools', apply: 'Apply', ph: 'Describe a change, e.g. dark grey sofa and sage walls', undo: 'Undo last change',
    orig: 'Show original', mine: 'Show my changes', reset: 'Reset changes', presets: 'Ready-made looks', yours: 'Your changes', none: 'No changes yet.',
    tag: 'Your change', close: 'Close', remove: 'Remove item', restore: 'Bring item back', pick: (t) => `Choose a model or finish for ${t}`, pickM: (t) => `Choose instead of ${t}`,
    card: 'Example item for illustration · not a product for sale. On-screen colours are approximate.', ringHint: 'Tap a circle to swap furniture or accessories',
    measure: 'Measure', mHint: 'Tap two points to measure', mNote: 'Measured on the model — not a substitute for on-site measuring', m: 'm', doll: '3D', walk: 'Back to walking',
    zin: 'Zoom in', zout: 'Zoom out', spin: 'Slow turn', resetv: 'Reset view', full: 'Full screen', hide: 'Hide controls', show: 'Show controls',
    lang: 'עב', share: 'Share link', copied: 'Link copied', coach: 'Button guide', skip: 'Skip', next: 'Next', done: 'Done',
    applied: (s) => `Applied: ${s}`, all: 'throughout', refScope: 'Structural changes (walls, windows, room size) are not possible in the visualization — furniture, colours and materials only.',
    refAdd: 'Adding new items is not available yet — you can change the colour, material or model of what is there.', unclear: 'We could not understand that. Try e.g. "beige sofa", "parquet floor", "warm grey walls".',
    origPiece: 'As in the pictures', dayTime: 'Time of day', walkMode: 'Walk', planMode: 'Floor plan', views: 'Views', helpers: 'Tools', area: 'Room area', sqm: 'm²', prev: 'Previous room',
    sub: 'Apt 3 · Floor 1 · Building 10 · Avnei Hefetz Kedem (visualization)', foot: '3D model built from the sales plan · not a photo of the property', by: 'Visualization by',
    hintPhone: 'Drag to look · tap the floor to walk there<small>tap a circle to swap furniture or accessories</small>',
    hintDesk: '↑ ↓ walk · ← → turn · drag: look · click the floor: walk<small>click a circle: swap an item · click a room name: walk there</small>',
    c1: 'A circle on furniture or an accessory: tap it for another finish or model, or to remove it.', c2: 'Change design: type a change, ready-made looks, floor, walls and kitchen; undo, show original, reset.',
    c3: 'Views: walk, 3D from above, floor plan.', c4: 'Tools: measure, share link, hide controls.', c5: 'Zoom in, zoom out, slow turn, reset view and full screen.',
    c7: 'Time of day: drag the clock or press ▶ to see the apartment in the morning, at noon, at sunset and at night.',
    c6: 'Rooms: tap to walk there through the doors. You can also tap a room name on the floor.',
    noTarget: 'That item is not in this apartment.', badge: 'Visualization', note: '3D visualization built from the sales plan. Furniture and finishes are illustrative. Ceiling height, sills and the view are assumed.' },
};
const ROOM_EN = { living: 'Living & dining', kitchen: 'Kitchen', entrance: 'Entrance', lobby: 'Hall', corridor: 'Corridor', parents: 'Main bedroom',
  parentsbath: 'En-suite bathroom', mamad: 'Safe room', bath: 'Bathroom', bedA: 'Bedroom 2', bedB: 'Bedroom 3', wc: 'Guest WC', balcony: 'Balcony' };

// ---------------------------------------------------------------- texture helpers
const TL = new THREE.TextureLoader(), texCache = new Map(), avgCache = new WeakMap();
const loadTex = (name, srgb = true) => {
  const key = name + (srgb ? '' : '#l');
  if (!texCache.has(key)) texCache.set(key, TL.loadAsync(`./tex/${name}.jpg`).then((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }));
  return texCache.get(key);
};
const imgReady = (t) => new Promise((res) => { const go = () => (t.image && t.image.width ? res() : setTimeout(go, 80)); go(); });
async function avgOf(t) {   // the texture's mean colour (linear), so a tint lands on the colour asked for
  await imgReady(t); const img = t.image;
  if (avgCache.has(img)) return avgCache.get(img);
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data; const sum = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { const col = new THREE.Color().setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); sum[0] += col.r; sum[1] += col.g; sum[2] += col.b; }
  const n = d.length / 4, a = new THREE.Color(sum[0] / n, sum[1] / n, sum[2] / n); avgCache.set(img, a); return a;
}

export async function initStudio(ctx) {
  const { scene, camera, renderer, G, me, roomAt, flyTo, phone, MAT, ITEMS, ACCS, placeModel, CAMS } = ctx; const placeItemModel = ctx.placeItemModel;
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') === 'en' ? 'en' : 'he';
  const L = () => T[lang];
  const nm = (o) => (lang === 'en' ? o.en : o.he);
  const S = { mode: 'walk', ops: [], showOrig: false, spin: false, fov0: camera.fov, busy: Promise.resolve() };

  // ---------- targets: the swappable pieces, grouped as a visitor names them (all six chairs = "the chairs")
  const targets = [];
  const byKind = {};
  for (const it of ITEMS) { if (!KIND[it.f.kind]) continue; (byKind[it.f.kind] ||= []).push(it); }
  const groupKey = (it) => (['dining_chair', 'bed_single', 'nightstand', 'outdoor_chair'].includes(it.f.kind) ? `${it.f.kind}@${it.f.room}` : it.f.id);
  const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
  for (const it of ITEMS) if (it.f.kind === 'nightstand' && !it.f.front) { const bed = G.furniture.find((q) => q.room === it.f.room && q.head); if (bed) it.f._front = OPP[bed.head]; }
  const tmap = new Map();
  for (const it of ITEMS) {
    if (!KIND[it.f.kind]) continue; const k = groupKey(it);
    if (!tmap.has(k)) { const t = { key: 'item:' + k, kind: it.f.kind, room: it.f.room, items: [], def: KIND[it.f.kind] }; tmap.set(k, t); targets.push(t); }
    tmap.get(k).items.push(it);
  }
  if (tmap.has('sofa-N') && tmap.has('sofa-E')) { tmap.get('sofa-N').items.push(...tmap.get('sofa-E').items); targets.splice(targets.indexOf(tmap.get('sofa-E')), 1); }
  for (const a of ACCS) targets.push({ key: 'acc:' + a.id, kind: a.kind, room: a.room, acc: a });
  // ring anchors: the top of the piece (the middle one of a group), a wardrobe at chest height
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const t of targets) {
    if (t.acc) { box.setFromObject(t.acc.group); t.anchor = box.getCenter(new THREE.Vector3()); t.anchor.y = t.acc.hang ? box.min.y - 0.08 : box.max.y + 0.1; continue; }
    const g = t.items[Math.floor((t.items.length - 1) / 2)].group; box.setFromObject(g); t.anchor = box.getCenter(new THREE.Vector3());
    t.anchor.y = t.kind === 'wardrobe' ? 1.3 : box.max.y + 0.1;
  }
  const label = (t) => (t.acc ? ACC_NAME[t.kind][lang === 'en' ? 1 : 0] : nm(t.def));

  // ---------- applying changes: every op replays on the originals, so undo / original / share are exact
  const ORIG = new Map();   // material -> its first state
  const remember = (m) => { if (!ORIG.has(m)) ORIG.set(m, { map: m.map, normalMap: m.normalMap, color: m.color.clone(), roughness: m.roughness }); };
  function restoreAll() {
    for (const [m, o] of ORIG) { m.map = o.map; m.normalMap = o.normalMap; m.color.copy(o.color); m.roughness = o.roughness; m.needsUpdate = true; }
    for (const t of targets) if (t.items) for (const it of t.items) { it.group.visible = true; if (it.alt || it.defaultModel) placeItemModel(scene, it, null); }
  }
  async function lookOn(m, look) {
    remember(m); const o = ORIG.get(m), rep = m.userData.rep || 1;
    if (look.tex === undefined) { m.map = o.map; m.normalMap = o.normalMap; }
    else if (look.tex === null) { m.map = null; m.normalMap = null; }
    else {
      const t = (await loadTex(look.tex)).clone(); t.needsUpdate = true; const r = (TEX_REP[look.tex] || rep) / rep; t.repeat.set(r, r); m.map = t;
      if (HAS_N.has(look.tex)) { const n = (await loadTex(look.tex + '_n', false)).clone(); n.needsUpdate = true; n.repeat.set(r, r); m.normalMap = n; } else m.normalMap = null;
    }
    if (look.color) {
      const want = new THREE.Color(look.color);
      if (m.map) { const a = await avgOf(m.map); m.color.setRGB(Math.min(4, want.r / Math.max(a.r, 1e-3)), Math.min(4, want.g / Math.max(a.g, 1e-3)), Math.min(4, want.b / Math.max(a.b, 1e-3))); }
      else m.color.copy(want);
    } else if (look.tex) m.color.setRGB(1, 1, 1);   // a new texture shows its own colour
    else m.color.copy(o.color);                       // kept texture or plain: the original colour
    if (look.rough != null) m.roughness = look.rough; else m.roughness = o.roughness;
    m.needsUpdate = true;
  }
  const findT = (key) => targets.find((t) => t.key === key);
  const kindTargets = (kind) => targets.filter((t) => t.kind === kind && !t.acc);
  function optOf(sel, k) {
    if (sel.startsWith('surf:')) return SURF[sel.slice(5)].opts.find((o) => o.k === k);
    const kind = sel.startsWith('kind:') ? sel.slice(5) : findT(sel)?.kind; return KIND[kind] && KIND[kind].opts.find((o) => o.k === k);
  }
  async function applyOp(op) {
    if (op.sel.startsWith('acc:')) { const a = findT(op.sel).acc; if (op.hide) { a.group.visible = false; return; } await placeModel(scene, a, op.model); a.group.visible = true; return; }
    const look = op.look || optOf(op.sel, op.k)?.look;
    if (op.sel.startsWith('surf:')) { for (const n of SURF[op.sel.slice(5)].mats) if (MAT[n]) await lookOn(MAT[n], look); return; }
    const ts = op.sel.startsWith('kind:') ? kindTargets(op.sel.slice(5)) : [findT(op.sel)].filter(Boolean);
    for (const t of ts) for (const it of t.items) {
      if (op.hide) { it.group.visible = false; if (it.alt) it.alt.visible = false; continue; }
      if (op.model !== undefined) { await placeItemModel(scene, it, op.model); continue; }
      if (it.alt) await placeItemModel(scene, it, 'built');   // a finish belongs to the drawn piece (the picture model has its own look)
      for (const p of t.def.parts) { const m = it.group.mats[p]; if (m) await lookOn(m, look); }
    }
  }
  async function replay() {
    restoreAll();
    for (const a of ACCS) if (a.current !== a.base || !a.group.visible) { await placeModel(scene, a, a.base); a.group.visible = true; }
    if (!S.showOrig) for (const op of S.ops) await applyOp(op);
    refresh();
  }
  const run = (fn) => (S.busy = S.busy.then(fn).catch((e) => console.error(e)));
  function push(op) { S.ops.push(op); S.showOrig = false; return run(async () => { await applyOp(op); refresh(); }); }
  const opText = (op) => {
    const what = op.sel.startsWith('surf:') ? nm(SURF[op.sel.slice(5)]) : op.sel.startsWith('kind:') ? nm(KIND[op.sel.slice(5)]) : label(findT(op.sel));
    const ml = (t) => (t.acc ? MODELS[t.kind] : [[null, 'כמו בתמונות', 'As in the pictures'], ...(t.def.models || [])]);
    const how = op.hide ? L().remove : op.model !== undefined && findT(op.sel) ? (ml(findT(op.sel)).find((m) => m[0] === op.model) || [, op.model, op.model])[lang === 'en' ? 2 : 1]
      : op.k ? nm(optOf(op.sel, op.k)) : op.name ? op.name : '';
    return `${what} ← ${how}`;
  };

  // ---------------------------------------------------------------- icons (stroke, 24 grid)
  const I = {
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    car: '<path d="M6 9l6 6 6-6"/>', help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8"/><circle cx="12" cy="17.3" r=".6"/>',
    globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3.2 3 15.8 0 19M12 2.5c-3 3.2-3 15.8 0 19"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', spin: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
    centre: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    prev: '<path d="M9 6l6 6-6 6"/>', next: '<path d="M15 6l-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M9 11l3-3 3 2 2 3M12 8l-1 5"/>', cube: '<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/>',
    plan: '<path d="M3 4h18v16H3z"/><path d="M3 11h8V4M11 15v5M15 11h6"/>', ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    hide: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/>',
  };
  const svg = (k, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

  // ---------------------------------------------------------------- swatch pictures from the real textures ($0)
  const FABRIC_BASE = 'linen_white';
  function swStyle(o, fabric) {
    const l = o.look || {};
    if (l.tex) return l.color ? `background:url(tex/${l.tex}.jpg) center/220% ${l.color}; background-blend-mode:multiply` : `background:url(tex/${l.tex}.jpg) center/220%`;
    if (l.tex === undefined && fabric && l.color) return `background:url(tex/${FABRIC_BASE}.jpg) center/260% ${l.color}; background-blend-mode:multiply`;
    if (l.tex === undefined && !l.color && o.sw && fabric === 'wall') return `background:url(tex/wall.jpg) center/200%`;
    return `background:${l.color || o.sw}`;
  }
  // accessory pictures: each model rendered once into a small canvas
  const thumbs = new Map(); let tr = null;
  async function thumbOf(model) {
    if (thumbs.has(model)) return thumbs.get(model);
    if (!tr) { tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); tr.setSize(160, 160); tr.outputColorSpace = THREE.SRGBColorSpace; tr.toneMapping = THREE.NeutralToneMapping; }
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8c8478, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 2); sc.add(dl);
    const a = { id: '_t', target: 1, x: 0, y: 0, z: 0 }; const fake = new THREE.Group(); await placeModel(fake, a, model); const g = a.group;
    const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    sc.add(g); const cm = new THREE.PerspectiveCamera(30, 1, 0.01, 100); cm.position.set(c.x + s * 0.9, c.y + s * 0.6, c.z + s * 1.4); cm.lookAt(c);
    tr.setClearColor(0xf2ede8, 1); tr.render(sc, cm); const url = tr.domElement.toDataURL('image/png'); thumbs.set(model, url); return url;
  }

  async function thumbOfItem(t) {   // the drawn piece as it stands now, on the same small stage
    const key = 'item:' + t.key; if (thumbs.has(key)) return thumbs.get(key);
    await thumbOf('modern_ceiling_lamp_01');   // makes the stage
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8c8478, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 2); sc.add(dl);
    const src = t.items[Math.floor((t.items.length - 1) / 2)].group, g = src.clone(true); g.visible = true; sc.add(g);
    const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    const cm = new THREE.PerspectiveCamera(30, 1, 0.01, 100); cm.position.set(c.x + s * 0.9, c.y + s * 0.6, c.z + s * 1.4); cm.lookAt(c);
    tr.setClearColor(0xf2ede8, 1); tr.render(sc, cm); const url = tr.domElement.toDataURL('image/png'); thumbs.set(key, url); return url;
  }

  // ---------------------------------------------------------------- layer: circles on pieces, room labels on the floor
  const layer = $('layer');
  for (const t of targets) {
    const b = el('button', 'ring'); b.type = 'button'; b.innerHTML = '<i></i><span></span>'; t.ring = b; layer.appendChild(b);
    b.addEventListener('click', (e) => { e.stopPropagation(); openPick(t); });
  }
  let floorY = innerHeight;
  // 360 (Eliran 2026-11-19 «כל חץ צריך להפנות בדיוק לחדר … כשנמצאים בדרך אליו»): a room behind a door has its arrow ON its door,
  // seen only when that door is in view (from the corridor, or a neighbouring room); the corridor's arrow stands at its mouth from
  // the living room and inside each door that opens onto it; open rooms keep the arrow at their standpoint
  const DOORS = { parents: 'D-parents', mamad: 'D-mamad', bath: 'D-bath', bedA: 'D-bedA', bedB: 'D-bedB' };
  const doorSide = (o, inside, off = 0.35, h = 0.05) => { const [x0, y0, x1, y1] = o.r, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, alongY = x1 - x0 < y1 - y0, room = Object.keys(DOORS).find((k) => DOORS[k] === o.id);
    const c = alongY ? [[cx - off, cy], [cx + off, cy]] : [[cx, cy - off], [cx, cy + off]];
    const probe = alongY ? [[cx - 0.4, cy], [cx + 0.4, cy]] : [[cx, cy - 0.4], [cx, cy + 0.4]]; const k = Math.max(0, probe.findIndex(([x, y]) => (roomAt(x, y) === room) === inside));
    return new THREE.Vector3(c[k][0], h, -c[k][1]); };
  function anchorsOf(s) {
    const [x, y] = s.at, own = new THREE.Vector3(x, 0.05, -y);
    if (!ctx.pano) return [own];
    const d = G.openings.find((o) => o.id === DOORS[s.room]); if (d) return [doorSide(d, false, 0.08, 1.05)];   // in the door opening itself, at handle height
    if (s.room === 'corridor') return [own, new THREE.Vector3(6.85, 0.05, -6.45), ...Object.values(DOORS).map((id) => doorSide(G.openings.find((o) => o.id === id), true))];
    if (s.room === 'living') return [own, new THREE.Vector3(6.5, 0.05, -6.7)];   // back from the corridor: at its mouth, living-room side
    return [own];
  }
  // a label for every room you can walk to, standing on its floor (RAINBOW: the floor arrows «כניסה אל …»)
  const navs = ctx.STOPS.map((s) => {
    const b = el('button', 'nl'); b.type = 'button'; b.innerHTML = '<svg viewBox="0 0 44 24" aria-hidden="true"><path d="M22 2 L40 20 L30 20 L22 12 L14 20 L4 20 Z" fill="rgba(255,255,255,.88)"/></svg><span></span>';
    b.onclick = (e) => { e.stopPropagation(); go(s, true); }; layer.appendChild(b);
    const [x, y] = s.at; return { s, b, p: new THREE.Vector3(x, 0.05, -y), route: anchorsOf(s) };
  });
  const occluders = []; scene.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'wall') occluders.push(o); });
  const rc = new THREE.Raycaster(); let lastOcc = 0;
  const seen = (p, d) => { rc.set(camera.position, p.clone().sub(camera.position).normalize()); rc.far = d - 0.25; return rc.intersectObjects(occluders, false).length === 0; };
  function overlay(now) {
    const show = S.mode === 'walk' && !measure.on;
    layer.hidden = !show; if (!show) return;
    const doOcc = now - lastOcc > 160; if (doOcc) lastOcc = now;
    for (const t of targets) {
      const d = camera.position.distanceTo(t.anchor); v.copy(t.anchor).project(camera);
      let on = d < 6.5 && d > 0.6 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      if (on && doOcc) t.occ = !seen(t.anchor, d);
      if (t.occ) on = false;
      t.ring.style.display = on ? '' : 'none';
      if (on) t.ring.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
    }
    const here = roomAt(me.x, me.y);
    // 360: each arrow at the first of its anchors (anchorsOf) seen from where you stand
    const placed = [];
    for (const n of navs) {
      let on = n.s.room !== here, d = 0;
      if (on && doOcc) { n.at = null; for (const q0 of (ctx.pano ? n.route : [n.p])) {
        // 360: a near doorway would sit below the screen on the floor, so a near arrow stands higher (never more than ~30° down)
        const q = ctx.pano && q0.y < 0.5 ? q0.clone().setY(Math.max(0.05, camera.position.y - Math.hypot(q0.x - camera.position.x, q0.z - camera.position.z) * 0.55)) : q0;
        const dq = camera.position.distanceTo(q); if (dq > (ctx.pano ? 0.9 : 1.2) && dq < 9 && seen(q, dq)) { n.at = q; break; } } }
      if (!n.at) on = false;
      if (on) { d = camera.position.distanceTo(n.at); v.copy(n.at).project(camera); on = v.z < 1 && Math.abs(v.x) < 0.95 && v.y > (ctx.pano ? -0.9 : -0.75) && v.y < 0.9; }
      n.b.style.display = on ? '' : 'none';
      if (on) placed.push({ n, x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, k: THREE.MathUtils.clamp(3.2 / d, 0.65, 1.15) });
    }
    // arrows stay above the room cards and the pager, and arrows that share a doorway stack upward instead of covering each other
    if (doOcc) { floorY = innerHeight; for (const id of ['rooms', 'pager']) { const e = $(id); if (e && e.offsetParent) { const r = e.getBoundingClientRect(); if (r.height && r.top > innerHeight * 0.45) floorY = Math.min(floorY, r.top); } } }
    for (const q of placed) q.y = Math.min(q.y, floorY - 34);
    placed.sort((a, b) => b.y - a.y);
    for (let i = 0; i < placed.length; i++) for (let j = 0; j < i; j++) if (Math.abs(placed[i].x - placed[j].x) < 130 && Math.abs(placed[i].y - placed[j].y) < 40) placed[i].y = placed[j].y - 40;
    for (const q of placed) q.n.b.style.transform = `translate(${q.x}px, ${q.y}px) scale(${q.k})`;
    if (ctx.pano && doOcc && ctx.pano.want) ctx.pano.want(placed.map((q) => q.n.s.at));   // get those rooms ready for a smooth move
  }

  // 360: ↑ / W walks to the room whose arrow is straight ahead (the shown arrow nearest the middle of the view, within ~a third of it)
  function forward() {
    let best = null; for (const n of navs) { if (n.b.style.display === 'none' || !n.at) continue; v.copy(n.at).project(camera); if (v.z >= 1) continue; const dx = Math.abs(v.x); if (dx < 0.35 && (!best || dx < best.dx)) best = { n, dx }; }
    if (best) { go(best.n.s, true); return true; } return false;
  }
  // ---------------------------------------------------------------- toolbar, rail, pager, room cards
  const toastEl = el('div', 'toast'); document.body.appendChild(toastEl); let toastT = 0;
  const toast = (s, ms = 2600) => { toastEl.textContent = s; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); };
  const tag = el('span', 'tag'); document.querySelector('.badges').appendChild(tag);
  const tb = $('tb');
  const grp = el('div', 'grp glass');
  const bView = el('button', 'tbtn'), bTools = el('button', 'tbtn'), bDesign = el('button', 'tbtn light');
  bView.id = 'b-view'; bTools.id = 'b-tools'; bDesign.id = 'b-design';
  for (const b of [bView, bTools, bDesign]) { b.type = 'button'; b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false'); }
  grp.append(bView, bTools, bDesign);
  const bHelp = el('button', 'round glass'); bHelp.type = 'button'; bHelp.id = 'b-help'; bHelp.innerHTML = svg('help'); bHelp.onclick = () => coach(0);
  const bLang = el('button', 'pill glass'); bLang.type = 'button'; bLang.id = 'b-lang';
  tb.append(grp, bHelp, bLang);
  // menus
  let openMenu = null;
  const closeMenu = () => { if (openMenu) { openMenu.el.remove(); openMenu.btn.setAttribute('aria-expanded', 'false'); openMenu = null; } };
  function menu(btn, items) {
    if (openMenu && openMenu.btn === btn) return closeMenu(); closeMenu();
    const m = el('div', 'menu'); m.setAttribute('role', 'menu');
    for (const it of items) { const b = el('button', 'mi'); b.type = 'button'; b.setAttribute('role', it.checked != null ? 'menuitemradio' : 'menuitem'); if (it.checked != null) b.setAttribute('aria-checked', String(it.checked));
      b.innerHTML = (it.icon ? svg(it.icon) : '') + `<span>${it.label}</span>`; b.onclick = () => { closeMenu(); it.fn(); }; m.appendChild(b); }
    document.body.appendChild(m); const r = btn.getBoundingClientRect();
    m.style.top = r.bottom + 8 + 'px'; const w = m.offsetWidth; m.style.left = Math.min(Math.max(10, lang === 'en' ? r.left : r.right - w), innerWidth - w - 10) + 'px';
    btn.setAttribute('aria-expanded', 'true'); openMenu = { el: m, btn };
  }
  addEventListener('pointerdown', (e) => { if (openMenu && !openMenu.el.contains(e.target) && !openMenu.btn.contains(e.target)) closeMenu(); }, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closePanel(); closePick(); } });
  bView.onclick = () => menu(bView, [
    { icon: 'walk', label: L().walkMode, checked: S.mode === 'walk' && !S.plan, fn: () => { setMode('walk'); setPlan(false); } },
    { icon: 'cube', label: L().doll, checked: S.mode === 'doll', fn: () => setMode('doll') },
    { icon: 'plan', label: L().planMode, checked: !!S.plan, fn: () => { setMode('walk'); setPlan(!S.plan); } },
    ...(ctx.daynight ? [{ icon: 'sun', label: L().dayTime, checked: ctx.daynight.open, fn: () => ctx.daynight.setOpen(!ctx.daynight.open) }] : [])]);
  bTools.onclick = () => menu(bTools, [
    { icon: 'ruler', label: L().measure, checked: measure.on, fn: () => setMeasure(!measure.on) },
    { icon: 'share', label: L().share, fn: share },
    { icon: 'hide', label: L().hide, fn: () => document.body.classList.add('clean') },
    { icon: 'help', label: L().coach, fn: () => coach(0) }]);
  bDesign.onclick = () => (panel.hidden ? openDesign() : closePanel());
  bLang.onclick = () => menu(bLang, [{ label: 'עברית', checked: lang === 'he', fn: () => setLang('he') }, { label: 'English', checked: lang === 'en', fn: () => setLang('en') }]);
  const show = el('button', 'pill glass showbtn'); show.type = 'button'; show.onclick = () => document.body.classList.remove('clean'); document.body.appendChild(show);
  // rail
  const rail = $('rail'); const rb = {};
  for (const [k, icon, fn, cls] of [['zin', 'plus', () => zoom(0.85)], ['zout', 'minus', () => zoom(1 / 0.85)], ['-'], ['spin', 'spin', () => { S.spin = !S.spin; syncTools(); }],
    ['resetv', 'centre', () => resetView()], ['full', 'full', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()), 'ph-hide']]) {
    if (k === '-') { rail.appendChild(el('hr')); continue; }
    const b = el('button'); b.type = 'button'; b.innerHTML = svg(icon); b.onclick = fn; if (cls) b.className = cls; rb[k] = b; rail.appendChild(b);
  }
  // room cards + pager
  const strip = $('rooms'); const pager = $('pager');
  const stopName = (s) => (s.he ? (lang === 'en' ? s.en : s.he) : roomLabel(s.room));
  ctx.STOPS.forEach((s, i) => {
    const b = el('button', 'rc'); b.type = 'button'; b.dataset.room = s.room;
    b.innerHTML = `<img alt="" loading="lazy" src="thumbs/${s.room}.jpg" onerror="this.remove()"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="nm"></span>`;
    b.onclick = () => go(s); strip.appendChild(b); s.card = b;
  });
  const pPrev = el('button'), pNext = el('button'), pl = el('div', 'pl'); pPrev.type = pNext.type = 'button';
  pager.append(pNext, pl, pPrev);   // RTL: "next" sits at the start (right)
  pl.onclick = () => document.body.classList.toggle('strip-open');   // phone: the room cards open from the room name
  const idx = () => Math.max(0, ctx.STOPS.findIndex((s) => s.room === S.room));
  pNext.onclick = () => go(ctx.STOPS[(idx() + 1) % ctx.STOPS.length]); pPrev.onclick = () => go(ctx.STOPS[(idx() - 1 + ctx.STOPS.length) % ctx.STOPS.length]);
  function go(s, walk = false) { closePick(); if (S.mode === 'doll') setMode('walk'); if (walk && ctx.pano && ctx.pano.walkTo) return ctx.pano.walkTo(s.at[0], s.at[1]); flyTo(s.at[0], s.at[1], s.at[2]); }   // walk: an arrow — look where you walk
  function onRoom(r) {
    S.room = r; $('room').textContent = roomLabel(r);
    const area = G.rooms.find((q) => q.id === r)?.area_m2; $('eyebrow').textContent = area ? `${L().area} ${area.toFixed(1)} ${L().sqm}` : (r === 'balcony' ? `${L().area} 8.8 ${L().sqm}` : '');
    for (const s of ctx.STOPS) s.card.setAttribute('aria-current', String(s.room === r));
    const cur = ctx.STOPS.find((s) => s.room === r); if (cur) cur.card.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    const i = ctx.STOPS.findIndex((s) => s.room === r);
    pl.innerHTML = ''; pl.append(document.createTextNode(cur ? stopName(cur) : roomLabel(r))); if (i >= 0) { const sm = el('small', '', `${i + 1} / ${ctx.STOPS.length}`); pl.appendChild(sm); }
  }

  // ---------------------------------------------------------------- the pick bar (RAINBOW #t-pick): cards above the room strip
  const pickHost = $('pickhost'); let pickT = null;
  const closePick = () => { document.body.classList.remove('pick-open'); pickHost.innerHTML = ''; if (pickT) pickT.ring.classList.remove('open'); pickT = null; strip.hidden = false; };
  const lastOp = (sel) => { for (let i = S.ops.length - 1; i >= 0; i--) if (S.ops[i].sel === sel) return S.ops[i]; return null; };
  async function openPick(t) {
    closePanel(); if (pickT) pickT.ring.classList.remove('open'); pickT = t; t.ring.classList.add('open');
    const box = el('section', 'pick glass'); box.setAttribute('aria-label', L().pickM(label(t)));
    const h = el('div', 'pick-head'); const x = el('button', 'x'); x.type = 'button'; x.innerHTML = svg('x'); x.setAttribute('aria-label', L().close); x.onclick = closePick;
    h.append(el('b', '', t.acc ? L().pickM(label(t)) : L().pick(label(t))), x); box.appendChild(h);
    const cards = el('div', 'cards'); box.appendChild(cards);
    const hidden = t.acc ? !t.acc.group.visible : t.items.every((it) => !it.group.visible);
    const card = (name, style, pressed, fn, cls = '') => { const b = el('button', 'cc ' + cls); b.type = 'button'; const sw = el('span', 'sw'); if (style) sw.setAttribute('style', style); b.append(sw, el('em', '', name)); if (pressed) b.setAttribute('aria-pressed', 'true'); b.onclick = fn; cards.appendChild(b); return sw; };
    if (t.acc) {
      for (const [id, he, en] of MODELS[t.kind]) {
        const sw = card(lang === 'en' ? en : he, '', !hidden && t.acc.current === id, async () => { if (ctx.pano) return aiChange(`Replace the ${enName(t)} in the photo with the ${en.toLowerCase()} shown in image 2: same place, same scale, same perspective and light.`, await thumbOf(id), `${label(t)} ← ${he}`); push({ sel: t.key, model: id }); toast(L().applied(opText(S.ops.at(-1)))); setTimeout(() => openPick(t), 50); });
        thumbOf(id).then((u) => { sw.style.background = `url(${u}) center/cover`; }).catch(() => {});
      }
    } else {
      // other models first (CC0), then finishes of the drawn piece
      const curModel = t.items[0].model === t.items[0].defaultModel ? null : (t.items[0].model || 'built');
      if (t.def.models || t.items[0].defaultModel) {
        const orig = card(L().origPiece, '', !hidden && !curModel, () => { if (ctx.pano) { ctx.pano.reset(); refresh(); closePick(); return; } push({ sel: t.key, model: null }); toast(L().applied(opText(S.ops.at(-1)))); setTimeout(() => openPick(t), 50); });
        (t.items[0].defaultModel ? thumbOf(t.items[0].defaultModel) : thumbOfItem(t)).then((u) => { orig.style.background = `url(${u}) center/cover`; }).catch(() => {});
        for (const [id, he, en] of t.def.models || []) {
          const sw = card(lang === 'en' ? en : he, '', !hidden && curModel === id, async () => { if (ctx.pano) return aiChange(`Replace the ${enName(t)} in the photo with the ${en.toLowerCase()} shown in image 2: same place, same scale, same perspective and light.`, await thumbOf(id), `${label(t)} ← ${he}`); push({ sel: t.key, model: id }); toast(L().applied(opText(S.ops.at(-1)))); setTimeout(() => openPick(t), 50); });
          thumbOf(id).then((u) => { sw.style.background = `url(${u}) center/cover`; }).catch(() => {});
        }
        cards.appendChild(el('span', 'sep'));
      }
      const cur = curModel ? null : lastOp(t.key)?.k; const fabric = t.def.opts === FAB;
      for (const o of t.def.opts) card(nm(o), swStyle(o, fabric), cur === o.k, () => { if (ctx.pano) return aiChange(`Change the ${enName(t)} to ${o.en.toLowerCase()} (${o.sw}); keep its exact shape, size and place.`, null, `${label(t)} ← ${o.he}`); push({ sel: t.key, k: o.k }); toast(L().applied(opText(S.ops.at(-1)))); setTimeout(() => openPick(t), 50); });
    }
    const rm = card(hidden ? L().restore : L().remove, '', false, () => {
      if (ctx.pano) { aiChange(`Remove the ${enName(t)} from the photo; show the floor and the wall behind it as they are.`, null, `${label(t)} ← ${L().remove}`); return; }
      if (hidden) { const i = S.ops.map((o) => o.sel === t.key && !!o.hide).lastIndexOf(true); if (i >= 0) S.ops.splice(i, 1); run(replay); } else push({ sel: t.key, hide: true });
      closePick(); }, 'rm');
    rm.textContent = hidden ? '↺' : '⌫';
    box.appendChild(el('p', 'card', L().card));
    pickHost.innerHTML = ''; pickHost.appendChild(box); document.body.classList.add('pick-open'); if (phone) strip.hidden = true;
  }

  // ---------------------------------------------------------------- 360 version: every change = a live AI edit of the view (pano.js)
  const enName = (t) => (t.acc ? ACC_NAME[t.kind][1] : t.def.en).replace(/^the /, '');
  async function aiChange(instruction, ref, labelHe) {
    if (!ctx.pano) return false;
    if (ctx.pano.busy) { toast(lang === 'en' ? 'One change at a time…' : 'שינוי אחד בכל פעם…'); return true; }
    closePick(); closePanel();
    toast(lang === 'en' ? 'Applying your change… about 10 seconds' : 'מחילים את השינוי שלכם… בדרך כלל כ־10 שניות', 15000);
    const r = await ctx.pano.edit(instruction, ref, labelHe);
    toast(r.ok ? L().applied(labelHe) : (lang === 'en' ? 'The change did not load. ' : 'השינוי לא נטען. ') + (/cap|limit/i.test(r.reason || '') ? (lang === 'en' ? "Today's change quota is used up." : 'מכסת השינויים להיום נוצלה.') : (lang === 'en' ? 'Try again.' : 'נסו שוב.')), 4500);
    refresh(); return true;
  }

  // ---------------------------------------------------------------- the design panel (RAINBOW «שינוי עיצוב»)
  const panel = el('section', 'panel'); panel.hidden = true; document.body.appendChild(panel);
  const closePanel = () => { panel.hidden = true; bDesign.setAttribute('aria-expanded', 'false'); document.body.classList.remove('panel-open'); };
  function openDesign() {
    closePick(); closeMenu(); panel.innerHTML = ''; panel.hidden = false; document.body.classList.add('panel-open'); bDesign.setAttribute('aria-expanded', 'true');
    const h = el('div', 'pick-head'); const x = el('button', 'x'); x.type = 'button'; x.innerHTML = svg('x'); x.setAttribute('aria-label', L().close); x.onclick = closePanel;
    h.append(el('b', '', L().design), x); panel.appendChild(h);
    const f = el('form', 'line'); const inp = el('input'); inp.maxLength = 300; inp.placeholder = L().ph; inp.setAttribute('aria-label', L().ph);
    const goB = el('button', 'btn primary', L().apply); goB.type = 'submit'; f.append(inp, goB);
    f.onsubmit = (e) => { e.preventDefault(); const r = typed(inp.value); if (r) toast(r, 4200); else { inp.value = ''; openDesign(); } };
    panel.appendChild(f);
    const acts = el('div', 'acts');
    const mk = (txt, fn, dis) => { const b = el('button', 'btn', txt); b.type = 'button'; b.disabled = !!dis; b.onclick = fn; acts.appendChild(b); };
    const nOps = ctx.pano ? ctx.pano.changes().length : S.ops.length;
    mk(L().undo, () => { if (ctx.pano) { ctx.pano.undo(); refresh(); return openDesign(); } S.ops.pop(); run(replay).then(openDesign); }, !nOps);
    mk((ctx.pano ? ctx.pano.original : S.showOrig) ? L().mine : L().orig, () => { if (ctx.pano) { ctx.pano.toggleOrig(); refresh(); return openDesign(); } S.showOrig = !S.showOrig; run(replay).then(openDesign); }, !nOps);
    mk(L().reset, () => { if (ctx.pano) { ctx.pano.reset(); refresh(); return openDesign(); } S.ops = []; S.showOrig = false; run(replay).then(openDesign); }, !nOps);
    panel.appendChild(acts);
    const chips = (opts, cur, fn, fabric) => { const row = el('div', 'chips'); for (const o of opts) { const b = el('button', 'chp'); b.type = 'button'; const d = el('span', 'dot'); d.setAttribute('style', swStyle(o, fabric)); b.append(d, el('span', '', nm(o))); if (o.k === cur) b.setAttribute('aria-pressed', 'true'); b.onclick = () => fn(o); row.appendChild(b); } return row; };
    panel.appendChild(el('h4', '', L().presets));
    const pr = el('div', 'chips');
    for (const p of PRESETS) { const b = el('button', 'chp', nm(p)); b.type = 'button'; b.onclick = () => { if (ctx.pano) return aiChange('Restyle this room, keeping every wall, opening and piece of furniture in place: ' + p.ops.map(([sel, k]) => `${sel.split(':')[1].replace('_', ' ')} ${(optOf(sel, k) || {}).en || k}`).join(', ') + '.', null, nm(p)); for (const [sel, k] of p.ops) S.ops.push({ sel, k }); S.showOrig = false; run(replay).then(() => { toast(L().applied(nm(p))); openDesign(); }); }; pr.appendChild(b); }
    panel.appendChild(pr);
    for (const [key, s] of Object.entries(SURF)) {
      panel.appendChild(el('h4', '', nm(s)));
      panel.appendChild(chips(s.opts, lastOp('surf:' + key)?.k, (o) => { if (ctx.pano) return aiChange(`Change the ${s.en.toLowerCase()} to ${o.en.toLowerCase()}; keep everything else exactly as it is.`, null, `${s.he} ← ${o.he}`); push({ sel: 'surf:' + key, k: o.k }); toast(L().applied(opText(S.ops.at(-1)))); openDesign(); }, key === 'walls' ? 'wall' : false));
    }
    panel.appendChild(el('h4', '', L().yours));
    const ul = el('ol', 'changes'); const listed = ctx.pano ? ctx.pano.changes() : S.ops.map(opText); if (!listed.length) ul.appendChild(el('li', 'muted', L().none)); else for (const t of listed) ul.appendChild(el('li', '', t));
    panel.appendChild(ul);
  }

  // ---------------------------------------------------------------- the free-text line, read locally
  const COLORS = [
    [['ירוק זית', 'olive'], '#6d7147'], [['כחול נייבי', 'נייבי', 'navy'], '#2e3c58'], [['ורוד עתיק', 'dusty pink'], '#c39d96'], [['ירוק מרווה', 'מרווה', 'sage'], '#a9b59b'],
    [['אפור חם', 'warm grey', 'warm gray'], '#cfc9c0'], [['כחול אפרפר', 'blue grey', 'blue gray'], '#9fafbd'], [['טרקוטה', 'terracotta'], '#b2623f'], [['חרדל', 'mustard'], '#c69c3c'],
    [['שמנת', 'קרם', 'cream'], '#ebe4d6'], [['בז', 'beige'], '#cbb79c'], [['תכלת', 'light blue', 'sky blue'], '#a9c4d6'], [['אפור', 'grey', 'gray'], '#8d8b87'],
    [['לבנ', 'לבן', 'white'], '#eeeae2'], [['שחור', 'black'], '#1f1f1f'], [['ירוק', 'green'], '#5f7a52'], [['כחול', 'blue'], '#3f5878'], [['אדומ', 'אדום', 'red'], '#8f2f2a'],
    [['צהוב', 'yellow'], '#d8b443'], [['חומ', 'חום', 'brown'], '#6a4a33'], [['ורוד', 'pink'], '#d4a5a0'], [['סגול', 'purple'], '#6b557a'], [['כתומ', 'כתום', 'orange'], '#c8743a'],
  ];
  const MATS = [
    [['פרקט', 'parquet'], { tex: 'parquet', color: null, rough: 0.55 }], [['שיש', 'marble'], { tex: 'quartz', color: null, rough: 0.18 }],
    [['בטון', 'concrete'], { tex: 'parapet', color: '#9a9894', rough: 0.8 }], [['אגוז', 'walnut'], { tex: 'oak', color: '#6e4a30', rough: 0.55 }],
    [['אלון', 'עץ', 'oak', 'wood'], { tex: 'oak', color: null, rough: 0.55 }], [['פורצלן', 'קרמיקה', 'porcelain', 'tile'], { tex: 'tile80', color: null, rough: 0.32 }],
  ];
  const TARGETS = [
    [['ארונות המטבח', 'ארונות מטבח', 'חזיתות', 'מטבח', 'kitchen'], 'surf:kitchen'], [['משטח', 'countertop', 'worktop'], 'surf:counter'],
    [['שולחן הקפה', 'שולחן קפה', 'שולחן סלון', 'coffee table'], 'kind:round_table'], [['שולחן האוכל', 'שולחן אוכל', 'dining table', 'שולחן', 'table'], 'kind:dining_table'],
    [['כיסאות המרפסת', 'כסאות המרפסת', 'balcony chairs'], 'kind:outdoor_chair'], [['כיסא', 'כסא', 'כיסאות', 'כסאות', 'chair'], 'kind:dining_chair'],
    [['ספה', 'ספות', 'sofa', 'couch'], 'kind:sofa'], [['שטיח', 'rug', 'carpet'], 'kind:rug'], [['שידה', 'שידות', 'bedside', 'nightstand'], 'kind:nightstand'],
    [['מיטה', 'מיטות', 'bed'], 'bed'], [['ארון', 'ארונות', 'wardrobe', 'closet'], 'kind:wardrobe'],
    [['קירות', 'קיר', 'צבע', 'wall', 'paint'], 'surf:walls'], [['רצפה', 'רצפת', 'ריצוף', 'ריצפה', 'flooring', 'floor'], 'surf:floor'],
  ];
  const STRUCT = /(להזיז|להרוס|לשבור|להגדיל|להקטין|לפתוח קיר|להוסיף חלון|להוסיף חדר|להוסיף דלת|להוריד קיר|להעביר את הקיר|move (the )?wall|remove (the )?wall|knock|add (a )?window|add (a )?room|bigger room|enlarge)/i;
  const ADD = /^(תוסיף|להוסיף|הוסיפו|הוסף|add|put)\b/i;
  function typed(raw) {
    const s = ' ' + raw.trim().toLowerCase().replace(/["'׳״]/g, '') + ' ';
    if (!raw.trim()) return L().unclear;
    if (STRUCT.test(s)) return L().refScope;
    if (ctx.pano) { aiChange(`Apply this change to the photo: ${raw.trim()}. Keep every wall, window, door and everything else exactly as it is.`, null, raw.trim().slice(0, 40)); return null; }
    const hits = [];
    for (const [words, sel] of TARGETS) for (const w of words) { let i = s.indexOf(w); while (i >= 0) { if (!hits.some((h) => i >= h.i && i < h.i + h.w.length)) hits.push({ i, w, sel }); i = s.indexOf(w, i + w.length); } }
    hits.sort((a, b) => a.i - b.i);
    if (!hits.length) return ADD.test(raw.trim()) ? L().refAdd : L().unclear;
    const before = S.ops.length; let miss = false; const here = roomAt(me.x, me.y);
    hits.forEach((h, n) => {
      const seg = s.slice(h.i + h.w.length, n + 1 < hits.length ? hits[n + 1].i : s.length) + ' ' + (n === 0 ? s.slice(0, h.i) : '');
      let look = null, name = '';
      for (const [ws, l] of MATS) if (ws.some((w) => seg.includes(w))) { look = { ...l }; name = ws[0]; break; }
      for (const [ws, c] of COLORS) if (ws.some((w) => seg.includes(w))) { const col = new THREE.Color(c);
        if (/כהה|כהים|כהות|dark/.test(seg)) col.multiplyScalar(0.55); if (/בהיר|light|pale/.test(seg) && !/light (blue|grey|gray)/.test(seg)) col.lerp(new THREE.Color(1, 1, 1), 0.45);
        look = { ...(look || {}), color: '#' + col.getHexString() }; name = (name ? name + ' ' : '') + ws[0] + (/כהה|dark/.test(seg) ? (lang === 'en' ? ' (dark)' : ' כהה') : ''); break; }
      if (!look) { miss = true; return; }
      if (h.sel === 'surf:walls') delete look.tex;
      let sel = h.sel;
      if (sel === 'bed') { const t = targets.filter((q) => (q.kind === 'bed_double' || q.kind === 'bed_single') && q.room === here); if (t.length) { for (const q of t) S.ops.push({ sel: q.key, look, name }); return; } sel = 'kind:bed_single'; S.ops.push({ sel: 'kind:bed_double', look, name }); }
      else if (sel === 'kind:wardrobe' || sel === 'kind:nightstand') { const t = targets.filter((q) => q.kind === sel.slice(5) && q.room === here); if (t.length) { for (const q of t) S.ops.push({ sel: q.key, look, name }); return; } }
      if (sel.startsWith('kind:') && !kindTargets(sel.slice(5)).length) { miss = true; return; }
      S.ops.push({ sel, look, name });
    });
    if (S.ops.length === before) return miss ? L().unclear : L().noTarget;
    S.showOrig = false; const added = S.ops.slice(before);
    run(async () => { for (const op of added) await applyOp(op); refresh(); });
    toast(L().applied(added.map(opText).join(' · ')), 3600); return null;
  }

  // ---------------------------------------------------------------- measure, dollhouse, plan, zoom, share, language, coach
  const measure = { on: false, a: null, b: null, lab: el('div', 'mlabel') }; document.body.appendChild(measure.lab); measure.lab.hidden = true;
  const dotGeo = new THREE.SphereGeometry(0.025, 16, 12), dotMat = new THREE.MeshBasicMaterial({ color: 0xf9f6f3, depthTest: false });
  const mGroup = new THREE.Group(); mGroup.name = 'measure'; mGroup.renderOrder = 10; scene.add(mGroup);
  function setMeasure(on) { measure.on = on; measure.a = measure.b = null; mGroup.clear(); measure.lab.hidden = true; if (on) toast(L().mHint + ' · ' + L().mNote, 5000); syncTools(); }
  const pickables = []; scene.traverse((o) => { if (o.isMesh && o.material && o.material.name !== 'glass') pickables.push(o); });
  function tap(x, y) {
    closeMenu(); if (!measure.on) return false;
    rc.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera); rc.far = 40;
    const hit = rc.intersectObjects(pickables, true).find((h) => h.object.visible && h.object.parent?.visible !== false); if (!hit) return true;
    const d = new THREE.Mesh(dotGeo, dotMat); d.position.copy(hit.point);
    if (!measure.a || measure.b) { mGroup.clear(); mGroup.add(d); measure.a = hit.point.clone(); measure.b = null; measure.lab.hidden = true; return true; }
    mGroup.add(d); measure.b = hit.point.clone();
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([measure.a, measure.b]), new THREE.LineBasicMaterial({ color: 0xf9f6f3, depthTest: false })); ln.renderOrder = 10; mGroup.add(ln);
    measure.lab.textContent = `${measure.a.distanceTo(measure.b).toFixed(2)} ${L().m}`; measure.lab.hidden = false; return true;
  }
  function placeLabel() { if (measure.lab.hidden || !measure.b) return; v.copy(measure.a).add(measure.b).multiplyScalar(0.5).project(camera); measure.lab.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`; measure.lab.style.display = v.z < 1 ? '' : 'none'; }
  const xs = G.footprint.map((p) => p[0]), ys = G.footprint.map((p) => p[1]);
  const C = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, -(Math.min(...ys) + Math.max(...ys)) / 2);
  const doll = { az: 0.6, el: 0.95, r: 17 };
  const lids = []; scene.traverse((o) => { if (o.isMesh && o.material && (o.material.name === 'ceiling' || o.material.name === 'slab')) lids.push(o); });
  function setMode(m) {
    S.mode = m; for (const o of lids) o.visible = m !== 'doll';
    if (m === 'doll') { S.bg = scene.background; scene.background = new THREE.Color(0x24211e); setMeasure(false); closePick(); closePanel(); camera.fov = 45; }
    else { if (S.bg) { scene.background = S.bg; S.bg = null; } camera.fov = S.fov0; }
    camera.updateProjectionMatrix(); document.body.classList.toggle('doll', m === 'doll'); syncTools();
  }
  function setPlan(on) { S.plan = on; $('plan').hidden = !on; dispatchEvent(new Event('resize')); }
  function update() {
    if (S.mode !== 'doll') return;
    camera.position.set(C.x + Math.sin(doll.az) * Math.cos(doll.el) * doll.r, Math.sin(doll.el) * doll.r, C.z + Math.cos(doll.az) * Math.cos(doll.el) * doll.r); camera.lookAt(C);
  }
  const orbit = (dx, dy) => { doll.az -= dx * 0.006; doll.el = THREE.MathUtils.clamp(doll.el + dy * 0.004, 0.35, 1.45); };
  const zoom = (k) => { if (S.mode === 'doll') doll.r = THREE.MathUtils.clamp(doll.r * k, 7, 30); else { camera.fov = THREE.MathUtils.clamp(camera.fov * k, 30, 95); camera.updateProjectionMatrix(); } };
  const resetView = () => { if (S.mode === 'doll') Object.assign(doll, { az: 0.6, el: 0.95, r: 17 }); else { me.pitch = -0.03; camera.fov = S.fov0; camera.updateProjectionMatrix(); } };
  function shareUrl() {
    const u = new URL(location.href); u.search = '';
    if (lang === 'en') u.searchParams.set('lang', 'en');
    if (S.ops.length) u.searchParams.set('c', btoa(unescape(encodeURIComponent(JSON.stringify(S.ops)))));
    u.searchParams.set('at', [me.x.toFixed(2), me.y.toFixed(2), me.yaw.toFixed(2)].join(','));
    return u.toString();
  }
  async function share() { const url = shareUrl(); try { if (navigator.share && phone) await navigator.share({ url }); else { await navigator.clipboard.writeText(url); toast(L().copied); } } catch { prompt(L().share, url); } }
  function syncTools() {
    rb.spin.classList.toggle('on', S.spin);
    for (const [k, b] of Object.entries(rb)) b.setAttribute('aria-label', L()[k]);
    bView.innerHTML = svg('eye') + `<span class="lbl-long">${L().views}</span><span class="lbl-short" hidden></span>` + svg('car', 'ico car');
    bTools.innerHTML = svg('tools') + `<span>${L().helpers}</span>` + svg('car', 'ico car');
    const fl = lastOp('surf:floor'); const chip = fl && fl.k ? nm(optOf('surf:floor', fl.k)) : '';
    bDesign.innerHTML = svg('pen') + `<span>${L().design}</span>` + (chip ? `<span class="chip">${chip}</span>` : '') + svg('car', 'ico car');
    bLang.innerHTML = svg('globe') + `<span>${lang === 'en' ? 'EN' : 'עב'}</span>` + svg('car', 'ico car');
    bView.setAttribute('aria-label', L().views); bHelp.setAttribute('aria-label', L().coach);
    pPrev.innerHTML = svg('prev'); pNext.innerHTML = svg('next'); pPrev.setAttribute('aria-label', L().prev); pNext.setAttribute('aria-label', L().next);
    if (lang === 'en') { pPrev.innerHTML = svg('next'); pNext.innerHTML = svg('prev'); }
  }
  const roomLabel = (rid) => (lang === 'en' ? ROOM_EN[rid] : ctx.ROOM_HE[rid]) || '';
  function setLang(l) { lang = l; relabel(); }
  function relabel() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    show.textContent = L().show; document.querySelector('.badge').textContent = L().badge;
    $('disc').textContent = L().note; $('sub').textContent = L().sub; $('foot').textContent = L().foot; document.querySelector('.bt').innerHTML = `${L().by} <b>HABAIT</b>`;
    for (const s of ctx.STOPS) s.card.querySelector('.nm').textContent = stopName(s);
    for (const t of targets) t.ring.querySelector('span').textContent = cap(label(t));
    for (const n of navs) n.b.querySelector('span').textContent = stopName(n.s);
    $('hint').innerHTML = phone ? L().hintPhone : L().hintDesk;
    if (ctx.daynight) ctx.daynight.relabel();
    syncTools(); refresh(); onRoom(S.room || roomAt(me.x, me.y) || 'entrance'); if (!panel.hidden) openDesign(); if (pickT) openPick(pickT);
  }
  const cap = (s) => s.replace(/^the /, '').replace(/^./, (c) => c.toUpperCase());
  function refresh() { S.ver = (S.ver || 0) + 1; tag.textContent = L().tag; tag.hidden = ctx.pano ? (!ctx.pano.changes().length || ctx.pano.original) : (!S.ops.length || S.showOrig); syncTools(); }

  const coachEl = el('div', 'coach'); coachEl.hidden = true; document.body.appendChild(coachEl);
  const STEPS = () => [['.ring', L().c1], ['#b-design', L().c2], ['#b-view', L().c3], ['#b-tools', L().c4], ['#rail', L().c5], ['#daynight', L().c7], ['#rooms', L().c6]];
  function coach(i) {
    closeMenu(); const steps = STEPS(); if (i >= steps.length) { coachEl.hidden = true; return; }
    const [sel, txt] = steps[i]; const tgt = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null && getComputedStyle(e).display !== 'none');
    if (!tgt && sel === '.ring') return coach(i + 1);
    coachEl.innerHTML = ''; coachEl.append(el('p', '', txt));
    const row = el('div', 'acts'); const nx = el('button', 'btn primary', i + 1 < steps.length ? L().next : L().done); nx.type = 'button'; nx.onclick = () => coach(i + 1);
    const sk = el('button', 'btn', L().skip); sk.type = 'button'; sk.onclick = () => coach(99); row.append(nx, sk); coachEl.appendChild(row); coachEl.hidden = false;
    const W = coachEl.offsetWidth, H = coachEl.offsetHeight;
    if (tgt) { const r = tgt.getBoundingClientRect(); const top = r.bottom + 10 + H < innerHeight ? r.bottom + 10 : Math.max(10, r.top - H - 10); coachEl.style.top = top + 'px'; coachEl.style.left = Math.min(Math.max(16, r.left + r.width / 2 - W / 2), innerWidth - W - 16) + 'px'; }
    else { coachEl.style.top = '35%'; coachEl.style.left = Math.max(16, innerWidth / 2 - W / 2) + 'px'; }
  }

  // ---------------------------------------------------------------- shared link in, first paint
  if (params.get('c')) { try { S.ops = JSON.parse(decodeURIComponent(escape(atob(params.get('c'))))).filter((o) => o && typeof o.sel === 'string'); await replay(); } catch (e) { console.warn('bad change link', e); } }
  if (params.get('at')) { const [x, y, yaw] = params.get('at').split(',').map(Number); if (ctx.ok(x, y)) { me.x = x; me.y = y; me.yaw = yaw || 0; } }
  setPlan(!phone); relabel();
  setTimeout(() => toast(L().ringHint, 4200), 2500);

  return {
    get mode() { return S.mode; }, setMode, update, orbit, zoom, tap, onRoom, forward,
    wheel: (dy) => zoom(dy > 0 ? 1.08 : 1 / 1.08),
    frame(now, dt) { if (S.spin && S.mode === 'walk' && !me.goal) me.yaw += dt * 0.12; overlay(now); placeLabel(); },
    roomLabel, typed, get ops() { return S.ops; }, get ver() { return S.ver || 0; }, targets, shareUrl, openPick, openDesign, replay: () => run(replay), idle: () => S.busy,
  };
}
