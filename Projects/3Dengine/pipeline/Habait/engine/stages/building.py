"""Stage building: project.json -> the building mass + a 3D box per unit, through card 03's Habait/engine/building.py
(external process). Outputs in <project>/building/: units.json (platform contract units.v0 + box_world),
units-geometry.json, tower-mass.obj, units-check.png.

Gate (BLOCKING): building.py's own exit (1 = a unit unplaced / < 95 % inside the floor plate / an --expect failed,
2 = the project lacks an input) + units.json validated against Habait/platform/contracts (validate.mjs, read-only).
This is a contract check; the negative controls of the placement (north flipped, unit moved, unplaced) are
`building.py --selftest` (card 03), run with `--selftest-building`.
"""
from __future__ import annotations

import os
from pathlib import Path

from .common import ENGINE, NODE, PY, REPO, Result, Step, gate_json, invalidate_stamp, jload, rel, run_external

TOOL = ENGINE / "building.py"
CONTRACT = REPO / "Habait" / "platform" / "contracts" / "validate.mjs"
DEFAULT_MASS_TOOL = Path("C:/RnD/Projects/Habait/tools/bench/site846/tower_mass.py")

VALIDATE_JS = ("import {unitsSchema, validateSchema} from './Habait/platform/contracts/validate.mjs';"
               "import {readFileSync} from 'node:fs';"
               "const u = JSON.parse(readFileSync(process.env.HABAIT_UNITS_JSON, 'utf8'));"
               "const e = validateSchema(unitsSchema, u); e.forEach(x => console.log('schema ' + x));"
               "console.log(e.length ? 'units.json: ' + e.length + ' contract error(s)' : 'units.json: OK against units.v0');"
               "process.exit(e.length ? 1 : 0)")


def steps(ctx):
    wd = ctx.p("building")
    st = Step("building", None, wd)
    if not TOOL.exists():
        st.na = "building.py not found (card 03)"
        return [st]
    b = ctx.project.get("building") or {}
    fp = ctx.file((b.get("footprint") or {}).get("file"))
    mass = Path(os.environ.get("HABAIT_MASS_TOOL") or DEFAULT_MASS_TOOL)
    cmd = [PY, "-B", TOOL, "--project", ctx.project_path, "--out", wd]
    if getattr(ctx.args, "plain_mass", False) or not mass.exists():
        cmd.append("--plain-mass")
    st.cmds = [cmd, [NODE, "--input-type=module", "-e", "<validate units.json against units.v0>"]]
    if getattr(ctx.args, "selftest_building", False):
        st.cmds.append([PY, "-B", TOOL, "--selftest", "--project", ctx.project_path])
    st.inputs = {"project": ctx.project_path, "building_py": TOOL, "footprint": fp or "none",
                 "mass_tool": mass if "--plain-mass" not in cmd else "plain",
                 **{f"plan_{u['id']}": ctx.file((u.get("files") or {}).get("plan_json")) or "none" for u in ctx.units()}}
    st.outputs = [wd / "units.json", wd / "units-geometry.json"]
    st.gate = "building.py exit 0 (placement, >= 95 % inside the plate) + units.json valid against units.v0 (BLOCKING)"
    st.execute = _execute
    return [st]


def _execute(ctx, st):
    cmd = st.cmds[0]
    invalidate_stamp(st)            # building.py rewrites units.json now; the export stage requires a current stamp
    code, secs, tail = run_external(cmd, st.workdir / "logs" / "building.log", echo=not ctx.args.quiet,
                                    timeout=getattr(ctx.args, "timeout", None))
    units = st.workdir / "units.json"
    vcode, s2, vtail = (2, 0.0, "no units.json")
    if units.exists():
        vcode, s2, vtail = run_external([NODE, "--input-type=module", "-e", VALIDATE_JS],
                                        st.workdir / "logs" / "units-contract.log", echo=False,
                                        env_extra={"HABAIT_UNITS_JSON": str(units)})
    print(f"        building.py exit {code}; {vtail.splitlines()[-1] if vtail else 'contract exit ' + str(vcode)}")
    scode = None
    if len(st.cmds) > 2:
        scode, s3, _ = run_external(st.cmds[2], st.workdir / "logs" / "building-selftest.log", echo=False)
        print(f"        building.py --selftest exit {scode}")
        secs += s3
    ok = code == 0 and vcode == 0 and scode in (None, 0)
    n = len(jload(units).get("units", [])) if units.exists() else 0
    gate_json(st.workdir / "qa" / "building_contract.json", "building_contract", ok, 1.0 if ok else 0.0, units,
              building_exit=code, contract_exit=vcode, selftest_exit=scode, units=n)
    gate = {"name": "building.py + units.v0 contract", "pass": ok, "score": None, "blocking": True,
            "file": rel(st.workdir / "qa" / "building_contract.json")}
    return Result("ok" if ok else "failed", 0 if ok else 1, gate=gate, seconds=round(secs + s2, 1),
                  note=f"{n} unit box(es) in units.json" + ("" if ok else f"; building exit {code}, contract exit {vcode}: {tail[-300:]}"))
