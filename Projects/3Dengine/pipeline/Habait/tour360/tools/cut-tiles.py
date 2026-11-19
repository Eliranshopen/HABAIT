"""Cut an apartment's full-resolution equirect set into PSV EquirectangularTilesAdapter tiles (board habait-walkaround T08).

    timeout 540 python Habait/tour360/tools/cut-tiles.py demo-01 [--src DIR] [--cols 8] [--quality 88]

Reads <src>/<asset>.webp (default: apartments/<id>/_local/full/, falling back to the MAIN checkout's copy — a worktree has no
untracked files), writes apartments/<id>/_local/tiles/<asset>/<col>_<row>.webp plus tiles.json (width, cols, rows, tile size,
the source's SHA-256 — a rerun skips a room whose source hash is unchanged). Read-only toward the source; nothing committed.
The tile size must divide the width exactly: 7096 / 8 = 887 (rows = cols / 2)."""
import argparse, hashlib, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TOUR = os.path.dirname(HERE)
MAIN_TOUR = r'D:\AgentTeams\RealEstateTeam\Habait\tour360'

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('apartment'); ap.add_argument('--src'); ap.add_argument('--cols', type=int, default=8); ap.add_argument('--quality', type=int, default=88)
    a = ap.parse_args()
    src = a.src or os.path.join(TOUR, 'apartments', a.apartment, '_local', 'full')
    if not os.path.isdir(src):
        src = os.path.join(MAIN_TOUR, 'apartments', a.apartment, '_local', 'full')
    if not os.path.isdir(src): sys.exit(f'no full set at {src}')
    out = os.path.join(TOUR, 'apartments', a.apartment, '_local', 'tiles')
    os.makedirs(out, exist_ok=True)
    man_p = os.path.join(out, 'tiles.json')
    man = json.load(open(man_p, encoding='utf-8')) if os.path.exists(man_p) else {'rooms': {}}
    cols, rows = a.cols, a.cols // 2
    for name in sorted(os.listdir(src)):
        if not name.endswith('.webp'): continue
        asset = name[:-5]; p = os.path.join(src, name); h = sha(p)
        if man['rooms'].get(asset, {}).get('sourceSha256') == h and os.path.isdir(os.path.join(out, asset)):
            print(f'{asset}: unchanged, skipped'); continue
        im = Image.open(p).convert('RGB'); W, H = im.size
        if W % cols or H % rows or W != 2 * H: sys.exit(f'{asset}: {W}x{H} does not tile into {cols}x{rows}')
        tw, th = W // cols, H // rows
        d = os.path.join(out, asset); os.makedirs(d, exist_ok=True)
        total = 0
        for r in range(rows):
            for c in range(cols):
                tp = os.path.join(d, f'{c}_{r}.webp')
                im.crop((c * tw, r * th, (c + 1) * tw, (r + 1) * th)).save(tp, 'WEBP', quality=a.quality, method=4)
                total += os.path.getsize(tp)
        man['rooms'][asset] = {'width': W, 'cols': cols, 'rows': rows, 'tile': tw, 'quality': a.quality, 'bytes': total, 'sourceSha256': h}
        print(f'{asset}: {cols}x{rows} tiles of {tw}px, {total/1e6:.1f} MB')
    man.update({'apartment': a.apartment, 'source': src})
    json.dump(man, open(man_p, 'w', encoding='utf-8'), indent=1)
    print('ok', len(man['rooms']), 'rooms')

if __name__ == '__main__':
    main()
