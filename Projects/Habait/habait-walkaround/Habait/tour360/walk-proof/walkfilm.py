"""walkfilm.py — a realistic walking film for ONE route of the walk (2026-11-12, Eliran: «כן» to a trial on entrance → living, cap $2).

  python walkfilm.py <film dir> <from> <to> <take> [--go] [--cap 2.0] [--ledger <ledger.json>]

Kling v2v (fal `kling/v4/video-to-video/edit`) re-dresses the grey clay film of the route (`walk_clay.py`, the plan-true model, no
loose furniture, no glass) with the look of the tour's own pictures: @Image1 = the first frame's view cut from the start viewpoint's
picture, @Image2 = the last frame's view from the end viewpoint's picture, @Image3/@Image4 = the end room to the left and right
(`refs.py`). Dry by default; with --go it books the estimate in the ledger BEFORE the call, refuses over the cap, saves the request
id at submit (a paid result is never lost) and downloads with httpx (urllib has no CA bundle in this venv — the 2026-11-10 lesson).
"""
import sys, os, json, datetime, argparse
sys.path.insert(0, 'C:/RnD/Projects/Habait/habait-walkaround/Habait/engine/video'); import kling_v2v as K
ap = argparse.ArgumentParser(); ap.add_argument('dir'); ap.add_argument('a'); ap.add_argument('b'); ap.add_argument('take')
ap.add_argument('--go', action='store_true'); ap.add_argument('--cap', type=float, default=2.0); ap.add_argument('--ledger', default='')
a = ap.parse_args(); F = a.dir.replace('\\', '/')
clay = f'{F}/clay-{a.a}-{a.b}.mp4'; cam = json.load(open(clay + '.camera.json'))
refs = [f'{F}/ref-{a.a}-{a.b}-first.jpg', f'{F}/ref-{a.a}-{a.b}-last.jpg', f'{F}/ref-{a.a}-{a.b}-end-left.jpg', f'{F}/ref-{a.a}-{a.b}-end-right.jpg']
for r in refs + [clay]: assert os.path.exists(r), r
secs = cam['seconds']
PROMPT = (
    f"@Video1 is a plain light-grey 3D clay render of ONE continuous {secs:g}-second shot: a person walks slowly at eye height from the entrance hall of a "
    "16th-floor apartment into its living room, looking ahead, ending near the middle of the room facing the glass sliding door to the terrace with the TV wall on the right. "
    "Re-render the SAME footage as a photoreal interior: keep every frame's camera position, motion, perspective and horizon, and every wall, column, opening, "
    "window frame, door, the TV unit and the kitchen exactly where @Video1 draws them; replace only the clay with real materials. "
    "Nothing static may change shape, count or position between frames. The clay has no loose furniture: furnish the room EXACTLY as the real room "
    "photographed in @Image1 to @Image4, with the same pieces in the same places. "
    "@Image1 is exactly the FIRST frame: the view from the entrance across the living room — on the left a sand-grey handleless kitchen and a round light-oak dining table "
    "with cream chairs under a white cloud pendant; ahead the curved black-framed floor-to-ceiling glazing with sheer cream curtains and a hazy city view; "
    "a large low modular cream boucle L-shaped sofa with beige cushions and an oval pale travertine coffee table on a cream rug; on the right a greige textured plaster TV wall "
    "with a wall-mounted black TV over a long floating sand-grey unit and a floor lamp with a cream drum shade. "
    "@Image2 is exactly the LAST frame: the glass sliding door open to the terrace with potted olive trees and a small bistro table, cream sheer curtains, "
    "the floor lamp and the TV wall on the right, the cream sofa at the bottom left. @Image3 and @Image4 show the same living room to the left and right of the last frame. "
    "Floor: pale natural oak parquet of long straight planks everywhere indoors. White flat ceiling with small recessed spots. No skirting boards. "
    "Add nothing that is not in the pictures: no extra furniture, no extra plants, no people, no text, no watermark. "
    "Soft bright hazy morning daylight, neutral white, consistent exposure. Smooth steady walking motion, no cuts, no camera shake."
)
usd = K.estimate_usd(secs + 1 / 24, None, '720p')
lp = a.ledger or f'{F}/ledger.json'; L = json.load(open(lp, encoding='utf8')) if os.path.exists(lp) else []
booked = round(sum(e['usd'] for e in L), 2)
print(json.dumps({'take': a.take, 'go': a.go, 'estimate_usd': usd, 'booked_usd': booked, 'cap_usd': a.cap, 'clay': os.path.basename(clay), 'refs': [os.path.basename(r) for r in refs], 'prompt_chars': len(PROMPT), 'ledger': lp}, indent=1))
if not a.go: sys.exit(0)
if booked + usd > a.cap: print('REFUSED: over the cap'); sys.exit(2)
L.append({'at': datetime.datetime.now().isoformat(timespec='seconds'), 'route': f'{a.a}->{a.b}', 'take': a.take, 'endpoint': K.ENDPOINT, 'usd': usd, 'state': 'booked before the call', 'approved': 'Eliran 2026-11-12 «כן» to the trial, cap $2'})
json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
class Be(K.FalBackend):
    def download(self, url, dst):
        import httpx
        with httpx.stream('GET', url, timeout=600, follow_redirects=True) as r:
            r.raise_for_status()
            with open(dst, 'wb') as f:
                for chunk in r.iter_bytes(1 << 20): f.write(chunk)
def submitted(rid):
    L[-1]['request_id'] = rid; L[-1]['state'] = 'submitted'; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1); print('submitted', rid, flush=True)
out = f'{F}/take-{a.a}-{a.b}-{a.take}'
rec = K.run(clay, refs, PROMPT, out, resolution='720p', duration=None, on_submit=submitted, backend=Be())
L[-1]['state'] = 'done'; L[-1]['secs'] = rec['secs']; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
print('done', out + '/real.mp4', rec['secs'], 's; booked total $', round(booked + usd, 2))
