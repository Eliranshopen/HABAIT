#!/usr/bin/env python3
"""The Habait brand files from Eliran's vector original (brand/habait-logo.svg, 130.943×80.892, all fills #051F6E; Eliran 2026-11-09:
«HABAIT … הבית זאת בעצם החברה שבנתה את זה והמיתוג יהיה»). Geometry is never changed — only:
  * optimised: the empty <line id="Line_130"> (no stroke, renders nothing) dropped; the huge translate offsets normalised (rects get
    plain x/y, the paths share one small group translate), so the viewBox reads 0 0 130.943 80.892 cleanly;
  * colour variants by swapping the one fill: navy #051F6E (on light), white #FFFFFF and sand #EDE3D3 (on dark);
  * a wordmark-only variant (HABAIT + the roof line) without the tagline group (Path_87–99 «הבית של כל הבתים», Rectangle_426/428);
  * a favicon mark: the H's two stems and the roof line from the same geometry, white on navy, slightly thickened for 32 px.
usage: python tools/make_brand.py          dry run
       python tools/make_brand.py --go     writes brand/*.svg + brand/manifest.json rows ($0)
"""
import hashlib, json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.join(os.path.dirname(HERE), 'brand')
SRC = os.path.join(BRAND, 'habait-logo.svg')
NAVY, WHITE, SAND = '#051F6E', '#FFFFFF', '#EDE3D3'
GX, GY = -19628.357, 5909.867                      # the outer group's translate
TAG = {f'Path_{n}' for n in range(87, 100)} | {'Rectangle_426', 'Rectangle_428'}
H_ONLY = {'Rectangle_413', 'Rectangle_414', 'Rectangle_436'}

def parse(svg):
    els = []
    for m in re.finditer(r'<(rect|path|line)\b([^>]*)>', svg):
        tag, attrs = m.group(1), m.group(2)
        a = dict(re.findall(r'([\w:-]+)="([^"]*)"', attrs))
        els.append((tag, a))
    return els

def tr(a):
    m = re.match(r'translate\(([-\d.]+)[ ,]+([-\d.]+)\)(?:\s*rotate\(([-\d.]+)\))?', a.get('transform', ''))
    return (float(m.group(1)), float(m.group(2)), m.group(3)) if m else (0.0, 0.0, None)

import struct
def f32(v): return struct.unpack('f', struct.pack('f', v))[0]
def r6(v):  # the summed offset exactly as the renderer computes it (float32 matrices: f32(element) + f32(group)) -> pixel-identical
    return repr(f32(v))

def build(fill, keep=lambda i: True, view='0 0 130.943 80.892', title='Habait — הבית של כל הבתים', stroke=0):
    rects, paths = [], []
    for tag, a in parse(open(SRC, encoding='utf-8').read()):
        i = a.get('id', '')
        if tag == 'line' or not keep(i): continue                  # Line_130: no stroke → renders nothing
        tx, ty, rot = tr(a)
        if tag == 'rect':
            x, y = f32(f32(tx) + f32(GX)), f32(f32(ty) + f32(GY))
            if rot: rects.append(f'<rect width="{a["width"]}" height="{a["height"]}" transform="translate({r6(x)} {r6(y)}) rotate({rot})"/>')
            else: rects.append(f'<rect x="{r6(x)}" y="{r6(y)}" width="{a["width"]}" height="{a["height"]}"/>')
        else:
            paths.append((f32(f32(tx) + f32(GX)), f32(f32(ty) + f32(GY)), a['d']))
    offs = {(r6(x), r6(y)) for x, y, _ in paths}
    assert len(offs) <= 1, offs                                   # every path carried the same translate in the source
    g = ''
    if paths:
        ox, oy = offs.pop()
        g = f'<g transform="translate({ox} {oy})">' + ''.join(f'<path d="{d}"/>' for _, _, d in paths) + '</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="Habait"><title>{title}</title>'
            f'<g fill="{fill}"' + (f' stroke="{fill}" stroke-width="{stroke}" stroke-linejoin="miter"' if stroke else '') + f'>{"".join(rects)}{g}</g></svg>\n')

