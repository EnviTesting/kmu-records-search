#!/usr/bin/env python3
"""Build conservative discovery-only related-record suggestions for the static search tool."""
import json,re,math
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
MASTER=ROOT/'data/master_list.json'
OUT=ROOT/'data/related_index.json'
STOP=set('the a an and or of in on for to with by from at into about related report reports national trinidad tobago environmental management authority ema government document documents record records annual google drive access centre confirmed legal notice number no no. statutory cross cutting official public source page file files pdf information programme program project governance foia gazette held request statement index section'.split())

def text(r):
    bits=[r.get('title',''),r.get('short_title',''),r.get('description',''),r.get('summary_snippet',''),r.get('programme_area',''),r.get('theme',''),r.get('record_category',''),r.get('record_type',''),r.get('issuer','')]
    bits += r.get('keywords',[]) if isinstance(r.get('keywords'),list) else []
    return ' '.join(map(str,bits)).lower()

def source_group(r):
    db=r.get('database','')
    return {'external_references':'government','parliamentary_evidence':'parliament','gazette_records':'gazette','statistical_context':'statistical','regional_references':'regional','international_references':'international','videos':'video','judgments':'court'}.get(db,'ema')

def topic(r):
    t=text(r)
    checks=[
      ('Air & emissions',r'\bair\b|air quality|emission|pm10|pm2|particulate|sulphur|sulfur|nitrogen dioxide|ozone'),
      ('Water & watersheds',r'water quality|water pollution|watershed|groundwater|river|freshwater|wastewater|sewage|effluent|aquatic|drought|water security'),
      ('Chemicals & hazardous substances',r'pesticide|chemical|persistent organic|\bpops\b|stockholm convention|hazardous substance|toxic|chemical spill|mercury'),
      ('Waste & materials',r'waste|recycl|landfill|solid waste|hazardous material|beverage container'),
      ('Biodiversity & ecosystems',r'biodivers|forest|wildlife|protected area|ecosystem|species|habitat|wetland|mangrove|\besa\b|environmentally sensitive|ramsar'),
      ('Climate & energy',r'climate|carbon|greenhouse|\bghg\b|renewable|energy efficiency|net zero|decarbon|\bndc\b|\bbtr\b'),
      ('Coastal & marine',r'coastal|marine|ocean|oil spill|fisher|coral|seagrass|iczm'),
      ('Land, planning & minerals',r'quarry|mineral|mining|land use|soil|land degradation|spatial development|planning'),
      ('Noise',r'noise'),
      ('CEC / EIA & permitting',r'\bcec\b|certificate of environmental clearance|\beia\b|environmental impact assessment|permit'),
      ('Law, compliance & governance',r'enforcement|compliance|legal|legislation|judgment|court|\bact\b|rule|regulation|foia|governance'),
      ('Public education & engagement',r'education|outreach|literacy|public awareness|media release|news|community|sensiti'),
      ('Knowledge & organisational',r'knowledge|research|annual report|corporate|human resource|procurement|quality|internal|information management|data')]
    for name,pat in checks:
        if re.search(pat,t): return name
    return 'Cross-cutting / other'

def toks(r):
    vals=[]
    if isinstance(r.get('keywords'),list): vals.extend(r['keywords'])
    vals.extend([r.get('title',''),r.get('short_title','')])
    out=set()
    for v in vals:
        for x in re.findall(r'[a-z0-9][a-z0-9.-]{2,}',str(v).lower()):
            if x not in STOP and not x.isdigit() and not re.fullmatch(r'20\d\d|19\d\d',x): out.add(x)
    return out

def place_sets(rows):
    try: places=json.loads((ROOT/'data/spatial_preview.json').read_text(encoding='utf-8'))
    except: places=[]
    result={r.get('id'):set() for r in rows}
    for r in rows:
        rt=text(r)
        for p in places:
            if any(str(term).lower() in rt for term in p.get('match_terms',[]) if str(term).strip()): result[r.get('id')].add(p.get('name',p.get('id')))
    return result

rows=json.loads(MASTER.read_text(encoding='utf-8'))
byid={r['id']:r for r in rows if r.get('id')}
features={r['id']:{'topic':topic(r),'source':source_group(r),'area':str(r.get('knowledge_area') or r.get('programme_area') or r.get('theme') or '').strip(),'tokens':toks(r)} for r in rows if r.get('id')}
places=place_sets(rows)
result={}
for r in rows:
    rid=r.get('id');
    if not rid: continue
    a=features[rid]; cand=[]
    for s in rows:
        sid=s.get('id')
        if not sid or sid==rid: continue
        b=features[sid]; score=0; reasons=[]
        if a['topic']==b['topic'] and a['topic']!='Cross-cutting / other': score+=16; reasons.append(f"Shared topic: {a['topic']}")
        if a['area'] and b['area'] and a['area']==b['area']: score+=7; reasons.append('Shared programme / knowledge area')
        shared=sorted(a['tokens'] & b['tokens'])[:5]
        if shared:
            score+=min(18,len(shared)*4); reasons.append('Shared indexed terms: '+', '.join(shared[:4]))
        shared_places=sorted(places.get(rid,set()) & places.get(sid,set()))
        if shared_places: score+=12; reasons.append('Shared place reference: '+', '.join(shared_places[:2]))
        if a['source']!=b['source']: score+=5
        # Avoid weak same-source suggestions that only share a broad category or maintenance metadata.
        has_signal=bool(shared or shared_places)
        if a['source']==b['source'] and (not has_signal or score<30): continue
        if a['source']!=b['source'] and score<21: continue
        cand.append((score,sid,reasons,b['source']))
    cand.sort(key=lambda x:(-x[0],x[1]))
    picked=[]; source_counts=defaultdict(int); deferred=[]
    # First pass: favour source diversity so Related information behaves like a knowledge bridge.
    for score,sid,reasons,sg in cand:
        if source_counts[sg]>=1:
            deferred.append((score,sid,reasons,sg)); continue
        picked.append({'id':sid,'score':score,'reasons':reasons[:3]}); source_counts[sg]+=1
        if len(picked)>=6: break
    # Second pass: fill any remaining spaces with the strongest suggestions.
    if len(picked)<6:
        for score,sid,reasons,sg in deferred:
            if any(x['id']==sid for x in picked): continue
            picked.append({'id':sid,'score':score,'reasons':reasons[:3]})
            if len(picked)>=6: break
    if picked: result[rid]=picked
OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'Built related suggestions for {len(result)} records from {len(rows)} records')
