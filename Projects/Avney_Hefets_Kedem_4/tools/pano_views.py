"""pano_views.py - cut an equirect panorama into overlapping perspective views, and stitch enhanced views back (2026-11-18, the 360 version).
  cut:    python -I pano_views.py cut <pano.png> <dir>            -> <dir>/v_<name>.png (1536 px, 100 deg) + views.json
  stitch: python -I pano_views.py stitch <pano.png> <dir> <out>  -> blends <dir>/e_<name>.jpg over the panorama (feathered by angle
          from each view's centre); where no enhanced view covers a pixel (the ceiling) the render stays. Output 4096 x 2048.
Views: four sides (yaw 0/90/180/270, pitch -8) and one down (pitch -90). A side view is 100 deg so neighbours overlap by 10 deg."""
import sys, os, json, math
import numpy as np
from PIL import Image

# v2 (2026-11-18): 8 narrower views every 45 deg (80 deg wide, 35 deg overlap); the wide 100-deg views and the straight-down one
# were reframed by the model (furniture moved, invented). Ceiling and the floor under the camera stay the clean render.
VIEWS = [(f'y{a:03d}', a, -10) for a in range(0, 360, 45)]
FOV, SZ = 80.0, 1536
GATE = 0.55   # edge-alignment score below which an enhanced view is not used


def rot(yaw, pitch):
    y, p = math.radians(yaw), math.radians(pitch)
    Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    return Ry @ Rx


def dirs_to_equi(d, W, H):
    lon = np.arctan2(d[..., 0], d[..., 2]); lat = np.arcsin(np.clip(d[..., 1], -1, 1))
    return (lon / (2 * math.pi) + 0.5) * W, (0.5 - lat / math.pi) * H


def sample(img, u, v):
    H, W = img.shape[:2]; u = np.mod(u, W); v = np.clip(v, 0, H - 1)
    x0 = np.floor(u).astype(int); y0 = np.floor(v).astype(int); x1 = (x0 + 1) % W; y1 = np.clip(y0 + 1, 0, H - 1); fx = (u - x0)[..., None]; fy = (v - y0)[..., None]
    return img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy) + img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy


def cut(pano, d):
    os.makedirs(d, exist_ok=True); img = np.asarray(Image.open(pano).convert('RGB')).astype(np.float32); H, W = img.shape[:2]
    f = (SZ / 2) / math.tan(math.radians(FOV / 2)); ys, xs = np.mgrid[0:SZ, 0:SZ]
    cam = np.stack([(xs - SZ / 2 + 0.5) / f, -(ys - SZ / 2 + 0.5) / f, np.ones_like(xs, dtype=np.float64)], -1); cam /= np.linalg.norm(cam, axis=-1, keepdims=True)
    for name, yaw, pitch in VIEWS:
        dd = cam @ rot(yaw, pitch).T; u, v = dirs_to_equi(dd, W, H)
        Image.fromarray(np.clip(sample(img, u, v), 0, 255).astype(np.uint8)).save(os.path.join(d, f'v_{name}.png'))
    json.dump({'views': VIEWS, 'fov': FOV, 'size': SZ}, open(os.path.join(d, 'views.json'), 'w')); print('cut', len(VIEWS))


def edges(p):
    from PIL import ImageFilter
    a = np.asarray(Image.open(p).convert('L').resize((256, 256)).filter(ImageFilter.GaussianBlur(1.5)), np.float64)
    e = np.abs(np.diff(a, axis=1))[:-1] + np.abs(np.diff(a, axis=0))[:, :-1]; return (e - e.mean()) / (e.std() + 1e-6)


def score(d):
    sc = {}
    for name, _, _ in VIEWS:
        e = os.path.join(d, f'e_{name}.jpg')
        if os.path.exists(e):
            sc[name] = round(float((edges(os.path.join(d, f'v_{name}.png')) * edges(e)).mean()), 3)
    json.dump(sc, open(os.path.join(d, 'scores.json'), 'w'), indent=1); print('scores', sc); return sc


def stitch(pano, d, out, OW=4096):
    sc = score(d)
    base = np.asarray(Image.open(pano).convert('RGB').resize((OW, OW // 2), Image.LANCZOS)).astype(np.float32); H, W = base.shape[:2]
    ys, xs = np.mgrid[0:H, 0:W]; lon = (xs + 0.5) / W * 2 * math.pi - math.pi; lat = math.pi / 2 - (ys + 0.5) / H * math.pi
    dw = np.stack([np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)], -1)
    acc = np.zeros_like(base); wsum = np.zeros((H, W, 1), np.float32); f = (SZ / 2) / math.tan(math.radians(FOV / 2))
    for name, yaw, pitch in VIEWS:
        p = os.path.join(d, f'e_{name}.jpg')
        if not os.path.exists(p) or sc.get(name, 0) < GATE:
            continue
        e = np.asarray(Image.open(p).convert('RGB').resize((SZ, SZ), Image.LANCZOS)).astype(np.float32)
        dc = dw @ rot(yaw, pitch)   # world -> camera
        z = dc[..., 2]; ok = z > 1e-3
        px = dc[..., 0] / np.where(ok, z, 1) * f + SZ / 2 - 0.5; py = -dc[..., 1] / np.where(ok, z, 1) * f + SZ / 2 - 0.5
        inside = ok & (px >= 0) & (px <= SZ - 1) & (py >= 0) & (py <= SZ - 1)
        # feather: weight falls to 0 at the view's border (in normalised image coordinates)
        nx = np.abs(px / (SZ - 1) * 2 - 1); ny = np.abs(py / (SZ - 1) * 2 - 1); w = np.clip((1 - np.maximum(nx, ny)) / 0.18, 0, 1) ** 2 * inside
        col = sample(e, np.clip(px, 0, SZ - 1), np.clip(py, 0, SZ - 1))
        acc += col * w[..., None]; wsum += w[..., None]
    cover = np.clip(wsum, 0, 1); res = np.where(wsum > 1e-4, acc / np.maximum(wsum, 1e-4), base)
    res = res * cover + base * (1 - cover)
    Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(out, quality=92); print('stitched', out)


if __name__ == '__main__':
    if sys.argv[1] == 'cut':
        cut(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'score':
        score(sys.argv[2])
    else:
        stitch(sys.argv[2], sys.argv[3], sys.argv[4])
