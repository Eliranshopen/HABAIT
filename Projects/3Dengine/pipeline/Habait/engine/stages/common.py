"""Shared plumbing for the engine stages: paths, hashing, the ledger, the skip stamp, external commands.

Every stage is a list of Steps (one per unit, or one per project). The runner in cli.py does, per Step:
  decide (skip | run | refuse | n/a) from the input hash and the stamp  ->  dry-run: print and stop
  ledger.begin (status "started", written to disk BEFORE any external call)  ->  step.execute()
  ledger.end (status, exit, cost, gate; written AFTER the call)  ->  stamp when the step produced its outputs.
Nothing here imports the Studio, tour360 or the intake: every tool is an external process.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1]          # Habait/engine
REPO = ENGINE.parents[1]                               # habait-walkaround
PY = os.environ.get("HABAIT_PY") or sys.executable
NODE = shutil.which("node") or "node"
BLENDER_DEFAULT = "C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"

STAGES = ["intake", "plan", "building", "scene", "clay", "skin", "video", "export"]
ALIASES = {"intake-raster": "intake"}
PAID = {"skin", "video"}

EXIT_OK, EXIT_FAIL, EXIT_USAGE, EXIT_REFUSED, EXIT_NOT_WIRED = 0, 1, 2, 3, 4
LEDGER_SCHEMA = "habait.engine-ledger/0.1"
STAMP = ".stage.json"


def blender() -> str:
    return os.environ.get("BLENDER") or BLENDER_DEFAULT


def now() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def jload(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def jdump(obj, p):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p)


def sha256_file(p) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fingerprint(v) -> str:
    """A file -> its sha256; a folder -> a hash of (relpath, size, mtime) of every file (big render folders are
    not re-read); a missing path -> 'missing'; anything else -> its JSON text."""
    if isinstance(v, Path):
        if v.is_file():
            return sha256_file(v)
        if v.is_dir():
            h = hashlib.sha256()
            for f in sorted(x for x in v.rglob("*") if x.is_file() and "__pycache__" not in x.parts):
                st = f.stat()
                h.update(f"{f.relative_to(v).as_posix()}|{st.st_size}|{st.st_mtime_ns}\n".encode())
            return "dir:" + h.hexdigest()
        return "missing"
    return json.dumps(v, ensure_ascii=False, sort_keys=True)


def hash_inputs(inputs: dict) -> tuple[str, dict]:
    fps = {k: fingerprint(v) for k, v in sorted(inputs.items())}
    return hashlib.sha256(json.dumps(fps, sort_keys=True).encode()).hexdigest(), fps


def rel(p) -> str:
    try:
        return Path(p).resolve().relative_to(REPO).as_posix()
    except ValueError:
        return Path(p).as_posix()


def show(cmd) -> str:
    return " ".join(f'"{c}"' if (" " in str(c) or not str(c)) else str(c) for c in cmd)


def run_external(cmd, log_path, cwd=REPO, timeout=None, env_extra=None, echo=True) -> tuple[int, float, str]:
    """Run one external tool; stream its output with a margin and keep it in log_path. Returns (exit, seconds, tail)."""
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1", **(env_extra or {})}
    Path(log_path).parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    lines = []
    with open(log_path, "w", encoding="utf-8") as log:
        log.write(f"$ {show(cmd)}\n(cwd {cwd})\n")
        try:
            p = subprocess.Popen([str(c) for c in cmd], cwd=str(cwd), env=env, stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
        except OSError as e:
            log.write(f"cannot start: {e}\n")
            return 127, 0.0, f"cannot start: {e}"
        try:
            for line in p.stdout:
                log.write(line)
                lines.append(line.rstrip("\n"))
                if echo:
                    print("        | " + line.rstrip("\n"), flush=True)
                if timeout and time.time() - t0 > timeout:
                    p.kill()
                    lines.append(f"TIMEOUT after {timeout} s")
                    break
            code = p.wait()
        except KeyboardInterrupt:
            p.kill()
            raise
    return code, round(time.time() - t0, 1), "\n".join(lines[-15:])


class Ledger:
    """<project>/ledger.json: one entry per step attempt. An entry is written with status 'started' before the external
    call and closed after it, so a crash leaves a visible 'started' row. cost_usd is 0 for every $0 stage."""

    def __init__(self, path: Path, project_id: str):
        self.path = Path(path)
        if self.path.exists():
            self.data = jload(self.path)
        else:
            self.data = {"schema": LEDGER_SCHEMA, "project": project_id, "currency": "USD", "entries": []}

    def save(self):
        e = self.data["entries"]
        self.data["spent_usd"] = round(sum(float(x.get("cost_usd") or 0) for x in e), 4)
        self.data["updated_at"] = now()
        jdump(self.data, self.path)

    def spent_usd(self, paid_only=False) -> float:
        return round(sum(float(x.get("cost_usd") or 0) for x in self.data["entries"]
                         if not paid_only or x.get("paid")), 4)

    def begin(self, step, cmds=None) -> dict:
        n = len(self.data["entries"]) + 1
        e = {"n": n, "stage": step.stage, "unit": step.unit, "status": "started", "started_at": now(),
             "finished_at": None, "input_hash": step.input_hash, "paid": step.stage in PAID,
             "est_usd": step.est_usd, "cost_usd": 0.0,
             "cmds": [show(c) for c in (cmds if cmds is not None else step.cmds)],
             "exit": None, "seconds": None, "gate": None, "note": None}
        self.data["entries"].append(e)
        self.save()
        return e

    def end(self, e, status, exit=None, cost_usd=0.0, gate=None, note=None, seconds=None):
        e.update(status=status, finished_at=now(), exit=exit, cost_usd=float(cost_usd), gate=gate, note=note,
                 seconds=seconds)
        self.save()


@dataclass
class Step:
    stage: str
    unit: str | None
    workdir: Path
    inputs: dict = field(default_factory=dict)        # name -> Path | value (hashed)
    outputs: list = field(default_factory=list)       # Paths that must exist for a skip
    cmds: list = field(default_factory=list)          # what would run (display + execution)
    gate: str = ""                                    # what the gate checks (printed)
    est_usd: float = 0.0
    na: str | None = None                             # not applicable: why
    execute: object = None                            # fn(ctx, step) -> Result
    preview: object = None                            # fn(ctx, step) -> (mode, why) or None: overrides the hash decision
    requires: object = None                           # fn(ctx, step) -> [problem, ..]: [] = the stages it needs are current
    requires_stages: tuple = ()                       # those stages (a dry-run that also runs them only notes the gap)
    blocked_line: str = ""                            # the BLOCKED line printed when requires() finds problems
    input_hash: str = ""
    fps: dict = field(default_factory=dict)
    notes: list = field(default_factory=list)         # extra lines printed under the step

    @property
    def label(self):
        return f"{self.stage}" + (f" [{self.unit}]" if self.unit else "")


@dataclass
class Result:
    status: str                  # ok | failed | refused | deferred | dry-run-only | not-wired | n/a | blocked
    exit: int = 0
    gate: dict | None = None     # {"name", "pass", "score", "blocking", "file"}
    note: str | None = None
    cost_usd: float = 0.0
    seconds: float | None = None
    stamp: bool = True           # write the skip stamp when status == ok


def decide(step: Step, force: bool) -> tuple[str, str]:
    step.input_hash, step.fps = hash_inputs(step.inputs)
    st_path = step.workdir / STAMP
    if force:
        return "run", "--force"
    if not st_path.exists():
        return "run", "no stamp: never completed here"
    st = jload(st_path)
    if st.get("input_hash") != step.input_hash:
        changed = sorted(k for k in set(st.get("inputs", {})) | set(step.fps)
                         if st.get("inputs", {}).get(k) != step.fps.get(k))
        return "run", "inputs changed: " + ", ".join(changed)
    missing = [rel(o) for o in step.outputs if not Path(o).exists()]
    if missing:
        return "run", "outputs missing: " + ", ".join(missing)
    return "skip", f"inputs unchanged since {st.get('finished_at')}"


def invalidate_stamp(step: Step):
    """Called by a step right before it overwrites its outputs: the stamp described the old outputs, and a run that
    fails now must not leave it behind (a later run with the old inputs would SKIP over the new, failed outputs)."""
    p = step.workdir / STAMP
    if p.exists():
        p.unlink()


def write_stamp(step: Step, status: str):
    jdump({"stage": step.stage, "unit": step.unit, "status": status, "finished_at": now(),
           "input_hash": step.input_hash, "inputs": step.fps, "outputs": [rel(o) for o in step.outputs]},
          step.workdir / STAMP)


def gate_json(path, gate, ok, score, inp, **extra):
    """A gate result qa_report.py (card 05) picks up: any JSON with 'gate' and 'pass'."""
    d = {"gate": gate, "pass": bool(ok), "score": score, "input": str(Path(inp).resolve()) if inp else "", **extra}
    jdump(d, path)
    return d


def resolve_from(base: Path, p):
    if not p:
        return None
    q = Path(p)
    return (q if q.is_absolute() else (base / q)).resolve()


class Ctx:
    def __init__(self, root: Path, args):
        self.root = Path(root).resolve()
        self.args = args
        self.project_path = self.root / "project.json"
        self.project = jload(self.project_path)
        self.pid = self.project.get("id", self.root.name)
        self.dry = bool(getattr(args, "dry_run", False))
        self.force = bool(getattr(args, "force", False))
        self.ledger = Ledger(self.root / "ledger.json", self.pid)

    def p(self, *parts) -> Path:
        return self.root.joinpath(*parts)

    def file(self, p):
        """A path from project.json, relative to project.json's folder."""
        return resolve_from(self.project_path.parent, p)

    def units(self):
        want = getattr(self.args, "unit", None)
        us = self.project.get("units") or []
        if not want:
            return us
        keys = want.split(",")
        return [u for u in us if u.get("id") in keys or str(u.get("number")) in keys]
