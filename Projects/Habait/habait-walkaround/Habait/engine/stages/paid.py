"""Stages skin and video: the only stages that cost money. The video stage lives in stages/video.py since card 35
(2026-11-03: adopt existing real clips at $0, else one Kling 4.0 v2v call per segment, guarded by spend_refusal below);
video_steps here only forwards to it. Skin is REFUSED (exit 3) unless BOTH
HABAIT_ALLOW_SPEND=1 and HABAIT_CAP_USD=<positive usd> are set in the process environment (never read from .env), and
the paid entries of <project>/ledger.json plus this step's estimate stay under the cap. A refusal still writes a
ledger entry (status "refused", cost 0).

v0 wires no paid backend: with spend allowed and under the cap the step prints what it would run and stops with
exit 4 ("not-wired"), still with cost 0. Wiring a backend is a separate card with its own cap and Eliran's approval in
the launching chat (memory contract item 6); run C:/RnD/Projects/Habait/tools/bench/kf_check.py before any keyframe spend.

Estimates: skin = one `gen-pano.mjs <apt> <scene> gpt25x` call per camera point at PANO_USD (below);
video = per segment, video/kling_v2v.py estimate_usd(): $0.094 per second of (clay + output) at 720p.
"""
from __future__ import annotations

import os
import re

from .common import NODE, REPO, Result, Step, jload

GEN_PANO = REPO / "Habait" / "tour360" / "tools" / "gen-pano.mjs"
# The skin template calls gen-pano.mjs with this model key (4096x2048 GPT Image 2.5 pano edit).
SKIN_MODEL_KEY = "gpt25x"
# THE per-pano price of the skin estimate, one constant. Source: gen-pano.mjs MODELS.gpt25x.usd = 2.40 (the amount it
# books per call into Habait/tour360/apartments/apt846/_local/ledger.json; memory.md section 7). It is NOT the $1.20
# list price of a 1920x1080 GPT Image 2.5 keyframe edit (the engine estimated 11 x $1.20 = $13.20 until 2026-11-02 18:55;
# the true 846 estimate is 11 x $2.40 = $26.40). If gen-pano.mjs changes its price, the dry-run prints PRICE DRIFT.
PANO_USD = 2.40
FLIGHT_USD = 3.20


def gen_pano_booked_usd(key=SKIN_MODEL_KEY):
    """What gen-pano.mjs books for one call of `key` (read as text, never imported), or None when unreadable."""
    try:
        src = GEN_PANO.read_text(encoding="utf-8")
    except OSError:
        return None
    m = re.search(r"\b" + re.escape(key) + r"\s*:\s*\{[^{}]*?\busd\s*:\s*([0-9.]+)", src)
    return float(m.group(1)) if m else None


def spend_refusal(ctx, est):
    """None when the spend is allowed, else the REFUSED line."""
    if os.environ.get("HABAIT_ALLOW_SPEND") != "1":
        return ("REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); "
                f"estimate ${est:.2f}, nothing was called")
    raw = os.environ.get("HABAIT_CAP_USD")
    try:
        cap = float(raw)
    except (TypeError, ValueError):
        cap = None
    if cap is None or cap <= 0:
        return f"REFUSED: HABAIT_CAP_USD is not a positive number ({raw!r}); estimate ${est:.2f}, nothing was called"
    spent = ctx.ledger.spent_usd(paid_only=True)
    if spent + est > cap:
        return (f"REFUSED: over the cap: ledger paid ${spent:.2f} + estimate ${est:.2f} > HABAIT_CAP_USD ${cap:.2f}; "
                "nothing was called")
    return None


def _preview(ctx, st):
    r = spend_refusal(ctx, st.est_usd)
    return ("refuse", r) if r else ("not-wired", f"spend allowed under the cap, but v0 wires no paid backend "
                                                 f"(estimate ${st.est_usd:.2f})")


def _execute(ctx, st):
    r = spend_refusal(ctx, st.est_usd)
    if r:
        print(f"        {r}")
        return Result("refused", 3, stamp=False, note=r)
    msg = (f"NOT WIRED: {st.stage} has no paid backend in engine v0; would run the commands above "
           f"(estimate ${st.est_usd:.2f}); nothing was called")
    print(f"        {msg}")
    return Result("not-wired", 4, stamp=False, note=msg)


def _points(ctx, u):
    uid = u["id"]
    p = ctx.p("plan", uid, "plan.json")
    if not p.exists():                      # dry-run before the plan stage: count on the plan it would pick
        from .plan import choose_source
        p = choose_source(ctx, u)[0] or p
    try:
        return [c["id"] for c in jload(p).get("camera_points", [])]
    except (OSError, ValueError):
        return []


def skin_steps(ctx):
    out = []
    for u in ctx.units():
        uid, tour = u["id"], u.get("tour_id") or u["id"]
        pts = _points(ctx, u)
        st = Step("skin", uid, ctx.p("skin", uid), est_usd=round(PANO_USD * max(len(pts), 1), 2))
        st.cmds = [[NODE, GEN_PANO, tour, p, SKIN_MODEL_KEY, "--cap", "$HABAIT_CAP_USD"]
                   for p in (pts or ["<scene>"])]
        st.gate = "kf_check.py ($0) before any keyframe spend; openings / per-class gates on the skinned panos"
        st.notes = [f"{len(pts)} camera point(s) x ${PANO_USD:.2f} (gen-pano.mjs {SKIN_MODEL_KEY} = GPT Image 2.5 "
                    "4096x2048 pano, booked per call)" + ("" if pts else "; no plan yet")]
        booked = gen_pano_booked_usd()
        if booked is not None and abs(booked - PANO_USD) > 1e-9:
            st.notes.append(f"PRICE DRIFT: gen-pano.mjs now books ${booked:.2f} for {SKIN_MODEL_KEY}, the engine "
                            f"estimates ${PANO_USD:.2f}: update PANO_USD in Habait/engine/stages/paid.py")
        st.preview, st.execute = _preview, _execute
        out.append(st)
    return out


def video_steps(ctx):
    """Forwarder (card 35): the video stage is stages/video.py (registered by cli.py); kept so that
    stages/__init__.py's REGISTRY entry and older callers keep working."""
    from .video import steps
    return steps(ctx)
