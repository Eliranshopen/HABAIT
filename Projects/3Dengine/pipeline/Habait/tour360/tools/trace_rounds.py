#!/usr/bin/env python
"""trace_rounds.py <label> <history.json> <plan-dir> [<plan-dir> ...]

Regression guard for auto-trace (2026-11-04): records, per plan and per room, the traced size against the printed size and the
trace-check status of one run under <label>, appends it to <history.json>, and prints the table of every recorded run, with a
⚠ where a room got worse than the previous run (a fix in one plan must not break another).
"""
import json
import os
import sys


def main():
    label, hist_p, dirs = sys.argv[1], sys.argv[2], sys.argv[3:]
    hist = json.load(open(hist_p, encoding="utf-8")) if os.path.exists(hist_p) else {"runs": []}
    run = {"label": label, "plans": {}}
    for d in dirs:
        rep = json.load(open(os.path.join(d, "report.json"), encoding="utf-8"))
        chk = json.load(open(os.path.join(d, "trace-check.json"), encoding="utf-8"))
        key = os.path.basename(os.path.dirname(os.path.abspath(d))) + "/" + os.path.basename(os.path.abspath(d))
        rooms = {}
        for row in rep.get("dims", []):
            name = f"{row.get('name_he') or ''} [{row['room']}]"
            worst = max(abs(x) for x in row["delta_pct"]) if row.get("delta_pct") else None
            rooms[name] = {"printed": row.get("printed_cm"), "traced": row.get("measured_cm"), "worst_pct": worst}
        run["plans"][key] = {"status": chk["status"], "checks": f"{chk['n_checks'] - chk['n_failed']}/{chk['n_checks']}", "rooms": rooms, "vs_hand": (lambda v: f"{v['rooms_matched']}/{v['rooms_hand']} rooms, openings {v['openings']['matched']}/{v['openings']['hand']}, walls IoU {v['walls_iou']}" if v else None)(json.load(open(os.path.join(d, "vs-hand.json"), encoding="utf-8")) if os.path.exists(os.path.join(d, "vs-hand.json")) else None)}
    hist["runs"] = [r for r in hist["runs"] if r["label"] != label] + [run]
    json.dump(hist, open(hist_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    labels = [r["label"] for r in hist["runs"]]
    plans = sorted({p for r in hist["runs"] for p in r["plans"]})
    out = []
    for p in plans:
        out.append(f"\n## {p}\n")
        out.append("| room | printed | " + " | ".join(labels) + " |")
        out.append("|---|---|" + "---|" * len(labels))
        names = sorted({n for r in hist["runs"] for n in r["plans"].get(p, {}).get("rooms", {})})
        for n in names:
            cells, prev = [], None
            printed = next((r["plans"][p]["rooms"][n]["printed"] for r in hist["runs"] if n in r["plans"].get(p, {}).get("rooms", {})), None)
            for r in hist["runs"]:
                v = r["plans"].get(p, {}).get("rooms", {}).get(n)
                if not v or v["worst_pct"] is None:
                    cells.append("—"); continue
                w = v["worst_pct"]
                flag = " ⚠" if prev is not None and w > prev + 1.0 else ""
                cells.append(f"{w:.1f} %{flag}")
                prev = w
            out.append(f"| {n} | {'×'.join(map(str, printed)) if printed else '—'} | " + " | ".join(cells) + " |")
        out.append("| **checks** | | " + " | ".join(r["plans"].get(p, {}).get("checks", "—") for r in hist["runs"]) + " |")
        if any(r["plans"].get(p, {}).get("vs_hand") for r in hist["runs"]):
            out.append("| **matches hand trace** | | " + " | ".join(r["plans"].get(p, {}).get("vs_hand") or "—" for r in hist["runs"]) + " |")
    txt = "# auto-trace: worst printed-dimension delta per room, per run (⚠ = worse than the run before)\n" + "\n".join(out) + "\n"
    open(hist_p.replace(".json", ".md"), "w", encoding="utf-8").write(txt)
    sys.stdout.buffer.write(txt.encode("utf-8"))


if __name__ == "__main__":
    main()
