"""kedma-d1: one room painted view by view ON its CG render, assembled into a 4096x2048 panorama (2026-11-17).

Why: a whole-panorama AI picture is not geometry-true (doors 7-8 degrees off, things near the camera bent, an invented wall in an
opening). A straight-line view painted on the CG view is: 2026-11-17, measured against the CG edges. Plan of record:
development/plans/2026-11-17-kedma-d1-true-geometry-redo.md.

How (every step $0 except the image call, which is jobs/kedma-d1/flatfix-call.mjs --in in.png, ledgered):
  init    the CG panorama becomes the canvas (4096x2048); nothing is painted yet
  view    cut one straight-line view of the canvas: in.png is what the image model gets (painted where the canvas is painted, CG where
          it is not, so a later view continues the materials and the light of the earlier ones), cg.png is the pure CG view the
          answer is checked against, painted.png is which part of the view is already painted
  accept  the answer is put back on the CG view's frame (hand/flatreg.py), then projected into the canvas with a feathered edge; where
          the canvas is already painted the earlier picture stays and the new one meets it across the earlier feather
  sheet   the canvas seen as a visitor sees it (level views all round, and one down), beside the CG
  export  the canvas as a generated panorama file with its record (a pick is set only with --pick)

Files: <apartment>/_local/redo/<asset>/{cg.png, canvas.png, painted.png, log.json} and the views in
       <apartment>/_local/flatfix/<asset>-r-<tag>/ (the folder shape flatreg.py, flatcheck.py and flatfix-call.mjs already read).

usage: python room_paint.py init   <apartment dir> <asset> --cg <pano.webp|png>
       python room_paint.py view   <apartment dir> <asset> <tag> --yaw Y --pitch P [--hfov 100] [--size 1024]
       python room_paint.py accept <apartment dir> <asset> <tag> --answer <png> [--no-reg] [--inset 16] [--feather 48]
       python room_paint.py sheet  <apartment dir> <asset> <out.jpg> [--pitch 0] [--hfov 94]
       python room_paint.py export <apartment dir> <asset> <name> [--pick]
"""
import argparse
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np

CW, CH = 4096, 2048                 # a room's canvas; `init --width 8192` makes a larger one, and an existing canvas keeps its own size
ap = argparse.ArgumentParser()
ap.add_argument("cmd", choices=["init", "view", "accept", "sheet", "export"])
ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("tag", nargs="?")
ap.add_argument("--cg"); ap.add_argument("--yaw", type=float); ap.add_argument("--pitch", type=float, default=0.0)
ap.add_argument("--hfov", type=float, default=100.0); ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--answer"); ap.add_argument("--no-reg", action="store_true")
ap.add_argument("--inset", type=int, default=16); ap.add_argument("--feather", type=int, default=48)
ap.add_argument("--pick", action="store_true"); ap.add_argument("--force", action="store_true"); ap.add_argument("--no-tone", action="store_true")
# 2026-11-17 (Eliran: double resolution): a 2K answer of a 100-112 deg view holds about 18-20 px per degree; a 4096-wide canvas holds
# 11.4 and would throw the gain away. An 8192-wide canvas (22.8 px per degree) keeps it.
ap.add_argument("--width", type=int, default=4096)
a = ap.parse_args()
R_DIR = os.path.join(a.apt, "_local", "redo", a.asset)
os.makedirs(R_DIR, exist_ok=True)
P = lambda n: os.path.join(R_DIR, n)
HERE = os.path.dirname(os.path.abspath(__file__))
if a.cmd == "init":
    CW, CH = a.width, a.width // 2
elif os.path.exists(P("painted.png")):
    _m = cv2.imread(P("painted.png"), cv2.IMREAD_GRAYSCALE)
    CH, CW = _m.shape


def frame(yaw, pitch):
    y, p = math.radians(yaw), math.radians(pitch)
    F = np.array([math.cos(p) * math.sin(y), math.sin(p), math.cos(p) * math.cos(y)])
    R = np.array([math.cos(y), 0.0, -math.sin(y)])
    U = np.array([-math.sin(p) * math.sin(y), math.cos(p), -math.sin(p) * math.cos(y)])
    return F, R, U


def cut(pano, yaw, pitch, hfov, w, h, interp=cv2.INTER_LANCZOS4):
    """the straight-line view: pano u 0.5 = yaw 0, v 0.5 = the horizon (the frame of hand/flatfix.py)"""
    PH, PW = pano.shape[:2]
    F, R, U = frame(yaw, pitch)
    f = (w / 2) / math.tan(math.radians(hfov) / 2)
    i, j = np.meshgrid(np.arange(w) + 0.5, np.arange(h) + 0.5)
    d = F[None, None, :] + ((i - w / 2) / f)[..., None] * R[None, None, :] + ((h / 2 - j) / f)[..., None] * U[None, None, :]
    d /= np.linalg.norm(d, axis=2, keepdims=True)
    psi, th = np.arctan2(d[..., 0], d[..., 2]), np.arcsin(np.clip(d[..., 1], -1, 1))
    mx = ((0.5 + psi / (2 * math.pi)) % 1.0) * PW - 0.5
    my = (0.5 - th / math.pi) * PH - 0.5
    return cv2.remap(pano, mx.astype(np.float32), my.astype(np.float32), interp, borderMode=cv2.BORDER_WRAP)


