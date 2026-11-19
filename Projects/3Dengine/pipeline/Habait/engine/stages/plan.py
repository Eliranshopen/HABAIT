"""Stage plan: pick the plan of record for a unit, copy it to <project>/plan/<unit>/plan.json and gate it (BLOCKING).

Source, first that exists:
  1. --plan <file>                                   (explicit override; one unit per run)
  2. <project>/plan/<unit>/corrected/plan.json         (the A2 correction screen run with --out there)
  3. Habait/engine/correct/_local/<unit>/plan.json     (the A2 correction screen's default --out)
  4. project.json units[].files.plan_json              (a hand-checked plan; for 846 the ground truth)
  5. <project>/intake/<unit>/v1/plan.json             (the uncorrected intake draft: it usually FAILS the gate)

The intake's report.json (its machine-read printed dimension lines) goes to plan_gate.py as --report whenever the plan
comes from an intake, so the dims gate the same way as the direct call `plan_gate.py <plan> --report <report.json>`:
  1. --plan <file>        the report.json next to the file, else the `report` named in a session.json next to it (what
                          the A2 screen writes beside its corrected plan.json); none -> dims advisory (printed)
  2./3. A2 corrections    the same lookup, then the project's raster intake draft report.json
  4. units[].files.plan_json   no report (a hand-checked plan; dims advisory against fixtures/<apt>.dims.json, unchanged)
  5. intake draft         <project>/intake/<unit>/v1/report.json
A report is used only when its apartment_id equals the plan's (when both carry one).
A run of this stage deletes the unit's stamp before it overwrites plan/<unit>/plan.json, so a failed run is never
mistaken later for a passed one (the export stage requires a current plan stamp).

Gates (card 05 + the pipeline validator):
  * validate-plan.mjs     schema / consistency; must exit 0 (it cannot see a moved room, see card 05)
  * plan_gate.py          per-room walls / overlap / area (/ dims when the plan comes with the intake's report.json);
                          must PASS
  * negative control      the same gate on a copy with the most-walled room moved (+10, +10) cm (plan_gate.py --make-bad);
                          must FAIL, otherwise the gate is blind on this plan and the stage fails.
"""
from __future__ import annotations

import math
import shutil
from pathlib import Path

from .common import ENGINE, NODE, PY, REPO, Result, Step, invalidate_stamp, jdump, jload, rel, run_external

PLAN_GATE = ENGINE / "gates" / "plan_gate.py"
VALIDATE = REPO / "360walkaround" / "pipeline" / "validate-plan.mjs"
BAD_DX, BAD_DY = 10.0, 10.0


def _apt_id(p):
    try:
        return jload(p).get("apartment_id")
    except (OSError, ValueError, AttributeError):
        return None


def matching_report(plan_path, fallback=None):
    """The intake report.json that belongs to plan_path: <dir>/report.json, else the `report` of <dir>/session.json (the
    A2 screen's save record), else fallback. Only a report whose apartment_id equals the plan's (when both have one)."""
    plan_path = Path(plan_path)
    cands = [plan_path.parent / "report.json"]
    sess = plan_path.parent / "session.json"
    if sess.exists():
        try:
            r = jload(sess).get("report")
        except (OSError, ValueError, AttributeError):
            r = None
        if r:
            rp = Path(r)
            cands.append(rp if rp.is_absolute() else (REPO / rp))
    if fallback:
        cands.append(Path(fallback))
    want = _apt_id(plan_path)
    for c in cands:
        if c.is_file():
            got = _apt_id(c)
            if want and got and got != want:
                continue
            return c.resolve()
    return None


def choose_source(ctx, u):
    uid = u["id"]
    draft_report = ctx.p("intake", uid, "v1", "report.json")
    draft_report = draft_report if draft_report.exists() else None
    override = getattr(ctx.args, "plan", None)
    if override:
        p = Path(override).resolve()
        return p, "--plan override", matching_report(p)
    for p, why in ((ctx.p("plan", uid, "corrected", "plan.json"), "A2 correction (project)"),
                   (ENGINE / "correct" / "_local" / uid / "plan.json", "A2 correction (screen default out)")):
        if p.exists():
            return p, why, matching_report(p, draft_report)
    pj = ctx.file((u.get("files") or {}).get("plan_json"))
    if pj and pj.exists():
        return pj, "project.json units[].files.plan_json (hand-checked)", None
    d = ctx.p("intake", uid, "v1", "plan.json")
    if d.exists():
        return d, "intake DRAFT (uncorrected)", matching_report(d, draft_report)
    return None, "no plan: run intake (and A2 correction) or give --plan", None


def most_walled_room(plan):
    best, best_len = None, -1.0
    for r in plan.get("rooms", []):
        loop, kinds = r.get("loop") or [], r.get("edge_kinds") or []
        L = 0.0
        for i, a in enumerate(loop):
            if i < len(kinds) and kinds[i] == "wall":
                b = loop[(i + 1) % len(loop)]
                L += math.dist(a, b)
        if L > best_len:
            best, best_len = r["id"], L
    return best


