#!/usr/bin/env python3
"""Harvest EMA/IMA press-release *candidates* without modifying canonical TRACE records.

The output is review-only. If a source is unavailable or parsing returns no candidates,
existing candidate files are preserved and the run is recorded in a status manifest.
"""
from __future__ import annotations
import html, json, re, ssl, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'candidates'; OUT.mkdir(parents=True,exist_ok=True)
UA='TRACE-source-candidate-harvester/1.0 (+https://www.ema.co.tt/)'
SOURCES={
  'ema':{
    'name':'Environmental Management Authority','index':'https://www.ema.co.tt/category/news-events/',
    'pages':[f'https://www.ema.co.tt/category/news-events/page/{i}/' for i in range(1,9)],
    'outfile':'ema_press_release_candidates.json',
  },
  'ima':{
    'name':'Institute of Marine Affairs','index':'https://www.ima.gov.tt/press-releases/',
    'pages':['https://www.ima.gov.tt/press-releases/','https://www.ima.gov.tt/press-releases/page/2/','https://www.ima.gov.tt/press-releases/page/3/'],
    'outfile':'ima_press_release_candidates.json',
  }
}

ctx=ssl.create_default_context()
def fetch(url,timeout=25):
    req=Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml'})
    with urlopen(req,timeout=timeout,context=ctx) as r:
        return r.read().decode(r.headers.get_content_charset() or 'utf-8','replace')

def clean_text(s):
    s=re.sub(r'<script\b.*?</script>|<style\b.*?</style>',' ',s,flags=re.I|re.S)
    s=re.sub(r'<[^>]+>',' ',s)
    return re.sub(r'\s+',' ',html.unescape(s)).strip()

def norm_url(u):
    u=urldefrag(u)[0].strip()
    return u.rstrip('/')+'/' if u else ''

def norm_title(t):
    return re.sub(r'[^a-z0-9]+',' ',t.lower()).strip()

def candidate_links(source_key,page_url,doc):
    links=[]
    host=urlparse(SOURCES[source_key]['index']).netloc.lower().removeprefix('www.')
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',doc,re.I|re.S):
        href=urljoin(page_url,html.unescape(m.group(1)))
        text=clean_text(m.group(2))
        p=urlparse(href); ph=p.netloc.lower().removeprefix('www.')
        if ph!=host: continue
        path=p.path.lower()
        if source_key=='ema':
            # WordPress public posts are date-addressed; exclude category/navigation/media assets.
            if not re.search(r'/20\d\d/\d\d/\d\d/',path): continue
        else:
            # IMA release detail pages are root slugs. Exclude navigation, archive and file links.
            bad=['/press-releases','/library','/about','/contact','/research','/programme','/category/','/tag/','/wp-content/','/feed']
            if any(path.startswith(x) for x in bad) or path in {'/',''}: continue
            if path.count('/')>2: continue
            if len(text)<8: continue
        links.append((norm_url(href),text))
    # stable URL-dedup
    out=[]; seen=set()
    for u,t in links:
        if u and u not in seen: seen.add(u); out.append((u,t))
    return out

def page_meta(url,fallback_title=''):
    try: doc=fetch(url)
    except Exception: return {'title':fallback_title,'date':None}
    title=''
    for pat in [r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',r'<h1[^>]*>(.*?)</h1>',r'<title[^>]*>(.*?)</title>']:
        m=re.search(pat,doc,re.I|re.S)
        if m: title=clean_text(m.group(1)); break
    title=re.sub(r'\s+[\-|–|—]\s+(Environmental Management Authority|Institute of Marine Affairs).*$','',title,flags=re.I).strip()
    if not title: title=fallback_title
    date=None
    for pat in [r'<meta[^>]+property=["\']article:published_time["\'][^>]+content=["\']([^"\']+)',r'<time[^>]+datetime=["\']([^"\']+)']:
        m=re.search(pat,doc,re.I|re.S)
        if m:
            dm=re.search(r'(20\d{2})-(\d{2})-(\d{2})',m.group(1));
            if dm: date='-'.join(dm.groups()); break
    if not date:
        dm=re.search(r'/((?:20)\d{2})/(\d{2})/(\d{2})/',url)
        if dm: date='-'.join(dm.groups())
    return {'title':title,'date':date}

def canonical_index():
    urls=set(); titles=set()
    for fn in ['press_releases.json','external_references.json']:
        for r in json.loads((ROOT/'data'/fn).read_text(encoding='utf-8')):
            for k in ['source_url','direct_url','source_page_url','url']:
                if r.get(k): urls.add(norm_url(str(r[k])))
            if r.get('title'): titles.add(norm_title(str(r['title'])))
            if r.get('short_title'): titles.add(norm_title(str(r['short_title'])))
    return urls,titles

def harvest(key,cfg,known_urls,known_titles):
    found=[]; errors=[]
    for page in cfg['pages']:
        try:
            doc=fetch(page)
            found.extend(candidate_links(key,page,doc))
        except Exception as e: errors.append(f'{page}: {type(e).__name__}: {e}')
    dedup={u:t for u,t in found}
    rows=[]
    for i,(u,fallback) in enumerate(sorted(dedup.items()),1):
        meta=page_meta(u,fallback)
        title=meta['title'] or fallback or u
        rows.append({
          'candidate_id':f'{key.upper()}-CAND-{i:04d}','source_key':key,'source_agency':cfg['name'],
          'title':title,'date_published':meta['date'],'source_url':u,
          'already_indexed':u in known_urls or norm_title(title) in known_titles,
          'review_status':'review_required','canonical_action':'none','harvested_at':datetime.now(timezone.utc).isoformat(),
          'source_index':cfg['index'],
          'note':'Candidate only. Review provenance, relevance and duplication before adding to a canonical TRACE record set.'
        })
    return rows,errors

def main():
    known_urls,known_titles=canonical_index(); status={'generated_at':datetime.now(timezone.utc).isoformat(),'sources':{}}
    for key,cfg in SOURCES.items():
        rows,errors=harvest(key,cfg,known_urls,known_titles)
        fp=OUT/cfg['outfile']
        preserved=False
        if rows:
            fp.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        else:
            preserved=fp.exists()
        status['sources'][key]={'candidate_count':len(rows),'unindexed_count':sum(not r['already_indexed'] for r in rows),'errors':errors,'preserved_previous_file':preserved,'output':str(fp.relative_to(ROOT))}
        print(f"{key.upper()}: {len(rows)} candidates ({status['sources'][key]['unindexed_count']} not indexed); {len(errors)} source errors")
    (OUT/'press_release_harvest_status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return 0
if __name__=='__main__': raise SystemExit(main())
