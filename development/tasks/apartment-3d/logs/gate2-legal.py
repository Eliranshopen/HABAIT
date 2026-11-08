import json,re,sys,html
W='C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/'
L='C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/'
out=[]
try:
    a=json.load(open(W+'apartment.json',encoding='utf8'))['legal'];b=json.load(open(L+'apartment.json',encoding='utf8'))['legal']
    a2={k:v for k,v in a.items() if k!='source'};b2={k:v for k,v in b.items() if k!='source'}
    out.append('apartment.json legal equal to live dist (ignoring source path): %s'%(a2==b2))
except Exception as e: out.append('live dist compare unavailable: %r'%e)
md=open('C:/RnD/Projects/Habait/data/sales-plans/legal/disclaimer-he-en.md',encoding='utf8').read()
def norm(s): return re.sub(r'\s+',' ',re.sub(r'[*_`>#-]','',s)).strip()
d=open(W+'media/dollhouse.html',encoding='utf8').read()
d0=open('C:/Users/elira/AppData/Local/Temp/claude/76e6db1160dffba0/14c075f3-6b12-4fcf-9ea7-0c64802c7db7/scratchpad/fallback-dist/media/dollhouse.html',encoding='utf8').read()
def legalpart(s):
    s=re.sub(r'<script[^>]*>.*?</script>','',s,flags=re.S); s=re.sub(r'<style.*?</style>','',s,flags=re.S)
    return [norm(html.unescape(re.sub(r'<[^>]+>',' ',m))) for m in re.findall(r'<(?:p|summary|div)[^>]*class="(?:cap|pill|legal|notice)[^"]*"[^>]*>(.*?)</(?:p|summary|div)>',s,flags=re.S)]
out.append('dollhouse legal snippets now: %s'%legalpart(d)[:6])
# whole-body text diff between Phase-1 fallback page and baked page
def body(s):
    s=re.sub(r'<script[^>]*>.*?</script>','',s,flags=re.S);s=re.sub(r'<style.*?</style>','',s,flags=re.S);return norm(html.unescape(re.sub(r'<[^>]+>',' ',s)))
b1,b2=body(d0),body(d)
out.append('visible text identical between Phase-1(fallback) page and baked page: %s'%(b1==b2))
nmd=norm(md)
for sent in re.split(r'(?<=[.])\s',b2):
    pass
out.append('baked page text: '+b2[:600])
open('C:/RnD/development/tasks/apartment-3d/logs/gate2-legal.txt','w',encoding='utf8').write('\n'.join(out)+'\n');print('\n'.join(out))
