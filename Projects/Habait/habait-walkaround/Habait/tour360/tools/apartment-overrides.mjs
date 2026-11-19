/* Habait Tour360 — tools/apartment-overrides.mjs (2026-11-18, the Hatzav tour). Two things an apartment may carry for itself,
   read the same way by build-tour.mjs and smoke.mjs, so a tour that is not RAINBOW's keeps RAINBOW's interface with its own words
   and its own items:
     apartments/<id>/copy.json          — badge / conceptLine / aiNote (each ×3 languages) and any ui keys, merged OVER the copy
                                          pack copy/tour360-copy.json for this apartment only (its disclosure is its own);
     apartments/<id>/catalog/items.json — the apartment's own catalog (tour360/catalog.v1, AI rows' photos beside it), used by a
                                          --catalog build INSTEAD of catalog/items.json (RAINBOW's items never ride another tour).
   An apartment without either file builds exactly as before. */
import fs from 'node:fs';
import path from 'node:path';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** The copy pack with the apartment's own copy.json merged over it (a deep copy; the pack on disk is untouched). */
export function loadCopy(root, apt) {
  const copy = readJson(path.join(root, 'copy', 'tour360-copy.json'));
  const own = path.join(apt, 'copy.json');
  if (!fs.existsSync(own)) return copy;
  const o = readJson(own);
  for (const k of ['badge', 'conceptLine', 'aiNote']) if (o[k]) copy[k] = o[k];
  if (o.ui) copy.ui = { ...copy.ui, ...o.ui };
  copy.__apartmentCopy = true;
  return copy;
}

/** The catalog file a --catalog build of this apartment uses: its own when it has one, else the shared one. */
export function catalogFile(root, apt) {
  const own = path.join(apt, 'catalog', 'items.json');
  return fs.existsSync(own) ? own : path.join(root, 'catalog', 'items.json');
}
