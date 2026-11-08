# Rebuilds HABAIT-RESEARCH-2026-11-02.md from the part files. Run with: python -I build_research_md.py
import io,re
def demote(md):
    out=[]; infence=False
    for line in md.splitlines():
        if line.startswith('```'): infence=not infence
        if not infence and re.match(r'^#{1,5} ',line): line='#'+line
        out.append(line)
    return '\n'.join(out)
parts=[('SUMMARY-he.md','חלק א: המחקר (סיכום, ממצאים, ארכיטקטורה, מדידה, תרחישים, סגירת פערים)'),
       ('residence-tech-reengineering.md','חלק ב: הנדסה-לאחור של residence.tech'),
       ('WORKPLAN-he.md','חלק ג: תכנית העבודה (ערוצים מקבילים, שערים, סשנים, שבוע 1)'),
       ('raw-1-plan-to-3d.md','נספח 1 (אנגלית): Floor plan → 3D'),
       ('raw-2-ai-rendering.md','נספח 2 (אנגלית): AI rendering / restyling / 360'),
       ('raw-3-web3d-tours-selectors.md','נספח 3 (אנגלית): Web 3D, tours, unit selectors, Israeli market'),
       ('raw-4-video-3dgen-business.md','נספח 4 (אנגלית): AI video, 3D generation, business snapshot')]
head=io.open('HABAIT-RESEARCH-2026-11-02.md',encoding='utf-8').read().split('## תוכן')[0]
toc='## תוכן\n'+''.join(f"{i+1}. {t}\n" for i,(f,t) in enumerate(parts))
body=''.join(f"\n\n---\n\n# {t}\n\n> מקור: `{f}`\n\n"+demote(io.open(f,encoding='utf-8').read()) for f,t in parts)
io.open('HABAIT-RESEARCH-2026-11-02.md','w',encoding='utf-8',newline='\n').write(head+toc+body)
print('rebuilt')
