/* A Pannellum-compatible viewer over Photo Sphere Viewer (board habait-walkaround T11, D-T360-46 — step 1, parity).
   Today's tour (viewer/tour.js + viewer/edit-live.js) speaks Pannellum 2.5's API; this class answers exactly the part it uses,
   so the page, its CSS, its prepared changes and its typed change run unchanged while the picture is drawn by PSV:
     pannellum.viewer(container, { default, scenes })  — scenes: { panorama, yaw, pitch, hfov, minHfov, maxHfov, hotSpots }
     loadScene(id, pitch, yaw, hfov) · getScene() · isLoaded() · addScene(id, cfg) · removeScene(id)
     lookAt(pitch, yaw, hfov, animated, cb) · getYaw() · getPitch() · getHfov() · setHfov(h, animated)
     startAutoRotate(speed) · stopAutoRotate() · on('load' | 'scenechange' | 'error' | 'mousedown' | 'touchstart' | 'animatefinished')
   Pannellum's units are kept at the boundary: degrees, and a HORIZONTAL field of view (PSV's is vertical — converted with the
   container's aspect). Hotspots become PSV markers whose yaw/pitch are re-read every frame (tour.js moves a ring by mutating its
   hotspot object) and whose `sceneId` is read at click time (tour.js retargets a door to a room's changed scene).
   The HANDS are Pannellum's too (T19c F-1…F-4, F-6): PSV's own drag, pinch, wheel and keys are off, and the visitor's input runs
   Pannellum 2.5.6's own formulas — the drag, the touch pan, the pinch (0.1° a pixel), the wheel (0.05° a wheelDelta unit + a
   glide), the arrow/WASD/± keys, the glide after release (friction 0.15), the double-click zoom and the focus on mouse-down — so
   the new link turns and zooms exactly as the design link; PSV only draws. The room fade runs on Pannellum's curve (CSS `ease`).
   WALKAROUND-QUALITY-PLAN.md (2026-10-28) adds two things and changes nothing else on the surface:
     · tiles (card Q06): a scene config may carry `tiles` (tools/make-tiles.mjs's cube, see TilesDescriptor); while the scene shows
       exactly the picture the tiles encode (`tiles.of === panorama`) the viewer streams them through the hybrid adapter — the six
       preview faces first, the tiles the view needs after; a scene the change bar composes (a blob: URL) is an equirect as before;
     · the tier-1 walk-in (card Q08): with `default.walkIn`, a tap on a door marker (or walkTo(hotspot), the keyboard's way in)
       turns to the door, moves forward (the frame magnifies and blurs) while the target loads under it and fades in, and arrives at
       the hotspot's targetYaw — the page passes the direction of travel there. Under prefers-reduced-motion it is the instant swap.
       'scenechange' then carries a second argument, { walk: true }.
     · the field of view (OQ-2, Slava's eye of 2026-10-29): Pannellum's 100° default and its uncapped vertical field read as a
       fisheye; the defaults and the vertical cap now come from walk-math's FOV_DEFAULT / fovRange (80° across, 45–100 allowed,
       never more than 80° up whatever the window's shape — re-applied on every resize). A scene's own hfov/minHfov/maxHfov still win. */
import { Viewer, CONSTANTS } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { HybridAdapter } from './hybrid-adapter';
import { walkConfig, turnMs, fadeWindow, wrap180, fovRange as fovRangeOf, FOV_DEFAULT, type WalkConfig } from './walk-math';

const D = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of time */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-6) break; if (e > 0) hi = t; else lo = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
// Pannellum fades the old room out with `transition: opacity <sceneFadeDuration>` (CSS `ease`); PSV fades the new one in on
// inOutCubic, which shows it ~0.1–0.2 s later (T19c F-6). inOutCubic is used by nothing else in PSV 5.15.1 (core + markers).
(CONSTANTS.EASINGS as Record<string, (t: number) => number>).inOutCubic = cubicBezier(0.25, 0.1, 0.25, 1);

/** Pannellum 2.5.6's key codes: 0 zoom out (- _ Ctrl), 1 zoom in (+ = Shift), 2/6 up (↑ W), 3/7 down (↓ S), 4/8 left (← A), 5/9 right (→ D) */
const KEYS: Record<number, number> = { 109: 0, 189: 0, 17: 0, 173: 0, 107: 1, 187: 1, 16: 1, 61: 1, 38: 2, 87: 6, 40: 3, 83: 7, 37: 4, 65: 8, 39: 5, 68: 9 };
const CAPTURED = [16, 17, 27, 37, 38, 39, 40, 61, 65, 68, 83, 87, 107, 109, 173, 187, 189];
const isField = (t: EventTarget | null) => t instanceof HTMLElement && Boolean(t.closest('input, textarea, select, [contenteditable="true"]'));
/* the walk-in's curves: the turn eases in and out like a head turning; the arrival settles like a step ending */
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

type Fn = (...args: any[]) => void;
type Face = 'left' | 'front' | 'right' | 'back' | 'top' | 'bottom';
/** tools/make-tiles.mjs's cube for one scene, as the page passes it (paths relative to the page) */
export interface TilesDescriptor {
  /** the panorama URL these tiles encode — the tiles are used only while the scene's `panorama` is exactly this */
  of: string;
  /** the asset's tile folder, e.g. 'panos-tiles/04-living' */
  dir: string;
  /** largest last; 512 px tiles, nbTiles a power of two */
  levels: { faceSize: number; nbTiles: number }[];
  /** the six 512 px faces painted first, relative to dir */
  preview: Record<Face, string>;
  ext?: string;
  /** the smallest level denser than the source everywhere: from it up, tiles are drawn without mipmaps (make-tiles' manifest) */
  noMipmapFrom?: number | null;
}
type Walk = { cancelled: boolean; box: HTMLElement | null; canvases: HTMLCanvasElement[]; anims: Animation[] };
export interface Hotspot {
  type?: 'scene' | 'info';
  yaw: number;
  pitch: number;
  cssClass?: string;
  text?: string;
  createTooltipFunc?: (div: HTMLDivElement, args: any) => void;
  createTooltipArgs?: any;
  clickHandlerFunc?: (e: any, args: any) => void;
  clickHandlerArgs?: any;
  sceneId?: string;
  targetYaw?: number;
  targetPitch?: number;
  targetHfov?: number;
}
export interface SceneConfig {
  type?: string;
  panorama: string;
  yaw?: number;
  pitch?: number;
  hfov?: number;
  minHfov?: number;
  maxHfov?: number;
  hotSpots?: Hotspot[];
  tiles?: TilesDescriptor | null;
}
export interface TourConfig {
  default?: { firstScene?: string; sceneFadeDuration?: number; mouseZoom?: boolean; keyboardZoom?: boolean; [k: string]: unknown };
  scenes: Record<string, SceneConfig>;
}
type Range = { min: number; max: number };

