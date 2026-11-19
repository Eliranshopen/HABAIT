// The landing page's motion (plan development/plans/2026-11-08-rainbow-landing.md, round 10). GSAP 3.13.0 + ScrollTrigger + CustomEase,
// Lenis 1.3.4 on desktop (self-hosted, js/vendor/VENDOR.json). Our own curve ("lb-glide", a long soft landing) and our own timings.
// Ideas taken as ideas only (plan round 10): the film settling as the page opens; pictures that open like a curtain with their words
// following; a picture stage moved by the scroll with the neighbours waiting at the sides (seen on mpbavli.co.il, re-made here).
// The page is complete WITHOUT this file: no JS, reduced motion, or a missing library = the static page, every word visible.
// Earlier motion layers: tools/_unused/ (landing-motion-r8.js, -r8-roles.js, -r9.js).
(() => {
  const G = window.gsap, ST = window.ScrollTrigger, Lenis = window.Lenis, CE = window.CustomEase;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!G || !ST || reduce.matches) return;
  G.registerPlugin(ST, ...[CE].filter(Boolean));
  const root = document.documentElement;
  root.classList.add('rl-motion');
  const DESK = '(min-width: 960px) and (hover: hover) and (pointer: fine)';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const GLIDE = CE ? CE.create('lb-glide', 'M0,0 C0.22,0.72 0.24,1 1,1') : 'power3.out';
  const T = { rise: 1.1, open: 1.4, follow: 0.18, step: 0.09 };

  // ---- smooth wheel, desktop only ----
  let lenis = null;
  const mm = G.matchMedia();
  mm.add(DESK, () => {
    root.classList.add('rl-desk');
    if (!Lenis) return () => root.classList.remove('rl-desk');
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95, anchors: { offset: -68 } });
    lenis.on('scroll', ST.update);
    const tick = (t) => lenis && lenis.raf(t * 1000);
    G.ticker.add(tick); G.ticker.lagSmoothing(0);
    window.__rlLenis = lenis;
    return () => { G.ticker.remove(tick); lenis.destroy(); lenis = null; window.__rlLenis = null; root.classList.remove('rl-desk'); };
  });

  // ---- the opening: the film settles from a slow zoom; the name, the line and the action rise after it (the poster has already painted) ----
  G.fromTo('[data-hero-media] img, [data-hero-media] video', { scale: 1.07 }, { scale: 1, duration: 2.4, ease: GLIDE });
  G.from('[data-plate] > *', { y: 30, autoAlpha: 0, duration: T.rise, ease: GLIDE, stagger: T.step, delay: 0.3 });
  G.from('.lb-sheet > div', { y: 18, autoAlpha: 0, duration: 0.9, ease: GLIDE, stagger: T.step, scrollTrigger: { trigger: '.lb-sheet', start: 'top 90%', once: true } });

  // ---- words: rise once ----
  $$('[data-up]').forEach((el) => G.from(el, { y: 30, autoAlpha: 0, duration: T.rise, ease: GLIDE, scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));

  // ---- pictures that open: a soft vertical curtain from the centre line, the picture settling inside; the legend follows ----
  $$('[data-open]').forEach((fig) => {
    const img = $('img', fig);
    const tl = G.timeline({ scrollTrigger: { trigger: fig, start: 'top 86%', once: true } });
    tl.fromTo(fig, { clipPath: 'inset(18% 0% 18% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: T.open, ease: GLIDE }, 0);
    if (img) tl.fromTo($$('img', fig), { scale: 1.08 }, { scale: 1, duration: T.open + 0.3, ease: GLIDE }, 0);
    const chip = $('.lb-chip', fig);
    if (chip) tl.from(chip, { xPercent: root.dir === 'ltr' ? -30 : 30, autoAlpha: 0, duration: 0.8, ease: GLIDE }, T.follow + 0.2);
    const text = fig.parentElement && $('.lb-tile__text', fig.parentElement);
    if (text) tl.from(text, { y: 16, autoAlpha: 0, duration: 0.9, ease: GLIDE }, T.follow + 0.3);
  });
  const legend = $$('[data-legend] li');
  if (legend.length) G.from(legend, { y: 18, autoAlpha: 0, duration: 0.9, ease: GLIDE, stagger: T.step, scrollTrigger: { trigger: '[data-legend]', start: 'top 92%', once: true } });
  const marks = $$('[data-marks] li');
  if (marks.length) G.from(marks, { y: 20, autoAlpha: 0, duration: 0.9, ease: GLIDE, stagger: T.step, scrollTrigger: { trigger: '[data-marks]', start: 'top 90%', once: true } });

  // ---- the picture stage: one picture in front, the neighbours smaller and dimmer at the sides ----
  const stage = $('[data-stage]'), track = $('[data-stage-track]'), slides = $$('[data-slide]'), dots = $$('.lb-dots i');
  const look = (centre) => {   // centre = fractional index of the slide in front
    slides.forEach((s, i) => { const d = Math.min(1, Math.abs(i - centre)); G.set(s, { scale: 1 - 0.1 * d, opacity: 1 - 0.5 * d }); });
    dots.forEach((dot, i) => dot.classList.toggle('is-on', Math.round(centre) === i));
  };
  if (stage && track && slides.length) {
    // desktop: pinned; the scroll moves the track from the first picture to the last (RTL: the next picture comes in from the left)
    mm.add(DESK, () => {
      const step = () => slides[1].offsetLeft - slides[0].offsetLeft;   // negative in RTL
      const n = slides.length - 1;
      look(0);
      const st = ST.create({ trigger: '.lb-arch__pin', start: 'top top', end: () => `+=${innerHeight * 1.1 * n}`, pin: true, scrub: 0.9, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { const c = self.progress * n; G.set(track, { x: -step() * c }); look(c); } });
      return () => { st.kill(); G.set(track, { x: 0 }); slides.forEach((s) => G.set(s, { clearProps: 'transform,opacity' })); };
    });
    // phones: the native swipe (scroll-snap); the stage reads where it stands
    mm.add(`not all and ${DESK}`, () => {
      const read = () => { const mid = stage.getBoundingClientRect().left + stage.clientWidth / 2;
        let best = 0, bd = Infinity; slides.forEach((s, i) => { const r = s.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
        slides.forEach((s, i) => { s.style.opacity = i === best ? '1' : '0.55'; s.style.transform = i === best ? 'none' : 'scale(0.94)'; });
        dots.forEach((d, i) => d.classList.toggle('is-on', i === best)); };
      stage.addEventListener('scroll', read, { passive: true }); read();
      return () => { stage.removeEventListener('scroll', read); slides.forEach((s) => { s.style.opacity = ''; s.style.transform = ''; }); };
    });
  }

  document.addEventListener('rl:rendered', () => ST.refresh());
  addEventListener('load', () => ST.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
  reduce.addEventListener('change', () => location.reload());
  window.__rlMotion = { lenis: () => lenis, triggers: () => ST.getAll().length };
})();
