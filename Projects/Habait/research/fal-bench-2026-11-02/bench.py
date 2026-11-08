"""bench.py - the fal model benchmark for Habait (2026-11-02). Same input, same prompt, many models.

  python -I bench.py A|B|C [--dry] [--only name1,name2] [--par 4]

A  clay frame (ext-enter, the living room from the terrace, 1280x720) + 3 tour pano crops -> photoreal keyframe
B  5 s clay flyover clip (ext-flight-s1, 121 fr) + its photoreal first frame -> photoreal flyover video
C  360 pano of the living room (2048x1024) -> same pano re-textured (parquet, zero-line doors, no skirting)
Outputs: <track dir>/<model-name>.<png|mp4> (+ .json). Ledger: ledger-<track>.json. Existing outputs are skipped.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
PY = sys.executable
IN = HERE + "/inputs"
f = lambda p: "@file:" + IN + "/" + p  # noqa: E731

# ---------------------------------------------------------------- prompts (copied from the studio's own scripts)
FLOOR = "a wide-plank natural oak parquet floor, matte, pale honey tone, long planks laid lengthwise, no gloss"
TOUR_LOOK = (
    f"{FLOOR}; the floor meets the walls with NO skirting board (a clean shadow-gap line, no baseboard); warm white "
    "plastered walls; a flat warm white ceiling with slim recessed spots and a linear warm LED cove; a micro-cement feature wall in warm "
    "greige behind the TV; zero-line interior doors (full-height, frameless, flush with the wall, no architrave, no panels, painted the wall "
    "colour, a slim matte black lever); a bulthaup kitchen with "
    "handleless matte sand-grey lacquer fronts and a thin brushed stainless-steel worktop; slim black-framed floor-to-ceiling glazing with "
    "sheer off-white linen curtains; the furniture of the reference photos: a cream boucle curved sectional sofa, a round pale travertine "
    "coffee table, a woven jute round rug, a cream boucle swivel armchair, a low sand-grey lacquer TV unit, a round light-oak dining table "
    "with cream upholstered chairs under a white paper pendant, olive trees in stone planters on the terrace"
)
FURN = ("(the sofa becomes the cream boucle sectional, the armchair the cream swivel chair, the TV unit the low sand-grey lacquer unit, "
        "the coffee table the round travertine table)")


def prompt_a(n_refs, tags=False):
    refs = ", ".join((f"<image-{i}>" if tags else f"{i}") for i in range(2, 2 + n_refs))
    img1 = "<image-1>" if tags else "Image 1"
    ref_words = (
        f"{'' if tags else 'Images '}{refs} are photographs of the SAME apartment (its 360° tour, already furnished in its final design): "
        f"copy their materials, furniture style, colours, light and mood exactly, never their framing, EXCEPT the floor: ignore the tiled "
        f"floor of the reference photos, the floor of this image is {FLOOR}, one continuous surface across the whole apartment, no tiles "
        f"and no grout lines anywhere"
    )
    return (
        f"{img1} is a plain computer render (a clay render) of the living room of a new apartment in the Rainbow tower, Tel Aviv. "
        f"Re-render it as a photograph taken from exactly the same camera: the same position, angle, lens and crop, every wall, ceiling, "
        f"floor plane, door, window frame and the glass slider at exactly the same pixel position, nothing added, removed or moved. "
        f"{ref_words}. The look: {TOUR_LOOK}. Every plain furniture piece of {img1} becomes a designer piece of the same size at the same "
        f"place in that style {FURN}, keeping the floor layout of {img1}. Soft bright morning daylight. Photoreal, sharp, natural colours. "
        f"No people, no text, no logos, no watermark."
    )


PROMPT_C = (
    "Image 1 is a 360-degree equirectangular panorama (2:1) of a room in an apartment. Return the SAME equirectangular panorama with "
    "EXACTLY the same projection, framing and geometry: every wall, ceiling, window, glass slider, wardrobe, kitchen unit, sanitary fixture "
    "and piece of furniture at exactly the same pixel position, the same light and colours, nothing added, removed, moved or resized. "
    f"Change ONLY these finishes: (1) the floor everywhere becomes {FLOOR}, one continuous surface with no grout lines and no tiles (in "
    "bathrooms and on terraces the same floor); (2) every interior door becomes a zero-line flush door in cream, frameless, no architrave, "
    "no panels, with a slim matte black lever (a dark blue or wooden door too); (3) remove every skirting board so the floor meets the "
    "walls in a clean line; (4) where a kitchen is visible its cabinetry continues to the end of its wall with matching handleless "
    "sand-grey lacquer fronts, no bare wall strip. Photoreal, sharp, a very high-end luxury finish. No people, no text, no logos."
)

PROMPT_V2V = (
    "@Video1 is a plain grey 3D clay render of a drone flight over the Tel Aviv coast (Sde Dov) toward the Rainbow tower, a 39-floor "
    "residential tower wrapped in white undulating curved balcony slabs. Re-render the SAME footage as photoreal aerial drone video: keep "
    "every frame's camera motion, perspective, horizon and building geometry exactly as in @Video1, only replace the clay materials with "
    "real ones. @Image1 shows the real look to copy: white curved balconies with planters, slim black glazing, the Mediterranean sea and "
    "beach, the Reading power-station chimney, low white buildings, trees, roads, soft morning sun, clear sky. Smooth, continuous, no cuts, "
    "no text, no people, no watermark."
)
PROMPT_I2V = (
    "Aerial drone shot: a slow, steady forward glide with a gentle descent over the Tel Aviv coast toward the Rainbow tower (white "
    "undulating curved balconies), the Mediterranean sea and beach on the left, the Reading chimney behind, low white buildings, trees and "
    "roads below, soft morning sun. Smooth continuous camera, photoreal, no cuts, no text, no people."
)

CLAY_A = f("A_clay_ext-enter.png")
REFS3 = [f("tour-living-yaw0.png"), f("tour-living-yaw70.png"), f("tour-living-yaw-70.png")]
PANO = f("C_pano_04-living_src.png")
CLAY_V = f("B_clay_s1_5s.mp4")
KF_FIRST = f("B_keyframe_s1_first.png")
KF_LAST = f("B_keyframe_s1_last_from_ltx.png")

# ---------------------------------------------------------------- jobs: (name, endpoint, args, est_usd)
A = [
    ("gpt-image-2.5", "openai/gpt-image-2.5/sunburst/edit",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "image_size": {"width": 1920, "height": 1080}, "quality": "high"}, 1.20),
    ("nano-banana-pro", "fal-ai/nano-banana-pro/edit",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "resolution": "1K", "aspect_ratio": "16:9", "output_format": "png"}, 0.15),
    ("nano-banana-2.1", "google/nano-banana-2.1/edit",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "resolution": "1K", "aspect_ratio": "16:9", "output_format": "png"}, 0.12),
    ("nano-banana-2", "fal-ai/nano-banana-2/edit",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "resolution": "1K", "aspect_ratio": "16:9", "output_format": "png"}, 0.08),
    ("flux-2-pro", "fal-ai/flux-2-pro/edit",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "image_size": {"width": 1280, "height": 720}, "output_format": "png"}, 0.09),
    ("flux-2-max", "fal-ai/flux-2-max/edit",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "image_size": {"width": 1280, "height": 720}, "output_format": "png"}, 0.20),
    ("flux-3", "blackforestlabs/flux-3/edit-image",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "aspect_ratio": "16:9", "resolution": "1k", "output_format": "png"}, 0.05),
    ("seedream-5-pro", "bytedance/seedream/v5/pro/edit",
     {"prompt": prompt_a(3), "image_urls": [CLAY_A, *REFS3], "image_size": {"width": 1280, "height": 720}, "output_format": "png"}, 0.15),
    ("qwen-image-3", "alibaba/qwen-image-3/edit",
     {"prompt": prompt_a(2), "image_urls": [CLAY_A, *REFS3[:2]], "enable_prompt_expansion": False, "output_format": "png"}, 0.04),
    ("krea-3", "krea/v3/edit",
     {"prompt": prompt_a(3, tags=True), "image_urls": [CLAY_A, *REFS3], "reasoning_level": "high", "model": "berry", "output_format": "png"}, 0.15),
    ("grok-imagine-quality", "xai/grok-imagine-image/quality/edit",
     {"prompt": prompt_a(2), "image_urls": [CLAY_A, *REFS3[:2]], "resolution": "1k", "aspect_ratio": "16:9", "output_format": "png"}, 0.08),
]

C = [
    ("nano-banana-pro", "fal-ai/nano-banana-pro/edit",
     {"prompt": PROMPT_C, "image_urls": [PANO], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}, 0.30),
    ("nano-banana-2.1", "google/nano-banana-2.1/edit",
     {"prompt": PROMPT_C, "image_urls": [PANO], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}, 0.20),
    ("nano-banana-2", "fal-ai/nano-banana-2/edit",
     {"prompt": PROMPT_C, "image_urls": [PANO], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}, 0.12),
    ("flux-2-pro", "fal-ai/flux-2-pro/edit",
     {"prompt": PROMPT_C, "image_urls": [PANO], "image_size": {"width": 2048, "height": 1024}, "output_format": "png"}, 0.08),
    ("flux-3", "blackforestlabs/flux-3/edit-image",
     {"prompt": PROMPT_C, "image_urls": [PANO], "aspect_ratio": "2:1", "resolution": "2k", "output_format": "png"}, 0.10),
    ("seedream-5-pro", "bytedance/seedream/v5/pro/edit",
     {"prompt": PROMPT_C, "image_urls": [PANO], "image_size": {"width": 2048, "height": 1024}, "output_format": "png"}, 0.15),
    ("qwen-image-3", "alibaba/qwen-image-3/edit",
     {"prompt": PROMPT_C, "image_urls": [PANO], "image_size": {"width": 2048, "height": 1024}, "enable_prompt_expansion": False, "output_format": "png"}, 0.08),
    ("krea-3", "krea/v3/edit",
     {"prompt": PROMPT_C.replace("Image 1", "<image-1>"), "image_urls": [PANO], "image_size": {"width": 2048, "height": 1024},
      "reasoning_level": "high", "model": "berry", "output_format": "png"}, 0.15),
    ("grok-imagine-quality", "xai/grok-imagine-image/quality/edit",
     {"prompt": PROMPT_C, "image_urls": [PANO], "resolution": "2k", "aspect_ratio": "2:1", "output_format": "png"}, 0.10),
]

B = [
    # clay video -> photoreal video (the camera path comes from the clay)
    ("kling-4-v2v-edit", "kling/v4/video-to-video/edit",
     {"video_url": CLAY_V, "prompt": PROMPT_V2V, "image_urls": [KF_FIRST], "resolution": "720p", "duration": 5}, 0.94),
    ("kling-o3-pro-v2v-edit", "fal-ai/kling-video/o3/pro/video-to-video/edit",
     {"video_url": CLAY_V, "prompt": PROMPT_V2V, "image_urls": [KF_FIRST], "keep_audio": False}, 0.84),
    ("wan-3.0-reference", "alibaba/wan-3.0/reference-to-video",
     {"prompt": PROMPT_V2V.replace("@Video1", "video 1").replace("@Image1", "image 1"), "reference_video_urls": [CLAY_V],
      "reference_image_urls": [KF_FIRST], "resolution": "720p", "duration": 5, "audio": False, "enable_prompt_expansion": False,
      "aspect_ratio": "16:9"}, 0.50),
    ("flux-3-edit-video", "blackforestlabs/flux-3/edit-video",
     {"video_url": CLAY_V, "prompt": PROMPT_V2V.replace("@Video1", "the input video").replace("@Image1 shows", "Use")}, 0.15),
    ("ltx-2.3-render-to-real-5s", "fal-ai/ltx-2.3-quality/render-to-real",
     {"video_url": CLAY_V, "image_url": KF_FIRST, "prompt": "3DREAL. photoreal aerial drone footage of the Tel Aviv coast and the Rainbow tower, white curved balconies, sea, beach, morning sun", "intensity": "strong-v2", "resolution": "720p", "num_frames": 121, "generate_audio": False}, 0.27),
    ("gemini-omni-flash-edit", "google/gemini-omni-flash/v1.1/edit",
     {"video_url": CLAY_V, "prompt": "Turn this grey 3D architectural render into realistic drone footage of a modern white residential tower with curved balconies on the Tel Aviv seafront, morning light; keep the same camera motion and geometry.", "resolution": "720p"}, 0.50),
    # photoreal first (+ last) frame -> video, no clay guidance (how well does a plain i2v hold the building?)
    ("kling-3-pro-i2v", "fal-ai/kling-video/v3/pro/image-to-video",
     {"start_image_url": KF_FIRST, "end_image_url": KF_LAST, "prompt": PROMPT_I2V, "duration": "5", "generate_audio": False}, 0.56),
    ("wan-3.0-i2v", "alibaba/wan-3.0/image-to-video",
     {"start_image_url": KF_FIRST, "end_image_url": KF_LAST, "prompt": PROMPT_I2V, "resolution": "720p", "duration": 5, "audio": False,
      "enable_prompt_expansion": False, "aspect_ratio": "16:9"}, 0.50),
    ("flux-3-max-keyframes", "blackforestlabs/flux-3-max/keyframes-to-video",
     {"keyframes": [{"image_url": KF_FIRST, "frame_index": 0}, {"image_url": KF_LAST, "frame_index": 120}], "prompt": PROMPT_I2V,
      "duration": 5, "resolution": "720p", "generate_audio": False, "aspect_ratio": "16:9"}, 0.22),
]


# ---------------------------------------------------------------- D: branch continuity (continue from a given photoreal frame along the clay)
ANCHOR = f("D_anchor_f193.png"); MID = f("D_mid_f300.png"); END = f("D_end_f409.png")
CLAY_D = f("D_clay_193_409.mp4"); CLAY_D137 = f("D_clay_193_329.mp4"); INTERIOR = f("B_kf_interior_gpt.png")
PROMPT_D = (
    "@Video1 is a plain grey 3D clay render of the camera continuing a single continuous shot: it starts on the terrace of the 16th floor of the "
    "Rainbow tower, Tel Aviv, glides toward and through the open glass slider into the living room, and moves across the room toward the door. "
    "@Image1 is the EXACT photoreal first frame of this shot: start from it exactly (same framing, same materials, same light) and keep its look "
    "for the whole clip. Keep every frame's camera motion, perspective and geometry exactly as in @Video1, only replace the clay with real materials. "
    "@Image2 is the look of the living room: wide-plank pale oak parquet, warm white plaster walls, cream boucle curved sofa, round travertine table, "
    "jute rug, sand-grey kitchen, cream flush doors without frames, no skirting. Bright clear morning daylight, neutral white light. "
    "Smooth, continuous, no cuts, no text, no people, no watermark."
)
PROMPT_D_I2V = (
    "One continuous shot: from a terrace on the 16th floor of a modern tower in Tel Aviv the camera glides forward through the open glass "
    "slider into a bright living room (pale oak parquet, cream boucle sofa, travertine table, jute rug, sand-grey kitchen, cream flush doors) and "
    "moves across the room toward the door. Steady smooth camera, photoreal, morning light, no cuts, no people, no text."
)
D = [
    ("ltx-anchor-light", "fal-ai/ltx-2.3-quality/render-to-real",
     {"video_url": CLAY_D137, "image_url": ANCHOR, "prompt": "3DREAL. photoreal continuous shot from a terrace through an open glass slider into a bright living room with pale oak parquet, cream boucle sofa, travertine table, sand-grey kitchen, morning light",
      "intensity": "light", "resolution": "720p", "num_frames": 137, "generate_audio": False}, 0.30),
    ("ltx-anchor-strong-v2", "fal-ai/ltx-2.3-quality/render-to-real",
     {"video_url": CLAY_D137, "image_url": ANCHOR, "prompt": "3DREAL. photoreal continuous shot from a terrace through an open glass slider into a bright living room with pale oak parquet, cream boucle sofa, travertine table, sand-grey kitchen, morning light",
      "intensity": "strong-v2", "resolution": "720p", "num_frames": 137, "generate_audio": False}, 0.30),
    ("kling-4-anchor", "kling/v4/video-to-video/edit",
     {"video_url": CLAY_D, "prompt": PROMPT_D, "image_urls": [ANCHOR, INTERIOR], "resolution": "720p", "duration": 9}, 1.70),
    ("kling-o3-pro-anchor", "fal-ai/kling-video/o3/pro/video-to-video/edit",
     {"video_url": CLAY_D, "prompt": PROMPT_D, "image_urls": [ANCHOR, INTERIOR], "keep_audio": False}, 1.52),
    ("kling-3-pro-i2v-anchor", "fal-ai/kling-video/v3/pro/image-to-video",
     {"start_image_url": ANCHOR, "end_image_url": END, "prompt": PROMPT_D_I2V, "duration": "9", "generate_audio": False}, 1.01),
    ("wan-3.0-i2v-anchor", "alibaba/wan-3.0/image-to-video",
     {"start_image_url": ANCHOR, "end_image_url": END, "prompt": PROMPT_D_I2V, "resolution": "720p", "duration": 10, "audio": False,
      "enable_prompt_expansion": False, "aspect_ratio": "16:9"}, 1.00),
    ("flux-3-max-keyframes-anchor", "blackforestlabs/flux-3-max/keyframes-to-video",
     {"keyframes": [{"image_url": ANCHOR, "frame_index": 0}, {"image_url": MID, "frame_index": 107}, {"image_url": END, "frame_index": 216}],
      "prompt": PROMPT_D_I2V, "duration": 9, "resolution": "720p", "generate_audio": False, "aspect_ratio": "16:9"}, 0.38),
]


# ---------------------------------------------------------------- E: exterior clay EQUIRECT -> photoreal 360 node (the new critical step)
# usage: python bench.py E --node <name>   (expects inputs/E_<name>_clay.png, 2:1 equirect; refs = Kling flight frames)
import sys as _sys
NODE = _sys.argv[_sys.argv.index("--node") + 1] if "--node" in _sys.argv else "node"
CLAY_E = f(f"E_{NODE}_clay.png")
REFS_E = [f("E_ref_aerial_f1.png"), f("E_ref_facade_f110.png"), f("E_ref_terrace_f164.png")]
def prompt_e(n_refs, tags=False):
    refs = ", ".join((f"<image-{i}>" if tags else f"{i}") for i in range(2, 2 + n_refs))
    img1 = "<image-1>" if tags else "Image 1"
    return (
        f"{img1} is a plain grey 3D clay render, a 360-degree equirectangular panorama (2:1) of the Rainbow tower site on the Tel Aviv coast "
        f"(Sde Dov): the tower, the low buildings of the compound, the city, the beach and the Mediterranean sea. Return the SAME equirectangular "
        f"panorama with EXACTLY the same projection and framing: the horizon at the same height, every drawn building, the tower's outline and "
        f"every balcony slab at exactly the same pixel position, nothing moved or resized; the left and right edges must continue each other "
        f"seamlessly (it wraps around). The plain grey ground is only a placeholder: fill it with the real surroundings as in the photographs "
        f"(the city's streets, roofs, trees, the beach, the sea, the coastline where the sea patch is drawn), keeping every drawn building. "
        f"Replace the grey clay of the buildings with real materials: "
        f"{'' if tags else 'Images '}{refs} are photographs of the SAME tower and site, copy their look exactly: the 39-floor tower wrapped in white "
        f"undulating curved balcony slabs with planters and slim black glazing, white low buildings with perforated balcony screens, the Reading "
        f"power-station chimney, Mediterranean sea and beach, palm trees, roads with cars, bright clear morning daylight, blue sky with few clouds. "
        f"Photoreal, sharp, natural colours. No people, no text, no logos, no watermark."
    )
E = [
    ("gpt-image-2.5", "openai/gpt-image-2.5/sunburst/edit",
     {"prompt": prompt_e(3), "image_urls": [CLAY_E, *REFS_E], "image_size": {"width": 2048, "height": 1024}, "quality": "high"}, 1.20),
    ("seedream-5-pro", "bytedance/seedream/v5/pro/edit",
     {"prompt": prompt_e(3), "image_urls": [CLAY_E, *REFS_E], "image_size": {"width": 2048, "height": 1024}, "output_format": "png"}, 0.20),
    ("nano-banana-pro", "fal-ai/nano-banana-pro/edit",
     {"prompt": prompt_e(3), "image_urls": [CLAY_E, *REFS_E], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}, 0.30),
    ("nano-banana-2.1", "google/nano-banana-2.1/edit",
     {"prompt": prompt_e(3), "image_urls": [CLAY_E, *REFS_E], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}, 0.20),
    ("nano-banana-2", "fal-ai/nano-banana-2/edit",
     {"prompt": prompt_e(3), "image_urls": [CLAY_E, *REFS_E], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}, 0.12),
    ("krea-3", "krea/v3/edit",
     {"prompt": prompt_e(3, tags=True), "image_urls": [CLAY_E, *REFS_E], "image_size": {"width": 2048, "height": 1024}, "reasoning_level": "high",
      "model": "berry", "output_format": "png"}, 0.20),
    ("flux-2-max", "fal-ai/flux-2-max/edit",
     {"prompt": prompt_e(3), "image_urls": [CLAY_E, *REFS_E], "image_size": {"width": 2048, "height": 1024}, "output_format": "png"}, 0.25),
]

TRACKS = {"A": (A, "A-keyframe", "png"), "B": (B, "B-flyover", "mp4"), "C": (C, "C-pano", "png"), "D": (D, "D-branch", "mp4"), "E": (E, f"E-exterior-pano/{NODE}", "png")}


def main():
    track = sys.argv[1]
    jobs, out_dir, ext = TRACKS[track]
    dry = "--dry" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    par = int(sys.argv[sys.argv.index("--par") + 1]) if "--par" in sys.argv else 4
    out_dir = HERE + "/" + out_dir
    os.makedirs(out_dir, exist_ok=True)
    env = dict(os.environ, BENCH_LEDGER=f"{HERE}/ledger-{track}{('-' + NODE) if track == 'E' else ''}.json", PYTHONIOENCODING="utf-8")
    total = 0.0
    todo = []
    for name, endpoint, args, usd in jobs:
        if only and name not in only:
            continue
        out = f"{out_dir}/{name}.{ext}"
        if os.path.exists(out):
            print(f"exists: {out}")
            continue
        total += usd
        todo.append((name, endpoint, args, usd, out))
    print(f"track {track}: {len(todo)} calls, est ${total:.2f}")
    if dry:
        return

    def run(j):
        name, endpoint, args, usd, out = j
        cmd = [PY, "-I", HERE + "/run_fal.py", "--endpoint", endpoint, "--args", json.dumps(args), "--out", out,
               "--price", str(usd), "--note", f"{track} {name}"]
        r = subprocess.run(cmd, capture_output=True, text=True, env=env, encoding="utf-8", errors="replace")
        tail = (r.stdout.strip().splitlines() or [""])[-1]
        err = (r.stderr.strip().splitlines() or [""])[-1]
        print(f"[{track}] {name}: exit {r.returncode} | {tail} | {err[:300]}", flush=True)

    with ThreadPoolExecutor(max_workers=par) as ex:
        list(ex.map(run, todo))


if __name__ == "__main__":
    main()
