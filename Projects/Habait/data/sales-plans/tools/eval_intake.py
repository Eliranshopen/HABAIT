#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
eval_intake.py - score a model/VLM reading of an Israeli sales plan against ground truth.

Model JSON shape (what the intake prompt asks for; see eval/<date>/inputs/prompt_*.txt):
    {"rooms":[{"name_he","name_en","type","printed_dims_cm":[w,d]|null,"area_m2_estimate","is_outdoor"}],
     "printed_dimensions_cm":[...], "openings":{"doors":n,"windows_or_glazing_runs":n},
     "unit":{"number","area_m2","terrace_m2","floor"}, "confidence", "notes"}
Markdown code fences around the JSON are tolerated.

Ground truth = the unit folder:  <unit>/meta.json  (intake fixture: rooms as labelled on the drawing,
drawing.printed_dimensions_cm, unit fields)  +  <unit>/plan.json  (traced geometry; used for the
room count cross-check and for clear_dims when meta has no printed dims).

Usage:
    python -I tools/eval_intake.py --unit israel-canada/rainbow-tel-aviv/unit-846 \
        --pred eval/2026-11-02/inputs/sonnet_full-sheet.json --label sonnet_full-sheet \
        --out eval/2026-11-02/sonnet_full-sheet.result.json [--md eval/2026-11-02/sonnet_full-sheet.md]
    python -I tools/eval_intake.py --unit <unit> --pred a.json --pred b.json   (prints a comparison table)

Scores (all in [0,1] unless stated):
    rooms.recall / precision / f1     fuzzy name+type matching (Hebrew/English synonyms, see SYNONYMS)
    rooms.type_accuracy               among matched rooms, canonical type equal
    rooms.name_exact_rate             among matched rooms, the printed Hebrew label was read verbatim
    dims.recall / precision           printed dimension numbers (exact match, cm; a +-1 cm slip counts)
    dims.room_dims_correct            GT rooms with printed [w,d] whose predicted pair is within +-3 %
    unit.correct / unit.total         number, area_m2, terrace_m2, floor
    edit_cost                         weighted count of corrections a human must make (lower is better)
    edit_score                        1 - edit_cost / cost_from_scratch (0 = no better than typing it in)
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
import unicodedata
from typing import Any

# --------------------------------------------------------------------------- normalisation

FINALS = str.maketrans({"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"})
NIQQUD = re.compile(r"[֑-ׇ]")
PUNCT = re.compile(r"""["'`״׳\-–—·.,;:()\[\]/\\]+""")


def norm(s: str | None) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", str(s)).lower()
    s = NIQQUD.sub("", s)
    s = PUNCT.sub(" ", s)
    s = s.translate(FINALS)
    return " ".join(s.split())


# Canonical room groups. Every synonym maps to one group; a predicted/GT room gets the group of the
# first synonym found in its Hebrew or English name, else the group of its declared type.
SYNONYMS: dict[str, list[str]] = {
    "living":   ["סלון", "חדר דיור", "חדר מגורים", "living", "lounge", "salon"],
    "kitchen":  ["מטבח", "kitchen"],
    "dining":   ["פינת אוכל", "פנת אוכל", "חדר אוכל", "dining"],
    "bedroom":  ["חדר שינה", "חדר הורים", "חדר ילדים", "חדר ילד", "חדר עבודה", "bedroom", "master", "kids room",
                 "children", "study"],
    "bathroom": ["חדר רחצה", "חדר אמבטיה", "אמבטיה", "מקלחת", "bathroom", "bath", "shower", "ensuite", "en-suite"],
    "toilet":   ["שירותים", "שרותים", "בית שימוש", "בית שמוש", "toilet", "wc", "powder"],
    "hall":     ["כניסה", "מבואה", "פרוזדור", "מסדרון", "הול", "entrance", "hall", "foyer", "corridor", "lobby",
                 "vestibule"],
    "storage":  ["פינת ארונות", "פנת ארונות", "ארונות", "חדר ארונות", "מחסן", "wardrobe", "closet", "storage",
                 "dressing"],
    "balcony":  ["מרפסת", "terrace", "balcony", "patio", "roof"],
    "service":  ["מרפסת שירות", "מרפסת שרות", "חדר כביסה", "service balcony", "laundry", "utility"],
    "mamad":    ["ממד", "ממ\"ד", "מרחב מוגן", "safe room", "mamad", "shelter", "protected"],
}
# Declared-type vocabulary (prompt + SCHEMA.md + intake fixture) -> group
TYPE_TO_GROUP = {
    "living": "living", "kitchen": "kitchen", "dining": "dining", "bedroom": "bedroom",
    "master_bedroom": "bedroom", "bathroom": "bathroom", "toilet": "toilet", "hall": "hall",
    "corridor": "hall", "entrance": "hall", "storage": "storage", "wardrobe": "storage",
    "balcony": "balcony", "terrace": "balcony", "service_balcony": "service", "mamad": "mamad",
    "safe_room": "mamad", "other": "other",
}
# Groups that a human would still accept as "same kind of room" (cost = 0 for a type fix)
GROUP_FAMILY = {
    "bathroom": "wet", "toilet": "wet",
    "balcony": "outdoor", "service": "outdoor",
    "hall": "circulation", "storage": "circulation",
}


