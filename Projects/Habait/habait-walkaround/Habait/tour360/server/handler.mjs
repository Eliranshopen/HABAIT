/* Habait Tour360 — server/handler.mjs (T09 + T12, board habait-tour360) — the live text edit, one turn, zero dependencies.
   Runs unchanged on the laptop (tools/edit-server.mjs) and as the Vercel function api/edit.mjs. The browser sends the flat view
   it cut out of the panorama plus the visitor's words; this handler (1) checks the unlock code and the day's cap, (2) turns the
   words into an English editing instruction with a small text model and applies the scope rule — everything inside the view may
   change, people and pets included (D-T360-24); only the apartment's structure, a named real person (D-T360-26) and unsafe content
   are refused — and routes the
   request to the editor that does that kind of change best, (3) sends the view and the instruction to ONE fal instruction
   editor, reserved before and settled after, and (4) returns the edited view. The browser pastes back only the changed region
   (viewer/edit-live.js). Secrets by name: FAL_KEY · OPENROUTER_API_KEY · TOUR_EDIT_CODE come from `env`; none is ever logged.
   T14b (CATALOG-PLAN.md): a request that carries `item` + `reference` is a CATALOG turn — the product photo of a catalog item,
   bound to the host's catalog by its SHA-256, goes to the people editor as a second image, and `op: 'likeness'` scores the
   result against the photo (report-only). A request without `item` takes exactly the path it took before T14b.
   T16b (CATALOG-PLAN.md §10.3, D-CAT-14): a catalog request may name the PIECE the visitor tapped (`piece`: category, box on
   0-1000 of the crop, count) — the text step then gets one line saying which piece, and `op: 'replace_judge'` answers whether the
   old piece is gone and the product stands in its place (the acceptance of a catalog turn; the people judge `op: 'judge'` and its
   size rule are untouched). A catalog request without `piece` takes exactly T14b's path (golden `a413f17c`). */
import { chatFetch, hasChat } from './chat-transport.mjs';
import crypto from 'node:crypto';

/* Three editors, each proven on this apartment (research/2026-10-04-text-edit-research.md, _local/edits/living/*):
   kontext replaces furniture and décor cleanly but re-frames instead of resizing; flux3 does "bigger" and is slow;
   nb2 (Nano Banana 2) seats people naturally — exactly the count asked, poses and food right — where kontext seated six for four. */
export const MODELS = {
  kontext: { id: 'fal-ai/flux-pro/kontext', usd: 0.04, reserve: 0.08, slow: false },
  flux3: { id: 'blackforestlabs/flux-3/edit-image', usd: 0.024, reserve: 0.05, slow: true },
  nb2: { id: 'fal-ai/nano-banana-2/edit', usd: 0.08, reserve: 0.1, slow: false },
};
export const TEXT_MODEL = 'google/gemini-3.7-flash';
export const TEXT_USD = 0.003; // worst case per call; the measured grounding call was about $0.0017
const MAX_RESERVE = TEXT_USD + Math.max(...Object.values(MODELS).map((m) => m.reserve));
export const LIMITS = { instructionChars: 300, cropBytes: 2_000_000, referenceBytes: 600_000, dailyUsd: 5, perTurnUsd: Math.round((TEXT_USD + Math.max(...Object.values(MODELS).map((m) => m.usd))) * 1000) / 1000 };

/* The scope (D-T360-24, his "change everything that we can change"): a reach the text step names for every request.
   object = a thing inside the view (furniture, décor, lighting, art, plants, electronics, what is on a table, people, pets);
   surface = the colour or material of a wall, floor or ceiling, or the light of the whole room — it continues past the edge of
   the view, so the browser skips the colour fit and the edge may show; view = what is seen through the windows; structure = walls,
   windows, doors, ceiling height, the room's size or layout — the one reach this method cannot paste back, so it is refused.
   `view` is a switch so a real project's tour can keep the plan's view honest (root CLAUDE.md §6); the demo allows it. */
export const SCOPE = { object: true, surface: true, view: true, structure: false };

const REASONS = ['ok', 'structure', 'view', 'unsafe', 'real_person', 'unclear'];
const REACHES = ['object', 'surface', 'view', 'structure'];

const SYSTEM = `You prepare ONE instruction for an image-editing model. The image is a flat photo of a room in an apartment (a
concept rendering, not a real photo). A visitor typed a request in Hebrew, English or French. Decide whether the request can
be done in this photo and, if it can, write the instruction in English.

CAN BE DONE (anything inside the picture): furniture and décor (sofa, table, chairs, bed, shelves, cushions, rugs, curtains,
bedding, lamps, art, mirrors, plants, a TV) — their colour, material, size, style or position, adding or removing them; what is
on a table or counter (food, drinks, dishes, books, flowers); PEOPLE and PETS — adding them (sitting at the table or on the
chairs, on the sofa, standing, cooking, reading, children playing, a dog or a cat), removing them, changing how many there are,
what they do or wear; the colour or material of a wall, the floor or the ceiling; the light and the time of day; what is seen
through the windows.
CANNOT BE DONE: the apartment's structure — adding, removing, moving or resizing walls, windows, doors or openings, changing the
ceiling height, the room's size, shape or layout (reason "structure"). REFUSE: a specific real person — a politician, a
celebrity, an athlete, anyone named or nicknamed, or "someone who looks like" them (reason "real_person"; people described without a
name, such as "two men in suits" or "a family", are fine). REFUSE: anything sexual or nude, violent, gory, weapons, drugs, hateful
or illegal; children in any sexual, violent or unsafe situation (reason "unsafe"). If you cannot tell what should change, reason
"unclear".

Return ONLY a JSON object with these keys:
"allowed": true or false.
"reason": one of "ok", "structure", "real_person", "unsafe", "unclear".
"reach": one of "object" (a thing, a person or an animal inside the picture), "surface" (a wall, floor or ceiling colour or
material, or the light of the whole room), "view" (what is outside the windows), "structure".
"living": true when the change adds, removes or alters people or animals.
"size_change": true only when an EXISTING object is made bigger or smaller.
"target": what changes, in English, short (empty if not allowed).
"change": the requested change, in English, short (empty if not allowed).
"prompt": when allowed, the instruction for the editor in English, two or three sentences, otherwise an empty string. Write it as
imperative sentences that name what is in the picture and say exactly what changes, keeping the count the visitor gave (two
people means exactly two), the position, scale (unless the size changes) and perspective of everything else. For people or
animals, describe who they are (a couple, a family with two children, a woman reading), where they sit or stand ("on the
existing chairs at the dining table"), their pose and casual clothing, "photorealistic, matching the room's lighting,
perspective and scale, faces natural and relaxed, not looking at the camera"; never a real person. Do NOT add a sentence about
what must stay the same — it is added afterwards.`;

