"""transition-rise card 06: place the outputs built in run/ (= live sources + the shipping files, verified by diff -rq) into the
working folder, and re-snapshot sha256_at_open for the three platform output rows that rnd-23 rebuilt on live at 07:14 (gate N4;
their rebuild is superseded by ours, which carries their apartment.css). Dry-run unless --go. Binary copies, no line-ending change."""
import hashlib, json, shutil, sys
from pathlib import Path

GO = '--go' in sys.argv
W = Path(r'C:\RnD\.wt\transition-rise')
LIVE = Path(r'C:\RnD')
H = 'Projects/Habait/habait-walkaround/Habait'
RUN_PLAT = W / 'run' / H / 'platform/_local/dist/rainbow/846'
RUN_TOUR = W / 'run/tourout/apt846'
PLACE = {
    f'{H}/platform/_local/dist/rainbow/846/846.zip': RUN_PLAT / '846.zip',
    f'{H}/platform/_local/dist/rainbow/846/apartment.json': RUN_PLAT / 'apartment.json',
    f'{H}/platform/_local/dist/rainbow/846/index.html': RUN_PLAT / 'index.html',
    f'{H}/platform/_local/dist/rainbow/846/media/dollhouse.html': RUN_PLAT / 'media/dollhouse.html',
    f'{H}/tour360/dist/apt846/index.html': RUN_TOUR / 'index.html',
    f'{H}/tour360/dist/apt846/3d/dollhouse.html': RUN_TOUR / '3d/dollhouse.html',
}
RESNAP = {f'{H}/platform/_local/dist/rainbow/846/{n}' for n in ('846.zip', 'apartment.json', 'media/dollhouse.html')}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

man_p = W / 'manifest.json'
man = json.loads(man_p.read_text(encoding='utf-8'))
rows = {r['path']: r for r in man['files']}
for rel, src in PLACE.items():
    dst = W / 'files' / rel
    print(f"place {rel}: {sha(src)[:12]} (was {sha(dst)[:12] if dst.exists() else '-'})")
    if GO:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
for rel in sorted(RESNAP):
    r = rows[rel]
    now = sha(LIVE / rel)
    print(f"resnap {rel}: open {r['sha256_at_open'][:12]} -> live now {now[:12]}")
    if GO and now != r['sha256_at_open']:
        r.setdefault('resnap', []).append({'from': r['sha256_at_open'], 'to': now, 'why': 'rnd-23 rebuilt platform 846 on live 2026-11-04 07:14 (platform-ui-ux apartment.css fix); our rebuild carries it (gate N4)'})
        r['sha256_at_open'] = now
if GO:
    man_p.write_bytes((json.dumps(man, indent=1, ensure_ascii=False) + '\n').encode('utf-8'))
print('done' if GO else '(dry run; add --go)')
