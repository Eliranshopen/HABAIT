/* Cube-face maths for the tiles adapter (WALKAROUND-QUALITY-PLAN.md card Q06). No imports, erasable TypeScript only, so the engine's
   tests load this file with plain node. The convention is Photo Sphere Viewer 5.15.1's CubemapAdapter (flipTopBottom false) — the
   same formula tools/make-tiles.mjs cuts the faces with: a face point (u, v) in [-1, 1] has the direction whose yaw = atan2(Y, X) and
   pitch = −asin(Z/|d|), with front (1, u, v) · right (−u, 1, v) · left (u, −1, v) · back (−1, −u, v) · bottom (v, −u, 1) ·
   top (−v, −u, −1). Angles in radians unless a name says degrees. */

export type Face = 'left' | 'front' | 'right' | 'back' | 'top' | 'bottom';
/** the order PSV's tiles mesh lays its six faces out in (CubemapTilesAdapter CUBE_HASHMAP) */
export const MESH_FACE_ORDER: Face[] = ['left', 'right', 'top', 'bottom', 'back', 'front'];
/** PSV's tiles mesh: 16×16 segments a face, 6 vertices a segment */
export const CUBE_SEGMENTS = 16;
export const VERTICES_PER_FACE = 6 * CUBE_SEGMENTS * CUBE_SEGMENTS;

/** a direction → the face it falls on and its face coordinates u, v in [-1, 1] (the inverse of PSV's face formula) */
export function dirToFace(yaw: number, pitch: number): { face: Face; u: number; v: number } {
  const X = Math.cos(pitch) * Math.cos(yaw);
  const Y = Math.cos(pitch) * Math.sin(yaw);
  const Z = -Math.sin(pitch);
  const ax = Math.abs(X), ay = Math.abs(Y), az = Math.abs(Z);
  if (ax >= ay && ax >= az) return X > 0 ? { face: 'front', u: Y / X, v: Z / X } : { face: 'back', u: Y / X, v: Z / -X };
  if (ay >= az) return Y > 0 ? { face: 'right', u: -X / Y, v: Z / Y } : { face: 'left', u: X / -Y, v: Z / -Y };
  return Z > 0 ? { face: 'bottom', u: -Y / Z, v: X / Z } : { face: 'top', u: Y / Z, v: X / Z };
}

/** PSV's face formula: a face point → its direction (yaw, pitch) */
export function faceToDir(face: Face, u: number, v: number): { yaw: number; pitch: number } {
  let x = 0, y = 0, z = 0;
  switch (face) {
    case 'front': x = 1; y = u; z = v; break;
    case 'right': x = -u; y = 1; z = v; break;
    case 'left': x = u; y = -1; z = v; break;
    case 'back': x = -1; y = -u; z = v; break;
    case 'bottom': x = v; y = -u; z = 1; break;
    case 'top': x = -v; y = -u; z = -1; break;
  }
  const d = Math.sqrt(x * x + y * y + z * z);
  return { yaw: Math.atan2(y / d, x / d), pitch: -Math.asin(z / d) };
}

/** the index of the first vertex of the mesh segment that shows a direction (PSV keys its per-segment level by it) */
export function segmentVertex(yaw: number, pitch: number): { face: Face; vertex: number; row: number; col: number } {
  const { face, u, v } = dirToFace(yaw, pitch);
  const col = Math.min(CUBE_SEGMENTS - 1, Math.max(0, Math.floor(((u + 1) / 2) * CUBE_SEGMENTS)));
  const row = Math.min(CUBE_SEGMENTS - 1, Math.max(0, Math.floor(((v + 1) / 2) * CUBE_SEGMENTS)));
  return { face, row, col, vertex: MESH_FACE_ORDER.indexOf(face) * VERTICES_PER_FACE + 6 * (CUBE_SEGMENTS * row + col) };
}

/** texels per degree of visual angle a face of `faceSize` pixels holds at a direction — the worse of the two axes, measured on the
    face by a 0.02° step (one-sided where the step would cross a face edge) */
export function pxPerDegAt(yaw: number, pitch: number, faceSize: number): number {
  const d = (0.02 * Math.PI) / 180;
  const span = (a: { face: Face; u: number; v: number }, b: { face: Face; u: number; v: number }) =>
    (a.face === b.face ? (Math.hypot(a.u - b.u, a.v - b.v) * faceSize) / 2 : NaN);
  const along = (f: (t: number) => { face: Face; u: number; v: number }) => {
    let s = span(f(-d / 2), f(d / 2));
    if (!Number.isFinite(s)) s = span(f(-d), f(0));
    if (!Number.isFinite(s)) s = span(f(0), f(d));
    return s;
  };
  const h = along((t) => dirToFace(yaw + t / Math.max(1e-6, Math.cos(pitch)), pitch)); // a 0.02° arc along the horizon of the view
  const v = along((t) => dirToFace(yaw, pitch + t));
  const deg = (d * 180) / Math.PI;
  return Math.min(h / deg, v / deg);
}

/** PSV 5.15.1's level picker (CubemapTilesAdapter getTileConfig) for a viewer of width × height CSS pixels drawn at `scale` device
    pixels a CSS pixel: the first level whose average density covers the view, else the top level. A mirror for the tests — the
    adapter feeds PSV's own picker a scaled size instead of re-implementing it. */
export function pickLevel(levels: { faceSize: number }[], hFovDeg: number, vFovDeg: number, width: number, height: number, scale = 1): number {
  const i = levels.findIndex((L) => ((L.faceSize * 4) / 360) * hFovDeg >= width * scale && ((L.faceSize * 2) / 180) * vFovDeg >= height * scale);
  return i === -1 ? levels.length - 1 : i;
}
