import json, os
p = 'work/realism/ledger.json'; d = json.load(open(p)); d['cap_usd'] = 3.5; json.dump(d, open(p, 'w'), indent=1)
S = 'C:/RnD/Projects/Harey_zahav_Naama/'
REF = {'living': 'Corona-Camera0060000_Post_LightMix-Interactive.jpg', 'kitchen': '1_CShading_LightMix.jpg', 'dining': 'Corona-Camera0040000_Post.jpg',
       'entrance': 'Corona-Camera0060000_Post_LightMix-Interactive.jpg', 'hall': 'Corona-Camera0060000_Post_LightMix-Interactive.jpg',
       'bedroom': 'Corona-Camera0050000_Post_LightMix-Interactive.jpg', 'saferoom': 'Corona-Camera0030000_Post.jpg', 'bath': 'Corona-Camera0020000_Post-3.jpg',
       'deck': 'Corona-Camera0040000_Post.jpg', 'garden': 'Corona-Camera0040000_Post.jpg'}
json.dump({k: S + v for k, v in REF.items()}, open('work/realism/refs.json', 'w'), indent=1)
print('refs ok', all(os.path.exists(S + v) for v in REF.values()))
