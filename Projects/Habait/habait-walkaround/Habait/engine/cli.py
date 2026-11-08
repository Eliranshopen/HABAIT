#!/usr/bin/env python
"""habait-engine (card 04, lane A / A5): one command over the engine's stages.

  python Habait/engine/cli.py init   <project-dir> --from <project.json> [--force]
  python Habait/engine/cli.py run    <project-dir> --stage all|intake|plan|building|scene|clay|skin|video|export[,..]
                                     [--dry-run] [--force] [--unit <id>[,<id>]] [--plan <plan.json>]
                                     [--vlm claude|none|file:<reply>] [--assign ...] [--platform-project <dir>]
                                     [--clay-res WxH --clay-samples N --points a,b] [--keep-going] [--quiet]
                                     [--allow-stale-export]
  python Habait/engine/cli.py status <project-dir>

Project dir: project.json, intake/, plan/, building/, scene/, clay/, skin/, video/, dist/, ledger.json, qa.html.
Every step: skipped when its input hash matches its stamp (<stage>/<unit>/.stage.json) and its outputs exist; a ledger
entry is written before and after every external call (cost 0 for $0 stages); its gate runs after it; qa.html is
rebuilt by gates/qa_report.py (card 05) at the end of every real run. The tools are external processes (intake_raster,
plan_gate, validate-plan.mjs, building.py, build_scene/render_tour, build_zip.mjs); nothing of the Studio is imported.

Money: skin and video are REFUSED (exit 3) unless HABAIT_ALLOW_SPEND=1 AND HABAIT_CAP_USD=<usd> are set in the
environment. Blender: scene/clay only print / --dry-run unless HABAIT_BLENDER_OK=1 (the session owning Blender).
Order: export is BLOCKED (exit 2, nothing built) unless the unit's plan stamp and the building stamp exist and match
their current inputs; --allow-stale-export overrides it (printed).

Exit: 0 ok (dry-run: always 0 unless usage) | 1 a step or a blocking gate failed | 2 usage, or export BLOCKED (plan /
building not current) | 3 a paid stage refused | 4 a paid stage allowed but not wired in v0.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from stages import REGISTRY  # noqa: E402
from stages import video as video_stage  # noqa: E402

REGISTRY["video"] = video_stage.steps       # card 35: Kling v2v per segment / adopt existing clips (stages/video.py)
from stages.common import (ALIASES, ENGINE, EXIT_FAIL, EXIT_NOT_WIRED, EXIT_OK, EXIT_REFUSED, EXIT_USAGE, PAID,  # noqa: E402
                           PY, STAGES, STAMP, Ctx, decide, jdump, jload, rel, show, write_stamp)

SUBDIRS = ["intake", "plan", "building", "scene", "clay", "skin", "video", "dist"]
SEVERITY = {"failed": EXIT_FAIL, "blocked": EXIT_USAGE, "refused": EXIT_REFUSED, "not-wired": EXIT_NOT_WIRED}


# ------------------------------------------------------------------------------------------------------------ init
def rebase(obj, src: Path, dst: Path):
    """Relative paths in project.json are relative to its own folder: re-express them for the copy's folder."""
    if isinstance(obj, dict):
        return {k: rebase(v, src, dst) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rebase(v, src, dst) for v in obj]
    if isinstance(obj, str) and obj.startswith(("../", "./", "..\\", ".\\")):
        target = (src / obj).resolve()
        try:
            return os.path.relpath(target, dst).replace("\\", "/")
        except ValueError:  # another drive
            return target.as_posix()
    return obj


def cmd_init(a):
    root = Path(a.project_dir).resolve()
    src = Path(a.source).resolve()
    if (root / "project.json").exists() and not a.force:
        print(f"init: {rel(root / 'project.json')} exists (use --force to overwrite)", file=sys.stderr)
        return EXIT_USAGE
    proj = rebase(jload(src), src.parent, root)
    root.mkdir(parents=True, exist_ok=True)
    jdump(proj, root / "project.json")
    for d in SUBDIRS:
        (root / d).mkdir(exist_ok=True)
    jdump({"from": str(src), "note": "project.json copied by cli.py init; relative paths rebased to this folder"},
          root / "project.source.json")
    print(f"init: {rel(root)}  project {proj.get('id')}  from {rel(src)}  ({len(proj.get('units') or [])} unit(s))")
    return EXIT_OK


