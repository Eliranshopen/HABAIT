"""sheet.py - contact sheet of the ring-B nodes: clay | skin (seam) | clay edges over the skin, + the node-b skin for colour. $0.
  python -X utf8 -I sheet.py  -> skins-extra/skins_sheet.jpg"""
import json, os
import cv2, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
W, H = 960, 480
rows = []
b = cv2.resize(cv2.imread("C:/Habait/habait-walkaround/Habait/tour360/apartments/apt846/_local/panos-ext/node-b-tower.seam.png"), (W, H))
cb = cv2.resize(cv2.imread("C:/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay-pano-ortho/node-b-tower.png"), (W, H))
cv2.putText(b, "node-b-tower (existing skin, colour reference)", (10, 30), 0, 0.8, (0, 0, 255), 2)
rows.append(np.hstack([cb, b, np.zeros_like(b)]))
for n in [x["id"] for x in json.load(open(HERE + "/nodes-extra.json", encoding="utf8"))["nodes"] if x["status"] == "new"]:
    sk = HERE + f"/{n}.seam.png"
    if not os.path.exists(sk):
        continue
    c = cv2.resize(cv2.imread(HERE + f"/clay-pano/{n}.png"), (W, H))
    s = cv2.resize(cv2.imread(sk), (W, H))
    e = cv2.Canny(cv2.cvtColor(c, cv2.COLOR_BGR2GRAY), 60, 160)
    o = s.copy(); o[e > 0] = (0, 0, 255)
    sc = json.load(open(HERE + f"/{n}.png.json", encoding="utf8"))["scores"]
    cv2.putText(s, f"{n}  edges kept up {sc['edges_kept_upper']} / low {sc['edges_kept_lower']}", (10, 30), 0, 0.8, (0, 0, 255), 2)
    rows.append(np.hstack([c, s, o]))
cv2.imwrite(HERE + "/skins_sheet.jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 82])
print("skins_sheet.jpg", len(rows) - 1, "nodes")
