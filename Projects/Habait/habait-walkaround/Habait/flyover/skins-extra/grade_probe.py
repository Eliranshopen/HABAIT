"""grade_probe.py - image-level colour grade of each skin vs node-b-tower: median linear RGB of the sky band (v 0.12-0.40, sun
masked) and of the tower (pixels the clay draws as the light grey tower mass in the centre band u 0.40-0.60, v 0.05-0.62).
python -X utf8 -I grade_probe.py  (venv, $0)"""
import json, os
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
S2L = ((np.arange(256) / 255.0) ** 2.2).astype(np.float32)
STUDIO = "C:/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay-pano-ortho/"
bake = json.load(open(HERE + "/bake-nodes-v5.json", encoding="utf8"))["nodes"]


def stats(nid, skin):
    clay = STUDIO + nid + ".png" if os.path.exists(STUDIO + nid + ".png") else HERE + f"/clay-pano/{nid}.png"
    s = cv2.imread(skin)[..., ::-1]; H, W = s.shape[:2]
    c = cv2.resize(cv2.imread(clay)[..., ::-1], (W, H), interpolation=cv2.INTER_AREA)
    sl = S2L[s]
    sky = sl[int(.12 * H):int(.40 * H)].reshape(-1, 3)
    sky = sky[sky.sum(1) < 2.4]                                   # drop the sun
    hsv = cv2.cvtColor(c, cv2.COLOR_RGB2HSV)
    m = np.zeros((H, W), bool); m[int(.05 * H):int(.62 * H), int(.40 * W):int(.60 * W)] = True
    tower = m & (hsv[..., 1] < 40) & (hsv[..., 2] > 120)              # the clay tower: light, unsaturated (sky is saturated blue)
    tw = sl[tower]
    return np.median(sky, 0), np.median(tw, 0), int(tower.sum())


ref = [b for b in bake if b["id"] == "node-b-tower"][0]
rs, rt, _ = stats(ref["id"], ref["skin"])
print(f"{'node':16s} {'sky ratio b/node':>22s} {'tower ratio b/node':>22s} tower_px")
for b in bake:
    s, t, n = stats(b["id"], b["skin"])
    print(f"{b['id']:16s} {str(np.round(rs / s, 2)):>22s} {str(np.round(rt / t, 2)):>22s} {n}")
