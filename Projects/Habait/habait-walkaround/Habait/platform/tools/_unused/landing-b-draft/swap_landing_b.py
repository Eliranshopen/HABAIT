#!/usr/bin/env python3
"""Put Landing B at `/` of a STAGED folder — for the second test link only (Vercel project rainbow-v2-test), never for habait-flow prod.
Plan development/plans/2026-11-08-rainbow-landing.md, round 10. The repo keeps prod's landing as index.html; this works on a stage copy:
  <stage>/index.html      -> <stage>/landing-a.html   (prod's landing stays reachable on the test site)
  <stage>/landing-b.html  -> <stage>/index.html
Both pages use document-relative paths, so either works at the root. Dry run by default; --go writes. Refuses if the stage is not a
platform stage (no landing-b.html) or was already swapped. Exit non-zero on any failure.
usage: python tools/swap_landing_b.py <stage dir> [--go]"""
import os, shutil, sys

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit('usage: swap_landing_b.py <stage dir> [--go]')
    st = os.path.abspath(args[0])
    idx, b, a = (os.path.join(st, n) for n in ('index.html', 'landing-b.html', 'landing-a.html'))
    if not os.path.isfile(b): sys.exit(f'swap: {b} not found (not a platform stage?)')
    if os.path.exists(a): sys.exit(f'swap: {a} exists — this stage was already swapped')
    if not os.path.isfile(idx): sys.exit(f'swap: {idx} not found')
    print(('swap ' if '--go' in sys.argv else 'dry: ') + f'{idx} -> {a}; {b} -> {idx}')
    if '--go' in sys.argv:
        shutil.move(idx, a)
        shutil.copy2(b, idx)
        print('done')

if __name__ == '__main__':
    main()
