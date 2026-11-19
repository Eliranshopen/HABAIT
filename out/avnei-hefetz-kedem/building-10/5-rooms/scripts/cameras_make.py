"""Camera points ($0), read on the sheet in native px and converted with the geometry's own scale. Eye level 1.60 m.
yaw_deg: 0 = looking toward sheet-up (+y), positive = turning left (counter-clockwise seen from above)."""
import json, sys
from pathlib import Path
root = Path(sys.argv[1]); g = json.loads((root / "geometry" / "geometry.json").read_text(encoding="utf-8"))
S = g["meta"]["px_per_cm"]; X0, Y0 = g["meta"]["origin_px"]
m = lambda px, py: (round((px - X0) / S / 100, 3), round((Y0 - py) / S / 100, 3))
P = [("pano_living", 1300, 1530, -15, "living + dining + kitchen opening + balcony slider"),
     ("pano_parents", 2600, 1045, -55, "parents bedroom"),
     ("pano_kitchen", 905, 1210, 85, "kitchen"),
     ("pano_mamad", 2500, 1490, -90, "bedroom / safe room"),
     ("pano_bedA", 1672, 2350, 180, "bedroom 265/380"),
     ("pano_bedB", 2400, 2615, -90, "bedroom 325/270"),
     ("pano_bath", 2340, 2150, -95, "main bathroom")]
S_ = [("still_hero_living", 1060, 1930, -38, 15, 1.45, -4, "hero: living and balcony from the entrance corner"),
      ("still_kitchen", 1150, 1500, 75, 16, 1.45, -6, "kitchen from the living room"),
      ("still_parents", 2420, 1080, -55, 15, 1.45, -6, "parents bedroom from the door")]
out = {"eye_m": 1.6, "panoramas": [], "stills": []}
for i, px, py, yaw, what in P:
    x, y = m(px, py); out["panoramas"].append({"id": i, "x": x, "y": y, "z": 1.6, "yaw_deg": yaw, "px": [px, py], "what": what})
for i, px, py, yaw, lens, z, pitch, what in S_:
    x, y = m(px, py); out["stills"].append({"id": i, "x": x, "y": y, "z": z, "yaw_deg": yaw, "lens_mm": lens, "pitch_deg": pitch, "px": [px, py], "what": what})
(root / "geometry" / "cameras.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
print(json.dumps(out)[:600])
