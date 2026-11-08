GATE: FAIL (2 defects: 1 medium, 1 low)

Board dollhouse-in-tour, card 05, qa-reviewer, fresh context, 2026-11-03. Tested what will ship: working-folder files copied over the run copies (all six were already byte-identical to the run copies), platform and tour rebuilt (`gate-build-platform.txt`, `gate-build-tour.txt`, both exit 0). Nothing under Projects was touched; no live drift.

## Defects

| # | Sev | Defect | Repro |
|---|---|---|---|
| D1 | medium | Esc does not close the 3D layer once focus is inside the dollhouse iframe. The tour's only Esc handler is on the tour document and the dollhouse page has none, so after the buyer clicks or drags in the 3D (its main use) Esc does nothing and only the x works. The claim "Esc / x close" holds only before the first interaction with the 3D. Every probe on a keyboardless phone is unaffected. | `gate-probe4.cjs`: open the layer, real `mouse.click` on the 3D canvas, press Escape: layer stays open, activeElement = `t-3d-frame` (`gate-probe4.txt`). Also `gate-probe1.txt`: Tab from x lands on the frame and stays there (aria-modal, no focus trap). Fix idea: dollhouse posts `habait:3d-escape` (or the tour re-focuses the x after a click) and the tour closes. |
| D2 | low | `platform/tools/build_zip.mjs` line endings: the live file is LF (835 lines, 0 CRLF), the working copy is CRLF (851 lines, every line). Copy-back would turn a 16-line change into a whole-file rewrite (raw diff 1688 lines vs 20 with `--strip-trailing-cr`), and the shebang line becomes `#!/usr/bin/env node\r`, which breaks direct execution on POSIX (`node tools/build_zip.mjs` still runs). The other five files are CRLF in both live and working copy: only this one changed convention. | `python -c` count of `b"\r\n"` in live vs `.wt/.../build_zip.mjs`; `diff` vs `diff --strip-trailing-cr`. Fix: re-save the working copy with LF before the card-06 copy-back. |

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Rebuild platform + tour from the working-folder files | PASS | `gate-build-platform.txt` (27 files, 4.87 MB, exit 0), `gate-build-tour.txt` (22 scenes, exit 0, `3d/dollhouse.html` present) |
| 2a | `check-dit.cjs` | PASS 39/39 (desktop, iPhone 13, Pixel 7) | `gate-check-dit.txt`. Note: the script writes `check-dit.txt` and `dit-*.png` in `logs\` itself, so the author's copies were overwritten with the identical result |
| 2b | `reg-check-03/04/05/08/08-fallback`, `reg-probe-labels-embedded` | PASS, all exit 0 (no fail lines) | `gate-reg-*.txt` |
| 2c | platform `smoke`, `minimap.test`, `apartment.test` | PASS, all exit 0 | `gate-smoke.txt`, `gate-minimap.test.txt`, `gate-apartment.test.txt` |
| 2d | `run-paint-proof.cjs` | PASS 6/6, no stray chrome | `gate-paint-proof.txt` |
| 3a | Marker direction and position, all 11 interior scenes (yaw set to 37 deg, layer opened) | PASS 11/11. Marker `bearingDeg`, the wedge mesh's own world direction (computed from its vertices and matrixWorld, independent of `setHere`) and my expected `centreBearingDeg + getYaw` agree to 0.1 deg; marker is on its own room (`r-<scene>`); marker position equals cameras.json `at` / 2.25 px per cm to within 0.1 cm relative to the first room. Convention matches `minimap.js` (`viewBearing = bearing0 + yaw`, 0 = up, clockwise) | `gate-probe1.txt` |
| 3b | Exterior scenes hide the button | PASS 11/11 exteriors; also with the layer closed a `habait:enter-room` into `aerial` hides the button | `gate-probe1.txt`, `gate-probe3.txt` |
| 3c | Open/close x40 (mixed fast and slow) | PASS: 0 page or console errors, exactly one `#t-3d-frame`, one iframe | `gate-probe1.txt` |
| 3d | Keyboard | PARTIAL: focus goes to x on open and back to the 3D button on close (Enter and Space work); Esc works from the tour document. FAIL after interaction with the 3D, see D1 | `gate-probe1.txt`, `gate-probe4.txt` |
| 3e | RTL/LTR header, he/en/fr | PASS: he `dir=rtl`, title at the right, x at the left; en/fr ltr, title left, x right; labels translated (תלת-ממד / 3D view / Vue 3D, close labels), x is 44x44 | `gate-probe1.txt`, `gate-lang-*.png` |
| 3f | Phone: iPhone 13, Pixel 7, 320x568 SE, iPhone 13 landscape | PASS: no horizontal scroll in the tour or the dollhouse, header at top 0 with safe-area padding, x 44 px inside the viewport, frame fills to the bottom, 3D button inside the viewport and 44 px, 0 errors | `gate-probe1.txt`, `gate-open-*.png` |
| 3g | Floor reaches the dollhouse | PASS: `?floor=marble/parquet/concrete` each shown by the dollhouse; also the tour's own floor control after the dollhouse had already loaded (the tour reloads with `?floor=` so the dollhouse is fresh), marker still on the kitchen | `gate-probe1.txt`, `gate-probe3.txt` |
| 3h | Dollhouse inside the apartment page (`apartment.html?...&tab=3d`, run `serve.mjs`) | PASS: `here` null, no wedge mesh, selection kept after 3D -> 360 -> back; only the parent's messages are accepted (a self-posted message is ignored); malformed `you-are-here` payloads (NaN, strings, null, huge fov, object scene) cause no error; a repeat you-are-here for the same room does not re-close a fresh selection; unknown scene clears the marker. Cosmetic: `state.here.bearingDeg` is not normalized (720.5 stays 720.5), the tour always sends 0..360 | `gate-probe2.txt`, `gate-apartment-3d.png` |
| 3i | Other: `enter-room` for the current scene closes the layer with no reload; unknown scene ignored without error | PASS | `gate-probe3.txt` |
| 4 | Defaults and determinism | PASS: without the new flags `APT`/`OUT` resolve exactly as before. Built tree vs the live `dist/apt846`: same 175 files plus `3d/dollhouse.html`, and only `index.html` differs in content (no panos, fonts, thumbs, guide, api changed). With no platform dist or no match, `data.dollhouse` is not set; simulated by removing it from the built page: button hidden, layer closed, no src, 0 errors. Several platform dists carrying unit 846 warn and take none | `gate-cmp-dist.py/.txt`, `gate-probe4.txt`, code read of `build-tour.mjs` |
| 5 | Live untouched | PASS: `wt.py status` shows 0 DRIFT (5 changed, 5 unchanged, 1 missing-copy = the new `3d/dollhouse.html`, as expected) | `gate-wt-status.txt` |

## Not covered / notes
- No real GPU, real touch devices or the deployed site: swiftshader Chrome and Playwright emulation only. The tour's 3D layer on Safari iOS (iframe focus, `100vh`) is untested.
- Not run by rail: `live-check.mjs` (paid).
- The open layer does not stop the tour's audio or video behind it (not a claim of the board; mention for the look call).
- Probes: `gate-probe1.cjs` (A-G), `gate-probe2.cjs`, `gate-probe3.cjs`, `gate-probe4.cjs`; servers on 8851 only, killed in a finally; port 8851 is free (TIME_WAIT only).
