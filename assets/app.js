(() => {
  'use strict';

  const APP_VERSION = '7.3.0';
  const APP_BUILD = '2026.08.26-kmu-doc-search-v7.3.0';
  const EMA_REQUEST_URL = 'https://www.ema.co.tt/information-centre-general-request/';
  const KMU_CONTACT_EMAIL = 'rseemungal@ema.co.tt'; // Knowledge Management contact for record suggestions, corrections and broken-link reports.
  const DATA_VERSION = '2026.08.26.1';
  const PAGE_SIZE = 45;
  const RELATED_DATABASES = new Set(['external_references','parliamentary_evidence','gazette_records','statistical_context','regional_references','international_references','videos']);

  const state = {
    raw: { documents: [], press_releases: [], judgments: [], external_references: [], parliamentary_evidence: [], gazette_records: [], statistical_context: [], regional_references: [], international_references: [], videos: [] },
    records: [],
    filtered: [],
    visibleCount: PAGE_SIZE,
    database: 'all',
    includeExternal: false,
    quickFilter: 'all',
    journey: 'all',
    query: '',
    area: 'all',
    type: 'all',
    status: 'all',
    year: 'all',
    resultSource: 'all',
    resultAccess: 'all',
    resultYear: 'all',
    resultTopic: 'all',
    sortMode: 'relevance',
    searchInitiated: false,
    dataLoaded: false,
    loadingPromise: null,
    mobileMode: window.matchMedia('(max-width: 760px)').matches,
    searchTerms: [],
    relationships: [],
    relatedIndex: {},
    queryPlan: null,
    expandedId: null,
    basket: loadBasket(),
    listDockCollapsed: localStorage.getItem('emaMyListDockCollapsed') === '1',
    diagnostics: [],
    loadedPaths: {}
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const exists = (el) => Boolean(el);
  const safeText = (id, value) => { const el = $(id); if (el) el.textContent = String(value ?? ''); };
  const safeHTML = (id, value) => { const el = $(id); if (el) el.innerHTML = String(value ?? ''); };
  const show = (id, force) => { const el = $(id); if (el) el.classList.toggle('hidden', force === undefined ? false : !force); };
  const hide = (id) => { const el = $(id); if (el) el.classList.add('hidden'); };

  function esc(v){
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  // Defense-in-depth: tools/validate_data.py already rejects non-http(s) URLs in the
  // knowledge base, but the renderer should not rely solely on that upstream check. Any value
  // that isn't a genuine http(s) URL is treated as absent rather than emitted as an href.
  function safeHref(v){
    const s = clean(v);
    if (!s) return '';
    try {
      const u = new URL(s, window.location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? s : '';
    } catch { return ''; }
  }
  function clean(v){ return String(v ?? '').replace(/\s+/g, ' ').trim(); }
  function lower(v){ return clean(v).toLowerCase(); }
  function array(v){ return Array.isArray(v) ? v : (v == null ? [] : [v]); }
  function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }
  function toSlug(v){ return lower(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function extractYearTags(value){
    const matches = String(value ?? '').match(/\b(19\d{2}|20\d{2})\b/g) || [];
    return uniq(matches.map(String)).sort((a,b)=>Number(b)-Number(a));
  }
  function debug(msg, obj){
    const stamp = new Date().toISOString().slice(11,19);
    state.diagnostics.push(`[${stamp}] ${msg}${obj ? ' ' + JSON.stringify(obj) : ''}`);
    if (state.diagnostics.length > 60) state.diagnostics.shift();
    renderDiagnostics();
  }

  // Canonical GitHub Pages data paths. The production repository keeps one copy
  // of each record set under data/ to avoid duplicate files drifting out of sync.
  const DATASETS = {
    documents: ['data/documents.json'],
    judgments: ['data/judgments.json'],
    press_releases: ['data/press_releases.json'],
    external_references: ['data/external_references.json'],
    parliamentary_evidence: ['data/parliamentary_evidence.json'],
    gazette_records: ['data/gazette_records.json'],
    statistical_context: ['data/statistical_context.json'],
    regional_references: ['data/regional_references.json'],
    international_references: ['data/international_references.json'],
    videos: ['data/videos.json']
  };

  const SUPPORT_FILES = {
    searchTerms: ['data/search_terms.json'],
    relationships: ['data/relationships.json'],
    relatedIndex: ['data/related_index.json']
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    safeText('appVersion', APP_VERSION);
    bindEvents();
    await unregisterOldServiceWorkers(false);
    const params = new URLSearchParams(window.location.search);
    const initialSearch = clean(params.get('search'));
    if (initialSearch) { state.query = initialSearch; const input = $('searchInput'); if (input) input.value = initialSearch; }
    if (params.get('related') === '1') { state.includeExternal = true; const ext = $('externalToggle'); if (ext) ext.checked = true; }
    if(params.get('area')) state.area=params.get('area'); if(params.get('type')) state.type=params.get('type'); if(params.get('source')) state.resultSource=params.get('source'); if(params.get('access')) state.resultAccess=params.get('access');
    state.searchInitiated = !state.mobileMode || Boolean(initialSearch);
    setMobileIdle(state.mobileMode && !state.searchInitiated);
    renderBasket();
    if (state.searchInitiated) {
      await ensureDataLoaded();
      applyFiltersAndRender();
    } else {
      safeText('resultCount', 'Search to view records.');
      hide('loadNotice');
    }
    debug('Initialised', { version: APP_BUILD, records: state.records.length, mobileMode: state.mobileMode, searchInitiated: state.searchInitiated });
  }

  function setMobileIdle(idle){
    document.body.classList.toggle('mobile-search-idle', Boolean(idle));
    const results=$('resultsPanel') || document.querySelector('.results-panel');
    if (results && state.mobileMode) results.classList.toggle('hidden', Boolean(idle));
  }

  async function ensureDataLoaded(){
    if (state.dataLoaded) return;
    if (state.loadingPromise) return state.loadingPromise;
    state.loadingPromise = (async()=>{
      await loadAllData();
      const [terms,rels,related]=await Promise.all([
        loadSupportJson(SUPPORT_FILES.searchTerms, []),
        loadSupportJson(SUPPORT_FILES.relationships, []),
        loadSupportJson(SUPPORT_FILES.relatedIndex, {})
      ]);
      state.searchTerms = Array.isArray(terms) ? terms : [];
      state.relationships = Array.isArray(rels) ? rels : [];
      state.relatedIndex = related && typeof related === 'object' && !Array.isArray(related) ? related : {};
      normaliseAllRecords();
      populateFilters();
      [['areaFilter',state.area],['typeFilter',state.type],['resultSourceFilter',state.resultSource],['resultAccessFilter',state.resultAccess]].forEach(([id,v])=>{const el=$(id);if(el&&v&&v!=='all')el.value=v;});
      state.dataLoaded = true;
    })();
    try { await state.loadingPromise; } finally { state.loadingPromise=null; }
  }

  async function loadSupportJson(paths, fallback){
    for (const path of paths) {
      try {
        const response=await fetch(`${path}?v=${encodeURIComponent(APP_VERSION)}`,{cache:'no-store'});
        if(response.ok) return await response.json();
      } catch {}
    }
    return fallback;
  }

  function bindEvents(){
    document.addEventListener('keydown',(e)=>{if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement?.tagName||'')){e.preventDefault();$('searchInput')?.focus();}});
    $('searchForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      state.query = $('searchInput')?.value || '';
      state.searchInitiated = true;
      setMobileIdle(false);
      await ensureDataLoaded();
      state.visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
      if(state.mobileMode) $('resultsHeading')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    $('searchInput')?.addEventListener('input', (e) => {
      state.query = e.target.value;
      if(state.mobileMode) return;
      if(!state.dataLoaded) return;
      state.visibleCount = PAGE_SIZE; applyFiltersAndRender();
    });
    $('clearSearchBtn')?.addEventListener('click', () => {
      state.query = ''; const input = $('searchInput'); if (input) input.value = ''; state.visibleCount = PAGE_SIZE;
      if(state.mobileMode){ state.searchInitiated=false; setMobileIdle(true); safeText('resultCount','Search to view records.'); return; }
      if(state.dataLoaded) applyFiltersAndRender();
    });
    $('journeySelect')?.addEventListener('change', (e) => { state.journey = e.target.value; state.quickFilter = e.target.value === 'all' ? 'all' : e.target.value; syncQuickFilters(); state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('areaFilter')?.addEventListener('change', (e) => { state.area = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('typeFilter')?.addEventListener('change', (e) => { state.type = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('statusFilter')?.addEventListener('change', (e) => { state.status = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('yearFilter')?.addEventListener('change', (e) => { state.year = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('sortResults')?.addEventListener('change', (e) => { state.sortMode = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('resultSourceFilter')?.addEventListener('change', (e) => { state.resultSource = e.target.value; if(state.resultSource!=='all' && state.resultSource!=='ema' && state.resultSource!=='court'){ state.includeExternal=true; const ext=$('externalToggle'); if(ext) ext.checked=true; } state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('resultAccessFilter')?.addEventListener('change', (e) => { state.resultAccess = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('resultYearFilter')?.addEventListener('change', (e) => { state.resultYear = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('resultTopicFilter')?.addEventListener('change', (e) => { state.resultTopic = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('clearResultFiltersBtn')?.addEventListener('click', clearResultFilters);
    $('externalToggle')?.addEventListener('change', async (e) => { state.includeExternal = Boolean(e.target.checked); if(!state.searchInitiated && state.mobileMode) return; await ensureDataLoaded(); state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('loadMoreBtn')?.addEventListener('click', () => { state.visibleCount += PAGE_SIZE; renderResults(); });
    $('exportResultsBtn')?.addEventListener('click', () => downloadCsv(state.filtered, 'ema-current-results.csv'));
    $('openBasketBtn')?.addEventListener('click', openBasket);
    $('dockOpenListBtn')?.addEventListener('click', openBasket);
    $('dockHideBtn')?.addEventListener('click', collapseListDock);
    $('listDockPill')?.addEventListener('click', openBasket);
    $('recordSuggestionToggle')?.addEventListener('click', toggleRecordSuggestionPanel);
    $('closeBasketBtn')?.addEventListener('click', closeBasket);
    $('basketDrawer')?.addEventListener('click', (e) => { if (e.target === $('basketDrawer')) closeBasket(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('basketDrawer')?.classList.contains('open')) closeBasket(); });
    $('clearBasketBtn')?.addEventListener('click', () => { state.basket = []; saveBasket(); renderBasket(); renderResults(); });
    $('copyRequestBtn')?.addEventListener('click', copyRequestText);
    $('downloadCsvBtn')?.addEventListener('click', () => downloadCsv(state.basket, 'ema-selected-records.csv'));
    $('downloadJsonBtn')?.addEventListener('click', () => downloadJson(state.basket, 'ema-selected-records.json'));
    bindHiddenAdminUnlock();
    $('resetCacheBtn')?.addEventListener('click', () => unregisterOldServiceWorkers(true));

    $('quickFiltersToggle')?.addEventListener('click', () => {
      const el = $('quickFilters');
      if (!el) return;
      const hidden = el.classList.toggle('hidden');
      const btn = $('quickFiltersToggle');
      if (btn) { btn.textContent = hidden ? 'Show search filters' : 'Hide quick filters'; btn.setAttribute('aria-expanded', String(!hidden)); }
    });
    $('advancedToggle')?.addEventListener('click', () => {
      const el = $('advancedFilters');
      if (!el) return;
      const hidden = el.classList.toggle('hidden');
      const btn = $('advancedToggle');
      if (btn) { btn.textContent = hidden ? 'Show advanced search' : 'Hide advanced search'; btn.setAttribute('aria-expanded', String(!hidden)); }
    });

    document.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-database]');
      if (tab) {
        state.database = tab.getAttribute('data-database') || 'all';
        $$('.tab').forEach(b => b.classList.toggle('active', b === tab));
        state.visibleCount = PAGE_SIZE;
        applyFiltersAndRender();
        return;
      }
      const filter = e.target.closest('[data-filter]');
      if (filter) {
        state.quickFilter = filter.getAttribute('data-filter') || 'all';
        if(['video','datasets'].includes(state.quickFilter)){state.includeExternal=true; const ext=$('externalToggle'); if(ext) ext.checked=true;}
        state.journey = state.quickFilter;
        const select = $('journeySelect'); if (select) select.value = state.journey;
        syncQuickFilters();
        state.visibleCount = PAGE_SIZE;
        applyFiltersAndRender();
        return;
      }
      const example = e.target.closest('[data-example]');
      if (example) {
        const q = example.getAttribute('data-example') || '';
        state.query = q; state.searchInitiated=true; setMobileIdle(false);
        const input = $('searchInput'); if (input) { input.value = q; input.focus(); }
        await ensureDataLoaded(); state.visibleCount = PAGE_SIZE;
        applyFiltersAndRender();
        return;
      }
      const searchRecordBtn=e.target.closest('[data-action="search-record"]');
      if(searchRecordBtn){
        const rec=state.records.find(x=>x.id===searchRecordBtn.getAttribute('data-id'));
        if(rec){
          state.query=rec.shortTitle||rec.title; state.searchInitiated=true; setMobileIdle(false);
          if(RELATED_DATABASES.has(rec.database)){state.includeExternal=true; const ext=$('externalToggle'); if(ext) ext.checked=true;}
          const input=$('searchInput'); if(input) input.value=state.query; state.visibleCount=PAGE_SIZE; applyFiltersAndRender();
          $('resultsHeading')?.scrollIntoView({behavior:'smooth',block:'start'});
        }
        return;
      }
      const lowAction = e.target.closest('[data-low-action]');
      if (lowAction) {
        const action=lowAction.getAttribute('data-low-action');
        if (action==='clear-filters') clearAllFilters();
        if (action==='search-all') { state.database='all'; state.quickFilter='all'; state.journey='all'; const journey=$('journeySelect'); if(journey) journey.value='all'; syncQuickFilters(); $$('.tab').forEach(b=>b.classList.toggle('active',b.getAttribute('data-database')==='all')); state.visibleCount=PAGE_SIZE; applyFiltersAndRender(); }
        return;
      }
      const topicBar = e.target.closest('[data-insight-topic]');
      if (topicBar) {
        const topic = topicBar.getAttribute('data-insight-topic') || 'all';
        state.resultTopic = topic;
        const tf = $('resultTopicFilter'); if (tf) tf.value = topic;
        closeInsights(); state.visibleCount = PAGE_SIZE; applyFiltersAndRender();
        $('resultsHeading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const detailBtn = e.target.closest('[data-action="details"]');
      if (detailBtn) {
        const id = detailBtn.getAttribute('data-id');
        state.expandedId = state.expandedId === id ? null : id;
        renderResults();
        return;
      }
      const minimiseBtn = e.target.closest('[data-action="minimise"]');
      if (minimiseBtn) { state.expandedId = null; renderResults(); return; }
      const addBtn = e.target.closest('[data-action="toggle-basket"]');
      if (addBtn) { toggleBasket(addBtn.getAttribute('data-id')); return; }
      const removeBtn = e.target.closest('[data-action="remove-basket"]');
      if (removeBtn) { removeFromBasket(removeBtn.getAttribute('data-id')); return; }
    });
  }

  function bindHiddenAdminUnlock(){
    const versionEl = $('appVersion');
    const adminPanel = $('adminPanel');
    if (!versionEl || !adminPanel) return;
    let taps = 0;
    let firstTapAt = 0;
    const neededTaps = 7;
    const windowMs = 8000;

    function unlockAdmin(){
      adminPanel.classList.remove('hidden');
      adminPanel.setAttribute('data-unlocked', 'true');
      renderDiagnostics();
      debug('Hidden diagnostics panel unlocked');
    }

    function countTap(){
      if (adminPanel.getAttribute('data-unlocked') === 'true') return;
      const now = Date.now();
      if (!firstTapAt || now - firstTapAt > windowMs) {
        firstTapAt = now;
        taps = 0;
      }
      taps += 1;
      if (taps >= neededTaps) unlockAdmin();
    }

    versionEl.addEventListener('click', countTap);
    versionEl.addEventListener('dblclick', countTap);
    versionEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        countTap();
      }
    });
  }

  async function loadAllData(){
    showNotice('Loading databases…', '');
    const entries = Object.keys(DATASETS);
    const results = await Promise.allSettled(entries.map(key => loadFirstJson(DATASETS[key], key)));
    results.forEach((result, i) => { if (result.status === 'fulfilled') state.raw[entries[i]] = result.value; });
    const loadedCount = entries.reduce((sum,key)=>sum + (state.raw[key]?.length || 0), 0);
    const failed = entries.filter((key,i)=>results[i].status==='rejected');
    if (!loadedCount) {
      showNotice('No databases loaded. Check that the canonical data/*.json files were uploaded to GitHub Pages.', 'error');
    } else if (failed.length) {
      showNotice(`Partial load: ${loadedCount} records loaded. Missing: ${failed.join(', ')}. Search still works for loaded records.`, 'error');
    } else {
      showNotice(`${loadedCount} records loaded.`, 'success');
      setTimeout(() => hide('loadNotice'), 1200);
    }
    debug('Data load results', { counts: Object.fromEntries(entries.map(key=>[key,state.raw[key]?.length||0])), paths: state.loadedPaths });
  }

  async function loadFirstJson(paths, label){
    const errors = [];
    for (const path of paths) {
      try {
        const url = `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(APP_VERSION)}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('JSON is not an array');
        state.loadedPaths[label] = path;
        return data;
      } catch (err) {
        errors.push(`${path}: ${err.message}`);
      }
    }
    debug(`Failed to load ${label}`, { errors });
    throw new Error(errors.join(' | '));
  }

  function normaliseAllRecords(){
    const orderedSets = ['documents','judgments','press_releases','external_references','parliamentary_evidence','gazette_records','statistical_context','regional_references','international_references','videos'];
    state.records = orderedSets.flatMap(db => (state.raw[db] || []).map((r,i)=>normaliseRecord(r,db,i))).filter(Boolean);
    // stable order: most recent press first, then documents by title if no date
    state.records.sort((a,b) => {
      const da = a.sortDate || '0000-00-00';
      const db = b.sortDate || '0000-00-00';
      if (da !== db) return db.localeCompare(da);
      return a.shortTitle.localeCompare(b.shortTitle);
    });
    // Refresh saved selections against the current knowledge base so browser-local
    // selections never retain stale metadata after a data update.
    const previous = state.basket || [];
    const selectedIds = new Set(previous.map(r => r.id));
    const refreshed = state.records.filter(r => selectedIds.has(r.id));
    const canonicalIds = new Set(state.records.map(r=>r.id));
    const externalSaved = previous.filter(r=>!canonicalIds.has(r.id));
    state.basket = [...refreshed, ...externalSaved];
    saveBasket();
    updateMetrics();
  }

  function normaliseRecord(r, database, index){
    try {
      const title = clean(r.title || r.formal_title || r.name || `Untitled record ${index+1}`);
      const shortTitle = clean(r.short_title || makeShortTitle(title));
      const id = clean(r.id || `${database}-${index+1}`);
      const category = clean(r.record_type_simplified || r.record_category || r.record_type || r.type || (database === 'press_releases' ? 'News & Events' : (database === 'judgments' ? 'Judgment' : 'Document')));
      const area = clean(r.knowledge_area || r.programme_area || r.theme || 'Environmental Governance, Law & Policy');
      const status = clean(r.source_status || r.status || 'Needs Verification');
      const rawYearText = clean(r.year || '');
      const rawDate = clean(r.date_published || r.date || '');
      const yearTags = extractYearTags([rawYearText, rawDate, title, shortTitle].join(' '));
      const year = clean(rawYearText || (rawDate ? String(rawDate).slice(0,4) : (yearTags[0] || '')));
      const date = clean(rawDate || year || '');
      const url = safeHref(r.direct_url || r.source_url || r.url || '');
      const sourcePage = safeHref(r.source_page_url || r.source_page || '');
      const accessRoute = clean(r.access_route || (url ? 'Public link' : 'EMA Information Centre'));
      const keywords = uniq([...array(r.keywords), ...array(r.keyword_common_group), ...array(r.keyword_unique), ...array(r.keyword_discretionary)].map(clean)).slice(0, 30);
      const hasRequest = Boolean(r.has_request_pathway) || /held by ema|request/i.test(status + ' ' + accessRoute + ' ' + r.source_type);
      const hasUrl = Boolean(url);
      const hasPublicLink = Boolean(url || sourcePage);
      const dbLabels = {documents:'Document Access Register',press_releases:'News & Events',judgments:'Judgments & Proceedings',external_references:'Government Policies & Strategies',parliamentary_evidence:'Parliamentary Evidence',gazette_records:'Government Gazette & Legal Notices',statistical_context:'Research & Statistical Context',regional_references:'Regional Environmental Sources',international_references:'International — Trinidad & Tobago only',videos:'Environmental Video'};
      const dbLabel = dbLabels[database] || clean(r.source_family || database);
      const sortYear = yearTags[0] || extractYearTags(year)[0] || '';
      const sortDate = rawDate ? clean(rawDate) : (sortYear ? `${sortYear}-01-01` : '');
      const norm = {
        id, database, dbLabel, index,
        shortTitle, title, category, area, status, year, yearTags, date, url, sourcePage, accessRoute,
        sourceType: clean(r.source_type || ''),
        sourceLabel: clean(r.source_label || ''),
        reliability: clean(r.source_reliability || r.verification_status || ''),
        issuer: clean(r.issuer || r.custodian_or_owner || ''),
        sourceAgency: clean(r.source_agency || r.issuer || r.custodian_or_owner || ''),
        hostAgency: clean(r.host_agency || ''),
        sourceFamily: clean(r.source_family || ''),
        sourceLevel: clean(r.source_level || ''),
        repositoryBody: clean(r.repository_or_body || ''),
        contributor: clean(r.contributor || ''),
        country: clean(r.country || ''),
        countryScope: clean(r.country_scope || ''),
        mediaType: clean(r.media_type || ''),
        alternateSources: array(r.alternate_official_sources || r.alternate_authoritative_sources),
        relationship: clean(r.environmental_relationship || r.relationship_to_ema || ''),
        authorityNote: clean(r.authority_note || ''),
        availabilityNote: clean(r.availability_note || r.notes || ''),
        description: clean(r.description || r.summary_snippet || ''),
        descriptionBasis: clean(r.description_basis || ''),
        descriptionSource: safeHref(r.description_source_url || ''),
        court: clean(r.court || ''),
        caseNumber: clean(r.case_number || ''),
        citation: clean(r.citation || ''),
        caseStatus: clean(r.case_status || ''),
        notes: clean(r.notes || r.summary_snippet || ''),
        kmValue: clean(r.km_value || ''),
        priority: clean(r.priority || ''),
        actionNeeded: clean(r.action_needed || suggestedAction(status, hasUrl, hasRequest, database)),
        keywords, hasRequest, hasUrl, hasPublicLink, sourcePage, publicUrl: url || sourcePage, sortDate,
        raw: r
      };
      norm.accessStatus = deriveAccessStatus({url:norm.url,sourcePage:norm.sourcePage,status:norm.status,accessRoute:norm.accessRoute,availabilityNote:norm.availabilityNote,hasRequest:norm.hasRequest});
      norm.searchText = lower([norm.shortTitle, norm.title, norm.category, norm.area, norm.status, norm.year, ...yearTags, norm.date, norm.dbLabel, norm.accessRoute, norm.description, norm.notes, norm.issuer, norm.sourceAgency, norm.hostAgency, norm.relationship, norm.authorityNote, norm.court, norm.caseNumber, norm.citation, norm.caseStatus, norm.sourceFamily, norm.repositoryBody, norm.contributor, norm.country, ...norm.alternateSources.map(x=>clean(x?.label || x?.repository || x?.url || x)), ...keywords].join(' '));
      norm.statusClass = statusClass(norm);
      return norm;
    } catch (err) {
      debug('Record normalisation failed', { database, index, error: err.message });
      return {
        id: `${database}-invalid-${index}`, database, dbLabel: database, index,
        shortTitle: `Record ${index+1}`, title: 'Malformed record', category: 'Needs Verification', area: 'Unknown', status: 'Needs Verification', year: '', yearTags: [], date: '', url: '', sourcePage: '', accessRoute: '', keywords: [], hasRequest: false, hasUrl: false, hasPublicLink: false, publicUrl:'', accessStatus:'link_review', searchText: '', statusClass: 'verify', notes: 'This record could not be fully read.', raw: r
      };
    }
  }

  function makeShortTitle(title){
    let t = title.replace(/^MEDIA RELEASE\s*[–-]\s*/i,'').replace(/^Media Release\s*[–-]\s*/i,'').replace(/^JOINT AGENCY MEDIA RELEASE\s*[–-]\s*/i,'');
    t = t.replace(/^The Environmental Management Authority\s*\(EMA\)\s*/i,'EMA ');
    return t.length > 68 ? t.slice(0,65).trim() + '…' : t;
  }

  function deriveAccessStatus({url,sourcePage,status,accessRoute,availabilityNote,hasRequest}){
    const text=lower([status,accessRoute,availabilityNote].join(' '));
    const publicLink=Boolean(url||sourcePage);
    if(/broken link|dead link|link under review|link review|url needs|needs link verification/.test(text)) return 'link_review';
    if(publicLink) return 'open_online';
    if(hasRequest) return 'request_ema';
    if(/needs verification|unverified|review source|verify access/.test(text)) return 'link_review';
    return 'reference_only';
  }

  function accessLabel(r){
    return {open_online:'Open online',request_ema:'Request from EMA',reference_only:'Reference only',link_review:'Link under review'}[r.accessStatus] || 'Access not confirmed';
  }

  function suggestedAction(status, hasUrl, hasRequest, database){
    if (hasUrl) return database === 'videos' ? 'Watch video' : (database === 'press_releases' ? 'Open EMA News & Events post' : 'Open published source');
    if (hasRequest) return 'Use the EMA Information Centre request pathway';
    return 'Review the source record and confirm the access pathway';
  }

  function statusClass(r){
    if(r.accessStatus==='open_online') return 'public';
    if(r.accessStatus==='request_ema') return 'request';
    if(r.accessStatus==='reference_only') return 'reference';
    return 'verify';
  }

  function updateMetrics(){
    safeText('metricTotal', state.records.length);
    safeText('metricDocuments', state.records.filter(r=>r.database==='documents').length);
    safeText('metricJudgments', state.records.filter(r=>r.database==='judgments').length);
    safeText('metricPress', state.records.filter(r=>r.database==='press_releases').length);
    safeText('metricExternal', state.records.filter(r=>RELATED_DATABASES.has(r.database)).length);
  }

  function populateFilters(){
    setOptions('areaFilter', state.records.map(r=>r.area));
    setOptions('typeFilter', state.records.map(r=>r.category));
    setOptions('statusFilter', state.records.map(r=>r.status));
    const years = state.records.flatMap(r => r.yearTags && r.yearTags.length ? r.yearTags : extractYearTags(r.year));
    setOptions('yearFilter', years, 'numeric-desc');
    setOptions('resultYearFilter', years, 'numeric-desc');
    setOptions('resultTopicFilter', state.records.map(generalTopic));
  }
  function setOptions(id, values, sortMode){
    const el = $(id); if (!el) return;
    const first = el.querySelector('option')?.outerHTML || '<option value="all">All</option>';
    const vals = uniq(values.map(clean));
    if (sortMode === 'numeric-desc') vals.sort((a,b)=>Number(b)-Number(a) || String(b).localeCompare(String(a)));
    else vals.sort((a,b)=>a.localeCompare(b));
    el.innerHTML = first + vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }

  function syncQuickFilters(){
    $$('.filter').forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === state.quickFilter));
  }

  function sourceGroup(r){
    if (r.database === 'external_references') return 'government';
    if (r.database === 'parliamentary_evidence') return 'parliament';
    if (r.database === 'gazette_records') return 'gazette';
    if (r.database === 'statistical_context') return 'statistical';
    if (r.database === 'regional_references') return 'regional';
    if (r.database === 'international_references') return 'international';
    if (r.database === 'videos') return 'video';
    if (r.database === 'judgments') return 'court';
    return 'ema';
  }

  function sourceGroupLabel(r){
    const labels={ema:'EMA',parliament:'Parliament',gazette:'Government Gazette',government:'Government policy / agency',court:'Courts / tribunals',statistical:'Research & statistics',regional:'Regional sources',international:'International · T&T only',video:'Video'};
    return labels[sourceGroup(r)] || 'Source';
  }

  function generalTopic(r){
    const controlled = ['Air & Atmosphere','Water & Watersheds','Waste, Chemicals & Circular Economy','Biodiversity, Ecosystems & Protected Areas','Coastal & Marine','Climate Change & Resilience','Energy & Low-Carbon Transition','Industry, Extractives & Quarrying','Land, Development & CEC','Noise & Community Impacts','Environmental Governance, Law & Policy','Education, Participation & Partnerships','Corporate & Institutional Management'];
    if (controlled.includes(r.area)) return r.area;
    const text = lower([r.area, r.category, r.title, ...(r.keywords || [])].join(' '));
    if (/\bair\b|air quality|emission|pm10|pm2|particulate|sulphur|sulfur|nitrogen dioxide|ozone/.test(text)) return 'Air & emissions';
    if (/water quality|water pollution|watershed|groundwater|river|freshwater|wastewater|sewage|effluent|aquatic/.test(text)) return 'Water & watersheds';
    if (/pesticide|chemical|persistent organic|\bpops\b|stockholm convention|hazardous substance|toxic|chemical spill/.test(text)) return 'Chemicals & hazardous substances';
    if (/waste|recycl|landfill|solid waste|hazardous material|beverage container/.test(text)) return 'Waste & materials';
    if (/biodiversity|forest|wildlife|protected area|ecosystem|species|habitat|wetland|mangrove|esa\b|environmentally sensitive/.test(text)) return 'Biodiversity & ecosystems';
    if (/climate|carbon|greenhouse|ghg|renewable|energy efficiency|net zero|decarbon/.test(text)) return 'Climate & energy';
    if (/coastal|marine|ocean|oil spill|fisher|coral|seagrass|iczm/.test(text)) return 'Coastal & marine';
    if (/quarry|mineral|mining|land use|soil|land degradation|spatial development|planning/.test(text)) return 'Land, planning & minerals';
    if (/noise/.test(text)) return 'Noise';
    if (/cec\b|certificate of environmental clearance|eia\b|environmental impact assessment|permit/.test(text)) return 'CEC / EIA & permitting';
    if (/enforcement|compliance|legal|legislation|judgment|court|act\b|rule|regulation|foia|governance/.test(text)) return 'Law, compliance & governance';
    if (/education|outreach|literacy|public awareness|media release|news|community|sensiti/.test(text)) return 'Public education & engagement';
    if (/knowledge|research|annual report|corporate|human resource|procurement|quality|internal|information management|data/.test(text)) return 'Knowledge & organisational';
    return 'Cross-cutting / other';
  }

  function recordYear(r){ return Number((r.yearTags && r.yearTags[0]) || extractYearTags(r.year)[0] || 0); }

  function clearResultFilters(){
    state.resultSource='all'; state.resultAccess='all'; state.resultYear='all'; state.resultTopic='all'; state.sortMode='relevance';
    [['resultSourceFilter','all'],['resultAccessFilter','all'],['resultYearFilter','all'],['resultTopicFilter','all'],['sortResults','relevance']].forEach(([id,v])=>{ const el=$(id); if(el) el.value=v; });
    state.visibleCount=PAGE_SIZE; applyFiltersAndRender();
  }

  function sortRecords(records, q){
    const copy=records.slice();
    if (state.sortMode === 'ema-first') return copy.sort((a,b)=>(sourceGroup(a)==='ema'?0:1)-(sourceGroup(b)==='ema'?0:1) || (q ? scoreRecord(b,q)-scoreRecord(a,q) : lower(a.title).localeCompare(lower(b.title))));
    if (state.sortMode === 'newest') return copy.sort((a,b)=>recordYear(b)-recordYear(a) || lower(a.title).localeCompare(lower(b.title)));
    if (state.sortMode === 'oldest') return copy.sort((a,b)=>(recordYear(a)||9999)-(recordYear(b)||9999) || lower(a.title).localeCompare(lower(b.title)));
    if (state.sortMode === 'title') return copy.sort((a,b)=>lower(a.title).localeCompare(lower(b.title)));
    return copy;
  }

  function syncUrlState(){
    try{
      const p=new URLSearchParams();
      if(clean(state.query)) p.set('search',clean(state.query));
      if(state.includeExternal) p.set('related','1');
      if(state.area!=='all') p.set('area',state.area);
      if(state.type!=='all') p.set('type',state.type);
      if(state.resultSource!=='all') p.set('source',state.resultSource);
      if(state.resultAccess!=='all') p.set('access',state.resultAccess);
      const u=p.toString()?`${location.pathname}?${p}`:location.pathname;
      history.replaceState(null,'',u);
    }catch{}
  }

  function applyFiltersAndRender(){
    let records = state.records.slice();
    const q = lower(state.query);
    state.queryPlan = q ? buildQueryPlan(q) : null;
    if (!state.includeExternal) records = records.filter(r => !RELATED_DATABASES.has(r.database));
    if (state.database !== 'all') records = records.filter(r => r.database === state.database);
    if (state.quickFilter !== 'all') records = records.filter(r => quickMatch(r, state.quickFilter));
    if (state.area !== 'all') records = records.filter(r => r.area === state.area);
    if (state.type !== 'all') records = records.filter(r => r.category === state.type);
    if (state.status !== 'all') records = records.filter(r => r.status === state.status);
    if (state.year !== 'all') records = records.filter(r => (r.yearTags || []).includes(state.year) || r.year === state.year || String(r.date || '').startsWith(state.year));
    if (q) records = records.map(r => ({ record: r, score: scoreRecord(r, state.queryPlan) })).filter(x => x.score > 0).sort((a,b)=>b.score-a.score).map(x=>x.record);
    if (state.resultSource !== 'all') records = records.filter(r => sourceGroup(r) === state.resultSource);
    if (state.resultAccess !== 'all') records = records.filter(r => r.accessStatus === state.resultAccess);
    if (state.resultYear !== 'all') records = records.filter(r => (r.yearTags || []).includes(state.resultYear) || r.year === state.resultYear || String(r.date || '').startsWith(state.resultYear));
    if (state.resultTopic !== 'all') records = records.filter(r => generalTopic(r) === state.resultTopic);
    records = sortRecords(records, q);
    state.filtered = records;
    syncUrlState();
    renderResults();
  }

  function quickMatch(r, filter){
    const hay = r.searchText;
    switch(filter){
      case 'public': return r.accessStatus==='open_online';
      case 'request': return r.accessStatus==='request_ema';
      case 'forms': return /form|guide|application|instruction|booklet|checklist|permit/.test(hay);
      case 'law': return r.database === 'judgments' || /law|legal|rule|regulation|act|notice|order|legislation|judgment|appeal|court/.test(hay);
      case 'reports': return /report|study|survey|assessment|monitoring|technical|inventory|audit|valuation/.test(hay);
      case 'datasets': return r.category==='Dataset / Data Table / Register' || /dataset|data table|time series|public register|statistics/.test(hay);
      case 'internal': return /internal|policy|manual|procedure|sop|governance|procurement|human resource|hse|quality/.test(hay) || /internal/i.test(r.sourceType);
      case 'press': return r.database === 'press_releases' || /press release|media release|news & events|public communication/.test(hay);
      case 'video': return r.database === 'videos' || r.mediaType === 'video';
      case 'judgments': return r.database === 'judgments';
      case 'priority': return /high|priority|request/.test(lower(r.priority + ' ' + r.actionNeeded));
      default: return true;
    }
  }

  function termPresent(text, term){
    const hay=lower(text), t=lower(term); if(!t) return false;
    if(/^[a-z0-9]{1,3}$/.test(t)) return new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z0-9]|$)`,'i').test(hay);
    return hay.includes(t);
  }

  function buildQueryPlan(q){
    const input=lower(q); const phrases=[...input.matchAll(/\"([^\"]+)\"/g)].map(m=>m[1]).filter(Boolean); const raw=input.replace(/\"/g,'').trim(); const userTokens=raw.split(/\s+/).filter(Boolean);
    const aliases=new Set(), related=new Set(), concepts=[];
    for(const item of state.searchTerms||[]){
      const canonical=lower(item.canonical); const terms=[canonical,...array(item.aliases).map(lower)].filter(Boolean);
      const matched=terms.some(t=>termPresent(raw,t));
      if(!matched) continue;
      concepts.push(clean(item.concept||item.canonical));
      terms.forEach(t=>{if(t && !termPresent(raw,t)) aliases.add(t);});
      array(item.related).map(lower).filter(Boolean).forEach(t=>related.add(t));
    }
    return {raw,userTokens,phrases,aliases:[...aliases].slice(0,12),related:[...related].slice(0,12),concepts:uniq(concepts)};
  }

  function fieldScore(r, term, weights){
    let score=0;
    if(termPresent(r.shortTitle,term)) score+=weights.short;
    if(termPresent(r.title,term)) score+=weights.title;
    if(termPresent(r.keywords.join(' '),term)) score+=weights.keywords;
    if(termPresent(r.area,term)) score+=weights.area;
    if(termPresent(r.category,term)) score+=weights.category;
    if(termPresent(r.description,term)) score+=weights.description;
    if(termPresent(r.searchText,term)) score+=weights.text;
    return score;
  }

  function scoreRecord(r, planOrQuery){
    const plan=typeof planOrQuery==='string'?buildQueryPlan(planOrQuery):planOrQuery;
    if(!plan||!plan.raw) return 0;
    let score=0;
    if(plan.phrases && plan.phrases.length && !plan.phrases.every(p=>termPresent(r.searchText,p))) return 0;
    if(termPresent(r.shortTitle,plan.raw)||termPresent(r.title,plan.raw)) score+=120;
    if(termPresent(r.searchText,plan.raw)) score+=45;
    for(const t of plan.userTokens) score+=fieldScore(r,t,{short:45,title:34,keywords:24,area:17,category:15,description:8,text:5});
    for(const t of plan.aliases) score+=fieldScore(r,t,{short:26,title:22,keywords:16,area:10,category:8,description:5,text:3});
    for(const t of plan.related) score+=fieldScore(r,t,{short:8,title:7,keywords:6,area:5,category:4,description:2,text:1});
    return score;
  }

  function renderResults(){
    const body = $('resultsBody');
    if(state.mobileMode && !state.searchInitiated){ if(body) body.innerHTML=''; return; }
    if (!body) { debug('Missing resultsBody element'); return; }
    const total = state.filtered.length;
    const activeTools=$('activeResultsTools'); if(activeTools) activeTools.classList.toggle('hidden', !hasActiveFilters());
    safeText('resultCount', `${total} result${total===1?'':'s'}${state.query ? ` for “${state.query}”` : ''}`);
    renderSearchExpansionNote();
    renderResultBreakdown();
    updateRecordSuggestionLink();
    const visible = state.filtered.slice(0, state.visibleCount);
    if (!visible.length) {
      body.innerHTML = '<tr><td colspan="6">No records found. Try another keyword or clear filters.</td></tr>';
      const lm = $('loadMoreBtn'); if (lm) lm.classList.add('hidden');
      renderLowResultAssist(total);
      return;
    }
    const rows = [];
    for (const r of visible) {
      try {
        rows.push(renderRow(r));
        if (state.expandedId === r.id) rows.push(renderDetailRow(r));
      } catch (err) {
        debug('Render row failed', { id: r.id, error: err.message });
        rows.push(renderFallbackRow(r));
      }
    }
    body.innerHTML = rows.join('');
    const lm = $('loadMoreBtn'); if (lm) lm.classList.toggle('hidden', state.visibleCount >= total);
    renderLowResultAssist(total);
  }

  function renderSearchExpansionNote(){
    const el=$('searchExpansionNote'); if(!el) return;
    const plan=state.queryPlan;
    if(!plan || (!plan.aliases.length && !plan.related.length)){el.classList.add('hidden'); el.textContent=''; return;}
    const aliasText=plan.aliases.slice(0,5).join(', '); const relatedText=plan.related.slice(0,4).join(', ');
    const pieces=[];
    if(aliasText) pieces.push(`Also searched equivalent/common terms: ${aliasText}`);
    if(relatedText) pieces.push(`Related terms are ranked lower: ${relatedText}`);
    el.textContent=pieces.join('. ')+'.'; el.classList.remove('hidden');
  }

  function renderRow(r){
    const primaryAction = r.publicUrl ? `<a class="primary" href="${esc(r.publicUrl)}" target="_blank" rel="noopener">${r.database==='videos'?'Watch video':'Open source'}</a>` : (r.accessStatus==='request_ema' ? `<a class="primary" href="${EMA_REQUEST_URL}" target="_blank" rel="noopener">Request from EMA</a>` : '');
    const formal = r.title && r.title !== r.shortTitle ? `<small>${esc(r.title)}</small>` : '';
    const isSelected = state.basket.some(item => item.id === r.id);
    const legalMeta = r.database === 'judgments' ? [r.court, r.citation || r.caseNumber, r.caseStatus].filter(Boolean).join(' · ') : '';
    const context = legalMeta || r.description || r.dbLabel;
    const attribution = r.sourceAgency ? ` · ${esc(r.sourceAgency)}` : (r.issuer ? ` · ${esc(r.issuer)}` : '');
    const hosted = r.hostAgency && lower(r.hostAgency)!==lower(r.sourceAgency) ? ` · Hosted by ${esc(r.hostAgency)}` : '';
    const sourceContext = sourceGroup(r)!=='ema' ? `<small class="source-context">${esc(sourceGroupLabel(r))}${attribution}${hosted}${r.repositoryBody ? ` · ${esc(r.repositoryBody)}` : ''}</small>` : '';
    return `<tr class="result-row row-${r.statusClass}${isSelected?' is-selected':''}" data-id="${esc(r.id)}">
      <td data-label="Access"><span class="status-pill status-${r.statusClass}">${esc(statusLabel(r))}</span></td>
      <td data-label="Record" class="title-cell"><strong>${esc(r.shortTitle)}</strong>${formal}<span class="meta-sm">${esc(context)}</span>${sourceContext}</td>
      <td data-label="Area">${esc(r.area || '—')}</td>
      <td data-label="Type">${esc(r.category || '—')}</td>
      <td data-label="Year / Date">${esc(r.date || r.year || '—')}</td>
      <td data-label="Action"><div class="result-action-cell"><div class="action-stack">${primaryAction}<button class="ghost" type="button" data-action="details" data-id="${esc(r.id)}">${state.expandedId===r.id?'Show less':'View record'}</button><button class="ghost select-toggle${isSelected?' selected':''}" type="button" aria-pressed="${isSelected?'true':'false'}" data-action="toggle-basket" data-id="${esc(r.id)}">${isSelected?'✓ Added to List':'+ Add to List'}</button></div>${r.publicUrl?`<a class="result-secondary-link" href="${esc(brokenLinkMailto(r))}">Report broken link</a>`:''}</div></td>
    </tr>`;
  }

  function renderFallbackRow(r){
    return `<tr class="result-row"><td colspan="6"><strong>${esc(r.shortTitle || r.title || 'Record')}</strong><br><span class="meta-sm">This record could not be fully rendered. Try exporting current results or checking the JSON.</span></td></tr>`;
  }

  function relatedFor(r){
    const curated=[]; const seen=new Set([r.id]);
    for(const edge of state.relationships||[]){
      let other=''; if(edge.from===r.id) other=edge.to; else if(edge.to===r.id) other=edge.from; else continue;
      if(seen.has(other)) continue; const rec=state.records.find(x=>x.id===other); if(!rec) continue; if(!state.includeExternal && RELATED_DATABASES.has(rec.database)) continue;
      seen.add(other); curated.push({record:rec,label:clean(edge.label||'Related record'),note:clean(edge.note||''),curated:true});
    }
    const generated=[];
    for(const item of (state.relatedIndex?.[r.id]||[])){
      if(seen.has(item.id)) continue; const rec=state.records.find(x=>x.id===item.id); if(!rec) continue; if(!state.includeExternal && RELATED_DATABASES.has(rec.database)) continue;
      seen.add(item.id); generated.push({record:rec,label:'More on this topic',note:array(item.reasons).join(' · '),curated:false});
      if(generated.length>=6) break;
    }
    return [...curated.slice(0,6),...generated.slice(0,Math.max(0,6-curated.slice(0,6).length))];
  }

  function renderRelatedInformation(r){
    const rows=relatedFor(r); if(!rows.length) return '';
    return `<div class="info-box related-info-box"><h4>Related information</h4><p class="source-note">Connections are discovery aids based on curated indexing or shared topics. They do not state legal applicability, legal hierarchy, policy effect or EMA endorsement.</p><div class="related-records">${rows.map(item=>{const x=item.record;const open=x.publicUrl?`<a href="${esc(x.publicUrl)}" target="_blank" rel="noopener">Open source</a>`:(x.accessStatus==='request_ema'?`<a href="${EMA_REQUEST_URL}" target="_blank" rel="noopener">Request from EMA</a>`:'');const selected=state.basket.some(b=>b.id===x.id);return `<article class="related-record"><span class="relationship-label">${esc(item.label)}</span><strong>${esc(x.shortTitle)}</strong><small>${esc(sourceGroupLabel(x))}${x.year?` · ${esc(x.year)}`:''} · ${esc(accessLabel(x))}</small>${item.note?`<p>${esc(item.note)}</p>`:''}<div class="related-actions">${open}<button type="button" class="text-link" data-action="search-record" data-id="${esc(x.id)}">Find in search</button><button type="button" class="text-link" data-action="toggle-basket" data-id="${esc(x.id)}">${selected?'Remove from List':'+ Add to List'}</button></div></article>`}).join('')}</div></div>`;
  }

  function renderDetailRow(r){
    const sourceLink = r.publicUrl ? `<p><a href="${esc(r.publicUrl)}" target="_blank" rel="noopener">Open source</a></p>` : '';
    const sourcePage = r.sourcePage && r.sourcePage !== r.publicUrl ? `<p><a href="${esc(r.sourcePage)}" target="_blank" rel="noopener">Open source/index page</a></p>` : '';
    const description = r.description || `${r.category || 'Record'} indexed under ${r.area || 'Cross-cutting'}.`;
    const externalDetails = sourceGroup(r)!=='ema' && r.database!=='judgments' ? `<div class="info-box authority-box"><h4>Source context & environmental relevance</h4><p><strong>Source family:</strong> ${esc(sourceGroupLabel(r))}<br>${r.sourceAgency?`<strong>Source agency:</strong> ${esc(r.sourceAgency)}<br>`:(r.issuer?`<strong>Issuer:</strong> ${esc(r.issuer)}<br>`:'')}${r.hostAgency&&lower(r.hostAgency)!==lower(r.sourceAgency)?`<strong>Hosted by:</strong> ${esc(r.hostAgency)}<br>`:''}${r.repositoryBody?`<strong>Repository/body:</strong> ${esc(r.repositoryBody)}<br>`:''}${r.contributor?`<strong>Contributor:</strong> ${esc(r.contributor)}<br>`:''}${r.relationship?`<strong>Indexed relevance:</strong> ${esc(r.relationship)}<br>`:''}${r.authorityNote?`<strong>Source note:</strong> ${esc(r.authorityNote)}`:''}</p></div>` : '';
    const legalDetails = r.database === 'judgments' ? `<div class="info-box"><h4>Proceeding metadata</h4><p>${r.court?`<strong>Court/body:</strong> ${esc(r.court)}<br>`:''}${r.caseNumber?`<strong>Case no.:</strong> ${esc(r.caseNumber)}<br>`:''}${r.citation?`<strong>Citation:</strong> ${esc(r.citation)}<br>`:''}${r.caseStatus?`<strong>Recorded status:</strong> ${esc(r.caseStatus)}`:''}</p><p class="source-note">This tool indexes proceeding metadata for discovery. It does not interpret the decision, legal effect or current applicability.</p></div>` : '';
    return `<tr class="detail-row"><td colspan="6">
      <div class="index-card ${r.statusClass}">
        <div class="index-card-head">
          <div><h3>${esc(r.shortTitle)}</h3><p class="meta-sm">${esc(r.title)}</p></div>
          <button class="ghost" type="button" data-action="minimise">Close details</button>
        </div>
        <div class="legal-safety-note"><strong>Use note</strong><span>Descriptions, indexed relationships and search suggestions are provided to help locate information. They are not legal advice, legal interpretation, an EMA determination, or a substitute for the original published source and applicable EMA process.</span></div>
        <div class="index-grid">
          <div class="info-box context-box"><h4>About this record</h4><p>${esc(description)}</p>${r.descriptionSource?`<p class="source-note">Context source: <a href="${esc(r.descriptionSource)}" target="_blank" rel="noopener">open source</a></p>`:''}</div>
          ${legalDetails}${externalDetails}
          <div class="info-box"><h4>Source and access</h4><p><strong>${esc(accessLabel(r))}</strong><br>${esc(r.accessRoute || r.sourceLabel || '')}</p>${sourceLink}${sourcePage}${r.publicUrl?`<p class="source-note"><a href="${esc(brokenLinkMailto(r))}">Report a broken link</a></p>`:''}</div>
        </div>
        <div class="index-grid secondary-grid">
          <div class="info-box"><h4>Record details</h4><p><strong>ID:</strong> ${esc(r.id)}<br><strong>Record set:</strong> ${esc(r.dbLabel)}<br><strong>Type:</strong> ${esc(r.category)}<br><strong>Date:</strong> ${esc(r.date || r.year || '—')}<br><strong>Recorded source status:</strong> ${esc(r.status)}</p></div>
          <div class="info-box"><h4>Source note</h4><p>${esc(r.availabilityNote || 'Check the linked or referenced source before relying on this record.')}</p></div>
          <div class="info-box"><h4>Keywords</h4><div class="keyword-list">${r.keywords.slice(0,20).map(k=>`<span class="keyword">${esc(k)}</span>`).join('') || '<span class="meta-sm">No keywords captured.</span>'}</div></div>
        </div>
        ${renderRelatedInformation(r)}
      </div>
    </td></tr>`;
  }

  function statusLabel(r){
    return accessLabel(r);
  }

  function hasActiveFilters(){
    return Boolean(state.query || state.database !== 'all' || state.quickFilter !== 'all' || state.area !== 'all' || state.type !== 'all' || state.status !== 'all' || state.year !== 'all' || state.resultSource !== 'all' || state.resultAccess !== 'all' || state.resultYear !== 'all' || state.resultTopic !== 'all' || state.sortMode !== 'relevance');
  }

  function toggleRecordSuggestionPanel(){
    const panel=$('recordSuggestionPanel');
    const btn=$('recordSuggestionToggle');
    if (!panel || !btn) return;
    const opening=panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    btn.setAttribute('aria-expanded', String(opening));
    const mark=btn.querySelector('.disclosure-mark');
    if (mark) mark.textContent=opening?'▴':'▾';
  }

  function renderResultBreakdown(){
    const counts={documents:0,judgments:0,press_releases:0,related:0};
    for (const r of state.filtered) {
      if (Object.prototype.hasOwnProperty.call(counts,r.database)) counts[r.database]+=1; else if (RELATED_DATABASES.has(r.database)) counts.related+=1;
    }
    safeText('resultDocumentsCount', counts.documents);
    safeText('resultJudgmentsCount', counts.judgments);
    safeText('resultNewsCount', counts.press_releases);
    safeText('resultRelatedCount', counts.related);
  }

  function updateRecordSuggestionLink(){
    const link=$('recordSuggestionLink');
    if (link) link.href=kmuMailto();
  }

  function activeFilterSummary(){
    const parts=[];
    if (state.database !== 'all') parts.push(`Record set: ${state.database === 'press_releases' ? 'News & Events' : state.database === 'judgments' ? 'Judgments & Proceedings' : 'Documents'}`);
    if (state.quickFilter !== 'all') parts.push(`Quick filter: ${state.quickFilter}`);
    if (state.area !== 'all') parts.push(`Area: ${state.area}`);
    if (state.type !== 'all') parts.push(`Type: ${state.type}`);
    if (state.status !== 'all') parts.push(`Source status: ${state.status}`);
    if (state.year !== 'all') parts.push(`Year: ${state.year}`);
    if (state.resultSource !== 'all') parts.push(`Source: ${state.resultSource}`);
    if (state.resultAccess !== 'all') parts.push(`Access: ${state.resultAccess}`);
    if (state.resultYear !== 'all') parts.push(`Result year: ${state.resultYear}`);
    if (state.resultTopic !== 'all') parts.push(`Topic: ${state.resultTopic}`);
    return parts;
  }

  function kmuMailto(){
    const subject='EMA Document Search Tool – search assistance / possible missing record';
    const filters=activeFilterSummary();
    const body=[
      'I was searching the EMA Document Search Tool and would like assistance locating a record or suggesting a possible addition/correction.',
      '',
      `Search used: ${state.query || '(none)'}`,
      `Active filters: ${filters.length ? filters.join('; ') : '(none)'}`,
      '',
      'Record or subject I was looking for:',
      '',
      'Additional details:'
    ].join('\n');
    return `mailto:${KMU_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function brokenLinkMailto(r){
    const subject='EMA Document Search Tool – broken link report';
    const body=[
      'I found a link in the EMA Document Search Tool that may be broken or may no longer lead to the expected record.',
      '',
      `Record title: ${r.title || r.shortTitle || '(not available)'}`,
      `Record ID: ${r.id || '(not available)'}`,
      `Primary link: ${r.url || '(not available)'}`,
      `Source/index page: ${r.sourcePage || '(not available)'}`,
      '',
      'Issue noticed:',
      ''
    ].join('\n');
    return `mailto:${KMU_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function clearAllFilters(){
    state.database='all'; state.quickFilter='all'; state.journey='all'; state.area='all'; state.type='all'; state.status='all'; state.year='all'; state.visibleCount=PAGE_SIZE;
    $$('.tab').forEach(b=>b.classList.toggle('active',b.getAttribute('data-database')==='all'));
    syncQuickFilters();
    const journey=$('journeySelect'); if (journey) journey.value='all';
    ['areaFilter','typeFilter','statusFilter','yearFilter'].forEach(id=>{ const el=$(id); if(el) el.value='all'; });
    applyFiltersAndRender();
  }

  function renderLowResultAssist(total){
    const el=$('lowResultAssist'); if(!el) return;
    if (!hasActiveFilters() || total >= 5) { el.classList.add('hidden'); el.innerHTML=''; return; }
    const zero=total===0;
    const clearButton=activeFilterSummary().length ? '<button class="ghost" type="button" data-low-action="clear-filters">Clear filters</button>' : '';
    const allButton=state.database!=='all' ? '<button class="ghost" type="button" data-low-action="search-all">Search all record types</button>' : '';
    el.innerHTML=`<div><strong>${zero?'No records found':'Looking for something else?'}</strong><p>${zero?'Try checking the spelling, using fewer words, or removing filters.':`Only ${total} record${total===1?'':'s'} matched this search. You can broaden the search or contact the Knowledge Management Unit if you believe a relevant record may be missing.`}</p></div><div class="low-result-actions">${allButton}${clearButton}<a class="primary link-btn" href="${esc(kmuMailto())}">Contact Knowledge Management Unit</a></div>`;
    el.classList.remove('hidden');
  }

  function showNotice(text, mode){
    const el = $('loadNotice'); if (!el) return;
    el.textContent = text;
    el.className = 'notice';
    if (mode) el.classList.add(mode);
    el.classList.remove('hidden');
  }

  function loadBasket(){
    try { return JSON.parse(localStorage.getItem('emaRecordBasketV4') || '[]'); } catch { return []; }
  }
  function saveBasket(){ localStorage.setItem('emaRecordBasketV4', JSON.stringify(state.basket)); updateListUI(); window.dispatchEvent(new CustomEvent('ema-mylist-updated')); }
  function updateListUI(){
    const n=state.basket.length;
    safeText('basketCount', n);
    document.querySelectorAll('[data-mylist-count]').forEach(el=>el.textContent=String(n));
    const btn=$('openBasketBtn'); if(btn) btn.setAttribute('aria-label',`Open My List (${n} saved)`);
  }
  function collapseListDock(){}
  function expandListDock(){}
  function toggleBasket(id){
    const rec = state.records.find(r => r.id === id);
    if (!rec) return;
    const selected = state.basket.some(r => r.id === id);
    if (selected) state.basket = state.basket.filter(r => r.id !== id); else state.basket.push(rec);
    saveBasket(); renderBasket(); renderResults();
    showNotice(selected ? `Removed “${rec.shortTitle}” from My List.` : `Added “${rec.shortTitle}” to My List.`, 'success');
    setTimeout(()=>hide('loadNotice'), 1100);
  }
  function addToBasket(id){ if (!state.basket.some(r=>r.id===id)) toggleBasket(id); }
  function removeFromBasket(id){ state.basket = state.basket.filter(r => r.id !== id); saveBasket(); renderBasket(); renderResults(); }
  function ensureMiniList(){
    let panel=$('myListMiniPanel');
    if(panel) return panel;
    panel=document.createElement('aside'); panel.id='myListMiniPanel'; panel.className='list-mini-panel hidden'; panel.setAttribute('aria-label','My List'); document.body.appendChild(panel); return panel;
  }
  function openBasket(){ const p=ensureMiniList(); renderBasket(); p.classList.remove('hidden'); }
  function closeBasket(){ $('myListMiniPanel')?.classList.add('hidden'); }
  function renderBasket(){
    updateListUI(); const el=ensureMiniList();
    const items=state.basket.length ? state.basket.map(r=>`<div class="list-item"><strong>${esc(r.shortTitle||r.title)}</strong><small>${esc(r.sourceAgency||r.issuer||r.dbLabel||'')}${r.year?` · ${esc(r.year)}`:''}</small><div class="list-mini-actions">${r.publicUrl||r.url?`<a class="ghost link-btn" href="${esc(r.publicUrl||r.url)}" target="_blank" rel="noopener">Open</a>`:''}<button class="ghost" type="button" data-action="remove-basket" data-id="${esc(r.id)}">Remove</button></div></div>`).join('') : '<div class="empty-state">No records saved yet.</div>';
    el.innerHTML=`<div class="list-mini-head"><div><h2>My List</h2><p>Saved while you move between tools.</p></div><button class="ghost" type="button" id="closeBasketBtn">Close</button></div>${items}<div class="list-mini-actions"><button class="primary" type="button" id="copyRequestBtn">Copy list</button><button class="ghost" type="button" id="downloadCsvBtn">CSV</button><button class="ghost" type="button" id="downloadJsonBtn">JSON</button><a class="ghost link-btn" id="emailInformationBtn" href="#">Email</a><button class="ghost danger-lite" type="button" id="clearBasketBtn">Clear</button></div><label class="request-output-label" for="requestOutput">Reference / request text</label><textarea class="request-output" id="requestOutput" rows="7" readonly>${esc(buildRequestText())}</textarea>`;
    $('closeBasketBtn')?.addEventListener('click',closeBasket);
    $('clearBasketBtn')?.addEventListener('click',()=>{state.basket=[];saveBasket();renderBasket();renderResults();});
    $('copyRequestBtn')?.addEventListener('click',copyRequestText);
    $('downloadCsvBtn')?.addEventListener('click',()=>downloadCsv(state.basket,'ema-selected-records.csv'));
    $('downloadJsonBtn')?.addEventListener('click',()=>downloadJson(state.basket,'ema-selected-records.json'));
    updateInformationEmail();
  }
  function updateInformationEmail(){
    const link = $('emailInformationBtn'); if (!link) return;
    link.href = `mailto:information@ema.co.tt?subject=${encodeURIComponent('EMA Information Centre reference / document request')}&body=${encodeURIComponent(buildRequestText())}`;
  }

  function formatEmaReference(r){
    const year = r.year || (r.date ? String(r.date).slice(0,4) : '') || 'n.d.';
    if(r.database==='media_news' || r.database==='dataset_catalog'){const src=r.sourceAgency||'Source'; const u=r.publicUrl||r.url||''; return `${src}. (${year}). ${r.title}.${u?` Available at: ${u}`:''}`;}
    const type = r.category ? ` [${r.category}]` : '';
    const access = r.url || r.sourcePage;
    const group = sourceGroup(r);
    if (group === 'court') {
      const court = r.court || 'Judiciary / Environmental Commission of Trinidad and Tobago';
      const caseRef = r.caseNumber ? `, ${r.caseNumber}` : '';
      return `${r.title}. (${year}). ${court}${caseRef}.${access ? ` Available at: ${access}` : ''}`.replace(/\.\s*\./g,'.');
    }
    if (r.database === 'documents') {
      const route = access ? ` Available at: ${access}` : ` Access: ${r.accessRoute || 'EMA Information Centre'}.`;
      return `${r.title}. (${year}).${type} EMA Document Access Register. Record ID: ${r.id}.${route}`.replace(/\.\s*\./g,'.');
    }
    if (r.database === 'press_releases') {
      return `Environmental Management Authority (EMA). (${year}). ${r.title}.${type}${access ? ` Available at: ${access}` : ''}`.replace(/\.\s*\./g,'.');
    }
    const body = r.issuer || (group==='parliament' ? 'Parliament of the Republic of Trinidad and Tobago' : group==='gazette' ? 'Government Printery / Government of the Republic of Trinidad and Tobago' : group==='international' ? (r.repositoryBody || 'International repository') : group==='video' ? 'Environmental Management Authority' : group==='statistical' ? 'Official Trinidad and Tobago statistical source' : 'Government of the Republic of Trinidad and Tobago');
    const repository = r.repositoryBody && !lower(body).includes(lower(r.repositoryBody)) ? ` ${r.repositoryBody}.` : '';
    return `${body}. (${year}). ${r.title}.${type}${repository}${access ? ` Available at: ${access}` : ''}`.replace(/\.\s*\./g,'.');
  }

  function buildRequestText(){
    if (!state.basket.length) return 'Add records to My List to generate an EMA-style reference list.';
    const requestItems = state.basket.filter(r => r.accessStatus === 'request_ema');
    const lines = [];
    lines.push('EMA DOCUMENT SEARCH TOOL — MY LIST');
    lines.push('');
    lines.push('Selected references');
    state.basket.forEach((r,i)=>lines.push(`${i+1}. ${formatEmaReference(r)}`));
    if (requestItems.length) {
      lines.push('');
      lines.push('Information Centre assistance requested');
      lines.push('The following selected records are indexed with an EMA Information Centre request pathway. Please advise on availability or access:');
      requestItems.forEach((r,i)=>lines.push(`${i+1}. ${r.title} [${r.id}]`));
    }
    lines.push('');
    lines.push('Generated from the EMA Document Search Tool for information discovery. Verify citation and source details before formal, regulatory or legal reliance. The tool does not provide legal advice or an EMA determination.');
    return lines.join('\n');
  }

  async function copyRequestText(){
    const text = buildRequestText();
    const out = $('requestOutput'); if (out) out.value = text;
    try { await navigator.clipboard.writeText(text); showNotice('My List copied.', 'success'); setTimeout(()=>hide('loadNotice'),1200); }
    catch { showNotice('Copy failed. Select and copy the text manually.', 'error'); }
  }

  function toCsv(records){
    const fields = ['id','database','shortTitle','title','category','area','status','accessStatus','date','url','publicUrl','accessRoute','priority','actionNeeded','keywords'];
    const header = fields.join(',');
    const rows = records.map(r => fields.map(f => csvCell(f === 'keywords' ? array(r[f]).join('; ') : r[f])).join(','));
    return [header, ...rows].join('\n');
  }
  function csvCell(v){ return `"${String(v ?? '').replace(/"/g,'""')}"`; }
  function downloadCsv(records, filename){ downloadBlob(toCsv(records), filename, 'text/csv;charset=utf-8'); }
  function downloadJson(records, filename){ downloadBlob(JSON.stringify(records.map(exportRecord), null, 2), filename, 'application/json'); }
  function exportRecord(r){
    const { raw, searchText, ...safe } = r; return safe;
  }
  function downloadBlob(content, filename, type){
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  async function unregisterOldServiceWorkers(userInitiated){
    // This app intentionally avoids active offline caching during development because GitHub Pages caching caused stale code.
    const messages = [];
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) { await reg.unregister(); messages.push('unregistered service worker'); }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) { await caches.delete(key); messages.push(`cleared cache ${key}`); }
      }
      if (userInitiated) showNotice(messages.length ? 'App cache cleared. Reloading…' : 'No app cache found. Reloading…', 'success');
      if (userInitiated) setTimeout(() => location.reload(), 650);
    } catch (err) {
      debug('Cache reset failed', { error: err.message });
      if (userInitiated) showNotice('Could not clear the app cache automatically. Try Ctrl + F5 or an incognito window.', 'error');
    }
  }

  function renderDiagnostics(){
    const panel = $('diagnosticsPanel'); if (!panel) return;
    const info = {
      version: APP_VERSION,
      build: APP_BUILD,
      loadedPaths: state.loadedPaths,
      rawCounts: Object.fromEntries(Object.keys(DATASETS).map(key=>[key,state.raw[key]?.length||0])),
      dataVersion: DATA_VERSION,
      normalisedCount: state.records.length,
      filteredCount: state.filtered.length,
      userAgent: navigator.userAgent
    };
    panel.textContent = JSON.stringify(info, null, 2) + '\n\n' + state.diagnostics.join('\n');
  }
})();
