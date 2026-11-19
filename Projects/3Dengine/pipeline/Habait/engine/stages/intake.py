"""Stage intake (alias intake-raster): the sales-plan PDF -> a DRAFT plan.json, through card 01's
Habait/engine/intake/intake_raster.py as an external process (never imported, never edited here).

The draft is gated by plan_gate.py (card 05) with the intake's own report.json (machine-read dimension lines), but the
gate is ADVISORY here: a FAIL is recorded (qa.html shows it red) and the run continues, because the A2 correction
screen (Habait/engine/correct/) is the human step between this draft and the plan stage.

VLM backend, in order: --vlm / --assign on the command line; a seeded reply in <project>/intake/<unit>.vlm-reply.txt /
<unit>.assign-reply.txt (a previous Opus reading, $0 and deterministic); else "claude" (the subscription CLI, $0 money,
~2 min of Opus per call).
"""
from __future__ import annotations

import os
import re

from .common import ENGINE, PY, Result, Step, jdump, jload, rel, run_external

TOOL = ENGINE / "intake" / "intake_raster.py"
PLAN_GATE = ENGINE / "gates" / "plan_gate.py"


def _backend(ctx, unit_id, kind):
    cli = getattr(ctx.args, kind, None)
    if cli:
        return cli
    seed = ctx.p("intake", f"{unit_id}.{kind}-reply.txt")
    return f"file:{seed}" if seed.exists() else "claude"


def steps(ctx):
    out = []
    for u in ctx.units():
        uid = u["id"]
        wd = ctx.p("intake", uid)
        files = u.get("files") or {}
        pdf = ctx.file(files.get("plan_pdf"))
        st = Step("intake", uid, wd)
        if not TOOL.exists():
            st.na = "intake: not available yet (card 01)"
            out.append(st)
            continue
        if not pdf:
            st.na = "no units[].files.plan_pdf"
            out.append(st)
            continue
        vlm, assign = _backend(ctx, uid, "vlm"), _backend(ctx, uid, "assign")
        known = ctx.file(files.get("intake_json"))
        gt = ctx.file(files.get("plan_json"))
        m = re.match(r"1:(\d+)", str(u.get("plan_scale") or ""))
        b = ctx.project.get("building") or {}
        legal = ctx.project.get("legal") or {}
        cmd = [PY, "-B", TOOL, pdf, "--out", wd, "--vlm", vlm, "--assign", assign, "--model", "opus",
               "--apartment-id", uid, "--publish", "v1"]
        if m:
            cmd += ["--scale", m.group(1)]
        # only when it is not the tool's default 290: an explicit value comes back as a float (290.0) and the draft
        # would no longer be byte-comparable with a bare intake_raster.py run
        if b.get("ceiling_height_cm") and float(b["ceiling_height_cm"]) != 290.0:
            cmd += ["--ceiling-cm", str(b["ceiling_height_cm"])]
        if legal.get("rights_state"):
            cmd += ["--rights-state", legal["rights_state"]]
        if legal.get("rights_note"):
            cmd += ["--rights-note", legal["rights_note"]]
        if known and known.exists():
            cmd += ["--known-dims", known]
        if gt and gt.exists():
            cmd += ["--ground-truth", gt]
        v1 = wd / "v1"
        gate_cmd = [PY, "-B", PLAN_GATE, v1 / "plan.json", "--report", v1 / "report.json",
                    "--intake", known if known and known.exists() else "", "--out", wd / "qa" / "plan_gate.draft.json"]
        st.cmds = [cmd, gate_cmd]
        st.inputs = {"pdf": pdf, "intake_code": ENGINE / "intake", "args": [str(c) for c in cmd[3:]],
                     **{f"seed_{k}": ctx.p("intake", f"{uid}.{k}-reply.txt") for k in ("vlm", "assign")}}
        st.outputs = [v1 / "plan.json", v1 / "report.json"]
        st.gate = ("plan_gate.py on the DRAFT with the intake's report.json (dims gate on); ADVISORY: a FAIL is "
                   "recorded in qa.html and the run goes on to A2 correction / the plan stage")
        st.notes = [f"vlm backend {vlm if not vlm.startswith('file:') else 'file:' + rel(vlm[5:])}, "
                    f"assign {assign if not assign.startswith('file:') else 'file:' + rel(assign[5:])} ($0: subscription CLI or seeded reply)"]
        st.execute = _execute
        out.append(st)
    return out


def _execute(ctx, st):
    cmd, gate_cmd = st.cmds
    # the tool caches rasterize/crop/vlm by existence only: when the PDF itself changed, make it redo them
    stamp = st.workdir / ".stage.json"
    redo = ctx.force or (stamp.exists() and jload(stamp).get("inputs", {}).get("pdf") != st.fps.get("pdf"))
    run = cmd + (["--force"] if redo else [])
    code, secs, tail = run_external(run, st.workdir / "logs" / "intake_raster.log",
                                    timeout=getattr(ctx.args, "timeout", None), echo=not ctx.args.quiet)
    if code != 0 or not all(o.exists() for o in st.outputs):
        return Result("failed", 1, note=f"intake_raster.py exit {code}: {tail[-400:]}", seconds=secs)
    gcode, gsecs, gtail = run_external(gate_cmd, st.workdir / "logs" / "plan_gate.draft.log", echo=False)
    gfile = st.workdir / "qa" / "plan_gate.draft.json"
    g = jload(gfile) if gfile.exists() else None
    if g is not None:
        g["stage"] = "intake-draft"
        g["advisory"] = "the machine draft before A2 correction; recorded, never aborts the run"
        jdump(g, gfile)
    first = gtail.splitlines()[0] if gtail else f"plan_gate exit {gcode}"
    print(f"        gate  {first}  (advisory)")
    rep = jload(st.workdir / "v1" / "report.json")
    summ = rep.get("summary")
    gate = {"name": "plan_gate(draft)", "pass": bool(g and g["pass"]), "score": g and g.get("score"),
            "blocking": False, "file": rel(gfile)}
    return Result("ok", 0, gate=gate, seconds=round(secs + gsecs, 1),
                  note=(f"draft plan.json written; draft gate {'PASS' if gate['pass'] else 'FAIL'} (advisory)"
                        + ("; report: " + ", ".join(f"{k} {summ[k]}" for k in ("rooms_total", "rooms_named", "dims_read",
                                                                                  "dims_total", "max_dev_pct") if k in summ)
                           if isinstance(summ, dict) else "")))
