#!/usr/bin/env python3
"""Conservative audit of knowledge base integrity and public-facing contextual fields."""
import json, re
from pathlib import Path
from collections import Counter, defaultdict
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
SETS={
 'documents':ROOT/'data/documents.json',
 'news_events':ROOT/'data/press_releases.json',
 'judgments':ROOT/'data/judgments.json',
 'external_references':ROOT/'data/external_references.json',
 'parliamentary_evidence':ROOT/'data/parliamentary_evidence.json',
 'gazette_records':ROOT/'data/gazette_records.json',
 'statistical_context':ROOT/'data/statistical_context.json',
 'regional_references':ROOT/'data/regional_references.json',
 'international_references':ROOT/'data/international_references.json',
 'videos':ROOT/'data/videos.json',
}
VERSION_META=json.loads((ROOT/'data/version.json').read_text())
VERSION=VERSION_META['data_version']
# Derived from version.json rather than hardcoded, so a future knowledge-base update
# doesn't require editing this script's source to stay correct.
EFFECTIVE_DATE=VERSION_META.get('effective_date','')
rows=[]; records=[]
for name,path in SETS.items():
    data=json.loads(path.read_text())
    for r in data: records.append((name,r))

def add(sev,kind,rid,msg,status='Open'): rows.append({'severity':sev,'check':kind,'record_id':rid or '—','finding':msg,'status':status})
ids=defaultdict(list)
for name,r in records:
    ids[r.get('id')].append(name)
    rid=r.get('id','')
    if not r.get('title'): add('High','Missing title',rid,'Record has no title.')
    if r.get('data_version')!=VERSION: add('High','Version mismatch',rid,f"Record version {r.get('data_version')} != {VERSION}.")
    desc=(r.get('description') or r.get('summary_snippet') or '').strip()
    if not desc: add('Medium','Missing context',rid,'No contextual description.')
    # public descriptions should not claim institutional impacts or legal advice
    risky=re.search(r'\b(landmark|changed the ema|impact on ema|ema must|ema should|requires ema to|institutional effect|key takeaway|ai summary)\b',desc,re.I)
    if risky: add('High','Interpretive wording',rid,f'Potentially interpretive phrase in public description: {risky.group(0)!r}.')
    for f in ['source_url','direct_url','description_source_url']:
        u=r.get(f)
        if u:
            p=urlparse(str(u))
            if p.scheme not in {'http','https'} or not p.netloc: add('High','Invalid URL',rid,f'{f} is not a valid HTTP(S) URL: {u}')
    if name=='external_references':
        for f in ['issuer','environmental_relationship','source_reliability']:
            if not r.get(f): add('High','External provenance',rid,f'Missing {f}.')
    if name in {'parliamentary_evidence','gazette_records','statistical_context','regional_references','international_references','videos'}:
        for f in ['source_family','issuer','environmental_relationship','source_reliability']:
            if not r.get(f): add('High','Curated provenance',rid,f'Missing {f}.')
    if name=='international_references':
        if r.get('country')!='Trinidad and Tobago' or r.get('country_scope')!='national': add('High','International scope',rid,'International record is not hard-restricted to Trinidad and Tobago national scope.')
        if r.get('international_scope_type') not in {'national_submission','country_profile','country_project','country_site','country_dataset'}: add('High','International scope',rid,f"Invalid scope type: {r.get('international_scope_type')}")
    if name=='videos' and (r.get('country')!='Trinidad and Tobago' or r.get('media_type')!='video'): add('High','Video scope',rid,'Video record is missing Trinidad and Tobago/video scope metadata.')
    if name=='judgments':
        for f in ['court','record_type','case_status','source_url']:
            if not r.get(f): add('High','Legal metadata',rid,f'Missing {f}.')
        if r.get('case_status','').lower().find('pending')>=0 and r.get('record_type')=='Judgment': add('High','Status conflict',rid,'Pending proceeding labelled as Judgment.')
for rid,sets in ids.items():
    if rid and len(sets)>1: add('High','Duplicate ID',rid,f'ID appears in {sets}.')
