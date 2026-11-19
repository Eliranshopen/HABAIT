import io, json
W = 'C:/RnD/.wt/tour-point-move/Projects/Habait/habait-walkaround/Habait/tour360/'
p = W + 'apartments/apt846/scenes.json'
raw = io.open(p, encoding='utf-8').read(); s = json.loads(raw)
by = {x['id']: x for x in s['scenes']}
SRC = 'placed against the room picture 2026-11-11 (Eliran: the bedroom button pointed at the terrace): '
def u_of(yaw): return round(0.5 + yaw / 360.0, 3) % 1
def hs(room, to): return next(h for h in by[room]['hotspots'] if h['to'] == to)
def move(room, to, yaw, why):
    h = hs(room, to); h['was'] = {'u': h['u'], 'source': h.get('source')}; h['u'] = u_of(yaw); h['source'] = SRC + why
# the living room: the way to the master suite is the door in the recess right of the TV wall (yaw 133), and it leads to the wardrobe
# corner just inside that door; the button keeps the suite's name. It stood at yaw 23, on the terrace glass (the straight line to the
# bedroom camera, through a wall).
h = hs('living', 'bedroomMain'); h['was'] = {'to': 'bedroomMain', 'u': h['u'], 'source': h.get('source')}
h['to'] = 'wardrobe'; h['as'] = 'bedroomMain'; h['u'] = u_of(133); h['source'] = SRC + 'the door in the recess right of the TV wall; it opens on the wardrobe corner, the suite\'s way in'
move('living', 'dining', -58, 'the floor in front of the dining table (it stood on the terrace glass)')
move('dining', 'living', -160, 'the floor beside the armchair, toward the sofa (it stood toward the front door)')
move('entrance', 'bathguest', -62, 'the passage between the wall and the tall cabinet (it stood on the blank wall)')
move('entrance', 'bedroom2', -50, 'the same passage, the bedroom side')
move('entrance', 'kitchen', -30, 'the floor right of the tall cabinet (it stood on the cabinet\'s side)')
# one door, one button: the master bedroom leaves through the wardrobe corner; bedroom 2's door opens on the entrance hall
by['bedroomMain']['hotspots'] = [x for x in by['bedroomMain']['hotspots'] if x['to'] != 'living']
by['bedroom2']['hotspots'] = [x for x in by['bedroom2']['hotspots'] if x['to'] != 'kitchen']
if not any(x['to'] == 'living' for x in by['wardrobe']['hotspots']):
    by['wardrobe']['hotspots'].insert(0, {'to': 'living', 'u': u_of(-162), 'v': 0.68, 'source': SRC + 'the open door to the living room'})
ind = 1 if raw.startswith('{\n "') else 2
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(s, ensure_ascii=False, indent=ind) + '\n')
for r in ('entrance', 'living', 'dining', 'bedroomMain', 'wardrobe', 'bedroom2'):
    print(r, [(x['to'], round((x['u'] - 0.5) * 360)) for x in by[r]['hotspots']])

# the viewer: a button may carry another room's name (`as`)
def rd(q): return io.open(W + q, encoding='utf-8').read()
def wr(q, t): io.open(W + q, 'w', encoding='utf-8', newline='\n').write(t)
def rep(t, a, b):
    assert t.count(a) == 1, (t.count(a), a[:70]); return t.replace(a, b)
t = rd('viewer/tour.js')
t = rep(t, "    const entry = { div, label, toId };", "    const entry = { div, label, toId, nameId: (door && door.nameAs) || toId };   // a door may carry the name of the room it leads on to (scenes.json `as`)")
t = rep(t, "    const nm = nameOf(byId[entry.toId]);\n    entry.label.textContent = nm;", "    const nm = nameOf(byId[entry.nameId || entry.toId]);\n    entry.label.textContent = nm;")
t = rep(t, "          sceneId: t.id,\n", "          sceneId: t.id,\n          nameAs: byId[h.as] ? h.as : null,\n")
t = rep(t, "    const nm = nameOf(byId[hs.createTooltipArgs.to]);\n    navHud(dir, 'go',", "    const nm = nameOf(byId[hs.nameAs || hs.createTooltipArgs.to]);\n    navHud(dir, 'go',")
wr('viewer/tour.js', t)
print('viewer ok')
