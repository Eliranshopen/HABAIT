# Milestone 2.1 · task 02 — The contract of the render stage
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE` — 2026-11-19: `Projects/3Dengine/contracts/CONTRACT-2.1.md`, thirteen sections, on the facts of the proof.

## Files it creates or changes
- `Projects/3Dengine/contracts/CONTRACT-2.1.md` (new)
- `Projects/3Dengine/contracts/CLAUDE.md` (its row)

## Instructions
Write what milestone 2.1 binds, before the stage code and on the facts of the proof. It must settle, each in one place: (a) WHERE a job's build and render files live, given that the tools write at fixed places inside the pipeline tree, and what is left in that tree when a job ends; (b) what the outputs of `building` and of `rendering` are, and which of them the manifest hashes (only bytes that are the same in every attempt may be a hashed output: contract 0.3 §11.3); (c) the row per room: what it holds, the hash of its inputs, and the rule «a room the job holds is never rendered again»; (d) what «the same picture» means for a repeated render, as measured (the colour picture of the tool is not the same bytes twice; the depth's packed pixels are); (e) the Blender lock: the tools' machine-wide lock FILE and its protocol, that the engine holds it around every Blender run, waits for another holder and never takes it, and removes only its OWN lock left by a dead runner; and that the engine's folder lock is never used on that path (a folder renamed onto a FILE replaces it); (f) how a job stops a render (the whole process tree) and what a stop leaves; (g) the crop of the drawing as an input of the build (a line of contract 1.3 changes: the reading stage's outputs); (h) a room `type` the build does not know is refused before Blender starts (1.3's review, O-1); (i) how the render is limited to some points (the closing test renders two); (j) free: no key reaches the tools and no keys file is read; (k) what a real job does after `rendering` today; (l) what is NOT in 2.1, each with the milestone that owns it (the whole apartment and the CG check: 3.1; the link: 3.3).

## Acceptance criteria
1. Every binding line is one sentence that a test can make false.
2. What changes in a binding line of an earlier contract is listed (1.3: the outputs of the reading stage; 0.3: nothing, or what).
3. The items the board carried to card 08 are answered by name, or handed on with the card that owns them.
4. What is not in 2.1 is listed with the milestone that owns it.

**Check:** the file exists, and `grep -c "^## " Projects/3Dengine/contracts/CONTRACT-2.1.md` prints at least 9.

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