/* The keep-clause the editor gets after the instruction, by reach: it names what must stay, so the paste-back has a stable border. */
const KEEP = {
  object: 'Keep everything else in the photo exactly as it is: the walls, the windows and the view outside, the floor, the ceiling, the lighting and shadows, and the camera angle. Do not move or zoom the camera.',
  surface: 'Apply the change to the whole visible surface, out to the edges of the photo. Keep the room\'s geometry, the furniture and objects, the windows and the view outside, and the camera angle exactly as they are. Do not move or zoom the camera.',
  view: 'Change only what is seen through the windows. Keep everything inside the room exactly as it is: the walls, the window frames, the furniture, the floor, the ceiling, the lighting and the camera angle. Do not move or zoom the camera.',
};

/* The frame rule (T12b–d). Both editors sometimes answer with a different composition: the people editor keeps the photo's edges
   and redraws the middle larger (four diners twice their size, the table re-rendered — two of the first three live runs); Kontext
   re-frames the whole photo. Defences: FRAME and SCALE are said to the editor for every living change and every later attempt;
   the browser accepts a result only on evidence (the border ring, a small pixel-exact change, or the furniture judge below) and
   never pastes a refused one; a refused attempt is retried — a living change up to three times across the two editors. */
const FRAME = 'Edit this photo in place: keep the exact same camera position, framing, zoom and field of view.';
const SCALE = 'Draw the people or animals at the scale of the furniture as it appears now: if the table and chairs are small in the frame, the people are small too. Do not zoom in on them and do not re-compose the photo.';

/* The catalog turn (T14b, CATALOG-PLAN.md §2). The text step gets the item beside the visitor's words and this block beside its
   rules; the editor gets the product photo as a second image and the PRODUCT sentence before the keep-clause. The host's catalog
   (id → name · category · description_en · image_sha256) comes from catalog/items.json on the laptop and api/catalog.json on
   Vercel; `catalogIndex` turns either into the map, and the reference image is bound to it by hash (D-CAT-9). */
const CATALOG_SYSTEM = `CATALOG MODE. The editor will also receive a SECOND image: the product photo of the catalog item named in the
request. The request is to put that product into the room in place of an existing piece of the same kind, or where the visitor
says. The target is the piece the visitor names; when the words only name the item, the target is a piece of the item's
category that is in the picture. Write the prompt as imperative sentences: "Replace the <target> in the first image with the
product shown in the second image: <the item's description>. Place it exactly where the <target> stands, resting on the floor,
at the same scale and perspective as the piece it replaces, lit like the room. Nothing of the <target> remains: not its colour,
its fabric, its cushions or anything that stood on it. Where the old piece covered the floor or the rug and the new one does not, continue that same rug or floor, its edge and pattern, as if it had always run there; never a patch of bare floor or a new shape." Name the product's defining features from its description (its shape,
colour, material, legs) inside the first sentence. Set "reach" to "object", "living" to false and "size_change" to false. Every
refusal rule above still applies.`;
const PRODUCT = 'The second image is the product itself and the only authority for how the new piece looks: copy its exact design — shape, proportions, colour, upholstery or material, legs and details — as if the photographed product had been carried into the room. Do not restyle it to the room, do not keep the old piece\'s colour, fabric, cushions or accessories, do not blend the two designs. The first image sets only where the product stands, its scale, its perspective and its light.';  // T16g (D-CAT-22): the weight on the photo
export const CATALOG_CATEGORIES = ['sofa', 'armchair', 'coffee_table', 'dining_table', 'chair', 'lamp', 'rug', 'bed', 'shelf'];

/** The host's catalog: { items: [...] } (catalog/items.json or api/catalog.json) → id → what the handler needs. */
export function catalogIndex(doc) {
  const out = Object.create(null);
  for (const it of (doc && Array.isArray(doc.items) ? doc.items : [])) {
    if (!it || typeof it.id !== 'string' || !/^[a-f0-9]{64}$/.test(String(it.image_sha256 || ''))) continue;
    out[it.id] = { id: it.id, name: String(it.name || it.id).slice(0, 60), category: CATALOG_CATEGORIES.includes(it.category) ? it.category : 'object', description_en: String(it.description_en || '').slice(0, 300), image_sha256: it.image_sha256 };
  }
  return out;
}

/* The likeness score (T14b, D-CAT-5): one vision call with the product photo and the result; measured, never gating. */
export const LIKENESS_USD = 0.004;
const LIKENESS_SYSTEM = `You compare a product photo (image 1) with a photo of a room (image 2) into which an image editor was asked to put that
product. Find the piece in image 2 that stands for the product. Score how faithfully it reproduces the product:
0 = not there, or a different kind of piece; 1 = the same kind of furniture but a different design; 2 = close in shape and
colour, details differ (legs, fabric, proportions); 3 = the product itself, as in the photo.
Return ONLY a JSON object: {"found": true or false, "score": 0 to 3, "why": "one short sentence"}`;

/** How close is the piece in the result to the product photo? Returns { found, score, why }. Throws EditError('likeness'). */
export async function likeness(env, referenceDataUrl, resultDataUrl, fetchImpl = fetch) {
  const res = await chatFetch(env, fetchImpl)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://habait.ai', 'X-Title': 'Habait Tour360 (edit likeness)' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0,
      max_tokens: 700,
      reasoning: { max_tokens: 250 },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: LIKENESS_SYSTEM },
        { role: 'user', content: [
          { type: 'text', text: 'Image 1 — the product:' }, { type: 'image_url', image_url: { url: referenceDataUrl } },
          { type: 'text', text: 'Image 2 — the room after the edit:' }, { type: 'image_url', image_url: { url: resultDataUrl } },
        ] },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new EditError(502, 'likeness', 'likeness HTTP ' + res.status);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch { throw new EditError(502, 'likeness', 'likeness returned no JSON'); }
  const score = Number(parsed.score);
  if (!Number.isInteger(score) || score < 0 || score > 3) throw new EditError(502, 'likeness', 'likeness returned no score');
  return { found: parsed.found !== false && score > 0, score, why: String(parsed.why || '').slice(0, 160) };
}

