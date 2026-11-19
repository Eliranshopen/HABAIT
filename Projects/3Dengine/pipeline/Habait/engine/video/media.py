"""ffmpeg / ffprobe helpers for the video stage. Every call is an external process; nothing is imported from the Studio.

ffmpeg is found in this order: $FFMPEG / $FFPROBE, PATH, the WinGet Gyan.FFmpeg package (this machine: 8.0.1).
"""
from __future__ import annotations

import glob
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np


def _find(name: str) -> str:
    env = os.environ.get(name.upper())
    if env and Path(env).exists():
        return env
    w = shutil.which(name)
    if w:
        return w
    local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    hits = sorted(glob.glob(os.path.join(local, "Microsoft", "WinGet", "Packages", "Gyan.FFmpeg*", "*", "bin",
                                         name + ".exe")))
    if hits:
        return hits[-1]
    raise FileNotFoundError(f"{name} not found (set ${name.upper()} or install Gyan.FFmpeg with winget)")


def ffmpeg() -> str:
    return _find("ffmpeg")


def ffprobe() -> str:
    return _find("ffprobe")


def _run(cmd, timeout=900):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"{Path(str(cmd[0])).name} exit {r.returncode}: "
                           + r.stderr.decode("utf-8", "replace").strip()[-600:])
    return r


def probe(path) -> dict:
    """Exact frame count (decoded), size, fps, duration and size in bytes of the first video stream."""
    r = _run([ffprobe(), "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
              "stream=width,height,r_frame_rate,nb_read_frames,duration,codec_name", "-of",
              "default=noprint_wrappers=1", str(path)])
    kv = dict(line.split("=", 1) for line in r.stdout.decode("utf-8", "replace").splitlines() if "=" in line)
    num, _, den = kv.get("r_frame_rate", "0/1").partition("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    n = int(kv.get("nb_read_frames") or 0)
    dur = float(kv["duration"]) if kv.get("duration") not in (None, "N/A") else (n / fps if fps else 0.0)
    return {"width": int(kv.get("width") or 0), "height": int(kv.get("height") or 0), "fps": round(fps, 4),
            "n_frames": n, "duration_s": round(dur, 4), "codec": kv.get("codec_name"),
            "bytes": Path(path).stat().st_size}


def cut(src, dst, first: int, last: int, fps: float = 24.0, crf: int = 16):
    """Frames first..last (1-based, inclusive) of src into dst (h264, yuv420p, faststart, no audio); timestamps reset."""
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(dst).with_name(Path(dst).stem + ".part.mp4")
    _run([ffmpeg(), "-v", "error", "-y", "-i", str(src), "-vf",
          f"select='between(n\,{first - 1}\,{last - 1})',setpts=N/{fps:g}/TB", "-an", "-fps_mode", "passthrough",
          "-c:v", "libx264", "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(tmp)])
    os.replace(tmp, dst)


def extract_frame(src, index0: int, dst, quality: int = 3):
    """One frame (0-based decode index) as JPEG/PNG (by dst suffix)."""
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    q = [] if str(dst).lower().endswith(".png") else ["-q:v", str(quality)]
    _run([ffmpeg(), "-v", "error", "-y", "-i", str(src), "-vf", f"select=eq(n\,{index0})", "-fps_mode",
          "passthrough", "-frames:v", "1", *q, str(dst)])


def extract_jpgs(src, out_dir, n_frames: int, width: int | None = None, quality: int = 3) -> int:
    """The first n_frames frames as out_dir/frame_%04d.jpg (1-based), optionally scaled to `width` (even height).
    Stale frames above n_frames are removed. Returns the number of files written."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("frame_*.jpg"):
        old.unlink()
    vf = ["-vf", f"scale={width}:-2"] if width else []
    _run([ffmpeg(), "-v", "error", "-y", "-i", str(src), *vf, "-fps_mode", "passthrough", "-frames:v",
          str(n_frames), "-q:v", str(quality), "-start_number", "1", str(out / "frame_%04d.jpg")])
    return len(list(out.glob("frame_*.jpg")))


def decode_gray(src, size=(320, 180), max_frames: int | None = None) -> np.ndarray:
    """All frames as uint8 grayscale [n, h, w] (for the $0 tracking gate). 420 frames at 320x180 = 24 MB."""
    w, h = size
    cmd = [ffmpeg(), "-v", "error", "-i", str(src), "-vf", f"scale={w}:{h},format=gray", "-fps_mode", "passthrough"]
    if max_frames:
        cmd += ["-frames:v", str(max_frames)]
    r = _run(cmd + ["-f", "rawvideo", "-pix_fmt", "gray", "-"])
    buf = np.frombuffer(r.stdout, dtype=np.uint8)
    n = buf.size // (w * h)
    return buf[: n * w * h].reshape(n, h, w)


def make_test_video(dst, n_frames: int, size=(704, 704), fps: int = 24, pattern: str = "testsrc2"):
    """A synthetic clip (the test's fake clay / fake Kling output)."""
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    w, h = size
    _run([ffmpeg(), "-v", "error", "-y", "-f", "lavfi", "-i", f"{pattern}=size={w}x{h}:rate={fps}", "-frames:v",
          str(n_frames), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(dst)])
