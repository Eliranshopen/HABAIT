"""fly4.py — bird-flight, the DESCENT re-made so the room seen through 846's glass is the tour's room too (the 11-02 descent shows the old
room through the glass for its last ~2 s, and it swaps at the join with the new entry). Kling v2v on the clay frames 95..200 (4.4 s).
  python fly4.py <take> [--go]     dry by default; booked in stage2/ledger.json before the call; refuses over CAP.
"""
import sys, os, json, subprocess, datetime
HAB = 'C:/RnD/Projects/Habait/habait-walkaround/Habait'
sys.path.insert(0, HAB + '/engine/video'); import kling_v2v as K
F = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/'); OUT = F + '/stage2'
CAP = 10.0; T0, DUR = 95 / 24, 106 / 24
take = sys.argv[1]; go = '--go' in sys.argv
clay = OUT + '/clay-descend.mp4'
if not os.path.exists(clay):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{T0:.4f}', '-i', HAB + '/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-flight-full/clay.mp4', '-frames:v', '106', '-an', '-r', '24', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', clay], check=True)
last = OUT + '/ref-entry-first.jpg'
if not os.path.exists(last): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', OUT + '/t3/real.mp4', '-frames:v', '1', '-q:v', '2', last], check=True)
refs = [HAB + '/platform/_local/segments/rainbow-cine/descend-846.first.jpg', last, OUT + '/ref-sofa.jpg']
PROMPT = (
    "@Video1 is a plain grey 3D clay render of ONE continuous 4-second shot: a drone descends along the facade of the Rainbow tower in Tel Aviv (a residential tower "
    "wrapped in white, softly undulating curved balcony slabs with planters and frameless glass railings) to the 16th floor and approaches one apartment's terrace, "
    "ending in front of its glass sliding door with the living room visible behind the glass. "
    "Re-render the SAME footage as a photoreal architectural visualization: keep every frame's camera motion, perspective, horizon, every slab edge, floor line, railing, "
    "window mullion and the slider exactly where @Video1 draws them; only replace the clay materials with real ones. Nothing static may change shape, count or position "
    "between frames; the building is identical from the first frame to the last. "
    "@Image1 is the real look of the FIRST frame: the white curved slabs, planters with small olive trees, slim black-framed floor-to-ceiling glazing, the sea, the "
    "Reading power-station chimney, low white buildings and trees, a clear blue sky. Keep exactly this look for the tower, the sea and the city. "
    "@Image2 is the real look of the LAST frame: the terrace with its pale stone floor and glass railing, the black-framed sliding glazing with sheer cream curtains, and "
    "behind the glass the living room. @Image3 shows that living room's seating from inside: a low modular cream boucle sofa with a chaise end and beige cushions, a low oval pale "
    "travertine coffee table with a white vase of green fern, a pale cream rectangular rug, pale oak parquet, a floor lamp with a cream drum shade. "
    "Whenever the living room is visible through the glass it is THIS room: no round rug, no jute rug, no blanket on the sofa. "
    "Soft bright morning light, clear pale-blue sky, neutral white daylight, consistent exposure throughout. Smooth, continuous, no cuts, no text, no people, no watermark."
)
usd = K.estimate_usd(DUR, DUR, '720p')
lp = OUT + '/ledger.json'; L = json.load(open(lp, encoding='utf8')) if os.path.exists(lp) else []
booked = round(sum(e['usd'] for e in L), 2)
print(json.dumps({'take': take, 'go': go, 'estimate_usd': usd, 'booked_usd': booked, 'cap_usd': CAP, 'refs': [os.path.basename(r) for r in refs], 'prompt_chars': len(PROMPT)}, indent=1))
if not go: sys.exit(0)
if booked + usd > CAP: print('REFUSED: over the cap'); sys.exit(2)
L.append({'at': datetime.datetime.now().isoformat(timespec='seconds'), 'take': take, 'endpoint': K.ENDPOINT, 'usd': usd, 'state': 'booked before the call'}); json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
class Be(K.FalBackend):
    def download(self, url, dst):
        import httpx
        with httpx.stream('GET', url, timeout=600, follow_redirects=True) as r:
            r.raise_for_status()
            with open(dst, 'wb') as f:
                for chunk in r.iter_bytes(1 << 20): f.write(chunk)
def submitted(rid):
    L[-1]['request_id'] = rid; L[-1]['state'] = 'submitted'; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1); print('submitted', rid, flush=True)
rec = K.run(clay, refs, PROMPT, f'{OUT}/{take}', resolution='720p', duration=None, on_submit=submitted, backend=Be())
L[-1]['state'] = 'done'; L[-1]['secs'] = rec['secs']; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
print('done', f'{OUT}/{take}/real.mp4', rec['secs'], 's; booked total $', round(booked + usd, 2))
