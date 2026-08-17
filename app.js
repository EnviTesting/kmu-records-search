(() => {
  'use strict';

  const APP_VERSION = '6.2.0';
  const APP_BUILD = '2026.08.17-kmu-corpus-v6.2.0';
  const EMA_REQUEST_URL = 'https://www.ema.co.tt/information-centre-general-request/';
  const KMU_CONTACT_EMAIL = 'ema@ema.co.tt'; // Official EMA contact. Replace here if a dedicated KMU mailbox is adopted.
  const CORPUS_VERSION = '2026.08.17.1';
  const PAGE_SIZE = 45;

  const state = {
    raw: { documents: [], press_releases: [], judgments: [] },
    records: [],
    filtered: [],
    visibleCount: PAGE_SIZE,
    database: 'all',
    quickFilter: 'all',
    journey: 'all',
    query: '',
    area: 'all',
    type: 'all',
    status: 'all',
    year: 'all',
    expandedId: null,
    basket: loadBasket(),
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

  const DATASETS = {
    documents: [
      'data/documents.json',
      './data/documents.json',
      'documents.json',
      './documents.json',
      'EMA_KM_documents_searchable.json',
      './EMA_KM_documents_searchable.json'
    ],
    judgments: [
      'data/judgments.json',
      './data/judgments.json',
      'judgments.json',
      './judgments.json'
    ],
    press_releases: [
      'data/press_releases.json',
      './data/press_releases.json',
      'press_releases.json',
      './press_releases.json',
      'data/EMA_press_releases_searchable.json',
      './data/EMA_press_releases_searchable.json',
      'EMA_press_releases_searchable.json',
      './EMA_press_releases_searchable.json'
    ]
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    safeText('appVersion', APP_VERSION);
    bindEvents();
    await unregisterOldServiceWorkers(false);
    await loadAllData();
    normaliseAllRecords();
    populateFilters();
    applyFiltersAndRender();
    renderBasket();
    debug('Initialised', { version: APP_BUILD, records: state.records.length });
  }

  function bindEvents(){
    $('searchInput')?.addEventListener('input', (e) => { state.query = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('clearSearchBtn')?.addEventListener('click', () => { state.query = ''; const input = $('searchInput'); if (input) input.value = ''; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('journeySelect')?.addEventListener('change', (e) => { state.journey = e.target.value; state.quickFilter = e.target.value === 'all' ? 'all' : e.target.value; syncQuickFilters(); state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('areaFilter')?.addEventListener('change', (e) => { state.area = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('typeFilter')?.addEventListener('change', (e) => { state.type = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('statusFilter')?.addEventListener('change', (e) => { state.status = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('yearFilter')?.addEventListener('change', (e) => { state.year = e.target.value; state.visibleCount = PAGE_SIZE; applyFiltersAndRender(); });
    $('loadMoreBtn')?.addEventListener('click', () => { state.visibleCount += PAGE_SIZE; renderResults(); });
    $('exportResultsBtn')?.addEventListener('click', () => downloadCsv(state.filtered, 'ema-current-results.csv'));
    $('openBasketBtn')?.addEventListener('click', openBasket);
    $('closeBasketBtn')?.addEventListener('click', closeBasket);
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

    document.addEventListener('click', (e) => {
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
        state.query = q;
        const input = $('searchInput'); if (input) { input.value = q; input.focus(); }
        state.visibleCount = PAGE_SIZE;
        applyFiltersAndRender();
        return;
      }
      const lowAction = e.target.closest('[data-low-action]');
      if (lowAction) {
        const action=lowAction.getAttribute('data-low-action');
        if (action==='clear-filters') clearAllFilters();
        if (action==='search-all') { state.database='all'; state.quickFilter='all'; state.journey='all'; const journey=$('journeySelect'); if(journey) journey.value='all'; syncQuickFilters(); $$('.tab').forEach(b=>b.classList.toggle('active',b.getAttribute('data-database')==='all')); state.visibleCount=PAGE_SIZE; applyFiltersAndRender(); }
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
    const results = await Promise.allSettled([
      loadFirstJson(DATASETS.documents, 'documents'),
      loadFirstJson(DATASETS.press_releases, 'press_releases'),
      loadFirstJson(DATASETS.judgments, 'judgments')
    ]);
    const [docsResult, pressResult, judgmentsResult] = results;
    if (docsResult.status === 'fulfilled') state.raw.documents = docsResult.value;
    if (pressResult.status === 'fulfilled') state.raw.press_releases = pressResult.value;
    if (judgmentsResult.status === 'fulfilled') state.raw.judgments = judgmentsResult.value;

    const loadedCount = state.raw.documents.length + state.raw.press_releases.length + state.raw.judgments.length;
    if (!loadedCount) {
      showNotice('No databases loaded. Check that data/documents.json, data/press_releases.json and data/judgments.json were uploaded to GitHub Pages.', 'error');
    } else if (docsResult.status === 'rejected' || pressResult.status === 'rejected' || judgmentsResult.status === 'rejected') {
      showNotice(`Partial load: ${loadedCount} records loaded. One database could not be read; search still works for loaded records.`, 'error');
    } else {
      showNotice(`${loadedCount} records loaded.`, 'success');
      setTimeout(() => hide('loadNotice'), 1200);
    }
    debug('Data load results', { documents: state.raw.documents.length, press_releases: state.raw.press_releases.length, judgments: state.raw.judgments.length, paths: state.loadedPaths });
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
    const documents = state.raw.documents.map((r, i) => normaliseRecord(r, 'documents', i));
    const press = state.raw.press_releases.map((r, i) => normaliseRecord(r, 'press_releases', i));
    const judgments = state.raw.judgments.map((r, i) => normaliseRecord(r, 'judgments', i));
    state.records = [...documents, ...judgments, ...press].filter(Boolean);
    // stable order: most recent press first, then documents by title if no date
    state.records.sort((a,b) => {
      const da = a.sortDate || '0000-00-00';
      const db = b.sortDate || '0000-00-00';
      if (da !== db) return db.localeCompare(da);
      return a.shortTitle.localeCompare(b.shortTitle);
    });
    // Refresh saved selections against the current corpus so browser-local
    // selections never retain stale metadata after a corpus update.
    const selectedIds = new Set((state.basket || []).map(r => r.id));
    state.basket = state.records.filter(r => selectedIds.has(r.id));
    saveBasket();
    updateMetrics();
  }

  function normaliseRecord(r, database, index){
    try {
      const title = clean(r.title || r.formal_title || r.name || `Untitled record ${index+1}`);
      const shortTitle = clean(r.short_title || makeShortTitle(title));
      const id = clean(r.id || `${database}-${index+1}`);
      const category = clean(r.record_category || r.record_type || r.type || (database === 'press_releases' ? 'News & Events' : (database === 'judgments' ? 'Judgment' : 'Document')));
      const area = clean(r.programme_area || r.theme || r.knowledge_area || 'Cross-cutting');
      const status = clean(r.source_status || r.status || 'Needs Verification');
      const rawYearText = clean(r.year || '');
      const rawDate = clean(r.date_published || r.date || '');
      const yearTags = extractYearTags([rawYearText, rawDate, title, shortTitle].join(' '));
      const year = clean(rawYearText || (rawDate ? String(rawDate).slice(0,4) : (yearTags[0] || '')));
      const date = clean(rawDate || year || '');
      const url = clean(r.direct_url || r.source_url || r.url || '');
      const sourcePage = clean(r.source_page_url || r.source_page || '');
      const accessRoute = clean(r.access_route || (url ? 'Public link' : 'EMA Information Centre'));
      const keywords = uniq([...array(r.keywords), ...array(r.keyword_common_group), ...array(r.keyword_unique), ...array(r.keyword_discretionary)].map(clean)).slice(0, 30);
      const hasRequest = Boolean(r.has_request_pathway) || /held by ema|request/i.test(status + ' ' + accessRoute + ' ' + r.source_type);
      const hasUrl = Boolean(url);
      const dbLabel = database === 'press_releases' ? 'News & Events' : (database === 'judgments' ? 'Judgments & Proceedings' : 'Document Access Register');
      const sortYear = yearTags[0] || extractYearTags(year)[0] || '';
      const sortDate = rawDate ? clean(rawDate) : (sortYear ? `${sortYear}-01-01` : '');
      const norm = {
        id, database, dbLabel, index,
        shortTitle, title, category, area, status, year, yearTags, date, url, sourcePage, accessRoute,
        sourceType: clean(r.source_type || ''),
        sourceLabel: clean(r.source_label || ''),
        reliability: clean(r.source_reliability || r.verification_status || ''),
        availabilityNote: clean(r.availability_note || r.notes || ''),
        description: clean(r.description || r.summary_snippet || ''),
        descriptionBasis: clean(r.description_basis || ''),
        descriptionSource: clean(r.description_source_url || ''),
        court: clean(r.court || ''),
        caseNumber: clean(r.case_number || ''),
        citation: clean(r.citation || ''),
        caseStatus: clean(r.case_status || ''),
        notes: clean(r.notes || r.summary_snippet || ''),
        kmValue: clean(r.km_value || ''),
        priority: clean(r.priority || ''),
        actionNeeded: clean(r.action_needed || suggestedAction(status, hasUrl, hasRequest, database)),
        keywords, hasRequest, hasUrl, sourcePage, sortDate,
        raw: r
      };
      norm.searchText = lower([norm.shortTitle, norm.title, norm.category, norm.area, norm.status, norm.year, ...yearTags, norm.date, norm.dbLabel, norm.accessRoute, norm.description, norm.notes, norm.court, norm.caseNumber, norm.citation, norm.caseStatus, ...keywords].join(' '));
      norm.statusClass = statusClass(norm);
      return norm;
    } catch (err) {
      debug('Record normalisation failed', { database, index, error: err.message });
      return {
        id: `${database}-invalid-${index}`, database, dbLabel: database, index,
        shortTitle: `Record ${index+1}`, title: 'Malformed record', category: 'Needs Verification', area: 'Unknown', status: 'Needs Verification', year: '', yearTags: [], date: '', url: '', sourcePage: '', accessRoute: '', keywords: [], hasRequest: false, hasUrl: false, searchText: '', statusClass: 'verify', notes: 'This record could not be fully read.', raw: r
      };
    }
  }

  function makeShortTitle(title){
    let t = title.replace(/^MEDIA RELEASE\s*[–-]\s*/i,'').replace(/^Media Release\s*[–-]\s*/i,'').replace(/^JOINT AGENCY MEDIA RELEASE\s*[–-]\s*/i,'');
    t = t.replace(/^The Environmental Management Authority\s*\(EMA\)\s*/i,'EMA ');
    return t.length > 68 ? t.slice(0,65).trim() + '…' : t;
  }

  function suggestedAction(status, hasUrl, hasRequest, database){
    if (hasUrl) return database === 'press_releases' ? 'Open EMA Latest News post' : 'Open public document or source page';
    if (hasRequest) return 'Request access through EMA Information Centre';
    return 'Review source and verify access pathway';
  }

  function statusClass(r){
    const s = lower(r.status + ' ' + r.sourceType + ' ' + r.accessRoute);
    if (/held by ema|request|required|information centre/.test(s)) return 'request';
    if (/external/.test(s)) return 'external';
    if (/ema source|source page|latest news/.test(s)) return 'source';
    if (/public link|public page|ema public|direct/.test(s) || r.hasUrl) return 'public';
    return 'verify';
  }

  function updateMetrics(){
    safeText('metricTotal', state.records.length);
    safeText('metricDocuments', state.records.filter(r=>r.database==='documents').length);
    safeText('metricJudgments', state.records.filter(r=>r.database==='judgments').length);
    safeText('metricPress', state.records.filter(r=>r.database==='press_releases').length);
  }

  function populateFilters(){
    setOptions('areaFilter', state.records.map(r=>r.area));
    setOptions('typeFilter', state.records.map(r=>r.category));
    setOptions('statusFilter', state.records.map(r=>r.status));
    setOptions('yearFilter', state.records.flatMap(r => r.yearTags && r.yearTags.length ? r.yearTags : extractYearTags(r.year)), 'numeric-desc');
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

  function applyFiltersAndRender(){
    let records = state.records.slice();
    const q = lower(state.query);
    if (state.database !== 'all') records = records.filter(r => r.database === state.database);
    if (state.quickFilter !== 'all') records = records.filter(r => quickMatch(r, state.quickFilter));
    if (state.area !== 'all') records = records.filter(r => r.area === state.area);
    if (state.type !== 'all') records = records.filter(r => r.category === state.type);
    if (state.status !== 'all') records = records.filter(r => r.status === state.status);
    if (state.year !== 'all') records = records.filter(r => (r.yearTags || []).includes(state.year) || r.year === state.year || String(r.date || '').startsWith(state.year));
    if (q) records = records.map(r => ({ record: r, score: scoreRecord(r, q) })).filter(x => x.score > 0).sort((a,b)=>b.score-a.score).map(x=>x.record);
    state.filtered = records;
    renderResults();
  }

  function quickMatch(r, filter){
    const hay = r.searchText;
    switch(filter){
      case 'public': return r.hasUrl && !r.hasRequest;
      case 'request': return r.hasRequest;
      case 'forms': return /form|guide|application|instruction|booklet|checklist|permit/.test(hay);
      case 'law': return r.database === 'judgments' || /law|legal|rule|regulation|act|notice|order|legislation|judgment|appeal|court/.test(hay);
      case 'reports': return /report|study|survey|assessment|monitoring|technical|inventory|audit|valuation/.test(hay);
      case 'internal': return /internal|policy|manual|procedure|sop|governance|procurement|human resource|hse|quality/.test(hay) || /internal/i.test(r.sourceType);
      case 'press': return r.database === 'press_releases' || /press release|media release|news & events|public communication/.test(hay);
      case 'judgments': return r.database === 'judgments';
      case 'priority': return /high|priority|request/.test(lower(r.priority + ' ' + r.actionNeeded));
      default: return true;
    }
  }

  function scoreRecord(r, q){
    const terms = q.split(/\s+/).filter(Boolean);
    let score = 0;
    const short = lower(r.shortTitle), title = lower(r.title), kws = lower(r.keywords.join(' '));
    for (const t of terms) {
      if (short === t || title === t) score += 120;
      if (short.includes(t)) score += 45;
      if (title.includes(t)) score += 30;
      if (kws.includes(t)) score += 22;
      if (lower(r.area).includes(t)) score += 16;
      if (lower(r.category).includes(t)) score += 14;
      if (lower(r.status).includes(t)) score += 8;
      if (r.searchText.includes(t)) score += 5;
    }
    if (r.searchText.includes(q)) score += 50;
    return score;
  }

  function renderResults(){
    const body = $('resultsBody');
    if (!body) { debug('Missing resultsBody element'); return; }
    const total = state.filtered.length;
    safeText('resultCount', `${total} record${total===1?'':'s'} found`);
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

  function renderRow(r){
    const primaryAction = r.hasUrl ? `<a class="primary" href="${esc(r.url)}" target="_blank" rel="noopener">Open source</a>` : (r.hasRequest ? `<a class="primary" href="${EMA_REQUEST_URL}" target="_blank" rel="noopener">Request access</a>` : '');
    const formal = r.title && r.title !== r.shortTitle ? `<small>${esc(r.title)}</small>` : '';
    const isSelected = state.basket.some(item => item.id === r.id);
    const legalMeta = r.database === 'judgments' ? [r.court, r.citation || r.caseNumber, r.caseStatus].filter(Boolean).join(' · ') : '';
    const context = legalMeta || r.description || r.dbLabel;
    return `<tr class="result-row row-${r.statusClass}${isSelected?' is-selected':''}" data-id="${esc(r.id)}">
      <td data-label="Access"><span class="status-pill status-${r.statusClass}">${esc(statusLabel(r))}</span></td>
      <td data-label="Record" class="title-cell"><strong>${esc(r.shortTitle)}</strong>${formal}<span class="meta-sm">${esc(context)}</span></td>
      <td data-label="Area">${esc(r.area || '—')}</td>
      <td data-label="Type">${esc(r.category || '—')}</td>
      <td data-label="Year / Date">${esc(r.date || r.year || '—')}</td>
      <td data-label="Action"><div class="action-stack">${primaryAction}<button class="ghost" type="button" data-action="details" data-id="${esc(r.id)}">${state.expandedId===r.id?'Show less':'View record'}</button><button class="ghost select-toggle${isSelected?' selected':''}" type="button" aria-pressed="${isSelected?'true':'false'}" data-action="toggle-basket" data-id="${esc(r.id)}">${isSelected?'✓ Added':'+ Add'}</button></div></td>
    </tr>`;
  }

  function renderFallbackRow(r){
    return `<tr class="result-row"><td colspan="6"><strong>${esc(r.shortTitle || r.title || 'Record')}</strong><br><span class="meta-sm">This record could not be fully rendered. Try exporting current results or checking the JSON.</span></td></tr>`;
  }

  function renderDetailRow(r){
    const sourceLink = r.hasUrl ? `<p><a href="${esc(r.url)}" target="_blank" rel="noopener">Open source</a></p>` : '';
    const sourcePage = r.sourcePage && r.sourcePage !== r.url ? `<p><a href="${esc(r.sourcePage)}" target="_blank" rel="noopener">Open source/index page</a></p>` : '';
    const description = r.description || `${r.category || 'Record'} catalogued under ${r.area || 'Cross-cutting'}.`;
    const legalDetails = r.database === 'judgments' ? `<div class="info-box"><h4>Proceeding details</h4><p>${r.court?`<strong>Court:</strong> ${esc(r.court)}<br>`:''}${r.caseNumber?`<strong>Case no.:</strong> ${esc(r.caseNumber)}<br>`:''}${r.citation?`<strong>Citation:</strong> ${esc(r.citation)}<br>`:''}${r.caseStatus?`<strong>Status:</strong> ${esc(r.caseStatus)}`:''}</p></div>` : '';
    return `<tr class="detail-row"><td colspan="6">
      <div class="index-card ${r.statusClass}">
        <div class="index-card-head">
          <div><h3>${esc(r.shortTitle)}</h3><p class="meta-sm">${esc(r.title)}</p></div>
          <button class="ghost" type="button" data-action="minimise">Close details</button>
        </div>
        <div class="index-grid">
          <div class="info-box context-box"><h4>About this record</h4><p>${esc(description)}</p>${r.descriptionSource?`<p class="source-note">Context source: <a href="${esc(r.descriptionSource)}" target="_blank" rel="noopener">open source</a></p>`:''}</div>
          ${legalDetails}
          <div class="info-box"><h4>Source and access</h4><p>${esc(r.accessRoute || r.sourceLabel || statusLabel(r))}</p>${sourceLink}${sourcePage}</div>
        </div>
        <div class="index-grid secondary-grid">
          <div class="info-box"><h4>Record details</h4><p><strong>ID:</strong> ${esc(r.id)}<br><strong>Record set:</strong> ${esc(r.dbLabel)}<br><strong>Type:</strong> ${esc(r.category)}<br><strong>Date:</strong> ${esc(r.date || r.year || '—')}<br><strong>Source status:</strong> ${esc(r.status)}</p></div>
          <div class="info-box"><h4>Source note</h4><p>${esc(r.availabilityNote || 'Refer to the linked source for the authoritative text.')}</p></div>
          <div class="info-box"><h4>Keywords</h4><div class="keyword-list">${r.keywords.slice(0,20).map(k=>`<span class="keyword">${esc(k)}</span>`).join('') || '<span class="meta-sm">No keywords captured.</span>'}</div></div>
        </div>
      </div>
    </td></tr>`;
  }

  function statusLabel(r){
    if (r.statusClass === 'request') return 'Held by EMA';
    if (r.statusClass === 'external') return 'External source';
    if (r.statusClass === 'source') return 'EMA source page';
    if (r.statusClass === 'public') return r.database === 'press_releases' ? 'EMA public post' : (r.database === 'judgments' ? 'Court source' : 'Public link');
    return 'Needs review';
  }

  function hasActiveFilters(){
    return Boolean(state.query || state.database !== 'all' || state.quickFilter !== 'all' || state.area !== 'all' || state.type !== 'all' || state.status !== 'all' || state.year !== 'all');
  }

  function activeFilterSummary(){
    const parts=[];
    if (state.database !== 'all') parts.push(`Record set: ${state.database === 'press_releases' ? 'News & Events' : state.database === 'judgments' ? 'Judgments & Proceedings' : 'Documents'}`);
    if (state.quickFilter !== 'all') parts.push(`Quick filter: ${state.quickFilter}`);
    if (state.area !== 'all') parts.push(`Area: ${state.area}`);
    if (state.type !== 'all') parts.push(`Type: ${state.type}`);
    if (state.status !== 'all') parts.push(`Source status: ${state.status}`);
    if (state.year !== 'all') parts.push(`Year: ${state.year}`);
    return parts;
  }

  function kmuMailto(){
    const subject='EMA Knowledge Access Register – search assistance / possible missing record';
    const filters=activeFilterSummary();
    const body=[
      'I was searching the EMA Knowledge Access Register and would like assistance locating a record or suggesting a possible addition/correction.',
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
  function saveBasket(){ localStorage.setItem('emaRecordBasketV4', JSON.stringify(state.basket)); safeText('basketCount', state.basket.length); }
  function toggleBasket(id){
    const rec = state.records.find(r => r.id === id);
    if (!rec) return;
    const selected = state.basket.some(r => r.id === id);
    if (selected) state.basket = state.basket.filter(r => r.id !== id); else state.basket.push(rec);
    saveBasket(); renderBasket(); renderResults();
    showNotice(selected ? `Removed “${rec.shortTitle}” from selected records.` : `Added “${rec.shortTitle}” to selected records.`, 'success');
    setTimeout(()=>hide('loadNotice'), 1100);
  }
  function addToBasket(id){ if (!state.basket.some(r=>r.id===id)) toggleBasket(id); }
  function removeFromBasket(id){ state.basket = state.basket.filter(r => r.id !== id); saveBasket(); renderBasket(); renderResults(); }
  function openBasket(){ $('basketDrawer')?.classList.add('open'); $('basketDrawer')?.setAttribute('aria-hidden','false'); renderBasket(); }
  function closeBasket(){ $('basketDrawer')?.classList.remove('open'); $('basketDrawer')?.setAttribute('aria-hidden','true'); }

  function renderBasket(){
    safeText('basketCount', state.basket.length);
    const el = $('basketItems'); if (!el) return;
    if (!state.basket.length) { el.className = 'basket-items empty'; el.textContent = 'No records selected yet.'; safeText('requestOutput', buildRequestText()); return; }
    el.className = 'basket-items';
    el.innerHTML = state.basket.map(r => `<div class="basket-item"><strong>${esc(r.shortTitle)}</strong><small>${esc(r.dbLabel)} · ${esc(statusLabel(r))}</small><button class="ghost" type="button" data-action="remove-basket" data-id="${esc(r.id)}">Remove</button></div>`).join('');
    const out = $('requestOutput'); if (out) out.value = buildRequestText();
  }

  function buildRequestText(){
    if (!state.basket.length) return 'Select records to generate request text.';
    const requestItems = state.basket.filter(r => r.hasRequest || !r.hasUrl);
    const linkItems = state.basket.filter(r => r.hasUrl);
    const lines = [];
    lines.push('Subject: Request for access to documents referenced in EMA’s public records');
    lines.push('');
    if (requestItems.length) {
      lines.push('I am requesting access to the following records referenced in EMA’s Updated Public Statement 2024 or captured in the EMA Knowledge Access Register:');
      requestItems.forEach((r,i)=>lines.push(`${i+1}. ${r.title} [${r.id}]`));
      lines.push('');
      lines.push('These records are listed as held by or accessible through EMA, but no public online copy is currently linked in this register. I am requesting guidance on availability and access through the EMA Information Centre.');
      lines.push('');
    }
    if (linkItems.length) {
      lines.push('Related public/source links included for reference:');
      linkItems.forEach((r,i)=>lines.push(`${i+1}. ${r.title} — ${r.url}`));
    }
    return lines.join('\n');
  }

  async function copyRequestText(){
    const text = buildRequestText();
    const out = $('requestOutput'); if (out) out.value = text;
    try { await navigator.clipboard.writeText(text); showNotice('Request text copied.', 'success'); setTimeout(()=>hide('loadNotice'),1200); }
    catch { showNotice('Copy failed. Select and copy the text manually.', 'error'); }
  }

  function toCsv(records){
    const fields = ['id','database','shortTitle','title','category','area','status','date','url','accessRoute','priority','actionNeeded','keywords'];
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
      rawCounts: { documents: state.raw.documents.length, press_releases: state.raw.press_releases.length, judgments: state.raw.judgments.length },
      corpusVersion: CORPUS_VERSION,
      normalisedCount: state.records.length,
      filteredCount: state.filtered.length,
      userAgent: navigator.userAgent
    };
    panel.textContent = JSON.stringify(info, null, 2) + '\n\n' + state.diagnostics.join('\n');
  }
})();
