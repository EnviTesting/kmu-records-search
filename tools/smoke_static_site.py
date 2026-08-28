#!/usr/bin/env python3
"""Dependency-free release smoke test for the static GitHub Pages build."""
from html.parser import HTMLParser
from pathlib import Path
import json,re,subprocess
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
def local(ref): return not ref.startswith(('http://','https://','mailto:','#','javascript:'))
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
required={
 'index.html':['externalToggle','resultAccessFilter','institutionFilter','withinResultsInput','viewMapBtn','browseAllBtn','resultsPanel'],
 'preview.html':['recordsMapToggle','externalMapToggle','mediaMapToggle','aaqmnMapToggle','adminMapToggle','jumpPlace','mapSearchContext','leafletMap'],
 'news.html':['newsSearchInput','newsYearFilter','newsTopicFilter','newsOutletFilter','newsLocationFilter','resetNewsShared','newsTotal','newsArticleTotal','newsTimelineChart','newsTopicChart','newsOutletChart'],
 'datasets.html':['datasetSearch','datasetAccess','datasetSource'],
 'insights.html':['chartsTab','canvasTab','chartsPanel','canvasPanel','knowledgeCanvas','institutionFilter','canvasDetailPanel','canvasDetailSearch'],
}
for page,ids in required.items():
    h=(ROOT/page).read_text(encoding='utf-8')
    for ident in ids:
        if f'id="{ident}"' not in h: problems.append(f'{page}: required control #{ident} missing')
# Persistent navigation: every page should expose each *other* tool.
links={'index.html','datasets.html','preview.html','news.html','insights.html'}
for page in PAGES:
    h=(ROOT/page).read_text(encoding='utf-8')
    for dest in links-{page}:
        if f'href="{dest}"' not in h: problems.append(f'{page}: persistent navigation missing {dest}')
# Local JSON hooks must exist/parse and all JS must parse.
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
# No live IMA REST/GIS dependency in the release runtime or catalogue.
scan='\n'.join((ROOT/p).read_text(encoding='utf-8') for p in ['preview.html','assets/preview.js','data/dataset_catalog.json','data/spatial_sources.json'])
for token in ['imaLayerSelect','FeatureServer','mdh.ima.gov.tt/server/rest','spatial_layers.json','refresh_ima_spatial_cache']:
    if token in scan: problems.append(f'retired IMA spatial/REST functionality remains: {token}')
for rel in ['data/external_spatial_places.json','assets/nav.css','VERSION.json','data/version.json','data/summary.json','manifest.webmanifest','.github/workflows/refresh-source-candidates.yml','.github/workflows/validate.yml','tools/validate_news_data.py']:
    if not (ROOT/rel).exists(): problems.append(f'missing release asset {rel}')
if problems:
    print('STATIC SMOKE FAILED')
    for p in problems: print('-',p)
    raise SystemExit(1)
print('STATIC SMOKE PASSED:',len(PAGES),'pages; navigation, controls, local assets/JSON hooks and JS syntax verified.')
