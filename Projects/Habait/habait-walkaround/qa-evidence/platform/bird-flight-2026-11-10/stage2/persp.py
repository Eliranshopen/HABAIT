# equirect panorama -> rectilinear view, the tour's maths (journey.js renderLanding). usage: persp.py <pano> <out> <yaw> <pitch> <hfov> [w h]
import sys, numpy as np, cv2
def view(src, yaw, pitch, hf, w=1280, h=720):
    ph, pw = src.shape[:2]
    tx = np.tan(np.radians(hf) / 2); ty = tx * h / w; cp, sp = np.cos(np.radians(pitch)), np.sin(np.radians(pitch))
    X = ((2 * (np.arange(w) + 0.5)) / w - 1) * tx; y = (1 - (2 * (np.arange(h) + 0.5)) / h) * ty
    X, y = np.meshgrid(X, y); Y = y * cp + sp; Z0 = cp - y * sp
    lon = np.arctan2(X, Z0) + np.radians(yaw); lat = np.arctan2(Y, np.hypot(X, Z0))
    u = (lon / (2 * np.pi) + 0.5) % 1.0
    mx = (u * pw - 0.5).astype(np.float32); my = np.clip((0.5 - lat / np.pi) * ph - 0.5, 0, ph - 1).astype(np.float32)
    return cv2.remap(src, mx, my, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_WRAP)
if __name__ == '__main__':
    a = sys.argv; src = cv2.imread(a[1], cv2.IMREAD_COLOR)
    if a[3] == 'sheet':
        tiles = []
        for yw in range(-180, 180, 45):
            t = view(src, yw, -2, 95, 640, 360); cv2.putText(t, str(yw), (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3); tiles.append(t)
        cv2.imwrite(a[2], np.vstack([np.hstack(tiles[:4]), np.hstack(tiles[4:])]))
    else:
        w, h = (int(a[6]), int(a[7])) if len(a) > 7 else (1280, 720)
        cv2.imwrite(a[2], view(src, float(a[3]), float(a[4]), float(a[5]), w, h))
