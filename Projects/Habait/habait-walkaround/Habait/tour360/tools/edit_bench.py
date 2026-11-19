#!/usr/bin/env python3
# Habait Tour360 — tools/edit_bench.py (2026-11-16, plan development/plans/2026-11-16-typed-change-all-tabs.md §4 B2).
# Eliran: «מתוך המודלים הקיימים ב-FAL צריך למצוא מודל יותר מהיר ממה שעובד כרגע».
#
# The editor speed bench: the SAME views and the handler's own instructions (tools/edit-bench-cases.mjs) through every candidate fal
# edit model, a few runs each. Per call it records the wall seconds from request to picture, whether the editor held the frame (the
# page's own border-ring test, viewer/edit-live.js ringShare after its colour fit), how much of the view changed, and the picture.
# The numbers decide the speed; the eye decides the quality (REPORT.md lists every picture).
#
# Script contract (root CLAUDE.md §5): DRY by default — prints the cells and the estimate, sends nothing. The paid path only with
# --go under --cap; every call is written to the ledger BEFORE it is sent and settled after; a rerun skips every cell that already
# has a result (never re-billed); any failure exits non-zero with the reason on stderr.
# Keys by NAME only: FAL_KEY from the environment, or from the one line of that name in the keys file — the nearest `.env` above
# this script (the project's, else C:\RnD\.env), or --env-file. Never printed, never stored. `--key-check` says present / missing
# and where it looked, nothing else.
#
#   python tools/edit_bench.py --out <dir>                         # dry: the plan and the estimate
#   python tools/edit_bench.py --out <dir> --go --cap 5 [--runs 2] [--models klein-9b,nb2-1k] [--cases people,follow]
#   python tools/edit_bench.py --out <dir> --report                # rewrite REPORT.md from results.json ($0)
# exit 0 ok · 1 a call failed or the cap stopped the run · 2 usage · 3 no key
import argparse, base64, io, json, os, statistics, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
INPUTS = HERE / 'bench-inputs' / 'edit-speed'
W, H = 1264, 848  # the view the page cuts (edit-live.js CROP_W × CROP_H)
SIZE = {'width': W, 'height': H}

# The candidates. Endpoint ids and input fields were read from fal's public endpoint descriptions on 2026-11-16
# (https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>, no key). `usd` is what the ledger BOOKS per call, from fal's own
# price list read with the key on 2026-11-16 (`--prices`): kontext 0.04 and nb2 0.08 an image; seedream5-lite 0.035, grok 0.02 an
# image; klein-9b 0.011 and klein-4b 0.010 a megapixel; flash 0.005, turbo 0.008, flux2-pro 0.03 a PROCESSED megapixel. A
# per-megapixel model is booked on the high side: two input views and the output of a follow turn (2.85 MP), for every call.
# `multi` = takes a second image.
MODELS = {
    # in use today (server/handler.mjs MODELS)
    'kontext':    {'endpoint': 'fal-ai/flux-pro/kontext', 'usd': 0.04, 'multi': False, 'today': 'furniture and décor',
                   'body': lambda p, ims: {'prompt': p, 'image_url': ims[0], 'num_images': 1, 'output_format': 'jpeg', 'guidance_scale': 3.5, 'safety_tolerance': '2', 'sync_mode': True}},
    'nb2-1k':     {'endpoint': 'fal-ai/nano-banana-2/edit', 'usd': 0.08, 'multi': True, 'today': 'people and pets; the catalog',
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'aspect_ratio': 'auto', 'resolution': '1K', 'num_images': 1, 'output_format': 'jpeg', 'sync_mode': True}},
    # candidates
    'nb2-0.5k':   {'endpoint': 'fal-ai/nano-banana-2/edit', 'usd': 0.08, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'aspect_ratio': 'auto', 'resolution': '0.5K', 'num_images': 1, 'output_format': 'jpeg', 'sync_mode': True}},
    'klein-9b':   {'endpoint': 'fal-ai/flux-2/klein/9b/edit', 'usd': 0.035, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'image_size': SIZE, 'num_inference_steps': 4, 'num_images': 1, 'output_format': 'jpeg', 'sync_mode': True}},
    'klein-4b':   {'endpoint': 'fal-ai/flux-2/klein/4b/edit', 'usd': 0.03, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'image_size': SIZE, 'num_inference_steps': 4, 'num_images': 1, 'output_format': 'jpeg', 'sync_mode': True}},
    'flux2-flash': {'endpoint': 'fal-ai/flux-2/flash/edit', 'usd': 0.015, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'image_size': SIZE, 'num_images': 1, 'output_format': 'jpeg', 'enable_prompt_expansion': False, 'sync_mode': True}},
    'flux2-turbo': {'endpoint': 'fal-ai/flux-2/turbo/edit', 'usd': 0.025, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'image_size': SIZE, 'num_images': 1, 'output_format': 'jpeg', 'enable_prompt_expansion': False, 'sync_mode': True}},
    'flux2-pro':  {'endpoint': 'fal-ai/flux-2-pro/edit', 'usd': 0.09, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'image_size': 'auto', 'output_format': 'jpeg', 'safety_tolerance': '2', 'sync_mode': True}},
    'seedream5-lite': {'endpoint': 'fal-ai/bytedance/seedream/v5/lite/edit', 'usd': 0.035, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'num_images': 1, 'output_format': 'jpeg', 'sync_mode': True}},
    'grok':       {'endpoint': 'xai/grok-imagine-image/edit', 'usd': 0.03, 'multi': True,
                   'body': lambda p, ims: {'prompt': p, 'image_urls': ims, 'resolution': '1k', 'aspect_ratio': 'auto', 'num_images': 1, 'output_format': 'jpeg', 'sync_mode': True}},
}
RING_HELD = 0.15  # the page's RING_SOFT: under it the frame held


