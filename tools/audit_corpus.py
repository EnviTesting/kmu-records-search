#!/usr/bin/env python3
"""Conservative audit of corpus integrity and public-facing contextual fields."""
import json, re
from pathlib import Path
from collections import Counter, defaultdict
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
SETS={
 'documents':ROOT/'data/documents.json',
 'news_events':ROOT/'data/press_releases.json',
 'judgments':ROOT/'data/judgments.json',
}
VERSION=json.loads((ROOT/'data/version.json').read_text())['corpus_version']
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
    if r.get('corpus_version')!=VERSION: add('High','Version mismatch',rid,f"Record version {r.get('corpus_version')} != {VERSION}.")
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
if latest!='2026-08-17': add('High','News refresh','—',f'Latest News & Events date is {latest}, expected 2026-08-17.')
# Reconciled stale summary
summary=json.loads((ROOT/'data/summary.json').read_text())
if summary.get('record_count')!=len(records): add('High','Summary count','—',f"summary.json says {summary.get('record_count')} vs {len(records)} records.")
# Record benign checks as passed lines for audit visibility
if not rows:
    add('Info','Audit result','—','No integrity or conservative-description issues detected by automated checks.','Passed')
report={
 'corpus_version':VERSION,'audit_date':'2026-08-17','record_count':len(records),
 'counts':{k:sum(1 for n,_ in records if n==k) for k in SETS},
 'findings':rows,
 'resolved_during_audit':[
   {
     'severity':'Medium',
     'record_id':'EMA-KM-0120',
     'issue':'The Waste Permit Register record contained the literal text “Official EMA” in the direct_url field.',
     'resolution':'Removed the invalid direct URL, retained the EMA Information Centre / Waste Unit access pathway, and added a neutral availability note.',
     'status':'Resolved'
   }
 ],
 'automated_checks':['required metadata','cross-set ID uniqueness','URL syntax','context presence','interpretive wording screen','legal status/type consistency','latest News & Events date','summary count reconciliation'],
 'limitations':['Automated URL checks validate syntax, not live availability of every external page.','The legal inventory is a verified working set and is not labelled exhaustive of every proceeding involving EMA.','Descriptions derived from official pages are intentionally brief and should not replace the authoritative source text.']
}
(ROOT/'data/audit_report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
lines=['# Corpus Audit — 17 August 2026','',f"**Corpus version:** {VERSION}",f"**Records audited:** {len(records)}",'', '## Automated checks','']+[f'- {x}' for x in report['automated_checks']]+['','## Findings','']
for x in rows: lines.append(f"- **{x['severity']} — {x['check']}** — {x['record_id']}: {x['finding']} ({x['status']})")
lines+=['','## Resolved during audit','']
for x in report['resolved_during_audit']:
    lines.append(f"- **{x['record_id']}** — {x['issue']} {x['resolution']} ({x['status']})")
lines+=['','## Limitations','']+[f'- {x}' for x in report['limitations']]
(ROOT/'AUDIT_2026-08-17.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
