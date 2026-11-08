"""page.py - the Hebrew comparison page of the live bench (card 29), built at $0 from results already on disk.

  build(src_89, out_html, bench_local)   called by habait_bench.py --rebuild-page --from <89's folder> --out <html>

Reads habait-89's bench folder READ-ONLY (scores-A/B/C.json, scores-E-<node>.json, ledger-*.json, the outputs and the
previews in site/media) and any habait-bench runs under <bench_local>/<endpoint>/<track>/metrics.json, and writes
<out_html> + <out dir>/media/. 89's build_page.py is not imported: it writes into 89's own site/ folder at import time.
The pano seam of 89's C track (never stored in scores-C.json) is computed here with 89's own seam() of score_e.py.
"""
import glob
import html
import json
import os
import shutil
import time
from pathlib import Path

LABELS = {
    "gpt-image-2.5": "GPT Image 2.5 (OpenAI)", "gpt-image-2.5__baseline": "GPT Image 2.5, הבסיס מהפייפליין",
    "nano-banana-pro": "Nano Banana Pro (Google)", "nano-banana-2.1": "Nano Banana 2.1 (Google)", "nano-banana-2": "Nano Banana 2 (Google)",
    "flux-2-pro": "FLUX.2 [pro] edit", "flux-2-max": "FLUX.2 [max] edit", "flux-3": "FLUX.3 edit-image",
    "seedream-5-pro": "Seedream 5 Pro (ByteDance)", "qwen-image-3": "Qwen Image 3 edit (Alibaba)", "krea-3": "Krea 3 edit",
    "grok-imagine-quality": "Grok Imagine (xAI) quality",
    "ltx-2.3-render-to-real__baseline": "LTX 2.3 render-to-real, הבסיס", "ltx-2.3-render-to-real-5s": "LTX 2.3 render-to-real (strong-v2)",
    "kling-4-v2v-edit": "Kling 4.0 video-to-video edit", "kling-o3-pro-v2v-edit": "Kling O3 Pro video-to-video edit",
    "kling-4-full-flight": "Kling 4.0 v2v, כל הטיסה (409 פריימים)",
    "wan-3.0-reference": "Wan 3.0 reference-to-video", "wan-3.0-i2v": "Wan 3.0 image-to-video", "flux-3-edit-video": "FLUX.3 edit-video",
    "flux-3-max-keyframes": "FLUX.3 Max keyframes-to-video", "kling-3-pro-i2v": "Kling 3 Pro image-to-video",
    "gemini-omni-flash-edit": "Gemini Omni Flash 1.1 video edit",
}
VERDICT_89 = {
    "A": "הכרעה (89, 11:20 אחרי בדיקה בעין): GPT Image 2.5. היחיד שהחזיק קולונה, דלת, מקרר, מטבח וסליידר במקום.",
    "B": "לרשומה בלבד (אין וידאו במוצר): Kling 4.0 v2v על כל הטיסה בקריאה אחת שמר מגדל יציב; render-to-real בקטעים נסחף.",
    "C": "הכרעה: GPT Image 2.5 נשאר. Seedream 5 Pro שומר 99% קצוות אבל שובר את תפר ה-360 ולא מאריך את המטבח.",
    "E": "הכרעה: GPT Image 2.5 הוא היחיד ששמר את הגאומטריה האווירית בנודים החיצוניים.",
}


def esc(x):
    return html.escape(str(x), quote=True)


def pct(x):
    return "—" if x is None else f"{round(float(x) * 100)}%"


def cls_ok(x, bound=0.9):
    return "" if x is None else (' class="ok"' if float(x) >= bound else ' class="bad"')


def jload(p):
    p = Path(p)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def ledger_total(src, name):
    p = src / f"ledger-{name}.json"
    rows = json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
    return sum(float(r.get("usd", 0)) for r in rows if not r.get("error"))


