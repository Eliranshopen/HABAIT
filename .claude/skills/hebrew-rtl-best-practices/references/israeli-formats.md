# Israeli formats and RTL component behaviour

<!-- Extracted verbatim from skills-il/localization `israeli-ui-design-system/SKILL.md` Steps 2, 3 (the component table and the icon
     table), 6 (identity and contact fields, gendered microcopy, mixed-direction content) and 7 (currency, numbers, dates, calendars)
     (MIT, commit 557cb8b, 2026-10-01), installed into the Habait harness 2026-10-03 (D-DEV-UX-10). Two house overrides, see the router:
     NO letter-spacing on Hebrew (this file agrees: "NEVER use letter-spacing for Hebrew"), and dates with dots as Intl gives them. -->

### Step 2: Hebrew Typography Scale

Hebrew letters are drawn between the Latin x-height and cap height, with no capitals or tall ascenders, so Hebrew reads **smaller** than Latin at the same font size. Size the scale for Hebrew, not for Latin (measured heights per font are in `references/hebrew-typography.md`):

```css
:root {
  /* Hebrew-adjusted type scale */
  --text-xs: 0.8125rem;   /* 13px -- minimum readable Hebrew */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px -- Hebrew body text minimum */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */

  /* Hebrew-specific line heights (taller than Latin) */
  --leading-tight: 1.4;
  --leading-normal: 1.7;
  --leading-relaxed: 1.9;

  /* NEVER use letter-spacing for Hebrew */
  --tracking-hebrew: normal;
  /* Slight word spacing improves Hebrew readability */
  --word-spacing-hebrew: 0.05em;
}

/* Hebrew body text: dir usually sits on <html>, so match either element */
html[dir="rtl"] body,
body[dir="rtl"] {
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-hebrew);
  word-spacing: var(--word-spacing-hebrew);
}
```

**RTL behavior for the rest of the component set.** Buttons, cards, and the sidebar are not the whole story - mirror every directional component:

| Component | RTL behavior |
|-----------|--------------|
| Breadcrumbs | Flow right-to-left; the separator (`/`, `>`, chevron) points left (toward the next crumb). A text separator (`>`, `›`) is a bidi-mirrored character that the browser already flips in RTL, so do not add `scaleX(-1)` to it (that flips it back). Only SVG or icon-font chevrons need `transform: scaleX(-1)`, and a transform has no effect on an inline element, so give an icon-font glyph `display: inline-block`. |
| Modals / dialogs | Centered modals need no change. Close (X) button sits at the inline-end (top-left in RTL). Footer action buttons: a common house convention puts the primary at the inline-start, so it lands on the right in RTL; pick one order and keep it. |
| Dropdowns / menus | Open aligned to the inline-start edge of the trigger; submenu flyouts expand toward the inline-start (to the left in RTL). Caret/chevron mirrors. |
| Sliders / range inputs | The track fills from the inline-start - in RTL the minimum is on the right, maximum on the left. Native `<input type="range">` with `dir="rtl"` handles this; custom sliders must flip the fill direction. |
| Progress bars | Fill grows from the inline-start, so progress advances right-to-left in RTL. Use `transform-origin` / logical properties, not a hardcoded `left: 0` origin. |
| Toasts / snackbars | Slide in from the inline-end edge of the viewport - top-left or bottom-left in RTL (mirrored from the LTR top-right convention). Anchor with `inset-inline-end`, not `right`. |

```css
/* Toast anchored to the inline-end edge -- flips sides automatically in RTL */
.toast {
  position: fixed;
  inset-block-start: 1rem;
  inset-inline-end: 1rem;
}

/* Progress bar fill grows from the inline-start */
.progress-fill {
  block-size: 100%;
  inline-size: var(--progress, 0%);
  /* fill starts at the inline-start edge: right in RTL, left in LTR */
}
```

**Which icons mirror.** Mirror icons that show direction along the reading line; leave the rest:

| Mirror in RTL | Do not mirror |
|---------------|---------------|
| Back/forward arrows, chevrons in breadcrumbs and steppers, "next" and "send" | Media play, pause and seek controls (they follow tape direction) |
| Reply, list indent, text-align icons | Clocks, refresh and history icons (time runs clockwise everywhere) |
| Progress and slider fills, linear timelines | Checkmarks, search, camera and other non-directional objects |
| Icons of an object moving forward | Charts and graphs, numbers, logos, slashes |

Undo and redo imply both a horizontal and a circular direction: in RTL choose one and apply it consistently. Encode each choice once (for example a `data-mirror` attribute or an icon-registry flag) rather than per usage.

**Israeli identity and contact fields.** Three input types that Latin-first design
systems get wrong:

```html
<!-- Teudat zehut: up to 9 digits, and a leading zero is significant.
     type="number" silently eats it and adds spinners. Always text + inputmode,
     and validate in script after trimming (isValidTz below), not with pattern. -->
<input id="tz" type="text" dir="ltr" inputmode="numeric"
       maxlength="9" autocomplete="off">

<!-- Israeli mobile: 05X + 7 digits, accepting the dashed and +972 forms users
     actually type. Keep it LTR inside the RTL form. Normalise on submit. -->
<input id="phone" type="tel" dir="ltr" inputmode="tel"
       autocomplete="tel">
<!-- Validate after stripping spaces and dashes (users paste "054 123 4567"):
     /^(0|\+?972-?0?)5\d{8}$/ on the normalised value, not a pattern attribute. -->

<!-- Email, URL and IBAN are Latin content: force LTR so the cursor and any
     punctuation behave, even though the surrounding form is RTL. -->
<input id="email" type="email" dir="ltr" autocomplete="email">
```

