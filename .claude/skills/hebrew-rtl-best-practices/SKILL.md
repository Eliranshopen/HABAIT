---
name: hebrew-rtl-best-practices
description: "Build and check Hebrew right-to-left web UI: logical CSS properties, bidi isolation for numbers, prices, phones and mixed Hebrew-Latin text, icon mirroring, Hebrew type, Israeli formats (dot dates, ₪, Sunday weeks). Use when building or reviewing any Hebrew RTL screen."
allowed-tools: Read, Grep, Glob, Edit
license: MIT (Skills IL, skills-il/localization; LICENSE in this folder)
---

# Hebrew RTL best practices (router)

Installed into the Habait harness on 2026-10-03 by copy (D-DEV-UX-10) from `skills-il/localization` (commit `557cb8b`,
2026-10-01): the upstream `hebrew-rtl-best-practices/SKILL.md` cut to this router, with its framework step and the Israeli formats
of the sibling `israeli-ui-design-system` moved into `references/`. The upstream Hebrew twin, `evidence.json`, `metadata.json` and
`optimization-log.json` were not copied.

## House rules that override the upstream text (Habait)

1. **No letter-spacing on Hebrew text.** Emphasis is weight, never tracking or italic; word-spacing may open a dense line. (Upstream
   `hebrew-rtl-best-practices` calls tracking a legitimate emphasis device; `israeli-ui-design-system` says never. The house takes never.)
2. **Charts keep their axes.** Time runs left to right on every chart; never reverse an x-axis for RTL (upstream Step 7 item 7 says it
   "may need to reverse": not on Habait). Legends, labels and tooltips are RTL.
3. **Dates with dots, as `Intl` gives them:** `20.04.2026`, 24 h `14:30`, weeks start on Sunday, Friday and Saturday are the weekend.
4. **Amber is reserved** for the ״הדמיה״ AI-render badge and the footer's disclosure dot; no status, warning or highlight is amber or orange.
5. **Fonts follow the platform:** the app's Assistant for body text, Heebo for headings and every number (Heebo's ten digits share one
   advance; neither font has `tnum`). A static mock opened from `file://` links Google Fonts and keeps a system fallback with Hebrew glyphs.

## The rules (condensed from upstream Steps 1 to 5, 7, 8)

**1. Direction on the document.** `<html lang="he" dir="rtl">`, never CSS alone.

**2. Logical properties only.** `margin-inline-start/end`, `padding-inline-*`, `border-inline-*`, `inset-inline-*`, `text-align: start/end`,
`float: inline-start`. Where a logical property cannot express a rule, prefer `:dir(rtl)` over `[dir="rtl"]` (it resolves the computed
direction, `dir="auto"` and inheritance included; Baseline since late 2023). Shadows, gradients, `transform-origin`, `background-position`
and `translateX` keyframes are physical: flip each one explicitly when its direction means something. Flexbox `row` already reverses
in RTL; `row-reverse` flips it back to LTR order.

**3. Bidi text.**
- Isolate embedded LTR runs: `unicode-bidi: isolate; direction: ltr`. Mixed or unknown content: `unicode-bidi: plaintext` or `dir="auto"`.
  Never `bidi-override` for mixed content (it letter-reverses the Latin).
- **Format first, then isolate.** `Intl.NumberFormat('he-IL', {style:'currency', currency:'ILS'})` for shekels and `Intl.DateTimeFormat('he-IL')`
  for dates; wrap the output in `<bdi>` inside Hebrew prose. Never force `dir="ltr"` on `he-IL` currency output (it carries U+200F marks;
  forcing LTR moves the ₪). Force `dir="ltr"` only on raw digit strings: phones with spaces or `+972`, ids, codes.
- A hyphen-only phone (`050-321-4450`) stays intact by itself; `050 321 4450` and `+972 50-321-4450` need `<bdo dir="ltr">` or `<span dir="ltr">`.
- Inputs: `dir="auto"` on text inputs and textareas; `type="tel"` is LTR by default (leave `dir` off); `email` and `url` take `dir="ltr"`.
- `<bdi>` isolates unknown-direction content (a user name); `<bdo>` forces a direction. Pair `dir` with `lang` on an English run inside
  Hebrew prose (`<span lang="en" dir="ltr">`) so assistive tech switches language.
