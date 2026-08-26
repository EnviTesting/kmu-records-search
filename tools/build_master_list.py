#!/usr/bin/env python3
"""Regenerate derived union exports after editing canonical data/*.json files."""
import csv, json
from collections import Counter, defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SETS=[
 ('documents','documents.json'),('judgments','judgments.json'),('press_releases','press_releases.json'),
 ('external_references','external_references.json'),('parliamentary_evidence','parliamentary_evidence.json'),
 ('gazette_records','gazette_records.json'),('statistical_context','statistical_context.json'),
 ('regional_references','regional_references.json'),('international_references','international_references.json'),('videos','videos.json')]
rows=[]
for db,name in SETS:
    for r in json.loads((ROOT/'data'/name).read_text(encoding='utf-8')):
        rr=dict(r); rr.setdefault('database',db); rows.append(rr)
# Full union JSON maintenance export
text=json.dumps(rows,indent=2,ensure_ascii=False)
(ROOT/'data/master_list.json').write_text(text,encoding='utf-8')
# Compact union search index
idx=[]
for r in rows:
    idx.append({k:r[k] for k in ['id','database','title','short_title','record_category','record_type','programme_area','theme','year','date_published','source_family','source_agency','host_agency','issuer','source_status','access_status','source_url','source_page_url','direct_url','description','summary_snippet','keywords','country','data_version'] if k in r})
(ROOT/'data/search_index.json').write_text(json.dumps(idx,indent=2,ensure_ascii=False),encoding='utf-8')
# Maintenance CSV
fields=sorted({k for r in rows for k in r})
with (ROOT/'data/master_list.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
    for r in rows:
        out={}
        for k in fields:
            v=r.get(k,'')
            out[k]=' | '.join(map(str,v)) if isinstance(v,list) else json.dumps(v,ensure_ascii=False) if isinstance(v,dict) else v
        w.writerow(out)
# Keyword audit used by maintainers
with (ROOT/'data/keyword_audit.csv').open('w',newline='',encoding='utf-8-sig') as f:
    cols=['id','database','title','programme_area','record_category','keyword_count','all_keywords','source_family','issuer','source_status']
    w=csv.DictWriter(f,fieldnames=cols); w.writeheader()
    for r in rows:
        kws=r.get('keywords') if isinstance(r.get('keywords'),list) else []
        w.writerow({'id':r.get('id',''),'database':r.get('database',''),'title':r.get('title',''),'programme_area':r.get('programme_area') or r.get('theme') or '',
          'record_category':r.get('record_category') or r.get('record_type') or '','keyword_count':len(kws),'all_keywords':'; '.join(map(str,kws)),
          'source_family':r.get('source_family',''),'issuer':r.get('issuer',''),'source_status':r.get('source_status','')})
# Programme-area summary groups (top five explicit keywords per area)
groups=defaultdict(list)
for r in rows:
    area=str(r.get('knowledge_area') or r.get('programme_area') or r.get('theme') or 'Cross-cutting').strip() or 'Cross-cutting'; groups[area].append(r)
out=[]
for area,recs in sorted(groups.items()):
    c=Counter()
    for r in recs:
        for kw in (r.get('keywords') if isinstance(r.get('keywords'),list) else []):
            k=str(kw).strip()
            if k and len(k)>2 and k.lower() not in {'ema','trinidad and tobago','video','2026','2025','2024'}: c[k]+=1
    out.append({'programme_area':area,'common_terms':[k for k,_ in c.most_common(5)],'count':len(recs)})
(ROOT/'data/groups.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'Built {len(rows)} master records; {len(out)} programme-area groups')
