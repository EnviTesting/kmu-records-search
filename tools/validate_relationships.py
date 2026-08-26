#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
sets=['documents.json','judgments.json','press_releases.json','external_references.json','parliamentary_evidence.json','gazette_records.json','statistical_context.json','regional_references.json','international_references.json','videos.json']
records=[]
for fn in sets:
    obj=json.loads((DATA/fn).read_text(encoding='utf-8'))
    arr=obj if isinstance(obj,list) else obj.get('records',obj.get('items',[]))
    records.extend(arr)
ids={str(r.get('record_id') or r.get('id')) for r in records}
errors=[]
rels=json.loads((DATA/'relationships.json').read_text(encoding='utf-8'))
if isinstance(rels,dict): rels=rels.get('relationships',[])
for i,r in enumerate(rels):
    a=str(r.get('from','')); b=str(r.get('to',''))
    if a not in ids: errors.append(f'relationship {i}: missing from id {a}')
    if b not in ids: errors.append(f'relationship {i}: missing to id {b}')
    if a and a==b: errors.append(f'relationship {i}: self relation {a}')
    label=(r.get('label') or r.get('type') or '').lower()
    if any(w in label for w in ['legally applies','supersedes','implements','binding on']):
        errors.append(f'relationship {i}: unsafe public legal-effect label {label!r}')
related=json.loads((DATA/'related_index.json').read_text(encoding='utf-8'))
if isinstance(related,dict) and 'records' in related: related=related['records']
if isinstance(related,list):
    related={str(x.get('record_id') or x.get('id')):x.get('related',[]) for x in related}
for src, vals in related.items():
    if src not in ids: errors.append(f'related index missing source id {src}')
    if len(vals)>6: errors.append(f'{src}: more than 6 generated suggestions')
    for v in vals:
        rid=str((v.get('record_id') or v.get('id')) if isinstance(v,dict) else v)
        if rid not in ids: errors.append(f'{src}: missing related id {rid}')
        if rid==src: errors.append(f'{src}: self suggestion')
terms=json.loads((DATA/'search_terms.json').read_text(encoding='utf-8'))
concepts=terms if isinstance(terms,list) else terms.get('concepts',[])
seen=set()
for i,c in enumerate(concepts):
    key=(c.get('term') or c.get('canonical') or '').strip().lower()
    if not key: errors.append(f'search concept {i}: missing canonical term')
    if key in seen: errors.append(f'search concept {i}: duplicate canonical term {key}')
    seen.add(key)
    for fld in ('aliases','related'):
        if fld in c and not isinstance(c[fld],list): errors.append(f'search concept {i}: {fld} must be list')
geo=json.loads((DATA/'tt_adm1_fallback.geojson').read_text(encoding='utf-8'))
if geo.get('type')!='FeatureCollection' or not geo.get('features'):
    errors.append('boundary fallback must be a non-empty FeatureCollection')
else:
    def walk(x):
        if isinstance(x,list) and len(x)>=2 and all(isinstance(y,(int,float)) for y in x[:2]):
            yield x[0],x[1]
        elif isinstance(x,list):
            for y in x: yield from walk(y)
    pts=[]
    for f in geo['features']: pts.extend(walk(f.get('geometry',{}).get('coordinates',[])))
    for lon,lat in pts:
        if not (-62.3 <= lon <= -60.2 and 9.7 <= lat <= 11.7):
            errors.append(f'boundary point outside broad T&T envelope: {lon},{lat}'); break
# public page terminology/legal-label checks
for fn in ('index.html','preview.html','insights.html','news.html'):
    txt=(ROOT/fn).read_text(encoding='utf-8')
    if re.search(r'\b'+('cor'+'pus')+r'\b',txt,re.I): errors.append(f'{fn}: deprecated public terminology remains')
    if re.search(r'\b(legally applies|supersedes|binding on)\b',txt,re.I): errors.append(f'{fn}: legal-effect wording remains')
if 'tile.openstreetmap.org' not in (ROOT/'assets/preview.js').read_text(encoding='utf-8'):
    errors.append('Spatial Discovery missing OSM tile URL')
if 'OpenStreetMap' not in (ROOT/'assets/preview.js').read_text(encoding='utf-8'):
    errors.append('Spatial Discovery missing OSM attribution')
if 'mobile-search-idle' not in (ROOT/'assets/app.js').read_text(encoding='utf-8'):
    errors.append('mobile search-first state hook missing')
if errors:
    print('VALIDATION FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print(f'VALIDATION PASSED: {len(records)} records, {len(rels)} curated relationships, {len(geo.get("features",[]))} boundary features, {len(concepts)} search concepts')
