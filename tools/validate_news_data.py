#!/usr/bin/env python3
"""Validate the cleaned EMA in the News analytical model used by dynamic charts."""
import json, re, sys
from collections import Counter
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
stories=json.loads((DATA/'ema_news_stories.json').read_text(encoding='utf-8'))
articles=json.loads((DATA/'ema_in_news.json').read_text(encoding='utf-8'))
sources=json.loads((DATA/'ema_news_sources.json').read_text(encoding='utf-8'))
version=json.loads((DATA/'version.json').read_text(encoding='utf-8'))
problems=[]

def clean(v): return str(v or '').strip()
def valid_date(v):
    if not v: return False
    try: date.fromisoformat(str(v)[:10]); return True
    except Exception: return False

if len(stories)!=version.get('media_story_count'): problems.append(f"story count {len(stories)} != version {version.get('media_story_count')}")
if len(articles)!=version.get('media_archive_count'): problems.append(f"article count {len(articles)} != version {version.get('media_archive_count')}")
if len(sources)!=version.get('media_source_option_count'): problems.append(f"source option count {len(sources)} != version {version.get('media_source_option_count')}")
story_ids=[r.get('id') for r in stories]; article_ids=[r.get('id') for r in articles]
if None in story_ids or len(set(story_ids))!=len(story_ids): problems.append('story IDs missing or duplicated')
if None in article_ids or len(set(article_ids))!=len(article_ids): problems.append('article IDs missing or duplicated')
story_set=set(story_ids); article_set=set(article_ids)
by_story={}
for a in articles:
    aid=a.get('id'); sid=a.get('story_id'); by_story.setdefault(sid,[]).append(aid)
    if sid not in story_set: problems.append(f'{aid}: missing story {sid}')
    if not clean(a.get('headline') or a.get('title')): problems.append(f'{aid}: missing headline/title')
    if not clean(a.get('display_source') or a.get('outlet') or a.get('source_agency')): problems.append(f'{aid}: missing publication label')
    if clean(a.get('display_source') or a.get('outlet'))=='103.1FM': problems.append(f'{aid}: unnormalised 103.1FM publication')
for s in stories:
    sid=s.get('id'); members=s.get('article_ids') or []
    if not clean(s.get('title')): problems.append(f'{sid}: missing title')
    if set(members)!=set(by_story.get(sid,[])): problems.append(f'{sid}: article membership mismatch')
    if s.get('article_count')!=len(members): problems.append(f'{sid}: article_count mismatch')
for src in sources:
    if src.get('article_id') not in article_set: problems.append(f"{src.get('id')}: missing article {src.get('article_id')}")
    if src.get('story_id') not in story_set: problems.append(f"{src.get('id')}: missing story {src.get('story_id')}")
# Chart inputs must be nonempty and internally usable.
dated=[s for s in stories if valid_date(s.get('publication_date') or s.get('date_end') or s.get('date_start'))]
if len(dated)<max(1,int(len(stories)*.70)): problems.append(f'only {len(dated)}/{len(stories)} stories have chartable dates')
topics=Counter(clean(s.get('knowledge_area') or s.get('programme_area') or s.get('theme')) for s in stories)
outlets=Counter(clean(a.get('display_source') or a.get('outlet') or a.get('source_agency')) for a in articles)
if len([k for k in topics if k])<3: problems.append('topic aggregation has fewer than 3 nonempty categories')
if len([k for k in outlets if k])<3: problems.append('publication aggregation has fewer than 3 nonempty categories')
# The released page must contain both visual chart hosts and fallback data hosts.
html=(ROOT/'news.html').read_text(encoding='utf-8')
for ident in ['newsTimelineChart','newsTopicChart','newsOutletChart','newsTimelineValues','newsTopicValues','newsOutletValues']:
    if f'id="{ident}"' not in html: problems.append(f'news.html missing #{ident}')
css=(ROOT/'assets/news.css').read_text(encoding='utf-8')
if not re.search(r'\.bar-fill\s*\{[^}]*display\s*:\s*block',css,re.S): problems.append('news.css must explicitly display .bar-fill as a block')
js=(ROOT/'assets/news.js').read_text(encoding='utf-8')
for ident in ['renderDashboard','dashRows','valuesTable']:
    if ident not in js: problems.append(f'news.js missing {ident}')
if problems:
    print('NEWS ANALYTICS VALIDATION FAILED')
    for x in problems[:200]: print('-',x)
    sys.exit(1)
print(f'NEWS ANALYTICS PASSED: {len(stories)} stories / {len(articles)} articles / {len(sources)} source options; {len(dated)} dated stories; {len([k for k in outlets if k])} publications.')
