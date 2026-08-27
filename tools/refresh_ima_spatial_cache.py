#!/usr/bin/env python3
"""Refresh optional IMA Marine Data Hub GeoJSON caches for TRACE.

Layer IDs are discovered from each FeatureServer. Existing cache files are preserved if
an upstream service is unavailable; no synthetic geometry is created.
"""
from __future__ import annotations
import json, ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[1]
LAYERS=ROOT/'data'/'spatial_layers.json'; OUT=ROOT/'data'/'spatial_cache'; OUT.mkdir(parents=True,exist_ok=True)
UA='TRACE-IMA-spatial-cache/1.0'
ctx=ssl.create_default_context()
def get_json(url,timeout=8):
    req=Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
    with urlopen(req,timeout=timeout,context=ctx) as r: return json.load(r)
def discover(service):
    base=service.rstrip('/')
    meta=get_json(base+'?f=pjson'); layers=meta.get('layers') or []
    if not layers:
        meta=get_json(base+'/layers?f=pjson'); layers=meta.get('layers') or []
    if not layers: raise RuntimeError('FeatureServer advertised no layers')
    return layers[0]['id']
def query(service,layer_id):
    params=urlencode({'where':'1=1','outFields':'*','returnGeometry':'true','outSR':'4326','f':'geojson'})
    geo=get_json(f"{service.rstrip('/')}/{layer_id}/query?{params}")
    if geo.get('type')!='FeatureCollection': raise RuntimeError('query did not return a GeoJSON FeatureCollection')
    return geo
def main():
    cfgs=json.loads(LAYERS.read_text(encoding='utf-8')); status={'generated_at':datetime.now(timezone.utc).isoformat(),'layers':{}}
    for cfg in cfgs:
        if cfg.get('provider')!='Institute of Marine Affairs' or cfg.get('kind')!='arcgis_feature_service': continue
        ident=cfg['id']; fp=OUT/f'{ident}.geojson'
        try:
            lid=discover(cfg['service_url']); geo=query(cfg['service_url'],lid)
            geo.setdefault('trace_cache',{}).update({'source':cfg['service_url'],'layer_id':lid,'refreshed_at':datetime.now(timezone.utc).isoformat(),'provider':'Institute of Marine Affairs'})
            fp.write_text(json.dumps(geo,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
            status['layers'][ident]={'ok':True,'feature_count':len(geo.get('features') or []),'layer_id':lid,'cache':str(fp.relative_to(ROOT))}
            print(f"{ident}: cached {len(geo.get('features') or [])} features from layer {lid}")
        except Exception as e:
            status['layers'][ident]={'ok':False,'error':f'{type(e).__name__}: {e}','preserved_existing_cache':fp.exists(),'cache':str(fp.relative_to(ROOT))}
            print(f"{ident}: upstream unavailable; cache preserved={fp.exists()} ({e})")
    (OUT/'refresh_status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return 0
if __name__=='__main__': raise SystemExit(main())