export class CompatViewer {
  readonly psv: Viewer;
  private readonly markers: MarkersPlugin;
  private readonly el: HTMLElement;
  private readonly scenes: Record<string, SceneConfig>;
  private readonly handlers = new Map<string, Fn[]>();
  private readonly fade: number;
  private readonly keyboardZoom: boolean;
  private current: string;
  private loaded = false;
  private seq = 0;
  private loadedSeq = -1;
  private hfovRange: [number, number] = [FOV_DEFAULT.minHfov, FOV_DEFAULT.maxHfov];
  private lastHfov: number;
  private live = new Map<string, { hs: Hotspot; yaw: number; pitch: number }>();
  private rotSpeed = 0;
  private rotRaf = 0;
  private rotLast = 0;
  private pointerDown = false;
  private settleTimer = 0;
  private watchTimer = 0;
  private destroyed = false;
  // Pannellum's input state: the view as it holds it (degrees, the yaw unwrapped), its `speed`, the keys held, the drag
  private readonly mouseZoom: boolean;
  private readonly friction: number;
  private v = { yaw: 0, pitch: 0, hfov: FOV_DEFAULT.hfov };
  private speed = { yaw: 0, pitch: 0, hfov: 0 };
  private keys: boolean[] = new Array(10).fill(false);
  private dragging = false;
  private touching = false;
  private latest = 0;
  private down = { x: 0, y: 0, yaw: 0, pitch: 0 };
  private pinch = -1;
  private loopOn = false;
  private prevTime: number | undefined;
  private fading = false;
  // the walk-in (Q08) and the tiles (Q06)
  private readonly walkCfg: WalkConfig | null;
  private walking: Walk | null = null;
  /** the last walk's phases (performance.now ms) — read by the proofs (spikes/wq/walkin-frames.mjs), never by the page */
  walkTimes: Record<string, number> = {};
  private readonly panos = new WeakMap<SceneConfig, unknown>();

