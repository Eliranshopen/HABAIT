/* The engine's PSV adapter (WALKAROUND-QUALITY-PLAN.md §3.2, card Q06, D-WQ-15): ONE viewer that shows both
     · an equirect URL (a string) — today's panoramas, and every scene the change bar composes (a blob: URL), through PSV's own
       EquirectangularAdapter, unchanged; and
     · a tiled cube (an object with tileUrl) — tools/make-tiles.mjs's faces, through PSV 5.15.1's CubemapTilesAdapter: the six 512 px
       preview faces paint first, then only the tiles the view needs, at the level the device needs.
   PSV takes one adapter for the life of a viewer and builds a new mesh for every panorama (Renderer.setTexture / .transition call
   createMesh(panoData)), so this adapter routes every call by the panorama it is about: a cube carries panoData.isCubemap and a
   THREE.Group mesh; an equirect neither. The tiles adapter is told nothing about an equirect scene: its refresh is a no-op while the
   viewer shows a URL (PSV's own refresh would read the URL as a tile configuration), and a transition that ends on an equirect clears
   its tile state instead of adopting the equirect's mesh.
   The level: PSV picks the first level whose average density covers the viewer's CSS size; a phone draws 2–3 device pixels a CSS
   pixel, so the picker is fed the size × min(devicePixelRatio, 2) for the length of one synchronous refresh (`levelScale`). */
