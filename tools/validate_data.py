#!/usr/bin/env python3
"""Validation for the static TRACE knowledge base."""
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "data" / "documents.json",
    ROOT / "data" / "press_releases.json",
    ROOT / "data" / "judgments.json",
    ROOT / "data" / "external_references.json",
    ROOT / "data" / "parliamentary_evidence.json",
    ROOT / "data" / "gazette_records.json",
    ROOT / "data" / "statistical_context.json",
    ROOT / "data" / "regional_references.json",
    ROOT / "data" / "international_references.json",
    ROOT / "data" / "videos.json",
]
REQUIRED = ["id", "title", "keywords", "data_version"]

def check_insights_page():
    problems = []
    required_paths = [ROOT / "insights.html", ROOT / "assets" / "insights.js", ROOT / "assets" / "insights.css"]
    for path in required_paths:
        if not path.exists(): problems.append(f"{path.relative_to(ROOT)}: required Knowledge Insights asset is missing")
    if (ROOT / "insights.html").exists():
        html = (ROOT / "insights.html").read_text(encoding="utf-8")
        for needle in ["data/documents.json", "assets/insights.js"]:
            # data paths are loaded in JS; HTML must at least bind the dashboard script.
            if needle == "assets/insights.js" and needle not in html:
                problems.append("insights.html: dashboard script reference is missing")
    if (ROOT / "assets" / "insights.js").exists():
        js = (ROOT / "assets" / "insights.js").read_text(encoding="utf-8")
        for dataset in ["documents.json", "judgments.json", "press_releases.json", "external_references.json", "parliamentary_evidence.json", "gazette_records.json", "statistical_context.json", "regional_references.json", "international_references.json", "videos.json"]:
            if dataset not in js: problems.append(f"assets/insights.js: missing canonical dataset hook for {dataset}")
    if (ROOT / "index.html").exists() and 'href="insights.html"' not in (ROOT / "index.html").read_text(encoding="utf-8"):
        problems.append("index.html: Knowledge Insights link is missing")
    return problems

def check_preview_page():
    problems=[]
    required=[ROOT/'preview.html',ROOT/'assets'/'preview.js',ROOT/'assets'/'preview.css',ROOT/'data'/'spatial_preview.json',ROOT/'data'/'environmental_observances.json']
    for path in required:
        if not path.exists(): problems.append(f"{path.relative_to(ROOT)}: required Spatial Discovery asset is missing")
    if (ROOT/'index.html').exists() and 'href="preview.html"' not in (ROOT/'index.html').read_text(encoding='utf-8'):
        problems.append('index.html: Spatial Discovery link is missing')
    if (ROOT/'assets'/'preview.js').exists():
        js=(ROOT/'assets'/'preview.js').read_text(encoding='utf-8')
        for dataset in ['master_list','spatial_preview.json','environmental_observances.json']:
            if dataset not in js and dataset!='master_list': problems.append(f'assets/preview.js: missing preview dataset hook for {dataset}')
        for dataset in ['documents','judgments','press_releases','external_references','parliamentary_evidence','gazette_records','statistical_context','regional_references','international_references','videos']:
            if dataset not in js: problems.append(f'assets/preview.js: missing canonical knowledge base hook for {dataset}')
    obs_path=ROOT/'data'/'environmental_observances.json'
    if obs_path.exists():
        obs=json.loads(obs_path.read_text(encoding='utf-8'))
        if len(obs)<20: problems.append(f'data/environmental_observances.json: expected EMA calendar set, found only {len(obs)} dates')
        for i,r in enumerate(obs,1):
            for field in ['id','name','month','day','topic','ema_url','custodian','custodian_type']:
                if r.get(field) in (None,''): problems.append(f'environmental_observances row {i}: missing {field}')
            if not valid_url(r.get('ema_url')): problems.append(f'environmental_observances row {i}: invalid ema_url')
            if r.get('custodian_url') and not valid_url(r.get('custodian_url')): problems.append(f'environmental_observances row {i}: invalid custodian_url')
    spatial_path=ROOT/'data'/'spatial_preview.json'
    if spatial_path.exists():
        points=json.loads(spatial_path.read_text(encoding='utf-8'))
        for i,r in enumerate(points,1):
            if not r.get('match_terms') or r.get('lat') is None or r.get('lon') is None: problems.append(f'spatial_preview row {i}: missing match terms or coordinates')
    return problems

