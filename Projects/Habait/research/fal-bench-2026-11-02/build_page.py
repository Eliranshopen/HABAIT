"""build_page.py - the comparison page for Eliran (Hebrew, RTL) from the bench outputs + scores.

Writes site/index.html and site/media/* (JPEG previews of the images, re-encoded 720p videos), small enough to publish.
"""
import glob
import json
import os
import subprocess

import cv2

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
SITE = HERE + "/site"
MEDIA = SITE + "/media"
os.makedirs(MEDIA, exist_ok=True)

PRICES = {  # list price per call as fal shows it (2026-11-02), for the caption
    "gpt-image-2.5": "$1.20", "gpt-image-2.5__baseline": "$1.20", "nano-banana-pro": "$0.15 (2K: $0.30)", "nano-banana-2.1": "≈$0.12 (2K ≈$0.20)",
    "nano-banana-2": "$0.08 (2K: $0.12)", "flux-2-pro": "$0.03/MP", "flux-2-max": "$0.07/MP", "flux-3": "$0.048 (1K)",
    "seedream-5-pro": "≈$0.15", "qwen-image-3": "$0.04 (1K) / $0.075 (2K)", "krea-3": "$0.025/MP", "grok-imagine-quality": "$0.05 (1K) / $0.07 (2K)",
    "ltx-2.3-render-to-real__baseline": "$0.0024/MP ≈ $0.27 ל-5 ש׳", "ltx-2.3-render-to-real-5s": "≈$0.27 ל-5 ש׳",
    "kling-4-v2v-edit": "$0.094/ש׳ (קלט+פלט) ≈ $0.94", "kling-o3-pro-v2v-edit": "$0.168/ש׳ ≈ $0.84",
    "wan-3.0-reference": "$0.10/ש׳ ≈ $0.50", "wan-3.0-i2v": "$0.10/ש׳ ≈ $0.50", "flux-3-edit-video": "$0.03/ש׳ ≈ $0.15",
    "flux-3-max-keyframes": "$0.0425/ש׳ ≈ $0.22", "kling-3-pro-i2v": "$0.112/ש׳ ≈ $0.56", "gemini-omni-flash-edit": "≈$0.5",
}
LABELS = {
    "gpt-image-2.5": "GPT Image 2.5 (OpenAI)", "gpt-image-2.5__baseline": "GPT Image 2.5 — הבסיס מהפייפליין",
    "nano-banana-pro": "Nano Banana Pro (Google)", "nano-banana-2.1": "Nano Banana 2.1 (Google)", "nano-banana-2": "Nano Banana 2 (Google)",
    "flux-2-pro": "FLUX.2 [pro] edit", "flux-2-max": "FLUX.2 [max] edit", "flux-3": "FLUX.3 edit-image", "seedream-5-pro": "Seedream 5 Pro (ByteDance)",
    "qwen-image-3": "Qwen Image 3 edit (Alibaba)", "krea-3": "Krea 3 edit", "grok-imagine-quality": "Grok Imagine (xAI) quality",
    "ltx-2.3-render-to-real__baseline": "LTX 2.3 render-to-real — הבסיס (137 פריימים)", "ltx-2.3-render-to-real-5s": "LTX 2.3 render-to-real (strong-v2, אותו קליפ)",
    "kling-4-v2v-edit": "Kling 4.0 video-to-video edit", "kling-o3-pro-v2v-edit": "Kling O3 Pro video-to-video edit",
    "wan-3.0-reference": "Wan 3.0 reference-to-video", "wan-3.0-i2v": "Wan 3.0 image-to-video (פריים ראשון+אחרון)", "flux-3-edit-video": "FLUX.3 edit-video (בלי תמונת ייחוס)",
    "flux-3-max-keyframes": "FLUX.3 Max keyframes-to-video (פריים ראשון+אחרון)", "kling-3-pro-i2v": "Kling 3 Pro image-to-video (פריים ראשון+אחרון)",
    "gemini-omni-flash-edit": "Gemini Omni Flash 1.1 video edit",
}
V2V = {"ltx-2.3-render-to-real__baseline", "ltx-2.3-render-to-real-5s", "kling-4-v2v-edit", "kling-o3-pro-v2v-edit", "wan-3.0-reference", "flux-3-edit-video",
       "gemini-omni-flash-edit"}