import { AbstractAdapter, Cache, EquirectangularAdapter, events } from '@photo-sphere-viewer/core';
import { CubemapTilesAdapter } from '@photo-sphere-viewer/cubemap-tiles-adapter';
import { DataTexture, Group, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { pxPerDegAt, segmentVertex } from './cube-math';

export const isTilesPanorama = (p: any): boolean => !!p && typeof p === 'object' && typeof p.tileUrl === 'function';
const isGroup = (m: any): boolean => !!m && m.isGroup === true;

export type TileStats = { requested: number; byLevel: Record<string, number>; errors: number };

class TilesAdapter extends CubemapTilesAdapter {
  levelScale = 1;
  stats: TileStats = { requested: 0, byLevel: {}, errors: 0 };
  /** while true no new tile is asked for (the walk-in: a burst of tile decodes and uploads mid-move stalled the frame, measured);
      resume() asks for what the view needs at once */
  suspended = false;
  /** also drops the loads in flight: they finish but draw nothing (PSV checks isCancelled), and their tiles are un-marked so a later
      refresh asks for them again; PSV's queue.clear() is the one safe way to cancel (it resets its running count) */
  suspend() {
    this.suspended = true;
    const self = this as any;
    const ids = Object.keys(self.queue.tasks || {});
    self.queue.clear();
    for (const id of ids) delete self.state.tiles[id];
  }
  resume() { this.suspended = false; (this as any).__refresh(); }
  /** forget the tiles of a cube the viewer no longer shows (its mesh is disposed by the renderer) */
  off() {
    const self = this as any;
    self.__cleanup();
    self.state.geom = null;
    self.state.tileConfig = null;
  }
}
const base: any = CubemapTilesAdapter.prototype;
const T: any = TilesAdapter.prototype;
T.__refresh = function (this: any) {
  if (this.suspended) return; // a walk-in is under way (resume() refreshes)
  if (!isTilesPanorama(this.viewer.config.panorama)) return; // the viewer shows (or is loading) an equirect
  const st = this.viewer.state;
  const size = st.size;
  const k = this.levelScale;
  if (k === 1 || !size) return base.__refresh.call(this);
  st.size = { width: size.width * k, height: size.height * k };
  try {
    return base.__refresh.call(this);
  } finally {
    st.size = size;
  }
};
T.handleEvent = function (this: any, e: any) {
  if (e.type === events.TransitionDoneEvent.type && !isGroup(this.viewer.renderer.mesh)) {
    // the fade ended on an equirect: nothing of ours is on screen any more
    this.off();
    return;
  }
  return base.handleEvent.call(this, e);
};
T.__loadTile = function (this: any, tile: any, task: any) {
  this.stats.requested++;
  const lv = String(tile.config.level);
  this.stats.byLevel[lv] = (this.stats.byLevel[lv] || 0) + 1;
  return base.__loadTile.call(this, tile, task);
};
// A level denser than its source at every point of a face (the panorama's `noMipmapFrom`, from make-tiles' manifest) carries no detail
// finer than the source, so it is sampled without mipmaps — as PSV draws an equirect. Trilinear mipmapping of such a level, minified
// ~1.75× on a desktop's wide view, measured at less than half the sharpness of the plain equirect (spikes/wq/measure.mjs). A level at
// or under the source's density keeps its mipmaps: its detail reaches its own Nyquist and would shimmer when minified.
T.__swapMaterial = function (this: any, tile: any, material: any, isError: boolean) {
  const from = this.viewer.config.panorama && this.viewer.config.panorama.noMipmapFrom;
  const map = material && material.map;
  if (!isError && map && from && tile.config.faceSize >= from && map.generateMipmaps) {
    map.generateMipmaps = false;
    map.minFilter = LinearFilter;
    map.needsUpdate = true;
  }
  return base.__swapMaterial.call(this, tile, material, isError);
};

export class HybridAdapter extends AbstractAdapter<any, any, any, any> {
  static readonly id = 'habait-hybrid';
  static readonly VERSION = '5.15.1'; // PSV logs a console error for an adapter whose version differs from core's
  static readonly supportsDownload = false;
  readonly equi: EquirectangularAdapter;
  readonly tiles: TilesAdapter;

  constructor(viewer: any, config?: { tiles?: Record<string, unknown>; levelScale?: number }) {
    super(viewer);
    this.equi = new EquirectangularAdapter(viewer, {});
    // showErrorTile off: a missing tile keeps the preview under it rather than painting a warning sign into a sales link
    this.tiles = new TilesAdapter(viewer, { showErrorTile: false, baseBlur: false, antialias: true, ...(config && config.tiles) } as any);
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.tiles.levelScale = config && typeof config.levelScale === 'number' ? config.levelScale : Math.min(2, Math.max(1, dpr));
  }
  private keeper: Group | null = null;
  init() {
    super.init();
    this.equi.init();
    this.tiles.init();
    // Program keepers. A scene change disposes the old mesh's materials before the new mesh is drawn, so three.js frees the last
    // users of the textured MeshBasicMaterial program and compiles the very same program again on the next frame — a synchronous
    // link the trace of a walk-in showed as a 95 ms frame (GetProgramiv 50 ms + GetShaderiv 12 ms). Two never-disposed materials of
    // the same kinds (textured opaque; textured see-through, as during a fade) hold those programs open; they draw nothing
    // (colorWrite off) and cost two draw calls. PSV's own raycaster sphere already holds the plain see-through program.
    const tex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    const geo = new PlaneGeometry(1, 1);
    const keep = new Group();
    keep.name = 'habait-program-keepers';
    for (const m of [new MeshBasicMaterial({ map: tex }), new MeshBasicMaterial({ map: tex, transparent: true })]) {
      m.colorWrite = false;
      m.depthWrite = false;
      m.depthTest = false;
      const mesh = new Mesh(geo, m);
      mesh.frustumCulled = false;
      mesh.raycast = () => undefined; // never a hit for PSV's pointer (it raycasts every object in the scene)
      keep.add(mesh);
    }
    this.keeper = keep;
    (this.viewer as any).renderer.addObject(keep);
  }
  destroy() {
    if (this.keeper) {
      (this.viewer as any).renderer.removeObject(this.keeper);
      for (const m of this.keeper.children as Mesh[]) { (m.material as MeshBasicMaterial).map?.dispose(); (m.material as MeshBasicMaterial).dispose(); m.geometry.dispose(); }
      this.keeper = null;
    }
    this.tiles.destroy();
    this.equi.destroy();
    super.destroy();
  }

  supportsTransition(p: any) { return isTilesPanorama(p) ? this.tiles.supportsTransition(p) : this.equi.supportsTransition(); }
  supportsPreload(p: any) { return isTilesPanorama(p) ? this.tiles.supportsPreload(p) : this.equi.supportsPreload(); }
  textureCoordsToSphericalCoords(point: any, data: any) {
    return data && data.isCubemap ? this.tiles.textureCoordsToSphericalCoords(point, data) : this.equi.textureCoordsToSphericalCoords(point, data);
  }
  sphericalCoordsToTextureCoords(position: any, data: any) {
    return data && data.isCubemap ? this.tiles.sphericalCoordsToTextureCoords(position, data) : this.equi.sphericalCoordsToTextureCoords(position, data);
  }
  loadTexture(p: any, loader?: boolean, newPanoData?: any): Promise<any> {
    return isTilesPanorama(p) ? this.tiles.loadTexture(p, loader) : (this.equi as any).loadTexture(p, loader, newPanoData);
  }
  createMesh(panoData?: any): any {
    return panoData && panoData.isCubemap ? this.tiles.createMesh() : this.equi.createMesh(panoData);
  }
  setTexture(mesh: any, textureData: any, transition?: boolean) {
    if (textureData && textureData.panoData && textureData.panoData.isCubemap) {
      this.tiles.setTexture(mesh, textureData, Boolean(transition));
    } else {
      this.equi.setTexture(mesh, textureData);
      if (!transition) this.tiles.off(); // set directly: the cube before it is gone (a fade clears it when it ends)
    }
  }
  setTextureOpacity(mesh: any, opacity: number) {
    if (isGroup(mesh)) this.tiles.setTextureOpacity(mesh, opacity);
    else this.equi.setTextureOpacity(mesh, opacity);
  }
  disposeTexture(textureData: any) {
    if (textureData && textureData.panoData && textureData.panoData.isCubemap) this.tiles.disposeTexture(textureData);
    else if (textureData && textureData.texture) this.equi.disposeTexture(textureData);
  }
  disposeMesh(mesh: any) {
    if (isGroup(mesh)) this.tiles.disposeMesh(mesh);
    else this.equi.disposeMesh(mesh);
  }

  /** the walk-in pauses tile streaming for its length and resumes it on arrival (tiles then load with the view at rest) */
  setTilesSuspended(on: boolean) { if (on) this.tiles.suspend(); else if (this.tiles.suspended) this.tiles.resume(); }
  /** decode a cube preview's six faces off the main thread once PSV holds them (the walk's preload), so the hand-over's upload does
      not decode them synchronously; resolves when done, never rejects */
  predecode(p: any): Promise<void> {
    if (!isTilesPanorama(p) || !p.baseUrl) return Promise.resolve();
    const urls: string[] = ['left', 'right', 'top', 'bottom', 'back', 'front'].map((f) => p.baseUrl[f]).filter(Boolean);
    const key = urls[0]; // PSV's CubemapAdapter caches a cube's faces under its first path in this order
    const imgs = urls.map((u) => Cache.get(u, key)).filter((i: any) => i && typeof i.decode === 'function');
    return Promise.all(imgs.map((i: any) => i.decode().catch(() => undefined))).then(() => undefined);
  }

  // ── for proofs and measurements (read-only) ───────────────────────────────────────────────────────────────────
  get stats(): TileStats { return this.tiles.stats; }
  /** whether the picture on screen is a tiled cube */
  showingTiles(): boolean { return isGroup((this.viewer as any).renderer.mesh) && !!(this.tiles as any).state.geom; }
  /** the tile level loaded at a direction (radians) and the texels per degree it holds there; level −1 = the preview only */
  levelAt(yaw: number, pitch: number): { face: string; level: number; faceSize: number; pxPerDeg: number } | null {
    const st = (this.tiles as any).state;
    const pano = (this.viewer as any).config.panorama;
    if (!st.geom || !isTilesPanorama(pano)) return null;
    const seg = segmentVertex(yaw, pitch);
    const level = st.faces[seg.vertex];
    const levels: { faceSize: number }[] = pano.levels || [{ faceSize: pano.faceSize }];
    const td = (this.viewer as any).state.textureData;
    const previewSize = td && td.panoData && td.panoData.baseData ? td.panoData.baseData.faceSize : 0;
    const faceSize = typeof level === 'number' && level >= 0 && levels[level] ? levels[level].faceSize : previewSize;
    return { face: seg.face, level: typeof level === 'number' ? level : -1, faceSize, pxPerDeg: faceSize ? pxPerDegAt(yaw, pitch, faceSize) : 0 };
  }
}