- Hebrew dates need `he-IL-u-ca-hebrew` for the Hebrew calendar; keep Gregorian for anything filed with an authority.

**4. Mirror only what has reading direction.** Mirror: back and forward arrows, breadcrumb and stepper chevrons, send and submit arrows,
pagination and carousel arrows, reply and indent icons, progress fills. Do not mirror: logos, checkmarks, close X, media play, clocks and
refresh, real objects (a phone, a magnifier), charts, numbers. Use `.icon:dir(rtl){transform:scaleX(-1)}`, not `rotate(180deg)`.

**5. Hebrew type.** Hebrew letters sit between the Latin x-height and cap height, so Hebrew reads smaller at the same size: 13 px is the
floor for any Hebrew text, 16 px for body and for every input at 768 px and below (iOS focus zoom). Line-height about 1.5 to 1.7 for running
text (niqqud needs room; a tight 1.2 clips it). Hebrew has no case: `text-transform: uppercase` does nothing to Hebrew and shouts at the
Latin words beside it, so drop case transforms.

**6. Component behaviour.** Close X at the inline-end (top-left in RTL); progress and slider fills grow from the inline-start (right);
dropdowns align to the trigger's inline-start; toasts anchor with `inset-inline-end`; scrollbars sit on the left, reserve them with
`scrollbar-gutter: stable`; in an RTL scroll container `scrollLeft` is `0` at the start and goes NEGATIVE toward the end, so a "next"
button uses `scrollBy({left: -300})`. Portalled UI (dialogs, menus, tooltips) inherits direction from `<html>`: set it there AND in the
library (Radix `DirectionProvider`, MUI `direction:'rtl'`).

**7. Tables.** Columns reorder by themselves; numeric, code and date cells stay LTR inside (`<bdi>` or `dir="ltr"` on an inner element)
and align consistently: on Habait numbers are right-aligned on both `th` and `td`, never `text-align: start` on a `direction: ltr` cell
(start then resolves to the left). Gershayim (״) and geresh (׳) belong to Hebrew abbreviations: `מ״ר`, `חד׳`.

**8. Verify, do not trust the rules.**
- Render the canonical mixed string on every text surface: `שלום John +972 50-123-4567 ₪1,234`.
- Open every dialog, dropdown, tooltip and toast (portalled UI is the most common miss); check fixed and sticky chrome, charts and form fields.
- Flip the page to `dir="ltr"` and look for anything that did not move (a physical property). Screenshot-diff both directions in a bounded
  browser run (`timeout` as the first word, one heavy run at a time; root `CLAUDE.md` §12).

## Gotchas

- `text-align: left` and `margin-left` are wrong in a Hebrew stylesheet; agents trained on LTR CSS generate them.
- Phone numbers, card numbers, code, file paths and CLI commands stay LTR inside RTL: set `code, pre, kbd, samp { direction: ltr;
  unicode-bidi: isolate; }` once.
- A shekel amount inline in Hebrew prose drifts between browsers unless it is `Intl` output inside `<bdi>`.
- Hebrew number agreement: ״דירה אחת״, ״2 דירות״, ״שתי דירות״ in prose; never ״1 דירות״.
- Gendered microcopy: Habait's house style is the plural imperative (״לחצו״, ״אשרו״) or a noun (״הרשמה״), never the masculine singular.

## References (open the one the task needs)

| File | Open when |
|---|---|
| `references/css-logical-properties.md` | converting a stylesheet: the full physical-to-logical table and Hebrew font stacks |
| `references/israeli-formats.md` | formats and Israeli fields: the type scale, the RTL component table, icon mirroring, teudat zehut and phone fields, currency, dates, calendars |
| `references/hebrew-typography.md` | choosing or tuning a Hebrew face: measured heights, pairings, loading |
| `references/domain-checklist.md` | a review: must-cover and should-cover items, each with its source |
| `references/framework-setup.md` | the Next.js port only: Tailwind logical utilities, App Router `dir`, MUI RTL, portalled UI (version claims not re-verified) |

Sources (upstream, read 2026-10-03): MDN logical properties and `:dir()`, the W3C inline bidi markup article, CLDR via `Intl`, the
Unicode bidi algorithm (UAX #9); links in the upstream file at `https://github.com/skills-il/localization`.
