"""Run Blender headless under the machine-wide Blender lock (C:/RnD/.wt/_blender.lock, the pipeline's protocol:
create-exclusive with {owner, pid, at}; removed on exit). Waits up to --wait seconds for another owner.
Usage: python blender_run.py [--wait 900] -- <blender args...>"""
import json, os, subprocess, sys, time, datetime
LOCK = "C:/RnD/.wt/_blender.lock"
BL = "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"
a = sys.argv[1:]; wait = 900
if a and a[0] == "--wait":
    wait = int(a[1]); a = a[2:]
if a and a[0] == "--":
    a = a[1:]
t0 = time.time()
while True:
    try:
        fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, json.dumps({"owner": "avnei-hefetz-kedem b10 apt3", "pid": os.getpid(), "at": datetime.datetime.now().isoformat()}).encode()); os.close(fd); break
    except FileExistsError:
        if time.time() - t0 > wait:
            print("LOCK BUSY:", open(LOCK).read(), file=sys.stderr); sys.exit(3)
        time.sleep(1)
try:
    r = subprocess.run([BL, *a])
    code = r.returncode
finally:
    try:
        if json.load(open(LOCK)).get("pid") == os.getpid():
            os.remove(LOCK)
    except Exception:
        pass
sys.exit(code)
