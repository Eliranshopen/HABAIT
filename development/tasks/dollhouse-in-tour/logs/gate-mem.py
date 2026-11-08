entry = """
## 2026-11-03 · qa-reviewer · dollhouse-in-tour gate
- **Did:** Refuted card 02-04 in a fresh context: rebuilt platform and tour from the working-folder files, re-ran check-dit (39/39), reg-check-03/04/05/08/08-fallback and labels probe, smoke/minimap/apartment tests and paint-proof (6/6), all exit 0; wrote 4 probes (marker direction/position on all 11 interior scenes, 11 exteriors, 40x open/close, keyboard, he/en/fr, 4 phones, floor, apartment-page 3D tab, malformed messages, no-dollhouse build); built tree vs live dist (only index.html + 3d/ differ); wt.py drift 0.
- **Evidence:** `development/tasks/dollhouse-in-tour/logs/gate-report.md`, `gate-probe1..4.cjs/.txt`, `gate-*.txt`, `gate-open-*.png`, `gate-lang-*.png`.
- **Learned:** Verdict FAIL (2). D1 medium: Esc does not close the 3D layer once focus is inside the dollhouse iframe (real click on the canvas, then Esc: layer stays; dollhouse has no key handler). D2 low: working-copy `build_zip.mjs` is CRLF but live is LF (whole-file diff, shebang `\\r`); other five files keep CRLF. The marker's bearing, wedge geometry and cameras.json position all agree (0.1 deg, 0.1 cm). The dollhouse accepts postMessage only from its parent (self-posted test messages are silently ignored: send from the parent). Re-running an author's check overwrites its logs/frames. Bash heredocs eat backslashes in Python: write a file.
- **Owed / open:** main session routes D1 (dollhouse or tour: forward Esc / refocus) and D2 (re-save LF) before the card-06 copy-back; a gate re-run on those two only. Real GPU and iOS Safari untested; the layer does not pause tour audio/video.
- **Second reader:** main session (card 06 close; D1/D2 fixes); platform-dev (the dollhouse template Esc forward).
"""
open('C:/RnD/memory/agents/qa-reviewer.md', 'a', encoding='utf-8').write(entry)
idx = open('C:/RnD/memory/INDEX.md', encoding='utf-8').read()
line = "- qa-reviewer 2026-11-03 dollhouse-in-tour gate: FAIL 2 (D1 Esc dead once focus is in the 3D iframe; D2 build_zip.mjs working copy CRLF vs live LF); marker bearing/position verified on 11 rooms; regression, paint-proof, drift all clean -> memory/agents/qa-reviewer.md; report development/tasks/dollhouse-in-tour/logs/gate-report.md\n"
assert len(line) <= 401, len(line)
k = idx.index('## listings')
head = idx[:k].rstrip('\n') + '\n'
idx = head + line + '\n' + idx[k:]
open('C:/RnD/memory/INDEX.md', 'w', encoding='utf-8').write(idx)
print(len(line))
