#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check-determinism.py — build the probe scene TWICE and prove the two scenes are identical.

Board `360-v2` T03, acceptance criterion 3, and rail 1 ("deterministic or it doesn't ship").

The assert is made on **decoded scene data**, never on the .blend's bytes — T01 measured that a
Blender-written container carries run-to-run metadata even when its payload is bit-identical
(ENV.md §4.3). So: build A, build B, dump both with `dump_scene.py`, and require the two dumps to
be byte-identical. The dump includes every object's `matrix_world` (the criterion's "transforms")
plus a sha256 of every mesh's raw float32 vertex buffer, so a boolean solver that wobbled by one
ulp would be caught, not just a moved object.

    PYTHONIOENCODING=utf-8 python 360walkaround/pipeline/probe/check-determinism.py

Exit 0 = identical. Exit 1 = a difference (the first differing paths are printed).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PIPELINE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPELINE))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
BUILD = os.path.join(PIPELINE, "build_scene.py")
DUMP = os.path.join(HERE, "dump_scene.py")
PLAN = os.path.join(REPO, "360walkaround", "tours", "pilot-karnei", "plan.json")
EVIDENCE = os.path.join(HERE, "determinism")


def run(cmd, label):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    t = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", env=env)
    dt = time.time() - t
    if p.returncode != 0:
        print(p.stdout[-4000:])
        print(p.stderr[-4000:])
        raise SystemExit(f"{label} failed with exit {p.returncode}")
    print(f"  {label}: exit 0 in {dt:.2f} s")
    return p.stdout


