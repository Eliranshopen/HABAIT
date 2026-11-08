import re,html,json
W='C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/'
L='C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/'
out=[]
def lg(p): return {k:v for k,v in json.load(open(p+'apartment.json',encoding='utf8'))['legal'].items() if k!='source'}
out.append('apartment.json legal equal live: %s'%(lg(W)==lg(L)))
def body(p):
    s=open(p+'media/dollhouse.html',encoding='utf8').read()
    s=re.sub(r'<script[^>]*>.*?</script>','',s,flags=re.S);s=re.sub(r'<style.*?</style>','',s,flags=re.S)
    return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()
a,b=body(L),body(W)
out.append('live visible text len %d, wt %d'%(len(a),len(b)))
out.append('visible text identical: %s'%(a==b))
if a!=b:
    import difflib
    for op in difflib.SequenceMatcher(None,a,b).get_opcodes():
        if op[0]!='equal': out.append('%s live=%r wt=%r'%(op[0],a[op[1]:op[2]][:200],b[op[3]:op[4]][:200]))
# raw static HTML strings: all Hebrew runs of live present in wt html
ra=open(L+'media/dollhouse.html',encoding='utf8').read();rb=open(W+'media/dollhouse.html',encoding='utf8').read()
miss=[h for h in set(re.findall(r'[\u0590-\u05ff][\u0590-\u05ff \.,"\'״׳\-–·:;()%/\d]{2,}',ra)) if h not in rb]
out.append('hebrew runs of live missing from wt: %d %s'%(len(miss),miss[:10]))
import os
sa=os.path.getsize(L+'media/dollhouse.html');sb=os.path.getsize(W+'media/dollhouse.html')
out.append('size live %d wt %d'%(sa,sb))
open('C:/RnD/development/tasks/apartment-3d/logs/gate4-legal.txt','w',encoding='utf8').write('\n'.join(out)+'\n');print('\n'.join(out))
