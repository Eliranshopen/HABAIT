// Depth equirect -> a low displaced sphere mesh, textured with the panorama (card 13, B5).
//
// The mesh is the room as the panorama's camera saw it: every vertex sits on the ray of its (u, v) at the measured radial
// distance, so seen from the camera it projects exactly like the panorama on a plain sphere (the hand-off is seamless), and
// seen from anywhere else it gives the parallax of a real room (the floor slides under you, the walls come closer).
//
// Frames (shared with js/minimap.js, card 10):
//   plan cm   x right, y down, origin = the plan crop's top-left (tour360 cameras.json px / 2.25).
//   world m   three.js, Y up: X = x_cm / 100, Z = y_cm / 100, Y = height above the floor (camera at eye_m, 1.6).
//   bearing   degrees in plan space, 0 = up (-y = -Z), clockwise (+X). A panorama's centre (u = 0.5) faces bearing0
//             (scenes.json centreBearingDeg); u grows clockwise: bearing = bearing0 + (u - 0.5) * 360; pitch = (0.5 - v) * 180.
//   depth     360walkaround render_pano.py "rgb24-be": metres = (R<<16 | G<<8 | B) / 100, RADIAL distance from the camera,
//             0 = invalid (sky). Through glazing it is the distance to the pane. Rows top first, same grid as the panorama.
//
// Texturing is projective (equirectMaterial below): the vertices give the room its shape, the texel of every pixel comes
// from its direction seen from the panorama's camera.
// Pure functions (node + browser) first; the three.js part last.
import * as THREE from 'three';

export const DEPTH_SCALE = 100; // rgb24-be units per metre
const DEG = Math.PI / 180;

// ---------- pure ----------

// RGB(A) bytes of an rgb24-be depth image -> Float32Array metres (0 = invalid)
export function decodeDepthRGB(bytes, w, h, channels = 4) {
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < out.length; i++, p += channels) out[i] = ((bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2]) / DEPTH_SCALE;
  return out;
}

// Float32Array metres -> RGB bytes (rgb24-be, centimetre quantisation)
export function encodeDepthRGB(depth) {
  const out = new Uint8Array(depth.length * 3);
  for (let i = 0; i < depth.length; i++) {
    const v = Math.max(0, Math.min(0xffffff, Math.round(depth[i] * DEPTH_SCALE)));
    out[i * 3] = (v >> 16) & 255; out[i * 3 + 1] = (v >> 8) & 255; out[i * 3 + 2] = v & 255;
  }
  return out;
}

// block median (invalid 0s ignored) from w x h to ow x oh; the median keeps a wall a wall where a chair leg crosses it
export function downsampleDepth(depth, w, h, ow, oh) {
  const out = new Float32Array(ow * oh);
  const bw = w / ow, bh = h / oh;
  const buf = [];
  for (let oy = 0; oy < oh; oy++) {
    const y0 = Math.floor(oy * bh), y1 = Math.max(y0 + 1, Math.floor((oy + 1) * bh));
    for (let ox = 0; ox < ow; ox++) {
      const x0 = Math.floor(ox * bw), x1 = Math.max(x0 + 1, Math.floor((ox + 1) * bw));
      buf.length = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const d = depth[y * w + x]; if (d > 0) buf.push(d); }
      if (!buf.length) { out[oy * ow + ox] = 0; continue; }
      buf.sort((a, b) => a - b);
      out[oy * ow + ox] = buf[buf.length >> 1];
    }
  }
  return out;
}

