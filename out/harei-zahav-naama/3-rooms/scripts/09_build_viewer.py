"""Step 09 - build the local 360 viewer (viewer/index.html) from the rendered panoramas.

Every panorama in panoramas/*.jpg with a camera in scene/build-report.json becomes a scene; every other
panorama is a hotspot (arrow) at its true bearing, computed from the two camera positions.
Yaw convention (checked on the living-room render): yaw 0 = image centre = plan +u (toward the deck),
positive yaw = toward plan +v (plan bottom). Eye level is kept: pitch limited to +-35 degrees (Eliran's rule:
a look tilted down reads as a security camera), first look wide (hfov 110).
Usage: python 09_build_viewer.py <job root>
"""
import json
import math
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1])
rep = json.loads((root / "scene" / "build-report.json").read_text(encoding="utf-8"))
panos = {k: v for k, v in rep["panos"].items() if (root / "panoramas" / f"{k}.jpg").exists()}
NAMES = {
    "pano_living": ("סלון", "Living room"), "pano_kitchen": ("מטבח ופינת אוכל", "Kitchen & dining"),
    "pano_entrance": ("כניסה", "Entrance"), "pano_hall": ("מבואה", "Hall"), "pano_bedroom": ("חדר שינה", "Bedroom"),
    "pano_saferoom": ('ממ"ד', "Safe room"), "pano_bath": ("חדר רחצה", "Bathroom"), "pano_deck": ("דק", "Deck"),
}
FIRST = {"pano_living": 0, "pano_kitchen": 180, "pano_entrance": 30, "pano_hall": -90, "pano_bedroom": 20,
         "pano_saferoom": -40, "pano_bath": -100, "pano_deck": 180}
# which scene can see which (doors and openings on the plan), so arrows never point through a wall
LINKS = {
    "pano_living": ["pano_kitchen", "pano_entrance", "pano_deck", "pano_hall"],
    "pano_kitchen": ["pano_living", "pano_entrance"],
    "pano_entrance": ["pano_living", "pano_kitchen", "pano_hall"],
    "pano_hall": ["pano_entrance", "pano_bedroom", "pano_saferoom", "pano_bath", "pano_living"],
    "pano_bedroom": ["pano_hall"], "pano_saferoom": ["pano_hall"], "pano_bath": ["pano_hall"],
    "pano_deck": ["pano_living"],
}
scenes = {}
for k, (u, v) in panos.items():
    hs = []
    for t in LINKS.get(k, []):
        if t not in panos:
            continue
        tu, tv = panos[t]
        yaw = math.degrees(math.atan2(tv - v, tu - u))
        dist = math.hypot(tu - u, tv - v) / 100
        hs.append({"pitch": -max(8.0, min(28.0, math.degrees(math.atan2(1.55, dist)))), "yaw": round(yaw, 1),
                   "type": "scene", "sceneId": t, "text": f"{NAMES[t][0]} · {NAMES[t][1]}", "cssClass": "hz-arrow"})
    scenes[k] = {"title": f"{NAMES[k][0]} · {NAMES[k][1]}", "panorama": f"../panoramas/{k}.jpg", "type": "equirectangular",
                 "yaw": FIRST.get(k, 0), "pitch": 0, "hfov": 110, "minHfov": 50, "maxHfov": 120,
                 "minPitch": -35, "maxPitch": 35, "hotSpots": hs}
first = "pano_living" if "pano_living" in panos else next(iter(panos))
cfg = {"default": {"firstScene": first, "sceneFadeDuration": 600, "autoLoad": True, "showControls": True,
                   "compass": False, "hfov": 110}, "scenes": scenes}
buttons = "".join(f'<button data-s="{k}">{NAMES[k][0]}<small>{NAMES[k][1]}</small></button>' for k in panos)
html = f"""<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>דגם חצב · 360</title>
<link rel="stylesheet" href="vendor/pannellum-2.5.6.css">
<style>
:root{{--ink:#1d1d1b;--paper:#f6f3ee;--accent:#b8875a}}
html,body{{margin:0;height:100%;background:#111;font-family:system-ui,"Segoe UI",Arial,sans-serif}}
#pano{{position:fixed;inset:0}}
.badge{{position:fixed;top:12px;inset-inline-start:12px;z-index:5;background:rgba(20,20,18,.72);color:#fff;
 padding:6px 10px;border-radius:8px;font-size:13px;line-height:1.3}}
.badge b{{display:block;font-size:15px}}
.disc{{position:fixed;bottom:76px;inset-inline-start:12px;z-index:5;color:#fff;background:rgba(20,20,18,.6);
 font-size:11px;padding:4px 8px;border-radius:6px;max-width:min(560px,80vw)}}
nav{{position:fixed;bottom:0;left:0;right:0;z-index:5;display:flex;gap:6px;overflow-x:auto;padding:10px 12px;
 background:linear-gradient(transparent,rgba(0,0,0,.55));scrollbar-width:none}}
nav button{{flex:0 0 auto;border:0;border-radius:10px;padding:8px 12px;min-height:44px;background:rgba(246,243,238,.88);
 color:var(--ink);font:600 14px/1.1 inherit;cursor:pointer}}
nav button small{{display:block;font-weight:400;font-size:11px;opacity:.7}}
nav button.on{{background:var(--accent);color:#fff}}
.hz-arrow{{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:pointer}}
.hz-arrow::after{{content:"";position:absolute;left:14px;top:12px;border:9px solid transparent;border-bottom:14px solid var(--ink);border-top:0}}
.hz-arrow span{{visibility:hidden;position:absolute;bottom:52px;left:50%;transform:translateX(-50%);white-space:nowrap;
 background:rgba(20,20,18,.85);color:#fff;padding:4px 8px;border-radius:6px;font-size:12px}}
.hz-arrow:hover span{{visibility:visible}}
</style></head><body>
<div id="pano"></div>
<div class="badge"><b>הדמיה · Visualization</b>דגם חצב · 3 חדרים · 80 מ"ר · מושב נעמה</div>
<div class="disc">הדמיה ממוחשבת על בסיס תכנית המכר. ריהוט, חומרים ותאורה להמחשה בלבד; גבהים הונחו (לא מופיעים בתכנית).</div>
<nav id="nav">{buttons}</nav>
<script src="vendor/pannellum-2.5.6.js"></script>
<script>
const cfg = {json.dumps(cfg, ensure_ascii=False)};
const v = pannellum.viewer('pano', cfg);
const nav = document.getElementById('nav');
function mark(id){{for(const b of nav.children)b.classList.toggle('on',b.dataset.s===id);}}
nav.addEventListener('click',e=>{{const b=e.target.closest('button');if(b)v.loadScene(b.dataset.s);}});
v.on('scenechange',mark); mark(cfg.default.firstScene);
window.__viewer = v;
</script></body></html>"""
(root / "viewer" / "index.html").write_text(html, encoding="utf-8")
(root / "viewer" / "serve.cmd").write_text(
    '@echo off\r\nrem Serves the job folder on http://127.0.0.1:8893/viewer/ (WebGL cannot read panoramas from file://)\r\n'
    'cd /d "%~dp0.."\r\nstart "" http://127.0.0.1:8893/viewer/\r\npython -m http.server 8893 --bind 127.0.0.1\r\n', encoding="utf-8")
print("viewer:", len(scenes), "scenes;", sum(len(s["hotSpots"]) for s in scenes.values()), "arrows")