def check_news_page():
    problems=[]
    required=[ROOT/'news.html', ROOT/'assets'/'news.js', ROOT/'assets'/'news.css', ROOT/'data'/'ema_in_news.json', ROOT/'data'/'ema_news_stories.json', ROOT/'data'/'ema_news_sources.json']
    for path in required:
        if not path.exists(): problems.append(f"{path.relative_to(ROOT)}: required EMA in the News asset is missing")
    if (ROOT/'index.html').exists() and 'href="news.html"' not in (ROOT/'index.html').read_text(encoding='utf-8'):
        problems.append('index.html: EMA in the News link is missing')
    if (ROOT/'assets'/'news.js').exists():
        js=(ROOT/'assets'/'news.js').read_text(encoding='utf-8')
        for dataset in ['ema_in_news.json','ema_news_stories.json','ema_news_sources.json']:
            if dataset not in js: problems.append(f'assets/news.js: missing media dataset hook for {dataset}')
    paths=[ROOT/'data'/'ema_news_stories.json',ROOT/'data'/'ema_in_news.json',ROOT/'data'/'ema_news_sources.json']
    if all(x.exists() for x in paths):
        stories=json.loads(paths[0].read_text(encoding='utf-8')); articles=json.loads(paths[1].read_text(encoding='utf-8')); sources=json.loads(paths[2].read_text(encoding='utf-8'))
        meta=json.loads((ROOT/'data'/'version.json').read_text(encoding='utf-8')) if (ROOT/'data'/'version.json').exists() else {}
        expected=[('media_story_count',len(stories)),('media_archive_count',len(articles)),('media_source_option_count',len(sources))]
        for key,actual in expected:
            if meta.get(key) is not None and meta.get(key)!=actual: problems.append(f'data/version.json: {key} says {meta.get(key)} vs {actual}')
        story_ids=[r.get('id') for r in stories]; article_ids=[r.get('id') for r in articles]; source_ids=[r.get('id') for r in sources]
        if len(set(story_ids))!=len(story_ids): problems.append('ema_news_stories.json: duplicate story IDs')
        if len(set(article_ids))!=len(article_ids): problems.append('ema_in_news.json: duplicate article IDs')
        if len(set(source_ids))!=len(source_ids): problems.append('ema_news_sources.json: duplicate source-option IDs')
        story_set=set(story_ids); article_by_id={r.get('id'):r for r in articles}
        grouped={}
        for a in articles:
            sid=a.get('story_id'); grouped.setdefault(sid,[]).append(a.get('id'))
            if sid not in story_set: problems.append(f"ema_in_news.json: article {a.get('id')} references missing story {sid}")
            if str(a.get('display_source') or a.get('outlet') or '').strip()=='103.1FM': problems.append(f"ema_in_news.json: unnormalised 103.1FM publisher on {a.get('id')}")
        for st in stories:
            ids=st.get('article_ids') or []; sid=st.get('id')
            if set(ids)!=set(grouped.get(sid,[])): problems.append(f"ema_news_stories.json: story/article membership mismatch for {sid}")
            if st.get('article_count')!=len(ids): problems.append(f"ema_news_stories.json: article_count mismatch for {sid}")
        for src in sources:
            aid=src.get('article_id'); sid=src.get('story_id'); a=article_by_id.get(aid)
            if not a: problems.append(f"ema_news_sources.json: source {src.get('id')} references missing article {aid}")
            elif a.get('story_id')!=sid: problems.append(f"ema_news_sources.json: story mismatch on source {src.get('id')}")
    return problems

def valid_url(value):
    if not value:
        return True
    try:
        p = urlparse(str(value))
        return p.scheme in {"http", "https"} and bool(p.netloc)
    except Exception:
        return False

