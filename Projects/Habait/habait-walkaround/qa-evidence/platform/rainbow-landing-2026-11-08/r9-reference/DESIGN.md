# DESIGN.md — rainbowtlv.com (reference, read-only teardown, 2026-11-09)

Source: https://rainbowtlv.com/ (home page only; no crawling). Extracted with the `design-system` skill's browser-and-HTML path (no Stitch),
headless Chrome. Evidence in this folder: `shots/probe.json` (computed tokens, script and font requests, sections, button hover),
`inspect-1440/inspect.json` (135 nodes with rects and styles), `reanimate/ref-*/` (frame captures, `track.json`, sheets),
`sheet-ref-*.png` (scroll sequences at 1440 and 390, load frames, mid-reveal frames). Screenshots of their site are evidence only;
nothing of theirs (code, text, logo, images, video) is shipped. Values marked ⚠ are sampled from pixels, not read from CSS.

## 1. Visual theme and atmosphere
A bright gallery page: a white canvas, black type and one burst of colour. The first screen is a field of flat colour blocks
(pink, yellow, olive, sky, blue, orange, purple) with one white card floating in the middle that holds only the wordmark. After it the
page goes quiet: white, wide margins, one big picture per screen, a short paragraph next to it and a small black button. Titles are
English capitals in a thin flared roman (Optima), body text is Hebrew in a plain humanist sans. Colour comes back only in two places:
the rainbow stripe on the sticky bottom bar and the closing banner. Confident, airy, resort-like; nothing is dark, nothing glows.

## 2. Colour palette and roles
| Role | Name | Value | Where |
|---|---|---|---|
| Background | Gallery white | `#FFFFFF` | page, header after scroll, hero card |
| Text primary | Ink black | `#000000` (`--body-color`) | all body text, titles, nav |
| Button | Ink black / white text | `#000000` on `#FFFFFF` text | every section button |
| Button hover | Stone grey | `#A9A9A9` (computed after hover) | button background on hover, 0.3 s ease-in-out |
| Accent / footer | Blossom pink | `#F3BAC1` ⚠ (computed `rgb(244,186,193)` on the footer) | sticky bottom bar, hero block |
| Accent | Sun yellow | `#FFEC13` ⚠ | hero block |
| Accent | Olive | `#70770D` ⚠ | hero block |
| Accent | Sky | `#7CC0E3` ⚠ | hero block |
| Accent / link | Electric blue | `#1B36FF` ⚠ (also the computed link colour `rgb(27,54,255)`) | hero block, the accessibility link |
| Accent | Tangerine | `#FF6E13` ⚠ | hero block |
| Accent | Plum | `#572365` ⚠ | hero block (thin strip) |
| Declared, unused on the home page | `--primary-color #C63D25`, `--button-bg #50D8FF`, `--buttonred-bg #ED3257`, `--buttonblue-bg #0095FF`, `--buttondark-color #082C44` | | `:root` custom properties |

The seven accents appear as flat blocks (no gradients, no shadows) and, on the bottom bar, as a 4 px stripe of segments.

## 3. Typography
| Token | Value |
|---|---|
| Display | `optimaroman` (Optima Roman, self-hosted woff2) — commercial |
| Body / UI | `RagSans1_4Regular` (+ Bold, ExtraLight declared) — commercial Hebrew sans |
| Section title (h2) | Optima 60 px / 72 px, weight 400, letter-spacing −2 px, uppercase English ("THE …"); 38 px / 45.6 px on phones |
| Closing title | Optima 70 px / 84 px uppercase; 42 px / 50.4 px on phones |
| Body | Rag Sans 22 px / 29 px (≈ 21.7 px computed), black; phones 18 px / 30 px |
| Nav | Rag Sans 20 px / 29 px, black, 8 px side padding, no underline indicator |
| Button | Rag Sans 22 px / 29 px, padding 6 px 41 px, radius 2 px, height 41 px |
| Tiny text | 12.6–13.4 px (form consent lines) |

Hierarchy is carried by size and case only; there is one weight. Free substitutes with full Hebrew glyphs used in our build:
**Bellefair** (OFL; Hebrew + Latin; thin high-contrast roman, for display) and **Assistant** (OFL, variable; Hebrew + Latin; for body).

## 4. Component styles
- **Hero**: full viewport (100 vh). A background picture of flat colour blocks (`home-banner.jpg`, a portrait version on phones); a
  white card, 944 × 452 px at 1440 (66 % of the width; a tall portrait card on phones), centred, with a second white layer offset 9 px
  below it; inside, the wordmark only. A small "V" chevron under the card links down. The header is hidden on the first screen.
- **Header**: absolute, 51 px, white once shown, fades in (`transition: 0.5s`); logo at the inline start (right in RTL), seven nav
  links, a globe + "EN" switch at the far end. Phones: a fixed white bar, 47 px, logo centred, a burger and a pink lead icon.