The ninth digit of a teudat zehut is a check digit, and shorter numbers are left-padded with zeros to nine digits. Pad first, then validate:

```js
function isValidTz(raw) {
  const digits = String(raw ?? '').trim();
  if (!/^\d{1,9}$/.test(digits) || /^0+$/.test(digits)) return false; // no empty, all-zero or non-digit input
  const id = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const n = Number(id[i]) * ((i % 2) + 1); // weights 1,2,1,2,...
    sum += n > 9 ? n - 9 : n;                // add the digits of a two-digit product
  }
  return sum % 10 === 0;
}
isValidTz('50012343'); // => true (padded to 050012343)
```

**Gendered microcopy (practice).** Hebrew verbs and adjectives carry gender, so a masculine-only imperative ("לחץ", "הירשם") addresses half your users wrongly. Common house styles use the plural imperative ("לחצו", "הירשמו") or an infinitive ("ללחוץ כאן"), or reword to a noun ("הרשמה"). Pick one style and put it in the content guidelines next to the tokens.

**Mixed-direction user content.** Anything a user typed, and anything from an API,
may be Hebrew or Latin. Do not hardcode a direction on it: `dir="auto"` lets the
first strong character decide, per element.

```html
<textarea dir="auto"></textarea>
<li dir="auto">{{ comment.body }}</li>
```

Set `dir="auto"` per item, never once on a list wrapper: a single wrapper takes
the direction of the first item and misaligns every other one.

### Step 7: Israeli Formatting Conventions (Currency, Numbers, Dates)

Design tokens and components must encode Israel-specific formatting, not mirror Latin/US defaults.

**Currency: shekel sign (₪)**

The shekel sign `₪` (U+20AA) is typically placed after the amount in Israeli financial contexts (e.g., `1,234.50 ₪`), though `₪ 1,234.50` is also common in retail. Whichever convention you pick, apply it consistently. Because numbers are inherently LTR, any amount inline inside Hebrew RTL text needs explicit bidi isolation or the surrounding punctuation may reorder.

```html
<!-- Correct: isolate the amount so the currency symbol stays put -->
<p>המחיר הוא <bdi>1,234.50 ₪</bdi> בלבד.</p>
```

```js
// Prefer Intl.NumberFormat over hand-formatting -- it handles symbol placement,
// grouping separators, and invisible RTL marks correctly across browsers.
new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
}).format(1234.5);
// => "‏1,234.50 ‏₪"  (renders as "1,234.50 ₪")
```

The returned string is NOT the clean `"1,234.50 ₪"` it looks like. It carries two
RTL marks (U+200F) and a non-breaking space, which is exactly what keeps the sign
from drifting in bidi text. Never assert string equality against a hand-typed
literal in a snapshot or unit test: compare `Intl` output to `Intl` output, or
strip `‏ ` first.

**Numbers in Hebrew body text**

Numbers (phone numbers, ID numbers, prices, dates) do not reverse under RTL. But when a long number sits inside Hebrew text, browsers may reflow surrounding punctuation. Use `<bdi>` or `dir="ltr"` on the number element to lock it.

```html
<p>מספר הזהות הוא <bdi>012345678</bdi>, בתוקף עד 2030.</p>
```

**Dates and time**

Israeli dates are day-first, never US `MM/DD/YYYY` and never ISO `YYYY-MM-DD` in
user-facing copy. Use 24-hour time (`14:30`); AM/PM is rare in Israeli UIs.

**The platform separator is a dot, not a slash.** CLDR gives Hebrew the short
pattern `d.M.y`, so `Intl` returns dots and no browser setting turns them into
slashes:

```js
new Intl.DateTimeFormat('he-IL', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(2026, 3, 20));
// => "20.04.2026"   (dateStyle: 'short' gives "20.4.2026")
```

Dots are the safe default: they are what a native user expects and what every
other Hebrew app shows. If a brand guideline demands `20/04/2026`, compose it
yourself instead of expecting `Intl` to produce it:

```js
const parts = Object.fromEntries(
  new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .formatToParts(new Date(2026, 3, 20))
    .map((p) => [p.type, p.value]),
);
`${parts.day}/${parts.month}/${parts.year}`; // => "20/04/2026"
```

**Calendars.** For `he-IL`, `locale.getWeekInfo?.() ?? locale.weekInfo` (with `const locale = new Intl.Locale('he-IL')`; some runtimes, including Node 20 and 22, only have the older `weekInfo` accessor) returns `firstDay: 7` (Sunday) and `weekend: [5, 6]` (Friday and Saturday). Date pickers and calendar grids must start the week on Sunday and mark Friday and Saturday, not Saturday and Sunday. A native `<input type="date">` displays in the browser's own locale format, which can show `20/04/2026` beside your `20.04.2026` text; use a custom picker if the two must match.

Define design tokens so downstream components stay consistent:

```css
:root {
  --date-format-short: 'dd.MM.yyyy';
  --time-format: 'HH:mm';
  --currency-locale: 'he-IL';
  --currency-code: 'ILS';
}
```

**Number separators**

Thousands separator is comma (`1,234,567`), decimal is period (`1,234.50`). Do not switch to European `1.234,50` style; Israeli finance uses the US convention.
