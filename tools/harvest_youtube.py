#!/usr/bin/env python3
"""Harvest public uploads from the official EMA YouTube channel into searchable records.

Requires YOUTUBE_API_KEY. Channel configuration lives in data/youtube_channel.json.
The script preserves existing curated video records and merges new uploads by YouTube video ID.
"""
import json, os, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
CFG=json.loads((DATA/'youtube_channel.json').read_text(encoding='utf-8'))
CHANNEL=CFG['channel_id']
UPLOADS=CFG.get('uploads_playlist_id') or ('UU'+CHANNEL[2:] if CHANNEL.startswith('UC') else '')
API='https://www.googleapis.com/youtube/v3'
KEY=os.environ.get('YOUTUBE_API_KEY','').strip()
if not KEY:
    raise SystemExit('YOUTUBE_API_KEY is required')

def api(resource, **params):
    params['key']=KEY
    url=f"{API}/{resource}?"+urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)

def knowledge_area(text):
    t=text.lower()
    rules=[
      ('Energy & Low-Carbon Transition',['renewable','solar','wind','energy efficiency','energy transition','electric vehicle','decarbon']),
      ('Waste, Chemicals & Circular Economy',['waste','plastic','microplastic','recycl','chemical','litter','landfill','circular economy']),
      ('Biodiversity, Ecosystems & Protected Areas',['biodiversity','species','wildlife','aripo','nariva','forest','protected area','esa','ecosystem','turtle']),
      ('Coastal & Marine',['marine','coast','ocean','coral','reef','sargassum','mangrove','beach','fisher']),
      ('Water & Watersheds',['water','river','watershed','wastewater','groundwater','wetland']),
      ('Air & Atmosphere',['air pollution','air quality','particulate','emission','ozone']),
      ('Climate Change & Resilience',['climate','greenhouse gas','adaptation','mitigation','resilience','carbon']),
      ('Noise & Community Impacts',['noise','firework']),
      ('Land, Development & CEC',['cec','certificate of environmental clearance','development','land use','eia','environmental impact assessment']),
      ('Industry, Extractives & Quarrying',['quarry','mining','oil','gas','petrochemical','extractive']),
      ('Education, Participation & Partnerships',['education','school','webinar','stakeholder','community','outreach','icare','i care']),
      ('Environmental Governance, Law & Policy',['environmental management act','rule','regulation','policy','compliance','enforcement','environmental commission']),
    ]
    for area, terms in rules:
        if any(x in t for x in terms): return area
    return 'Corporate & Institutional Management' if any(x in t for x in ['annual report','iso','corporate','staff']) else 'Environmental Governance, Law & Policy'

def all_uploads():
    token=None; out=[]
    while True:
        p=dict(part='snippet,contentDetails',playlistId=UPLOADS,maxResults=50)
        if token: p['pageToken']=token
        d=api('playlistItems',**p)
        out.extend(d.get('items',[]))
        token=d.get('nextPageToken')
        if not token: break
    return out

def video_details(ids):
    out={}
    for i in range(0,len(ids),50):
        d=api('videos',part='snippet,contentDetails,status',id=','.join(ids[i:i+50]),maxResults=50)
        for x in d.get('items',[]): out[x['id']]=x
    return out

def youtube_id(r):
    if r.get('youtube_video_id'): return r['youtube_video_id']
    u=str(r.get('direct_url') or r.get('source_page_url') or r.get('url') or '')
    try:
        q=urllib.parse.urlparse(u)
        if 'youtu.be' in q.netloc: return q.path.strip('/')
        if 'youtube.com' in q.netloc: return urllib.parse.parse_qs(q.query).get('v',[None])[0]
    except Exception: pass
    return None

existing=json.loads((DATA/'videos.json').read_text(encoding='utf-8'))
by_video={youtube_id(r):r for r in existing if youtube_id(r)}
items=all_uploads()
ids=[x.get('contentDetails',{}).get('videoId') or x.get('snippet',{}).get('resourceId',{}).get('videoId') for x in items]
ids=[x for x in ids if x]
details=video_details(ids)
added=0
for item in items:
    v=item.get('contentDetails',{}).get('videoId') or item.get('snippet',{}).get('resourceId',{}).get('videoId')
    if not v: continue
    vd=details.get(v,{})
    sn=vd.get('snippet') or item.get('snippet',{})
    if vd.get('status',{}).get('privacyStatus') not in (None,'public'): continue
    title=sn.get('title') or 'EMA video'
    desc=sn.get('description','')
    date=(sn.get('publishedAt') or item.get('contentDetails',{}).get('videoPublishedAt') or '')[:10]
    year=int(date[:4]) if date[:4].isdigit() else None
    area=knowledge_area(title+' '+desc)
    direct='https://www.youtube.com/watch?v='+v
    if v in by_video:
        r=by_video[v]
        r.update({'youtube_video_id':v,'channel_id':CHANNEL,'source_status':'Verified official EMA YouTube channel'})
        # Preserve curated classifications; fill blanks only.
        r.setdefault('knowledge_area',area)
        r.setdefault('record_type_simplified','News / Media / Video')
        r.setdefault('source_level','EMA')
        continue
    existing.append({
      'id':'VID-YT-'+v,'record_id':'VID-YT-'+v,'title':title,'short_title':title,
      'record_category':'Video / Educational media','record_type_simplified':'News / Media / Video',
      'programme_area':'Cross-cutting','programme_area_original':'Cross-cutting','knowledge_area':area,
      'year':year,'date_published':date,'source_family':'Video','source_status':'Verified official EMA YouTube channel',
      'access_route':'Watch video','direct_url':direct,'source_page_url':direct,'source_reliability':'Official EMA YouTube channel',
      'issuer':'Environmental Management Authority','source_agency':'Environmental Management Authority','host_agency':'YouTube',
      'source_level':'EMA','description':desc,'keywords':['Environmental Management Authority','EMA','Trinidad and Tobago','video'],
      'country':'Trinidad and Tobago','country_scope':'national','media_type':'video','access_status':'open_online',
      'youtube_video_id':v,'channel_id':CHANNEL,'data_version':'2026.08.26.1'
    })
    by_video[v]=existing[-1]; added+=1

# Stable order: newest first when dates exist, then title.
existing.sort(key=lambda r:(str(r.get('date_published') or r.get('date') or ''),str(r.get('title') or '')),reverse=True)
(DATA/'videos.json').write_text(json.dumps(existing,ensure_ascii=False,indent=2),encoding='utf-8')
# Inventory snapshot is deliberately compact but contains real searchable metadata.
snapshot=[]
for r in existing:
    v=youtube_id(r)
    if not v: continue
    snapshot.append({k:r.get(k) for k in ['id','record_id','title','date_published','year','knowledge_area','description','direct_url','youtube_video_id','channel_id']})
(DATA/'youtube_videos.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'videos.json now contains {len(existing)} records; {len(items)} public uploads enumerated; {added} new records added')
