"""orthophoto.py — a north-up satellite mosaic around a lat/lon from Esri World Imagery (key-free XYZ tiles), for the site
ground texture (2026-11-02, Eliran: "use Google Maps and anything on the internet so the visualization is as realistic as
possible"; Google tiles need a Maps key, Esri's do not).
  python -X utf8 -I tools/orthophoto.py --lat 32.1036 --lon 34.7848 --radius-m 1500 --zoom 18 --out derived/orthophoto.png
Writes <out> (RGB, north up) and <out>.json: metres per pixel (at the centre latitude), the extent in LOCAL metres (+X east,
+Y north around the origin) so a renderer can lay it on the ground plane. Esri terms: attribution "Esri, Maxar, Earthstar
Geographics, and the GIS User Community" (kept in the json)."""
import os, sys, json, math, argparse, io, time
import requests
import numpy as np
import cv2

ap = argparse.ArgumentParser()
ap.add_argument("--lat", type=float, required=True)
ap.add_argument("--lon", type=float, required=True)
ap.add_argument("--radius-m", type=float, default=1500)
ap.add_argument("--zoom", type=int, default=18)
ap.add_argument("--out", required=True)
a = ap.parse_args()

R = 6378137.0
def merc(lat, lon):
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
def tile_of(lat, lon, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y
n = 2 ** a.zoom
cx, cy = tile_of(a.lat, a.lon, a.zoom)
# metres per tile pixel at this latitude (256 px tiles)
m_per_px = 2 * math.pi * R * math.cos(math.radians(a.lat)) / (256 * n)
r_px = a.radius_m / m_per_px
x0, x1 = int(math.floor(cx - r_px / 256)), int(math.floor(cx + r_px / 256))
y0, y1 = int(math.floor(cy - r_px / 256)), int(math.floor(cy + r_px / 256))
W, H = (x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256
mosaic = np.zeros((H, W, 3), np.uint8)
s = requests.Session(); s.headers["User-Agent"] = "habait-studio/1.0 (site clay ground texture)"
done = 0; miss = 0
for ty in range(y0, y1 + 1):
    for tx in range(x0, x1 + 1):
        url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{a.zoom}/{ty}/{tx}"
        img = None
        for attempt in range(3):
            try:
                r = s.get(url, timeout=30)
                if r.status_code == 200:
                    img = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
                    break
            except Exception:
                time.sleep(1)
        if img is None or img.shape[0] != 256:
            miss += 1; continue
        mosaic[(ty - y0) * 256:(ty - y0 + 1) * 256, (tx - x0) * 256:(tx - x0 + 1) * 256] = img
        done += 1
# local metres of the mosaic corners around the origin (+X east, +Y north): mercator metres scaled by cos(lat) to ground metres
k = math.cos(math.radians(a.lat))
ox, oy = merc(a.lat, a.lon)
def px_to_local(px, py):
    gx = (x0 + px / 256) / n * 2 * math.pi * R - math.pi * R
    gy = math.pi * R - (y0 + py / 256) / n * 2 * math.pi * R
    return (gx - ox) * k, (gy - oy) * k
west, north = px_to_local(0, 0)
east, south = px_to_local(W, H)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
cv2.imwrite(a.out, mosaic)
meta = {"source": "Esri World Imagery (ArcGIS Online XYZ tiles)", "attribution": "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        "origin": {"lat": a.lat, "lon": a.lon}, "zoom": a.zoom, "tiles": [x0, y0, x1, y1], "tiles_ok": done, "tiles_missing": miss,
        "size_px": [W, H], "m_per_px": m_per_px, "local_extent_m": {"west": west, "east": east, "south": south, "north": north},
        "frame": "local metres around origin: +X east, +Y north; image row 0 = north edge, col 0 = west edge"}
json.dump(meta, open(a.out + ".json", "w", encoding="utf8"), indent=1)
print(f"{a.out}: {W}x{H} px, {m_per_px:.3f} m/px, {done} tiles ({miss} missing), local extent W {west:.0f} E {east:.0f} S {south:.0f} N {north:.0f}")