def validate(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"{path}: expected a JSON array")
    ids = set(); problems = []
    for i, rec in enumerate(data, start=1):
        if not isinstance(rec, dict):
            problems.append(f"row {i}: not an object"); continue
        for field in REQUIRED:
            if field not in rec or rec[field] in (None, ""):
                problems.append(f"row {i}: missing {field}")
        rid = rec.get("id")
        if rid in ids: problems.append(f"row {i}: duplicate id {rid}")
        ids.add(rid)
        kws = rec.get("keywords")
        if not isinstance(kws, list) or not kws:
            problems.append(f"row {i}: keywords must be a non-empty list")
        if not (rec.get("description") or rec.get("summary_snippet")):
            problems.append(f"row {i}: missing contextual description")
        for field in ["source_url", "direct_url", "source_page_url", "description_source_url"]:
            if not valid_url(rec.get(field)): problems.append(f"row {i}: invalid {field}: {rec.get(field)}")
        if path.name == "external_references.json":
            for field in ["issuer", "environmental_relationship", "source_reliability"]:
                if not rec.get(field): problems.append(f"row {i}: external reference missing {field}")
        if path.name == "judgments.json":
            for field in ["court", "record_type", "case_status", "source_url"]:
                if not rec.get(field): problems.append(f"row {i}: judgment/proceeding missing {field}")
        if path.name in {"parliamentary_evidence.json", "gazette_records.json", "statistical_context.json", "regional_references.json", "international_references.json", "videos.json"}:
            for field in ["source_family", "issuer", "environmental_relationship", "source_reliability"]:
                if not rec.get(field): problems.append(f"row {i}: curated source missing {field}")
        if rec.get('access_status') not in {'open_online','request_ema','request_ima','reference_only','link_review'}:
            problems.append(f"row {i}: invalid or missing access_status {rec.get('access_status')}")
        if path.name == 'statistical_context.json':
            for field in ['source_agency','host_agency']:
                if not rec.get(field): problems.append(f"row {i}: research/statistical record missing {field}")
        if path.name == "international_references.json":
            allowed={"national_submission","country_profile","country_project","country_site","country_dataset"}
            if rec.get("country") != "Trinidad and Tobago": problems.append(f"row {i}: international record is not Trinidad and Tobago-specific")
            if rec.get("country_scope") != "national": problems.append(f"row {i}: international record country_scope must be national")
            if rec.get("international_scope_type") not in allowed: problems.append(f"row {i}: invalid international_scope_type {rec.get('international_scope_type')}")
        if path.name == "videos.json":
            if rec.get("country") != "Trinidad and Tobago" or rec.get("country_scope") != "national": problems.append(f"row {i}: video must be Trinidad and Tobago-specific")
            if rec.get("media_type") != "video": problems.append(f"row {i}: video record missing media_type=video")
    return len(data), problems, ids

def main():
    total = 0; all_problems = []; all_ids = set()
    for f in FILES:
        count, problems, ids = validate(f); total += count
        overlap = all_ids & ids
        if overlap: problems.append(f"IDs duplicated across record sets: {sorted(overlap)[:10]}")
        all_ids |= ids
        print(f"{f.relative_to(ROOT)}: {count} records")
        all_problems.extend([f"{f.name}: {p}" for p in problems])
    print(f"Total records: {total}")


    insights_problems = check_insights_page()
    if insights_problems:
        print("\nKnowledge Insights integration problems:")
        for p in insights_problems: print("-", p)
    all_problems.extend(insights_problems)

    preview_problems = check_preview_page()
    if preview_problems:
        print("\nSpatial Discovery integration problems:")
        for p in preview_problems: print("-", p)
    all_problems.extend(preview_problems)

    news_problems = check_news_page()
    if news_problems:
        print("\nEMA in the News integration problems:")
        for p in news_problems: print("-", p)
    all_problems.extend(news_problems)

    # The generated master list must reconcile exactly to the canonical source files.
    master_path = ROOT / "data" / "master_list.json"
    if not master_path.exists():
        all_problems.append("data/master_list.json: generated master list is missing")
    else:
        master = json.loads(master_path.read_text(encoding="utf-8"))
        if not isinstance(master, list) or len(master) != total:
            all_problems.append(f"data/master_list.json: expected {total} union records, found {len(master) if isinstance(master,list) else 'non-list'}")
        else:
            master_ids={r.get('id') for r in master if isinstance(r,dict)}
            if master_ids != all_ids:
                all_problems.append("data/master_list.json: ID set does not match canonical source files")

    if all_problems:
        print("\nProblems:")
        for p in all_problems[:300]: print("-", p)
        raise SystemExit(1)
    print("Validation passed.")

if __name__ == "__main__": main()
