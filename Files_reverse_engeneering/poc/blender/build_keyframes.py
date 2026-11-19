"""Render the Day/Night keyframes of one viewpoint: relight.py -> render_pano.py (reused read-only from the pipeline).

Dry run by default (prints the plan). `--run` executes. $0: local Blender only, no paid call.
Idempotent: a keyframe whose (source blend, preset, res, samples, point) key is already in the manifest with its
output on disk is skipped. Every step writes a manifest row: inputs, output sha256, seconds.

python -I build_keyframes.py --point cp-living --res 2048x1024 --samples 64 [--keys noon,night] [--tag preview] [--run]
"""
import argparse, hashlib, json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
POC = os.path.dirname(HERE)
BLENDER = r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
PIPE = r"C:\RnD\.wt\kedma-d1\Projects\3Dengine\pipeline\360walkaround"
SRC_BLEND = PIPE + r"\tours\kedma-d1\scene-full.blend"
PLAN = PIPE + r"\tours\kedma-d1\plan.json"
RENDER_PANO = PIPE + r"\pipeline\render_pano.py"


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--point', default='cp-living')
    ap.add_argument('--res', default='2048x1024')
    ap.add_argument('--samples', type=int, default=64)
    ap.add_argument('--keys', default=None)
    ap.add_argument('--tag', default='final')
    ap.add_argument('--presets', default=os.path.join(HERE, 'lighting_presets.json'))
    ap.add_argument('--blend', default=SRC_BLEND, help='source scene (never written)')
    ap.add_argument('--plan', default=PLAN, help='plan.json with camera_points')
    ap.add_argument('--render-pano', default=RENDER_PANO, help='the pipeline renderer (used read-only)')
    ap.add_argument('--out-root', default=os.path.join(POC, 'out'), help='outputs go to <out-root>/<tag>/')
    ap.add_argument('--blender', default=BLENDER)
    ap.add_argument('--run', action='store_true')
    ap.add_argument('--timeout', type=int, default=520, help='seconds per render before Blender is killed')
    a = ap.parse_args()

    presets = json.load(open(a.presets, encoding='utf-8'))
    keys = [k for k in presets['keyframes'] if a.keys is None or k['name'] in a.keys.split(',')]
    out_root = os.path.join(a.out_root, a.tag)
    man_path = os.path.join(out_root, 'manifest.json')
    man = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else {"rows": []}
    src_sha = sha(a.blend)[:16]
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    for k in keys:
        pkey = hashlib.sha256(json.dumps([src_sha, k, a.res, a.samples, a.point], sort_keys=True).encode()).hexdigest()[:16]
        vdir = os.path.join(out_root, a.point, k['name'])
        vblend = os.path.join(out_root, 'variants', f"{k['name']}.blend")
        pano = os.path.join(vdir, 'pano.webp')
        done = any(r.get('key') == pkey and r.get('step') == 'render' for r in man['rows']) and os.path.exists(pano)
        print(f"[{k['name']}] key={pkey} {'SKIP (done)' if done else ('RUN' if a.run else 'DRY')}")
        if done or not a.run:
            continue
        t0 = time.time()
        cmd = [a.blender, '-b', '--factory-startup', a.blend, '-P', os.path.join(HERE, 'relight.py'), '--',
               '--presets', a.presets, '--key', k['name'], '--out', vblend]
        p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env, timeout=600)
        line = next((l for l in p.stdout.splitlines() if l.startswith('RELIGHT_OK ')), None)
        if p.returncode != 0 or line is None or not os.path.exists(vblend):
            sys.stderr.write(p.stdout[-2000:] + p.stderr[-2000:]); sys.exit(f"relight failed for {k['name']}")
        man['rows'].append({"step": "relight", "key": pkey, "keyframe": k['name'], "inputs": {"source": a.blend, "source_sha16": src_sha},
                            "report": json.loads(line[len('RELIGHT_OK '):]), "seconds": round(time.time() - t0, 1), "cost_usd": 0})
        t1 = time.time()
        os.makedirs(vdir, exist_ok=True)
        cmd = [a.blender, '-b', '--factory-startup', '-P', a.render_pano, '--', '--blend', vblend, '--plan', a.plan,
               '--point', a.point, '--out-dir', vdir, '--res', a.res, '--samples', str(a.samples), '--seed', '0',
               '--device', 'AUTO', '--also-png', '--manifest', os.path.join(vdir, 'render-manifest.json')]
        try:  # the machine rule: a render chunk stays under 540 s; subprocess.run kills Blender itself on timeout
            p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env, timeout=a.timeout)
        except subprocess.TimeoutExpired:
            sys.exit(f"render of {k['name']} exceeded {a.timeout}s; Blender killed; lower --samples/--res")
        if p.returncode != 0 or not os.path.exists(pano):  # exit 0 alone is not proof (pipeline ENV note)
            sys.stderr.write(p.stdout[-3000:] + p.stderr[-2000:]); sys.exit(f"render failed for {k['name']}")
        depth = os.path.join(vdir, 'depth.png')
        man['rows'].append({"step": "render", "key": pkey, "keyframe": k['name'], "hour": k['hour'], "point": a.point,
                            "res": a.res, "samples": a.samples, "pano": os.path.relpath(pano, a.out_root), "pano_sha16": sha(pano)[:16],
                            "depth_sha16": sha(depth)[:16] if os.path.exists(depth) else None,
                            "seconds": round(time.time() - t1, 1), "cost_usd": 0})
        os.makedirs(out_root, exist_ok=True)
        json.dump(man, open(man_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
        print(f"  done in {time.time() - t0:.0f}s -> {pano}")
    if a.run:
        json.dump(man, open(man_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
