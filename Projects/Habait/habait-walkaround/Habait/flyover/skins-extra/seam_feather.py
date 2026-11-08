"""seam_feather.py — close the wrap seam of an equirect by low-frequency feathering (free, no model call).
  python tools/seam_feather.py <in.png> <out.png> [--band 320]
A whole-image edit of a 360 pano (GPT 2.5) keeps the layout but its left and right edges often differ in tone (sun side vs shade
side); the step shows as a vertical line behind the viewer. Per row, the edge difference d = right_edge - left_edge (blurred
vertically) is split: the left band gets +d/2 fading to 0 across --band px, the right band -d/2. Structure is untouched, only
the colour step goes. Prints the edge diff before/after (mean |L-R| over 4 px columns, the number ext_nodes.mjs logs)."""
import sys, cv2, numpy as np

args = sys.argv[1:]
src, dst = args[0], args[1]
band = int(args[args.index("--band") + 1]) if "--band" in args else 320
im = cv2.imread(src, cv2.IMREAD_COLOR).astype(np.float32)
H, W = im.shape[:2]
k = 8  # edge sample width
L = im[:, :k].mean(axis=1); R = im[:, -k:].mean(axis=1)  # (H,3)
d = cv2.GaussianBlur((R - L).reshape(H, 1, 3), (1, 0), sigmaX=0, sigmaY=H / 60.0).reshape(H, 3)
ramp = (1.0 - np.arange(band, dtype=np.float32) / band)  # 1 at the edge → 0 inside
before = float(np.abs(im[:, :4] - im[:, -4:]).mean())
im[:, :band] += (d[:, None, :] * 0.5) * ramp[None, :, None]
im[:, W - band:] -= (d[:, None, :] * 0.5) * ramp[None, ::-1, None]
after = float(np.abs(im[:, :4] - im[:, -4:]).mean())
cv2.imwrite(dst, np.clip(im, 0, 255).astype(np.uint8))
print(f"seam diff {before:.1f} -> {after:.1f} ({dst})")
