---
name: new-listing
description: "Scaffold a new per-listing folder for the Apartment Visualizer harness. Creates the uniform listings/<id>/ structure (inputs, staged, depth, clips, pano, output) and an empty manifest.json. Use when starting a new apartment, or when the user says 'new listing', 'add a listing', 'scaffold listing', 'set up <name>', or invokes /new-listing."
argument-hint: "<listing-id> [\"Listing Title\"]"
user-invocable: true
allowed-tools: Bash, Read
model: inherit
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/new-listing`); the flag is reversible and nothing is archived.

# New Listing — scaffold a per-listing folder

Creates the uniform folder convention from `CLAUDE.md` §4 so one skill can later handle any apartment. This is a **deterministic utility** — no AI, no cost. It does not stage anything; it just prepares the workspace and the manifest.

## Step 1 — Parse arguments

`$ARGUMENTS`: first token is the **listing id** (kebab-case, e.g. `seaview-42`). The rest (optional, in quotes) is a human **title**.

- If empty, ask: **"What's the listing id? (e.g. `seaview-42`)"** and stop.
- Sanitize the id to `[a-z0-9-]` (lowercase, spaces→`-`). Reject path separators.
- If `listings/<id>/` already exists, tell the user and stop (don't clobber).

## Step 2 — Create the structure

```bash
ID="<sanitized-id>"
BASE="listings/$ID"
mkdir -p "$BASE/inputs" "$BASE/staged" "$BASE/depth" "$BASE/clips" "$BASE/pano" "$BASE/output"
```

## Step 3 — Write the manifest

Write `listings/<id>/manifest.json` with this shape (per `CLAUDE.md` §7 — per-stage, per-room checkpoints + content hashes for idempotency):

```json
{
  "listing_id": "<id>",
  "title": "<title or id>",
  "created": "<YYYY-MM-DD>",
  "schema": 1,
  "experience": null,
  "rooms": {},
  "stages": {
    "stage":      {"done": [], "version": null},
    "depth":      {"done": []},
    "animate":    {"done": []},
    "build_tour": {"done": false},
    "build_page": {"done": false}
  },
  "notes": []
}
```

`rooms` will later map `room -> {input_hash, staged_hash, ...}`. `experience` is set later by the routing rule (`video` | `360` | `3d`). Use today's date from the session context for `created`.

## Step 4 — Seed the listing's memory (collective memory, CLAUDE.md §0)

Create `memory/listings/<id>.md` from `memory/_TEMPLATE.md` (type `outcome`, tags `[listing, scaffold]`, `listing: <id>`): *"Scaffolded listing `<id>`. Awaiting photos in inputs/."* Then add one line to `memory/INDEX.md` under the `listings/` section:
`- [<id>](listings/<id>.md) — <date> · scaffolded; <title>; awaiting photos.`
This is where all per-listing context accrues from now on (choices, what's produced, what's pending).

## Step 5 — Report

Tell the user the folder is ready and the next step:

> ✅ `listings/<id>/` scaffolded + memory seeded. Drop the realtor's photos into `listings/<id>/inputs/` (one file per room, named by room — e.g. `living.jpg`, `kitchen.jpg`). Then run the staging step.

## Rules

- **Never** write into `inputs/` — that's the read-only originals area (the user fills it).
- Don't decide the `experience` here — that's the routing rule's job once photos exist.
- This skill makes no network calls and costs nothing.
