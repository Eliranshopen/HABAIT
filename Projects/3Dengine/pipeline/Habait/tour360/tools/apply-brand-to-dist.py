#!/usr/bin/env python3
"""Carry the place card's brand element from viewer/template.html into a BUILT tour (dist/<id>/index.html) without a full rebuild.
Round 9 (2026-11-09): Eliran's Habait wordmark replaced the text «Habait»; then (Eliran 2026-11-09: «הלוגו הוא של החברה שיצרה את העמוד
נחיתה ואת כל הסרטון וההדמיה») the wordmark carries a credit line, «הדמיה ואתר:» / "Visualization & site by", so Habait reads as the maker.
It replaces exactly ONE brand element (the old text one, or any earlier wordmark version) with the template's, and the brand CSS with
tour.css's `brand-credit` block; it refuses otherwise. The next build-tour.mjs run produces the same element from the template.
Dry run by default; --go writes, and a copy of the previous file goes to <dist parent>/<id>.index.pre-brand[-N].html first (outside the
staged folder; an existing copy is never overwritten).
usage: python tools/apply-brand-to-dist.py <dist dir or index.html> [--go]"""
import os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, '..', 'viewer', 'template.html')
CSS = os.path.join(HERE, '..', 'viewer', 'tour.css')
OLD_TEXT = '<span class="t-brand" dir="ltr" lang="en">Habait</span>'
ANY_LOGO = re.compile(r'<span class="t-brand"[^>]*>(?:<span class="t-credit">.*?</span></span>)?<svg class="t-brand-logo".*?</svg></span>', re.S)
CSS_BLOCK = re.compile(r'/\* brand-credit:start.*?/\* brand-credit:end \*/', re.S)
CSS_OLD = re.compile(r'\.t-brand-logo \{[^}]*\}')

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit('usage: apply-brand-to-dist.py <dist dir or index.html> [--go]')
    target = args[0] if args[0].endswith('.html') else os.path.join(args[0], 'index.html')
    tpl = open(TEMPLATE, encoding='utf-8').read()
    m = ANY_LOGO.search(tpl)
    if not m: sys.exit('apply-brand: the template has no wordmark brand element')
    new = m.group(0)
    cb = CSS_BLOCK.search(open(CSS, encoding='utf-8').read())
    if not cb: sys.exit('apply-brand: tour.css has no brand-credit block')
    s = open(target, encoding='utf-8').read()
    out = s
    if new not in out:
        found = ANY_LOGO.findall(out)
        n_old = out.count(OLD_TEXT)
        if len(found) + n_old != 1: sys.exit(f'apply-brand: expected exactly one brand element in {target}, found {len(found)} wordmark + {n_old} text')
        out = ANY_LOGO.sub(lambda _m: new, out, count=1) if found else out.replace(OLD_TEXT, new, 1)
    if cb.group(0) not in out:
        if CSS_BLOCK.search(out): out = CSS_BLOCK.sub(lambda _m: cb.group(0), out, count=1)
        elif len(CSS_OLD.findall(out)) == 1: out = CSS_OLD.sub(lambda _m: cb.group(0), out, count=1)
        else: out = out.replace('</style>', cb.group(0) + '\n</style>', 1)
    if out == s: print('already applied:', target); return
    print(('write ' if '--go' in sys.argv else 'dry: ') + target, len(s), '->', len(out), 'bytes')
    if '--go' in sys.argv:
        d = os.path.dirname(os.path.abspath(target))
        base = os.path.join(os.path.dirname(d), os.path.basename(d) + '.index.pre-brand')
        k, bak = 0, base + '.html'
        while os.path.exists(bak): k += 1; bak = f'{base}-{k}.html'
        shutil.copy2(target, bak)
        open(target, 'w', encoding='utf-8').write(out)
        print('backup:', bak)

if __name__ == '__main__':
    main()