def group_of(name_he: str | None, name_en: str | None, declared_type: str | None) -> str:
    nh, ne = norm(name_he), norm(name_en)
    # longer synonyms first so "מרפסת שירות" beats "מרפסת"
    hits = []
    for g, words in SYNONYMS.items():
        for w in words:
            nw = norm(w)
            if nw and (nw in nh or nw in ne):
                hits.append((len(nw), g))
    if hits:
        hits.sort(reverse=True)
        return hits[0][1]
    return TYPE_TO_GROUP.get(norm(declared_type), "other")


def name_sim(a: str | None, b: str | None) -> float:
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    r = difflib.SequenceMatcher(None, a, b).ratio()
    ta, tb = set(a.split()), set(b.split())
    jac = len(ta & tb) / len(ta | tb) if ta | tb else 0.0
    return max(r, jac)


def room_score(gt: dict, pr: dict) -> float:
    """0..1: how plausibly pr is a reading of gt."""
    s_name = max(name_sim(gt.get("name_he"), pr.get("name_he")),
                 name_sim(gt.get("name_en"), pr.get("name_en")))
    same_group = gt["_group"] == pr["_group"]
    same_family = GROUP_FAMILY.get(gt["_group"]) is not None and \
        GROUP_FAMILY.get(gt["_group"]) == GROUP_FAMILY.get(pr["_group"])
    outdoor_ok = (bool(gt.get("is_outdoor")) == bool(pr.get("is_outdoor")))
    score = 0.55 * s_name + (0.35 if same_group else 0.15 if same_family else 0.0) + (0.10 if outdoor_ok else 0.0)
    # a dims match is strong evidence the model looked at the right room
    if gt.get("printed_dims_cm") and pr.get("printed_dims_cm") and dims_match(gt["printed_dims_cm"], pr["printed_dims_cm"]):
        score = max(score, 0.9)
    return min(score, 1.0)


def dims_match(a, b, tol=0.03) -> bool:
    try:
        a = sorted(float(x) for x in a)
        b = sorted(float(x) for x in b)
    except (TypeError, ValueError):
        return False
    if len(a) != 2 or len(b) != 2:
        return False
    return all(abs(x - y) <= max(tol * x, 1.0) for x, y in zip(a, b))


# --------------------------------------------------------------------------- loading


def load_json_lenient(path: str) -> Any:
    txt = open(path, encoding="utf-8").read().strip()
    txt = re.sub(r"^```(?:json)?\s*", "", txt)
    txt = re.sub(r"\s*```$", "", txt)
    start, end = txt.find("{"), txt.rfind("}")
    if start >= 0 and end > start:
        txt = txt[start:end + 1]
    return json.loads(txt)


