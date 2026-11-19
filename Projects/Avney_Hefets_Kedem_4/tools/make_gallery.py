"""make_gallery.py - one page with every generated item: the crop of Eliran's picture, the generated studio photo, the 3D model to rotate.
usage: python -I make_gallery.py <project>   -> out/avnei-hefetz-kedem/buildings-1-2/4-rooms/gallery/   (local; his crops stay off the public site)"""
import os, sys, json, shutil
from PIL import Image
P = sys.argv[1]
out = os.path.join(P, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms', 'gallery')
os.makedirs(os.path.join(out, 'm'), exist_ok=True)
base = json.load(open(os.path.join(P, 'tools', 'catalog', 'base.json'), encoding='utf-8'))['items']
cat = json.load(open(os.path.join(P, 'tools', 'catalog', 'catalog.json'), encoding='utf-8'))['items']
W = os.path.join(P, 'work', 'catalog')
def img(src, dst, size=360):
    if not os.path.exists(src):
        return None
    im = Image.open(src).convert('RGB'); im.thumbnail((size, size)); im.save(os.path.join(out, 'm', dst), quality=86); return 'm/' + dst
cards = []
for group, items in (('הריהוט של הדירה, מהתמונות שלך', base), ('קטלוג ההחלפה', cat)):
    rows = []
    for it in items:
        if it.get('exclude'):
            continue
        glb = os.path.join(W, 'web', it['id'] + '.glb')
        if not os.path.exists(glb):
            rows.append(f'<article class="c pending"><h3>{it["he"]}</h3><p>עדיין בייצור</p></article>'); continue
        shutil.copy(glb, os.path.join(out, 'm', it['id'] + '.glb'))
        crop = img(os.path.join(W, 'crops', it['id'] + '_0.png'), it['id'] + '_crop.jpg')
        prev = img(os.path.join(W, 'preview', it['id'] + '.png'), it['id'] + '_3d.jpg', 512)
        studio = img(os.path.join(W, 'studio', it['id'] + '.png'), it['id'] + '_studio.jpg')
        views = ''.join(f'<img src="{v}" alt="">' for v in [img(os.path.join(W, 'studio', f'{it["id"]}_{k}.png'), f'{it["id"]}_{k}.jpg', 200) for k in ('back', 'left', 'right')] if v)
        rows.append(f'''<article class="c"><h3>{it["he"]}</h3>
<div class="row">{f'<figure><img src="{crop}" alt=""><figcaption>מהתמונה שלך</figcaption></figure>' if crop else ''}
<figure><img src="{studio}" alt=""><figcaption>תמונת סטודיו שנוצרה</figcaption></figure></div>
{f'<div class="views">{views}<span>מבטים נוספים</span></div>' if views else ''}
<a class="mv" href="viewer.html?m={it["id"]}" target="_blank"><img src="{prev}" alt=""><span>לסיבוב בתלת־ממד ↗</span></a>
<p class="hint">הרינדור של המודל התלת־ממדי · לחיצה פותחת סיבוב חופשי</p></article>''')
    cards.append(f'<h2>{group}</h2><section class="grid">{"".join(rows)}</section>')
html = f'''<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>פריטים שנוצרו · אבני חפץ קדם דירה 7</title>
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js"></script>
<style>:root{{--bg:#1a1713;--card:#24211e;--ink:#f9f6f3;--mut:rgba(249,246,243,.7);--amber:#eea927}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 Heebo,system-ui,sans-serif;padding:16px}}
h1{{font-size:22px;margin:4px 0}} h2{{font-size:18px;margin:24px 0 10px;color:var(--amber)}} .badge{{background:var(--amber);color:#1a1713;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:700}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}}
.c{{background:var(--card);border:1px solid rgba(249,246,243,.12);border-radius:14px;padding:12px}} .c h3{{margin:0 0 8px;font-size:16px}}
.row{{display:flex;gap:8px}} figure{{margin:0;flex:1}} figure img{{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:#fff}} figcaption{{font-size:11px;color:var(--mut);margin-top:3px}}
.views{{display:flex;gap:6px;align-items:center;margin-top:8px}} .views img{{width:64px;height:64px;object-fit:cover;border-radius:6px;background:#fff}} .views span{{font-size:11px;color:var(--mut)}}
.mv{{display:block;position:relative;margin-top:10px}} .mv img{{width:100%;border-radius:10px;background:#c8c8c8}} .mv span{{position:absolute;bottom:8px;inset-inline-start:8px;background:var(--amber);color:#1a1713;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:700}} .hint{{font-size:11px;color:var(--mut);margin:4px 0 0}} .pending{{opacity:.6}}
</style></head><body><h1>הפריטים שנוצרו · אבני חפץ קדם, דירה 7 <span class="badge">הדמיה</span></h1>
<p style="color:var(--mut)">כל פריט נוצר ב-fal מתמונה שלך: תמונת סטודיו (nano-banana-pro), מבטים נוספים, ומודל תלת־ממדי (Hunyuan 3D). דף מקומי, לא באתר הציבורי.</p>
{"".join(cards)}</body></html>'''
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
viewer = '''<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>מודל תלת־ממדי</title>
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#efeae3;font:15px Heebo,system-ui,sans-serif} canvas{display:block;touch-action:none} p{position:fixed;top:10px;inset-inline:0;text-align:center;margin:0;color:#3c3935}</style></head>
<body><p>גררו כדי לסובב · גלגלת לזום · <b style="background:#eea927;padding:1px 8px;border-radius:99px">הדמיה</b></p>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(innerWidth, innerHeight); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; document.body.append(r.domElement);
const sc = new THREE.Scene(); sc.background = new THREE.Color(0xefeae3); sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 4, 3); sc.add(sun);
const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 100); const ctl = new OrbitControls(cam, r.domElement); ctl.autoRotate = true; ctl.autoRotateSpeed = 1.2; ctl.enableDamping = true;
const id = (new URLSearchParams(location.search).get('m') || '').replace(/[^a-z_]/g, '');
new GLTFLoader().load('m/' + id + '.glb', (g) => { sc.add(g.scene); const b = new THREE.Box3().setFromObject(g.scene), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
  ctl.target.copy(c); cam.position.copy(c).add(new THREE.Vector3(s * 0.9, s * 0.55, s * 1.1)); cam.near = s / 100; cam.updateProjectionMatrix(); window.__ok = true; });
addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); });
r.setAnimationLoop(() => { ctl.update(); r.render(sc, cam); });
</script></body></html>'''
open(os.path.join(out, 'viewer.html'), 'w', encoding='utf-8').write(viewer)
print('gallery', out, sum(1 for f in os.listdir(os.path.join(out, 'm')) if f.endswith('.glb')), 'models')
