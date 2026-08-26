#!/usr/bin/env python3
"""Build data/ema_in_news.json from the two EMA media workbooks used by v7.2.

Dependency-free: reads XLSX with Python's zipfile/xml modules.

Usage:
  python tools/import_ema_news.py \
    EMA_News_Manager_View_Link_Recovery_Sweep11.xlsx \
    EMA_News_Manager_View_Sweep5_Definitive_Unit_Map.xlsx

Public export rules:
- exclude rows whose Evidence status is "Archived clipping / OCR text";
- do not export EMA Unit mappings, manager actions, provisional EMA roles or review priorities;
- use Sweep 5 only for public article metadata such as Location, Author and Short Summary;
- distinguish confirmed article links from supporting/related links.
"""
from pathlib import Path
from datetime import datetime, timedelta
from collections import Counter
import argparse, json, re, zipfile
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','p':'http://schemas.openxmlformats.org/package/2006/relationships'}

def col_num(ref):
    m=re.match(r'([A-Z]+)',ref or 'A');n=0
    for ch in m.group(1):n=n*26+ord(ch)-64
    return n-1

def read_shared(z):
    try:root=ET.fromstring(z.read('xl/sharedStrings.xml'))
    except KeyError:return []
    out=[]
    for si in root.findall('m:si',NS):out.append(''.join(t.text or '' for t in si.findall('.//m:t',NS)))
    return out

def sheet_path(z,name):
    wb=ET.fromstring(z.read('xl/workbook.xml')); rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    targets={x.attrib['Id']:x.attrib['Target'] for x in rels.findall('p:Relationship',NS)}
    for s in wb.findall('m:sheets/m:sheet',NS):
        if s.attrib.get('name')==name:
            target=targets[s.attrib['{'+NS['r']+'}id']].lstrip('/')
            return target if target.startswith('xl/') else 'xl/'+target
    raise KeyError(f'Sheet not found: {name}')

def read_sheet(path,name):
    with zipfile.ZipFile(path) as z:
        shared=read_shared(z); root=ET.fromstring(z.read(sheet_path(z,name)))
        rows=[]
        for row in root.findall('.//m:sheetData/m:row',NS):
            cells={}
            for c in row.findall('m:c',NS):
                idx=col_num(c.attrib.get('r','A1')); typ=c.attrib.get('t'); v=c.find('m:v',NS); value=None
                if typ=='inlineStr':value=''.join(t.text or '' for t in c.findall('.//m:t',NS))
                elif v is not None:
                    raw=v.text or ''
                    if typ=='s':value=shared[int(raw)] if raw else ''
                    elif typ in ('str','e'):value=raw
                    elif typ=='b':value=raw=='1'
                    else:
                        try:value=float(raw);value=int(value) if value.is_integer() else value
                        except:value=raw
                cells[idx]=value
            if cells:
                width=max(cells)+1; arr=[None]*width
                for i,v in cells.items():arr[i]=v
                rows.append(arr)
        return rows

def table_from_header(rows,header_first='Article ID'):
    hi=None
    for i,r in enumerate(rows[:20]):
        if r and str(r[0] or '').strip()==header_first:hi=i;break
    if hi is None:raise ValueError('Article Finder header row not found')
    headers=[str(x or '').strip() for x in rows[hi]]
    out=[]
    for r in rows[hi+1:]:
        if not r or not r[0]:continue
        rr=r+[None]*(len(headers)-len(r));out.append(dict(zip(headers,rr[:len(headers)])))
    return out

def iso(v):
    if isinstance(v,(int,float)):return (datetime(1899,12,30)+timedelta(days=float(v))).date().isoformat()
    s=str(v or '').strip();m=re.search(r'(20\d{2})[-/](\d{1,2})[-/](\d{1,2})',s)
    return f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}' if m else s

def split_location(v):return [x.strip() for x in re.split(r'[;|]',str(v or '')) if x.strip()]

ISSUE={
'Air quality and atmospheric pollution':'Air & Atmosphere','Water resources and sanitation':'Water & Watersheds','Water quality and pollution':'Water & Watersheds','Waste, litter and recycling':'Waste, Chemicals & Circular Economy','Biodiversity, wildlife and ecosystems':'Biodiversity, Ecosystems & Protected Areas','Coastal and marine environment':'Coastal & Marine','Natural hazards and disaster risk':'Climate Change & Resilience','Land use, development and CEC/permitting':'Land, Development & CEC','Transport, infrastructure and urban environment':'Land, Development & CEC','Noise, fireworks and community disturbance':'Noise & Community Impacts','Community complaints and environmental justice':'Environmental Governance, Law & Policy','Environmental governance, law and enforcement':'Environmental Governance, Law & Policy','Public education, science and research':'Education, Participation & Partnerships','Public administration and institutional context':'Environmental Governance, Law & Policy','Agriculture, food and land restoration':'Biodiversity, Ecosystems & Protected Areas','Tourism, recreation and marine safety':'Coastal & Marine','Regional and international environmental and science context':'Environmental Governance, Law & Policy','Heritage, culture and environmental assets':'Biodiversity, Ecosystems & Protected Areas','Corporate sustainability and green economy':'Energy & Low-Carbon Transition','Public health and environmental quality':'Environmental Governance, Law & Policy','Outside environmental scope / archive noise':'Environmental Governance, Law & Policy','Public safety and non-environmental incidents':'Noise & Community Impacts'}
ENERGY=re.compile(r'\b(renewable|solar|wind|photovoltaic|pv\b|energy efficiency|electric vehicle|ev\b|green hydrogen|hydrogen|low[- ]carbon|decarbon|energy transition|clean energy|battery storage)\b',re.I)
INDUSTRY=re.compile(r'\b(oil|gas|petroleum|lng|quarry|mining|extractive|petrochemical|pipeline|drilling|refinery)\b',re.I)
def classify(issue,text):
    if issue=='Climate change and energy transition':return 'Energy & Low-Carbon Transition' if ENERGY.search(text) else 'Climate Change & Resilience'
    if issue=='Energy, oil, gas and extractive industries':return 'Energy & Low-Carbon Transition' if ENERGY.search(text) and not INDUSTRY.search(text) else 'Industry, Extractives & Quarrying'
    return ISSUE.get(issue,'Environmental Governance, Law & Policy')

