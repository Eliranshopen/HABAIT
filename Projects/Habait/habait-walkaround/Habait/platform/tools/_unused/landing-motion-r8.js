// The landing page's scroll story (plan development/plans/2026-11-08-rainbow-landing.md, rounds 7–8; Eliran 2026-11-09: «שלא יראה כמו
// דף נחיתה פשוט של AI» · «הטקסט מאוד משעמם … טקסט והנפשה»). GSAP 3.13.0 (+ ScrollTrigger, SplitText, ScrambleText, CustomEase) and
// Lenis 1.3.4, self-hosted (js/vendor/VENDOR.json). Direction B (round 8): midnight sea, sand text, bronze accent.
// - The page is complete WITHOUT this file: no JS, reduced motion, or a missing library = the static page, every word visible.
// - Text (official GSAP skills): SplitText by LINES and WORDS only (never characters: Hebrew marks and ligatures stay whole), masked
//   from below with one CustomEase ("rl-rise"); aria "auto" = the split parent carries the sentence as aria-label, the pieces are hidden.
//   autoSplit re-splits after fonts load / width changes, and every animation is created inside onSplit so it is rebuilt with it.
// - Desktop (≥ 960 px, fine pointer): Lenis smooth scroll; pinned location split screen; sideways architecture gallery (RTL); sticky
//   experience frame; the statement reveals line by line, scrubbed. Phones: native scroll, no pins, every reveal plays once.
(() => {
  const G = window.gsap, ST = window.ScrollTrigger, Lenis = window.Lenis, Split = window.SplitText, CE = window.CustomEase;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!G || !ST || reduce.matches) return;   // the static page stays as it is
  G.registerPlugin(ST, ...[Split, CE].filter(Boolean));
  const root = document.documentElement;
  root.classList.add('rl-motion');
  const DESK = '(min-width: 960px) and (hover: hover) and (pointer: fine)';
  const desk = () => matchMedia(DESK).matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const RISE = CE ? CE.create('rl-rise', 'M0,0 C0.18,0.84 0.32,1 1,1') : 'power4.out';   // a fast start, a long soft landing

  // ---- one smooth-scroll engine, desktop only ----
  let lenis = null;
  const mm = G.matchMedia();
  mm.add(DESK, () => {
    root.classList.add('rl-desk');
    if (Lenis) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9, anchors: { offset: -68 } });
      lenis.on('scroll', ST.update);
      const tick = (t) => lenis && lenis.raf(t * 1000);
      G.ticker.add(tick); G.ticker.lagSmoothing(0);
      window.__rlLenis = lenis;
      return () => { G.ticker.remove(tick); lenis.destroy(); lenis = null; window.__rlLenis = null; root.classList.remove('rl-desk'); };
    }
    return () => root.classList.remove('rl-desk');
  });

  // ---- text: one SplitText per element, rebuilt on re-split; data-split-text tells home.js not to overwrite an unchanged split ----
  const splits = new Map();
  function splitText(el, type, build) {
    if (!Split) return null;
    const old = splits.get(el);
    if (old) { try { if (el.dataset.splitText === el.textContent.trim()) return old; } catch (e) { /* replaced */ } }
    const text = el.textContent.trim();
    const inst = Split.create(el, { type, mask: type.includes('lines') ? 'lines' : 'words', linesClass: 'rl-line', wordsClass: 'rl-word-u', aria: 'auto', autoSplit: true,
      onSplit: (self) => build(self) });
    el.dataset.splitText = text;
    splits.set(el, inst);
    return inst;
  }
  // headings: lines rise out of their masks, once
  const headline = (el, delay = 0) => splitText(el, 'lines', (self) => G.from(self.lines, { yPercent: 105, duration: 1.15, ease: RISE, stagger: 0.09, delay,
    scrollTrigger: el.closest('#hero') ? undefined : { trigger: el, start: 'top 86%', once: true } }));
  $$('[data-reveal]').forEach((el) => headline(el));
  // the hero headline plays on load (it is above the fold): line 1, then the bronze line 2
  const h1 = $('#heroTitle');
  if (h1) $$('.rl-hero__l1, .rl-hero__l2', h1).forEach((el, i) => headline(el, 0.15 + i * 0.22));
  // the statement: line by line — scrubbed with the scroll on desktop, once on phones
  const statement = $('[data-words]');
  if (statement) splitText(statement, 'lines', (self) => desk()
    ? G.fromTo(self.lines, { yPercent: 100, opacity: 0.25 }, { yPercent: 0, opacity: 1, ease: 'none', stagger: 0.3,
        scrollTrigger: { trigger: statement, start: 'top 85%', end: 'bottom 45%', scrub: 0.7 } })
    : G.from(self.lines, { yPercent: 100, duration: 1, ease: RISE, stagger: 0.1, scrollTrigger: { trigger: statement, start: 'top 85%', once: true } }));

  // ---- hero: the film pushes in inside its window, the headline lifts away ----
  G.fromTo(['.rl-hero__poster', '.rl-hero__video'], { scale: 1 }, { scale: 1.08, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  G.to('.rl-hero__body', { yPercent: -12, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: '#hero', start: '45% top', end: 'bottom top', scrub: true } });

  // ---- 01 location: pinned split screen on desktop, the place names light up in order ----
  mm.add(DESK, () => {
    const tl = G.timeline({ scrollTrigger: { trigger: '#place', start: 'top top', end: '+=130%', pin: true, scrub: 0.8, anticipatePin: 1 } });
    tl.fromTo('[data-zoom]', { scale: 1.16 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .fromTo('[data-places] li', { opacity: 0.16, x: 28 }, { opacity: 1, x: 0, ease: 'none', stagger: 0.14, duration: 0.3 }, 0.1)
      .fromTo('[data-places] li', { '--rl-lit': 0 }, { '--rl-lit': 1, ease: 'none', stagger: 0.14, duration: 0.3 }, 0.1);
  });
  mm.add(`not all and ${DESK}`, () => {
    G.fromTo('[data-places] li', { opacity: 0, y: 16 }, { opacity: 1, y: 0, '--rl-lit': 1, duration: 0.8, ease: RISE, stagger: 0.08,
      scrollTrigger: { trigger: '[data-places]', start: 'top 88%', once: true } });
    G.fromTo('.rl-place__fig', { clipPath: 'inset(12% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: RISE,
      scrollTrigger: { trigger: '.rl-place__fig', start: 'top 92%', once: true } });
  });

  // ---- 02 architecture: a pinned sideways gallery on desktop (RTL: the next picture enters from the left) ----
  mm.add(DESK, () => {
    const track = $('[data-track]'), vp = $('.rl-arch__viewport');
    const dist = () => Math.max(0, track.scrollWidth - vp.clientWidth);
    const tl = G.timeline({ scrollTrigger: { trigger: '.rl-arch__pin', start: 'top top', end: () => `+=${dist() * 1.1}`, pin: true, scrub: 0.8,
      anticipatePin: 1, invalidateOnRefresh: true } });
    tl.fromTo(track, { x: 0 }, { x: () => dist(), ease: 'none' }, 0)
      .fromTo('[data-drift]', { xPercent: -4 }, { xPercent: 4, ease: 'none' }, 0);
  });
  mm.add(`not all and ${DESK}`, () => {
    $$('.rl-arch__item').forEach((fig) => G.fromTo(fig, { clipPath: 'inset(14% 0% 0% 0%)', y: 24 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.1, ease: RISE,
      scrollTrigger: { trigger: fig, start: 'top 92%', once: true } }));
  });

  // ---- 03 experience: a sticky frame follows the step in view (desktop); steps rise once (phones) ----
  mm.add(DESK, () => {
    const layers = $$('.rl-steps__layer'), steps = $$('.rl-step');
    const on = (i) => { layers.forEach((l, j) => l.classList.toggle('is-on', j === i)); steps.forEach((s, j) => s.classList.toggle('is-on', j === i)); };
    on(0);
    steps.forEach((s, i) => ST.create({ trigger: s, start: 'top 58%', end: 'bottom 58%', onToggle: (self) => { if (self.isActive) on(i); } }));
    return () => { layers.forEach((l, j) => l.classList.toggle('is-on', j === 0)); steps.forEach((s) => s.classList.remove('is-on')); };
  });
  mm.add(`not all and ${DESK}`, () => {
    $$('.rl-step').forEach((s) => G.fromTo(s, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.9, ease: RISE, scrollTrigger: { trigger: s, start: 'top 88%', once: true } }));
  });

  // ---- the closing band: the dusk render opens from an inset window to full bleed (scrubbed), the title rises line by line ----
  G.fromTo('.rl-close__media', { clipPath: 'inset(9% 7% 9% 7%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
    scrollTrigger: { trigger: '[data-close]', start: 'top 92%', end: 'top 18%', scrub: true } });
  const closeTitle = $('#closeTitle');
  if (closeTitle) splitText(closeTitle, 'lines', (self) => G.from(self.lines, { yPercent: 105, duration: 1.1, ease: RISE, stagger: 0.1, scrollTrigger: { trigger: '[data-close]', start: 'top 55%', once: true } }));
  G.fromTo(['.rl-close__in .rl-word', '#closeCta'], { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1, ease: RISE, stagger: 0.12,
    scrollTrigger: { trigger: '[data-close]', start: 'top 55%', once: true } });

  // ---- a language switch: home.js replaced the text — split it again (no entrance), re-measure ----
  document.addEventListener('rl:rendered', () => {
    for (const [el, inst] of splits) {
      if (el.dataset.splitText === el.textContent.trim() && el.querySelector('.rl-line, .rl-word-u')) continue;
      splits.delete(el);
      const fresh = Split.create(el, { type: 'lines', mask: 'lines', linesClass: 'rl-line', aria: 'auto', autoSplit: true });
      el.dataset.splitText = el.textContent.trim(); splits.set(el, fresh);
    }
    ST.refresh();
  });
  addEventListener('load', () => ST.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
  reduce.addEventListener('change', () => location.reload());
  window.__rlMotion = { lenis: () => lenis, triggers: () => ST.getAll().length, splits: () => splits.size };
})();
