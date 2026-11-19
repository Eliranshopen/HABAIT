/* The tier-1 walk-in's numbers (WALKAROUND-QUALITY-PLAN.md §3.2, card Q08, D-WQ-14). No imports, erasable TypeScript only, so the
   engine's tests load this file with plain node. Degrees throughout. */

export type WalkConfig = {
  /** the forward move, ms (the card: 0.5–0.8 s) */
  moveMs: number;
  /** how much the frame is magnified by the end of the move (a pinhole camera that narrows its field of view from h to h' shows
      exactly this uniform magnification about the centre: k = tan(h/2) / tan(h'/2)) */
  zoom: number;
  /** the share of the move after which the target may start to fade in */
  fadeAt: number;
  /** the target arrives this much wider and narrows to its resting field of view while it fades in (the forward motion goes on) */
  settle: number;
  /** the share of the move over which the sharp frame gives way to the blurred one (the blur ramp) */
  blurIn: number;
};

export const WALK_DEFAULT: WalkConfig = { moveMs: 650, zoom: 1.6, fadeAt: 0.35, settle: 1.08, blurIn: 0.45 };

/** an angle folded into (-180, 180] */
export function wrap180(d: number): number {
  const r = ((((d + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/** the plan bearing from a to b: degrees clockwise from the top of the plan image (y grows downward) — the bearing of
    tools/make-scenes.mjs and of tour.js, folded into (-180, 180] */
export function planBearing(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return wrap180((Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI);
}

/** where the visitor looks on arrival: the direction of travel (source camera → target camera on the plan) in the target panorama's
    yaw frame, whose yaw 0 looks at plan bearing `centreBearingDeg` */
export function arrivalYaw(from: { x: number; y: number }, to: { x: number; y: number }, centreBearingDeg: number): number {
  return wrap180(planBearing(from, to) - centreBearingDeg);
}

/** the turn to the door before the move: none under 3°, else 160 ms + 2.2 ms a degree, at most 560 ms (a half turn) */
export function turnMs(deltaDeg: number): number {
  const a = Math.abs(deltaDeg);
  if (a < 3) return 0;
  return Math.min(560, Math.round(160 + 2.2 * a));
}

/** the move's clock: the target fades in from max(fadeAt · moveMs, the moment it is ready), over the rest of the move — never
    shorter than 260 ms, so a late target still arrives as a fade and not a cut */
export function fadeWindow(cfg: WalkConfig, readyAtMs: number): { start: number; ms: number; end: number } {
  const start = Math.max(cfg.fadeAt * cfg.moveMs, readyAtMs);
  const ms = Math.max(260, cfg.moveMs - start);
  return { start, ms, end: start + ms };
}

/** the field of view (degrees) a magnification k of a frame of horizontal field h shows: the hfov the zoom narrows to */
export function hfovAfterZoom(hfovDeg: number, k: number): number {
  const D = Math.PI / 180;
  return (2 * Math.atan(Math.tan((hfovDeg * D) / 2) / k)) / D;
}

/* The field-of-view policy (WALKAROUND-QUALITY-PLAN.md OQ-2, Slava's eye of 2026-10-29): Pannellum's 100° horizontal default
   read as a fisheye, and the vertical field followed the window's shape with no cap — a near-square window got 93° up, a phone
   held upright 137°. The defaults are now a 28 mm lens's: 80° across, 45–100 allowed; and the vertical field never exceeds the cap
   whatever the window's shape — the range is cut from the top, and when the cut leaves no zoom room the floor moves down so a
   range of at least `spanMin` degrees remains (a phone held upright: 70–80° up, about 36–45° across, a phone photo's field). */
export const FOV_DEFAULT = { hfov: 80, minHfov: 45, maxHfov: 100, vfovCap: 80, vfovFloor: 5, spanMin: 10 };

/** the vertical field (degrees) a horizontal field shows in a window of this aspect (width / height), a pinhole camera */
export function vfovOf(hfovDeg: number, aspect: number): number {
  const D = Math.PI / 180;
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  return (2 * Math.atan(Math.tan((hfovDeg * D) / 2) / a)) / D;
}
/** the horizontal field (degrees) a vertical field shows in a window of this aspect */
export function hfovOf(vfovDeg: number, aspect: number): number {
  const D = Math.PI / 180;
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  return (2 * Math.atan(Math.tan((vfovDeg * D) / 2) * a)) / D;
}
/** the vertical range PSV is given for a scene's horizontal bounds in a window of this aspect, under the policy's cap */
export function fovRange(minHfov: number, maxHfov: number, aspect: number, cap = FOV_DEFAULT.vfovCap, floor = FOV_DEFAULT.vfovFloor, spanMin = FOV_DEFAULT.spanMin): { min: number; max: number } {
  const max = Math.min(cap, Math.max(floor, vfovOf(maxHfov, aspect)));
  let min = Math.min(max, Math.max(floor, vfovOf(minHfov, aspect)));
  if (max - min < spanMin) min = Math.max(floor, max - spanMin);
  return { min, max };
}

/** a walk configuration from the page's `default.walkIn` (false or absent: no walk; true: the defaults; an object: merged, clamped
    to the card's 0.5–0.8 s and to sane magnifications) */
export function walkConfig(raw: unknown): WalkConfig | null {
  if (!raw) return null;
  const o = (typeof raw === 'object' ? raw : {}) as Partial<WalkConfig>;
  const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    moveMs: num(o.moveMs, WALK_DEFAULT.moveMs, 500, 800),
    zoom: num(o.zoom, WALK_DEFAULT.zoom, 1.05, 3),
    fadeAt: num(o.fadeAt, WALK_DEFAULT.fadeAt, 0, 0.9),
    settle: num(o.settle, WALK_DEFAULT.settle, 1, 1.3),
    blurIn: num(o.blurIn, WALK_DEFAULT.blurIn, 0.1, 1),
  };
}