def steps(ctx):
    out = []
    units = ctx.units()
    if getattr(ctx.args, "plan", None) and len(units) != 1:
        raise SystemExit("--plan needs exactly one unit (use --unit <id>)")
    for u in units:
        uid = u["id"]
        wd = ctx.p("plan", uid)
        st = Step("plan", uid, wd)
        src, why, report = choose_source(ctx, u)
        if not src:
            st.na = why
            out.append(st)
            continue
        known = ctx.file((u.get("files") or {}).get("intake_json"))
        known = known if known and known.exists() else ""
        plan, qa = wd / "plan.json", wd / "qa"
        rep_args = ["--report", report] if report else []
        st.cmds = [
            ["copy", src, plan],
            [NODE, VALIDATE, plan, "--json"],
            [PY, "-B", PLAN_GATE, plan, *rep_args, "--intake", known, "--out", qa / "plan_gate.json"],
            [PY, "-B", PLAN_GATE, "--make-bad", plan, "--room", "<most-walled room>", "--dx", str(BAD_DX),
             "--dy", str(BAD_DY), "--out", qa / "known-bad.plan.json"],
            [PY, "-B", PLAN_GATE, qa / "known-bad.plan.json", *rep_args, "--intake", known,
             "--out", qa / "plan_gate.known-bad.json"],
        ]
        st.inputs = {"source": src, "source_kind": why, "report": report or "none", "intake_json": known or "none",
                     "plan_gate": PLAN_GATE, "validate_plan": VALIDATE}
        st.outputs = [plan, qa / "plan_gate.json", qa / "plan_gate.known-bad.json"]
        st.gate = ("validate-plan.mjs exit 0 + plan_gate.py PASS (BLOCKING) + negative control: the most-walled room "
                   f"moved ({BAD_DX:g}, {BAD_DY:g}) cm must FAIL")
        st.notes = [f"source {rel(src)}  ({why})",
                    f"report {rel(report)}  (printed dimension lines GATE)" if report else
                    ("report none  (hand-checked plan: dims advisory against gates/fixtures/<apt>.dims.json)"
                     if why.startswith("project.json") else
                     "report none found next to the plan: dims ADVISORY only (put the intake's report.json beside it)")]
        st.execute = _execute
        out.append(st)
    return out


def _execute(ctx, st):
    cp, val, gate, mk, bad = st.cmds
    src, plan = Path(cp[1]), Path(cp[2])
    invalidate_stamp(st)            # plan.json is overwritten now: the old PASS no longer describes it
    plan.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, plan)
    jdump({"source": str(src), "kind": st.inputs["source_kind"]}, st.workdir / "source.json")
    logs = st.workdir / "logs"
    secs = 0.0
    c1, s, t1 = run_external(val, logs / "validate-plan.log", echo=False); secs += s
    (st.workdir / "qa").mkdir(parents=True, exist_ok=True)
    (st.workdir / "qa" / "validate-plan.json").write_text("\n".join(
        l for l in (logs / "validate-plan.log").read_text(encoding="utf-8").splitlines()[2:]), encoding="utf-8")
    print(f"        validate-plan.mjs exit {c1}")
    rep = st.inputs.get("report")
    print(f"        plan_gate --report {rel(rep)} (printed dimension lines gate)" if isinstance(rep, Path) else
          "        plan_gate without a report.json (dims advisory)")
    c2, s, t2 = run_external(gate, logs / "plan_gate.log", echo=False); secs += s
    print("        " + (t2.splitlines()[0] if t2 else f"plan_gate exit {c2}") if c2 in (0, 1) else f"        plan_gate exit {c2}")
    room = most_walled_room(jload(plan))
    mk = [room if a == "<most-walled room>" else a for a in mk]
    c3, s, t3 = run_external(mk, logs / "make-bad.log", echo=False); secs += s
    c4, s, t4 = run_external(bad, logs / "plan_gate.known-bad.log", echo=False); secs += s
    gb = st.workdir / "qa" / "plan_gate.known-bad.json"
    blind = None
    if gb.exists():
        g = jload(gb)
        g["known_bad"] = True           # qa_report.py: a negative control is green when it FAILS
        g["known_bad_note"] = f"{room} moved ({BAD_DX:g}, {BAD_DY:g}) cm by plan_gate.py --make-bad"
        jdump(g, gb)
        blind = bool(g["pass"])
        print(f"        negative control ({room} moved {BAD_DX:g},{BAD_DY:g} cm): "
              f"{'PASS -> the gate is BLIND here' if blind else 'FAIL (as it must)'}  score={g.get('score')}")
    g0 = jload(st.workdir / "qa" / "plan_gate.json") if (st.workdir / "qa" / "plan_gate.json").exists() else {}
    ok = c1 == 0 and c2 == 0 and c3 == 0 and blind is False
    gate_d = {"name": "validate-plan + plan_gate + negative control", "pass": ok, "score": g0.get("score"),
              "blocking": True, "file": rel(st.workdir / "qa" / "plan_gate.json"),
              "validate_plan_exit": c1, "plan_gate_exit": c2, "negative_control_failed": blind is False}
    why = []
    if c1 != 0:
        why.append(f"validate-plan.mjs exit {c1}")
    if c2 != 0:
        why.append(f"plan_gate {'FAIL' if c2 == 1 else 'exit ' + str(c2)} (worst room {g0.get('worst_room')})")
    if blind is not False:
        why.append("negative control did not fail")
    return Result("ok" if ok else "failed", 0 if ok else 1, gate=gate_d, seconds=round(secs, 1),
                  note=f"plan of record from {st.inputs['source_kind']}" + (": " + "; ".join(why) if why else ""))
