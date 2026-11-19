// 360 viewer: an inverted sphere with a VideoTexture or image texture, drag + wheel + keyboard
// + device-orientation controls, and yaw/pitch <-> screen projection for DOM hotspots.
//
// Convention (shared with units.json / flow.json): yaw 0 = the panorama centre (u = 0.5),
// yaw grows to the right (clockwise from above); pitch grows upwards. yaw = (u-0.5)*360, pitch = (0.5-v)*180.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// direction vector of (yaw, pitch); yaw 0 looks down -Z, +yaw turns towards +X (the right)
export function dirFromYawPitch(yawDeg, pitchDeg, out = new THREE.Vector3()) {
  const y = yawDeg * DEG, p = pitchDeg * DEG;
  return out.set(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

export class Viewer360 {
  constructor(container, { fov = 75, minFov = 40, maxFov = 100 } = {}) {
    this.container = container;
    this.yaw = 0;
    this.pitch = 0;
    this.fov = fov;
    this.minFov = minFov;
    this.maxFov = maxFov;
    this.gyro = false;
    this.onFrame = null;
    this._deviceQuat = new THREE.Quaternion();
    this._hasDeviceData = false;
    this._gyroYawOffset = 0;
    this._vel = { yaw: 0, pitch: 0 };

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 1100);
    this.camera.position.set(0, 0, 0);

    const geo = new THREE.SphereGeometry(500, 64, 40);
    geo.scale(-1, 1, 1);               // look at the inside
    this.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.y = -Math.PI / 2; // puts u = 0.5 at -Z, i.e. yaw 0 = the panorama centre
    this.scene.add(this.mesh);

    this._bindControls();
    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);
    this._running = true;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---- textures ----
  _swapTexture(tex) {
    const old = this.material.map;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    this.material.map = tex;
    this.material.color.set(0xffffff);
    this.material.needsUpdate = true;
    if (old && old !== tex) old.dispose();
  }

  setVideo(videoEl) {
    if (this._videoTex && this._videoTex.image === videoEl) { this.material.map = this._videoTex; this.material.needsUpdate = true; return; }
    const tex = new THREE.VideoTexture(videoEl);
    this._videoTex = tex;
    this._swapTexture(tex);
  }

  setImage(url) {
    return new Promise((ok, fail) => {
      new THREE.TextureLoader().load(url, (tex) => { this._swapTexture(tex); ok(tex); }, undefined, (e) => fail(new Error(`image failed: ${url}`)));
    });
  }

  // ---- look ----
  lookAt(yawDeg, pitchDeg) {
    this.yaw = yawDeg;
    this.pitch = clamp(pitchDeg, -85, 85);
    this._vel.yaw = this._vel.pitch = 0;
  }

  setFov(f) { this.fov = clamp(f, this.minFov, this.maxFov); this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }

  // screen position (px, relative to container) of a yaw/pitch, and whether it is in front of the camera
  project(yawDeg, pitchDeg, out = {}) {
    const d = dirFromYawPitch(yawDeg, pitchDeg, this._tmpV || (this._tmpV = new THREE.Vector3()));
    const fwd = this.camera.getWorldDirection(this._tmpF || (this._tmpF = new THREE.Vector3()));
    const facing = d.dot(fwd);
    d.project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    out.x = (d.x + 1) / 2 * w;
    out.y = (1 - d.y) / 2 * h;
    out.visible = facing > 0.05 && d.x > -1.2 && d.x < 1.2 && d.y > -1.2 && d.y < 1.2;
    out.facing = facing;
    return out;
  }

  // ---- controls ----
  _bindControls() {
    const el = this.container;
    let dragging = false, lastX = 0, lastY = 0, lastT = 0, moved = 0;
    const pointers = new Map();
    let pinchDist = 0;

    el.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, e);
      if (pointers.size === 1) {
        dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
        this._vel.yaw = this._vel.pitch = 0;
        el.classList.add('dragging');
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchDist) this.setFov(this.fov * (pinchDist / d));
        pinchDist = d;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      const degPerPx = this.fov / el.clientHeight; // one screen height = one fov
      const dYaw = -dx * degPerPx, dPitch = dy * degPerPx;
      if (this.gyro) this._gyroYawOffset += dYaw; else { this.yaw += dYaw; this.pitch = clamp(this.pitch + dPitch, -85, 85); }
      const now = performance.now(), dt = Math.max(1, now - lastT);
      this._vel.yaw = dYaw / dt * 16; this._vel.pitch = dPitch / dt * 16;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) {
        dragging = false; el.classList.remove('dragging');
        if (performance.now() - lastT > 60) this._vel.yaw = this._vel.pitch = 0; // released after a pause: no inertia
        this.lastDragMoved = moved;
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.setFov(this.fov + e.deltaY * 0.05); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const step = 5;
      if (e.key === 'ArrowLeft') this.yaw -= step;
      else if (e.key === 'ArrowRight') this.yaw += step;
      else if (e.key === 'ArrowUp') this.pitch = clamp(this.pitch + step, -85, 85);
      else if (e.key === 'ArrowDown') this.pitch = clamp(this.pitch - step, -85, 85);
    });
  }

  // ---- device orientation ----
  static gyroAvailable() { return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1); }

  async enableGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission(); // must be inside a user gesture (iOS)
      if (r !== 'granted') throw new Error('denied');
    }
    if (!this._onOrient) {
      this._onOrient = (e) => this._updateDeviceQuat(e);
      window.addEventListener('deviceorientation', this._onOrient, true);
    }
    this.gyro = true;
    this._gyroYawOffset = this.yaw; // keep looking where we were
    this._hasDeviceData = false;
    return true;
  }

  disableGyro() {
    this.gyro = false;
    // fold the gyro view back into yaw/pitch so drag continues from the same view
    const fwd = this.camera.getWorldDirection(new THREE.Vector3());
    this.pitch = Math.asin(clamp(fwd.y, -1, 1)) / DEG;
    this.yaw = Math.atan2(fwd.x, -fwd.z) / DEG;
  }

  _updateDeviceQuat(e) {
    if (e.alpha === null || e.alpha === undefined) return;
    const alpha = e.alpha * DEG, beta = e.beta * DEG, gamma = e.gamma * DEG;
    const orient = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * DEG;
    // classic DeviceOrientationControls math
    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis
    this._deviceQuat.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));
    this._hasDeviceData = true;
  }

  // ---- loop ----
  _resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    if (!this._running) return;
    requestAnimationFrame(this._loop);
    // inertia
    if (!this.container.classList.contains('dragging') && (Math.abs(this._vel.yaw) > 0.01 || Math.abs(this._vel.pitch) > 0.01)) {
      if (this.gyro) this._gyroYawOffset += this._vel.yaw; else { this.yaw += this._vel.yaw; this.pitch = clamp(this.pitch + this._vel.pitch, -85, 85); }
      this._vel.yaw *= 0.92; this._vel.pitch *= 0.92;
    }
    if (this.gyro && this._hasDeviceData) {
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this._gyroYawOffset * DEG);
      this.camera.quaternion.copy(yawQ).multiply(this._deviceQuat);
    } else {
      const target = dirFromYawPitch(this.yaw, this.pitch, this._tmpT || (this._tmpT = new THREE.Vector3()));
      this.camera.lookAt(target);
    }
    this.camera.updateMatrixWorld();
    if (this.onFrame) this.onFrame();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._running = false;
    this._ro.disconnect();
    if (this._onOrient) window.removeEventListener('deviceorientation', this._onOrient, true);
    this.material.map?.dispose();
    this.renderer.dispose();
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