// bilinear sample at (u, v) in [0,1]^2 of a depth map {w, h, data}: u wraps (the 360 seam), v clamps; invalid texels are
// skipped (weights renormalised); all four invalid -> fallback
export function sampleDepth(map, u, v, fallback = 0) {
  const { w, h, data } = map;
  const fx = u * w - 0.5, fy = Math.min(h - 1, Math.max(0, v * h - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const y1 = Math.min(h - 1, y0 + 1);
  const xa = ((x0 % w) + w) % w, xb = (xa + 1) % w;
  let s = 0, ws = 0;
  const add = (x, y, wt) => { const d = data[y * w + x]; if (d > 0 && wt > 0) { s += d * wt; ws += wt; } };
  add(xa, y0, (1 - tx) * (1 - ty)); add(xb, y0, tx * (1 - ty)); add(xa, y1, (1 - tx) * ty); add(xb, y1, tx * ty);
  return ws > 0 ? s / ws : fallback;
}

// unit direction of a plan bearing / pitch (degrees) in world m (Y up; bearing 0 = -Z, 90 = +X)
export function dirFromBearingPitch(bearingDeg, pitchDeg) {
  const b = bearingDeg * DEG, p = pitchDeg * DEG;
  return [Math.sin(b) * Math.cos(p), Math.sin(p), -Math.cos(b) * Math.cos(p)];
}

// bearing / pitch (degrees) of a world direction
export function bearingPitchOfDir(x, y, z) {
  const b = Math.atan2(x, -z) / DEG;
  return [((b % 360) + 360) % 360, Math.atan2(y, Math.hypot(x, z)) / DEG];
}

// the displaced sphere as flat arrays: (segW + 1) x (segH + 1) vertices (the seam column is duplicated so u runs 0..1),
// positions in world m around `origin`, uvs in three.js convention (flipY: uv.y = 1 - v), CCW-from-inside indices.
// Pole rows take the mean depth of their row so the cap closes on one point.
// maxRatio: a triangle whose corners' depths differ by more than this factor spans a depth edge (a sofa in front of a
// window); drawn as is, it is a rubber sheet that smears across the screen once the camera moves. edge = 'far' (default)
// redraws it on its own three vertices pushed back to its farthest corner's depth (the disoccluded strip lies on the
// background surface, textured with the edge pixels, as in Matterport's moves); 'drop' leaves a hole (the camera-centred
// panorama behind the mesh shows through). Infinity keeps every triangle as is.
export function buildDepthArrays(map, { segW = 64, segH = 32, origin = [0, 1.6, 0], bearing0 = 0, minDepth = 0.25, maxDepth = 60, fallback = 3, maxRatio = Infinity, edge = 'far' } = {}) {
  const nx = segW + 1, ny = segH + 1;
  const positions = new Float32Array(nx * ny * 3);
  const uvs = new Float32Array(nx * ny * 2);
  const depths = new Float32Array(nx * ny);
  const poleMean = (v) => { let s = 0, n = 0; for (let x = 0; x < map.w; x++) { const d = map.data[(v === 0 ? 0 : map.h - 1) * map.w + x]; if (d > 0) { s += d; n++; } } return n ? s / n : fallback; };
  const top = poleMean(0), bottom = poleMean(1);
  for (let j = 0; j < ny; j++) {
    const v = j / segH;
    for (let i = 0; i < nx; i++) {
      const u = i / segW;
      let d = j === 0 ? top : j === segH ? bottom : sampleDepth(map, u, v, fallback);
      d = Math.min(maxDepth, Math.max(minDepth, d));
      const [dx, dy, dz] = dirFromBearingPitch(bearing0 + (u - 0.5) * 360, (0.5 - v) * 180);
      const k = j * nx + i;
      positions[k * 3] = origin[0] + dx * d; positions[k * 3 + 1] = origin[1] + dy * d; positions[k * 3 + 2] = origin[2] + dz * d;
      uvs[k * 2] = u; uvs[k * 2 + 1] = 1 - v;
      depths[k] = d;
    }
  }
  const all = new Uint32Array(segW * segH * 6);
  let n = 0, dropped = 0;
  const keep = (a, b, c) => { const lo = Math.min(depths[a], depths[b], depths[c]), hi = Math.max(depths[a], depths[b], depths[c]); return hi <= lo * maxRatio; };
  for (let j = 0; j < segH; j++) for (let i = 0; i < segW; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (keep(a, c, b)) { all[n++] = a; all[n++] = c; all[n++] = b; } else dropped++;
    if (keep(b, c, d)) { all[n++] = b; all[n++] = c; all[n++] = d; } else dropped++;
  }
  if (edge !== 'far' || !dropped) return { positions, uvs, indices: all.slice(0, n), depths, segW, segH, dropped };
  // the far patches: 3 fresh vertices per edge triangle, on the same rays, at the triangle's largest depth
  const base = nx * ny, extra = dropped * 3;
  const P = new Float32Array((base + extra) * 3); P.set(positions);
  const UV = new Float32Array((base + extra) * 2); UV.set(uvs);
  const DD = new Float32Array(base + extra); DD.set(depths);
  const idx = new Uint32Array(n + extra); idx.set(all.subarray(0, n));
  let m = base, q = n;
  const far = (tri) => {
    const hi = Math.max(...tri.map((t) => depths[t]));
    for (const t of tri) {
      const s = hi / depths[t];
      for (let c = 0; c < 3; c++) P[m * 3 + c] = origin[c] + (positions[t * 3 + c] - origin[c]) * s;
      UV[m * 2] = uvs[t * 2]; UV[m * 2 + 1] = uvs[t * 2 + 1]; DD[m] = hi;
      idx[q++] = m++;
    }
  };
  for (let j = 0; j < segH; j++) for (let i = 0; i < segW; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (!keep(a, c, b)) far([a, c, b]);
    if (!keep(b, c, d)) far([b, c, d]);
  }
  return { positions: P, uvs: UV, indices: idx, depths: DD, segW, segH, dropped };
}

// ---------- browser ----------

// load an rgb24-be depth PNG without any colour management touching a byte -> {w, h, data: Float32Array metres}
export async function loadDepthMap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`depth ${url}: HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = cv.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  return { w: img.width, h: img.height, data: decodeDepthRGB(img.data, img.width, img.height, 4) };
}

// Projective equirect material: every fragment looks its texel up from the direction (fragment - origin), so the mesh is
// textured exactly as the panorama's camera saw it, independent of the tessellation (affine UVs on a displaced 64 x 32 mesh
// warp inside each cell). fromCamera: the origin is the camera itself (the "sky": a plain panorama sphere).
// Output = the texel bytes (the renderer runs linear-passthrough, the texture NoColorSpace).
const VERT = `varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `uniform sampler2D map; uniform vec3 origin; uniform float bearing0; uniform float fromCamera; uniform float opacity;
varying vec3 vW;
const float PI = 3.141592653589793;
void main() {
  vec3 o = fromCamera > 0.5 ? cameraPosition : origin;
  vec3 d = normalize(vW - o);
  float u = fract(0.5 + (atan(d.x, -d.z) - bearing0) / (2.0 * PI));
  float v = 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI;
  gl_FragColor = vec4(texture2D(map, vec2(u, 1.0 - v)).rgb, opacity);
}`;
export function equirectMaterial({ map = null, origin = [0, 0, 0], bearing0 = 0, fromCamera = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, origin: { value: new THREE.Vector3(...origin) }, bearing0: { value: bearing0 * Math.PI / 180 }, fromCamera: { value: fromCamera ? 1 : 0 }, opacity: { value: 1 } },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
  });
}

// a three.js mesh from buildDepthArrays, projectively textured from its camera (DoubleSide: from off-centre points a fold may
// face away; it is still the room)
export function createDepthMesh(arrays, texture, { origin = [0, 0, 0], bearing0 = 0 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, equirectMaterial({ map: texture, origin, bearing0 }));
}