def jpg(src, dst, max_w):
    im = cv2.imread(src)
    if im.shape[1] > max_w:
        im = cv2.resize(im, (max_w, int(im.shape[0] * max_w / im.shape[1])), interpolation=cv2.INTER_AREA)
    cv2.imwrite(dst, im, [cv2.IMWRITE_JPEG_QUALITY, 86])
    return im.shape[1], im.shape[0]


def mp4(src, dst):
    if not os.path.exists(dst):
        subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", src, "-an", "-vf",
                        "scale=1280:-2:force_original_aspect_ratio=decrease,fps=24,format=yuv420p", "-c:v", "libx264", "-crf", "24",
                        "-preset", "medium", "-movflags", "+faststart", dst], check=True)


def load(name):
    p = f"{HERE}/{name}"
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


sa, sb, sc = load("scores-A.json"), load("scores-B.json"), load("scores-C.json")

# ------------------------------------------------------------------ media
jpg(f"{HERE}/inputs/A_clay_ext-enter.png", f"{MEDIA}/A_input.jpg", 1280)
jpg(f"{HERE}/inputs/C_pano_04-living_src.png", f"{MEDIA}/C_input.jpg", 2048)
jpg(f"{HERE}/inputs/B_clay_s1_first.png", f"{MEDIA}/B_clay_first.jpg", 960)
jpg(f"{HERE}/inputs/B_keyframe_s1_first.png", f"{MEDIA}/B_kf_first.jpg", 960)
jpg(f"{HERE}/inputs/B_keyframe_s1_last_from_ltx.png", f"{MEDIA}/B_kf_last.jpg", 960)
mp4(f"{HERE}/inputs/B_clay_s1_5s.mp4", f"{MEDIA}/B_clay.mp4")
for i, r in enumerate(["tour-living-yaw0", "tour-living-yaw70", "tour-living-yaw-70"]):
    jpg(f"{HERE}/inputs/{r}.png", f"{MEDIA}/A_ref{i + 1}.jpg", 640)

cards = {"A": [], "B": [], "C": []}
for p in sorted(glob.glob(f"{HERE}/A-keyframe/*.png")):
    if p.endswith(".kfcheck.png"):
        continue
    n = os.path.basename(p)[:-4]
    jpg(p, f"{MEDIA}/A_{n}.jpg", 1280)
    cards["A"].append(n)
for p in sorted(glob.glob(f"{HERE}/C-pano/*.png")):
    n = os.path.basename(p)[:-4]
    jpg(p, f"{MEDIA}/C_{n}.jpg", 2048)
    cards["C"].append(n)
for p in sorted(glob.glob(f"{HERE}/B-flyover/*.mp4")):
    n = os.path.basename(p)[:-4]
    mp4(p, f"{MEDIA}/B_{n}.mp4")
    cards["B"].append(n)


def pct(x):
    return "—" if x is None else f"{round(x * 100)}%"


def card_a(n):
    s = sa.get(n, {})
    e = s.get("edges") or {}
    bc = s.get("by_class") or {}
    g = lambda k: (bc.get(k) or {}).get("clay_edges_in_keyframe")  # noqa: E731
    sh = s.get("best_shift") or {}
    usd = s.get("usd")
    secs = s.get("secs")
    meta = f'<span class="chip">{PRICES.get(n, "")}</span>' + (f'<span class="chip">{secs} ש׳</span>' if secs else "")
    metrics = (f'<dl><div><dt>קירות</dt><dd>{pct(g("walls"))}</dd></div><div><dt>זיגוג</dt><dd>{pct(g("glazing"))}</dd></div>'
               f'<div><dt>דלתות</dt><dd>{pct(g("doors"))}</dd></div><div><dt>ריהוט</dt><dd>{pct(g("furniture"))}</dd></div>'
               f'<div><dt>קצוות הקליי בתוצאה</dt><dd>{pct(e.get("clay_in_keyframe"))}</dd></div>'
               f'<div><dt>סטיית מצלמה</dt><dd>{sh.get("deg", "—")}°</dd></div></dl>')
    return (f'<article class="card" data-track="A" data-name="{n}"><header><h3>{LABELS.get(n, n)}</h3>{meta}</header>'
            f'<figure class="swap"><img src="media/A_{n}.jpg" alt="{n}" loading="lazy" data-out="media/A_{n}.jpg" data-src="media/A_input.jpg">'
            f'<figcaption>לחיצה על התמונה מחליפה לקליי המקורי</figcaption></figure>{metrics}'
            f'<button class="pick" type="button">זה הכי טוב</button></article>')