def load_ground_truth(unit_dir: str) -> dict:
    meta_p = os.path.join(unit_dir, "meta.json")
    plan_p = os.path.join(unit_dir, "plan.json")
    meta = json.load(open(meta_p, encoding="utf-8")) if os.path.exists(meta_p) else {}
    plan = json.load(open(plan_p, encoding="utf-8")) if os.path.exists(plan_p) else {}

    rooms = []
    src = meta.get("rooms") or plan.get("rooms") or []
    for r in src:
        rooms.append({
            "name_he": r.get("name_he"), "name_en": r.get("name_en"), "type": r.get("type"),
            "printed_dims_cm": r.get("printed_dims_cm"), "is_outdoor": bool(r.get("is_outdoor")),
            "_group": group_of(r.get("name_he"), r.get("name_en"), r.get("type")),
        })
    # attach traced clear dims / area from plan.json by Hebrew label (first match)
    for r in rooms:
        for pr in plan.get("rooms", []):
            if norm(pr.get("name_he")) == norm(r["name_he"]):
                r["clear_dims_cm"] = pr.get("clear_dims_cm")
                r["area_m2_traced"] = pr.get("area_m2")
                break

    printed = list((meta.get("drawing") or {}).get("printed_dimensions_cm") or [])
    if not printed:
        for r in rooms:
            if r.get("printed_dims_cm"):
                printed += list(r["printed_dims_cm"])
    unit = dict(meta.get("unit") or {})
    floor = (meta.get("building") or {}).get("floor_of_unit")
    gt_unit = {"number": unit.get("number"), "area_m2": unit.get("area_m2"),
               "terrace_m2": unit.get("terrace_m2"), "floor": floor}
    openings = plan.get("openings") or []
    gt_open = {
        "doors": sum(1 for o in openings if "door" in str(o.get("kind", ""))),
        "all_openings": len(openings),
        "rooms_in_plan": len(plan.get("rooms") or []),
    }
    return {"rooms": rooms, "printed_dimensions_cm": printed, "unit": gt_unit, "openings": gt_open,
            "source": {"meta": os.path.relpath(meta_p) if meta else None, "plan": os.path.relpath(plan_p) if plan else None}}


# --------------------------------------------------------------------------- matching


def match_rooms(gt_rooms: list[dict], pr_rooms: list[dict], threshold: float = 0.55):
    pairs = []
    for i, g in enumerate(gt_rooms):
        for j, p in enumerate(pr_rooms):
            pairs.append((room_score(g, p), i, j))
    pairs.sort(reverse=True)
    used_g, used_p, matches = set(), set(), []
    for s, i, j in pairs:
        if s < threshold:
            break
        if i in used_g or j in used_p:
            continue
        used_g.add(i); used_p.add(j)
        matches.append((i, j, round(s, 3)))
    return matches, [i for i in range(len(gt_rooms)) if i not in used_g], [j for j in range(len(pr_rooms)) if j not in used_p]


def num_eq(a, b, tol_abs=1.0) -> bool:
    try:
        return abs(float(a) - float(b)) <= tol_abs
    except (TypeError, ValueError):
        return False


