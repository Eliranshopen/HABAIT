"""Stage export: the apartment page + downloadable ZIP per unit, through card 23's
Habait/platform/tools/build_zip.mjs (external process), written to <project>/dist/<unit>/.

build_zip.mjs takes a PLATFORM project folder (project.json + units.json + logo). The engine project is mapped to it by:
--platform-project <dir> | env HABAIT_PLATFORM_PROJECT | a Habait/platform/fixtures/<id>/project.json whose id equals
the engine project id | (heuristic, printed) the engine id starts with "<platform id>-" (rainbow-tlv -> rainbow; the two
fixtures' ids still differ, card 03 open defect 3). The platform unit id is units[].number.

Gate (BLOCKING, structural): <unit>.zip exists and is <= --max-mb (25), index.html and apartment.json exist. Not a
fidelity gate.

Depends on plan and building (fresh-run defect 2, 2026-11-02): export runs (or skips) only when the unit's plan stamp
and the building stamp exist AND still match their stage's current inputs (cli.py's skip rule). Otherwise it prints a
BLOCKED line and the run exits 2, with nothing built: a dist from a plan that failed or a building that never ran
proves nothing. `--allow-stale-export` packs anyway (printed). In a dry-run the check is informational when this run's
stage list also holds plan and building (they run first and export goes on only if they pass).
"""
from __future__ import annotations

import os
from pathlib import Path

from .common import NODE, REPO, Result, Step, decide, gate_json, invalidate_stamp, jload, rel, run_external

PLATFORM = REPO / "Habait" / "platform"
TOOL = PLATFORM / "tools" / "build_zip.mjs"
MAX_MB = 25
REQUIRES = ("plan", "building")
BLOCKED_LINE = ("BLOCKED: export needs a passing, current plan and building stamp "
                "/ חסום: הייצוא דורש חותמת plan ו-building שעברו ועדכניות")


def requires(ctx, st):
    """[] when the unit's plan step and the building step would SKIP now (stamp present, same inputs, outputs on
    disk), else one line per stage that is missing or stale."""
    from . import building as building_stage, plan as plan_stage
    try:
        deps = [s for s in plan_stage.steps(ctx) if s.unit == st.unit]
    except SystemExit as e:                       # e.g. --plan with several units
        return [f"plan [{st.unit}]: {e}"]
    if not deps:
        return [f"plan [{st.unit}]: no plan step for this unit"]
    deps += building_stage.steps(ctx)
    probs = []
    for d in deps:
        if d.na:
            probs.append(f"{d.label}: not applicable ({d.na})")
            continue
        mode, why = decide(d, False)
        if mode != "skip":
            probs.append(f"{d.label}: " + ("no stamp (never passed here, or its last run failed)"
                                           if why.startswith("no stamp") else why))
    return probs


def platform_project(ctx):
    explicit = getattr(ctx.args, "platform_project", None) or os.environ.get("HABAIT_PLATFORM_PROJECT")
    if explicit:
        return Path(explicit).resolve(), "explicit"
    cands = []
    for pj in sorted((PLATFORM / "fixtures").glob("*/project.json")):
        try:
            cands.append((pj.parent, jload(pj).get("id")))
        except (OSError, ValueError):
            continue
    for d, i in cands:
        if i == ctx.pid:
            return d, "id match"
    for d, i in cands:
        if i and ctx.pid.startswith(i + "-"):
            return d, f"HEURISTIC id prefix ({ctx.pid} -> {i})"
    return None, "no platform project for this engine project (give --platform-project)"


def steps(ctx):
    out = []
    pdir, how = platform_project(ctx)
    for u in ctx.units():
        uid = u["id"]
        num = str(u.get("number") or uid)
        wd = ctx.p("dist", uid)
        st = Step("export", uid, wd)
        if not TOOL.exists():
            st.na = "build_zip.mjs not found (card 23)"
            out.append(st)
            continue
        if not pdir:
            st.na = how
            out.append(st)
            continue
        try:
            pu = jload(pdir / "units.json").get("units", [])
        except (OSError, ValueError):
            pu = []
        if not any(str(x.get("id")) == num for x in pu):
            st.na = f"unit {num} not in {rel(pdir / 'units.json')}"
            out.append(st)
            continue
        tour_dir = REPO / "Habait" / "tour360" / "apartments" / f"apt{num}"
        st.cmds = [[NODE, TOOL, pdir, num, "--out", wd, "--max-mb", str(MAX_MB)]]
        st.inputs = {"build_zip": TOOL, "platform_project": pdir / "project.json", "platform_units": pdir / "units.json",
                     "tour_apartment": tour_dir / "apartment.json", "tour_scenes": tour_dir / "scenes.json",
                     "tour_panos": tour_dir / "panos" / "balanced",
                     "glb": REPO / "Habait" / "engine" / "_local" / f"apt{num}" / "dollhouse" / f"apt{num}.glb",
                     "plan": ctx.p("plan", uid, "plan.json")}
        st.outputs = [wd / f"{num}.zip", wd / "index.html", wd / "apartment.json"]
        st.gate = f"structural: {num}.zip <= {MAX_MB} MB + index.html + apartment.json"
        st.notes = [f"platform project {rel(pdir)} ({how})"]
        st.requires, st.requires_stages, st.blocked_line = requires, REQUIRES, BLOCKED_LINE
        st.execute = _execute
        out.append(st)
    return out


def _execute(ctx, st):
    env = {"HABAIT_APP_DIR": os.environ.get("HABAIT_APP_DIR", "C:/RnD/Projects/Habait/tools/appdeps")}
    invalidate_stamp(st)            # build_zip rewrites dist/<unit>/ now
    code, secs, tail = run_external(st.cmds[0], st.workdir / "logs" / "build_zip.log", cwd=PLATFORM, env_extra=env,
                                    echo=not ctx.args.quiet, timeout=getattr(ctx.args, "timeout", None))
    z = st.outputs[0]
    mb = z.stat().st_size / 1048576 if z.exists() else None
    ok = code == 0 and all(o.exists() for o in st.outputs) and mb is not None and mb <= MAX_MB
    gate_json(st.workdir.parent / "qa" / f"export_pack.{st.unit}.json", "export_pack", ok,
              round(mb, 2) if mb is not None else None, z, build_zip_exit=code, max_mb=MAX_MB)
    return Result("ok" if ok else "failed", 0 if ok else 1, seconds=secs,
                  gate={"name": "export_pack", "pass": ok, "score": mb and round(mb, 2), "blocking": True},
                  note=f"build_zip exit {code}" + (f", zip {mb:.2f} MB" if mb is not None else ""))