def card_c(n):
    s = sc.get(n, {})
    secs = s.get("secs")
    meta = f'<span class="chip">{PRICES.get(n, "")}</span>' + (f'<span class="chip">{secs} ש׳</span>' if secs else "")
    size = s.get("size") or ["", ""]
    metrics = (f'<dl><div><dt>קצוות שנשמרו, חצי עליון</dt><dd>{pct(s.get("edges_kept_upper"))}</dd></div>'
               f'<div><dt>חצי תחתון (רצפה)</dt><dd>{pct(s.get("edges_kept_lower"))}</dd></div>'
               f'<div><dt>גודל פלט</dt><dd>{size[0]}×{size[1]}</dd></div></dl>')
    return (f'<article class="card wide" data-track="C" data-name="{n}"><header><h3>{LABELS.get(n, n)}</h3>{meta}</header>'
            f'<figure class="swap"><img src="media/C_{n}.jpg" alt="{n}" loading="lazy" data-out="media/C_{n}.jpg" data-src="media/C_input.jpg">'
            f'<figcaption>לחיצה על התמונה מחליפה לפנורמת המקור</figcaption></figure>{metrics}'
            f'<button class="pick" type="button">זה הכי טוב</button></article>')


def card_b(n):
    s = sb.get(n, {})
    secs = s.get("secs")
    meta = f'<span class="chip">{PRICES.get(n, "")}</span>' + (f'<span class="chip">{secs} ש׳</span>' if secs else "")
    meta += '<span class="chip kind">' + ("מונחה קליי" if n in V2V else "image-to-video בלבד") + "</span>"
    ag = s.get("clay_edges_found_f1_mid_last") or []
    agt = " / ".join(pct(x) for x in ag) if ag else "—"
    metrics = (f'<dl><div><dt>פריימים</dt><dd>{s.get("frames", "—")} @ {s.get("fps", "—")}</dd></div>'
               f'<div><dt>גודל</dt><dd>{"×".join(str(x) for x in (s.get("size") or []))}</dd></div>'
               f'<div><dt>התאמה לגאומטריית הקליי (התחלה / אמצע / סוף)</dt><dd>{agt}</dd></div></dl>')
    return (f'<article class="card" data-track="B" data-name="{n}"><header><h3>{LABELS.get(n, n)}</h3>{meta}</header>'
            f'<video src="media/B_{n}.mp4" muted loop playsinline controls preload="metadata"></video>{metrics}'
            f'<button class="pick" type="button">זה הכי טוב</button></article>')


def total(track):
    p = f"{HERE}/ledger-{track}.json"
    rows = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else []
    return sum(r.get("usd", 0) for r in rows if not r.get("error"))


