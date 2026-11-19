"""kedma-d1: a viewpoint that still shows its 2026-11-16 picture says so in its name, in the tour itself (2026-11-17).

Why: Eliran reviewed the local tour while only the kitchen was redone and found fault after fault in the other viewpoints - all of
them the old pictures that are being replaced. He should not have to guess which picture is which.

usage: python mark_old.py <apartment dir> --redone kitchen[,living,...]      idempotent; re-run after the runner's `scenes` step
"""
import argparse
import io
import json

ap = argparse.ArgumentParser(); ap.add_argument("apt"); ap.add_argument("--redone", default="")
a = ap.parse_args()
redone = {s for s in a.redone.split(",") if s}
TAG = {"he": " · תמונה ישנה, תוחלף", "en": " · old picture, to be replaced", "fr": " · ancienne image"}
p = a.apt + "/scenes.json"
raw = io.open(p, encoding="utf-8", newline="").read()
doc = json.loads(raw)
n = 0
for s in doc["scenes"]:
    for lang, tag in TAG.items():
        name = (s.get("name") or {}).get(lang)
        if name is None:
            continue
        base = name.split(" · ")[0]
        s["name"][lang] = base if s["id"] in redone else base + tag
    n += s["id"] not in redone
out = json.dumps(doc, ensure_ascii=False, indent=1) + "\n"
io.open(p, "w", encoding="utf-8", newline="").write(out.replace("\n", "\r\n") if "\r\n" in raw else out)
print(f"{n} viewpoints marked as old pictures; redone: {sorted(redone)}")
