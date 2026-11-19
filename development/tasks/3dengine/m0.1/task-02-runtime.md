# Milestone 0.1 · task 02 — The runtime, from locks
<!-- board: 3dengine · milestone 0.1 (card 01 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role.
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `requirements.lock.txt` — 20 pins, the versions of the environment that produced apartment 846
- `appdeps/package.json`, `appdeps/package-lock.json` — from the backup (sharp 0.34.4, playwright-core 1.56.1)
- untracked: `.venv/`, `appdeps/node_modules/`

## Instructions
Create the Python environment on the installed Python 3.13.5 and install from the lock; install the two Node libraries with `npm ci`. Run by hand once (root §3); the set-up script of task 04 repeats it for the live home.

## Acceptance criteria
1. `pip freeze` lists exactly the 20 pinned packages.
2. The six libraries import: numpy, shapely, cv2, PIL, skimage, pymupdf.
3. `sharp` and `playwright-core` resolve from `appdeps/` at the locked versions.

## Result
Done 2026-11-16: 20 packages, onnxruntime 1.31.1 after the lock was completed; imports ok (numpy 2.5.4, OpenCV 5.0.0, PyMuPDF 2.0); sharp 0.34.4, playwright-core 1.56.1.

## Standing rails
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2`.
6. Root `CLAUDE.md` §2, §8.7, §12: work only in the board's working folder; `timeout` on every run, one heavy run at a time, foreground; never open a `.env`; the plan's budget or $0; no deploy without Eliran's own go for that deploy (§9).
7. **The gate (Eliran, 2026-11-16):** no card starts before the previous card is closed. A card closes only after its closing test, its unit tests, every earlier card's tests, test coverage of at least 80 %, and a sync-context pass (plan §7.2).
8. **Git:** stage only your own paths; ⛔ never `git add -A` (the deletion of `Projects/Habait` in the main tree is unstaged and must stay so); never push.
9. **Secrets by NAME only:** never print a value, never name a `.env` path in a command; check a key's presence as a yes/no.
10. **Paid calls:** ledger row BEFORE the call, dry-run first, inside the cap, and only after Eliran answered the card's question.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