tot = {t: total(t) for t in "ABC"}
html = f"""<title>בנצ'מרק מודלי fal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* layout: one RTL column, three tracks as sticky-tab sections; cards in a fluid grid, the pano cards full width */
:root {{ --bg:#f6f4ef; --fg:#1d1b17; --muted:#6b665c; --line:#dcd7cc; --card:#ffffff; --accent:#0e5a4a; --accent-fg:#ffffff; --chip:#ece8df; --good:#1d7a52; --warn:#b2641a;
  --display:'Heebo',system-ui,sans-serif; --mono:'IBM Plex Mono',ui-monospace,Consolas,monospace; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#15171a; --fg:#ece9e2; --muted:#a39d91; --line:#2d3137; --card:#1e2126; --accent:#5fc3a6; --accent-fg:#0d1b17; --chip:#272b31; --good:#5fc3a6; --warn:#e0a25a; color-scheme:dark }} }}
:root[data-theme="dark"] {{ --bg:#15171a; --fg:#ece9e2; --muted:#a39d91; --line:#2d3137; --card:#1e2126; --accent:#5fc3a6; --accent-fg:#0d1b17; --chip:#272b31; --good:#5fc3a6; --warn:#e0a25a; color-scheme:dark }}
html,body {{ direction:rtl }}
body {{ background:var(--bg); color:var(--fg); font-family:var(--display); font-size:15px; line-height:1.55; margin:0;
  padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:0 48px }}
main {{ max-width:1320px; margin:0 auto }}
h1 {{ font-weight:700; font-size:clamp(1.6rem,3vw,2.2rem); margin:28px 0 4px; text-wrap:balance }}
h2 {{ font-size:1.35rem; margin:0 0 6px }}
h3 {{ font-size:1rem; font-weight:500; margin:0 }}
p.lead {{ color:var(--muted); max-width:70ch; margin:0 0 18px }}
nav.tabs {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:5; background:var(--bg); display:flex; gap:8px; padding-block:10px; border-bottom:1px solid var(--line); margin-bottom:18px; flex-wrap:wrap }}
nav.tabs a {{ text-decoration:none; color:var(--fg); padding:6px 14px; border:1px solid var(--line); border-radius:999px; background:var(--card) }}
nav.tabs a[aria-current="true"] {{ background:var(--accent); color:var(--accent-fg); border-color:var(--accent) }}
section.track {{ display:none; padding-bottom:12px }}
section.track.on {{ display:block }}
.inputs {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin:14px 0 22px }}
.inputs figure {{ margin:0; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:8px }}
.inputs img, .inputs video {{ width:100%; height:auto; display:block; border-radius:4px }}
.inputs figcaption, figcaption {{ font-size:.8rem; color:var(--muted); margin-top:6px }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(400px,1fr)); gap:16px }}
.grid .wide {{ grid-column:1 / -1 }}
.card {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px; min-width:0 }}
.card.picked {{ outline:3px solid var(--accent); outline-offset:-1px }}
.card header {{ display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px }}
.card header h3 {{ flex:1 1 100% }}
.chip {{ font-family:var(--mono); font-size:.75rem; background:var(--chip); padding:2px 8px; border-radius:999px; color:var(--muted); direction:ltr }}
.chip.kind {{ direction:rtl; color:var(--fg) }}
.card figure {{ margin:0 }}
.card img, .card video {{ width:100%; height:auto; display:block; border-radius:6px; background:#000; cursor:pointer; max-width:100% }}
dl {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:6px 12px; margin:0; font-size:.85rem }}
dl div {{ display:flex; justify-content:space-between; gap:8px; border-bottom:1px dashed var(--line); padding-bottom:3px }}
dt {{ color:var(--muted) }} dd {{ margin:0; font-family:var(--mono); font-variant-numeric:tabular-nums; direction:ltr }}
button.pick {{ align-self:flex-start; background:transparent; color:var(--accent); border:1px solid var(--accent); border-radius:999px; padding:6px 14px; font:inherit; cursor:pointer }}
.card.picked button.pick {{ background:var(--accent); color:var(--accent-fg) }}
button:focus-visible, a:focus-visible, img:focus-visible {{ outline:3px solid var(--accent); outline-offset:2px }}
aside.summary {{ position:sticky; bottom:0; background:var(--card); border-top:1px solid var(--line); padding:10px 0; margin-top:24px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; font-size:.9rem }}
aside.summary code {{ font-family:var(--mono); background:var(--chip); padding:4px 8px; border-radius:6px; direction:rtl }}
aside.summary button {{ background:var(--accent); color:var(--accent-fg); border:0; border-radius:999px; padding:6px 14px; font:inherit; cursor:pointer }}
.note {{ font-size:.85rem; color:var(--muted); margin:0 0 14px; max-width:80ch }}
.legend {{ font-size:.82rem; color:var(--muted); margin:0 0 14px; max-width:80ch }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior:auto }} }}
</style>
<main>
<h1>בנצ'מרק מודלי fal להדמיות מתכנית מכר</h1>
<p class="lead">דירה 846, Rainbow TLV. אותו קלט ואותו פרומפט לכל המודלים. שלושה מסלולים: keyframe פוטוריאלי מרנדר קליי, וידאו ריחוף מקליפ קליי, ו-restyle של פנורמת 360 (רצפת פרקט, דלתות קו-אפס, בלי פנלים). מדדי הגאומטריה הם של $0 ומחושבים מול הקלט; השיפוט הסופי הוא בעיניים. בכל כרטיס יש כפתור "זה הכי טוב"; הבחירות נאספות לשורה אחת למטה.</p>
<nav class="tabs"><a href="#keyframe" data-tab="A">A · הדמיה מקליי (סלון)</a><a href="#flyover" data-tab="B">B · וידאו ריחוף</a><a href="#pano" data-tab="C">C · פנורמה וריהוט</a></nav>

<section class="track" id="trackA">
<h2>A · keyframe פוטוריאלי מרנדר קליי</h2>
<p class="note">הקלט: הפריים הראשון של הסלון מהמרפסת (ext-enter, 1280×720) + 3 חיתוכים מהפנורמה של הסיור כייחוס לחומרים ולריהוט. הפרומפט: "אותה מצלמה בדיוק, כל קיר/דלת/חלון באותו פיקסל, הריהוט הפשוט הופך לריהוט מעוצב באותו מקום". סה"כ הוצאה במסלול: ${tot['A']:.2f}.</p>
<div class="inputs"><figure><img src="media/A_input.jpg" alt="clay"><figcaption>הקלט: רנדר קליי</figcaption></figure><figure><img src="media/A_ref1.jpg" alt="ref 1"><figcaption>ייחוס 1 (פנורמת הסיור)</figcaption></figure><figure><img src="media/A_ref2.jpg" alt="ref 2"><figcaption>ייחוס 2</figcaption></figure><figure><img src="media/A_ref3.jpg" alt="ref 3"><figcaption>ייחוס 3</figcaption></figure></div>
<p class="legend">המדדים: אחוז קצוות הקליי שנמצאו בתוצאה לפי סוג אובייקט (kf_check.py; מעל 90% = הגאומטריה נשמרה), ו"סטיית מצלמה": כמה מעלות צריך להזיז את התמונה כדי להתאים לקליי (0° = אותה נקודת מבט; מעל 1.5° הווידאו "יקפוץ" אחרי הפריים הראשון).</p>
<div class="grid">{''.join(card_a(n) for n in cards['A'])}</div>
</section>

<section class="track" id="trackB">
<h2>B · וידאו ריחוף מקליפ קליי</h2>
<p class="note">הקלט: 5 שניות (121 פריימים) מהמעוף האווירי אל המגדל (ext-flight segment 1), ופריים ראשון פוטוריאלי (הסקין של THE-1). מודלים "מונחי קליי" מקבלים את הקליפ ושומרים את מסלול המצלמה; מודלי image-to-video מקבלים רק את הפריים הראשון (ולפעמים גם האחרון, שנלקח מהפלט של LTX) וממציאים את התנועה. סה"כ הוצאה במסלול: ${tot['B']:.2f}.</p>
<div class="inputs"><figure><video src="media/B_clay.mp4" muted loop playsinline controls preload="metadata"></video><figcaption>הקלט: קליפ הקליי (5 ש׳)</figcaption></figure><figure><img src="media/B_kf_first.jpg" alt="first keyframe"><figcaption>פריים ראשון פוטוריאלי</figcaption></figure><figure><img src="media/B_kf_last.jpg" alt="last keyframe"><figcaption>פריים אחרון (מהפלט של LTX; רק למודלי first+last)</figcaption></figure></div>
<p class="legend">המדד: אחוז קצוות הקליי שנמצאו בפריים המתאים של הפלט, בהתחלה / באמצע / בסוף. ירידה חדה בסוף = המודל לא עקב אחרי מסלול המצלמה (או נשאר רחוק מהמגדל). הווידאו מושתק; לחצו ▶.</p>
<div class="grid">{''.join(card_b(n) for n in cards['B'])}</div>
</section>

<section class="track" id="trackC">
<h2>C · restyle של פנורמת 360 (ריהוט והדירה)</h2>
<p class="note">הקלט: הפנורמה של הסלון מהסיור (2048×1024). הפרומפט: אותה פנורמה בדיוק, רק הגימורים משתנים: רצפת פרקט אלון רחב, דלתות קו-אפס בקרם, בלי פנלים, המטבח ממשיך עד סוף הקיר. זה בדיוק המעבר שהפייפליין עושה היום ב-GPT Image 2.5 ($1.20 לפנורמה, 33 פנורמות ל-3 רצפות). סה"כ הוצאה במסלול: ${tot['C']:.2f}.</p>
<div class="inputs"><figure class="wide"><img src="media/C_input.jpg" alt="source pano"><figcaption>הקלט: פנורמת המקור</figcaption></figure></div>
<p class="legend">המדד: אחוז קצוות המקור שנשמרו בתוצאה, חצי עליון (קירות, חלונות, תקרה) וחצי תחתון (רצפה וריהוט). הבדיקה של אתמול על GPT נתנה 92–93%. לחיצה על תמונה מחליפה בינה לבין המקור כדי לראות מה זז.</p>
<div class="grid">{''.join(card_c(n) for n in cards['C'])}</div>
</section>

<aside class="summary"><strong>הבחירות שלך:</strong> <code id="picks">עדיין לא נבחר כלום</code> <button type="button" id="copy">העתק</button> <span id="copied" hidden>הועתק</span></aside>
</main>
<script>
(function(){{
  var tabs=document.querySelectorAll('nav.tabs a'), secs={{A:'trackA',B:'trackB',C:'trackC'}}, hashes={{keyframe:'A',flyover:'B',pano:'C'}};
  function show(t){{ for(var k in secs){{ document.getElementById(secs[k]).classList.toggle('on',k===t); }} tabs.forEach(function(a){{ a.setAttribute('aria-current', a.dataset.tab===t ? 'true':'false'); }}); }}
  function fromHash(){{ var h=(location.hash||'').replace('#',''); show(hashes[h]||'A'); }}
  window.addEventListener('hashchange',fromHash); fromHash();
  document.querySelectorAll('figure.swap img').forEach(function(img){{ img.tabIndex=0; function sw(){{ var o=img.getAttribute('src')===img.dataset.out; img.setAttribute('src', o?img.dataset.src:img.dataset.out); }} img.addEventListener('click',sw); img.addEventListener('keydown',function(e){{ if(e.key==='Enter'||e.key===' '){{e.preventDefault();sw();}} }}); }});
  var picks={{}}; try{{ picks=JSON.parse(localStorage.getItem('fal-bench-picks')||'{{}}'); }}catch(e){{}}
  function render(){{ document.querySelectorAll('.card').forEach(function(c){{ c.classList.toggle('picked', picks[c.dataset.track]===c.dataset.name); }});
    var parts=[]; ['A','B','C'].forEach(function(t){{ if(picks[t]) parts.push(t+': '+picks[t]); }});
    document.getElementById('picks').textContent = parts.length? parts.join(' · ') : 'עדיין לא נבחר כלום'; }}
  document.querySelectorAll('button.pick').forEach(function(b){{ b.addEventListener('click',function(){{ var c=b.closest('.card'); picks[c.dataset.track]= picks[c.dataset.track]===c.dataset.name ? undefined : c.dataset.name; try{{ localStorage.setItem('fal-bench-picks',JSON.stringify(picks)); }}catch(e){{}} render(); }}); }});
  render();
  document.getElementById('copy').addEventListener('click',function(){{ var t=document.getElementById('picks').textContent; var done=function(){{ var s=document.getElementById('copied'); s.hidden=false; setTimeout(function(){{s.hidden=true;}},1500); }};
    if(navigator.clipboard&&navigator.clipboard.writeText){{ navigator.clipboard.writeText(t).then(done,function(){{ var r=document.createRange(); r.selectNodeContents(document.getElementById('picks')); var s=getSelection(); s.removeAllRanges(); s.addRange(r); }}); }} }});
  document.querySelectorAll('video').forEach(function(v){{ v.addEventListener('mouseenter',function(){{ v.play().catch(function(){{}}); }}); }});
}})();
</script>
"""
open(f"{SITE}/index.html", "w", encoding="utf-8").write(html)
files = {f"media/{os.path.basename(p)}": p for p in glob.glob(f"{MEDIA}/*")}
json.dump(files, open(f"{SITE}/files.json", "w", encoding="utf-8"), indent=1)
size = sum(os.path.getsize(p) for p in files.values()) / 1e6
print(f"page: {SITE}/index.html; media files {len(files)}, {size:.1f} MB; cards A={len(cards['A'])} B={len(cards['B'])} C={len(cards['C'])}")
