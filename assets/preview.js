(() => {
  'use strict';
  const DATASETS=['documents','judgments','press_releases','external_references','parliamentary_evidence','gazette_records','statistical_context','regional_references','international_references','videos'];
  const TT_MAX_BOUNDS=[[9.80,-62.18],[11.58,-60.28]];
  const state={records:[],media:[],places:[],observances:[],boundaries:null,source:'all',topic:'all',viewMode:'both',showMedia:false,calendarTopic:'all',map:null,markerLayer:null,boundaryLayer:null,tileLayer:null,tileErrors:0,mode:'pending'};
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const lower=v=>clean(v).toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  document.addEventListener('DOMContentLoaded',init);

  async function init(){
    bindTabs();
    const [records,media,places,obs,boundaries]=await Promise.all([
      loadRecords(),loadJson('data/ema_in_news.json'),loadJson('data/spatial_preview.json'),loadJson('data/environmental_observances.json'),loadJson('data/tt_adm1_fallback.geojson')
    ]);
    state.records=records; state.media=Array.isArray(media)?media:[];
    state.places=Array.isArray(places)?places:[];
    state.observances=Array.isArray(obs)?obs:[];
    state.boundaries=boundaries&&boundaries.type==='FeatureCollection'?boundaries:null;
    populateFilters();bindFilters();renderCalendar();initMap();
  }

  async function loadJson(path){
    try{const r=await fetch(path,{cache:'no-store'});if(r.ok)return await r.json();}catch{}
    return null;
  }
  async function loadRecords(){
    const chunks=await Promise.all(DATASETS.map(async db=>((await loadJson(`data/${db}.json`))||[]).map(r=>normalise(r,db))));
    return chunks.flat();
  }
  function normalise(r,db){
    const allText=[r.title,r.short_title,r.description,r.summary_snippet,r.knowledge_area,r.programme_area,r.theme,r.record_type_simplified,r.record_category,r.issuer,...(Array.isArray(r.keywords)?r.keywords:[])].join(' ');
    const geoText=[r.title,r.short_title,r.description,r.summary_snippet,r.knowledge_area,r.programme_area,r.theme,...(Array.isArray(r.keywords)?r.keywords:[])].join(' ')
      .replace(/trinidad\s*(?:and|&)\s*tobago/gi,' ')
      .replace(/\bt\s*&\s*t\b/gi,' ');
    return {...r,database:db,text:lower(allText),geoText:lower(geoText)};
  }
  function sourceGroup(r){if(r.database==='external_references')return'government';if(r.database==='parliamentary_evidence')return'parliament';if(r.database==='gazette_records')return'gazette';if(r.database==='statistical_context')return'statistical';if(r.database==='regional_references')return'regional';if(r.database==='international_references')return'international';if(r.database==='videos')return'video';if(r.database==='judgments')return'court';return'ema';}
  function sourceLabel(r){return {ema:'EMA',government:'Government',parliament:'Parliament',gazette:'Gazette',statistical:'Research & statistics',regional:'Regional',international:'International · T&T',video:'Video',court:'Court / tribunal'}[sourceGroup(r)]||'Source';}
  function baseRecordFilter(r){return state.source==='all'||sourceGroup(r)===state.source;}

  function bindTabs(){$('mapTab').addEventListener('click',()=>setTab('map'));$('calendarTab').addEventListener('click',()=>setTab('calendar'));}
  function setTab(which){const map=which==='map';$('mapTab').classList.toggle('active',map);$('calendarTab').classList.toggle('active',!map);$('mapTab').setAttribute('aria-selected',String(map));$('calendarTab').setAttribute('aria-selected',String(!map));$('mapPanel').classList.toggle('hidden',!map);$('calendarPanel').classList.toggle('hidden',map);if(map&&state.map)setTimeout(()=>state.map.invalidateSize(),0);}
  function populateFilters(){const topics=[...new Set(state.places.map(p=>p.topic).filter(Boolean))].sort();$('mapTopicFilter').innerHTML='<option value="all">All preview topics</option>'+topics.map(t=>`<option>${esc(t)}</option>`).join('');const ct=[...new Set(state.observances.map(o=>o.topic).filter(Boolean))].sort();$('calendarTopicFilter').innerHTML='<option value="all">All topics</option>'+ct.map(t=>`<option>${esc(t)}</option>`).join('');}
  function bindFilters(){
    $('mapSourceFilter').addEventListener('change',e=>{state.source=e.target.value;renderMap();});
    $('mapTopicFilter').addEventListener('change',e=>{state.topic=e.target.value;renderMap();});
    $('mapViewMode').addEventListener('change',e=>{state.viewMode=e.target.value;renderMap();});
    $('mediaMapToggle')?.addEventListener('change',e=>{state.showMedia=Boolean(e.target.checked);renderMap();});
    $('resetMapFilters').addEventListener('click',()=>{state.source='all';state.topic='all';state.viewMode='both';state.showMedia=false;$('mapSourceFilter').value='all';$('mapTopicFilter').value='all';$('mapViewMode').value='both';if($('mediaMapToggle'))$('mediaMapToggle').checked=false;renderMap();});
    $('calendarTopicFilter').addEventListener('change',e=>{state.calendarTopic=e.target.value;renderCalendar();});
  }
  function topicTerms(){if(state.topic==='all')return[];return [...new Set(state.places.filter(p=>p.topic===state.topic).flatMap(p=>p.match_terms||[]).map(lower).filter(Boolean))];}
  function topicRecordFilter(r){const terms=topicTerms();return !terms.length||terms.some(t=>r.text.includes(t));}
  function matches(place){const terms=(place.match_terms||[]).map(lower);return state.records.filter(r=>baseRecordFilter(r)&&terms.some(t=>t&&r.text.includes(t)));}
  function mediaMatches(place){if(!state.showMedia)return[];const terms=[lower(place.name),...(place.match_terms||[]).map(lower)].filter(Boolean);return state.media.filter(r=>{const gs=(r.geography||[]).map(lower);return gs.some(g=>terms.some(t=>g===t||g.includes(t)||t.includes(g)));});}

  function regionAliases(name){
    const n=lower(name);const map={
      'couva-tabaquite-talparo':['couva-tabaquite-talparo','couva','tabaquite','talparo'],
      'mayaro/rio claro':['mayaro/rio claro','mayaro rio claro','mayaro','rio claro'],
      'penal-debe':['penal-debe','penal','debe'],
      'san juan-laventille':['san juan-laventille','san juan','laventille'],
      'tunapuna/piarco':['tunapuna/piarco','tunapuna piarco','tunapuna','piarco']
    };
    return map[n]||[n];
  }
  function matchesRegion(name){const aliases=regionAliases(name);return state.records.filter(r=>baseRecordFilter(r)&&topicRecordFilter(r)&&aliases.some(a=>a&&r.geoText.includes(a)));}
  function regionMatchMap(){const m=new Map();for(const f of state.boundaries?.features||[]){const n=f?.properties?.NAME_1;if(n)m.set(n,matchesRegion(n));}return m;}

  function initMap(){
    if(window.L&&typeof window.L.map==='function'){
      try{initLeaflet();return;}catch(err){console.warn(err);setStatus('Interactive basemap could not be started. Using the local Trinidad and Tobago boundary fallback.','warn');}
    } else setStatus('Leaflet could not be loaded. Using the local Trinidad and Tobago boundary fallback.','warn');
    initFallback();
  }
  function initLeaflet(){
    state.mode='leaflet';$('leafletMap').classList.remove('hidden');$('mapFallback').classList.add('hidden');
    state.map=L.map('leafletMap',{zoomControl:true,minZoom:8,maxZoom:15,maxBounds:TT_MAX_BOUNDS,maxBoundsViscosity:1.0,worldCopyJump:false,preferCanvas:true});
    state.map.attributionControl.setPrefix(false);
    state.tileLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(state.map);
    state.tileLayer.on('tileload',()=>{if(state.tileErrors===0)setStatus('OpenStreetMap basemap active. The local administrative layer supports information discovery.','ok');});
    state.tileLayer.on('tileerror',()=>{state.tileErrors+=1;if(state.tileErrors===1)setStatus('Some OpenStreetMap tiles are unavailable. The local Trinidad and Tobago boundary layer remains available.','warn');if(state.tileErrors>=6){try{state.map.removeLayer(state.tileLayer);}catch{}setStatus('OpenStreetMap basemap unavailable. Showing the locally stored Trinidad and Tobago administrative boundary layer instead.','warn');}});
    if(state.boundaries){
      state.boundaryLayer=L.geoJSON(state.boundaries,{style:()=>boundaryStyle(0),onEachFeature:(feature,layer)=>{
        const n=feature?.properties?.NAME_1;if(!n)return;
        layer.on('click',()=>{if(state.viewMode!=='places')showRegion(n,matchesRegion(n));});
        layer.on('mouseover',e=>{if(state.viewMode!=='places')e.target.setStyle({weight:2.3});});
        layer.on('mouseout',e=>{if(state.boundaryLayer)state.boundaryLayer.resetStyle(e.target);});
      }}).addTo(state.map);
      const b=state.boundaryLayer.getBounds();if(b.isValid())state.map.fitBounds(b.pad(.04));else state.map.fitBounds([[10.0,-61.95],[11.4,-60.45]]);
    } else state.map.fitBounds([[10.0,-61.95],[11.4,-60.45]]);
    state.markerLayer=L.layerGroup().addTo(state.map);renderMap();
  }
  function boundaryStyle(count){
    if(state.viewMode==='places')return{color:'#6f8d85',weight:1,fillColor:'#dfeae5',fillOpacity:.06,interactive:false};
    const opacity=count?Math.min(.62,.14+Math.log2(count+1)*.10):.06;
    return{color:'#557b70',weight:1.2,fillColor:'#087d6f',fillOpacity:opacity,interactive:true};
  }
  function updateLeafletBoundaries(regionMap){
    if(!state.boundaryLayer)return;
    state.boundaryLayer.eachLayer(layer=>{
      const n=layer.feature?.properties?.NAME_1||'';const rows=regionMap.get(n)||[];
      layer.setStyle(boundaryStyle(rows.length));
      if(state.viewMode==='places'){layer.unbindTooltip();}
      else{layer.bindTooltip(`${n} · ${rows.length} explicitly matched record${rows.length===1?'':'s'}`,{sticky:true});}
    });
  }

  function renderMap(){
    const shown=state.places.filter(p=>state.topic==='all'||p.topic===state.topic);
    const placeMap=new Map();const regionMap=regionMatchMap();const unique=new Set();
    if(state.viewMode!=='regions')shown.forEach(p=>{const m=matches(p);placeMap.set(p.id,m);m.forEach(r=>unique.add(r.id));});
    if(state.viewMode!=='places')for(const rows of regionMap.values())rows.forEach(r=>unique.add(r.id));
    $('mappedRecordCount').textContent=unique.size;
    if(state.mode==='leaflet'){renderLeafletMarkers(state.viewMode==='regions'?[]:shown,placeMap);updateLeafletBoundaries(regionMap);}else renderFallback(state.viewMode==='regions'?[]:shown,placeMap,regionMap);
    if(!shown.length&&state.viewMode!=='regions')$('placePanel').innerHTML='<p class="empty-state">No preview places match the selected topic.</p>';
  }
  function renderLeafletMarkers(shown,matchMap){
    if(!state.markerLayer)return;state.markerLayer.clearLayers();
    for(const p of shown){const rows=matchMap.get(p.id)||[];const radius=Math.min(19,7+Math.sqrt(rows.length)*2.1);const marker=L.circleMarker([p.lat,p.lon],{radius,weight:2,color:'#005c52',fillColor:'#006b5f',fillOpacity:.88});const mc=mediaMatches(p).length;marker.bindTooltip(`${p.name} · ${rows.length} knowledge record${rows.length===1?'':'s'}${state.showMedia&&mc?` · ${mc} media`:''}`,{direction:'top'});marker.on('click',()=>showPlace(p.id,rows));marker.addTo(state.markerLayer);}
  }

  function initFallback(){state.mode='fallback';$('leafletMap').classList.add('hidden');$('mapFallback').classList.remove('hidden');renderMap();}
  function fallbackBounds(){if(state.boundaries){const coords=[];for(const f of state.boundaries.features||[])collectCoords(f.geometry?.coordinates,coords);if(coords.length)return{minLon:Math.min(...coords.map(c=>c[0])),maxLon:Math.max(...coords.map(c=>c[0])),minLat:Math.min(...coords.map(c=>c[1])),maxLat:Math.max(...coords.map(c=>c[1]))};}return{minLon:-61.95,maxLon:-60.45,minLat:10.0,maxLat:11.4};}
  function collectCoords(node,out){if(!Array.isArray(node))return;if(typeof node[0]==='number'&&typeof node[1]==='number'){out.push(node);return;}node.forEach(n=>collectCoords(n,out));}
  function proj(lon,lat,b){const pad=30,w=900,h=590;const x=pad+(lon-b.minLon)/(b.maxLon-b.minLon)*(w-pad*2);const y=h-pad-(lat-b.minLat)/(b.maxLat-b.minLat)*(h-pad*2);return[x,y];}
  function geometryPaths(geom,b){if(!geom)return'';const polys=geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];return polys.map(poly=>poly.map(ring=>ring.map((c,i)=>{const[x,y]=proj(c[0],c[1],b);return`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ')+' Z').join(' ')).join(' ');}
  function fallbackOpacity(count){return state.viewMode==='places'?0.06:(count?Math.min(.62,.14+Math.log2(count+1)*.10):.06);}
  function renderFallback(shown,placeMap,regionMap){
    const host=$('mapFallback');if(!host)return;const b=fallbackBounds();
    const outlines=state.boundaries?(state.boundaries.features||[]).map(f=>{const n=f.properties?.NAME_1||'Administrative area';const rows=regionMap.get(n)||[];const clickable=state.viewMode!=='places';return`<path class="fallback-area${clickable?' clickable':''}" data-region="${esc(n)}" tabindex="${clickable?'0':'-1'}" d="${geometryPaths(f.geometry,b)}" style="fill-opacity:${fallbackOpacity(rows.length)}"><title>${esc(n)} · ${rows.length} explicitly matched record${rows.length===1?'':'s'}</title></path>`;}).join(''):'<rect class="fallback-area" x="30" y="30" width="840" height="530" />';
    const markers=shown.map(p=>{const rows=placeMap.get(p.id)||[];const[x,y]=proj(p.lon,p.lat,b);const rad=Math.min(20,8+Math.sqrt(rows.length)*2);return`<g class="fallback-marker" role="button" tabindex="0" data-place="${esc(p.id)}"><circle cx="${x}" cy="${y}" r="${rad}"/><text x="${x}" y="${y}">${rows.length}</text><title>${esc(p.name)} · ${rows.length} knowledge record${rows.length===1?'':'s'}${state.showMedia&&mediaMatches(p).length?` · ${mediaMatches(p).length} media`:''}</title></g>`;}).join('');
    host.innerHTML=`<svg viewBox="0 0 900 590" aria-label="Local Trinidad and Tobago boundary fallback"><rect class="fallback-sea" width="900" height="590"/>${outlines}${markers}</svg>`;
    host.querySelectorAll('.fallback-marker').forEach(el=>{const open=()=>showPlace(el.dataset.place,placeMap.get(el.dataset.place)||[]);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
    host.querySelectorAll('.fallback-area.clickable').forEach(el=>{const open=()=>showRegion(el.dataset.region,regionMap.get(el.dataset.region)||[]);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
  }

  function setStatus(text,kind){const el=$('mapStatus');if(!el)return;el.textContent=text;el.className=`map-status ${kind||''}`;}
  function recordUrl(r){return r.direct_url||r.source_url||r.source_page_url||'';}
  function sourceChips(rows){const by={};rows.forEach(r=>by[sourceGroup(r)]=(by[sourceGroup(r)]||0)+1);return Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<span class="badge">${esc(({ema:'EMA',government:'Government',parliament:'Parliament',gazette:'Gazette',statistical:'Research/statistics',regional:'Regional',international:'International',video:'Video',court:'Court'}[k]||k))} ${n}</span>`).join('');}
  function accessStatus(r){
    if(['open_online','request_ema','reference_only','link_review'].includes(r.access_status)) return r.access_status;
    const t=lower([r.source_status,r.access_route,r.availability_note,r.notes].join(' '));
    if(recordUrl(r)) return 'open_online'; if(/request|held by ema/.test(t)) return 'request_ema'; if(/review|broken/.test(t)) return 'link_review'; return 'reference_only';
  }
  function recordList(rows){return rows.slice(0,12).map(r=>{const u=recordUrl(r),st=accessStatus(r),title=r.short_title||r.title;const action=u?`<a href="${esc(u)}" target="_blank" rel="noopener">Open source ↗</a>`:st==='request_ema'?'<a href="https://www.ema.co.tt/information-centre-general-request/" target="_blank" rel="noopener">Request from Information Centre ↗</a>':st==='link_review'?'<span class="badge">Link under review</span>':'<span class="badge">Reference source</span>';return`<article class="mini-record"><h4>${esc(title)}</h4><p>${esc(sourceLabel(r))} · ${esc(r.source_agency||r.issuer||r.record_set||r.database)} · ${esc(r.year||String(r.date_published||'').slice(0,4)||'Year n/a')}</p><div class="record-mini-actions">${action}<button type="button" class="media-badge" data-map-list="${esc(r.id)}">+ My List</button></div></article>`;}).join('');}
  function mediaList(rows){return rows.slice(0,10).map(r=>{const u=r.link_kind==='article'?(r.direct_url||r.source_url||''):'';return`<div class="media-mini-record"><strong>${esc(r.headline||r.title)}</strong><small>${esc(r.outlet||r.source_agency||'Media')} · ${esc(r.publication_date||r.year||'')}</small>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">Open article ↗</a>`:'<span class="media-badge">Article link unavailable</span>'}<button type="button" class="media-badge" data-media-list="${esc(r.id)}">+ My List</button></div>`;}).join('');}
  function bindListButtons(){document.querySelectorAll('[data-map-list]').forEach(b=>b.onclick=()=>{const r=state.records.find(x=>x.id===b.dataset.mapList);if(r&&window.EMAList)window.EMAList.add(r)});document.querySelectorAll('[data-media-list]').forEach(b=>b.onclick=()=>{const r=state.media.find(x=>x.id===b.dataset.mediaList);if(r&&window.EMAList)window.EMAList.add(r)});}
  function commonPanel(title,subtitle,note,rows,searchTerm,mediaRows=[]){$('placePanel').innerHTML=`<h3>${esc(title)}</h3><p class="empty-state">${esc(subtitle)}</p><div class="place-meta"><span class="badge">${rows.length} knowledge record${rows.length===1?'':'s'}</span>${sourceChips(rows)}${state.showMedia?`<span class="badge">${mediaRows.length} media article${mediaRows.length===1?'':'s'}</span>`:''}</div><p class="empty-state">${esc(note)}</p><div class="legal-map-note">Location and record associations support information discovery only. Administrative-area matching is based on explicit indexed place terms; it does not indicate project boundaries, regulatory jurisdiction, legal effect, environmental condition, compliance status or an EMA determination.</div><div class="record-list">${recordList(rows)||'<p class="empty-state">No knowledge records match the current filters.</p>'}</div>${rows.length>12?`<p class="empty-state">Showing 12 of ${rows.length} matched knowledge records.</p>`:''}${state.showMedia?`<section class="media-subsection"><h4>Media coverage (optional layer)</h4>${mediaList(mediaRows)||'<p class="empty-state">No media archive records are explicitly indexed to this discovery place.</p>'}</section>`:''}<p><a href="index.html?search=${encodeURIComponent(searchTerm)}&related=1">Search “${esc(searchTerm)}” in the main tool →</a></p>`;bindListButtons();}
  function showPlace(id,rows){const p=state.places.find(x=>x.id===id);if(!p)return;commonPanel(p.name,`${p.topic} · ${p.precision} discovery location`,p.note,rows,p.name,mediaMatches(p));}
  function showRegion(name,rows){commonPanel(name,'Administrative-area information coverage','Records shown here explicitly name or are indexed to this administrative area. National records are not assigned to an area simply because they concern Trinidad and Tobago.',rows,name,[]);}

  function renderCalendar(){const rows=state.observances.filter(o=>state.calendarTopic==='all'||o.topic===state.calendarTopic).sort((a,b)=>a.month-b.month||a.day-b.day);$('observanceCount').textContent=state.observances.length;const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];$('calendarGrid').innerHTML=rows.map(o=>`<article class="observance-card"><div class="date-box"><strong>${o.day}</strong><span>${months[o.month-1]}</span></div><div><h3>${esc(o.name)}</h3><p>${esc(o.topic)}</p><div class="custodian"><strong>${esc(o.custodian_type)}</strong><br>${esc(o.custodian)}</div><p>${esc(o.note)}</p><div class="observance-links"><a href="${esc(o.ema_url)}" target="_blank" rel="noopener">EMA context ↗</a>${o.custodian_url?`<a href="${esc(o.custodian_url)}" target="_blank" rel="noopener">International reference ↗</a>`:''}</div></div></article>`).join('');}
})();
