"""contact_sheet.py - rows = views, cols = clay / projected (1 projector) / projected (all projectors) / coverage mask.
Also writes sanity.jpg (keyframe vs re-projection from the keyframe's own camera) and pixel_coverage.json
(from the cov renders: R = seen by projector 1, G = seen by another projector, B = tower pixel).

  python -I contact_sheet.py --renders renders [--views orig,az-30,az+30,az+60,low] [--keyframe <png>]
"""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("--renders", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "renders"))
ap.add_argument("--views", default="orig,az-30,az+30,az+60,low")
ap.add_argument("--cols", default="clay,proj1,proj2,cov")
ap.add_argument("--keyframe", default="C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/keyframes/morning/ext-approach.png")
ap.add_argument("--cell", type=int, default=480)
ap.add_argument("--out", default="contact.jpg")
ap.add_argument("--t1", default="projected: 1 keyframe (approach)")
ap.add_argument("--t2", default="projected: 2 keyframes (approach+facade)")
ap.add_argument("--tc", default="coverage  R=approach G=facade grey=unseen")
ap.add_argument("--sanity-view", default="orig")
a = ap.parse_args()

R = a.renders
views = a.views.split(",")
cols = a.cols.split(",")
titles = {"clay": "clay", "proj1": a.t1, "proj2": a.t2, "cov": a.tc}
with open(os.path.join(R, "views.json"), "r", encoding="utf-8") as f:
    vdefs = {v["name"]: v for v in json.load(f)["views"]}
try:
    font = ImageFont.truetype("arial.ttf", 16)
    font_b = ImageFont.truetype("arialbd.ttf", 18)
except Exception:
    font = font_b = ImageFont.load_default()

cw = a.cell
ch = int(cw * 9 / 16)
pad, head, left = 6, 30, 150
sheet = Image.new("RGB", (left + len(cols) * (cw + pad), head + len(views) * (ch + pad)), (24, 24, 24))
d = ImageDraw.Draw(sheet)
for j, c in enumerate(cols):
    d.text((left + j * (cw + pad) + 4, 6), titles.get(c, c), fill=(230, 230, 230), font=font_b)
pix = {}
for i, v in enumerate(views):
    y = head + i * (ch + pad)
    vd = vdefs.get(v, {})
    label = v if v != "orig" else "orig (keyframe cam)"
    d.text((6, y + 6), label, fill=(255, 255, 255), font=font_b)
    if "azimuth_offset_deg" in vd:
        d.text((6, y + 30), f"az {vd['azimuth_offset_deg']:+.0f} deg", fill=(200, 200, 200), font=font)
    if vd.get("note"):
        for k, line in enumerate(vd["note"].split(": ")):
            d.text((6, y + 54 + 20 * k), line, fill=(200, 200, 200), font=font)
    for j, c in enumerate(cols):
        p = os.path.join(R, f"{v}__{c}.png")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGB")
        if c == "cov":
            # paint the mask readable: unseen tower = grey, approach = red, facade = green, both = yellow
            px = im.load()
            W, H = im.size
            n = {"tower": 0, "p1": 0, "p2": 0, "any": 0}
            out = Image.new("RGB", im.size, (0, 0, 0))
            op = out.load()
            for yy in range(H):
                for xx in range(W):
                    r, g, b = px[xx, yy]
                    if b > 100:
                        n["tower"] += 1
                        s1, s2 = r > 100, g > 100
                        n["p1"] += s1
                        n["p2"] += s2
                        n["any"] += s1 or s2
                        op[xx, yy] = (230, 200, 40) if (s1 and s2) else (220, 60, 50) if s1 else (60, 190, 80) if s2 else (120, 120, 120)
            pix[v] = {"tower_px": n["tower"], "seen_by_approach": round(n["p1"] / max(n["tower"], 1), 3),
                      "seen_by_facade": round(n["p2"] / max(n["tower"], 1), 3), "seen_by_any": round(n["any"] / max(n["tower"], 1), 3)}
            im = out
            d2 = ImageDraw.Draw(im)
            d2.text((8, im.size[1] - 26), f"painted: {pix[v]['seen_by_approach']:.0%} (first) / {pix[v]['seen_by_any']:.0%} (all) of tower pixels", fill=(255, 255, 255), font=font)
        im = im.resize((cw, ch), Image.LANCZOS)
        sheet.paste(im, (left + j * (cw + pad), y))
sheet.save(os.path.join(R, a.out), quality=88)
print("wrote", os.path.join(R, a.out))

# orbit coverage (480x270 cov renders) -> share of tower pixels painted, per azimuth
orbit = {}
for fn in sorted(os.listdir(R)):
    if fn.startswith("orbit") and fn.endswith("__cov.png"):
        im = Image.open(os.path.join(R, fn)).convert("RGB")
        px = im.load()
        W, H = im.size
        t = p1 = anyc = 0
        for yy in range(H):
            for xx in range(W):
                r, g, b = px[xx, yy]
                if b > 100:
                    t += 1
                    p1 += r > 100
                    anyc += (r > 100) or (g > 100)
        name = fn.split("__")[0]
        orbit[name] = {"az_deg": vdefs.get(name, {}).get("azimuth_offset_deg"), "seen_by_approach": round(p1 / max(t, 1), 3), "seen_by_any": round(anyc / max(t, 1), 3)}
with open(os.path.join(R, "pixel_coverage.json"), "w", encoding="utf-8") as f:
    json.dump({"views": pix, "orbit": orbit}, f, indent=1)
print(json.dumps({"views": pix, "orbit": orbit}, indent=1))

# sanity: keyframe vs projected render from the same camera
if os.path.exists(a.keyframe) and os.path.exists(os.path.join(R, f"{a.sanity_view}__proj1.png")):
    kf = Image.open(a.keyframe).convert("RGB")
    pr = Image.open(os.path.join(R, f"{a.sanity_view}__proj1.png")).convert("RGB")
    if kf.size[0] == kf.size[1]:
        ch = cw
    kf = kf.resize((cw, ch), Image.LANCZOS)
    pr = pr.resize((cw, ch), Image.LANCZOS)
    s = Image.new("RGB", (2 * cw + pad, ch + head), (24, 24, 24))
    s.paste(kf, (0, head))
    s.paste(pr, (cw + pad, head))
    dd = ImageDraw.Draw(s)
    dd.text((6, 6), "GPT skin: " + os.path.basename(a.keyframe) + " (the projector image)", fill=(230, 230, 230), font=font_b)
    dd.text((cw + pad + 6, 6), "re-projected onto tower-mass.obj, rendered from the same camera", fill=(230, 230, 230), font=font_b)
    s.save(os.path.join(R, "sanity.jpg"), quality=88)
    print("wrote", os.path.join(R, "sanity.jpg"))
