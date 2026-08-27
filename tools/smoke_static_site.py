#!/usr/bin/env python3
"""Filesystem smoke test for the static GitHub Pages build.

This is intentionally dependency-free. It verifies page asset references, JSON hooks,
HTML ID uniqueness, core UI controls and GitHub workflow/release assets. Browser rendering
is a separate manual/CI check.
"""
from html.parser import HTMLParser
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
PAGES=['index.html','insights.html','preview.html','news.html','datasets.html']
class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.refs=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        if tag in {'script','link','a'}:
            ref=d.get('src') or d.get('href')
            if ref: self.refs.append((tag,ref))
def local(ref): return not (ref.startswith(('http://','https://','mailto:','#','javascript:')))
problems=[]
for page in PAGES:
    p=ROOT/page
    if not p.exists(): problems.append(f'missing page {page}'); continue
    h=p.read_text(encoding='utf-8'); parser=Parser(); parser.feed(h)
    dup={x for x in parser.ids if parser.ids.count(x)>1}
    if dup: problems.append(f'{page}: duplicate HTML IDs {sorted(dup)}')
    for tag,ref in parser.refs:
        ref=ref.split('?',1)[0]
        if not local(ref): continue
        target=(p.parent/ref).resolve()
        try: target.relative_to(ROOT.resolve())
        except ValueError: continue
        if not target.exists(): problems.append(f'{page}: missing local {tag} reference {ref}')
# Required page controls added by TRACE
required={
 'index.html':['externalToggle','resultAccessFilter','metricTotal'],
 'preview.html':['mediaMapToggle','aaqmnMapToggle','imaLayerSelect','leafletMap'],
 'news.html':['newsSearchInput','newsOutletFilter','newsTotal','newsArticleTotal'],
 'datasets.html':['datasetSearch','datasetAccess'],
}
for page,ids in required.items():
    h=(ROOT/page).read_text(encoding='utf-8')
    for ident in ids:
        if f'id="{ident}"' not in h: problems.append(f'{page}: required control #{ident} missing')
# All local data hooks in application JS must exist and parse.
for js in (ROOT/'assets').glob('*.js'):
    text=js.read_text(encoding='utf-8')
    for m in re.finditer(r"['\"](data/[^'\"]+?\.json)['\"]",text):
        fp=ROOT/m.group(1)
        if not fp.exists(): problems.append(f'{js.name}: missing data hook {m.group(1)}')
        else:
            try: json.loads(fp.read_text(encoding='utf-8'))
            except Exception as e: problems.append(f'{m.group(1)}: invalid JSON ({e})')
    r=subprocess.run(['node','--check',str(js)],capture_output=True,text=True)
    if r.returncode: problems.append(f'{js.name}: JavaScript syntax error: {r.stderr.strip()}')
# Release/workflow essentials
for rel in ['VERSION.json','data/version.json','data/summary.json','manifest.webmanifest','.github/workflows/refresh-source-candidates.yml','.github/workflows/validate.yml']:
    if not (ROOT/rel).exists(): problems.append(f'missing release asset {rel}')
if problems:
    print('STATIC SMOKE FAILED')
    for p in problems: print('-',p)
    raise SystemExit(1)
print('STATIC SMOKE PASSED:',len(PAGES),'pages; local assets/JSON hooks and JS syntax verified.')
