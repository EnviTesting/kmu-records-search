#!/usr/bin/env python3
"""Validate static Spatial Discovery associations and AAQMN portal links."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CANON=['documents.json','press_releases.json','judgments.json','external_references.json','parliamentary_evidence.json','gazette_records.json','statistical_context.json','regional_references.json','international_references.json','videos.json']
records={}
for name in CANON:
    for r in json.loads((ROOT/'data'/name).read_text(encoding='utf-8')):
        records[r['id']]=r
points=json.loads((ROOT/'data/external_spatial_places.json').read_text(encoding='utf-8'))
stations=json.loads((ROOT/'data/aaqmn_stations.json').read_text(encoding='utf-8'))
problems=[]
for i,p in enumerate(points,1):
    if p.get('lat') is None or p.get('lon') is None: problems.append(f'external point {i}: missing coordinates')
    else:
        lat=float(p['lat']); lon=float(p['lon'])
        if not (9.8 <= lat <= 11.5 and -62.2 <= lon <= -60.2): problems.append(f"external point {p.get('id')}: coordinate outside T&T discovery bounds")
    ids=p.get('record_ids') or []
    if not ids: problems.append(f"external point {p.get('id')}: no record_ids")
    for rid in ids:
        r=records.get(rid)
        if not r: problems.append(f"external point {p.get('id')}: missing record {rid}")
        elif r.get('database') in {'Document Access Register','Press Releases / News & Events','Environmental Court / Case Decisions'} and str(r.get('issuer') or '').strip() in {'','EMA','Environmental Management Authority'}:
            problems.append(f"external point {p.get('id')}: {rid} appears to be an EMA/core record")
    if not p.get('association_basis') and not p.get('note'): problems.append(f"external point {p.get('id')}: missing association basis/note")
portal='https://ei.weblakes.com/RTTPublic/PublicWelcome'
if len(stations)!=9: problems.append(f'AAQMN: expected 9 stations, found {len(stations)}')
for s in stations:
    if s.get('monitoring_portal_url')!=portal: problems.append(f"AAQMN {s.get('id')}: missing expected monitoring portal")
    if s.get('lat') is None or s.get('lon') is None: problems.append(f"AAQMN {s.get('id')}: missing coordinates")
# IMA press-release location evidence should be internally discoverable where enriched.
ext=json.loads((ROOT/'data/external_references.json').read_text(encoding='utf-8'))
byid={r['id']:r for r in ext}
for rid in ['IMA-PR-0005','IMA-PR-0006','IMA-PR-0009','IMA-PR-0010']:
    r=byid.get(rid)
    if not r: problems.append(f'missing enriched IMA press release {rid}')
    elif not (r.get('explicit_places') or r.get('location_text')): problems.append(f'{rid}: missing explicit spatial metadata')
if problems:
    print('SPATIAL VALIDATION FAILED')
    for x in problems: print('-',x)
    raise SystemExit(1)
print(f'SPATIAL VALIDATION PASSED: {len(points)} external discovery points; {len(stations)} AAQMN stations; portal links verified.')
