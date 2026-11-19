"""Run one bounded Blender job under the machine-wide Blender lock (one Blender at a time on this machine).

The lock is the same file the engine's run-project.mjs uses (C:/RnD/.wt/_blender.lock, JSON owner/pid/at,
created exclusively, removed only by its owner). If another session holds it, this waits up to --wait
seconds and then gives up with exit 3 - it never removes a lock it does not own.

Usage: python run_blender.py [--wait 240] [--timeout 520] -- <blender args...>
"""
import datetime
import json
import os
import subprocess
import sys
import time

LOCK = os.environ.get("HABAIT_BLENDER_LOCK", "C:/RnD/.wt/_blender.lock")
BLENDER = os.environ.get("BLENDER", "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe")

args = sys.argv[1:]
wait, timeout = 240, 520
while args and args[0] != "--":
    if args[0] == "--wait":
        wait = int(args[1])
    elif args[0] == "--timeout":
        timeout = int(args[1])
    args = args[2:]
args = args[1:]

t0 = time.time()
fd = None
while fd is None:
    try:
        fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        try:
            holder = open(LOCK, encoding="utf-8").read().strip()
        except OSError:
            holder = "?"
        if time.time() - t0 > wait:
            print(f"BLENDER LOCK BUSY after {wait}s: {holder}", file=sys.stderr)
            sys.exit(3)
        print(f"waiting for the Blender lock: {holder}", flush=True)
        time.sleep(10)
os.write(fd, json.dumps({"owner": "harei-zahav-naama", "pid": os.getpid(),
                         "at": datetime.datetime.now(datetime.timezone.utc).isoformat()}).encode())
os.close(fd)
code = 1
try:
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.Popen([BLENDER] + args, env=env)
    try:
        code = p.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        print(f"BLENDER TIMEOUT after {timeout}s - killed", file=sys.stderr)
        code = 124
finally:
    try:
        if json.load(open(LOCK, encoding="utf-8")).get("pid") == os.getpid():
            os.remove(LOCK)
    except (OSError, ValueError):
        pass
print(f"blender exit {code} in {time.time() - t0:.0f}s")
sys.exit(code)
