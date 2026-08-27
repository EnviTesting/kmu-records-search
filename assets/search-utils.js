(() => {
  'use strict';
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const lower=v=>clean(v).toLowerCase();
  const arr=v=>Array.isArray(v)?v:(v==null?[]:[v]);
  const uniq=a=>[...new Set(a.filter(Boolean))];
  function wordVariants(term){
    const t=lower(term); if(!t || /\s/.test(t)) return [t];
    const out=new Set([t]);
    if(t.length>3){
      if(t.endsWith('ies')&&t.length>4) out.add(t.slice(0,-3)+'y');
      else if(t.endsWith('es')&&t.length>4) out.add(t.slice(0,-2));
      else if(t.endsWith('s')&&!t.endsWith('ss')&&t.length>3) out.add(t.slice(0,-1));
      else { out.add(t+'s'); if(/[sxz]$|ch$|sh$/.test(t)) out.add(t+'es'); }
    }
    return [...out];
  }
  function termPresent(text,term){
    const hay=lower(text), t=lower(term); if(!t) return false;
    if(t.includes(' ')) return hay.includes(t);
    return wordVariants(t).some(v=>{
      if(/^[a-z0-9]{1,3}$/.test(v)) return new RegExp(`(^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z0-9]|$)`,'i').test(hay);
      return hay.includes(v);
    });
  }
  function buildPlan(query,concepts=[]){
    const input=lower(query); const phrases=[...input.matchAll(/"([^"]+)"/g)].map(m=>m[1]).filter(Boolean);
    const raw=input.replace(/"/g,'').trim(); const userTokens=raw.split(/\s+/).filter(Boolean);
    const aliases=new Set(), related=new Set(), matchedConcepts=[];
    for(const item of concepts||[]){
      const canonical=lower(item.canonical||item.term); const terms=[canonical,...arr(item.aliases).map(lower)].filter(Boolean);
      if(!terms.some(t=>termPresent(raw,t))) continue;
      matchedConcepts.push(clean(item.concept||item.canonical||item.term));
      terms.forEach(t=>{if(t&&!termPresent(raw,t)) aliases.add(t)});
      arr(item.related).map(lower).filter(Boolean).forEach(t=>related.add(t));
    }
    return {raw,userTokens,phrases,aliases:[...aliases].slice(0,12),related:[...related].slice(0,12),concepts:uniq(matchedConcepts)};
  }
  function scoreText(text,query,concepts=[]){
    const plan=typeof query==='object'?query:buildPlan(query,concepts); if(!plan.raw) return 1;
    const hay=lower(text); if(plan.phrases.length&&!plan.phrases.every(p=>termPresent(hay,p))) return 0;
    let score=termPresent(hay,plan.raw)?40:0;
    plan.userTokens.forEach(t=>{if(termPresent(hay,t))score+=12});
    plan.aliases.forEach(t=>{if(termPresent(hay,t))score+=7});
    plan.related.forEach(t=>{if(termPresent(hay,t))score+=2});
    return score;
  }
  function institution(record,db=''){
    const database=db||record.database||record.record_set||'';
    if(database==='documents'||database==='press_releases'||record.source_level==='EMA') return 'Environmental Management Authority';
    if(database==='judgments') return clean(record.court)||'Environmental Commission / Judiciary';
    const raw=clean(record.source_agency||record.issuer||record.custodian_or_owner||record.repository_body||record.repositoryBody||record.host_agency||record.source_label||'');
    const t=lower(raw+' '+(record.source_url||record.direct_url||record.source_page_url||''));
    const rules=[
      [/\bima\b|institute of marine affairs|ima\.gov\.tt/,'Institute of Marine Affairs'],
      [/central statistical office|\bcso\b|cso\.gov\.tt/,'Central Statistical Office'],
      [/parliament|ttparliament/,'Parliament of Trinidad and Tobago'],
      [/regulated industries commission|\bric\b|ric\.org\.tt/,'Regulated Industries Commission'],
      [/water and sewerage authority|\bwasa\b|wasa\.gov\.tt/,'Water and Sewerage Authority'],
      [/office of disaster preparedness|\bodpm\b|odpm\.gov\.tt/,'Office of Disaster Preparedness and Management'],
      [/ministry of energy|energy\.gov\.tt/,'Ministry of Energy and Energy Industries'],
      [/ministry of public utilities|mpu\.gov\.tt/,'Ministry of Public Utilities'],
      [/ministry of planning|planning\.gov\.tt/,'Ministry of Planning and Development'],
      [/ministry of social development|social\.gov\.tt/,'Ministry of Social Development and Family Services'],
      [/ministry of trade|tradeind\.gov\.tt/,'Ministry of Trade, Investment and Tourism'],
      [/rural development|local government|rdlg\.gov\.tt/,'Ministry of Rural Development and Local Government'],
      [/solid waste management|swmcol/,'SWMCOL'],
      [/environmental commission|ec\.gov\.tt/,'Environmental Commission'],
      [/university of the west indies|\buwi\b/,'The University of the West Indies'],
      [/global environment facility|\bgef\b/,'Global Environment Facility'],
      [/inter-american development bank|\bidb\b/,'Inter-American Development Bank'],
      [/food and agriculture organization|\bfao\b/,'Food and Agriculture Organization'],
      [/united nations environment|\bunep\b/,'UN Environment Programme'],
      [/unfccc|climate convention/,'UNFCCC'],
      [/convention on biological diversity|\bcbd\b/,'Convention on Biological Diversity']
    ];
    for(const [rx,label] of rules) if(rx.test(t)) return label;
    return raw||'Other / not specified';
  }
  const CONTROLLED_AREAS=['Air & Atmosphere','Water & Watersheds','Waste, Chemicals & Circular Economy','Biodiversity, Ecosystems & Protected Areas','Coastal & Marine','Climate Change & Resilience','Energy & Low-Carbon Transition','Industry, Extractives & Quarrying','Land, Development & CEC','Noise & Community Impacts','Environmental Governance, Law & Policy','Education, Participation & Partnerships','Corporate & Institutional Management'];
  function knowledgeArea(record){
    const area=clean(record.knowledge_area||record.programme_area||record.theme||''); if(CONTROLLED_AREAS.includes(area))return area;
    const text=lower([area,record.record_type_simplified,record.record_category,record.title,...arr(record.keywords)].join(' '));
    if(/\bair\b|air quality|emission|pm10|pm2\.5|particulate|ozone/.test(text))return'Air & Atmosphere';
    if(/water|watershed|river|groundwater|wastewater|sewage|effluent/.test(text))return'Water & Watersheds';
    if(/waste|recycl|chemical|pesticide|hazardous|circular/.test(text))return'Waste, Chemicals & Circular Economy';
    if(/biodiversity|forest|wildlife|protected area|ecosystem|species|habitat/.test(text))return'Biodiversity, Ecosystems & Protected Areas';
    if(/coastal|marine|ocean|coral|seagrass|mangrove|oil spill|fisher/.test(text))return'Coastal & Marine';
    if(/climate|resilien|disaster|flood|drought|landslide|hazard/.test(text))return'Climate Change & Resilience';
    if(/renewable|energy efficiency|low.carbon|decarbon|electric vehicle/.test(text))return'Energy & Low-Carbon Transition';
    if(/quarry|mineral|mining|extractive|hydrocarbon|oil and gas/.test(text))return'Industry, Extractives & Quarrying';
    if(/cec\b|environmental clearance|land use|planning|development|eia\b/.test(text))return'Land, Development & CEC';
    if(/noise/.test(text))return'Noise & Community Impacts';
    if(/law|legal|governance|regulation|policy|court|parliament|foia/.test(text))return'Environmental Governance, Law & Policy';
    if(/education|outreach|participation|community|public awareness|partnership/.test(text))return'Education, Participation & Partnerships';
    return'Corporate & Institutional Management';
  }
  function governanceBucket(record){
    const type=lower(record.record_type_simplified||record.record_category||record.record_type||'');
    const text=lower(type+' '+(record.title||''));
    if(/legislation|legal instrument|court|tribunal|gazette|rule|regulation|act\b/.test(text)) return 'Legislation & Regulation';
    if(/policy|strategy/.test(text)) return 'Policy & Strategy';
    if(/plan|management plan|framework/.test(text)) return 'Plans & Management';
    if(/project|programme|activity|implementation/.test(text)) return 'Projects & Activities';
    if(/dataset|data table|register|monitoring|performance|statistics|portal/.test(text)) return 'Data & Monitoring';
    if(/technical|research|study|assessment|survey|evaluation|report/.test(text)) return 'Research & Evidence';
    return 'Guidance & Public Information';
  }
  window.KRSTSearch={clean,lower,arr,uniq,wordVariants,termPresent,buildPlan,scoreText,institution,knowledgeArea,governanceBucket,CONTROLLED_AREAS};
})();