def mark():
    # the H (two stems) + the roof from the same geometry, clipped to a square, thickened by a same-colour stroke for 32 px
    inner = build(WHITE, keep=lambda i: i in H_ONLY)
    body = re.search(r'<g fill="#FFFFFF">(.*)</g></svg>', inner).group(1)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-17.6 14.1 64 64" role="img" aria-label="Habait"><title>Habait</title>'
            f'<defs><clipPath id="c"><rect x="-17.6" y="14.1" width="64" height="64" rx="12"/></clipPath></defs>'
            f'<rect x="-17.6" y="14.1" width="64" height="64" rx="12" fill="{NAVY}"/>'
            f'<g clip-path="url(#c)" fill="{WHITE}" stroke="{WHITE}" stroke-width="1.6">{body}</g></svg>\n')

WORD_VIEW = '0 0 130.943 67.6'   # the letters end at y 67.447; the tagline group (from y 74.5) is dropped
FILES = {
    'habait-logo-navy.svg': lambda: build(NAVY),
    'habait-logo-white.svg': lambda: build(WHITE),
    'habait-logo-sand.svg': lambda: build(SAND),
    'habait-wordmark-navy.svg': lambda: build(NAVY, keep=lambda i: i not in TAG, view=WORD_VIEW, title='Habait'),
    'habait-wordmark-white.svg': lambda: build(WHITE, keep=lambda i: i not in TAG, view=WORD_VIEW, title='Habait'),
    'habait-wordmark-sand.svg': lambda: build(SAND, keep=lambda i: i not in TAG, view=WORD_VIEW, title='Habait'),
    # small placements (headers 24–36 px high): the same geometry with a same-colour hairline stroke so the thin lines stay ≥ 1 px
    'habait-wordmark-navy-small.svg': lambda: build(NAVY, keep=lambda i: i not in TAG, view=WORD_VIEW, title='Habait', stroke=0.9),
    'habait-wordmark-white-small.svg': lambda: build(WHITE, keep=lambda i: i not in TAG, view=WORD_VIEW, title='Habait', stroke=0.9),
    'habait-wordmark-sand-small.svg': lambda: build(SAND, keep=lambda i: i not in TAG, view=WORD_VIEW, title='Habait', stroke=0.9),
    'habait-mark.svg': mark,
}

def main():
    go = '--go' in sys.argv
    src_sha = hashlib.sha256(open(SRC, 'rb').read()).hexdigest()
    mp = os.path.join(BRAND, 'manifest.json')
    rows = {'habait-logo.svg': {'output': 'habait-logo.svg', 'bytes': os.path.getsize(SRC), 'sha256': src_sha,
             'source': 'Eliran 2026-11-09 (original vector, received via the coordinator), copied verbatim', 'cost_usd': 0, 'ai_generated': False}}
    for name, fn in FILES.items():
        data = fn().encode('utf-8')
        print(('write ' if go else 'dry: ') + name, len(data), 'bytes')
        if go:
            open(os.path.join(BRAND, name), 'wb').write(data)
            rows[name] = {'output': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'input': 'habait-logo.svg', 'input_sha256': src_sha,
                          'tool': 'tools/make_brand.py (fill swap / tagline group dropped / offsets normalised; geometry unchanged)', 'cost_usd': 0,
                          'ai_generated': False, 'at': datetime.datetime.now().isoformat(timespec='seconds')}
    if go:
        json.dump({'schema': 'habait.media-manifest.v0', 'note': 'the Habait brand (plan 2026-11-08-rainbow-landing, round 9)', 'rows': [rows[k] for k in sorted(rows)]},
                  open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('manifest:', mp)

if __name__ == '__main__':
    main()
