// The landing page's motion (plan development/plans/2026-11-08-rainbow-landing.md, round 9; Eliran 2026-11-09: «אני רוצה משהו בסגנון הזה
// https://rainbowtlv.com/»). The feel is the reference's, measured frame by frame with the reanimate skill (r9-reference/DESIGN.md §6),
// rebuilt with GSAP 3.13.0 + ScrollTrigger + CustomEase and Lenis 1.3.4, self-hosted (js/vendor/VENDOR.json). Their stack (jQuery, AOS,
// nicescroll, jquery.parallax) is not used and none of their code is copied; only the numbers are matched:
// - fade-up / fade-from-the-side: 100 px of travel and opacity 0 → 1, the CSS `ease` curve, 1 s, once, when the element's top is 120 px
//   inside the viewport (AOS defaults); the hero's words rise the same way ≈ 0.8 s after navigation (their card waits for `load`);
// - pictures wipe in from their page edge: the window slides in (110 % of its width) and settles from scale 1.3 while the picture inside
//   slides the other way (101 % of the window), LINEAR, 0.9 s — their `.image-in-out`; the text beside it follows ≈ 0.4 s later;
// - the full-bleed bands move slower than the page (parallax); smooth wheel scrolling on desktop (Lenis in place of nicescroll).
// The page is complete WITHOUT this file: no JS, reduced motion, or a missing library = the static page, every word and picture visible.
(() => {
  const G = window.gsap, ST = window.ScrollTrigger, Lenis = window.Lenis, CE = window.CustomEase;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!G || !ST || reduce.matches) return;   // the static page stays as it is
  const T0 = performance.now();   // when the motion layer started (ms after navigation)
  G.registerPlugin(ST, ...[CE].filter(Boolean));
  const root = document.documentElement;
  root.classList.add('rl-motion');
  const DESK = '(min-width: 960px) and (hover: hover) and (pointer: fine)';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // the reference's curves (reanimate easing.ts: "ease", RMSE 0.010; the picture wipe: "linear")
  const EASE = CE ? CE.create('rl-css-ease', 'M0,0 C0.25,0.1 0.25,1 1,1') : 'power1.inOut';
  const DUR = 1.0, TRAVEL = 100, OFFSET = 'top bottom-=120';
  const WIPE = { dur: 0.9, out: 110, inner: 101, scale: 1.3 };   // inner: their −852 px of a 130 % layer = −101 % of the window
  const rtl = () => root.dir !== 'ltr';

  // ---- one smooth-scroll engine, desktop only ----
  let lenis = null;
  const mm = G.matchMedia();
  mm.add(DESK, () => {
    root.classList.add('rl-desk');
    if (Lenis) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9, anchors: { offset: -64 } });
      lenis.on('scroll', ST.update);
      const tick = (t) => lenis && lenis.raf(t * 1000);
      G.ticker.add(tick); G.ticker.lagSmoothing(0);
      window.__rlLenis = lenis;
      return () => { G.ticker.remove(tick); lenis.destroy(); lenis = null; window.__rlLenis = null; root.classList.remove('rl-desk'); };
    }
    return () => root.classList.remove('rl-desk');
  });

  // ---- hero: the card stays (the poster is the first paint); its words rise in once. The onset is matched to the reference in the same
  //      reanimate load capture (their AOS starts 0.81 s into it); ours is timed from navigation: 0.95 s ----
  const HERO_AT = 0.95;
  const heroBody = $('[data-hero-body]');
  if (heroBody) G.from(heroBody, { y: TRAVEL, autoAlpha: 0, duration: DUR, ease: EASE, delay: Math.max(0, HERO_AT - T0 / 1000) });

  // ---- which page edge is this element nearest to (+1 = right, −1 = left) ----
  const edge = (el) => { const r = el.getBoundingClientRect(); const c = r.left + r.width / 2; return Math.abs(c - innerWidth / 2) < 2 ? (rtl() ? 1 : -1) : (c > innerWidth / 2 ? 1 : -1); };

  // ---- pictures: the wipe from the page edge (desktop and phones alike, as the reference) ----
  $$('[data-wipe]').forEach((fig) => {
    const win = $('.rl-wipe', fig), pic = $('.rl-wipe__in', fig);
    if (!win || !pic) return;
    const d = edge(fig);
    G.timeline({ scrollTrigger: { trigger: fig, start: 'top bottom-=20', once: true } })
      .fromTo(win, { xPercent: WIPE.out * d, scale: WIPE.scale }, { xPercent: 0, scale: 1, duration: WIPE.dur, ease: 'none' }, 0)
      .fromTo(pic, { xPercent: -WIPE.inner * d }, { xPercent: 0, duration: WIPE.dur, ease: 'none' }, 0);
  });

  // ---- words: fade up (centred blocks), or in from their own page edge beside a picture (desktop); fade up on phones ----
  $$('[data-fade="up"]').forEach((el) => G.from(el, { y: TRAVEL, autoAlpha: 0, duration: DUR, ease: EASE, scrollTrigger: { trigger: el, start: OFFSET, once: true } }));
  mm.add(DESK, () => {
    $$('[data-fade="side"]').forEach((el) => {
      const row = el.closest('.rl-row'); const pic = row && $('[data-wipe]', row);
      const d = pic ? -edge(pic) : edge(el);   // the side opposite the picture = this column's own page edge
      // the words follow the picture ≈ 0.4 s later (the reference: text 0.42 s after the wipe): triggered 210 px later on the same row
      G.from(el, { x: TRAVEL * d, autoAlpha: 0, duration: DUR, ease: EASE, scrollTrigger: { trigger: pic || el, start: pic ? 'top bottom-=230' : OFFSET, once: true } });
    });
  });
  mm.add(`not all and ${DESK}`, () => {
    $$('[data-fade="side"]').forEach((el) => G.from(el, { y: TRAVEL * 0.6, autoAlpha: 0, duration: DUR, ease: EASE, scrollTrigger: { trigger: el, start: OFFSET, once: true } }));
  });

  // ---- the full-bleed bands: the picture moves slower than the page ----
  $$('[data-band]').forEach((band) => {
    const img = $('[data-band-img]', band);
    if (img) G.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // ---- a language switch: home.js replaced the text; the page direction flipped — re-measure ----
  document.addEventListener('rl:rendered', () => ST.refresh());
  addEventListener('load', () => ST.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
  reduce.addEventListener('change', () => location.reload());
  window.__rlMotion = { lenis: () => lenis, triggers: () => ST.getAll().length, t0: T0 };
})();
