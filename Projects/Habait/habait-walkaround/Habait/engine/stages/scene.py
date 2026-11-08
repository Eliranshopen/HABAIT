"""Stages scene and clay: the deterministic Blender pipeline of 360walkaround, as external processes.

scene  <project>/plan/<unit>/plan.json -> <project>/scene/<unit>/{plan.json, scene-full.blend}
       Blender build_scene.py with the Studio's zero-line look (--door-style zero-line --skirting off
       --material-board none; memory.md section 7).
clay   node 360walkaround/pipeline/render_tour.mjs <project>/scene/<unit> --mode draft --blender "$BLENDER"
       (render_tour keys its own rerun-skip on input hashes and finds the scene CLEAN when this stage built it).

Blender is owned by one session at a time (SESSIONS.md; today habait-98). Without HABAIT_BLENDER_OK=1 the scene
stage only stages plan.json and prints the Blender command (status "deferred"), and the clay stage runs
render_tour.mjs with --dry-run (status "dry-run-only"). Neither writes a stamp then, so a later real run is not skipped.
Gate of clay: render_tour.mjs's own proof (every depth map decoded, nadir vs camera height); exit 0 is required.
"""
from __future__ import annotations

import os
import shutil

from .common import NODE, REPO, Result, Step, blender, rel, run_external

PIPE = REPO / "360walkaround" / "pipeline"
SCENE_SCRIPTS = ["build_scene.py", "materials_kit.py", "place_cameras.py", "placement_templates.py",
                 "plan_general.py", "general_furnish.py"]
LOOK = ["--door-style", "zero-line", "--skirting", "off", "--material-board", "none"]


def blender_ok() -> bool:
    return os.environ.get("HABAIT_BLENDER_OK") == "1"


def _defer_preview(ctx, st):
    if blender_ok():
        return None
    return ("defer", "Blender is owned by another session (SESSIONS.md: habait-98); set HABAIT_BLENDER_OK=1 "
                     "only in the session that owns it")


def scene_steps(ctx):
    out = []
    for u in ctx.units():
        uid = u["id"]
        wd = ctx.p("scene", uid)
        st = Step("scene", uid, wd)
        plan = ctx.p("plan", uid, "plan.json")
        blend = wd / "scene-full.blend"
        st.cmds = [["copy", plan, wd / "plan.json"],
                   [blender(), "-b", "--factory-startup", "-P", PIPE / "build_scene.py", "--",
                    rel(wd / "plan.json"), "--out", rel(blend), *LOOK]]
        st.inputs = {"plan": plan, **{s: PIPE / s for s in SCENE_SCRIPTS}, "look": LOOK}
        st.outputs = [blend, wd / "scene-full.report.json"]
        st.gate = "build_scene.py's own checks (scene-full.report.json checks_failed == 0)"
        st.preview = _defer_preview
        st.execute = _scene_exec
        out.append(st)
    return out


def _scene_exec(ctx, st):
    cp, bl = st.cmds
    if not cp[1].exists():
        return Result("failed", 1, note="no plan/<unit>/plan.json: run the plan stage first")
    st.workdir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(cp[1], cp[2])
    if not blender_ok():
        print(f"        Blender not run here (HABAIT_BLENDER_OK != 1); staged {rel(cp[2])}")
        return Result("deferred", 0, stamp=False, note="plan staged; Blender build deferred to the Blender owner")
    code, secs, tail = run_external(bl, st.workdir / "logs" / "build_scene.log", echo=not ctx.args.quiet,
                                    timeout=getattr(ctx.args, "timeout", None))
    import json
    rep = st.workdir / "scene-full.report.json"
    failed = json.loads(rep.read_text(encoding="utf-8")).get("checks_failed", 0) if rep.exists() else None
    ok = code == 0 and st.outputs[0].exists() and failed == 0
    return Result("ok" if ok else "failed", 0 if ok else 1, seconds=secs,
                  gate={"name": "build_scene checks", "pass": ok, "score": None, "blocking": True},
                  note=f"build_scene exit {code}, checks_failed {failed}")


def clay_steps(ctx):
    out = []
    for u in ctx.units():
        uid = u["id"]
        tour = ctx.p("scene", uid)
        st = Step("clay", uid, ctx.p("clay", uid))
        cmd = [NODE, PIPE / "render_tour.mjs", rel(tour), "--mode", "draft", "--blender", blender()]
        if getattr(ctx.args, "clay_res", None):
            cmd += ["--res", ctx.args.clay_res]
        if getattr(ctx.args, "clay_samples", None):
            cmd += ["--samples", str(ctx.args.clay_samples)]
        if getattr(ctx.args, "points", None):
            cmd += ["--points", ctx.args.points]
        st.cmds = [cmd if blender_ok() else cmd + ["--dry-run"]]
        st.inputs = {"plan": ctx.p("plan", uid, "plan.json"), "blend": tour / "scene-full.blend",
                     "render_tour": PIPE / "render_tour.mjs", "render_pano": PIPE / "render_pano.py",
                     "args": [str(c) for c in cmd[3:]]}
        st.outputs = [tour / "manifest.json", tour / "renders" / "_render-tour.report.json"]
        st.gate = "render_tour.mjs proof: every pano + depth decoded, nadir depth vs camera height (exit 0)"
        st.preview = lambda ctx, s: None if blender_ok() else (
            "dry-run-only", "render_tour.mjs --dry-run only (Blender owned by habait-98; HABAIT_BLENDER_OK != 1)")
        st.execute = _clay_exec
        out.append(st)
    return out


def _clay_exec(ctx, st):
    if not (st.cmds[0][2] and (REPO / st.cmds[0][2] / "plan.json").exists()):
        return Result("failed", 1, note="no scene/<unit>/plan.json: run the scene stage first")
    code, secs, tail = run_external(st.cmds[0], st.workdir / "logs" / "render_tour.log", echo=not ctx.args.quiet,
                                    timeout=getattr(ctx.args, "timeout", None))
    if not blender_ok():
        return Result("dry-run-only" if code == 0 else "failed", 0 if code == 0 else 1, stamp=False, seconds=secs,
                      note=f"render_tour.mjs --dry-run exit {code} (nothing rendered)")
    ok = code == 0
    return Result("ok" if ok else "failed", 0 if ok else 1, seconds=secs,
                  gate={"name": "render_tour proof", "pass": ok, "score": None, "blocking": True},
                  note=f"render_tour exit {code}")
