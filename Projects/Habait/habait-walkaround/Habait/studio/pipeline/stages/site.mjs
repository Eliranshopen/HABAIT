/* Stage 2 — site: the address becomes a place. Geocode (Nominatim) unless the project carries latlon, then
   OpenStreetMap buildings / coastline / main roads around it (Overpass), all in LOCAL METRES around the plot,
   +X east, +Y north. The tower itself is usually NOT in OSM (a sales plan is sold before the building exists),
   so site.json also carries what the intake read: floor, floors_total, floor-to-floor, north. */
import fs from 'node:fs';
import path from 'node:path';

const UA = 'habait-studio/0.1 (+https://habait.ai)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function fetchJson(url, init = {}, timeoutMs = 60000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) }, signal: ctl.signal });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const rows = await fetchJson(url);
  if (!rows.length) return null;
  const r = rows[0];
  return { lat: Number(r.lat), lon: Number(r.lon), display_name: r.display_name, type: r.type, importance: r.importance };
}

export async function overpass(lat, lon, radiusDeg) {
  const bbox = `${lat - radiusDeg},${lon - radiusDeg * 1.2},${lat + radiusDeg},${lon + radiusDeg * 1.2}`;
  const q = `[out:json][timeout:60];(way["building"](${bbox});relation["building"](${bbox});way["natural"="coastline"](${bbox});way["highway"~"^(primary|secondary|tertiary|trunk)$"](${bbox}););out tags geom 2000;`;
  let lastErr;
  for (const ep of OVERPASS) {
    try { return await fetchJson(ep, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 90000); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** lon/lat -> local metres around (lat0, lon0): +X east, +Y north (equirectangular, fine for a 1 km box). */
export function toLocal(lat0, lon0) {
  const R = 6371000;
  const kx = (Math.PI / 180) * R * Math.cos((lat0 * Math.PI) / 180);
  const ky = (Math.PI / 180) * R;
  return (lat, lon) => [Math.round((lon - lon0) * kx * 100) / 100, Math.round((lat - lat0) * ky * 100) / 100];
}

export function buildingsFromOverpass(elements, local) {
  const buildings = [], coast = [], roads = [];
  for (const e of elements) {
    const t = e.tags || {};
    if (t.building && e.type === 'way' && e.geometry) {
      const fp = e.geometry.map((g) => local(g.lat, g.lon));
      let h = Number(String(t.height || '').replace(/[^\d.]/g, ''));
      const levels = Number(t['building:levels']);
      let source = 'height';
      if (!h && levels) { h = levels * 3.1; source = 'levels'; }
      if (!h) { h = t.building === 'apartments' || t.building === 'residential' ? 12 : t.building === 'house' ? 6 : 9; source = 'default'; }
      buildings.push({ id: `${e.type}/${e.id}`, footprint_m: fp, height_m: Math.round(h * 10) / 10, height_source: source, name: t['name:he'] || t.name || null, kind: t.building });
    } else if (t.natural === 'coastline' && e.geometry) {
      coast.push(e.geometry.map((g) => local(g.lat, g.lon)));
    } else if (t.highway && e.geometry) {
      roads.push({ kind: t.highway, name: t['name:he'] || t.name || null, line_m: e.geometry.map((g) => local(g.lat, g.lon)) });
    }
  }
  return { buildings, coast, roads };
}

export default {
  id: 'site',
  title_he: 'האתר: כתובת → מיקום, סביבה, גובה',
  title_en: 'Site: address → place, OSM context, floor height',
  needs(ctx) { return ctx.derived('intake.json') ? null : 'intake.json missing (run intake first)'; },
  async run(ctx) {
    const intake = ctx.derived('intake.json');
    const p = ctx.project;
    const b = intake.building || {};
    const notes = [];
    let place = null, quality = 'manual';
    if (p.latlon && Number.isFinite(p.latlon.lat)) {
      place = { lat: p.latlon.lat, lon: p.latlon.lon, display_name: 'set by hand in the dashboard' };
    } else {
      const tries = [];
      if (p.address) tries.push(p.address);
      if (intake.address) tries.push(`${intake.address}${intake.city ? ', ' + intake.city : ''}`);
      if (intake.project_name && intake.city) tries.push(`${intake.project_name} ${intake.city}`);
      if (intake.city) tries.push(intake.city);
      for (const q of tries) {
        try {
          ctx.log(`geocoding "${q}"`);
          place = await geocode(q);
          if (place) { quality = q === intake.city ? 'city-only' : 'address'; ctx.log(`  -> ${place.display_name}`); break; }
          notes.push(`no geocode for "${q}"`);
        } catch (e) { notes.push(`geocode error for "${q}": ${e.message}`); }
      }
    }
    if (!place) return { status: 'blocked', note: `no location: ${notes.join('; ') || 'no address anywhere'}; set latlon in the dashboard` };

    let context = { buildings: [], coast: [], roads: [] }, osmNote = '';
    try {
      ctx.log('querying OpenStreetMap (Overpass) in a ~1 km box');
      const data = await overpass(place.lat, place.lon, 0.0045);
      context = buildingsFromOverpass(data.elements || [], toLocal(place.lat, place.lon));
      osmNote = `${context.buildings.length} buildings (${context.buildings.filter((x) => x.height_source !== 'default').length} with a known height), ${context.coast.length} coastline ways, ${context.roads.length} roads`;
      ctx.log(`  -> ${osmNote}`);
    } catch (e) {
      osmNote = `Overpass failed: ${e.message}`; notes.push(osmNote);
      // keep what an earlier run fetched: shift its local metres to the new origin (fine within a few km)
      const prev = ctx.derived('site.json');
      if (prev?.context?.buildings?.length && prev.origin) {
        const off = toLocal(place.lat, place.lon)(prev.origin.lat, prev.origin.lon); // the old origin, in new local metres
        const sh = (pts) => pts.map(([x, y]) => [Math.round((x + off[0]) * 100) / 100, Math.round((y + off[1]) * 100) / 100]);
        context = { buildings: prev.context.buildings.map((b) => ({ ...b, footprint_m: sh(b.footprint_m || []) })), coast: (prev.context.coast || []).map(sh), roads: (prev.context.roads || []).map((r) => (Array.isArray(r) ? sh(r) : { ...r, points: r.points ? sh(r.points) : r.points })) };
        osmNote += `; kept the previous OSM context shifted by ${off.map((v) => v.toFixed(0)).join(', ')} m`;
        notes.push(osmNote);
      }
    }

    // the coastline is often just outside the ~1 km box: keep an earlier run's (shifted to this origin) rather
    // than lose the sea
    const prevSite = ctx.derived('site.json');
    if (!context.coast?.length && prevSite?.context?.coast?.length && prevSite.origin) {
      const off = toLocal(place.lat, place.lon)(prevSite.origin.lat, prevSite.origin.lon);
      context.coast = prevSite.context.coast.map((w) => w.map(([x, y]) => [Math.round((x + off[0]) * 100) / 100, Math.round((y + off[1]) * 100) / 100]));
      notes.push(`coastline kept from the previous run (origin ${prevSite.origin.lat},${prevSite.origin.lon}), shifted ${off.map((v) => v.toFixed(0)).join(', ')} m`);
    }
    const plan = ctx.derived('plan.json');
    // facts the sheet does not carry but the operator knows (e.g. the developer's site says 42 floors):
    // project.options.site = { floors_total, floors_source }
    const so = ctx.project.options?.site || {};
    if (so.floors_total) notes.push(`floors_total ${so.floors_total} from ${so.floors_source || 'project options'}`);
    const site = {
      schema: 'habait-studio/site.v1',
      origin: { lat: place.lat, lon: place.lon, display_name: place.display_name, quality },
      frame: 'local metres around origin: +X east, +Y north; the plan frame is rotated by north_deg (bearing of true north, clockwise from the top of the unit plan)',
      // the operator's measured north (options.site.north_deg) beats the plan's, which beats the LLM's reading of the
      // arrow (the 846 intake read 225° for a measured 291.6°, and the cadastral fit says 304.4°)
      north_deg: so.north_deg ?? plan?.plan_meta?.north_deg ?? intake.drawing?.north_deg_clockwise_from_up ?? null,
      floor_of_unit: b.floor_of_unit ?? null,
      floors_total: so.floors_total ?? b.floors_total ?? null,
      floor_to_floor_cm: b.typical_floor_to_floor_cm ?? 320,
      ground_offset_cm: plan?.plan_meta?.ground_offset_cm ?? (b.floor_of_unit ? -(b.floor_of_unit - 1) * (b.typical_floor_to_floor_cm ?? 320) : null),
      tower: {
        name: b.name || null,
        footprint_m: null,
        footprint_note: 'null = the clay stage extrudes the apartment footprint (+1 m) as the tower mass; a traced floor key or the architect DWG replaces it',
        floors_total: so.floors_total ?? b.floors_total ?? null,
      },
      context,
      notes,
      _meta: { at: new Date().toISOString(), osm: osmNote },
    };
    ctx.saveDerived('site.json', site);
    const status = quality === 'city-only' ? 'needs-review' : 'done';
    return { status, note: `${quality}: ${place.display_name?.slice(0, 60)}; ${osmNote}${site.north_deg == null ? '; north unknown' : ''}`, outputs: ['derived/site.json'] };
  },
};
