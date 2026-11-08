#!/usr/bin/env python3
"""Fetch the CC0 probe assets for board 360-v2 T03, and write their provenance rows.

$0 by construction: every file comes from polyhaven.com, whose entire library is published under
CC0 1.0 (https://polyhaven.com/license).  No key, no account, no paid tier.

Rail 4 ("CC0 provenance or it doesn't land"): the binaries are gitignored; `assets.lock.json`,
this script and the generated `PROVENANCE.md` are the committed truth.  A re-fetch is idempotent —
a file whose sha256 already matches the recorded row is not downloaded again.

Usage (repo root or anywhere; paths resolve off __file__):

    PYTHONIOENCODING=utf-8 python 360walkaround/pipeline/probe/probe-assets/fetch-assets.py
    PYTHONIOENCODING=utf-8 python .../fetch-assets.py --verify-only     # no network writes

Exit 0 = every pinned file present and hash-verified.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LOCK = os.path.join(HERE, "assets.lock.json")
PROVENANCE = os.path.join(HERE, "PROVENANCE.md")
API = "https://api.polyhaven.com"
UA = {"User-Agent": "RealEstateTeam-360v2-probe/1.0 (+board 360-v2 T03; CC0 asset fetch)"}


def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _download(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _plan_files(asset: dict) -> tuple[list[tuple[str, str]], str]:
    """Return ([(relative_dest, url)], asset_page_url) for one pinned asset."""
    slug, res, fmt = asset["slug"], asset["resolution"], asset["format"]
    files = _get_json(f"{API}/files/{slug}")
    out: list[tuple[str, str]] = []
    dest = asset["dest"]

    if asset["kind"] == "model":
        entry = files[fmt][res][fmt]
        out.append((f"{dest}/{slug}_{res}.{fmt}", entry["url"]))
        # Poly Haven model blends reference their textures as //textures/<name>; keep that layout.
        for rel, inc in sorted(entry.get("include", {}).items()):
            out.append((f"{dest}/{rel}", inc["url"]))
    elif asset["kind"] == "hdri":
        entry = files["hdri"][res][fmt]
        out.append((f"{dest}/{slug}_{res}.{fmt}", entry["url"]))
    elif asset["kind"] == "texture":
        for map_name in asset["maps"]:
            node = files[map_name][res]
            # prefer the pinned format, else whatever single format the map ships in
            key = fmt if fmt in node else sorted(node.keys())[0]
            entry = node[key]
            out.append((f"{dest}/{slug}_{map_name}_{res}.{key}", entry["url"]))
    else:  # pragma: no cover - the lock file is ours
        raise SystemExit(f"unknown asset kind {asset['kind']!r}")

    return out, f"https://polyhaven.com/a/{slug}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify-only", action="store_true",
                    help="do not download; only hash what is already on disk")
    args = ap.parse_args()

    lock = json.load(open(LOCK, encoding="utf-8"))

    # ---- C-360-84's provenance validator, extended by A9-8 (C-360-91) --------------------------
    # An environment-asset row MUST carry exterior_class ∈ {non-locating, locating} plus a reason.
    # This is the row-class check; build_scene.py holds the render-time check (only `non-locating`
    # may enter a frame).  ⛔ Fail closed: an unclassified sky never reaches a provenance table.
    bad = []
    for a in lock["assets"]:
        if a.get("kind") != "hdri":
            continue
        cls = a.get("exterior_class")
        if cls not in ("non-locating", "locating"):
            bad.append(f"{a['slug']}: exterior_class={cls!r} (want 'non-locating' or 'locating')")
        elif not a.get("exterior_class_reason"):
            bad.append(f"{a['slug']}: exterior_class {cls!r} carries no exterior_class_reason "
                       f"(A9-8: the value is a recorded judgment WITH a one-line reason)")
    if bad:
        print("FAIL: environment-asset provenance rows are incomplete (CONTRACT A9-8 / C-360-91):")
        for b in bad:
            print(f"  - {b}")
        return 1

    today = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
    rows: list[dict] = []
    total = 0
    missing = 0

    for asset in lock["assets"]:
        plan, page = ([], f"https://polyhaven.com/a/{asset['slug']}")
        if not args.verify_only:
            plan, page = _plan_files(asset)
        else:
            root = os.path.join(HERE, asset["dest"].replace("/", os.sep))
            for dirpath, _dirs, names in os.walk(root):
                for n in sorted(names):
                    p = os.path.join(dirpath, n)
                    plan.append((os.path.relpath(p, HERE).replace(os.sep, "/"), ""))

        for rel, url in plan:
            path = os.path.join(HERE, rel.replace("/", os.sep))
            if not os.path.exists(path):
                if args.verify_only:
                    print(f"  MISSING {rel}")
                    missing += 1
                    continue
                print(f"  GET  {rel}")
                _download(url, path)
            size = os.path.getsize(path)
            digest = _sha256(path)
            total += size
            rows.append({
                "asset": asset["slug"],
                "role": asset["role"],
                "file": rel,
                "bytes": size,
                "sha256": digest,
                "source_url": url,
                "asset_page": page,
                # CONTRACT A9-8 / C-360-91: the environment-asset row class gains `exterior_class`.
                # Required for kind == "hdri", absent (rendered "-") for every other class.
                "exterior_class": asset.get("exterior_class", ""),
                "exterior_class_reason": asset.get("exterior_class_reason", ""),
            })
            print(f"  ok   {rel}  {size:>10,} B  sha256:{digest[:16]}...")

    # ---- PROVENANCE.md -------------------------------------------------------------------
    if not args.verify_only:
        lines = [
            "# Probe assets — CC0 provenance (board `360-v2` T03)",
            "",
            f"**Source:** {lock['source']} · **Licence:** {lock['licence']} "
            f"([licence page]({lock['licence_url']})) · **Verified (access date):** {today} · **Cost: $0.00**",
            "",
            "Poly Haven publishes its ENTIRE library — HDRIs, textures and models — under **CC0 1.0**",
            "(public-domain dedication): no attribution required, commercial use allowed, no share-alike.",
            "The licence is a site-wide policy, not a per-asset field, so the API carries no `license` key;",
            "the licence page above is the authority and the `verified` date is when it was read.",
            "",
            "⛔ **The binaries in this folder are gitignored.** `assets.lock.json` (the pin),",
            "`fetch-assets.py` (the fetcher) and this file (the provenance) are the committed truth —",
            "rail 4 / V2-PLAN §5.7. Re-create the folder with:",
            "",
            "```",
            "PYTHONIOENCODING=utf-8 python 360walkaround/pipeline/probe/probe-assets/fetch-assets.py",
            "```",
            "",
            f"**{len(rows)} files · {total:,} bytes total.**",
            "",
            "| Asset | Role | File | Bytes | sha256 | Source URL |",
            "|---|---|---|---:|---|---|",
        ]
        for r in rows:
            lines.append(
                f"| [`{r['asset']}`]({r['asset_page']}) | {r['role']} | `{r['file']}` | "
                f"{r['bytes']:,} | `{r['sha256']}` | {r['source_url']} |"
            )
        env_rows = [a for a in lock["assets"] if a["kind"] == "hdri"]
        if env_rows:
            lines += [
                "",
                "## `exterior_class` — the environment assets (CONTRACT A9-8 / **C-360-91**)",
                "",
                "⛔ Only **`non-locating`** is legal for a tour render. The value is a **recorded human",
                "judgment with a reason**, not a measurement — said plainly, exactly as the licence quote",
                "is not a measurement (C-360-75).  `build_scene.py` reads this class through the style",
                "lock and **refuses to build** on `locating`, on a hash mismatch, or on a missing file.",
                "",
                "| Asset | `exterior_class` | Reason (recorded judgment) |",
                "|---|---|---|",
            ]
            for a in env_rows:
                cls = a.get("exterior_class") or "⛔ UNSET"
                lines.append(f"| `{a['slug']}` | **`{cls}`** | {a.get('exterior_class_reason', '—')} |")
        lines += [
            "",
            "## Authors (courtesy credit — CC0 requires none)",
            "",
            "| Asset | Author(s) |",
            "|---|---|",
        ]
        for asset in lock["assets"]:
            try:
                info = _get_json(f"{API}/info/{asset['slug']}")
                authors = ", ".join(f"{k} ({v})" for k, v in sorted(info.get("authors", {}).items()))
            except Exception:  # network hiccup must not lose the hash table
                authors = "(not retrieved)"
            lines.append(f"| `{asset['slug']}` | {authors} |")
        lines += [
            "",
            "---",
            f"Generated by `fetch-assets.py` on {today}. ⛔ Do not hand-edit: re-run the script.",
            "",
        ]
        with open(PROVENANCE, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(lines))
        print(f"\nwrote {PROVENANCE}  ({len(rows)} rows, {total:,} bytes)")

    if missing:
        print(f"\nFAIL: {missing} pinned file(s) missing")
        return 1
    print("\nOK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