def fail(code, msg):
    print('edit_bench: ' + msg, file=sys.stderr)
    sys.exit(code)


def env_files():
    """The keys files above this script, nearest first: the project's own `habait-walkaround/.env` when it is on disk, then the
    harness's C:\\RnD\\.env (Eliran, 2026-11-16: «קובץ ENV»)."""
    return [str(p / '.env') for p in HERE.parents if (p / '.env').is_file()]


def key_from(env_file):
    """→ (the key, where it came from). The environment wins; then the first keys file with a filled FAL_KEY line. Never printed."""
    k = os.environ.get('FAL_KEY', '').strip()
    if k:
        return k, 'the environment'
    files = [env_file] if env_file else env_files()
    for f in files:
        if not Path(f).is_file():
            continue
        for line in Path(f).read_text(encoding='utf-8-sig', errors='replace').splitlines():
            if line.strip().startswith('FAL_KEY='):
                v = line.split('=', 1)[1].strip().strip('"').strip("'")
                if v:
                    return v, f
    return '', ('looked in: ' + ', '.join(files) if files else 'no keys file found above this script')


def data_url(jpeg_bytes):
    return 'data:image/jpeg;base64,' + base64.b64encode(jpeg_bytes).decode('ascii')


def ring_metrics(crop_jpeg, result_bytes):
    """The page's frame test (edit-live.js): the result resized to the view, colour-fitted on the border ring, then the share of the
    ring (half resolution, 20 px) that differs by more than 22; and the share of the whole view that changed."""
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(io.BytesIO(result_bytes)).convert('RGB').resize((W, H), Image.LANCZOS), dtype=np.float32)
    b = np.asarray(Image.open(io.BytesIO(crop_jpeg)).convert('RGB').resize((W, H), Image.LANCZOS), dtype=np.float32)
    ring = 40
    m = np.ones((H, W), dtype=bool)
    m[ring:H - ring, ring:W - ring] = False
    for c in range(3):  # colourFit: a gain and an offset per channel, fitted on the ring, clamped as the page clamps them
        x, y = a[..., c][m][::3], b[..., c][m][::3]
        n = x.size
        den = n * float((x * x).sum()) - float(x.sum()) ** 2
        gain = (n * float((x * y).sum()) - float(x.sum()) * float(y.sum())) / den if den else 1.0
        off = (float(y.sum()) - gain * float(x.sum())) / n if n else 0.0
        gain, off = max(0.85, min(1.15, gain)), max(-24.0, min(24.0, off))
        a[..., c] = np.clip(a[..., c] * gain + off, 0, 255)
    half = lambda im: np.asarray(Image.fromarray(im.astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR), dtype=np.int16)
    d = np.abs(half(a) - half(b)).max(axis=2) > 22
    r = ring // 2
    hm = np.ones(d.shape, dtype=bool)
    hm[r:d.shape[0] - r, r:d.shape[1] - r] = False
    return round(float(d[hm].mean()), 3), round(float(d.mean()), 3)