# ------------------------------------------------------------------------------------------------------------- run
def parse_stages(s):
    if s == "all":
        return list(STAGES)
    out = []
    for x in s.split(","):
        x = ALIASES.get(x.strip(), x.strip())
        if x not in STAGES:
            raise SystemExit(f"unknown stage {x!r}; one of: all, {', '.join(STAGES)} (alias intake-raster)")
        out.append(x)
    return [x for x in STAGES if x in out]


def preflight(ctx):
    r = subprocess.run([PY, "-B", ENGINE / "validate_project.py", ctx.project_path, "--check-files"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    lines = [x for x in (r.stdout + r.stderr).splitlines() if x.strip()]
    return r.returncode, lines


def cmd_run(a):
    root = Path(a.project_dir).resolve()
    if not (root / "project.json").exists():
        print(f"run: no project.json in {root} (create one with: cli.py init {a.project_dir} --from <project.json>)",
              file=sys.stderr)
        return EXIT_USAGE
    stages = parse_stages(a.stage)
    ctx = Ctx(root, a)
    print(f"habait-engine run  project={ctx.pid}  dir={rel(root)}  stages={','.join(stages)}"
          + ("  DRY-RUN (nothing executed, nothing written)" if ctx.dry else ""))
    pcode, plines = preflight(ctx)
    print(f"preflight  validate_project.py --check-files: {'OK' if pcode == 0 else 'FAIL (exit %d)' % pcode}")
    for x in plines[:12] if pcode else [x for x in plines if "WARN" in x.upper()][:6]:
        print(f"        | {x}")
    if pcode and not ctx.dry:
        return EXIT_FAIL

    worst, counts, stop = EXIT_OK, {}, False
    for i, stage in enumerate(stages, 1):
        for st in REGISTRY[stage](ctx):
            head = f"[{i}/{len(stages)}] {st.label:<20}"
            if st.na:
                print(f"{head} N/A    {st.na}")
                counts["n/a"] = counts.get("n/a", 0) + 1
                if not ctx.dry:
                    e = ctx.ledger.begin(st, cmds=[])
                    ctx.ledger.end(e, "n/a", 0, 0.0, None, st.na)
                continue
            mode, why = decide(st, ctx.force)
            if st.stage in PAID or (mode == "run" and st.preview):
                pv = st.preview(ctx, st) if st.preview else None
                if pv:
                    mode, why = pv
            needs = []
            if st.requires and mode in ("run", "skip"):          # export: plan + building must be current
                probs = st.requires(ctx, st)
                dep = "/".join(st.requires_stages)
                if probs and getattr(a, "allow_stale_export", False):
                    needs = [f"--allow-stale-export: going on without {x}" for x in probs]
                elif probs and ctx.dry and set(st.requires_stages) <= set(stages):
                    needs = [f"now {x}" for x in probs] + [f"this run's {dep} stage(s) run first; {st.stage} goes on "
                                                           "only if they pass"]
                elif probs:
                    mode, why, needs = "blocked", st.blocked_line or f"BLOCKED: {st.stage} needs current {dep}", probs
                elif ctx.dry:
                    needs = [f"{dep}: current (stamps match their inputs)"]
            word = {"run": "RUN", "skip": "SKIP", "refuse": "REFUSE", "defer": "DEFER", "dry-run-only": "DRYRUN",
                    "not-wired": "NOWIRE", "blocked": "BLOCK"}.get(mode, mode.upper())
            counts[mode] = counts.get(mode, 0) + 1
            print(f"{head} {word:<6} {why}")
            for n in needs:
                print(f"        need  {n}")
            if mode == "blocked":
                print(f"        hint  run --stage {','.join(st.requires_stages)},{st.stage} first (or pass "
                      f"--allow-stale-export to {st.stage} anyway); nothing was built")
                if not ctx.dry:
                    e = ctx.ledger.begin(st, cmds=[])
                    ctx.ledger.end(e, "blocked", EXIT_USAGE, 0.0, None, why + ": " + "; ".join(needs))
                    print(f"        -> blocked  exit {EXIT_USAGE}  $0.00  | {'; '.join(needs)}")
                    if worst != EXIT_FAIL and EXIT_USAGE > worst:
                        worst = EXIT_USAGE
                continue
            if ctx.dry or mode == "skip":
                if ctx.dry:
                    for c in st.cmds:
                        print(f"        cmd   {show(rel(x) if isinstance(x, Path) else x for x in c)}")
                    print(f"        gate  {st.gate}")
                    for n in st.notes:
                        print(f"        note  {n}")
                    print(f"        cost  ${st.est_usd:.2f} estimate" + (" (PAID stage)" if st.stage in PAID else " ($0 stage)"))
                else:
                    e = ctx.ledger.begin(st, cmds=[])
                    ctx.ledger.end(e, "skipped", 0, 0.0, None, why)
                continue
            if stop:
                print("        not run: an earlier step failed (use --keep-going)")
                continue
            e = ctx.ledger.begin(st)
            try:
                res = st.execute(ctx, st)
            except Exception as ex:  # noqa: BLE001 - the ledger row must be closed
                ctx.ledger.end(e, "failed", EXIT_FAIL, 0.0, None, f"{type(ex).__name__}: {ex}")
                raise
            ctx.ledger.end(e, res.status, res.exit, res.cost_usd, res.gate, res.note, res.seconds)
            if res.status == "ok" and res.stamp:
                write_stamp(st, "ok")
            g = res.gate
            gtxt = (f"  gate {'PASS' if g.get('pass') else 'FAIL'}{'' if g.get('blocking', True) else ' (advisory)'}"
                    if g else "")
            print(f"        -> {res.status}  exit {res.exit}{gtxt}  ${res.cost_usd:.2f}"
                  + (f"  {res.seconds} s" if res.seconds is not None else "") + (f"  | {res.note}" if res.note else ""))
            sev = SEVERITY.get(res.status, EXIT_OK)
            if sev == EXIT_FAIL or (worst != EXIT_FAIL and sev > worst):
                worst = sev
            if res.status == "failed" and not a.keep_going:
                stop = True

    print("summary   " + " · ".join(f"{k} {v}" for k, v in counts.items())
          + f" · ledger {rel(ctx.ledger.path)} ${ctx.ledger.spent_usd():.2f}" + ("" if ctx.dry else ""))
    if not ctx.dry:
        r = subprocess.run([PY, "-B", ENGINE / "gates" / "qa_report.py", root, "--out", root / "qa.html",
                            "--title", f"דוח QA של המנוע: {ctx.pid}"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace",
                           env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        print("qa        " + ((r.stdout + r.stderr).strip().splitlines() or [f"qa_report exit {r.returncode}"])[-1])
    return EXIT_OK if ctx.dry else worst


# ---------------------------------------------------------------------------------------------------------- status
def cmd_status(a):
    root = Path(a.project_dir).resolve()
    led = root / "ledger.json"
    if not led.exists():
        print(f"status: no ledger in {rel(root)}")
        return EXIT_OK
    d = jload(led)
    print(f"ledger {rel(led)}  project {d.get('project')}  spent ${d.get('spent_usd', 0):.2f}  entries {len(d['entries'])}")
    for e in d["entries"][-int(a.last):]:
        g = e.get("gate") or {}
        print(f"  #{e['n']:<3} {e['started_at'][11:19]} {e['stage']:<9} {str(e.get('unit') or '-'):<8} {e['status']:<12} "
              f"exit {str(e.get('exit')):<4} ${float(e.get('cost_usd') or 0):.2f}"
              + (f"  gate {'PASS' if g.get('pass') else 'FAIL'}" if g else ""))
    for s in sorted(root.rglob(STAMP)):
        x = jload(s)
        print(f"  stamp {rel(s.parent):<60} {x.get('status')} {x.get('finished_at')}")
    return EXIT_OK


def main(argv=None):
    ap = argparse.ArgumentParser(prog="habait-engine", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("init")
    i.add_argument("project_dir")
    i.add_argument("--from", dest="source", required=True)
    i.add_argument("--force", action="store_true")
    r = sub.add_parser("run")
    r.add_argument("project_dir")
    r.add_argument("--stage", default="all")
    r.add_argument("--dry-run", action="store_true")
    r.add_argument("--force", action="store_true")
    r.add_argument("--unit")
    r.add_argument("--plan")
    r.add_argument("--vlm")
    r.add_argument("--assign")
    r.add_argument("--platform-project")
    r.add_argument("--plain-mass", action="store_true")
    r.add_argument("--selftest-building", action="store_true")
    r.add_argument("--clay-res")
    r.add_argument("--clay-samples", type=int)
    r.add_argument("--points")
    r.add_argument("--timeout", type=float, help="per external tool, seconds")
    r.add_argument("--keep-going", action="store_true")
    r.add_argument("--allow-stale-export", action="store_true",
                   help="export even when the plan / building stamps are missing or stale (printed; default: exit 2)")
    r.add_argument("--quiet", action="store_true", help="do not echo the tools' output (it stays in <stage>/logs)")
    s = sub.add_parser("status")
    s.add_argument("project_dir")
    s.add_argument("--last", default=30)
    a = ap.parse_args(argv)
    return {"init": cmd_init, "run": cmd_run, "status": cmd_status}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
