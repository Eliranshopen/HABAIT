"""make_bakeoff_page.py - the sofa from Eliran's picture through every 3D model, in ONE viewer with buttons (same light, full quality).
usage: python -I make_bakeoff_page.py <project>  -> gallery/bakeoff.html (+ gallery/m/bake_<model>.glb)"""
import os, sys, shutil, json
P = sys.argv[1]
g = os.path.join(P, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms', 'gallery'); os.makedirs(os.path.join(g, 'm'), exist_ok=True)
W = os.path.join(P, 'work', 'catalog')
CANDS = [('hunyuan4', 'Hunyuan 3D · 4 מבטים', os.path.join(W, 'glb', 'base_sofa.glb'), '$0.825 + $0.45 מבטים'),
         ('rodin', 'Rodin 2.5 · HD', os.path.join(W, 'bakeoff', 'base_sofa_rodin.glb'), '$1.20'),
         ('meshy', 'Meshy 7.1', os.path.join(W, 'bakeoff', 'base_sofa_meshy.glb'), '$1.20'),
         ('hitem', 'Hitem3D 3.0', os.path.join(W, 'bakeoff', 'base_sofa_hitem.glb'), '$2.10')]
have = []
for k, he, src, price in CANDS:
    if os.path.exists(src):
        shutil.copy(src, os.path.join(g, 'm', f'bake_{k}.glb')); have.append((k, he, price, round(os.path.getsize(src) / 1e6, 1)))
btns = ''.join(f'<button data-k="{k}">{he}<small>{price} · {mb} MB</small></button>' for k, he, price, mb in have)
html = f'''<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>השוואת מודלים · הספה</title>
<script type="importmap">{{ "imports": {{ "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" }} }}</script>
<style>html,body{{margin:0;height:100%;overflow:hidden;background:#efeae3;font:15px Heebo,system-ui,sans-serif;color:#24211e}} canvas{{display:block;touch-action:none}}
#ui{{position:fixed;top:10px;inset-inline:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}} #ui h1{{font-size:16px;margin:0 8px 0 0}}
button{{border:1px solid #c9c1b4;background:#fff;border-radius:12px;padding:8px 12px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start}} button small{{color:#807b77;font-size:11px}}
button[aria-pressed=true]{{background:#24211e;color:#fff;border-color:#24211e}} #ref{{position:fixed;bottom:10px;inset-inline-start:10px;width:220px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.25)}}
#st{{position:fixed;bottom:12px;inset-inline-end:12px;font-size:13px;color:#514d49}} .b{{background:#eea927;padding:1px 8px;border-radius:99px;font-weight:700;font-size:12px}}</style></head>
<body><div id="ui"><h1>אותה ספה מהתמונה שלך · 4 מודלים <span class="b">הדמיה</span></h1>{btns}</div>
<img id="ref" src="m/base_sofa_crop.jpg" alt="התמונה שלך"><div id="st">גררו לסיבוב · גלגלת לזום</div>
<script type="module">
import * as THREE from 'three'; import {{ GLTFLoader }} from 'three/addons/loaders/GLTFLoader.js'; import {{ OrbitControls }} from 'three/addons/controls/OrbitControls.js'; import {{ RoomEnvironment }} from 'three/addons/environments/RoomEnvironment.js';
const r = new THREE.WebGLRenderer({{ antialias: true }}); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(innerWidth, innerHeight); r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1.1; r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true; document.body.prepend(r.domElement);
const sc = new THREE.Scene(); sc.background = new THREE.Color(0xefeae3); sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.02).texture;
const sun = new THREE.DirectionalLight(0xfff2e0, 1.6); sun.position.set(2.5, 4, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sc.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({{ opacity: 0.18 }})); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.01, 100); const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true;
let cur = null; const cache = {{}}; const L = new GLTFLoader();
async function show(k) {{
  document.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k))); document.getElementById('st').textContent = 'טוען…';
  cache[k] ||= L.loadAsync('m/bake_' + k + '.glb').then((gl) => {{ const o = gl.scene; const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k2 = 2.1 / Math.max(s.x, s.z); o.scale.setScalar(k2); o.position.set(-c.x * k2, -b.min.y * k2, -c.z * k2); o.traverse((m) => {{ if (m.isMesh) {{ m.castShadow = true; m.receiveShadow = true; }} }}); return o; }});
  const o = await cache[k]; if (cur) sc.remove(cur); cur = o; sc.add(o);
  const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
  ctl.target.copy(c); cam.position.copy(c).add(new THREE.Vector3(s * 0.75, s * 0.42, s * 0.95)); cam.updateProjectionMatrix(); document.getElementById('st').textContent = 'גררו לסיבוב · גלגלת לזום'; window.__shown = k;
}}
document.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => show(b.dataset.k)));
addEventListener('resize', () => {{ cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); }});
r.setAnimationLoop(() => {{ ctl.update(); r.render(sc, cam); }});
show(new URLSearchParams(location.search).get('m') || '{have[0][0] if have else ''}');
</script></body></html>'''
open(os.path.join(g, 'bakeoff.html'), 'w', encoding='utf-8').write(html)
print('bakeoff page', [h[0] for h in have])