DIRECT={'Open article online','Confirmed newspaper page','Confirmed duplicate / same article link','Verified original source','Verified public mirror','Official publication post','Confirmed e-paper article','Confirmed institutional publication','Confirmed digital article','Confirmed Guardian Media page','Confirmed newspaper page — online title differs'}
SUPPORT={'Related story evidence — verify exact article','Related story evidence — exact article still not recovered','Related EMA release only','Confirmed same-story newspaper page','Alternative public report'}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('sweep11');ap.add_argument('sweep5');ap.add_argument('--output',default=str(DATA/'ema_in_news.json'));args=ap.parse_args()
    s11=table_from_header(read_sheet(args.sweep11,'Article Finder'));s5=table_from_header(read_sheet(args.sweep5,'Article Finder'));old={r.get('Article ID'):r for r in s5}
    rows=[];excluded=0
    for r in s11:
        evidence=str(r.get('Evidence status') or '').strip()
        if evidence=='Archived clipping / OCR text':excluded+=1;continue
        ident=str(r.get('Article ID') or '').strip();o=old.get(ident,{})
        headline=str(r.get('Headline') or '').strip();outlet=str(r.get('Source') or '').strip() or 'Publication not stated';issue=str(r.get('Main issue') or '').strip();date=iso(r.get('Date'));url=str(r.get('Article / evidence URL') or '').strip() or None;summary=str(r.get('Summary') or o.get('Short Summary') or '').strip() or None;author=str(o.get('Author') or '').strip() or None;cluster=str(r.get('Story / cluster') or o.get('Event / Story') or '').strip() or None
        kind='article' if evidence in DIRECT and url else ('supporting' if evidence in SUPPORT or (url and evidence not in DIRECT) else 'none')
        area=classify(issue,' '.join([headline,summary or '']))
        rows.append({'id':ident,'headline':headline,'title':headline,'short_title':headline,'publication_date':date,'year':date[:4] if re.match(r'20\d{2}',date or '') else '','outlet':outlet,'author':author,'knowledge_area':area,'original_issue':issue or None,'content_type':str(r.get('Why it matters') or '').strip() or None,'summary':summary,'description':summary,'source_url':url,'direct_url':url if kind=='article' else None,'link_kind':kind,'link_status':evidence or ('URL stored' if url else 'No public link recovered'),'story_cluster_id':cluster,'story_cluster_kind':'topic-month' if cluster and cluster.lower().startswith('topic-month holding cluster') else ('story' if cluster else None),'related_ema_release':str(r.get('Related EMA release') or '').strip() or None,'geography':split_location(o.get('Location')),'source_level':'Media','record_set':'media_news','record_type_simplified':'News / Media / Video','record_type':'External media article','source_agency':outlet,'host_agency':outlet,'access_status':'open_online' if kind=='article' else ('link_review' if kind=='supporting' else 'reference_only')})
    rows.sort(key=lambda x:(x.get('publication_date') or '',x.get('headline') or ''),reverse=True);Path(args.output).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    stat={'source_workbook':Path(args.sweep11).name,'enrichment_workbook':Path(args.sweep5).name,'source_article_rows':len(s11),'excluded_archived_clipping_or_ocr':excluded,'searchable_article_records':len(rows),'coverage_start':min((x['publication_date'] for x in rows if x['publication_date']),default=None),'coverage_end':max((x['publication_date'] for x in rows if x['publication_date']),default=None),'outlets_represented':len(set(x['outlet'] for x in rows)),'link_kind_counts':dict(Counter(x['link_kind'] for x in rows)),'notes':['Archived clipping / OCR text rows are excluded.','EMA Unit mappings and management fields are not exported.','Location, author and short summary may be carried from Sweep 5 only as article metadata.','Media is off by default in Spatial Discovery.']}
    (DATA/'ema_in_news_archive_summary.json').write_text(json.dumps(stat,ensure_ascii=False,indent=2),encoding='utf-8');print(f"Wrote {len(rows)} searchable articles; excluded {excluded} clipping/OCR rows.")
if __name__=='__main__':main()