/** One likeness turn: { op: 'likeness', code, item, reference, result } → { ok, found, score, why }. Reserved and settled like a judge. */
export async function handleLikeness(body, env, ledger, { fetchImpl = fetch, log = () => {}, catalog = null } = {}) {
  if (!describe(env).configured) throw new EditError(503, 'not_configured', 'the edit function has no keys on this host');
  if (!codeOk(env, body?.code)) throw new EditError(403, 'code', 'wrong or missing unlock code');
  const item = catalogItem(catalog, body);
  const reference = String(body?.reference || ''), result = String(body?.result || '');
  const canonical = referenceOk(reference, item);  // T16f: the verified bytes go to the vision model, not the client's string
  if (!canonical) throw new EditError(400, 'catalog', 'the reference image is not this catalog item');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(result) || dataUrlBytes(result) > LIMITS.cropBytes) throw new EditError(400, 'bad_request', 'result must be a JPEG, PNG or WebP data URL under 2 MB');
  if (ledger.total() + LIKENESS_USD > ledger.cap) throw new EditError(429, 'cap', `the day's cap of $${ledger.cap} is reached`);
  const t0 = Date.now();
  const id = ledger.reserve({ ts: new Date().toISOString(), op: 'live_likeness', scene: String(body?.scene || ''), apartment: String(body?.apartment || ''), item: item.id, reserved_usd: LIKENESS_USD, settled_usd: null, status: 'reserved' });
  try {
    const l = await likeness(env, canonical, result, fetchImpl);
    ledger.settle(id, LIKENESS_USD, { status: 'settled', found: l.found, score: l.score, why: l.why, seconds: (Date.now() - t0) / 1000 });
    log(`live_likeness ${item.id} score ${l.score}${l.found ? '' : ' (not found)'} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { ok: true, item: item.id, found: l.found, score: l.score, why: l.why, usd: LIKENESS_USD, ms: Date.now() - t0 };
  } catch (e) {
    ledger.settle(id, LIKENESS_USD, { status: 'failed', error: String(e && e.message || e).slice(0, 200), seconds: (Date.now() - t0) / 1000 });
    if (e instanceof EditError) throw e;
    throw new EditError(502, 'likeness', String(e && e.message || e).slice(0, 200));
  }
}

/* The tapped piece (T16b). The page sends the marker's category, its box on 0-1000 of the crop it cut, and how many pieces a set
   holds; the handler trusts none of it blindly: the category must be the item's, the box a real region, the count 1–12. */
export const PIECE_LIMITS = { minArea: 5000, maxCount: 12 }; // area on the 0-1000 × 0-1000 scale: 0.5 % of the crop
export function pieceOk(piece, item) {
  if (!piece || typeof piece !== 'object') throw new EditError(400, 'piece', 'piece must be an object');
  if (piece.category !== item.category) throw new EditError(400, 'piece', 'the piece is not of the item\'s category');
  const b = Array.isArray(piece.box) && piece.box.length === 4 && piece.box.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000) ? piece.box.map(Number) : null;
  if (!b || b[2] <= b[0] || b[3] <= b[1] || (b[2] - b[0]) * (b[3] - b[1]) < PIECE_LIMITS.minArea) throw new EditError(400, 'piece', 'the piece\'s box is not a region of the crop');
  const count = piece.count === undefined ? 1 : Number(piece.count);
  if (!Number.isInteger(count) || count < 1 || count > PIECE_LIMITS.maxCount) throw new EditError(400, 'piece', 'count must be 1 to 12');
  const id = piece.id === undefined ? '' : String(piece.id).slice(0, 40);
  const seen = piece.seen === undefined || piece.seen === null ? null : validSeen(piece.seen); // T18a: a later attempt's carry of the first answer
  return { id, category: item.category, box: b.map((n) => Math.round(n)), count, ...(seen ? { seen } : {}) };
}
/** The shape of a piece located on the crop (T18a): { found, box, outline, touches_edge, note } or null when it is not that shape. */
export function validSeen(x) {
  if (!x || typeof x !== 'object') return null;
  const clamp = (n) => Math.round(Math.max(0, Math.min(1000, n)));
  const box = Array.isArray(x.box) && x.box.length === 4 && x.box.every((n) => Number.isFinite(n)) ? x.box.map(clamp) : null;
  const boxOk = !!box && box[2] > box[0] && box[3] > box[1] && (box[2] - box[0]) * (box[3] - box[1]) >= PIECE_LIMITS.minArea;
  const outline = Array.isArray(x.outline) ? x.outline.filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n))).map((p) => p.map(clamp)).slice(0, 20) : [];
  const edges = Array.isArray(x.touches_edge) ? x.touches_edge.filter((e) => ['left', 'right', 'top', 'bottom'].includes(e)) : [];
  return { found: x.found === true && boxOk, box: boxOk ? box : null, outline: outline.length >= 3 ? outline : null, touches_edge: [...new Set(edges)], note: String(x.note || '').slice(0, 160) };
}
/** Where a box sits in the photo, in words the editor understands. */
function where(box) {
  const cx = (box[1] + box[3]) / 2000, cy = (box[0] + box[2]) / 2000;
  const h = cx < 0.36 ? 'left' : cx > 0.64 ? 'right' : 'centre', v = cy < 0.4 ? 'upper' : cy > 0.7 ? 'lower' : 'middle';
  return v === 'middle' && h === 'centre' ? 'centre' : `${v} ${h}`;
}
const PIECE_WORDS = { sofa: ['a sofa', 'sofas'], armchair: ['an armchair', 'armchairs'], coffee_table: ['a coffee table', 'coffee tables'], dining_table: ['a dining table', 'dining tables'], chair: ['a dining chair', 'dining chairs'], lamp: ['a lamp', 'lamps'], rug: ['a rug', 'rugs'], bed: ['a bed', 'beds'], shelf: ['a shelf', 'shelves'] };
/** The one line the text step gets about the tapped piece. */
export function pieceLine(piece) {
  const words = PIECE_WORDS[piece.category] || [piece.category.replace('_', ' '), piece.category.replace('_', ' ') + 's'];
  const box = piece.seen && piece.seen.found && piece.seen.box ? piece.seen.box : piece.box; // T18a: the box read on this crop, when there is one
  return `Piece (tapped by the visitor, the target): ${piece.count > 1 ? `${piece.count} ${words[1]}` : words[0]}, in the ${where(box)} of the photo.`;
}

/* T18a (the test report's F1): the scan's outline was drawn in another camera view and cut by that view's edge, so the page pasted
   inside a region smaller than the old piece and the old piece survived around the product. Before the edit, one vision call reads
   the tapped piece on THIS crop — its whole box (legs, base, the shadow), a silhouette, the image edges it runs past. Fail-soft: a
   miss leaves the scan's box as the only region, never a failed turn. A later attempt carries the first answer in `piece.seen`. */
export const PIECE_SEEN_USD = 0.004; // one vision call over the crop; settled at OpenRouter's reported cost when it gives one
const PIECE_SEEN_SYSTEM = `You locate ONE piece of furniture in a photo of a room. The visitor tapped it. A rough box from another camera view is
given; it may be cut short at the bottom or at the sides, so the true piece can be larger than the rough box. Return ONLY a JSON object:
{"found": true or false (is the piece there, at or around the rough box?),
 "box": [ymin, xmin, ymax, xmax] of the WHOLE piece in this photo, normalized to 0-1000 — every part of it: seat, back, arms, legs,
 base, the cushions on it, the shadow it casts on the floor, up to the image edge where it runs past the edge — or null,
 "outline": 6 to 14 points [y, x] in order along the piece's silhouette, normalized to 0-1000, or null,
 "touches_edge": the image edges the piece runs past, a list from ["left", "right", "top", "bottom"],
 "note": one short sentence}`;
export async function pieceSeen(env, cropDataUrl, piece, item, fetchImpl = fetch) {
  const words = PIECE_WORDS[piece.category] || [piece.category.replace('_', ' '), piece.category.replace('_', ' ') + 's'];
  const req = `Piece: ${piece.count > 1 ? `${piece.count} ${words[1]} (one set, all of them)` : words[0]}, rough box [${piece.box.map((n) => Math.round(n)).join(', ')}] (ymin, xmin, ymax, xmax on 0-1000), in the ${where(piece.box)} of the photo. It is about to be replaced with: ${item.name}.`;
  const res = await chatFetch(env, fetchImpl)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://habait.ai', 'X-Title': 'Habait Tour360 (piece seen)' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0,
      max_tokens: 1000,
      reasoning: { max_tokens: 300 },
      response_format: { type: 'json_object' },
      usage: { include: true },
      messages: [
        { role: 'system', content: PIECE_SEEN_SYSTEM },
        { role: 'user', content: [{ type: 'text', text: req + '\nThe photo:' }, { type: 'image_url', image_url: { url: cropDataUrl } }] },
      ],
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new EditError(502, 'piece_seen', 'piece seen HTTP ' + res.status);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  let parsed;
  const a = text.indexOf('{'), z = text.lastIndexOf('}'); // tolerant: the object between the first { and the last }, whatever wraps it
  try { parsed = JSON.parse(a >= 0 && z > a ? text.slice(a, z + 1) : text); } catch { throw new EditError(502, 'piece_seen', 'piece seen returned no JSON'); }
  const seen = validSeen(parsed);
  if (!seen) throw new EditError(502, 'piece_seen', 'piece seen returned no object');
  const reported = Number(json.usage?.cost);
  return { ...seen, usd: Number.isFinite(reported) && reported > 0 ? Math.round(reported * 10000) / 10000 : PIECE_SEEN_USD };
}

/* The replace judge (T16b; the probe's judge of 2026-10-07, moved in). A catalog turn is accepted when the ORIGINAL piece is gone,
   the product is present, and its centre lies inside the old box widened by 15 % — the size rule of the people judge (`judge`,
   PLAN §9.5) does not apply: the product decides its own size (the probe's KIVIK three-seater was 55 % of the sectional it replaced
   and right). T16f (D-CAT-20, the gate's OQ-C11): the product box is CLIPPED to the old box grown by 25 % of its span on each side —
   the only place the page pastes — and a box mostly outside that neighbourhood is not in place, whatever its centre says. One vision
   call over the two views; settled at OpenRouter's reported cost when it gives one. */
const REPLACE_JUDGE_SYSTEM = `You check an image edit. Image 1 is the original photo of a room; image 2 is the edited photo. The edit was meant to
REPLACE one piece of furniture (described in the request, with its box in image 1 normalized to 0-1000 as [ymin, xmin, ymax, xmax])
with a different product. Judge honestly. Return ONLY a JSON object:
{"original_present": true or false (is the ORIGINAL piece, the same design as in image 1, still visible in image 2, whole or in part?),
 "product_present": true or false (is a piece matching the product description visible in image 2 at or near where the original stood?),
 "product_box": [ymin, xmin, ymax, xmax] of the new product in image 2, normalized to 0-1000, or null,
 "count": the number of such product pieces in image 2,
 "rest_unchanged": 0 to 3 (3 = everything else — walls, floor, windows, other furniture, the camera — is the same; 2 = small differences; 1 = clear differences; 0 = the scene was redrawn),
 "note": one short sentence}`;
export const REPLACE_JUDGE_RULE = { pad: 0.15, grow: 0.25, keep: 0.5 };  // pad: the centre rule (D-CAT-16) · grow/keep: the clip (T16f, D-CAT-20)
/** The piece's neighbourhood: the old box grown by REPLACE_JUDGE_RULE.grow of its own span on each side, clamped to 0–1000, rounded. */
export function pieceNeighbourhood(box, grow = REPLACE_JUDGE_RULE.grow) {
  const gy = (box[2] - box[0]) * grow, gx = (box[3] - box[1]) * grow;
  return [Math.max(0, box[0] - gy), Math.max(0, box[1] - gx), Math.min(1000, box[2] + gy), Math.min(1000, box[3] + gx)].map((n) => Math.round(n));
}
/** `pb` clipped to `hood`: { box, kept } — kept is the clipped area over the raw area (0 when the raw box has no area or lies outside). */
export function clipBox(pb, hood) {
  const c = [Math.max(pb[0], hood[0]), Math.max(pb[1], hood[1]), Math.min(pb[2], hood[2]), Math.min(pb[3], hood[3])];
  const raw = Math.max(0, pb[2] - pb[0]) * Math.max(0, pb[3] - pb[1]);
  const area = Math.max(0, c[2] - c[0]) * Math.max(0, c[3] - c[1]);
  return { box: area > 0 ? c.map((n) => Math.round(n)) : null, kept: raw > 0 ? area / raw : 0 };
}
/** Is the old piece gone and the product in its place? Returns { held, original_present, product_present, product_box, placed, count, rest_unchanged, note, cost }. */
export async function replaceJudge(env, cropDataUrl, resultDataUrl, box, item, count = 1, fetchImpl = fetch) {
  const req = `Request: replace ${count > 1 ? `the ${count} pieces` : 'the piece'} at box [${box.map((n) => Math.round(n)).join(', ')}] in image 1 with ${count > 1 ? count + ' of ' : ''}this product: ${item.name}, ${item.description_en}.`;
  const res = await chatFetch(env, fetchImpl)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://habait.ai', 'X-Title': 'Habait Tour360 (replace judge)' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0,
      max_tokens: 800,
      reasoning: { max_tokens: 250 },
      response_format: { type: 'json_object' },
      usage: { include: true },
      messages: [
        { role: 'system', content: REPLACE_JUDGE_SYSTEM },
        { role: 'user', content: [
          { type: 'text', text: req + '\nImage 1 — the original:' }, { type: 'image_url', image_url: { url: cropDataUrl } },
          { type: 'text', text: 'Image 2 — the edit:' }, { type: 'image_url', image_url: { url: resultDataUrl } },
        ] },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new EditError(502, 'replace_judge', 'replace judge HTTP ' + res.status);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch { throw new EditError(502, 'replace_judge', 'replace judge returned no JSON'); }
  if (typeof parsed.original_present !== 'boolean' || typeof parsed.product_present !== 'boolean') throw new EditError(502, 'replace_judge', 'replace judge returned no verdict');
  const pb = Array.isArray(parsed.product_box) && parsed.product_box.length === 4 && parsed.product_box.every((n) => Number.isFinite(n)) ? parsed.product_box.map((n) => Math.max(0, Math.min(1000, Number(n)))) : null;
  const productPresent = parsed.product_present === true && pb !== null;
  let placed = false, clipped = { box: null, kept: 0 };
  if (pb) {
    const padY = (box[2] - box[0]) * REPLACE_JUDGE_RULE.pad, padX = (box[3] - box[1]) * REPLACE_JUDGE_RULE.pad;
    const cy = (pb[0] + pb[2]) / 2, cx = (pb[1] + pb[3]) / 2;
    placed = cy >= box[0] - padY && cy <= box[2] + padY && cx >= box[1] - padX && cx <= box[3] + padX;
    // T16f: the box is clipped to the piece's neighbourhood; a box mostly outside it is not in place (OQ-C11)
    clipped = clipBox(pb, pieceNeighbourhood(box));
    if (!clipped.box || clipped.kept < REPLACE_JUDGE_RULE.keep) placed = false;
  }
  const cost = Number(json.usage?.cost);
  return {
    held: !parsed.original_present && productPresent && placed,
    original_present: parsed.original_present === true,
    product_present: productPresent,
    product_box: clipped.box,
    product_box_raw: pb ? pb.map((n) => Math.round(n)) : null,
    box_kept: Number(clipped.kept.toFixed(3)),
    placed,
    count: Number.isFinite(Number(parsed.count)) ? Math.round(Number(parsed.count)) : null,
    rest_unchanged: Math.max(0, Math.min(3, Math.round(Number(parsed.rest_unchanged) || 0))),
    note: String(parsed.note || '').slice(0, 200),
    cost: Number.isFinite(cost) && cost > 0 ? cost : null,
  };
}
/** One replace-judge turn: { op: 'replace_judge', code, item, crop, result, box, count } → { ok, held, …, usd }. Reserved and settled like a judge. */
export async function handleReplaceJudge(body, env, ledger, { fetchImpl = fetch, log = () => {}, catalog = null } = {}) {
  if (!describe(env).configured) throw new EditError(503, 'not_configured', 'the edit function has no keys on this host');
  if (!codeOk(env, body?.code)) throw new EditError(403, 'code', 'wrong or missing unlock code');
  const item = catalogItem(catalog, body);
  const piece = pieceOk({ category: item.category, box: body?.box, count: body?.count }, item);
  const crop = String(body?.crop || ''), result = String(body?.result || '');
  for (const [name, img] of [['crop', crop], ['result', result]]) {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(img) || dataUrlBytes(img) > LIMITS.cropBytes) throw new EditError(400, 'bad_request', `${name} must be a JPEG, PNG or WebP data URL under 2 MB`);
  }
  if (ledger.total() + JUDGE_USD > ledger.cap) throw new EditError(429, 'cap', `the day's cap of $${ledger.cap} is reached`);
  const t0 = Date.now();
  const id = ledger.reserve({ ts: new Date().toISOString(), op: 'live_replace_judge', scene: String(body?.scene || ''), apartment: String(body?.apartment || ''), item: item.id, box: piece.box, count: piece.count, reserved_usd: JUDGE_USD, settled_usd: null, status: 'reserved' });
  try {
    const j = await replaceJudge(env, crop, result, piece.box, item, piece.count, fetchImpl);
    const usd = Math.round((j.cost ?? JUDGE_USD) * 10000) / 10000;
    ledger.settle(id, usd, { status: 'settled', held: j.held, original_present: j.original_present, product_present: j.product_present, product_box: j.product_box, product_box_raw: j.product_box_raw, box_kept: j.box_kept, placed: j.placed, judged_count: j.count, rest_unchanged: j.rest_unchanged, note: j.note, seconds: (Date.now() - t0) / 1000 });
    log(`live_replace_judge ${item.id} ${j.held ? 'held' : 'NOT held'} (old ${j.original_present ? 'still there' : 'gone'}, product ${j.product_present ? (j.placed ? 'in place' : 'elsewhere') : 'absent'}, rest ${j.rest_unchanged}/3) $${usd} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { ok: true, item: item.id, held: j.held, original_present: j.original_present, product_present: j.product_present, product_box: j.product_box, product_box_raw: j.product_box_raw, box_kept: j.box_kept, placed: j.placed, count: j.count, rest_unchanged: j.rest_unchanged, note: j.note, usd, ms: Date.now() - t0 };
  } catch (e) {
    ledger.settle(id, JUDGE_USD, { status: 'failed', error: String(e && e.message || e).slice(0, 200), seconds: (Date.now() - t0) / 1000 });
    if (e instanceof EditError) throw e;
    throw new EditError(502, 'replace_judge', String(e && e.message || e).slice(0, 200));
  }
}

/** The catalog row a request names, or a 400 `catalog` refusal. */
function catalogItem(catalog, body) {
  const id = String(body?.item || '');
  const item = catalog && /^[a-z0-9-]{2,24}$/.test(id) ? catalog[id] : null;
  if (!item) throw new EditError(400, 'catalog', 'unknown catalog item');
  return item;
}
/** A reference image is a small JPEG/PNG/WebP data URL whose bytes hash to the catalog row's photo (D-CAT-9). Returns the CANONICAL
    data URL of the verified bytes (T16f, the gate's N3: the vendor sees the bytes that were hashed, never the client's string — a
    string with whitespace or junk after the padding decodes to the same bytes), or null when the image is not this item's photo. */
function referenceOk(reference, item) {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(reference) || dataUrlBytes(reference) > LIMITS.referenceBytes) return null;
  const bytes = Buffer.from(reference.slice(reference.indexOf(',') + 1), 'base64');
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (!(sha.length === item.image_sha256.length && crypto.timingSafeEqual(Buffer.from(sha), Buffer.from(item.image_sha256)))) return null;
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
    : bytes.toString('latin1', 8, 12) === 'WEBP' ? 'image/webp' : reference.slice(5, reference.indexOf(';'));
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

/* The furniture judge (T12c). The people editor has a second way to fail that the border ring cannot see: it keeps the edges of the
   photo and redraws the middle larger (the table and the diners at twice their size; two of the first three live runs). A yes/no
   question to a vision model missed one of the two; boxing the largest piece of furniture in both views and comparing the boxes
   in code separated all twelve stored pairs (bad: overlap 0.15 and 0.42; good: 0.61–1.00). The browser asks for it only when a
   living change touches a large share of the view. */
export const JUDGE_USD = 0.004; // one vision call over two views; measured about $0.0025
const JUDGE_SYSTEM = `You locate one piece of furniture in two photos of the same room. Image 1 is the original; image 2 is an edited version.
Pick the LARGEST piece of furniture clearly visible in image 1 (a dining table, a sofa, a bed, a kitchen island, a TV unit, a
coffee table). Find the SAME piece in image 2. Box the whole piece (for a table: the table top and its legs, not the people, the
chairs or the dishes).
Return ONLY a JSON object: {"object": "short name", "box1": [ymin, xmin, ymax, xmax], "box2": [ymin, xmin, ymax, xmax], "found_in_2": true or false}
with the boxes normalized to 0-1000 of each image.`;
const JUDGE_RULE = { iou: 0.5, minArea: 0.6, maxArea: 1.6 };

/** Did the furniture keep its place and size? Returns { held, iou, ratio, object }. Throws EditError('judge') when it cannot tell. */
export async function judge(env, cropDataUrl, resultDataUrl, fetchImpl = fetch) {
  const res = await chatFetch(env, fetchImpl)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://habait.ai', 'X-Title': 'Habait Tour360 (edit judge)' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0,
      max_tokens: 900,
      reasoning: { max_tokens: 300 },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: JUDGE_SYSTEM },
        { role: 'user', content: [
          { type: 'text', text: 'Image 1 — the original:' }, { type: 'image_url', image_url: { url: cropDataUrl } },
          { type: 'text', text: 'Image 2 — the edit:' }, { type: 'image_url', image_url: { url: resultDataUrl } },
        ] },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new EditError(502, 'judge', 'judge HTTP ' + res.status);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch { throw new EditError(502, 'judge', 'judge returned no JSON'); }
  const box = (q) => (Array.isArray(q) && q.length === 4 && q.every((n) => Number.isFinite(n)) ? q.map(Number) : null);
  const b1 = box(parsed.box1), b2 = box(parsed.box2);
  const object = String(parsed.object || '').slice(0, 60);
  if (!b1) throw new EditError(502, 'judge', 'judge returned no box');
  if (!b2 || parsed.found_in_2 === false) return { held: false, iou: 0, ratio: 0, object };
  const area = (q) => Math.max(0, q[2] - q[0]) * Math.max(0, q[3] - q[1]);
  const inter = Math.max(0, Math.min(b1[2], b2[2]) - Math.max(b1[0], b2[0])) * Math.max(0, Math.min(b1[3], b2[3]) - Math.max(b1[1], b2[1]));
  const union = area(b1) + area(b2) - inter;
  const iou = union > 0 ? inter / union : 0;
  const ratio = area(b1) > 0 ? area(b2) / area(b1) : 0;
  const held = iou >= JUDGE_RULE.iou && ratio >= JUDGE_RULE.minArea && ratio <= JUDGE_RULE.maxArea;
  return { held, iou: Math.round(iou * 100) / 100, ratio: Math.round(ratio * 100) / 100, object };
}

/** One judge turn: { op: 'judge', code, crop, result } → { ok, held, iou, ratio, object }. Reserved and settled like an edit. */
export async function handleJudge(body, env, ledger, { fetchImpl = fetch, log = () => {} } = {}) {
  if (!describe(env).configured) throw new EditError(503, 'not_configured', 'the edit function has no keys on this host');
  if (!codeOk(env, body?.code)) throw new EditError(403, 'code', 'wrong or missing unlock code');
  const ok = (u) => /^data:image\/(jpeg|png|webp);base64,/.test(u) && dataUrlBytes(u) <= LIMITS.cropBytes;
  const crop = String(body?.crop || ''), result = String(body?.result || '');
  if (!ok(crop) || !ok(result)) throw new EditError(400, 'bad_request', 'crop and result must be JPEG, PNG or WebP data URLs under 2 MB');
  if (ledger.total() + JUDGE_USD > ledger.cap) throw new EditError(429, 'cap', `the day's cap of $${ledger.cap} is reached`);
  const t0 = Date.now();
  const id = ledger.reserve({ ts: new Date().toISOString(), op: 'live_judge', scene: String(body?.scene || ''), apartment: String(body?.apartment || ''), reserved_usd: JUDGE_USD, settled_usd: null, status: 'reserved' });
  try {
    const j = await judge(env, crop, result, fetchImpl);
    ledger.settle(id, JUDGE_USD, { status: 'settled', held: j.held, iou: j.iou, ratio: j.ratio, object: j.object, seconds: (Date.now() - t0) / 1000 });
    log(`live_judge ${j.held ? 'held' : 'NOT held'} iou ${j.iou} area x${j.ratio} (${j.object}) ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { ok: true, held: j.held, iou: j.iou, ratio: j.ratio, object: j.object, usd: JUDGE_USD, ms: Date.now() - t0 };
  } catch (e) {
    ledger.settle(id, JUDGE_USD, { status: 'failed', error: String(e && e.message || e).slice(0, 200), seconds: (Date.now() - t0) / 1000 });
    if (e instanceof EditError) throw e;
    throw new EditError(502, 'judge', String(e && e.message || e).slice(0, 200));
  }
}

/** The full instruction the editor gets: the frame rule (living changes and retries), the instruction, the scale rule, the keep-clause. */
export function assemble(prep, attempt = 1) {
  if (prep.catalog) return `${attempt > 1 ? FRAME + ' ' : ''}${prep.body} ${PRODUCT} ${KEEP.object}`;  // T16g: the request first, then the weight on the photo (the weight first re-framed the sofa twice)
  const strict = prep.living || attempt > 1;
  return `${strict ? FRAME + ' ' : ''}${prep.body} ${prep.living ? SCALE + ' ' : ''}${KEEP[prep.reach] || KEEP.object}`;
}

/** What a host says about itself. T18i (F9): with a `code` given (the page's `X-Tour-Code` header on its GET), `configured` is true
    only for the right one — a wrong link never sees the unlocked page; without a code (the internal checks) the keys alone decide. */
export function describe(env, catalog = null, code = undefined) {
  const keys = Boolean(env.FAL_KEY && hasChat(env) && (isOpen(env) || (env.TOUR_EDIT_CODE && String(env.TOUR_EDIT_CODE).length >= 8)));
  const configured = code === undefined ? keys : keys && codeOk(env, code);
  return {
    configured,
    ...(isOpen(env) ? { open: true } : {}),
    ...(code !== undefined && keys && !configured ? { reason: 'code' } : {}),
    models: Object.keys(MODELS),
    scope: SCOPE,
    attempts: MAX_ATTEMPTS,
    limits: LIMITS,
    catalog: { items: catalog ? Object.keys(catalog).length : 0 },
  };
}

/** Eliran 2026-11-04 (plan 2026-11-04-apt-furniture-swap D5): "כל מי שנכנס לאתר" — an open host takes every visitor; the per-IP
    limit (server/vercel-edit.mjs) and the daily cap guard the spend. */
export const isOpen = (env) => String(env.TOUR_EDIT_OPEN || '') === '1';

function codeOk(env, code) {
  if (isOpen(env)) return true;
  const want = String(env.TOUR_EDIT_CODE || '');
  const got = String(code || '');
  if (want.length < 8 || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

function dataUrlBytes(s) {
  const i = s.indexOf(',');
  return i < 0 ? 0 : Math.floor(((s.length - i - 1) * 3) / 4);
}

export class EditError extends Error {
  constructor(status, reason, message) { super(message || reason); this.status = status; this.reason = reason; }
}

/** The text step: the visitor's words → an English instruction, or a refusal with a reason. */
export async function prepare(env, instruction, lang, fetchImpl = fetch, item = null, piece = null) {
  const res = await chatFetch(env, fetchImpl)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://habait.ai', 'X-Title': 'Habait Tour360 (edit)' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0,
      max_tokens: 1200, // reasoning and output share this ceiling on OpenRouter (the estate's measured fact)
      reasoning: { max_tokens: 400 },
      response_format: { type: 'json_object' },
      messages: item
        ? [
          { role: 'system', content: SYSTEM + '\n\n' + CATALOG_SYSTEM },
          { role: 'user', content: `Language hint: ${lang || 'unknown'}\nCatalog item (the second image): ${item.name} — ${item.category.replace('_', ' ')} — ${item.description_en}${piece ? '\n' + pieceLine(piece) : ''}\nRequest: ${instruction}` },
        ]
        : [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Language hint: ${lang || 'unknown'}\nRequest: ${instruction}` },
        ],
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new EditError(502, 'text_model', 'text step HTTP ' + res.status);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch { throw new EditError(502, 'text_model', 'text step returned no JSON'); }
  let reason = REASONS.includes(parsed.reason) ? parsed.reason : (parsed.allowed ? 'ok' : 'unclear');
  let reach = REACHES.includes(parsed.reach) ? parsed.reach : 'object';
  if (reason === 'structure') reach = 'structure';
  // the scope switches decide, not the text model: a reach that is off is refused with its own reason
  if (reason === 'ok' && !SCOPE[reach]) reason = reach === 'view' ? 'view' : 'structure';
  const allowed = parsed.allowed === true && reason === 'ok' && typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 20;
  const body = allowed ? String(parsed.prompt).trim().replace(/\s+/g, ' ').slice(0, 900) : '';
  const out = {
    allowed,
    reason: allowed ? 'ok' : reason,
    reach,
    living: parsed.living === true,
    target: String(parsed.target || '').slice(0, 80),
    change: String(parsed.change || '').slice(0, 120),
    sizeChange: parsed.size_change === true,
    body,
    usage: json.usage || null,
  };
  // a catalog turn is a furniture swap whatever the model said about reach, living or size: the switches decide, not the model
  if (item) Object.assign(out, { catalog: true, item: item.id, reach: allowed ? 'object' : reach, living: false, sizeChange: false });
  return out;
}

/** Which editor takes the turn: size changes → flux3 (the only one that resizes), people and pets → nb2, everything else → kontext.
    Later attempts (the browser refused a result): a living change gets the people editor a second time — its failure is a matter
    of the run, about one in five on the dining table — and Kontext on the third; anything else goes to nb2 on its second attempt. */
export const MAX_ATTEMPTS = { living: 3, other: 2, catalog: 2 };
export function routeModel(prep, attempt = 1) {
  if (prep.catalog) return 'nb2'; // the one editor that takes a second image (the product photo)
  if (prep.living) return attempt >= 3 ? 'kontext' : 'nb2';
  if (attempt > 1) return 'nb2';
  return prep.sizeChange ? 'flux3' : 'kontext';
}

/** The image step: one fal call, the result returned as a data URL. A reference (the product photo) rides only with nb2. */
export async function edit(env, modelKey, cropDataUrl, prompt, fetchImpl = fetch, referenceDataUrl = null) {
  const m = MODELS[modelKey];
  const payload = modelKey === 'flux3'
    ? { prompt, image_urls: [cropDataUrl], aspect_ratio: 'auto', resolution: '1k', output_format: 'jpeg', enable_prompt_expansion: false, safety_tolerance: 2 }
    : modelKey === 'nb2'
      ? { prompt, image_urls: referenceDataUrl ? [cropDataUrl, referenceDataUrl] : [cropDataUrl], aspect_ratio: 'auto', resolution: '1K', num_images: 1, output_format: 'jpeg' }
      : { prompt, image_url: cropDataUrl, num_images: 1, output_format: 'jpeg', guidance_scale: 3.5, safety_tolerance: '2' };
  const res = await fetchImpl('https://fal.run/' + m.id, {
    method: 'POST',
    headers: { Authorization: 'Key ' + env.FAL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(m.slow ? 240_000 : 120_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new EditError(502, res.status === 422 ? 'vendor_refused' : 'vendor', `editor HTTP ${res.status}: ${body}`);
  }
  const json = await res.json();
  const img = json.images?.[0];
  if (!img?.url) throw new EditError(502, 'vendor', 'editor returned no image');
  let dataUrl = img.url;
  if (!dataUrl.startsWith('data:')) {
    const r = await fetchImpl(img.url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new EditError(502, 'vendor', 'result fetch HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    dataUrl = `data:${r.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
  }
  return { dataUrl, width: img.width || null, height: img.height || null, seed: json.seed ?? null, nsfw: Array.isArray(json.has_nsfw_concepts) ? json.has_nsfw_concepts[0] === true : false };
}

/** One edit turn. `ledger` is { total(), reserve(row) → id, settle(id, usd, patch) } — the laptop keeps a file, the function a day counter. */
export async function handleEdit(body, env, ledger, { fetchImpl = fetch, log = () => {}, catalog = null } = {}) {
  if (body?.op === 'judge') return handleJudge(body, env, ledger, { fetchImpl, log });
  if (body?.op === 'likeness') return handleLikeness(body, env, ledger, { fetchImpl, log, catalog });
  if (body?.op === 'replace_judge') return handleReplaceJudge(body, env, ledger, { fetchImpl, log, catalog });
  if (!describe(env).configured) throw new EditError(503, 'not_configured', 'the edit function has no keys on this host');
  if (!codeOk(env, body?.code)) throw new EditError(403, 'code', 'wrong or missing unlock code');
  // a catalog turn (T14b): the item must be in this host's catalog and the reference image must be that item's photo, byte for byte
  const item = body?.item ? catalogItem(catalog, body) : null;
  const reference = item ? referenceOk(String(body?.reference || ''), item) : null;  // T16f: the canonical data URL of the verified bytes, or null
  if (item && !reference) throw new EditError(400, 'catalog', 'the reference image is not this catalog item');
  // the tapped piece (T16b): only with an item; checked, never trusted
  let piece = item && body?.piece !== undefined ? pieceOk(body.piece, item) : null;
  const instruction = String(body?.instruction || '').trim() || (item ? item.name : '');
  if (instruction.length < 2 || instruction.length > LIMITS.instructionChars) throw new EditError(400, 'bad_request', 'instruction length');
  const crop = String(body?.crop || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(crop) || dataUrlBytes(crop) > LIMITS.cropBytes) throw new EditError(400, 'bad_request', 'crop must be a JPEG, PNG or WebP data URL under 2 MB');
  const lang = ['he', 'en', 'fr'].includes(body?.lang) ? body.lang : 'unknown';
  const attempt = [2, 3].includes(body?.attempt) ? body.attempt : 1;
  const t0 = Date.now();

  // reserve the worst case for the whole turn (the text step + the dearest editor) before anything is sent; the cap stops the turn here
  const reserve = MAX_RESERVE + (piece && !piece.seen ? 2 * PIECE_SEEN_USD : 0); // T18a: the piece-seen call (two tries at most) rides a piece turn
  if (ledger.total() + reserve > ledger.cap) {
    throw new EditError(429, 'cap', `the day's cap of $${ledger.cap} is reached`);
  }
  const id = ledger.reserve({ ts: new Date().toISOString(), op: 'live_edit', scene: String(body?.scene || ''), apartment: String(body?.apartment || ''), lang, instruction, attempt, ...(item ? { item: item.id } : {}), ...(piece ? { piece } : {}), reserved_usd: reserve, settled_usd: null, status: 'reserved' });
  let seen = null, seenUsd = 0;
  try {
    if (piece) {
      if (piece.seen) seen = piece.seen; // attempt 2 carries attempt 1's answer: no second call
      else {
        for (let tries = 1; tries <= 2 && !(seen && seen.found); tries++) { // two tries: a malformed answer is the model's, not the piece's
          try { const { usd: su, ...rest } = await pieceSeen(env, crop, piece, item, fetchImpl); seen = { ...rest, tries }; seenUsd += su; }
          catch (e) { seen = { found: false, box: null, outline: null, touches_edge: [], note: 'seen: ' + String(e && e.message || e).slice(0, 80), tries }; seenUsd += e instanceof EditError && /HTTP/.test(e.message) ? 0 : PIECE_SEEN_USD; }
        }
        seenUsd = Math.round(seenUsd * 10000) / 10000;
      }
      if (seen.found) piece = { ...piece, seen };
    }
    const prep = await prepare(env, instruction, lang, fetchImpl, item, piece);
    if (!prep.allowed) {
      ledger.settle(id, TEXT_USD + seenUsd, { status: 'refused', reason: prep.reason, reach: prep.reach, seconds: (Date.now() - t0) / 1000 });
      return { ok: false, reason: prep.reason, reach: prep.reach, target: prep.target, usd: TEXT_USD + seenUsd, ms: Date.now() - t0 };
    }
    const modelKey = routeModel(prep, attempt);
    const m = MODELS[modelKey];
    const prompt = assemble(prep, attempt);
    const out = await edit(env, modelKey, crop, prompt, fetchImpl, reference);
    const usd = Math.round((TEXT_USD + seenUsd + m.usd) * 1000) / 1000;
    ledger.settle(id, usd, { status: 'settled', model: m.id, reach: prep.reach, living: prep.living, prompt_en: prompt, target: prep.target, change: prep.change, seconds: (Date.now() - t0) / 1000, result_size: out.width && out.height ? [out.width, out.height] : null, seed: out.seed, ...(piece ? { seen_found: !!(seen && seen.found), seen_box: seen ? seen.box : null, seen_usd: seenUsd } : {}) });
    log(`live_edit ok ${m.id} ${prep.reach}${prep.living ? ' living' : ''}${item ? ' catalog ' + item.id : ''}${attempt > 1 ? ' attempt ' + attempt : ''} $${usd.toFixed(3)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { ok: true, image: out.dataUrl, prompt, target: prep.target, change: prep.change, reach: prep.reach, living: prep.living, attempt, model: m.id, modelKey, usd, ms: Date.now() - t0, slow: m.slow, ...(item ? { catalog: true, item: item.id } : {}), ...(piece ? { piece, piece_seen: seen } : {}) };
  } catch (e) {
    if (e instanceof EditError) {
      // a vendor refusal or a transport error after the text step: settle the text step only, keep nothing reserved
      ledger.settle(id, (e.reason === 'text_model' ? 0 : TEXT_USD) + seenUsd, { status: 'failed', reason: e.reason, error: String(e.message).slice(0, 200), seconds: (Date.now() - t0) / 1000 });
      throw e;
    }
    ledger.settle(id, TEXT_USD + seenUsd, { status: 'unknown', error: String(e && e.message || e).slice(0, 200), seconds: (Date.now() - t0) / 1000 });
    throw new EditError(500, 'error', String(e && e.message || e).slice(0, 200));
  }
}

/** A day ledger for a host with no durable disk: counts settled spend per UTC day in memory (best effort, per instance). */
export function memoryLedger(cap = LIMITS.dailyUsd) {
  let day = '';
  let rows = [];
  const roll = () => { const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; rows = []; } };
  return {
    cap,
    total() { roll(); return rows.reduce((t, r) => t + (r.settled_usd ?? r.reserved_usd), 0); },
    reserve(row) { roll(); rows.push(row); return rows.length - 1; },
    settle(i, usd, patch) { roll(); if (rows[i]) Object.assign(rows[i], patch, { settled_usd: usd }); },
    rows() { roll(); return rows.slice(); },
  };
}
