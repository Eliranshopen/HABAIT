"""Build the single-file Kaggle kernels (one folder per route) from the readable sources next to them.

python -I build_kernels.py            -> <route>/kaggle/{kernel_*.py, kernel-metadata.json}
Push:   python -m kaggle kernels push -p <route>/kaggle
Status: python -m kaggle kernels status eliranhabait/<slug>
Output: python -m kaggle kernels output eliranhabait/<slug> -p <route>/out
Kaggle credentials come from %USERPROFILE%/.kaggle/kaggle.json (never copied here). All kernels are private,
GPU, internet on, and read the private dataset eliranhabait/habait-orbit-inputs (site.glb, clay_5s.mp4,
kf_first.png, ref_aerial.png).
"""
import base64, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATASET = "eliranhabait/habait-orbit-inputs"
CAMERA_DATASET = "eliranhabait/habait-orbit-camera"  # flyover/orbit/camera.json (habait-flyover/orbit-camera.v1)


def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode()


def meta(slug, code, extra_ds=()):
    return {"id": f"eliranhabait/{slug}", "title": slug, "code_file": code, "language": "python", "kernel_type": "script",
            "is_private": True, "enable_gpu": True, "enable_internet": True, "dataset_sources": [DATASET, *extra_ds],
            "competition_sources": [], "kernel_sources": []}


def write(route, slug, code_name, src, sub="kaggle", extra_ds=()):
    d = os.path.join(HERE, route, sub)
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, code_name), "w", encoding="utf-8").write(src)
    json.dump(meta(slug, code_name, extra_ds), open(os.path.join(d, "kernel-metadata.json"), "w"), indent=1)
    print("built", route, slug, len(src), "bytes")


prompts = json.load(open(os.path.join(HERE, "prep", "prompts.json"), encoding="utf-8"))
prep = os.path.join(HERE, "prep", "prep_control.py")

# A: Blender Cycles
src = open(os.path.join(HERE, "A-blender-cycles", "kernel_a_driver.py"), encoding="utf-8").read()
src = src.replace('"__BPY_B64__"', repr(b64(os.path.join(HERE, "A-blender-cycles", "orbit_render.py"))))
write("A-blender-cycles", "habait-route-a-cycles", "kernel_a.py", src.replace("__MODE__", "proof"), extra_ds=[CAMERA_DATASET])
write("A-blender-cycles", "habait-route-a-cycles-full", "kernel_a_full.py", src.replace("__MODE__", "full"), "kaggle_full", [CAMERA_DATASET])

# B1: Wan2.2-Fun-5B-Control
r = os.path.join(HERE, "B1-wan22-fun5b-control")
files = {"prep_control.py": b64(prep), "t5_embed.py": b64(os.path.join(r, "t5_embed.py")), "run_fun5b.py": b64(os.path.join(r, "run_fun5b.py"))}
src = open(os.path.join(r, "kernel_b1_driver.py"), encoding="utf-8").read()
src = src.replace("__FILES__", repr(files)).replace("__PROMPTS__", repr(prompts))
write("B1-wan22-fun5b-control", "habait-route-b1-wan22-fun5b", "kernel_b1.py", src)

# B2: Wan2.1-VACE-1.3B
r = os.path.join(HERE, "B2-wan21-vace13b")
files = {"prep_control.py": b64(prep), "run_vace.py": b64(os.path.join(r, "run_vace.py"))}
src = open(os.path.join(r, "kernel_b2_driver.py"), encoding="utf-8").read()
src = src.replace("__FILES__", repr(files)).replace("__PROMPTS__", repr(prompts))
write("B2-wan21-vace13b", "habait-route-b2-vace13b", "kernel_b2.py", src)