def call(endpoint, body, key, timeout):
    req = urllib.request.Request('https://fal.run/' + endpoint, data=json.dumps(body).encode('utf-8'), method='POST',
                                 headers={'Authorization': 'Key ' + key, 'Content-Type': 'application/json'})
    t0 = time.monotonic()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        doc = json.loads(r.read().decode('utf-8'))
    img = (doc.get('images') or [{}])[0]
    url = img.get('url') or ''
    if url.startswith('data:'):
        raw = base64.b64decode(url.split(',', 1)[1])
    elif url:
        with urllib.request.urlopen(url, timeout=120) as r2:
            raw = r2.read()
    else:
        raise RuntimeError('the editor returned no image')
    return raw, round(time.monotonic() - t0, 2), [img.get('width'), img.get('height')]


def report(out, results, cases):
    rows = []
    by = {}
    for r in results:
        if r.get('status') == 'ok':
            by.setdefault((r['case'], r['model']), []).append(r)
    lines = ['# Editor speed bench — the typed change', '',
             f'Written {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")} UTC by `tools/edit_bench.py` from `results.json`. Seconds are wall time from the request to the picture in hand (fal.run, `sync_mode`). '
             f'"held" = the page\'s border-ring test under {RING_HELD} (the frame did not move). The pictures are beside this file: `<case>/<model>-run<n>.jpg`. Speed is measured here; quality is the eye\'s call.', '']
    for c in cases:
        cur = c.get('current_model')
        base = statistics.median([r['seconds'] for r in by.get((c['id'], cur), [])]) if by.get((c['id'], cur)) else None
        lines += [f'## {c["id"]} ({c["kind"]})' + (f' — today: `{cur}`' + (f', median {base:.1f} s' if base else ', not measured') if cur else ''), '',
                  '| model | runs | median s | min–max s | vs today | held | changed share | booked $/call |', '|---|---|---|---|---|---|---|---|']
        got = sorted(((m, rs) for (cid, m), rs in by.items() if cid == c['id']), key=lambda t: statistics.median([r['seconds'] for r in t[1]]))
        for m, rs in got:
            secs = [r['seconds'] for r in rs]
            med = statistics.median(secs)
            held = sum(1 for r in rs if r['ring'] is not None and r['ring'] < RING_HELD)
            lines.append(f'| `{m}`{" (today)" if m == cur else ""} | {len(rs)} | {med:.1f} | {min(secs):.1f}–{max(secs):.1f} | {("%.1fx" % (base / med)) if base and med else "—"} | {held}/{len(rs)} | {statistics.median([r["changed"] for r in rs if r["changed"] is not None] or [0]):.2f} | {MODELS[m]["usd"]:.3f}{" est" if MODELS[m].get("est") else ""} |')
            rows.append(m)
        bad = [r for r in results if r['case'] == c['id'] and r.get('status') != 'ok']
        if bad:
            lines += ['', 'Not measured: ' + '; '.join(f'`{r["model"]}` run {r["run"]}: {r.get("status")} {str(r.get("error", ""))[:140]}' for r in bad)]
        lines.append('')
    (out / 'REPORT.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return len(rows)


def main():
    ap = argparse.ArgumentParser(description='The editor speed bench of the typed change (dry by default).')
    ap.add_argument('--out', default='')
    ap.add_argument('--prices', action='store_true', help="read fal's own price of every candidate endpoint (a free read with the key); writes pricing.json when --out is given")
    ap.add_argument('--key-check', action='store_true', help='say whether FAL_KEY is present and where it was looked for; never the value or its length')
    ap.add_argument('--go', action='store_true', help='send the paid calls')
    ap.add_argument('--cap', type=float, default=0.0, help='the most this run may book, in USD (required with --go)')
    ap.add_argument('--runs', type=int, default=2)
    ap.add_argument('--models', default=','.join(MODELS))
    ap.add_argument('--cases', default='')
    ap.add_argument('--env-file', default='')
    ap.add_argument('--timeout', type=int, default=240)
    ap.add_argument('--report', action='store_true', help='only rewrite REPORT.md from results.json')
    a = ap.parse_args()

    if a.key_check:
        k, where = key_from(a.env_file)
        print(f'FAL_KEY: {"present" if k else "missing"} ({where})')
        return 0 if k else 3
    if a.prices:
        # fal's own price list for every candidate endpoint: a free, authenticated read ($0). It also says whether the key is accepted.
        k, where = key_from(a.env_file)
        if not k:
            fail(3, f'no FAL_KEY ({where})')
        got, bad = {}, 0
        for m in [x for x in a.models.split(',') if x in MODELS]:
            ep = MODELS[m]['endpoint']
            if ep in got:
                continue
            req = urllib.request.Request('https://api.fal.ai/v1/models/pricing?' + urllib.parse.urlencode({'endpoint_id': ep}), headers={'Authorization': 'Key ' + k})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    got[ep] = json.loads(r.read().decode('utf-8'))
            except urllib.error.HTTPError as e:
                got[ep] = {'error': f'HTTP {e.code}', 'body': e.read().decode('utf-8', 'replace')[:200]}; bad += 1
            except Exception as e:
                got[ep] = {'error': str(e)[:200]}; bad += 1
            print(f'  {ep}: {json.dumps(got[ep])[:260]}')
        if a.out:
            Path(a.out).mkdir(parents=True, exist_ok=True)
            (Path(a.out) / 'pricing.json').write_text(json.dumps({'read': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'prices': got}, indent=1) + '\n', encoding='utf-8')
        return 1 if bad else 0
    if not a.out:
        fail(2, '--out <dir> is required')
    out = Path(a.out)
    cases_file = INPUTS / 'cases.json'
    if not cases_file.is_file():
        fail(2, f'no {cases_file} — run: node tools/edit-bench-cases.mjs')
    cases = json.loads(cases_file.read_text(encoding='utf-8'))['cases']
    if a.cases:
        cases = [c for c in cases if c['id'] in a.cases.split(',')]
    models = [m for m in a.models.split(',') if m]
    unknown = [m for m in models if m not in MODELS]
    if unknown or not cases or a.runs < 1 or a.runs > 5:
        fail(2, f'unknown model {unknown}' if unknown else 'no case selected, or --runs outside 1–5')
    for c in cases:
        for f in c['images']:
            if not (INPUTS / f).is_file():
                fail(2, f'input view missing: {INPUTS / f}')

    out.mkdir(parents=True, exist_ok=True)
    res_file, led_file = out / 'results.json', out / 'ledger.json'
    results = json.loads(res_file.read_text(encoding='utf-8')) if res_file.is_file() else []
    ledger = json.loads(led_file.read_text(encoding='utf-8')) if led_file.is_file() else []
    if a.report:
        n = report(out, results, cases)
        print(f'edit_bench: REPORT.md rewritten ({n} model rows)')
        return 0
    done = {(r['case'], r['model'], r['run']) for r in results if r.get('status') == 'ok'}

    cells = []
    for c in cases:  # the follow case last: its second image is the people case's result
        for m in models:
            if c['kind'] == 'follow' and not MODELS[m]['multi']:
                continue
            for run in range(1, a.runs + 1):
                if (c['id'], m, run) not in done:
                    cells.append((c, m, run))
    est = round(sum(MODELS[m]['usd'] for _, m, _ in cells), 3)
    booked = round(sum(float(r.get('settled_usd') if r.get('settled_usd') is not None else r.get('reserved_usd', 0)) for r in ledger), 3)
    print(f'edit_bench: {len(cells)} calls to send ({len(done)} already measured) · this run books ${est:.2f} · the ledger holds ${booked:.2f}')
    for c in cases:
        ms = [m for cc, m, _ in cells if cc is c]
        print(f'  {c["id"]:7} {len(ms):3} calls: ' + ', '.join(sorted(set(ms), key=models.index)))
    if not a.go:
        print('edit_bench: dry run — nothing sent. Add --go --cap <usd> to run it.')
        return 0
    if a.cap <= 0:
        fail(2, '--go needs --cap <usd>')
    # the cap is for this --out folder's whole ledger, every earlier run included: a bench sent in several runs cannot outgrow it
    if booked + est > a.cap + 1e-9:
        fail(1, f'the ledger holds ${booked:.2f} and this run would book ${est:.2f}: over the cap ${a.cap:.2f}. Fewer --models, --cases or --runs, or a higher cap')
    key, where = key_from(a.env_file)
    if not key:
        fail(3, f'no FAL_KEY in the environment or in the keys file ({where}): the bench cannot send a call')

    save = lambda: (res_file.write_text(json.dumps(results, indent=1) + '\n', encoding='utf-8'), led_file.write_text(json.dumps(ledger, indent=1) + '\n', encoding='utf-8'))
    spent, bad = 0.0, 0
    for c, m, run in cells:
        mod = MODELS[m]
        if booked + spent + mod['usd'] > a.cap + 1e-9:
            save(); report(out, results, cases)
            fail(1, f'the cap ${a.cap:.2f} stopped the run: the ledger holds ${booked + spent:.2f}')
        view = (INPUTS / c['images'][0]).read_bytes()
        ims = [data_url(view)]
        if c['kind'] == 'follow':
            ref = c['reference_from']
            ref_file = out / ref['case'] / f'{ref["model"]}-run{ref["run"]}.jpg'
            if not ref_file.is_file():
                results.append({'case': c['id'], 'model': m, 'run': run, 'status': 'skipped', 'error': f'the reference picture {ref_file.name} of case {ref["case"]} is not there (run that case with {ref["model"]} first)'})
                bad += 1
                continue
            from PIL import Image
            im = Image.open(ref_file).convert('RGB')
            im.thumbnail((1024, 1024), Image.LANCZOS)  # what the page sends: at most 1024 wide
            buf = io.BytesIO(); im.save(buf, 'JPEG', quality=85)
            ims.append(data_url(buf.getvalue()))
        row = {'ts': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'op': 'edit_bench', 'case': c['id'], 'model': m, 'endpoint': mod['endpoint'], 'run': run, 'reserved_usd': mod['usd'], 'settled_usd': None, 'status': 'reserved'}
        ledger.append(row); save()  # booked BEFORE the call
        try:
            raw, seconds, size = call(mod['endpoint'], mod['body'](c['prompt'], ims), key, a.timeout)
            (out / c['id']).mkdir(exist_ok=True)
            (out / c['id'] / f'{m}-run{run}.jpg').write_bytes(raw)
            ring, changed = ring_metrics(view, raw)
            row.update(settled_usd=mod['usd'], status='settled', seconds=seconds)
            results.append({'case': c['id'], 'model': m, 'endpoint': mod['endpoint'], 'run': run, 'status': 'ok', 'seconds': seconds, 'ring': ring, 'changed': changed, 'size': size, 'bytes': len(raw), 'file': f'{c["id"]}/{m}-run{run}.jpg'})
            print(f'  {c["id"]:7} {m:15} run {run}: {seconds:6.1f} s · ring {ring:.3f} {"held" if ring < RING_HELD else "MOVED"} · changed {changed:.2f}')
        except urllib.error.HTTPError as e:
            text = e.read().decode('utf-8', 'replace')[:300]
            # a refused request is not billed by fal; anything else stays booked at the reserve (the high side)
            row.update(settled_usd=0.0 if e.code in (400, 401, 403, 404, 422) else mod['usd'], status='failed', error=f'HTTP {e.code}')
            results.append({'case': c['id'], 'model': m, 'run': run, 'status': f'HTTP {e.code}', 'error': text})
            print(f'  {c["id"]:7} {m:15} run {run}: HTTP {e.code} {text[:120]}', file=sys.stderr)
            bad += 1
            if e.code in (401, 403):
                save(); report(out, results, cases)
                fail(1, f'fal refused the key or the account (HTTP {e.code}): stopped, nothing more sent')
        except Exception as e:  # a timeout or a lost answer: the call may have been billed
            row.update(settled_usd=mod['usd'], status='unknown', error=str(e)[:200])
            results.append({'case': c['id'], 'model': m, 'run': run, 'status': 'error', 'error': str(e)[:200]})
            print(f'  {c["id"]:7} {m:15} run {run}: {str(e)[:160]}', file=sys.stderr)
            bad += 1
        spent += float(row['settled_usd'])
        save()
    n = report(out, results, cases)
    print(f'edit_bench: this run booked ${spent:.2f}; the ledger holds ${booked + spent:.2f} of the ${a.cap:.2f} cap · {n} model rows in {out / "REPORT.md"}' + (f' · {bad} calls not measured' if bad else ''))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
