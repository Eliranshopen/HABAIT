"""Step 20 ($0) - the generated models (19_fal_3d.py) carry 4K textures (15-24 MB a piece): every embedded image is
re-encoded at <= --max px (JPEG for colour maps, PNG kept for maps with alpha), the GLB rebuilt with the same JSON
(bufferViews re-laid, 4-byte aligned). Geometry untouched. Writes <name>.web.glb next to the original (kept).
Usage: python 20_shrink_glb.py <in.glb> [--max 1024]
"""
import io, json, struct, sys
from PIL import Image

src = sys.argv[1]; MAX = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 1024
b = open(src, "rb").read()
magic, ver, total = struct.unpack_from("<III", b, 0)
assert magic == 0x46546C67, "not a GLB"
off = 12; js = None; binc = b""
while off < len(b):
    ln, typ = struct.unpack_from("<II", b, off); data = b[off + 8: off + 8 + ln]; off += 8 + ln
    if typ == 0x4E4F534A: js = json.loads(data.decode("utf-8"))
    elif typ == 0x004E4942: binc = data
views = js["bufferViews"]
img_views = {im["bufferView"]: i for i, im in enumerate(js.get("images", [])) if "bufferView" in im}
chunks = []
for vi, v in enumerate(views):
    raw = binc[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
    if vi in img_views:
        im = Image.open(io.BytesIO(raw)); im.load()
        if max(im.size) > MAX:
            im.thumbnail((MAX, MAX), Image.LANCZOS)
        out = io.BytesIO()
        if im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 255:
            im.save(out, "PNG", optimize=True); js["images"][img_views[vi]]["mimeType"] = "image/png"
        else:
            im.convert("RGB").save(out, "JPEG", quality=86); js["images"][img_views[vi]]["mimeType"] = "image/jpeg"
        raw = out.getvalue()
    chunks.append(raw)
newbin = b""
for v, raw in zip(views, chunks):
    pad = (-len(newbin)) % 4; newbin += b"\0" * pad
    v["byteOffset"] = len(newbin); v["byteLength"] = len(raw); newbin += raw
newbin += b"\0" * ((-len(newbin)) % 4)
js["buffers"][0]["byteLength"] = len(newbin)
jb = json.dumps(js, separators=(",", ":")).encode("utf-8"); jb += b" " * ((-len(jb)) % 4)
glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(newbin)) + struct.pack("<II", len(jb), 0x4E4F534A) + jb + struct.pack("<II", len(newbin), 0x004E4942) + newbin
dst = src[:-4] + ".web.glb"; open(dst, "wb").write(glb)
print(f"{src.split(chr(92))[-1].split('/')[-1]}: {len(b)/1e6:.1f} MB -> {len(glb)/1e6:.1f} MB")
