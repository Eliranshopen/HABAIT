// birds.js — a few birds crossing the sky over the orbit clip and the hold (habait-ba, 2026-11-02; Eliran: "לראות גם ציפורים עפות").
// Small dark silhouettes, flapping, in loose flocks, upper third of the frame, subtle. Pure canvas, no assets, ~0 cost.
// createBirds({ canvas }) → { frame(now), set active(v) }
export function createBirds({ canvas, skyFrac = 0.42 }) {
  const ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, dpr = 1, active = true, flocks = [], nextFlockAt = performance.now() + 1500;
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); vw = innerWidth; vh = innerHeight; canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr); canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px'; }
  resize(); addEventListener('resize', resize);
  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawn(now) {
    const dir = Math.random() < 0.5 ? 1 : -1, n = Math.round(rnd(4, 9)), speed = rnd(55, 85) * (vw / 1280), size = rnd(5, 8) * (vw / 1280);
    const y0 = rnd(0.06, skyFrac) * vh, x0 = dir > 0 ? -60 : vw + 60;
    const birds = []; for (let i = 0; i < n; i++) birds.push({ dx: -dir * i * rnd(14, 26) + rnd(-8, 8), dy: Math.abs(i - n / 2) * rnd(6, 11) + rnd(-5, 5), ph: rnd(0, 6.28), f: rnd(5.5, 8.5), s: size * rnd(0.8, 1.2) });
    flocks.push({ t0: now, dir, speed, x0, y0, birds, drift: rnd(-6, 6) });
  }
  function frame(now) {
    if (!active) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
    if (now > nextFlockAt && flocks.length < 2) { spawn(now); nextFlockAt = now + rnd(7000, 14000); }
    ctx.strokeStyle = 'rgba(28, 30, 36, 0.78)'; ctx.lineWidth = Math.max(1, 1.1 * (vw / 1280)); ctx.lineCap = 'round';
    for (const fl of flocks) {
      const t = (now - fl.t0) / 1000, fx = fl.x0 + fl.dir * fl.speed * t, fy = fl.y0 + fl.drift * t;
      for (const b of fl.birds) {
        const x = fx + b.dx, y = fy + b.dy + Math.sin(t * 1.3 + b.ph) * 2;
        const flap = Math.sin(t * b.f * 2 * Math.PI + b.ph);                       // wing angle: up/down
        const w = b.s, h = b.s * 0.55 * flap;
        ctx.beginPath(); ctx.moveTo(x - w, y - h); ctx.quadraticCurveTo(x - w * 0.35, y + h * 0.3, x, y); ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.3, x + w, y - h); ctx.stroke();
      }
    }
    flocks = flocks.filter((fl) => { const x = fl.x0 + fl.dir * fl.speed * (now - fl.t0) / 1000; return x > -300 && x < vw + 300; });
  }
  return { frame, get active() { return active; }, set active(v) { active = v; canvas.style.display = v ? 'block' : 'none'; if (!v) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh); } } };
}
