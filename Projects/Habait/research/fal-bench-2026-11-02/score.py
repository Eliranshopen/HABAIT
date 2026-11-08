"""score.py - $0 metrics + contact sheets for the three benchmark tracks.

  python -X utf8 -I score.py A|B|C

A: kf_check.py (geometry lock vs the clay: whole-frame edges, by-class edges, best image shift) per output -> scores-A.json
C: edge retention vs the source pano (upper / lower half, the pano_floors.mjs metric) -> scores-C.json
B: per video: frames, size; edge agreement of frames 1 / 61 / 121 with the matching clay frames; a 3-frame strip -> scores-B.json
Also writes sheet-<track>.jpg (all outputs side by side, labelled).
"""
import glob
import json
import os
import subprocess
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
PY = sys.executable
PROJ = "C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv"
KF_CHECK = "C:/RnD/Projects/Habait/tools/bench/kf_check.py"
FONT = cv2.FONT_HERSHEY_SIMPLEX


def label(im, text, scale=0.9):
    im = im.copy()
    cv2.rectangle(im, (0, 0), (im.shape[1], 36), (0, 0, 0), -1)
    cv2.putText(im, text, (8, 26), FONT, scale, (255, 255, 255), 2, cv2.LINE_AA)
    return im


def grid(tiles, cols, w, h):
    rows = (len(tiles) + cols - 1) // cols
    sheet = np.zeros((rows * h, cols * w, 3), np.uint8)
    for i, t in enumerate(tiles):
        t = cv2.resize(t, (w, h))
        r, c = divmod(i, cols)
        sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = t
    return sheet


def edge_share(a, b):
    """share of a's Canny edges that lie within 3 px of one of b's edges (b resized to a)."""
    b = cv2.resize(b, (a.shape[1], a.shape[0]))
    e = lambda im: cv2.Canny(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), 60, 160)  # noqa: E731
    ea, eb = e(a), e(b)
    k = np.ones((7, 7), np.uint8)
    return float(((ea > 0) & (cv2.dilate(eb, k) > 0)).sum()) / max(1, float((ea > 0).sum()))


def ledger(track):
    p = f"{HERE}/ledger-{track}.json"
    rows = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else []
    out = {}
    for r in rows:
        name = os.path.basename(r["out"]).rsplit(".", 1)[0]
        if r.get("error") and name in out:
            continue
        out[name] = {"usd": 0 if r.get("error") else r.get("usd"), "secs": r.get("secs"), "error": r.get("error")}
    return out


def outputs(track, ext):
    d = {"A": "A-keyframe", "B": "B-flyover", "C": "C-pano"}[track]
    return sorted(glob.glob(f"{HERE}/{d}/*.{ext}"))