class Media:
    """copies 89's ready previews (site/media) or makes a JPEG preview; everything lands in <out dir>/media/."""

    def __init__(self, src, out_dir):
        self.src, self.dir = src, out_dir / "media"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.n, self.bytes = 0, 0

    def _done(self, p):
        self.n += 1
        self.bytes += p.stat().st_size
        return "media/" + p.name

    def from_site(self, name):
        s = self.src / "site" / "media" / name
        if not s.exists():
            return None
        d = self.dir / name
        if not d.exists() or d.stat().st_size != s.stat().st_size:
            shutil.copy2(s, d)
        return self._done(d)

    def jpg(self, path, name, max_w=1280):
        import cv2
        d = self.dir / name
        if not d.exists():
            im = cv2.imread(str(path))
            if im is None:
                return None
            if im.shape[1] > max_w:
                im = cv2.resize(im, (max_w, int(im.shape[0] * max_w / im.shape[1])), interpolation=cv2.INTER_AREA)
            cv2.imwrite(str(d), im, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return self._done(d)


def card(track, name, img_html, chips, metrics, extra_cls=""):
    dl = "".join(f'<div><dt>{esc(k)}</dt><dd{c}>{v}</dd></div>' for k, v, c in metrics)
    ch = "".join(f'<span class="chip">{esc(c)}</span>' for c in chips if c)
    return (f'<article class="card{extra_cls}" data-track="{track}" data-name="{esc(name)}"><header><h3>{esc(LABELS.get(name, name))}</h3>{ch}</header>'
            f'{img_html}<dl>{dl}</dl><button class="pick" type="button">זה הכי טוב</button></article>')


def swap(src_out, src_in, alt, cap):
    return (f'<figure class="swap"><img src="{src_out}" alt="{esc(alt)}" loading="lazy" data-out="{src_out}" data-src="{src_in}">'
            f'<figcaption>{esc(cap)}</figcaption></figure>')


def build(src, out_html, bench_local, from_89, seam_source):
    """from_89 / seam_source come from habait_bench (the loader that compiles one function of 89's scripts alone)."""
    import cv2
    SEAM_SOURCE = seam_source

    src, out_html = Path(src), Path(out_html)
    if not (src / "scores-A.json").exists():
        print(f"no 89 bench at {src} (scores-A.json missing)")
        return 2
    out_dir = out_html.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    m = Media(src, out_dir)
    seam = from_89("score_e.py", "seam")
    sa, sb, sc = jload(src / "scores-A.json"), jload(src / "scores-B.json"), jload(src / "scores-C.json")
    secs = {}

    # ---------------------------------------------------------------- A keyframe
    a_in = m.from_site("A_input.jpg") or m.jpg(src / "inputs/A_clay_ext-enter.png", "A_input.jpg")
    refs = [m.from_site(f"A_ref{i}.jpg") for i in (1, 2, 3)]
    cards_a = []
    # 89's score.py globbed its own *.kfcheck.png sheets too: keep only real outputs (A-keyframe/<name>.png)
    for n in sorted(k for k in sa if ".png" not in k and (src / f"A-keyframe/{k}.png").exists()):
        s = sa[n]
        img = m.from_site(f"A_{n}.jpg") or m.jpg(src / f"A-keyframe/{n}.png", f"A_{n}.jpg")
        bc = s.get("by_class") or {}
        g = lambda k: (bc.get(k) or {}).get("clay_edges_in_keyframe")  # noqa: E731
        lock = all((g(k) or 0) >= 0.9 for k in ("walls", "glazing", "doors"))
        cards_a.append((not lock, -(g("walls") or 0), card("A", n, swap(img, a_in, n, "לחיצה מחליפה לקליי"), [
            f"${s.get('usd')}" if s.get("usd") is not None else "", f"{s.get('secs')} ש׳" if s.get("secs") else ""], [
            ("קירות", pct(g("walls")), cls_ok(g("walls"))), ("זיגוג", pct(g("glazing")), cls_ok(g("glazing"))),
            ("דלתות", pct(g("doors")), cls_ok(g("doors"))), ("ריהוט", pct(g("furniture")), ""),
            ("סטיית מצלמה (best_shift)", f"{(s.get('best_shift') or {}).get('deg', '—')}°", ""),
            ("נעילה (3 מחלקות ≥ 90%)", "כן" if lock else "לא", ' class="ok"' if lock else ' class="bad"')])))
    secs["A"] = "".join(c for _, _, c in sorted(cards_a))

    # ---------------------------------------------------------------- B flyover (video, for the record)
    cards_b = []
    for n in sorted(sb):
        s = sb[n]
        v = m.from_site(f"B_{n}.mp4")
        vid = f'<video src="{v}" muted loop playsinline controls preload="metadata"></video>' if v else "<p>אין תצוגה מקדימה</p>"
        ag = s.get("clay_edges_found_f1_mid_last") or []
        cards_b.append(card("B", n, vid, [f"${s.get('usd')}" if s.get("usd") is not None else "", f"{s.get('secs')} ש׳" if s.get("secs") else ""], [
            ("פריימים", f"{s.get('frames', '—')} @ {s.get('fps', '—')}", ""),
            ("התאמה לקליי: התחלה / אמצע / סוף", " / ".join(pct(x) for x in ag) if ag else "—", "")]))
    if (src / "B-flyover/kling-4-full-flight.mp4").exists() and "kling-4-full-flight" not in sb:
        v = m.from_site("B_kling-4-full-flight.mp4")
        if v:
            cards_b.insert(0, card("B", "kling-4-full-flight", f'<video src="{v}" muted loop playsinline controls preload="metadata"></video>',
                                   ["$3.20", "409 פריימים"], [("מה נבדק", "בעין, פריים מול פריים (README של 89)", "")]))
    secs["B"] = "".join(cards_b)

    # ---------------------------------------------------------------- C pano restyle (+ the seam, computed here)
    c_src = cv2.imread(str(src / "inputs/C_pano_04-living_src.png"))
    W, H = c_src.shape[1], c_src.shape[0]
    seam_src = seam(c_src)
    c_in = m.from_site("C_input.jpg") or m.jpg(src / "inputs/C_pano_04-living_src.png", "C_input.jpg", 2048)
    cards_c = []
    seam_rows = {}
    for n in sorted(sc):
        s = sc[n]
        p = src / f"C-pano/{n}.png"
        sm = None
        if p.exists():
            sm = seam(cv2.resize(cv2.imread(str(p)), (W, H), interpolation=cv2.INTER_AREA))
            seam_rows[n] = sm
        ok = sm is not None and sm <= 1.5 * seam_src
        img = m.from_site(f"C_{n}.jpg") or m.jpg(p, f"C_{n}.jpg", 2048)
        cards_c.append((not ok, -(s.get("edges_kept_upper") or 0), card("C", n, swap(img, c_in, n, "לחיצה מחליפה לפנורמת המקור"), [
            f"${s.get('usd')}" if s.get("usd") is not None else "", f"{s.get('secs')} ש׳" if s.get("secs") else ""], [
            ("קצוות שנשמרו, חצי עליון", pct(s.get("edges_kept_upper")), ""), ("חצי תחתון", pct(s.get("edges_kept_lower")), ""),
            ("תפר 360 (L/R)", f"{sm}" if sm is not None else "—", ' class="ok"' if ok else ' class="bad"'),
            ("תפר המקור", f"{seam_src}", "")], " wide")))
    secs["C"] = "".join(c for _, _, c in sorted(cards_c))

    # ---------------------------------------------------------------- E exterior 360 nodes
    cards_e = []
    for sf in sorted(glob.glob(str(src / "scores-E-*.json"))):
        node = Path(sf).stem[len("scores-E-"):]
        s_all = jload(sf)
        clay = src / f"inputs/E_{node}_clay.png"
        e_in = m.jpg(clay, f"E_{node}_input.jpg", 2048) if clay.exists() else ""
        sseam = (s_all.get("SOURCE") or {}).get("seam")
        rows = []
        for n, s in s_all.items():
            if n == "SOURCE":
                continue
            p = src / f"E-exterior-pano/{node}/{n}.png"
            img = m.jpg(p, f"E_{node}_{n}.jpg", 2048) if p.exists() else ""
            bc = s.get("by_class") or {}
            rows.append((-(s.get("edges_kept_upper") or 0), card("E", f"{node}:{n}", swap(img, e_in, n, f"{node}: לחיצה מחליפה לקליי"), [
                LABELS.get(n, n), f"${s.get('usd')}" if s.get("usd") is not None else ""], [
                ("קצוות, חצי עליון", pct(s.get("edges_kept_upper")), ""), ("חצי תחתון", pct(s.get("edges_kept_lower")), ""),
                ("קירות (id)", pct(bc.get("walls")), cls_ok(bc.get("walls"))), ("site (id)", pct(bc.get("site")), ""),
                ("תפר 360", f"{s.get('seam')}", ' class="ok"' if s.get("seam") is not None and sseam and s["seam"] <= 1.5 * max(sseam, 1) else ' class="bad"'),
                ("תפר הקליי", f"{sseam}", "")], " wide")))
        if rows:
            cards_e.append(f'<h3 class="node">{esc(node)}</h3><div class="grid">' + "".join(c for _, c in sorted(rows)) + "</div>")
    secs["E"] = "".join(cards_e)

    # ---------------------------------------------------------------- habait-bench runs (card 29)
    runs = []
    for mf in sorted(glob.glob(str(Path(bench_local) / "*" / "*" / "metrics.json"))):
        mm = jload(mf)
        if Path(mf).parts[-3] == "_selftest":
            continue
        rows = {k: v for k, v in (mm.get("rows") or {}).items() if not k.startswith("_")}
        runs.append(f'<tr><td dir="ltr">{esc(mm.get("endpoint"))}</td><td>{esc(mm.get("track"))}</td><td>{len(rows)}</td>'
                    f'<td>{"עבר" if mm.get("pass") else "נכשל"}</td><td dir="ltr">{esc(mm.get("made"))}</td></tr>')
    runs_html = ("<table><thead><tr><th>endpoint</th><th>מסלול</th><th>פלטים</th><th>שערים</th><th>מתי</th></tr></thead><tbody>"
                 + "".join(runs) + "</tbody></table>") if runs else (
        '<p class="note">עדיין אין ריצות של habait-bench (הכרטיס רץ ב-dry-run בלבד, $0). ריצה אמיתית: '
        '<code dir="ltr">habait_bench.py &lt;endpoint&gt; --tracks keyframe,flyover,pano --cap 10 --i-approve</code> '
        'אחרי אישור של אלירן לאותה ריצה; התוצאות יופיעו כאן אחרי <code dir="ltr">--rebuild-page</code>.</p>')

    tot = {t: ledger_total(src, t) for t in "ABC"}
    tot["E"] = sum(ledger_total(src, Path(p).stem[len("ledger-"):]) for p in glob.glob(str(src / "ledger-E*.json")))
    made = time.strftime("%Y-%m-%d %H:%M")
    page = TEMPLATE.format(
        made=esc(made), src=esc(src.as_posix()), seam_src=esc(SEAM_SOURCE), a_in=a_in,
        refs="".join(f'<figure><img src="{r}" alt="ref"><figcaption>ייחוס {i + 1} (פנורמת הסיור)</figcaption></figure>' for i, r in enumerate(refs) if r),
        c_in=c_in, seam_c=seam_src,
        A=secs["A"], B=secs["B"], C=secs["C"], E=secs["E"], runs=runs_html,
        vA=esc(VERDICT_89["A"]), vB=esc(VERDICT_89["B"]), vC=esc(VERDICT_89["C"]), vE=esc(VERDICT_89["E"]),
        tA=f"{tot['A']:.2f}", tB=f"{tot['B']:.2f}", tC=f"{tot['C']:.2f}", tE=f"{tot['E']:.2f}",
        nA=len(cards_a), nB=len(cards_b), nC=len(cards_c), nE=sum(1 for p in glob.glob(str(src / "E-exterior-pano/*/*.png"))))
    out_html.write_text(page, encoding="utf-8")
    (out_dir / "page-data.json").write_text(json.dumps({"made": made, "from": str(src), "seam_source": SEAM_SOURCE,
                                                        "pano_C_seam": {"source": seam_src, **seam_rows},
                                                        "cards": {"A": len(cards_a), "B": len(cards_b), "C": len(cards_c)}},
                                                       indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"page: {out_html.as_posix()}  cards A={len(cards_a)} B={len(cards_b)} C={len(cards_c)} E nodes={len(cards_e)}  "
          f"media {m.n} files {m.bytes / 1e6:.1f} MB  pano seam (89's seam()): source {seam_src}, "
          + ", ".join(f"{k} {v}" for k, v in sorted(seam_rows.items(), key=lambda kv: kv[1])) + "  spent $0")
    return 0 if (cards_a and cards_c) else 1


TEMPLATE = """<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Habait bench: השוואת מודלים</title>
<style>
:root {{ --bg:#f6f4ef; --fg:#1d1b17; --muted:#6b665c; --line:#dcd7cc; --card:#fff; --accent:#0e5a4a; --accent-fg:#fff; --chip:#ece8df; --ok:#1d7a52; --bad:#b23a1a;
  --sans:'Heebo',system-ui,'Segoe UI',Arial,sans-serif; --mono:ui-monospace,Consolas,monospace }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#15171a; --fg:#ece9e2; --muted:#a39d91; --line:#2d3137; --card:#1e2126; --accent:#5fc3a6; --accent-fg:#0d1b17; --chip:#272b31; --ok:#5fc3a6; --bad:#e08a6a; color-scheme:dark }} }}
body {{ background:var(--bg); color:var(--fg); font-family:var(--sans); font-size:15px; line-height:1.55; margin:0; padding:0 16px 48px }}
main {{ max-width:1320px; margin:0 auto }}
h1 {{ font-size:clamp(1.5rem,3vw,2.1rem); margin:24px 0 4px }}
h2 {{ font-size:1.3rem; margin:0 0 6px }} h3 {{ font-size:1rem; font-weight:600; margin:0 }} h3.node {{ margin:18px 0 8px; font-family:var(--mono); direction:ltr; text-align:right }}
p.lead, .note {{ color:var(--muted); max-width:80ch }}
.verdict {{ background:var(--card); border-inline-start:4px solid var(--accent); padding:8px 12px; margin:8px 0 14px; max-width:90ch }}
nav.tabs {{ position:sticky; top:0; z-index:5; background:var(--bg); display:flex; gap:8px; padding:10px 0; border-bottom:1px solid var(--line); margin-bottom:16px; flex-wrap:wrap }}
nav.tabs a {{ text-decoration:none; color:var(--fg); padding:6px 14px; border:1px solid var(--line); border-radius:999px; background:var(--card) }}
nav.tabs a[aria-current="true"] {{ background:var(--accent); color:var(--accent-fg); border-color:var(--accent) }}
section.track {{ display:none }} section.track.on {{ display:block }}
.inputs {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin:12px 0 20px }}
.inputs figure {{ margin:0; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:8px }}
.inputs img {{ width:100%; display:block; border-radius:4px }}
figcaption {{ font-size:.8rem; color:var(--muted); margin-top:6px }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(380px,1fr)); gap:16px }}
.grid .wide {{ grid-column:1 / -1 }}
.card {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px; min-width:0 }}
.card.picked {{ outline:3px solid var(--accent) }}
.card header {{ display:flex; flex-wrap:wrap; gap:6px 10px; align-items:center }} .card header h3 {{ flex:1 1 100% }}
.chip {{ font-family:var(--mono); font-size:.75rem; background:var(--chip); padding:2px 8px; border-radius:999px; color:var(--muted); direction:ltr }}
.card figure {{ margin:0 }} .card img, .card video {{ width:100%; display:block; border-radius:6px; background:#000; cursor:pointer }}
dl {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:6px 12px; margin:0; font-size:.85rem }}
dl div {{ display:flex; justify-content:space-between; gap:8px; border-bottom:1px dashed var(--line); padding-bottom:3px }}
dt {{ color:var(--muted) }} dd {{ margin:0; font-family:var(--mono); direction:ltr }} dd.ok {{ color:var(--ok); font-weight:600 }} dd.bad {{ color:var(--bad) }}
button.pick {{ align-self:flex-start; background:transparent; color:var(--accent); border:1px solid var(--accent); border-radius:999px; padding:6px 14px; font:inherit; cursor:pointer }}
.card.picked button.pick {{ background:var(--accent); color:var(--accent-fg) }}
table {{ border-collapse:collapse; background:var(--card) }} td, th {{ border:1px solid var(--line); padding:4px 10px }}
code {{ font-family:var(--mono); background:var(--chip); padding:1px 6px; border-radius:4px }}
aside.summary {{ position:sticky; bottom:0; background:var(--card); border-top:1px solid var(--line); padding:10px 0; margin-top:24px; display:flex; gap:12px; align-items:center; flex-wrap:wrap }}
</style></head><body><main>
<h1>Habait bench: השוואת מודלים על אותם קלטים של דירה 846</h1>
<p class="lead">נבנה מחדש ב-{made} מהתוצאות הקיימות של habait-89 (<code dir="ltr">{src}</code>) בלי אף קריאה בתשלום ($0), כהוכחה שהצינור של כרטיס 29 עובד. אותו קלט ואותו פרומפט לכל מודל; המדדים מחושבים מול הקליי ב-$0; השיפוט הסופי בעין (D-WQ-12). מדד התפר בפנורמות: <code dir="ltr">{seam_src}</code>.</p>
<nav class="tabs"><a href="#keyframe" data-tab="A">A · keyframe מקליי ({nA})</a><a href="#pano" data-tab="C">C · פנורמה ({nC})</a><a href="#exterior" data-tab="E">E · נודי 360 בחוץ ({nE})</a><a href="#flyover" data-tab="B">B · וידאו ריחוף, לרשומה ({nB})</a><a href="#runs" data-tab="R">ריצות habait-bench</a></nav>

<section class="track" id="trackA"><h2>A · keyframe פוטוריאלי מרנדר קליי (הסלון מהמרפסת)</h2>
<p class="verdict">{vA}</p>
<p class="note">מדד: אחוז קצוות הקליי שנמצאו בתוצאה לפי מחלקה (kf_check.py). נעילת מצלמה = קירות, זיגוג ודלתות כל אחד ≥ 90%. best_shift לא אמין על תמונות מעוצבות מחדש. ממוין: נעולים קודם. הוצאה במסלול: ${tA}.</p>
<div class="inputs"><figure><img src="{a_in}" alt="clay"><figcaption>הקלט: רנדר קליי</figcaption></figure>{refs}</div>
<div class="grid">{A}</div></section>

<section class="track" id="trackC"><h2>C · restyle של פנורמת 360 (הסלון)</h2>
<p class="verdict">{vC}</p>
<p class="note">מדד: קצוות המקור שנשמרו (חצי עליון / תחתון), ותפר 360: ההפרש הממוצע בין 8 העמודות השמאליות ל-8 הימניות (מחושב כאן מהקבצים של 89 עם הפונקציה שלו; ירוק = עד פי 1.5 מהמקור, {seam_c}). הוצאה במסלול: ${tC}.</p>
<div class="inputs"><figure><img src="{c_in}" alt="source pano"><figcaption>הקלט: פנורמת המקור</figcaption></figure></div>
<div class="grid">{C}</div></section>

<section class="track" id="trackE"><h2>E · פנורמות 360 חיצוניות מקליי</h2>
<p class="verdict">{vE}</p>
<p class="note">מדדי קצוות מטעים בחוץ (Seedream קיבל site 93% למרות שהגדיל את המגדל); לשפוט בעין מול הקליי. הוצאה: ${tE}.</p>
{E}</section>

<section class="track" id="trackB"><h2>B · וידאו ריחוף מקליפ קליי (לרשומה: אין וידאו במוצר)</h2>
<p class="verdict">{vB}</p>
<p class="note">ב-habait-bench מסלול הריחוף הוא N פריימי equirect של טיסת הקליי, כל אחד בקריאה נפרדת, עם kf_check לכל פריים ועקביות בזמן. כאן: תוצאות הווידאו של 89 כפי שהן. הוצאה במסלול: ${tB}.</p>
<div class="grid">{B}</div></section>

<section class="track" id="trackR"><h2>ריצות habait-bench (כרטיס 29)</h2>{runs}</section>

<aside class="summary"><strong>הבחירות שלך:</strong> <code id="picks">עדיין לא נבחר כלום</code></aside>
</main>
<script>
(function(){{
  var tabs=document.querySelectorAll('nav.tabs a'), ids={{A:'trackA',B:'trackB',C:'trackC',E:'trackE',R:'trackR'}}, hs={{keyframe:'A',flyover:'B',pano:'C',exterior:'E',runs:'R'}};
  function show(t){{ for(var k in ids) document.getElementById(ids[k]).classList.toggle('on',k===t); tabs.forEach(function(a){{ a.setAttribute('aria-current', a.dataset.tab===t?'true':'false'); }}); }}
  function fromHash(){{ show(hs[(location.hash||'').slice(1)]||'A'); }} window.addEventListener('hashchange',fromHash); fromHash();
  document.querySelectorAll('figure.swap img').forEach(function(img){{ img.tabIndex=0; function sw(){{ img.src = img.getAttribute('src')===img.dataset.out ? img.dataset.src : img.dataset.out; }} img.addEventListener('click',sw); img.addEventListener('keydown',function(e){{ if(e.key==='Enter'||e.key===' '){{e.preventDefault();sw();}} }}); }});
  var picks={{}}; try{{ picks=JSON.parse(localStorage.getItem('habait-bench-picks')||'{{}}'); }}catch(e){{}}
  function render(){{ document.querySelectorAll('.card').forEach(function(c){{ c.classList.toggle('picked', picks[c.dataset.track]===c.dataset.name); }});
    var p=[]; ['A','C','E','B'].forEach(function(t){{ if(picks[t]) p.push(t+': '+picks[t]); }}); document.getElementById('picks').textContent=p.length?p.join(' · '):'עדיין לא נבחר כלום'; }}
  document.querySelectorAll('button.pick').forEach(function(b){{ b.addEventListener('click',function(){{ var c=b.closest('.card'); picks[c.dataset.track]=picks[c.dataset.track]===c.dataset.name?undefined:c.dataset.name; try{{ localStorage.setItem('habait-bench-picks',JSON.stringify(picks)); }}catch(e){{}} render(); }}); }});
  render();
}})();
</script></body></html>
"""
