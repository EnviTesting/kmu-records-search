"""Rebuild the unified lightweight search index without altering curated records."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sets=[('documents',root/'data/documents.json'),('press_releases',root/'data/press_releases.json'),('judgments',root/'data/judgments.json')]
index=[]
for db,path in sets:
    for r in json.loads(path.read_text(encoding='utf-8')):
        index.append({
          'id':r.get('id'),'database':db,'title':r.get('title'),'short_title':r.get('short_title'),
          'record_category':r.get('record_category') or r.get('record_type'),'programme_area':r.get('programme_area'),
          'year':r.get('year'),'date_published':r.get('date_published'),'source_status':r.get('source_status'),
          'source_url':r.get('direct_url') or r.get('source_url'),'description':r.get('description') or r.get('summary_snippet') or '',
          'keywords':r.get('keywords') or [],'corpus_version':r.get('corpus_version')
        })
(root/'data/search_index.json').write_text(json.dumps(index,indent=2,ensure_ascii=False),encoding='utf-8')
(root/'search_index.json').write_text(json.dumps(index,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'Rebuilt unified search_index.json for {len(index)} records.')