def score_a():
    clay = cv2.imread(f"{HERE}/inputs/A_clay_ext-enter.png")
    led = ledger("A")
    res = {}
    tiles = [label(clay, "CLAY input (ext-enter)")]
    for p in outputs("A", "png"):
        name = os.path.basename(p)[:-4]
        js = p + ".kfcheck.json"
        if not os.path.exists(js):
            subprocess.run([PY, "-X", "utf8", "-I", KF_CHECK, "--plan", f"{PROJ}/derived/plan.json", "--shot-dir",
                           f"{PROJ}/renders/clay/ext-enter", "--keyframe", p, "--json", js, "--sheet", p + ".kfcheck.png"],
                          capture_output=True, text=True, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        k = json.load(open(js, encoding="utf-8")) if os.path.exists(js) else {}
        im = cv2.imread(p)
        row = {"size": [im.shape[1], im.shape[0]], "edges": k.get("edges"), "by_class": k.get("by_class"),
               "best_shift": k.get("best_shift"), "verdict": k.get("verdict") or k.get("result"), **led.get(name, {})}
        res[name] = row
        bc = k.get("by_class") or {}
        walls = bc.get("walls", {}).get("share") if isinstance(bc.get("walls"), dict) else bc.get("walls")
        shift = (k.get("best_shift") or {}).get("deg") if isinstance(k.get("best_shift"), dict) else k.get("best_shift")
        tiles.append(label(im, f"{name}  walls {walls}  shift {shift}  ${row.get('usd')}  {row.get('secs')}s"))
    json.dump(res, open(f"{HERE}/scores-A.json", "w", encoding="utf-8"), indent=1)
    cv2.imwrite(f"{HERE}/sheet-A.jpg", grid(tiles, 3, 854, 480), [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(json.dumps(res, indent=1)[:4000])


def score_c():
    src = cv2.imread(f"{HERE}/inputs/C_pano_04-living_src.png")
    H = src.shape[0]
    led = ledger("C")
    res = {}
    tiles = [label(src, "SOURCE pano 04-living")]
    for p in outputs("C", "png"):
        name = os.path.basename(p)[:-4]
        im = cv2.imread(p)
        b = cv2.resize(im, (src.shape[1], src.shape[0]))
        up, lo = edge_share(src[:H // 2], b[:H // 2]), edge_share(src[H // 2:], b[H // 2:])
        res[name] = {"size": [im.shape[1], im.shape[0]], "edges_kept_upper": round(up, 3), "edges_kept_lower": round(lo, 3),
                     **led.get(name, {})}
        tiles.append(label(im, f"{name}  edges kept {up:.2f}/{lo:.2f}  ${res[name].get('usd')}  {res[name].get('secs')}s"))
    json.dump(res, open(f"{HERE}/scores-C.json", "w", encoding="utf-8"), indent=1)
    cv2.imwrite(f"{HERE}/sheet-C.jpg", grid(tiles, 2, 1024, 512), [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(json.dumps(res, indent=1))


def frames_of(path, idx):
    cap = cv2.VideoCapture(path)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w, h, fps = int(cap.get(3)), int(cap.get(4)), cap.get(5)
    out = []
    for i in idx:
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(i, max(0, n - 1)))
        ok, fr = cap.read()
        out.append(fr if ok else np.zeros((h or 720, w or 1280, 3), np.uint8))
    cap.release()
    return n, w, h, fps, out


def score_b():
    clay_dir = f"{PROJ}/renders/clay/ext-flight-s1"
    led = ledger("B")
    res = {}
    strips = []
    for p in outputs("B", "mp4"):
        name = os.path.basename(p)[:-4]
        n, w, h, fps, frs = frames_of(p, [0, 60, 120])
        # sample the clay at the same relative positions (the baseline has 137 frames, the clip 121)
        agree = []
        for fr, rel in zip(frs, [0, 0.5, 1.0]):
            ci = 1 + int(round(rel * (min(n, 121) - 1))) if n else 1
            clay = cv2.imread(f"{clay_dir}/frame_{ci:04d}.png")
            if clay is not None and fr is not None:
                # centre-crop the output to the clay aspect before comparing
                ar = clay.shape[1] / clay.shape[0]
                fh, fw = fr.shape[:2]
                if fw / fh > ar + 0.01:
                    nw = int(fh * ar); x0 = (fw - nw) // 2; fr = fr[:, x0:x0 + nw]
                elif fw / fh < ar - 0.01:
                    nh = int(fw / ar); y0 = (fh - nh) // 2; fr = fr[y0:y0 + nh]
                agree.append(round(edge_share(cv2.resize(clay, (960, 540)), cv2.resize(fr, (960, 540))), 3))
        res[name] = {"frames": n, "size": [w, h], "fps": round(fps, 2), "clay_edges_found_f1_mid_last": agree, **led.get(name, {})}
        tiles = [label(cv2.resize(f, (640, 360)), f"{name} f{i}" if j == 0 else f"f{i}", 0.7)
                 for j, (f, i) in enumerate(zip(frs, [1, 61, 121]))]
        strips.append(np.hstack(tiles))
    # the clay itself, for reference
    clay_frs = [cv2.imread(f"{clay_dir}/frame_{i:04d}.png") for i in (1, 61, 121)]
    strips.insert(0, np.hstack([label(cv2.resize(f, (640, 360)), f"CLAY f{i}", 0.7) for f, i in zip(clay_frs, (1, 61, 121))]))
    json.dump(res, open(f"{HERE}/scores-B.json", "w", encoding="utf-8"), indent=1)
    cv2.imwrite(f"{HERE}/sheet-B.jpg", np.vstack(strips), [cv2.IMWRITE_JPEG_QUALITY, 80])
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    {"A": score_a, "B": score_b, "C": score_c}[sys.argv[1]]()