def digits(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


# --------------------------------------------------------------------------- scoring

COST = {"add_room": 2.0, "remove_room": 1.0, "rename_room": 1.0, "retype_room": 1.0,
        "fix_room_dims": 1.0, "add_dim": 0.5, "remove_dim": 0.25, "fix_unit_field": 1.0}


def evaluate(gt: dict, pred: dict, label: str) -> dict:
    pr_rooms = []
    for r in pred.get("rooms") or []:
        pr_rooms.append({**r, "_group": group_of(r.get("name_he"), r.get("name_en"), r.get("type"))})
    gt_rooms = gt["rooms"]
    matches, gt_missing, pr_extra = match_rooms(gt_rooms, pr_rooms)

    rows, n_type_ok, n_name_exact, renames, retypes, dim_fix = [], 0, 0, 0, 0, 0
    for i, j, s in matches:
        g, p = gt_rooms[i], pr_rooms[j]
        type_ok = g["_group"] == p["_group"]
        name_exact = norm(g.get("name_he")) == norm(p.get("name_he"))
        n_type_ok += type_ok; n_name_exact += name_exact
        if not name_exact and name_sim(g.get("name_he"), p.get("name_he")) < 0.9:
            renames += 1
        if not type_ok:
            fam_g, fam_p = GROUP_FAMILY.get(g["_group"]), GROUP_FAMILY.get(p["_group"])
            same_family = fam_g is not None and fam_g == fam_p
            if not same_family:  # bathroom<->toilet, hall<->storage, balcony<->service: a human accepts, cost 0
                retypes += 1
        dims_state = "n/a"
        if g.get("printed_dims_cm"):
            if p.get("printed_dims_cm") and dims_match(g["printed_dims_cm"], p["printed_dims_cm"]):
                dims_state = "ok"
            else:
                dims_state = "wrong" if p.get("printed_dims_cm") else "missing"
                dim_fix += 1
        rows.append({"gt": g.get("name_he"), "pred": p.get("name_he"), "pred_en": p.get("name_en"), "score": s,
                     "type_ok": type_ok, "gt_group": g["_group"], "pred_group": p["_group"],
                     "gt_dims": g.get("printed_dims_cm"), "pred_dims": p.get("printed_dims_cm"), "dims": dims_state})

    n_gt_dims_rooms = sum(1 for g in gt_rooms if g.get("printed_dims_cm"))
    n_room_dims_ok = sum(1 for r in rows if r["dims"] == "ok")
    # rooms missing entirely also need their dims typed in
    dim_fix_missing = sum(1 for i in gt_missing if gt_rooms[i].get("printed_dims_cm"))

    # printed dimension numbers (bag match, each GT number consumed once)
    gt_nums = [float(x) for x in gt["printed_dimensions_cm"]]
    pr_nums = []
    for x in pred.get("printed_dimensions_cm") or []:
        try:
            pr_nums.append(float(x))
        except (TypeError, ValueError):
            pass
    remaining = list(gt_nums); hit = 0
    for x in pr_nums:
        for k, y in enumerate(remaining):
            if num_eq(x, y):
                hit += 1; remaining.pop(k); break
    dims_recall = hit / len(gt_nums) if gt_nums else None
    dims_precision = hit / len(pr_nums) if pr_nums else 0.0

    # unit fields
    gu, pu = gt["unit"], pred.get("unit") or {}
    unit_rows = {}
    for f in ("number", "area_m2", "terrace_m2", "floor"):
        if gu.get(f) is None:
            continue
        pv = pu.get(f)
        if f == "number":
            ok = digits(pv) == digits(gu[f]) and digits(gu[f]) != ""
        elif f == "floor":
            ok = num_eq(pv, gu[f], 0.0)
        else:
            ok = pv is not None and abs(float(pv) - float(gu[f])) <= 0.02 * float(gu[f])
        unit_rows[f] = {"gt": gu[f], "pred": pv, "ok": bool(ok)}
    unit_ok = sum(1 for v in unit_rows.values() if v["ok"])

    # openings (informative only: counts from a tour trace differ from what a drawing shows)
    po = pred.get("openings") or {}
    openings = {"gt_doors_in_trace": gt["openings"].get("doors"), "pred_doors": po.get("doors"),
                "pred_windows_or_glazing_runs": po.get("windows_or_glazing_runs")}

    cost = (COST["add_room"] * len(gt_missing) + COST["remove_room"] * len(pr_extra) +
            COST["rename_room"] * renames + COST["retype_room"] * retypes +
            COST["fix_room_dims"] * (dim_fix + dim_fix_missing) +
            COST["add_dim"] * len(remaining) + COST["remove_dim"] * (len(pr_nums) - hit) +
            COST["fix_unit_field"] * (len(unit_rows) - unit_ok))
    scratch = (COST["add_room"] * len(gt_rooms) + COST["fix_room_dims"] * n_gt_dims_rooms +
               COST["add_dim"] * len(gt_nums) + COST["fix_unit_field"] * len(unit_rows))
    edit_score = max(0.0, 1.0 - cost / scratch) if scratch else None

    n_m = len(matches)
    return {
        "label": label,
        "rooms": {
            "gt": len(gt_rooms), "pred": len(pr_rooms), "matched": n_m,
            "recall": round(n_m / len(gt_rooms), 3) if gt_rooms else None,
            "precision": round(n_m / len(pr_rooms), 3) if pr_rooms else 0.0,
            "f1": round(2 * n_m / (len(gt_rooms) + len(pr_rooms)), 3) if (gt_rooms or pr_rooms) else None,
            "type_accuracy": round(n_type_ok / n_m, 3) if n_m else None,
            "name_exact_rate": round(n_name_exact / n_m, 3) if n_m else None,
            "missing_gt": [gt_rooms[i].get("name_he") for i in gt_missing],
            "extra_pred": [pr_rooms[j].get("name_he") for j in pr_extra],
            "matches": rows,
        },
        "dims": {
            "gt_count": len(gt_nums), "pred_count": len(pr_nums), "hit": hit,
            "recall": round(dims_recall, 3) if dims_recall is not None else None,
            "precision": round(dims_precision, 3),
            "missed_values": remaining,
            "room_dims_rooms": n_gt_dims_rooms, "room_dims_correct": n_room_dims_ok,
        },
        "unit": {"correct": unit_ok, "total": len(unit_rows), "fields": unit_rows},
        "openings": openings,
        "edit_cost": {
            "total": round(cost, 2), "from_scratch": round(scratch, 2),
            "breakdown": {"rooms_to_add": len(gt_missing), "rooms_to_remove": len(pr_extra),
                          "rooms_to_rename": renames, "rooms_to_retype": retypes,
                          "room_dims_to_fix": dim_fix + dim_fix_missing,
                          "dim_values_to_add": len(remaining), "dim_values_to_remove": len(pr_nums) - hit,
                          "unit_fields_to_fix": len(unit_rows) - unit_ok},
            "weights": COST,
        },
        "edit_score": round(edit_score, 3) if edit_score is not None else None,
        "model_confidence": pred.get("confidence"),
    }


# --------------------------------------------------------------------------- reporting


def to_markdown(res: dict, gt: dict) -> str:
    r, d, u, e = res["rooms"], res["dims"], res["unit"], res["edit_cost"]
    L = [f"# Intake eval: `{res['label']}`", "",
         f"Ground truth: `{gt['source']['meta']}` + `{gt['source']['plan']}`", "",
         "| metric | value |", "|---|---|",
         f"| rooms recall / precision / F1 | {r['recall']} / {r['precision']} / {r['f1']} ({r['matched']} matched of {r['gt']} GT, {r['pred']} predicted) |",
         f"| type accuracy (matched) | {r['type_accuracy']} |",
         f"| Hebrew label read verbatim (matched) | {r['name_exact_rate']} |",
         f"| printed dims recall / precision | {d['recall']} / {d['precision']} ({d['hit']} of {d['gt_count']} GT values; {d['pred_count']} predicted) |",
         f"| room [w,d] within 3 % | {d['room_dims_correct']} / {d['room_dims_rooms']} |",
         f"| unit fields | {u['correct']} / {u['total']} |",
         f"| edit cost (lower is better) | {e['total']} (typing from scratch = {e['from_scratch']}) |",
         f"| edit score | {res['edit_score']} |",
         f"| model's own confidence | {res['model_confidence']} |", "",
         "## Room matching", "", "| GT (drawing) | predicted | score | type ok | GT dims | pred dims | dims |", "|---|---|---|---|---|---|---|"]
    for m in r["matches"]:
        L.append(f"| {m['gt']} | {m['pred']} ({m['pred_en']}) | {m['score']} | {'yes' if m['type_ok'] else 'no: ' + m['pred_group']} | {m['gt_dims']} | {m['pred_dims']} | {m['dims']} |")
    L += ["", f"Missing (must be added): {', '.join(r['missing_gt']) or '-'}",
          f"Invented (must be removed): {', '.join(x or '?' for x in r['extra_pred']) or '-'}", "",
          "## Printed dimensions", "", f"Missed values: {d['missed_values']}", "",
          "## Unit fields", "", "| field | GT | pred | ok |", "|---|---|---|---|"]
    for f, v in u["fields"].items():
        L.append(f"| {f} | {v['gt']} | {v['pred']} | {'yes' if v['ok'] else 'no'} |")
    L += ["", "## Edit-cost breakdown", "", "| item | count |", "|---|---|"]
    for k, v in e["breakdown"].items():
        L.append(f"| {k} | {v} |")
    L += ["", f"Openings (informative): {res['openings']}", ""]
    return "\n".join(L)


def comparison_table(results: list[dict]) -> str:
    L = ["| run | rooms R/P | type acc | dims recall | room dims ok | unit | edit cost | edit score | conf |",
         "|---|---|---|---|---|---|---|---|---|"]
    for r in results:
        L.append(f"| {r['label']} | {r['rooms']['recall']}/{r['rooms']['precision']} | {r['rooms']['type_accuracy']} | "
                 f"{r['dims']['recall']} | {r['dims']['room_dims_correct']}/{r['dims']['room_dims_rooms']} | "
                 f"{r['unit']['correct']}/{r['unit']['total']} | {r['edit_cost']['total']} | {r['edit_score']} | {r['model_confidence']} |")
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--unit", required=True, help="unit folder with meta.json (+ plan.json)")
    ap.add_argument("--pred", action="append", required=True, help="model output JSON (repeatable)")
    ap.add_argument("--label", action="append", default=[], help="label per --pred (default: file stem)")
    ap.add_argument("--out", help="write result JSON here (single --pred) or into this directory (several)")
    ap.add_argument("--md", help="write a markdown report here (single --pred) or into this directory (several)")
    a = ap.parse_args(argv)

    gt = load_ground_truth(a.unit)
    results = []
    for k, p in enumerate(a.pred):
        label = a.label[k] if k < len(a.label) else os.path.splitext(os.path.basename(p))[0]
        res = evaluate(gt, load_json_lenient(p), label)
        results.append(res)
        if a.out:
            dest = a.out if len(a.pred) == 1 else os.path.join(a.out, f"{label}.result.json")
            os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
            json.dump(res, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if a.md:
            dest = a.md if len(a.pred) == 1 else os.path.join(a.md, f"{label}.md")
            os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
            open(dest, "w", encoding="utf-8").write(to_markdown(res, gt))
    print(comparison_table(results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
