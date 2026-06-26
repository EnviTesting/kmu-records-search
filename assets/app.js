(() => {
  'use strict';

  const DB_PATHS = [
    'data/documents.json',
    './data/documents.json',
    'documents.json',
    './documents.json',
    'EMA_KM_documents_searchable.json',
    './EMA_KM_documents_searchable.json',
    'data/EMA_KM_documents_searchable.json',
    './data/EMA_KM_documents_searchable.json'
  ];
  const EMA_REQUEST_URL = 'https://www.ema.co.tt/information-centre-general-request/';
  const STANDARD_REQUEST_NOTE = 'This document is referenced in EMA’s Updated Public Statement 2024 and should be held by or accessible through EMA. No public online copy is currently linked in this register. Request access through the EMA Information Centre.';

  const state = {
    docs: [],
    filtered: [],
    visibleCount: 35,
    quickFilter: 'all',
    basket: loadBasket(),
    lastQuery: ''
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    search: $('searchInput'), clear: $('clearSearch'), journey: $('journeySelect'),
    area: $('areaFilter'), type: $('typeFilter'), status: $('statusFilter'), priority: $('priorityFilter'),
    results: $('resultsList'), resultCount: $('resultCount'), loadMore: $('loadMore'),
    statTotal: $('statTotal'), statPublic: $('statPublic'), statRequest: $('statRequest'),
    basketCountPill: $('basketCountPill'), openBasket: $('openBasket'), basketPanel: $('basketPanel'),
    basketItems: $('basketItems'), generatedText: $('generatedRequestText'),
    copyRequestText: $('copyRequestText'), downloadBasketCsv: $('downloadBasketCsv'), downloadBasketJson: $('downloadBasketJson'),
    downloadRequestTxt: $('downloadRequestTxt'), clearBasket: $('clearBasket'), downloadFilteredCsv: $('downloadFilteredCsv'),
    detailPanel: $('detailPanel'), detailStatus: $('detailStatus'), detailTitle: $('detailTitle'), detailMeta: $('detailMeta'),
    detailActions: $('detailActions'), detailAccess: $('detailAccess'), detailNote: $('detailNote'), detailEvidence: $('detailEvidence'),
    detailKeywords: $('detailKeywords'), relatedDocs: $('relatedDocs')
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    wireEvents();
    renderBasket();
    try {
      state.docs = await loadDatabase();
      hydrateFilters();
      renderStats();
      applyFilters();
    } catch (err) {
      console.error(err);
      showLoadError(err);
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }

  async function loadDatabase(){
    const errors = [];
    for (const path of DB_PATHS) {
      try {
        const response = await fetch(path + '?v=20260626-list-first', {cache:'no-store'});
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        const data = await response.json();
        const records = Array.isArray(data) ? data : (data.records || data.documents || []);
        if (!Array.isArray(records) || !records.length) throw new Error(`${path}: no records found`);
        return records.map(normalizeRecord);
      } catch (e) { errors.push(e.message); }
    }
    throw new Error('The database could not be loaded. Upload the full package to the GitHub repository root and confirm data/documents.json is present. Tried: ' + errors.join(' | '));
  }

  function normalizeRecord(rec){
    const direct = rec.direct_url || rec.source_url || '';
    const sourceStatus = rec.source_status || inferSourceStatus(rec);
    const keywords = Array.isArray(rec.keywords) ? rec.keywords : [];
    const search = [rec.title, rec.id, rec.programme_area, rec.record_category, rec.year, sourceStatus, rec.access_route, rec.km_value, rec.notes, rec.availability_note, keywords.join(' '), rec.search_text].filter(Boolean).join(' ').toLowerCase();
    return {...rec, source_status: sourceStatus, _best_url: direct, _search: search};
  }

  function inferSourceStatus(rec){
    if (rec.has_request_pathway || rec.source_type === 'ema_information_centre_request') return 'Held by EMA — Request Required';
    if (rec.direct_url || rec.source_url) return 'Public Link Found';
    return 'Needs Verification';
  }

  function wireEvents(){
    els.search.addEventListener('input', debounce(() => { state.visibleCount = 35; applyFilters(); }, 120));
    els.clear.addEventListener('click', () => { els.search.value=''; state.visibleCount=35; applyFilters(); els.search.focus(); });
    els.journey.addEventListener('change', () => { setQuickFilter(els.journey.value); });
    document.querySelectorAll('.quick-chip').forEach(btn => btn.addEventListener('click', () => setQuickFilter(btn.dataset.filter)));
    document.querySelectorAll('.text-chip').forEach(btn => btn.addEventListener('click', () => { els.search.value = btn.dataset.search; state.visibleCount=35; applyFilters(); els.search.focus(); }));
    [els.area, els.type, els.status, els.priority].forEach(el => el.addEventListener('change', () => { state.visibleCount=35; applyFilters(); }));
    els.loadMore.addEventListener('click', () => { state.visibleCount += 35; renderResults(); });
    els.openBasket.addEventListener('click', openBasketPanel);
    document.querySelectorAll('[data-close-basket]').forEach(el => el.addEventListener('click', closeBasketPanel));
    document.querySelectorAll('[data-close-panel]').forEach(el => el.addEventListener('click', closeDetailPanel));
    els.copyRequestText.addEventListener('click', copyRequestText);
    els.downloadBasketCsv.addEventListener('click', () => downloadFile('ema-document-request-list.csv', makeBasketCsv(), 'text/csv'));
    els.downloadBasketJson.addEventListener('click', () => downloadFile('ema-document-request-list.json', JSON.stringify(getBasketRecords(), null, 2), 'application/json'));
    els.downloadRequestTxt.addEventListener('click', () => downloadFile('ema-document-request-text.txt', makeRequestText(), 'text/plain'));
    els.clearBasket.addEventListener('click', () => { state.basket = []; saveBasket(); renderBasket(); });
    els.downloadFilteredCsv.addEventListener('click', () => downloadFile('ema-document-search-results.csv', makeCsv(state.filtered), 'text/csv'));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { closeDetailPanel(); closeBasketPanel(); } });
  }

  function setQuickFilter(filter){
    state.quickFilter = filter || 'all';
    document.querySelectorAll('.quick-chip').forEach(btn => btn.classList.toggle('is-active', btn.dataset.filter === state.quickFilter || (state.quickFilter === 'all' && btn.dataset.filter === 'all')));
    if (els.journey.value !== filter && ['all','public','request','forms','laws','reports','internal'].includes(filter)) els.journey.value = filter;
    if (filter === 'high') els.journey.value = 'all';
    state.visibleCount = 35;
    applyFilters();
  }

  function hydrateFilters(){
    fillSelect(els.area, unique('programme_area'));
    fillSelect(els.type, unique('record_category'));
    fillSelect(els.status, unique('source_status'));
    fillSelect(els.priority, unique('priority'));
  }

  function unique(field){
    return [...new Set(state.docs.map(d => d[field]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b)));
  }

  function fillSelect(select, values){
    const first = select.firstElementChild;
    select.replaceChildren(first);
    values.forEach(v => { const option = document.createElement('option'); option.value = v; option.textContent = v; select.appendChild(option); });
  }

  function renderStats(){
    const total = state.docs.length;
    const publicCount = state.docs.filter(hasPublicLink).length;
    const requestCount = state.docs.filter(isRequestRecord).length;
    els.statTotal.textContent = total;
    els.statPublic.textContent = publicCount;
    els.statRequest.textContent = requestCount;
  }

  function applyFilters(){
    const q = els.search.value.trim().toLowerCase();
    state.lastQuery = q;
    const tokens = q.split(/\s+/).filter(Boolean);
    state.filtered = state.docs
      .filter(d => matchesQuickFilter(d, state.quickFilter))
      .filter(d => !els.area.value || d.programme_area === els.area.value)
      .filter(d => !els.type.value || d.record_category === els.type.value)
      .filter(d => !els.status.value || d.source_status === els.status.value)
      .filter(d => !els.priority.value || d.priority === els.priority.value)
      .filter(d => !tokens.length || tokens.every(t => d._search.includes(t)))
      .sort((a,b) => score(b, tokens) - score(a, tokens) || String(a.title).localeCompare(String(b.title)));
    renderResults();
  }

  function matchesQuickFilter(d, filter){
    const hay = `${d.title} ${d.record_category} ${d.programme_area} ${d.source_status} ${(d.keywords||[]).join(' ')}`.toLowerCase();
    if (!filter || filter === 'all') return true;
    if (filter === 'public') return hasPublicLink(d);
    if (filter === 'request') return isRequestRecord(d);
    if (filter === 'forms') return /(form|guide|application|permit|variation|booklet|checklist|faq)/.test(hay);
    if (filter === 'laws') return /(legislation|legal|law|rules|regulation|notice|order|act)/.test(hay);
    if (filter === 'reports') return /(report|study|survey|assessment|monitoring|audit|technical|consultant|research)/.test(hay);
    if (filter === 'internal') return /(internal|policy|procedure|manual|sop|governance|human resource|finance|hse|quality|procurement|audit|qms)/.test(hay) || d.is_internal_ema_record;
    if (filter === 'high') return String(d.priority || '').toLowerCase() === 'high';
    return true;
  }

  function score(d, tokens){
    if (!tokens.length) return 0;
    const title = String(d.title || '').toLowerCase();
    const keyw = (d.keywords || []).join(' ').toLowerCase();
    let s = 0;
    tokens.forEach(t => {
      if (title.includes(t)) s += 10;
      if (keyw.includes(t)) s += 5;
      if (String(d.record_category||'').toLowerCase().includes(t)) s += 3;
      if (String(d.programme_area||'').toLowerCase().includes(t)) s += 3;
      if (String(d.source_status||'').toLowerCase().includes(t)) s += 2;
    });
    return s;
  }

  function renderResults(){
    const visible = state.filtered.slice(0, state.visibleCount);
    els.resultCount.textContent = `${state.filtered.length} record${state.filtered.length === 1 ? '' : 's'} found`;
    if (!visible.length) {
      els.results.innerHTML = `<div class="empty-state"><h3>No matching records found</h3><p>Try a broader search term or switch to All records.</p></div>`;
    } else {
      els.results.innerHTML = visible.map(renderRow).join('');
    }
    els.loadMore.style.display = state.filtered.length > state.visibleCount ? 'inline-flex' : 'none';
    els.results.querySelectorAll('[data-details]').forEach(btn => btn.addEventListener('click', () => openDetail(btn.dataset.details)));
    els.results.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => addToBasket(btn.dataset.add)));
    els.results.querySelectorAll('[data-request]').forEach(btn => btn.addEventListener('click', () => window.open(EMA_REQUEST_URL, '_blank', 'noopener')));
  }

  function renderRow(d){
    const status = statusInfo(d);
    const url = getUrl(d);
    const year = d.year || '—';
    const inBasket = state.basket.includes(d.id);
    const openBtn = url ? `<a class="row-action open" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open</a>` : '';
    const requestBtn = isRequestRecord(d) ? `<button class="row-action request" type="button" data-request="${escapeAttr(d.id)}">Request</button>` : '';
    const addLabel = inBasket ? 'Added' : 'Add';
    return `<article class="result-row ${status.kind}" data-id="${escapeAttr(d.id)}">
      <div class="cell status"><span class="status-badge ${status.kind}">${escapeHtml(status.label)}</span></div>
      <div class="cell doc"><p class="doc-title">${escapeHtml(d.title || 'Untitled record')}</p><p class="doc-sub">${escapeHtml(d.id || '')}${d.priority ? ' · ' + escapeHtml(d.priority) + ' priority' : ''}</p></div>
      <div class="cell area">${escapeHtml(d.programme_area || '—')}</div>
      <div class="cell type">${escapeHtml(d.record_category || '—')}</div>
      <div class="cell year">${escapeHtml(String(year))}</div>
      <div class="cell actions">${openBtn}${requestBtn}<button class="row-action ${inBasket ? 'added' : ''}" type="button" data-add="${escapeAttr(d.id)}">${addLabel}</button><button class="row-action" type="button" data-details="${escapeAttr(d.id)}">Details</button></div>
    </article>`;
  }

  function openDetail(id){
    const d = state.docs.find(x => x.id === id);
    if (!d) return;
    const status = statusInfo(d);
    els.detailStatus.className = `status-badge ${status.kind}`;
    els.detailStatus.textContent = status.label;
    els.detailTitle.textContent = d.title || 'Document details';
    els.detailMeta.textContent = [d.programme_area, d.record_category, d.year, d.priority && `${d.priority} priority`].filter(Boolean).join(' · ');
    const url = getUrl(d);
    els.detailActions.innerHTML = `${url ? `<a class="primary-btn" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open document/source</a>` : ''}${isRequestRecord(d) ? `<a class="link-btn" href="${EMA_REQUEST_URL}" target="_blank" rel="noopener">Open EMA request page</a>` : ''}<button class="secondary-btn" type="button" data-panel-add="${escapeAttr(d.id)}">Add to basket</button>`;
    const addButton = els.detailActions.querySelector('[data-panel-add]');
    if (addButton) addButton.addEventListener('click', () => addToBasket(d.id));
    els.detailAccess.textContent = d.source_label || accessText(d);
    els.detailNote.textContent = d.availability_note || d.notes || STANDARD_REQUEST_NOTE;
    els.detailEvidence.textContent = d.source_reliability || d.gazette_section || 'Referenced in the EMA document access register.';
    els.detailKeywords.innerHTML = (d.keywords || []).map(k => `<span>${escapeHtml(k)}</span>`).join('') || '<span>No keywords listed</span>';
    renderRelated(d);
    els.detailPanel.classList.add('is-open');
    els.detailPanel.setAttribute('aria-hidden','false');
    els.detailTitle.focus?.();
  }

  function renderRelated(d){
    const related = state.docs.filter(x => x.id !== d.id && x.programme_area === d.programme_area).slice(0,4);
    els.relatedDocs.innerHTML = related.length ? related.map(r => `<button class="related-item" type="button" data-related="${escapeAttr(r.id)}"><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.record_category || '')} · ${escapeHtml(statusInfo(r).label)}</small></button>`).join('') : '<p class="muted">No related records suggested.</p>';
    els.relatedDocs.querySelectorAll('[data-related]').forEach(btn => btn.addEventListener('click', () => openDetail(btn.dataset.related)));
  }

  function closeDetailPanel(){ els.detailPanel.classList.remove('is-open'); els.detailPanel.setAttribute('aria-hidden','true'); }
  function openBasketPanel(){ renderBasket(); els.basketPanel.classList.add('is-open'); els.basketPanel.setAttribute('aria-hidden','false'); }
  function closeBasketPanel(){ els.basketPanel.classList.remove('is-open'); els.basketPanel.setAttribute('aria-hidden','true'); }

  function addToBasket(id){
    if (!state.basket.includes(id)) state.basket.push(id);
    saveBasket();
    renderBasket();
    renderResults();
  }

  function removeFromBasket(id){
    state.basket = state.basket.filter(x => x !== id);
    saveBasket();
    renderBasket();
    renderResults();
  }

  function renderBasket(){
    const records = getBasketRecords();
    els.basketCountPill.textContent = records.length;
    els.generatedText.value = makeRequestText();
    if (!records.length) {
      els.basketItems.innerHTML = `<div class="empty-state"><p>No documents added yet. Search or filter for <strong>Held by EMA</strong> records, then add documents to prepare a request.</p></div>`;
      return;
    }
    els.basketItems.innerHTML = records.map(d => `<div class="basket-item ${hasPublicLink(d) ? 'public' : ''}"><div><strong>${escapeHtml(d.title)}</strong><small>${escapeHtml(d.record_category || '')} · ${escapeHtml(d.programme_area || '')} · ${escapeHtml(statusInfo(d).label)}</small></div><button class="remove-item" type="button" aria-label="Remove ${escapeAttr(d.title)}" data-remove="${escapeAttr(d.id)}">×</button></div>`).join('');
    els.basketItems.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => removeFromBasket(btn.dataset.remove)));
  }

  function getBasketRecords(){ return state.basket.map(id => state.docs.find(d => d.id === id)).filter(Boolean); }
  function loadBasket(){ try { return JSON.parse(localStorage.getItem('emaRegisterBasket') || '[]'); } catch { return []; } }
  function saveBasket(){ localStorage.setItem('emaRegisterBasket', JSON.stringify(state.basket)); }

  function makeRequestText(){
    const records = getBasketRecords();
    if (!records.length) return 'Add documents to the request basket to generate request text.';
    const requestRecords = records.filter(isRequestRecord);
    const publicRecords = records.filter(d => !isRequestRecord(d) && getUrl(d));
    const lines = ['Subject: Request for access to documents referenced in EMA’s Updated Public Statement 2024', '', 'I am requesting access to the following documents referenced in EMA’s Updated Public Statement 2024:', ''];
    const list = requestRecords.length ? requestRecords : records;
    list.forEach((d,i) => lines.push(`${i+1}. ${d.title}${d.year ? ' (' + d.year + ')' : ''}`));
    lines.push('', 'These records are listed as held by or accessible through EMA, but no public online copy is currently linked in this register. I am requesting guidance on availability and access through the EMA Information Centre.');
    if (publicRecords.length) {
      lines.push('', 'Public/source links also added to my document list:');
      publicRecords.forEach((d,i) => lines.push(`${i+1}. ${d.title} — ${getUrl(d)}`));
    }
    return lines.join('\n');
  }

  async function copyRequestText(){
    const txt = makeRequestText();
    try { await navigator.clipboard.writeText(txt); els.copyRequestText.textContent = 'Copied'; setTimeout(() => els.copyRequestText.textContent = 'Copy request text', 1400); }
    catch { els.generatedText.select(); document.execCommand('copy'); }
  }

  function makeBasketCsv(){ return makeCsv(getBasketRecords()); }
  function makeCsv(records){
    const headers = ['Document title','Document type','Knowledge area','Year','Source status','Access route','Public link','Request note','Evidence source','Keywords'];
    const rows = records.map(d => [d.title, d.record_category, d.programme_area, d.year || '', statusInfo(d).label, d.access_route || '', getUrl(d) || '', d.availability_note || d.notes || '', d.source_reliability || d.gazette_section || '', (d.keywords||[]).join('; ')]);
    return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  }

  function csvCell(v){ const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }
  function downloadFile(filename, content, type){
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function statusInfo(d){
    const s = String(d.source_status || '').toLowerCase();
    if (isRequestRecord(d)) return {label:'Held by EMA', kind:'request'};
    if (s.includes('ema source') || s.includes('source page')) return {label:'EMA Source Page', kind:'sourcepage'};
    if (s.includes('external')) return {label: s.includes('citation') ? 'Externally Cited' : 'External Source', kind:'external'};
    if (hasPublicLink(d)) return {label:'Public Link Found', kind:'public'};
    return {label:d.source_status || 'Needs Verification', kind:'verify'};
  }
  function hasPublicLink(d){ return Boolean(d.direct_url || d.source_url || d.has_direct_url || d.has_source_url) && !isRequestRecord(d); }
  function isRequestRecord(d){ return Boolean(d.has_request_pathway || d.source_type === 'ema_information_centre_request' || String(d.source_status||'').toLowerCase().includes('request required') || String(d.access_route||'').toLowerCase().includes('information centre')); }
  function getUrl(d){ return d.direct_url || d.source_url || ''; }
  function accessText(d){ if (isRequestRecord(d)) return 'Held by EMA. Request access through the EMA Information Centre.'; if (getUrl(d)) return 'Public link or source page available.'; return 'Needs verification before relying on this record.'; }

  function showLoadError(err){
    els.resultCount.textContent = 'Database could not be loaded';
    els.results.innerHTML = `<div class="empty-state"><h3>The database could not be loaded.</h3><p>${escapeHtml(err.message)}</p><p>For GitHub Pages, upload the full package to the repository root and keep <code>data/documents.json</code> in place.</p></div>`;
  }

  function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function escapeAttr(v){ return escapeHtml(v); }
  function debounce(fn, ms){ let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
})();
