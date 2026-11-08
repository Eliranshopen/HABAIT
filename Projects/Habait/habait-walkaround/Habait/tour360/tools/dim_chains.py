#!/usr/bin/env python
"""dim_chains.py — the printed dimension lines of a CAD sales plan as measured chains (auto-trace, 2026-11-05).

chains(segments_px, ppc) -> [{a: [x,y], b: [x,y], len_cm, angle_deg, ticks}]  (crop px; a/b = the TICK positions)

A CAD dimension is a line that overshoots its two ticks by a few cm, often broken where its text sits, with a short slanted
tick (or an arrow) at each true end. Collinear pieces are merged into one chain; the ticks lying on the chain give its true
ends; the length between them is what the drawing printed. A chain with fewer than two ticks is measured end to end, minus the
typical overshoot. The CLI prints every chain with its length (for a probe).
"""
import json
import math
import sys


def chains(segs, ppc, min_cm=60):
    long_, short = [], []
    for s in segs:
        L = math.hypot(s[2] - s[0], s[3] - s[1])
        (long_ if L / ppc >= 15 else short).append(s)
    used = [False] * len(long_)
    out = []
    for i, s in enumerate(long_):
        if used[i]:
            continue
        used[i] = True
        ax, ay, bx, by = s
        ang = math.atan2(by - ay, bx - ax)
        ux, uy = math.cos(ang), math.sin(ang)
        nx, ny = -uy, ux
        off = ax * nx + ay * ny
        ts = [ax * ux + ay * uy, bx * ux + by * uy]
        grew = True
        while grew:
            grew = False
            lo, hi = min(ts), max(ts)
            for j, t in enumerate(long_):
                if used[j]:
                    continue
                a2 = math.atan2(t[3] - t[1], t[2] - t[0])
                d_ang = abs(((a2 - ang) + math.pi / 2) % math.pi - math.pi / 2)
                if d_ang > math.radians(1.0):
                    continue
                if abs(t[0] * nx + t[1] * ny - off) > 3 or abs(t[2] * nx + t[3] * ny - off) > 3:
                    continue
                t0, t1 = sorted([t[0] * ux + t[1] * uy, t[2] * ux + t[3] * uy])
                if t0 > hi + 80 * ppc or t1 < lo - 80 * ppc:
                    continue
                used[j] = True
                ts += [t0, t1]
                grew = True
        lo, hi = min(ts), max(ts)
        if (hi - lo) / ppc < min_cm:
            continue
        ticks = []
        for t in short:
            mx, my = (t[0] + t[2]) / 2, (t[1] + t[3]) / 2
            if abs(mx * nx + my * ny - off) <= 5:
                tt = mx * ux + my * uy
                if lo - 4 <= tt <= hi + 4:
                    ticks.append(tt)
        ticks.sort()
        if len(ticks) >= 2 and (ticks[-1] - ticks[0]) >= 0.6 * (hi - lo):
            t_a, t_b, how = ticks[0], ticks[-1], "ticks"
        else:
            ov = min(10 * ppc, 0.05 * (hi - lo))
            t_a, t_b, how = lo + ov, hi - ov, "ends minus overshoot"
        A = [ux * t_a + nx * off, uy * t_a + ny * off]
        B = [ux * t_b + nx * off, uy * t_b + ny * off]
        out.append({"a": [round(A[0], 1), round(A[1], 1)], "b": [round(B[0], 1), round(B[1], 1)], "len_cm": round((t_b - t_a) / ppc, 1),
                    "angle_deg": round(math.degrees(ang) % 180, 1), "ends": how, "n_ticks": len(ticks), "part": False})
        # a chained dimension: every gap between consecutive ticks is a printed sub-dimension of its own
        tk = [t for i_, t in enumerate(ticks) if i_ == 0 or t - ticks[i_ - 1] > 3]
        if len(tk) >= 3:
            for t0, t1 in zip(tk[:-1], tk[1:]):
                if (t1 - t0) / ppc < 40:
                    continue
                P0 = [ux * t0 + nx * off, uy * t0 + ny * off]; P1 = [ux * t1 + nx * off, uy * t1 + ny * off]
                out.append({"a": [round(P0[0], 1), round(P0[1], 1)], "b": [round(P1[0], 1), round(P1[1], 1)], "len_cm": round((t1 - t0) / ppc, 1),
                            "angle_deg": round(math.degrees(ang) % 180, 1), "ends": "ticks (part of a chain)", "n_ticks": 2, "part": True})
    return out


def fit_scale(segs, printed, ppc_guess):
    """the scale the dimension lines themselves give: every (chain, printed value) pair proposes px-per-cm; the largest
    cluster that agrees within 0.5 % wins. Returns (ppc, n_matches, matched values) or (None, 0, [])."""
    printed = sorted({float(v) for v in printed if v and float(v) >= 60})
    if not printed:
        return None, 0, []
    best = (None, 0, [])
    for g in (ppc_guess, ppc_guess * 0.75, ppc_guess * 1.33):
        cs = chains(segs, g)
        px = [c["len_cm"] * g for c in cs]
        props = sorted((L / v, v) for L in px for v in printed)
        for i, (r0, _) in enumerate(props):
            grp = [(r, v) for r, v in props if abs(r - r0) <= 0.005 * r0]
            vals = {v for _, v in grp}
            if len(vals) > best[1]:
                rs = sorted(r for r, _ in grp)
                best = (rs[len(rs) // 2], len(vals), sorted(vals))
    if best[1] < 3:
        return None, best[1], best[2]
    return best


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "fit-scale":
    v = json.load(open(sys.argv[2], encoding="utf-8"))
    printed = [float(x) for x in sys.argv[3].split(",") if x]
    ppc, n, vals = fit_scale(v["dimension_segments_px"], printed, float(sys.argv[4]))
    print(json.dumps({"ppc": ppc, "n": n, "values": vals}))
    sys.exit(0)

if __name__ == "__main__":
    v = json.load(open(sys.argv[1], encoding="utf-8"))
    ppc = float(sys.argv[2])
    cs = chains(v["dimension_segments_px"], ppc)
    want = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 else []
    print(f"{len(cs)} chains")
    for c in sorted(cs, key=lambda c: c["len_cm"]):
        hit = [w for w in want if abs(c["len_cm"] - w) <= max(0.015 * w, 4)]
        print(f"  {c['len_cm']:7.1f} cm  angle {c['angle_deg']:6.1f}  {c['ends']:22s} ticks {c['n_ticks']}  {'= ' + str(hit) if hit else ''}")
