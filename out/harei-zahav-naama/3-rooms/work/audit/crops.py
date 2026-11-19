import json, sys
from PIL import Image, ImageDraw
P = json.load(open("work/audit/projections.json"))
def crop(room, name, margin=0.04, src="work/pano360/real/%s.jpg", h=420):
    r = P[room][name]; im = Image.open(src % room); W, H = im.size
    x0, x1 = (r["x0"]-margin)*W, (r["x1"]+margin)*W
    y0, y1 = max(0,(r["y0"]-margin*1.5)*H), min(H,(r["y1"]+margin*1.5)*H)
    if x1 > W:  # wrap
        im2 = Image.new("RGB",(W*2,H)); im2.paste(im,(0,0)); im2.paste(im,(W,0)); im=im2
    c = im.crop((int(x0),int(y0),int(x1),int(y1))).copy()
    d = ImageDraw.Draw(c)
    d.rectangle(((r["x0"]*W-x0),(r["y0"]*H-y0),(r["x1"]*W-x0),(r["y1"]*H-y0)), outline=(255,0,0), width=4)
    return c.resize((int(c.width*h/c.height), h))
def side(parts, out, h=420):
    ims=[p.resize((int(p.width*h/p.height),h)) for p in parts]
    s=Image.new("RGB",(sum(i.width for i in ims)+10*(len(ims)-1),h),(255,255,255)); x=0
    for i in ims: s.paste(i,(x,0)); x+=i.width+10
    s.save(out, quality=86); print(out, s.size)
if __name__=="__main__":
    for room in sys.argv[2:]:
        crop(room, sys.argv[1]).save(f"work/audit/c_{sys.argv[1]}_{room}.jpg", quality=85)