def view_dir():
    d = os.path.join(a.apt, "_local", "flatfix", f"{a.asset}-r-{a.tag}")
    os.makedirs(d, exist_ok=True)
    return d


def log_row(row):
    p = P("log.json")
    rows = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else []
    rows.append(row)
    json.dump(rows, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if a.cmd == "init":
    cg = cv2.imread(a.cg)
    cg = cv2.resize(cg, (CW, CH), interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(P("cg.png"), cg); cv2.imwrite(P("canvas.png"), cg); cv2.imwrite(P("painted.png"), np.zeros((CH, CW), np.uint8))
    log_row({"step": "init", "cg": a.cg.replace("\\", "/")})
    print("init", R_DIR)
    sys.exit(0)

canvas, cg, painted = cv2.imread(P("canvas.png")), cv2.imread(P("cg.png")), cv2.imread(P("painted.png"), cv2.IMREAD_GRAYSCALE)

if a.cmd == "view":
    d = view_dir(); S = a.size
    cv2.imwrite(os.path.join(d, "in.png"), cut(canvas, a.yaw, a.pitch, a.hfov, S, S))
    cv2.imwrite(os.path.join(d, "cg.png"), cut(cg, a.yaw, a.pitch, a.hfov, S, S))
    pv = cut(painted, a.yaw, a.pitch, a.hfov, S, S, cv2.INTER_LINEAR)
    cv2.imwrite(os.path.join(d, "painted.png"), pv)
    json.dump({"asset": a.asset, "tag": a.tag, "yaw": a.yaw, "pitch": a.pitch, "hfov": a.hfov, "size": S, "redo": True},
              open(os.path.join(d, "params.json"), "w", encoding="utf-8"), indent=1)
    print(json.dumps({"view": d.replace("\\", "/"), "already_painted_pct": round(float((pv > 127).mean()) * 100, 1)}))
    sys.exit(0)

if a.cmd == "accept":
    d = view_dir(); prm = json.load(open(os.path.join(d, "params.json"), encoding="utf-8")); S = prm["size"]
    ans_path, box, reg = a.answer, (0.0, 0.0, 1.0, 1.0), None
    if not a.no_reg:
        r = subprocess.run([sys.executable, os.path.join(HERE, "flatreg.py"), a.apt, a.asset, "r-" + a.tag, "--answer", a.answer],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout, r.stderr, file=sys.stderr); sys.exit(1)
        reg = json.loads(r.stdout.strip().splitlines()[-1])
        # an answer that had to be shrunk, enlarged or moved a long way to meet the CG view was re-framed by the model, not nudged:
        # it is refused, not repaired (2026-11-17: a kitchen view came back zoomed out 14 %, in another colour, with an invented door)
        if (abs(reg["scale"] - 1) > 0.05 or max(abs(reg["dx"]), abs(reg["dy"])) > 0.07 * S) and reg["before"] - reg["after"] >= 0.6 and not a.force:
            print(json.dumps({"step": "refused", "tag": a.tag, "why": "re-framed", "registration": reg})); sys.exit(3)
        # a registration is taken only when it clearly helps; where the CG view has few edges it is noise (pantry, 2026-11-17)
        if reg["before"] - reg["after"] >= 0.6 and (abs(reg["dx"]) + abs(reg["dy"]) >= 4 or abs(reg["scale"] - 1) >= 0.006):
            ans_path = reg["out"]; box = tuple(float(t) for t in reg["box"].split(","))
        else:
            reg["used"] = False
    ans = cv2.imread(ans_path)
    if ans.shape[0] != S or ans.shape[1] != S:
        ans = cv2.resize(ans, (S, S), interpolation=cv2.INTER_AREA if ans.shape[0] > S else cv2.INTER_CUBIC)
    F, R, U = frame(prm["yaw"], prm["pitch"])
    f = (S / 2) / math.tan(math.radians(prm["hfov"]) / 2)
    uu, vv = np.meshgrid((np.arange(CW) + 0.5) / CW, (np.arange(CH) + 0.5) / CH)
    psi, th = (uu - 0.5) * 2 * math.pi, (0.5 - vv) * math.pi
    dirs = np.stack([np.cos(th) * np.sin(psi), np.sin(th), np.cos(th) * np.cos(psi)], axis=2)
    al = dirs @ F
    ok = al > 1e-6
    x = np.where(ok, (dirs @ R) / np.where(ok, al, 1), 0); y = np.where(ok, (dirs @ U) / np.where(ok, al, 1), 0)
    fi, fj = x * f + S / 2 - 0.5, S / 2 - y * f - 0.5
    inside = ok & (fi >= 0) & (fi <= S - 1) & (fj >= 0) & (fj <= S - 1)
    samp = cv2.remap(ans, fi.astype(np.float32), fj.astype(np.float32), cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    edge = np.minimum(np.minimum(fi - box[0] * (S - 1), box[2] * (S - 1) - fi), np.minimum(fj - box[1] * (S - 1), box[3] * (S - 1) - fj))
    w = np.clip((edge - a.inset) / max(1, a.feather), 0, 1); w = w * w * (3 - 2 * w); w = np.where(inside, w, 0)
    old = painted.astype(np.float32) / 255.0
    # the tone at the seam (2026-11-17: a patch repainted inside a finished picture - the island's top, the place of an invented
    # armchair - came back a shade lighter than the wall around it and left a pale outline). Where the earlier picture and the
    # answer both exist, the answer is brought to the earlier picture's local brightness, per channel; the correction fades to
    # nothing a few dozen pixels into the new part, so a large new area keeps the answer's own light.
    tone = None
    both = (old > 0.5) & inside
    if not a.no_tone and both.sum() > 2000 and ((old < 0.5) & inside).any():
        K, sg = max(4, CW // 1024), 9.0                 # the field is worked at about 1024 px wide whatever the canvas
        sm = lambda B: cv2.resize(B.astype(np.float32), (CW // K, CH // K), interpolation=cv2.INTER_AREA)
        bl = lambda B: cv2.GaussianBlur(B, (0, 0), sg)
        m_ = sm(both)
        conf = np.clip(bl(m_) / 0.10, 0, 1)
        gain = np.ones((CH // K, CW // K, 3), np.float32)
        for k in range(3):
            num, den = bl(sm(canvas[..., k] * both)), bl(sm(samp[..., k] * both))
            gain[..., k] = np.clip(num / np.maximum(den, 1e-3), 0.80, 1.25) * conf + (1 - conf)
        gain = cv2.resize(gain, (CW, CH), interpolation=cv2.INTER_CUBIC)
        samp = np.clip(samp.astype(np.float32) * gain, 0, 255)
        g_in = gain[(old < 0.5) & inside & (w > 0)]
        tone = [round(float(g_in.min()), 3), round(float(g_in.max()), 3)] if g_in.size else None
    wn = w * (1.0 - old)                                   # the earlier picture stays; the new one fills the rest and meets it in its feather
    canvas = (canvas.astype(np.float32) * (1 - wn[..., None]) + samp.astype(np.float32) * wn[..., None]).round().clip(0, 255).astype(np.uint8)
    painted = np.maximum(painted, (w * 255).round().astype(np.uint8))
    cv2.imwrite(P("canvas.png"), canvas); cv2.imwrite(P("painted.png"), painted)
    row = {"step": "accept", "tag": a.tag, "view": [prm["yaw"], prm["pitch"], prm["hfov"]], "answer": os.path.basename(a.answer), "registration": reg,
           "new_px": int((wn > 0.01).sum()), "painted_pct": round(float((painted > 127).mean()) * 100, 1), "seam_tone_gain": tone}
    log_row(row); print(json.dumps(row))
    sys.exit(0)

if a.cmd == "sheet":
    W, H = 760, 480; rows = []
    views = [(yw, a.pitch) for yw in (0, 60, 120, 180, 240, 300)] + [(0, -55), (180, -55)]
    for yw, pt in views:
        l, r = cut(canvas, yw, pt, a.hfov, W, H), cut(cg, yw, pt, a.hfov, W, H)
        cv2.putText(l, f"yaw {yw} pitch {pt:g}", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 220), 2)
        rows.append(np.hstack([l, np.full((H, 6, 3), 255, np.uint8), r]))
    out = np.vstack([np.vstack([r, np.full((6, r.shape[1], 3), 255, np.uint8)]) for r in rows])
    cv2.imwrite(a.tag, out, [cv2.IMWRITE_JPEG_QUALITY, 88])
    print("wrote", a.tag, out.shape)
    sys.exit(0)

if a.cmd == "export":
    GEN = os.path.join(a.apt, "_local", "generated")
    name = f"{a.asset}__redo__{a.tag}.png"
    cv2.imwrite(os.path.join(GEN, name), canvas)
    side = {"version": 3, "kind": "view-painted", "parent": f"{a.asset}__cg__0.png", "tool": "jobs/kedma-d1/hand/room_paint.py",
            "views": [r for r in json.load(open(P("log.json"), encoding="utf-8")) if r.get("step") == "accept"],
            "painted_pct": round(float((painted > 127).mean()) * 100, 1), "size": [CW, CH],
            "note": "every pixel was painted on a straight-line view of this camera's own CG render and registered to it; no whole-panorama picture"}
    json.dump(side, open(os.path.join(GEN, name[:-4] + ".seam.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    if a.pick:
        pp = os.path.join(a.apt, "_local", "picks.json"); picks = json.load(open(pp, encoding="utf-8")); picks[a.asset] = name
        json.dump(picks, open(pp, "w", encoding="utf-8"), indent=1)
    print(json.dumps({"out": name, "painted_pct": side["painted_pct"], "picked": bool(a.pick)}))
