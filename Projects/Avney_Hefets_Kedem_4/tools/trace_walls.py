"""trace_walls.py  -  sales-plan raster sheet -> wall grid (pixels).  $0, deterministic.

Usage: python -I trace_walls.py <sheet.jpg> <out_dir> [--xmax N]

The sheet draws every wall as one flat grey fill (RGB 121,121,121) inside a ~4 px black outline,
and every window as light blue. So:
  1. wall mask  = grey fill (opened 9x9 to drop text and furniture strokes) + the outline pixels touching it
  2. grid       = the x and y positions where wall edges run (clustered), cells = wall / not wall
  3. windows    = blue components
Outputs: wall_mask.png, grid.json (xs, ys, cells), windows.json, grid_diff.png (red/blue = grid vs mask).
The method (flat-colour segmentation of the wall fill) is the one proven on Kedma D/1 (hand/wall_probe.py);
this is a new implementation with no apartment-specific numbers in it.
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
WALL_GREY, TOL = 121, 6


def breaks(mask, axis, minlen=14, tol=4):
    d = np.abs(np.diff(mask.astype(np.int8), axis=axis))
    cnt = d.sum(axis=1 - axis)
    idx = np.where(cnt >= minlen)[0] + 1
    groups = []
    for i in idx:
        if groups and i - groups[-1][-1] <= tol:
            groups[-1].append(i)
        else:
            groups.append([i])
    out = []
    for gp in groups:
        w = np.array([cnt[i - 1] for i in gp], float)
        out.append(int(round((np.array(gp) * w).sum() / w.sum())))
    return out


def main():
    sheet, dst = sys.argv[1], sys.argv[2]
    xmax = int(sys.argv[sys.argv.index('--xmax') + 1]) if '--xmax' in sys.argv else None
    os.makedirs(dst, exist_ok=True)
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.int16)
    if xmax:
        rgb = rgb[:, :xmax]
    H, W, _ = rgb.shape
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    fill = (np.abs(r - WALL_GREY) <= TOL) & (np.abs(g - WALL_GREY) <= TOL) & (np.abs(b - WALL_GREY) <= TOL)
    fill = ndi.binary_opening(fill, structure=np.ones((9, 9), bool))
    lab, n = ndi.label(fill)
    sizes = ndi.sum(fill, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes > 1500
    fill = keep[lab]
    dark = (r < 100) & (g < 100) & (b < 100)
    near = ndi.binary_dilation(fill, structure=np.ones((3, 3), bool), iterations=5)
    wall = ndi.binary_closing(fill | (dark & near), structure=np.ones((3, 3), bool))
    Image.fromarray((wall * 255).astype(np.uint8)).save(os.path.join(dst, 'wall_mask.png'))

    xs, ys = breaks(wall, 1), breaks(wall, 0)
    cells = np.zeros((len(ys) - 1, len(xs) - 1), bool)
    frac = np.zeros(cells.shape)
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            sub = wall[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            frac[j, i] = sub.mean() if sub.size else 0
            cells[j, i] = frac[j, i] > 0.5
    amb = [(j, i, round(float(frac[j, i]), 2)) for j in range(cells.shape[0]) for i in range(cells.shape[1])
           if 0.15 < frac[j, i] < 0.85]
    rec = np.zeros_like(wall)
    for j in range(cells.shape[0]):
        for i in range(cells.shape[1]):
            if cells[j, i]:
                rec[ys[j]:ys[j + 1], xs[i]:xs[i + 1]] = True
    iou = float((rec & wall).sum() / max(1, (rec | wall).sum()))
    prev = np.full((H, W, 3), 255, np.uint8)
    prev[rec & wall] = (70, 70, 70)
    prev[rec & ~wall] = (255, 0, 0)
    prev[~rec & wall] = (0, 0, 255)

    blue = (b - r >= 18) & (b >= 200) & (g >= 180)
    blue = ndi.binary_opening(blue, structure=np.ones((3, 3), bool))
    lab2, n2 = ndi.label(ndi.binary_closing(blue, structure=np.ones((15, 15), bool)))
    wins = []
    for i, sl in enumerate(ndi.find_objects(lab2)):
        area = int((lab2[sl] == i + 1).sum())
        if area > 3000:
            wins.append(dict(x0=int(sl[1].start), x1=int(sl[1].stop), y0=int(sl[0].start), y1=int(sl[0].stop), area=area))
    prev[blue] = (0, 140, 255)
    Image.fromarray(prev).resize((W // 2, H // 2)).save(os.path.join(dst, 'grid_diff.png'))
    json.dump(dict(sheet=os.path.basename(sheet), size=[W, H], xs=xs, ys=ys, cells=cells.astype(int).tolist(),
                   iou=round(iou, 4), ambiguous_cells=amb), open(os.path.join(dst, 'grid.json'), 'w'))
    json.dump(wins, open(os.path.join(dst, 'windows.json'), 'w'), indent=1)
    print('size', W, H, '| wall px', int(wall.sum()), '| IoU grid vs mask', round(iou, 4), '| ambiguous', amb)
    print('xs', len(xs), xs)
    print('ys', len(ys), ys)
    for w_ in wins:
        print('window', w_)


main()
