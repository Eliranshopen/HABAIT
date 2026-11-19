# project plan-cm boxes onto the 360 panoramas (yaw 0 = +u, + toward +v; eye 155 cm) and crop them
import json, math, sys
from PIL import Image, ImageDraw
CAM = {k: v[:2] for k, v in json.load(open("walkaround/walk-grid.json", encoding="utf-8"))["views"].items()}
CAM["living"] = [700, 880]; CAM["dining"] = [420, 620]
EYE = 155
T = {  # name: (u0,v0,u1,v1,z0,z1)
 "K_east_of_window": (288, 1020, 410, 1026, 150, 269),
 "K_west_of_window": (108, 1020, 163, 1026, 150, 215),
 "K_window_blind": (163, 1026, 284, 1026, 120, 240),
 "T_wc_wall_cabinet": (24, 324, 54, 433, 130, 269),
 "T_shower": (24, 436, 115, 514, 0, 210),
 "T_vanity_mirror": (115, 468, 204, 514, 40, 200),
 "S_window_curtain": (140, 0, 290, 34, 0, 260),
 "S_bed_wall": (29, 34, 40, 234, 90, 220),
}
def proj(cam, p):
    du, dv, dz = p[0]-cam[0], p[1]-cam[1], p[2]-EYE
    yaw = math.degrees(math.atan2(dv, du)); pitch = math.degrees(math.atan2(dz, math.hypot(du, dv)))
    return 0.5 + yaw/360, 0.5 - pitch/180, math.hypot(du, dv)
def corners(b):
    u0,v0,u1,v1,z0,z1=b
    return [(u,v,z) for u in (u0,u1) for v in (v0,v1) for z in (z0,z1)]
out = {}
for room, cam in CAM.items():
    for name, b in T.items():
        pts=[proj(cam,c) for c in corners(b)]
        xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
        # handle wrap
        if max(xs)-min(xs)>0.5: xs=[x+1 if x<0.5 else x for x in xs]
        w=(max(xs)-min(xs))*360; h=(max(ys)-min(ys))*180; d=min(p[2] for p in pts)
        out.setdefault(room,{})[name]=dict(x0=min(xs),x1=max(xs),y0=min(ys),y1=max(ys),deg_w=round(w,1),deg_h=round(h,1),dist_cm=round(d))
json.dump(out, open("work/audit/projections.json","w"), indent=1)
for room in out:
    print(room, {k:(v["deg_w"],v["deg_h"],v["dist_cm"],round(v["x0"],3)) for k,v in out[room].items() if k.startswith(sys.argv[1] if len(sys.argv)>1 else "")})