- **Film section**: the brand film inset with 15 px side gutters (1410 × 768 at 1440), 128 px vertical padding (58 px on phones),
  native controls, a large round play button over the poster, not autoplayed.
- **Parallax band**: a full-bleed picture 850 px tall (422 px on phones) whose background moves slower than the page (jquery.parallax).
- **Intro paragraph**: centred, 621 px wide, 108 px above / 112 px below.
- **Chapter row** (×7): 160 px vertical padding (60 px on phones). One picture, 844 × 556 (≈ 3 : 2), bleeding to the page edge on its side;
  a 465 px text column on the other side with the English title, a 3–4 line Hebrew paragraph and the black button 75 px below. Sides
  alternate row by row. Phones: picture full width on top, then title, paragraph and button, all centred.
- **Closing banner**: the colour-block picture again, 750 px, with "LIVE THE RAINBOW" in Optima 70 px.
- **Sticky bottom bar**: pink, 130 px at 1440, a 4 px rainbow stripe on top, the developer logo, a five-field lead form and a black
  submit button; fixed to the bottom of the viewport throughout the page. On phones it becomes a 718 px block at the end of the page.
- **Accessibility**: the UserWay widget (a round black button bottom corner).

## 5. Layout principles
- Container 1430 px with 15 px padding; content width 1400 px; no max-width beyond that (full-bleed pictures run to the edge).
- Whitespace is generous and regular: 160 px between chapters, 108–128 px around the intro and the film.
- One idea per screen at 1440 × 900: each chapter row is 876 px tall, almost exactly one viewport.
- Text sits in narrow columns (465 px, 621 px) and is centred inside them; Hebrew paragraphs are centred, not justified.
- Breakpoints: 1793, 1660, 1550, 1450, 1386, 1279, 1240, 1199, 1150, 1080, 991, 767, 587, 360 (Bootstrap-like, many tweaks).

## 6. Motion system (measured)
Libraries (script URLs and globals): jQuery 3.6.3, AOS (`window.AOS`), jquery.nicescroll (smooth wheel scroll on desktop),
jquery.parallax (`$.fn.parallaxbg`), validate. No GSAP, Lenis, Swiper, Locomotive or Barba; no preloader, no custom cursor.
| Pattern | How they do it | Numbers (reanimate `easing.ts` on `track.json`) |
|---|---|---|
| Hero entrance | AOS `fade-up` on the wordmark and the line above it, on load | opacity 0 → 1 and translateY 100 → 0 px, CSS `ease`, fitted 975 ms (RMSE 0.010), starts ≈ 0.8 s after navigation (AOS waits for load); same on phones (952 ms) |
| Text reveal | AOS `fade-up` (intro, film) / `fade-left` / `fade-right` (chapter text) | 100 px travel, `ease`, ≈ 950 ms, once, when the element's top passes ≈ 120 px into the viewport |
| Picture reveal | `.image-in-out`: the outer layer slides in from the page edge while the inner picture slides the other way and settles from scale 1.3 | outer translateX +928 → 0 px (the picture's width) and scale 1.3 → 1; inner translateX −852 → 0; **linear**, 900 ms; starts ≈ 0.42 s before the chapter text |
| Order in a row | picture first, text 0.42 s later | both come from the outer page edge toward the centre |
| Parallax band | background position follows scroll at a lower rate | jquery.parallax |
| Header | hidden on the hero, fades in once the page scrolls | `transition: 0.5s` (opacity) |
| Button hover | background black → grey | 0.3 s ease-in-out |
| Phones | the same AOS fades; the picture wipe still runs (outer +429 → 0, scale 1.3 → 1, linear 900 ms) | — |
| Reduced motion | not handled (AOS runs regardless) | — |

## 7. Design system notes for generation (our build)
Gallery white page, ink-black text, one colour-block field for the first and last screens in the seven accents above, no dark
sections. Display: Bellefair 400, large (56–64 px desktop, 36–40 px phone), tight leading, Latin capitals letter-spaced lightly. Body:
Assistant 300–400, 20–22 px desktop / 17–18 px phone, line-height ≈ 1.45. Buttons: black rectangles, 2 px radius, 44 px tall minimum,
white text, hover to the accent blue in 0.3 s ease-in-out. Chapters: one picture per screen bleeding to its page edge, a narrow centred
text column beside it, sides alternating; 160 px between chapters on desktop, 64 px on phones. Motion: fade-up / fade-from-the-side
100 px, CSS `ease`, ≈ 1 s, once; pictures wipe in from the page edge, linear 0.9 s with a 1.3 → 1 settle, text 0.4 s after the picture.
A sticky pink bottom bar with the rainbow stripe carries the one call to action.