# normalized exact-title duplicates within same record set/date are suspicious; same case across court stages is allowed.
seen=defaultdict(list)
for name,r in records:
    key=(name,re.sub(r'\W+',' ',r.get('title','').lower()).strip(),str(r.get('date_published') or r.get('year') or ''))
    seen[key].append(r.get('id'))
for key,rids in seen.items():
    if key[1] and len(rids)>1: add('Medium','Possible duplicate record',', '.join(rids),f'Same normalized title/date within {key[0]}.')
# Data-level assertions
news=[r for n,r in records if n=='news_events']
latest=max((r.get('date_published','') for r in news),default='')
if EFFECTIVE_DATE and latest:
    if latest > EFFECTIVE_DATE:
        add('High','News chronology','—',f'Latest News & Events date {latest} is later than knowledge base effective date {EFFECTIVE_DATE}.')
    elif latest < EFFECTIVE_DATE:
        add('Info','News freshness note','—',f'Latest captured EMA News & Events date is {latest}; this {EFFECTIVE_DATE} release updates other source families and does not imply a same-day EMA news refresh.','Passed')
# Reconciled stale summary
summary=json.loads((ROOT/'data/summary.json').read_text())
if summary.get('record_count')!=len(records): add('High','Summary count','—',f"summary.json says {summary.get('record_count')} vs {len(records)} records.")
# Record benign checks as passed lines for audit visibility
if not rows:
    add('Info','Audit result','—','No integrity or conservative-description issues detected by automated checks.','Passed')
# resolved_during_audit is a historical log of fixes made during past audits.
# This script only detects issues, it never auto-fixes the knowledge base, so that log
# is carried forward unchanged from the previous report rather than
# re-asserted as freshly resolved on every run. A genuinely new fix should be
# added to this list by hand as part of the release that makes the fix.
prior_report_path=ROOT/'data/audit_report.json'
resolved_history=[]
if prior_report_path.exists():
    try: resolved_history=json.loads(prior_report_path.read_text()).get('resolved_during_audit',[])
    except Exception: resolved_history=[]

report={
 'data_version':VERSION,'audit_date':EFFECTIVE_DATE,'record_count':len(records),
 'counts':{k:sum(1 for n,_ in records if n==k) for k in SETS},
 'findings':rows,
 'resolved_during_audit':resolved_history,
 'automated_checks':['required metadata','cross-set ID uniqueness','URL syntax','context presence','interpretive wording screen','legal status/type consistency','international Trinidad and Tobago scope','video scope','latest News & Events date','summary count reconciliation'],
 'limitations':['Automated URL checks validate syntax, not live availability of every external page.','The legal inventory is a verified working set and is not labelled exhaustive of every proceeding involving EMA.','Descriptions derived from official pages are intentionally brief and should not replace the original published source text.','Related sources are opt-in, are not necessarily EMA-controlled holdings, and should be checked against the original source and any later relevant publications before operational reliance.','International records are hard-restricted to Trinidad and Tobago-specific submissions, sites, projects, profiles or datasets; generic regional/global material is excluded.']
}
(ROOT/'data/audit_report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
lines=[f'# Knowledge base Audit — {EFFECTIVE_DATE or "undated"}','',f"**Data version:** {VERSION}",f"**Records audited:** {len(records)}",'', '## Automated checks','']+[f'- {x}' for x in report['automated_checks']]+['','## Findings','']
for x in rows: lines.append(f"- **{x['severity']} — {x['check']}** — {x['record_id']}: {x['finding']} ({x['status']})")
if resolved_history:
    lines+=['','## Resolved during audit (history)','']
    for x in resolved_history:
        lines.append(f"- **{x['record_id']}** — {x['issue']} {x['resolution']} ({x['status']})")
lines+=['','## Limitations','']+[f'- {x}' for x in report['limitations']]
audit_path=ROOT/'docs'/'AUDIT_CURRENT.md'
audit_path.parent.mkdir(parents=True,exist_ok=True)
audit_path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