def walk_diff(a, b, path="$", out=None, limit=25):
    out = [] if out is None else out
    if len(out) >= limit:
        return out
    if type(a) is not type(b):
        out.append(f"{path}: type {type(a).__name__} vs {type(b).__name__}")
    elif isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                out.append(f"{path}.{k}: missing in A")
            elif k not in b:
                out.append(f"{path}.{k}: missing in B")
            else:
                walk_diff(a[k], b[k], f"{path}.{k}", out, limit)
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append(f"{path}: length {len(a)} vs {len(b)}")
        else:
            for i, (x, y) in enumerate(zip(a, b)):
                walk_diff(x, y, f"{path}[{i}]", out, limit)
    elif a != b:
        out.append(f"{path}: {a!r} vs {b!r}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--room", default="r-living")
    ap.add_argument("--blender", default=BLENDER)
    ap.add_argument("--keep", action="store_true", help="keep the two throwaway .blend files")
    args = ap.parse_args()

    if not os.path.exists(args.blender):
        raise SystemExit(f"blender not found at {args.blender} (ENV.md §2: it is NOT on PATH)")
    os.makedirs(EVIDENCE, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="360v2-determinism-")
    print(f"scratch   {tmp}")
    print(f"room      {args.room}")

    results = {}
    for tag in ("A", "B"):
        blend = os.path.join(tmp, f"scene-{tag}.blend")
        dump = os.path.join(tmp, f"dump-{tag}.json")
        print(f"\nbuild {tag}")
        run([args.blender, "-b", "--factory-startup", "-P", BUILD, "--",
             PLAN, "--room", args.room, "--out", blend,
             "--report", os.path.join(tmp, f"report-{tag}.json")], f"build {tag}")
        # exit 0 is necessary but not sufficient: Blender exits 0 on an uncaught script exception
        # (measured, ENV.md §8). The builder now converts that to exit 1 — this is the belt.
        if not os.path.exists(blend):
            raise SystemExit(f"build {tag} reported success but wrote no {blend}")
        run([args.blender, "-b", blend, "-P", DUMP, "--", "--out", dump], f"dump {tag}")
        with open(dump, "rb") as f:
            raw = f.read()
        results[tag] = {
            "blend": blend,
            "blend_bytes": os.path.getsize(blend),
            "blend_sha256": hashlib.sha256(open(blend, "rb").read()).hexdigest(),
            "dump": dump,
            "dump_sha256": hashlib.sha256(raw).hexdigest(),
            "dump_bytes": len(raw),
        }

    a, b = results["A"], results["B"]
    same_data = a["dump_sha256"] == b["dump_sha256"]
    same_bytes = a["blend_sha256"] == b["blend_sha256"]

    print("\n" + "=" * 92)
    print("DETERMINISM — the assert is on DECODED SCENE DATA (ENV.md §4.3), not on file bytes")
    print("=" * 92)
    print(f"  A  dump sha256 {a['dump_sha256']}  ({a['dump_bytes']:,} B)")
    print(f"  B  dump sha256 {b['dump_sha256']}  ({b['dump_bytes']:,} B)")
    print(f"  -> scene data identical: {'YES' if same_data else 'NO'}")
    print(f"  A  .blend sha256 {a['blend_sha256']}  ({a['blend_bytes']:,} B)")
    print(f"  B  .blend sha256 {b['blend_sha256']}  ({b['blend_bytes']:,} B)")
    print(f"  -> container bytes identical: {'YES' if same_bytes else 'NO'}"
          f"   (informational only — never an acceptance criterion)")

    diffs = []
    if not same_data:
        da = json.load(open(a["dump"], encoding="utf-8"))
        db = json.load(open(b["dump"], encoding="utf-8"))
        diffs = walk_diff(da, db)
        print("\n  FIRST DIFFERENCES:")
        for d in diffs:
            print(f"    {d}")

    # a transform-only view of the same assert, because that is the literal wording of the criterion
    da = json.load(open(a["dump"], encoding="utf-8"))
    db = json.load(open(b["dump"], encoding="utf-8"))
    ta = {o["name"]: o["matrix_world"] for o in da["objects"]}
    tb = {o["name"]: o["matrix_world"] for o in db["objects"]}
    transforms_same = ta == tb
    ma = {o["name"]: o.get("mesh", {}).get("co_sha256") for o in da["objects"]}
    mb = {o["name"]: o.get("mesh", {}).get("co_sha256") for o in db["objects"]}
    meshes_same = ma == mb
    print(f"\n  object transforms identical: {'YES' if transforms_same else 'NO'} "
          f"({len(ta)} objects)")
    print(f"  mesh vertex buffers identical: {'YES' if meshes_same else 'NO'} "
          f"({sum(1 for v in ma.values() if v)} meshes, incl. every boolean-cut wall)")

    verdict = {
        "task": "board 360-v2 T03, acceptance criterion 3",
        "room": args.room,
        "blender": da["blender"],
        "objects": len(ta),
        "meshes_hashed": sum(1 for v in ma.values() if v),
        "scene_data_identical": same_data,
        "object_transforms_identical": transforms_same,
        "mesh_vertex_buffers_identical": meshes_same,
        "container_bytes_identical": same_bytes,
        "container_note": "informational. ENV.md §4.3 measured that a Blender container is not "
                          "byte-stable even with identical payload; rail 2's manifest keys on "
                          "INPUT hashes and any recorded output hash must be of decoded data.",
        "A": {k: v for k, v in a.items() if k != "blend"},
        "B": {k: v for k, v in b.items() if k != "blend"},
        "differences": diffs,
    }
    # evidence: ONE canonical dump when the two agree (a second byte-identical copy proves nothing
    # and costs 95 KB); BOTH when they differ, because then you need to diff them.
    keep = ["A"] if same_data else ["A", "B"]
    for tag in keep:
        shutil.copyfile(results[tag]["dump"], os.path.join(EVIDENCE, f"scene-dump-{tag}.json"))
    verdict["evidence_files"] = [f"scene-dump-{t}.json" for t in keep] + ["verdict.json"]
    verdict["evidence_note"] = ("the two dumps were byte-identical, so only A is kept; "
                                "verdict.json carries both sha256s" if same_data else
                                "the dumps DIFFER — both are kept for diffing")
    vp = os.path.join(EVIDENCE, "verdict.json")
    with open(vp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(verdict, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\n  evidence: {EVIDENCE}")

    if not args.keep:
        for r in results.values():
            try:
                os.remove(r["blend"])
            except OSError:
                pass

    ok = same_data and transforms_same and meshes_same
    print("\n  RESULT: " + ("PASS — the same plan.json + the same assets build the same scene."
                            if ok else "FAIL — the build is NOT deterministic."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