  constructor(container: string | HTMLElement, config: TourConfig) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) throw new Error('pannellum-compat: no container ' + String(container));
    this.el = el;
    this.scenes = { ...config.scenes };
    const d = config.default || {};
    this.fade = typeof d.sceneFadeDuration === 'number' ? d.sceneFadeDuration : 1000;
    this.keyboardZoom = d.keyboardZoom !== false;
    this.mouseZoom = d.mouseZoom !== false;
    this.friction = typeof d.friction === 'number' ? d.friction : 0.15;
    this.walkCfg = walkConfig(d.walkIn);
    if (el.tabIndex < 0) el.tabIndex = 0; // Pannellum: the container takes the keys
    this.current = d.firstScene && this.scenes[d.firstScene] ? d.firstScene : Object.keys(this.scenes)[0];
    const first = this.scenes[this.current];
    this.applyRange(first);
    this.lastHfov = first.hfov ?? FOV_DEFAULT.hfov;
    const r = this.fovRange();
    this.psv = new Viewer({
      container: el,
      adapter: [HybridAdapter, {}],
      panorama: this.panoramaOf(first),
      navbar: false,
      loadingTxt: '',
      defaultYaw: (first.yaw ?? 0) * D,
      defaultPitch: (first.pitch ?? 0) * D,
      minFov: r.min,
      maxFov: r.max,
      defaultZoomLvl: this.zoomFor(this.lastHfov, r),
      // PSV still tells a click from a drag (the markers' doors and rings); the moving itself is Pannellum's (below)
      mousemove: false,
      mousewheel: false,
      mousewheelCtrlKey: false,
      keyboard: false,
      touchmoveTwoFingers: false,
      plugins: [[MarkersPlugin, {}]],
    } as any);
    this.markers = this.psv.getPlugin(MarkersPlugin) as MarkersPlugin;
    // today's CSS styles `.t-pano .pnlm-container` (the ground behind the picture)
    (this.psv.container as HTMLElement).classList.add('pnlm-container');

    // Pannellum fires 'load' when the new picture is in and THEN fades: the same here — 'panorama-loaded' (the texture is ready,
    // the fade not yet run) rather than the end of setPanorama's transition, so the page's loading pill and rings come back as early
    this.psv.addEventListener('ready', () => this.afterLoad(this.seq), { once: true });
    this.psv.addEventListener('panorama-loaded', () => this.afterLoad(this.seq));
    this.psv.addEventListener('panorama-error', (e: any) => this.emit('error', String((e && e.error && e.error.message) || 'panorama error')));
    this.psv.addEventListener('size-updated', () => this.onResize());
    this.psv.addEventListener('zoom-updated', () => { this.lastHfov = this.psv.state.hFov; if (!this.pointerDown) this.scheduleSettle(); });
    this.psv.addEventListener('position-updated', () => { if (!this.pointerDown) this.scheduleSettle(); });
    this.markers.addEventListener('select-marker', ({ marker }: any) => this.onMarker(marker.id));
    this.psv.addEventListener('dblclick', ({ data }: any) => this.onDoubleClick(data));

    el.addEventListener('mousedown', (e) => this.onMouseDown(e), true);
    el.addEventListener('touchstart', (e) => this.onTouchStart(e), { capture: true, passive: true });
    el.addEventListener('touchmove', (e) => this.onTouchMove(e), { capture: true, passive: false });
    el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    const up = () => { if (this.pointerDown) { this.pointerDown = false; this.scheduleSettle(); } };
    window.addEventListener('mouseup', () => { this.onMouseUp(); up(); }, true);
    document.addEventListener('mouseleave', () => this.onMouseUp());
    window.addEventListener('touchend', () => { this.onTouchEnd(); up(); }, true);
    window.addEventListener('touchcancel', () => { this.onTouchEnd(); up(); }, true);
    el.addEventListener('keydown', (e) => this.onKeyDown(e));
    el.addEventListener('keyup', (e) => this.onKeyUp(e));
    el.addEventListener('blur', () => this.keys.fill(false));
    this.watch();
  }

  // ── Pannellum's API ────────────────────────────────────────────────────────────
  on(type: string, fn: Fn) { const l = this.handlers.get(type) || []; l.push(fn); this.handlers.set(type, l); return this; }
  off(type: string, fn?: Fn) { if (!fn) this.handlers.delete(type); else this.handlers.set(type, (this.handlers.get(type) || []).filter((f) => f !== fn)); return this; }
  getScene() { return this.current; }
  isLoaded() { return this.loaded; }
  getConfig() { return this.scenes[this.current]; }
  addScene(id: string, cfg: SceneConfig) { this.scenes[id] = cfg; return this; }
  removeScene(id: string) { if (id === this.current || !this.scenes[id]) return false; delete this.scenes[id]; return true; }
  getYaw() { let y = this.psv.getPosition().yaw / D; if (y > 180) y -= 360; return y; }
  getPitch() { return this.psv.getPosition().pitch / D; }
  getHfov() { return this.psv.state.hFov || this.lastHfov; }

  setHfov(hfov: number, animated: number | boolean = 1000) {
    if (this.walking) return this; // the walk owns the view until it arrives
    this.calm();
    const zoom = this.zoomFor(hfov);
    if (animated) this.psv.animate({ zoom, speed: typeof animated === 'number' ? animated : 1000 } as any);
    else this.psv.zoom(zoom);
    return this;
  }

  lookAt(pitch?: number, yaw?: number, hfov?: number, animated: number | boolean = 1000, cb?: Fn) {
    if (this.walking) { if (cb) cb(); return this; } // the walk owns the view until it arrives
    this.calm();
    const p = pitch ?? this.getPitch(), y = yaw ?? this.getYaw();
    const zoom = hfov == null ? undefined : this.zoomFor(hfov);
    if (!animated) {
      this.psv.rotate({ yaw: y * D, pitch: p * D });
      if (zoom != null) this.psv.zoom(zoom);
      if (cb) cb();
      this.emit('animatefinished', this.pos());
      return this;
    }
    this.psv.animate({ yaw: y * D, pitch: p * D, ...(zoom != null ? { zoom } : {}), speed: typeof animated === 'number' ? animated : 1000 } as any)
      .then(() => { if (cb) cb(); this.emit('animatefinished', this.pos()); });
    return this;
  }

  /** `fadeMs` (not Pannellum's): this load's fade instead of the tour's sceneFadeDuration — the walk's reduced-motion swap passes 0 */
  loadScene(id: string, pitch?: number, yaw?: number, hfov?: number, fadeMs?: number) {
    if (this.walking) this.endWalk(this.walking); // a scene asked for mid-walk wins; the walk's frame goes at once
    this.beginScene(id, pitch, yaw, hfov, typeof fadeMs === 'number' ? fadeMs : this.fade, null);
    return this;
  }

  /** The door's walk (card Q08): a door marker's tap and the keyboard's Enter on it both land here. */
  walkTo(hs: Hotspot) {
    this.walk(hs);
    return this;
  }

  /** a scene's picture as PSV takes it: the tiled cube while the scene shows exactly the picture its tiles encode, else the URL */
  private panoramaOf(s: SceneConfig): unknown {
    const t = s.tiles;
    if (!t || !t.dir || !Array.isArray(t.levels) || !t.levels.length || !t.preview || t.of !== s.panorama) return s.panorama;
    let p = this.panos.get(s);
    if (!p) {
      const ext = t.ext || 'webp';
      const at = (rel: string) => t.dir + '/' + rel;
      p = {
        baseUrl: { left: at(t.preview.left), front: at(t.preview.front), right: at(t.preview.right), back: at(t.preview.back), top: at(t.preview.top), bottom: at(t.preview.bottom) },
        levels: t.levels.map((L) => ({ faceSize: L.faceSize, nbTiles: L.nbTiles })),
        tileUrl: (face: string, col: number, row: number, level: number) => at(`${face}/${level}/${row}_${col}.${ext}`),
        noMipmapFrom: typeof t.noMipmapFrom === 'number' ? t.noMipmapFrom : null,
      };
      this.panos.set(s, p);
    }
    return p;
  }

  /** Starts a scene: `fade` ms of PSV's fade (0: instant); `walk` = the walk-in's hand-over — no fade (the walk's frame covers the
      swap), the target `settle` × wider than asked so it can narrow as it fades in, and setPanorama only once `ready` (the preload
      begun at the tap) settles, so the hand-over never aborts a download already under way. Resolves true when the picture is up. */
  private beginScene(id: string, pitch: number | undefined, yaw: number | undefined, hfov: number | undefined, fade: number,
    walk: { settle: number; ready: Promise<unknown> } | null): Promise<boolean> {
    const s = this.scenes[id];
    if (!s) { this.emit('error', 'unknown scene ' + id); return Promise.resolve(false); }
    const mine = ++this.seq;
    this.current = id;
    this.loaded = false;
    this.calm();
    this.dragging = false;
    this.fading = true; // a drag during PSV's fade would be undone when it ends (it sets the new room's view): input waits for it
    if (walk) this.emit('scenechange', id, { walk: true });
    else this.emit('scenechange', id);
    this.markers.clearMarkers();
    this.live.clear();
    this.applyRange(s);
    const r = this.fovRange();
    const h = hfov ?? s.hfov ?? this.getHfov();
    const h0 = walk ? Math.min(this.hfovRange[1], h * walk.settle) : h;
    this.psv.setOptions({ minFov: r.min, maxFov: r.max } as any);
    const show = () => this.psv.setPanorama(this.panoramaOf(s) as any, {
      position: { yaw: (yaw ?? s.yaw ?? 0) * D, pitch: (pitch ?? s.pitch ?? 0) * D },
      zoom: this.zoomFor(h0, r),
      transition: !walk && fade > 0 ? { speed: fade, effect: 'fade', rotation: false } : false,
      showLoader: false,
    } as any);
    const started = walk ? walk.ready.then(() => (mine === this.seq ? show() : false), () => (mine === this.seq ? show() : false)) : show();
    return Promise.resolve(started)
      .then((done) => { if (done === false) return false; this.afterLoad(mine); return mine === this.seq; })
      .catch((err: any) => { if (mine === this.seq) this.emit('error', String((err && err.message) || err)); return false; })
      .finally(() => { if (mine === this.seq && !walk) this.fading = false; });
  }

  private walk(hs: Hotspot) {
    const id = hs && hs.sceneId;
    if (!id || !this.scenes[id]) { if (id) this.emit('error', 'unknown scene ' + id); return; }
    if (this.walking || this.destroyed || !this.loaded || this.fading) return; // one move at a time; a door waits for its room
    const cfg = this.walkCfg;
    if (!cfg || prefersReducedMotion()) { this.loadScene(id, hs.targetPitch, hs.targetYaw, hs.targetHfov, cfg ? 0 : undefined); return; }
    const w: Walk = { cancelled: false, box: null, canvases: [], anims: [] };
    this.walking = w;
    this.stopAutoRotate();
    this.psv.stopAnimation();
    this.calm();
    this.dragging = false;
    this.loaded = false; // the page's changes and buttons wait for the arrival, as they wait for a load
    this.fading = true; // and so do the visitor's hands
    this.tilesPaused(true); // no tile decode or upload mid-walk; the arrival resumes them (endWalk)
    this.runWalk(w, hs, cfg).catch((e) => {
      console.warn('walk-in: ' + String((e && e.message) || e) + ' — the plain fade instead');
      if (this.walking === w) { this.endWalk(w); this.loadScene(id, hs.targetPitch, hs.targetYaw, hs.targetHfov); }
    });
  }

  /** 1 turn to the door (tiles paused, the target's picture fetched and decoded meanwhile) · 2 capture the frame and lay it, still,
      over the canvas · 3 swap the target in under it and let PSV draw it once (its upload done while nothing moves) · 4 the move: the
      frame magnifies and blurs on the compositor (transform + opacity only) · 5 from fadeAt the frame fades out over the target,
      which narrows from settle × its field to its field · 6 the frame goes; tiles resume with the view at rest. A walk-in filmed
      with the swap and the tile stream mid-move showed a main-thread long task of 87 ms and a compositor gap of 50–84 ms
      (Long Tasks API + the screencast's frames, spikes/wq/walkin-frames.mjs). */
  private async runWalk(w: Walk, hs: Hotspot, cfg: WalkConfig) {
    const id = hs.sceneId as string;
    const s = this.scenes[id];
    const alive = () => this.walking === w && !w.cancelled && !this.destroyed;
    const target = this.panoramaOf(s);
    const ad: any = (this.psv as any).adapter;
    const ready = this.preload(s).then(() => (ad && ad.predecode ? ad.predecode(target) : undefined));
    const mark = (k: string) => { if (this.walking === w) this.walkTimes[k] = performance.now(); };
    this.walkTimes = { tap: performance.now() };
    // 1. the turn: to the door's bearing, levelled at the arrival pitch
    const p1 = typeof hs.targetPitch === 'number' ? hs.targetPitch : -2;
    const y0 = this.getYaw(), p0 = this.getPitch();
    const dy = wrap180(hs.yaw - y0);
    const ms = turnMs(Math.max(Math.abs(dy), Math.abs(p1 - p0)));
    if (ms > 0 && !(await this.tween(w, ms, easeInOutSine, (k) => this.psv.rotate({ yaw: (y0 + dy * k) * D, pitch: (p0 + (p1 - p0) * k) * D })))) return;
    if (!alive()) return;
    // 2. the frame, as the turn left it, laid still over the canvas
    mark('turned');
    const shot = await this.capture();
    mark('captured');
    if (!alive()) { this.freeShot(shot); return; }
    if (!shot) { this.endWalk(w); this.loadScene(id, hs.targetPitch, hs.targetYaw, hs.targetHfov); return; } // no frame: the fade
    const zoomBox = this.mountWalk(w, shot);
    // 3. the hand-over, under the still frame
    const hfov = typeof hs.targetHfov === 'number' ? hs.targetHfov : this.scenes[id].hfov ?? this.getHfov();
    const shown = await this.beginScene(id, p1, hs.targetYaw, hfov, 0, { settle: cfg.settle, ready });
    mark('handedOver');
    if (!alive()) return;
    if (!shown) { this.endWalk(w); return; } // the error is the page's to show ('error' was emitted)
    await this.nextRender();
    if (!alive()) return;
    // the GPU done with the target's uploads before anything moves (the main thread waits here, under a still frame; a film without
    // this sync showed the compositor idle 100 ms into the move while the uploads drained)
    try { const gl = (this.psv.renderer as any).renderer.getContext(); if (gl && gl.finish) gl.finish(); } catch (_) { /* a lost context */ }
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (!alive()) return;
    // 4. the move
    mark('move');
    w.anims.push(zoomBox.animate([{ transform: 'scale(1)' }, { transform: `scale(${cfg.zoom})` }], { duration: cfg.moveMs, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }));
    w.anims.push(shot.sharp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.round(cfg.moveMs * cfg.blurIn), easing: 'ease-in', fill: 'forwards' }));
    // 5. the arrival (the target is already in: the fade starts at fadeAt)
    const win = fadeWindow(cfg, 0);
    await sleep(win.start);
    if (!alive()) return;
    const box = w.box as HTMLElement;
    mark('fade');
    const fade = box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.round(win.ms), easing: 'ease-in-out', fill: 'forwards' });
    w.anims.push(fade);
    const z0 = this.psv.getZoomLevel(), z1 = this.zoomFor(hfov);
    await Promise.all([fade.finished.catch(() => undefined), this.tween(w, win.ms, easeOutCubic, (k) => this.psv.zoom(z0 + (z1 - z0) * k))]);
    if (!alive()) return;
    // 6. arrived
    mark('arrived');
    this.endWalk(w);
  }

  /** pause or resume the tiles adapter's stream (an equirect viewer has none) */
  private tilesPaused(on: boolean) {
    const ad: any = (this.psv as any).adapter;
    if (ad && typeof ad.setTilesSuspended === 'function') ad.setTilesSuspended(on);
  }
  /** resolves after PSV's next drawn frame (its texture uploads done), or after 300 ms */
  private nextRender(): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const fin = () => { if (done) return; done = true; this.psv.removeEventListener('render', fin as any); resolve(); };
      this.psv.addEventListener('render', fin as any);
      this.psv.needsUpdate();
      window.setTimeout(fin, 300);
    });
  }

  /** the target's picture into PSV's cache now; resolves (never rejects) when it is there or failed */
  private preload(s: SceneConfig): Promise<unknown> {
    try {
      const p: any = this.psv.textureLoader.preloadPanorama(this.panoramaOf(s) as any);
      return Promise.resolve(p).then((td: any) => { try { (this.psv as any).adapter.disposeTexture(td); } catch (_) { /* a texture never drawn */ } }, () => undefined);
    } catch (_) {
      return Promise.resolve();
    }
  }

  /** the canvas as last drawn, read right after PSV renders it (the WebGL drawing buffer is not preserved): a sharp copy and a
      small soft one (1/(3·dpr) the size, blurred once) — the blur ramp is the sharp copy fading over the soft one */
  private capture(): Promise<{ sharp: HTMLCanvasElement; soft: HTMLCanvasElement } | null> {
    const gl = ((this.psv.renderer as any).renderer && (this.psv.renderer as any).renderer.domElement) || this.psv.container.querySelector('.psv-canvas-container canvas');
    if (!gl || !gl.width || !gl.height) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      const onRender = () => {
        if (done) return;
        done = true;
        this.psv.removeEventListener('render', onRender as any);
        try {
          const sharp = document.createElement('canvas');
          sharp.width = gl.width; sharp.height = gl.height;
          (sharp.getContext('2d') as CanvasRenderingContext2D).drawImage(gl, 0, 0);
          const f = Math.max(2, Math.round(3 * (window.devicePixelRatio || 1)));
          const soft = document.createElement('canvas');
          soft.width = Math.max(1, Math.round(gl.width / f)); soft.height = Math.max(1, Math.round(gl.height / f));
          const c = soft.getContext('2d') as CanvasRenderingContext2D;
          if ('filter' in c) (c as any).filter = 'blur(1px)';
          c.drawImage(gl, 0, 0, soft.width, soft.height);
          resolve({ sharp, soft });
        } catch (_) {
          resolve(null);
        }
      };
      this.psv.addEventListener('render', onRender as any);
      this.psv.needsUpdate();
      window.setTimeout(() => { if (!done) { done = true; this.psv.removeEventListener('render', onRender as any); resolve(null); } }, 300);
    });
  }
  private freeShot(shot: { sharp: HTMLCanvasElement; soft: HTMLCanvasElement } | null) {
    if (!shot) return;
    for (const c of [shot.sharp, shot.soft]) { c.width = 0; c.height = 0; }
  }
  /** the frame over the canvas and the markers (and under PSV's tooltips): a clip box (it fades) holding a zoom box (it magnifies)
      holding the soft frame under the sharp one */
  private mountWalk(w: Walk, shot: { sharp: HTMLCanvasElement; soft: HTMLCanvasElement }): HTMLElement {
    const box = document.createElement('div');
    box.className = 'hb-walk';
    const zoom = document.createElement('div');
    zoom.className = 'hb-walk-zoom';
    shot.soft.className = 'hb-walk-layer';
    shot.sharp.className = 'hb-walk-layer';
    zoom.append(shot.soft, shot.sharp);
    box.append(zoom);
    this.psv.container.appendChild(box);
    w.box = box;
    w.canvases = [shot.soft, shot.sharp];
    return zoom;
  }
  private endWalk(w: Walk) {
    w.cancelled = true;
    for (const a of w.anims) { try { a.cancel(); } catch (_) { /* finished */ } }
    w.anims = [];
    if (w.box) w.box.remove();
    w.box = null;
    for (const c of w.canvases) { c.width = 0; c.height = 0; }
    w.canvases = [];
    if (this.walking === w) {
      this.walking = null;
      this.fading = false;
      if (!this.loaded && this.loadedSeq === this.seq) this.loaded = true; // a walk ended before its hand-over: the room is still up
      this.tilesPaused(false); // the tiles the arrived view needs, now that nothing moves
    }
  }
  /** a rAF tween owned by a walk (PSV's own animations never run under 500 ms); resolves false when the walk was cancelled */
  private tween(w: Walk, ms: number, ease: (t: number) => number, step: (k: number) => void): Promise<boolean> {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now: number) => {
        if (this.walking !== w || w.cancelled || this.destroyed) { resolve(false); return; }
        const t = Math.min(1, (now - t0) / Math.max(1, ms));
        step(ease(t));
        if (t < 1) requestAnimationFrame(tick);
        else resolve(true);
      };
      requestAnimationFrame(tick);
    });
  }

  /** Pannellum: positive speed turns counter-clockwise seen from above (the view to the left), negative clockwise — degrees a second */
  startAutoRotate(speed = 2, _pitch?: number) {
    this.stopAutoRotate();
    if (!speed) return this;
    this.rotSpeed = speed;
    this.rotLast = performance.now();
    const start = this.rotLast;
    const step = (now: number) => {
      const dt = (now - this.rotLast) / 1000; this.rotLast = now;
      // Pannellum eases its auto-rotate in (its speed builds through the glide's momentum, full after ~0.33 s); the same here
      const ramp = Math.min(1, (now - start) / 330);
      const pos = this.psv.getPosition();
      this.psv.rotate({ yaw: pos.yaw - this.rotSpeed * ramp * dt * D, pitch: pos.pitch });
      this.rotRaf = requestAnimationFrame(step);
    };
    this.rotRaf = requestAnimationFrame(step);
    return this;
  }
  stopAutoRotate() { if (this.rotRaf) cancelAnimationFrame(this.rotRaf); this.rotRaf = 0; const s = this.rotSpeed; this.rotSpeed = 0; return { speed: s }; }

  destroy() { if (this.walking) this.endWalk(this.walking); this.destroyed = true; this.stopAutoRotate(); window.clearInterval(this.watchTimer); this.psv.destroy(); }

  // ── internals ───────────────────────────────────────────────────────────────────
  private emit(type: string, ...args: any[]) { for (const fn of this.handlers.get(type) || []) { try { fn(...args); } catch (e) { console.error(e); } } }
  private pos() { return { pitch: this.getPitch(), yaw: this.getYaw(), hfov: this.getHfov() }; }
  private scheduleSettle() { window.clearTimeout(this.settleTimer); this.settleTimer = window.setTimeout(() => this.emit('animatefinished', this.pos()), 160); }
  private applyRange(s: SceneConfig) { this.hfovRange = [s.minHfov ?? FOV_DEFAULT.minHfov, s.maxHfov ?? FOV_DEFAULT.maxHfov]; }
  private aspect() { return this.el.clientWidth / Math.max(1, this.el.clientHeight) || 1; }
  private vfov(h: number) { return (2 * Math.atan(Math.tan((h * D) / 2) / this.aspect())) / D; }
  /** the vertical range PSV gets: the scene's horizontal bounds in this window's shape, capped by the policy (walk-math fovRange) */
  private fovRange(): Range { return fovRangeOf(this.hfovRange[0], this.hfovRange[1], this.aspect()); }
  /** PSV's zoom level is linear in the vertical fov between maxFov (0) and minFov (100) */
  private zoomFor(h: number, r: Range = this.fovRange()) {
    if (r.max <= r.min) return 0;
    const v = clamp(this.vfov(h), r.min, r.max);
    return clamp(((r.max - v) / (r.max - r.min)) * 100, 0, 100);
  }
  private onResize() {
    const r = this.fovRange();
    const h = this.lastHfov;
    this.psv.setOptions({ minFov: r.min, maxFov: r.max } as any);
    this.psv.zoom(this.zoomFor(h, r));
  }
  private afterLoad(mine: number) {
    if (mine !== this.seq || this.loadedSeq === mine) return;
    this.loadedSeq = mine;
    this.loaded = true;
    this.buildMarkers();
    this.lastHfov = this.getHfov();
    this.emit('load');
  }
  private buildMarkers() {
    this.markers.clearMarkers();
    this.live.clear();
    const s = this.scenes[this.current];
    (s.hotSpots || []).forEach((hs, i) => {
      const div = document.createElement('div');
      div.className = 'pnlm-hotspot-base ' + (hs.cssClass || 'pnlm-hotspot pnlm-sprite pnlm-' + (hs.type === 'scene' ? 'scene' : 'info'));
      if (hs.createTooltipFunc) hs.createTooltipFunc(div, hs.createTooltipArgs);
      else if (hs.text) { const span = document.createElement('span'); span.textContent = hs.text; div.append(span); }
      const id = `hs${this.seq}-${i}`;
      this.markers.addMarker({ id, element: div, position: { yaw: hs.yaw * D, pitch: hs.pitch * D }, anchor: 'center center' } as any);
      this.live.set(id, { hs, yaw: hs.yaw, pitch: hs.pitch });
    });
  }
  /** a hotspot object mutated by the page moves its marker on PSV's next frame (its render loop already runs every frame — a
      second rAF chain of our own doubled the idle work, T19c F-7), and within 100 ms if that loop sleeps */
  private watch() {
    const tick = () => {
      for (const [id, e] of this.live) {
        if (e.hs.yaw !== e.yaw || e.hs.pitch !== e.pitch) {
          e.yaw = e.hs.yaw; e.pitch = e.hs.pitch;
          try { this.markers.updateMarker({ id, position: { yaw: e.yaw * D, pitch: e.pitch * D } } as any); } catch (_) { /* cleared meanwhile */ }
        }
      }
    };
    this.psv.addEventListener('before-render', tick);
    this.watchTimer = window.setInterval(tick, 100);
  }
  private onMarker(id: string) {
    const e = this.live.get(id);
    if (!e) return;
    const hs = e.hs;
    const ev = { type: 'click', stopPropagation() { /* the page's handlers call it */ }, preventDefault() { /* idem */ } };
    if (hs.clickHandlerFunc) hs.clickHandlerFunc(ev, hs.clickHandlerArgs);
    else if (hs.type === 'scene' && hs.sceneId) {
      if (this.walkCfg) this.walk(hs); // a door: the walk-in (card Q08)
      else this.loadScene(hs.sceneId, hs.targetPitch, hs.targetYaw, hs.targetHfov);
    }
  }

  // ── the visitor's hands: Pannellum 2.5.6, ported (T19c F-1…F-4) ─────────────────────────────────────────────────
  // Every handler keeps Pannellum's own formula and constants; the minified names it replaces are noted where they help a reader
  // compare (`ka` mouse-down, `ua` mouse-move, `ma` mouse-up, `Ka`/`la`/`Ea` touch, `U` wheel, `V`/`R`/`wa` keys, `ga` the glide,
  // `Ja` the double-click). PSV keeps telling a click from a drag, so a door or a ring still answers a tap.
  private ready() { return this.loaded && !this.fading && !this.destroyed; }
  /** the view as Pannellum holds it: degrees, the horizontal fov, the yaw continuous across ±180 */
  private read() {
    const y = this.getYaw();
    this.v.yaw += ((((y - this.v.yaw) % 360) + 540) % 360) - 180;
    this.v.pitch = this.getPitch();
    this.v.hfov = this.getHfov();
  }
  private clampHfov(h: number) { return clamp(h, this.hfovRange[0], this.hfovRange[1]); }
  /** Pannellum's setHfov() + render(): the fov within the scene's bounds; the pitch within ±90 — the tour sets no minPitch/maxPitch,
      so Pannellum's `minPitch + vfov/2` is NaN and falls back to ±90 (the view's centre may reach straight up or down) */
  private put(pitch: number, yaw: number, hfov: number) {
    const h = this.clampHfov(hfov);
    const p = clamp(pitch, -90, 90);
    this.v = { yaw, pitch: p, hfov: h };
    this.psv.rotate({ yaw: yaw * D, pitch: p * D });
    this.psv.zoom(this.zoomFor(h));
  }
  /** Pannellum's stopAnimation(): a running turn or zoom and the auto-rotate stop */
  private halt() { this.psv.stopAnimation(); this.stopAutoRotate(); }
  /** a scripted move (lookAt, setHfov, a room change) takes over from the glide, as Pannellum's animations zero its speed */
  private calm() { this.speed = { yaw: 0, pitch: 0, hfov: 0 }; }
  private local(p: { clientX: number; clientY: number }) { const r = this.el.getBoundingClientRect(); return { x: p.clientX - r.left, y: p.clientY - r.top }; }
  private grabbing(on: boolean) { this.psv.container.classList.toggle('is-grabbing', on); }

  private onMouseDown(e: MouseEvent) {
    if (e.button !== 0 || isField(e.target)) return;
    e.preventDefault();
    this.el.focus({ preventScroll: true }); // Pannellum focuses its container, so the arrow keys work after a click on the picture
    this.pointerDown = true;
    this.stopAutoRotate();
    this.emit('mousedown', e);
    if (!this.ready()) return;
    this.halt();
    this.read();
    this.speed.hfov = 0;
    const p = this.local(e);
    this.dragging = true;
    this.latest = Date.now();
    this.down = { x: p.x, y: p.y, yaw: this.v.yaw, pitch: this.v.pitch };
    this.grabbing(true);
    this.loop();
  }
  private onMouseMove(e: MouseEvent) {
    if (!this.dragging || !this.ready()) return;
    this.latest = Date.now();
    const W = Math.max(1, this.el.clientWidth), H = Math.max(1, this.el.clientHeight), p = this.local(e), h = this.v.hfov;
    const yaw = ((Math.atan((this.down.x / W) * 2 - 1) - Math.atan((p.x / W) * 2 - 1)) / D) * (h / 90) + this.down.yaw;
    this.speed.yaw = ((yaw - this.v.yaw) % 360) * 0.2;
    const vf = (2 * Math.atan((Math.tan((h / 2) * D) * H) / W)) / D;
    const pitch = ((Math.atan((p.y / H) * 2 - 1) - Math.atan((this.down.y / H) * 2 - 1)) / D) * (vf / 90) + this.down.pitch;
    this.speed.pitch = 0.2 * (pitch - this.v.pitch);
    this.put(pitch, yaw, h);
  }
  private onMouseUp() {
    if (!this.dragging || this.touching) return;
    this.dragging = false;
    if (Date.now() - this.latest > 15) this.speed.pitch = this.speed.yaw = 0; // a release that was not a flick does not glide
    this.latest = Date.now();
    this.grabbing(false);
  }
  private onTouchStart(e: TouchEvent) {
    this.pointerDown = true;
    this.stopAutoRotate();
    this.emit('touchstart', e);
    if (!this.ready()) return;
    this.halt();
    this.read();
    this.speed.hfov = 0;
    const t = e.targetTouches, a = this.local(t[0]);
    let x = a.x, y = a.y;
    if (t.length === 2) { const b = this.local(t[1]); x += 0.5 * (b.x - a.x); y += 0.5 * (b.y - a.y); this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    this.dragging = true;
    this.touching = true;
    this.latest = Date.now();
    this.down = { x, y, yaw: this.v.yaw, pitch: this.v.pitch };
    this.loop();
  }
  private onTouchMove(e: TouchEvent) {
    e.preventDefault(); // the page never scrolls under a finger on the picture
    if (this.loaded) this.latest = Date.now();
    if (!this.dragging || !this.touching || !this.ready()) return;
    const t = e.targetTouches, a = this.local(t[0]);
    let x = a.x, y = a.y, h = this.v.hfov;
    if (t.length === 2 && this.pinch !== -1) {
      const b = this.local(t[1]);
      x += 0.5 * (b.x - a.x); y += 0.5 * (b.y - a.y);
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      h = this.clampHfov(h + 0.1 * (this.pinch - dist)); // the pinch: 0.1° of horizontal fov a pixel of finger span
      this.pinch = dist;
    }
    const f = h / 360; // touchPanSpeedCoeffFactor 1
    const yaw = (this.down.x - x) * f + this.down.yaw;
    this.speed.yaw = ((yaw - this.v.yaw) % 360) * 0.2;
    const pitch = (y - this.down.y) * f + this.down.pitch;
    this.speed.pitch = 0.2 * (pitch - this.v.pitch);
    this.put(pitch, yaw, h);
  }
  private onTouchEnd() {
    if (!this.touching) return;
    this.touching = false;
    this.dragging = false;
    if (Date.now() - this.latest > 150) this.speed.pitch = this.speed.yaw = 0;
    this.pinch = -1;
    this.latest = Date.now();
  }
  private onWheel(e: WheelEvent) {
    if (!this.mouseZoom || !this.ready()) return;
    e.preventDefault();
    this.halt();
    this.latest = Date.now();
    this.read();
    const wd = (e as any).wheelDeltaY as number | undefined;
    if (wd) {
      this.put(this.v.pitch, this.v.yaw, this.v.hfov - 0.05 * wd);
      this.speed.hfov = ((e as any).wheelDelta as number) < 0 ? 1 : -1;
    } else if (e.deltaY) {
      // a browser without the legacy field (Firefox) — Pannellum read its DOMMouseScroll `detail` there: lines, 3 a notch
      const detail = e.deltaMode === 1 ? e.deltaY : e.deltaY / 33;
      this.put(this.v.pitch, this.v.yaw, this.v.hfov + 1.5 * detail);
      this.speed.hfov = detail > 0 ? 1 : -1;
    }
    this.loop();
  }
  private onKeyDown(e: KeyboardEvent) {
    if (!this.ready()) return;
    this.halt();
    this.latest = Date.now();
    const code = e.which || e.keyCode;
    if (CAPTURED.indexOf(code) < 0) return;
    e.preventDefault();
    if (code !== 27) this.setKey(code, true); // Escape only left Pannellum's own fullscreen; the page has none
  }
  private onKeyUp(e: KeyboardEvent) {
    const code = e.which || e.keyCode;
    if (CAPTURED.indexOf(code) < 0) return;
    e.preventDefault();
    this.setKey(code, false);
  }
  private setKey(code: number, on: boolean) {
    const i = KEYS[code];
    if (i == null) return;
    const changed = this.keys[i] !== on;
    this.keys[i] = on;
    if (changed && on) { this.read(); this.prevTime = performance.now(); this.loop(); }
  }
  /** Pannellum's double-click: zoom in to the scene's closest view where the visitor pointed, or back out if already there */
  private onDoubleClick(data: any) {
    if (!this.ready() || !data) return;
    const t = data.target as HTMLElement | undefined;
    if (t && t.closest && t.closest('.psv-marker')) return;
    const min = this.hfovRange[0];
    if (Math.abs(this.getHfov() - min) < 0.01) this.setHfov(this.scenes[this.current].hfov ?? FOV_DEFAULT.hfov, 1000);
    else { let y = data.yaw / D; if (y > 180) y -= 360; this.lookAt(data.pitch / D, y, min, 1000); }
  }

  /** Pannellum's animateInit(): the first step runs at once (a single key tap moves the view a little), the rest a frame apart */
  private loop() {
    if (this.loopOn) return;
    this.loopOn = true;
    this.frame();
  }
  private readonly frame = () => {
    if (this.destroyed) { this.loopOn = false; return; }
    const s = this.speed;
    if (this.dragging) { requestAnimationFrame(this.frame); return; }
    if (this.keys.some(Boolean) || Math.abs(s.yaw) > 0.01 || Math.abs(s.pitch) > 0.01 || Math.abs(s.hfov) > 0.01) {
      if (this.ready()) this.glide(); else this.calm();
      requestAnimationFrame(this.frame);
      return;
    }
    this.loopOn = false;
    this.prevTime = undefined;
  };
  /** Pannellum's keyRepeat(): the keys move the view, and after a release the view glides on, slowing by its friction */
  private glide() {
    this.read();
    const now = performance.now();
    if (this.prevTime === undefined) this.prevTime = now;
    const k = this.keys, s = this.speed;
    let d = Math.min(((now - this.prevTime) * this.v.hfov) / 1700, 1);
    // Pannellum's first step after a key press comes after a render, so its time step is never zero and a tap leaves a small glide
    if (d === 0 && k.some(Boolean)) d = 1e-6;
    const p0 = this.v.pitch, y0 = this.v.yaw, h0 = this.v.hfov;
    let pitch = p0, yaw = y0, hfov = h0, moved = false;
    if (k[0] && this.keyboardZoom) { hfov = this.clampHfov(hfov + (0.8 * s.hfov + 0.5) * d); moved = true; }
    if (k[1] && this.keyboardZoom) { hfov = this.clampHfov(hfov + (0.8 * s.hfov - 0.2) * d); moved = true; }
    if (k[2] || k[6]) { pitch += (0.8 * s.pitch + 0.2) * d; moved = true; }
    if (k[3] || k[7]) { pitch += (0.8 * s.pitch - 0.2) * d; moved = true; }
    if (k[4] || k[8]) { yaw += (0.8 * s.yaw - 0.2) * d; moved = true; }
    if (k[5] || k[9]) { yaw += (0.8 * s.yaw + 0.2) * d; moved = true; }
    if (moved) this.latest = Date.now();
    if (d > 0) {
      const a = 1 - this.friction;
      if (!(k[4] || k[5] || k[8] || k[9])) yaw += s.yaw * d * a;
      if (!(k[2] || k[3] || k[6] || k[7])) pitch += s.pitch * d * a;
      if (!(k[0] || k[1])) hfov = this.clampHfov(hfov + s.hfov * d * a);
    }
    this.prevTime = now;
    if (d > 0) {
      s.yaw = clamp(0.8 * s.yaw + ((yaw - y0) / d) * 0.2, -5, 5);
      s.pitch = clamp(0.8 * s.pitch + ((pitch - p0) / d) * 0.2, -5, 5);
      s.hfov = clamp(0.8 * s.hfov + ((hfov - h0) / d) * 0.2, -5, 5);
    }
    if (k[0] && k[1]) s.hfov = 0;
    if ((k[2] || k[6]) && (k[3] || k[7])) s.pitch = 0;
    if ((k[4] || k[8]) && (k[5] || k[9])) s.yaw = 0;
    this.put(pitch, yaw, hfov);
  }
}

export function viewer(container: string | HTMLElement, config: TourConfig) {
  return new CompatViewer(container, config);
}
