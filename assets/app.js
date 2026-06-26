(() => {
  'use strict';

  const DB_PATHS = [
    'data/documents.json', './data/documents.json',
    'documents.json', './documents.json',
    'EMA_KM_documents_searchable.json', './EMA_KM_documents_searchable.json',
    'data/EMA_KM_documents_searchable.json', './data/EMA_KM_documents_searchable.json'
  ];
  const EMA_REQUEST_URL = 'https://www.ema.co.tt/information-centre-general-request/';
  const STANDARD_REQUEST_NOTE = 'This document is referenced in EMA’s Updated Public Statement 2024 and should be held by or accessible through EMA. No public online copy is currently linked in this register. Request access through the EMA Information Centre.';

  const state = {
    docs: [], filtered: [], visibleCount: 35, quickFilter: 'all',
    basket: loadBasket(), lastQuery: '', expanded: new Set()
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
    downloadRequestTxt: $('downloadRequestTxt'), clearBasket: $('clearBasket'), downloadFilteredCsv: $('downloadFilteredCsv')
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    wireEvents(); renderBasket();
    try { state.docs = await loadDatabase(); hydrateFilters(); renderStats(); applyFilters(); }
    catch (err) { console.error(err); showLoadError(err); }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }

  async function loadDatabase(){
    const errors = [];
    for (const path of DB_PATHS) {
      try {
        const response = await fetch(path + '?v=20260626-fast-list-v2', {cache:'no-store'});
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
    const short = rec.short_title || makeShortTitle(rec.title || 'Untitled record');
    const keywords = Array.isArray(rec.keywords) ? rec.keywords : [];
    const search = [short, rec.title, rec.id, rec.programme_area, rec.record_category, rec.year, sourceStatus, rec.access_route, rec.km_value, rec.notes, rec.availability_note, keywords.join(' '), rec.search_text].filter(Boolean).join(' ').toLowerCase();
    return {...rec, short_title: short, source_status: sourceStatus, _best_url: direct, _search: search};
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
    els.copyRequestText.addEventListener('click', copyRequestText);
    els.downloadBasketCsv.addEventListener('click', () => downloadFile('ema-document-request-list.csv', makeBasketCsv(), 'text/csv'));
    els.downloadBasketJson.addEventListener('click', () => downloadFile('ema-document-request-list.json', JSON.stringify(getBasketRecords(), null, 2), 'application/json'));
    els.downloadRequestTxt.addEventListener('click', () => downloadFile('ema-document-request-text.txt', makeRequestText(), 'text/plain'));
    els.clearBasket.addEventListener('click', () => { state.basket = []; saveBasket(); renderBasket(); renderResults(); });
    els.downloadFilteredCsv.addEventListener('click', () => downloadFile('ema-document-search-results.csv', makeCsv(state.filtered), 'text/csv'));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeBasketPanel(); });
  }

  function setQuickFilter(filter){
    state.quickFilter = filter || 'all';
    state.expanded.clear();
    document.querySelectorAll('.quick-chip').forEach(btn => btn.classList.toggle('is-active', btn.dataset.filter === state.quickFilter || (state.quickFilter === 'all' && btn.dataset.filter === 'all')));
    if (els.journey.value !== filter && ['all','public','request','forms','laws','reports','internal'].includes(filter)) els.journey.value = filter;
    if (filter === 'high') els.journey.value = 'all';
    state.visibleCount = 35; applyFilters();
  }

  function hydrateFilters(){ fillSelect(els.area, unique('programme_area')); fillSelect(els.type, unique('record_category')); fillSelect(els.status, unique('source_status')); fillSelect(els.priority, unique('priority')); }
  function unique(field){ return [...new Set(state.docs.map(d => d[field]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b))); }
  function fillSelect(select, values){ const first = select.firstElementChild; select.replaceChildren(first); values.forEach(v => { const option=document.createElement('option'); option.value=v; option.textContent=v; select.appendChild(option); }); }

  function renderStats(){
    els.statTotal.textContent = state.docs.length;
    els.statPublic.textContent = state.docs.filter(hasPublicLink).length;
    els.statRequest.textContent = state.docs.filter(isRequestRecord).length;
  }

  function applyFilters(){
    const q = els.search.value.trim().toLowerCase(); state.lastQuery = q;
    const tokens = q.split(/\s+/).filter(Boolean);
    state.filtered = state.docs
      .filter(d => matchesQuickFilter(d, state.quickFilter))
      .filter(d => !els.area.value || d.programme_area === els.area.value)
      .filter(d => !els.type.value || d.record_category === els.type.value)
      .filter(d => !els.status.value || d.source_status === els.status.value)
      .filter(d => !els.priority.value || d.priority === els.priority.value)
      .filter(d => !tokens.length || tokens.every(t => d._search.includes(t)))
      .sort((a,b) => score(b, tokens) - score(a, tokens) || String(a.short_title || a.title).localeCompare(String(b.short_title || b.title)));
    renderResults();
  }

  function matchesQuickFilter(d, filter){
    const hay = `${d.short_title} ${d.title} ${d.record_category} ${d.programme_area} ${d.source_status} ${(d.keywords||[]).join(' ')}`.toLowerCase();
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
    const short = String(d.short_title || '').toLowerCase();
    const title = String(d.title || '').toLowerCase();
    const keyw = (d.keywords || []).join(' ').toLowerCase();
    let s = 0;
    tokens.forEach(t => { if (short.includes(t)) s += 16; if (title.includes(t)) s += 10; if (keyw.includes(t)) s += 5; if (String(d.record_category||'').toLowerCase().includes(t)) s += 3; if (String(d.programme_area||'').toLowerCase().includes(t)) s += 3; if (String(d.source_status||'').toLowerCase().includes(t)) s += 2; });
    return s;
  }

  function renderResults(){
    const visible = state.filtered.slice(0, state.visibleCount);
    els.resultCount.textContent = `${state.filtered.length} record${state.filtered.length === 1 ? '' : 's'} found`;
    if (!visible.length) els.results.innerHTML = `<div class="empty-state"><h3>No matching records found</h3><p>Try a broader search term or switch to All records.</p></div>`;
    else els.results.innerHTML = visible.map(renderRow).join('');
    els.loadMore.style.display = state.filtered.length > state.visibleCount ? 'inline-flex' : 'none';
    els.results.querySelectorAll('[data-read]').forEach(btn => btn.addEventListener('click', () => toggleReadMore(btn.dataset.read)));
    els.results.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => addToBasket(btn.dataset.add)));
    els.results.querySelectorAll('[data-request]').forEach(btn => btn.addEventListener('click', () => window.open(EMA_REQUEST_URL, '_blank', 'noopener')));
    els.results.querySelectorAll('[data-related-search]').forEach(btn => btn.addEventListener('click', () => { els.search.value = btn.dataset.relatedSearch; state.expanded.clear(); state.visibleCount=35; applyFilters(); window.scrollTo({top: document.querySelector('.search-panel').offsetTop - 8, behavior:'smooth'}); }));
  }

  function renderRow(d){
    const status = statusInfo(d); const url = getUrl(d); const year = d.year || '—'; const inBasket = state.basket.includes(d.id); const isOpen = state.expanded.has(d.id);
    const short = d.short_title || makeShortTitle(d.title || 'Untitled record');
    const full = cleanTitle(d.title || 'Untitled record');
    const showFull = full && full !== short;
    const openBtn = url ? `<a class="row-action open" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open</a>` : '';
    const requestBtn = isRequestRecord(d) ? `<button class="row-action request" type="button" data-request="${escapeAttr(d.id)}">Request</button>` : '';
    const addLabel = inBasket ? 'Added' : 'Add';
    return `<article class="result-row ${status.kind} ${isOpen ? 'is-expanded' : ''}" data-id="${escapeAttr(d.id)}">
      <div class="row-main">
        <div class="cell status"><span class="status-badge ${status.kind}">${escapeHtml(status.label)}</span></div>
        <div class="cell doc"><p class="doc-title">${highlight(short)}</p>${showFull ? `<p class="doc-full">${highlight(full)}</p>` : ''}<p class="doc-sub">${escapeHtml(d.id || '')}${d.priority ? ' · ' + escapeHtml(d.priority) + ' priority' : ''}</p></div>
        <div class="cell area">${escapeHtml(d.programme_area || '—')}</div>
        <div class="cell type">${escapeHtml(d.record_category || '—')}</div>
        <div class="cell year">${escapeHtml(String(year))}</div>
        <div class="cell actions">${openBtn}${requestBtn}<button class="row-action ${inBasket ? 'added' : ''}" type="button" data-add="${escapeAttr(d.id)}">${addLabel}</button><button class="row-action read-more" type="button" data-read="${escapeAttr(d.id)}" aria-expanded="${isOpen}">${isOpen ? 'Close' : 'Read more'}</button></div>
      </div>
      ${isOpen ? renderInlineDetails(d, status) : ''}
    </article>`;
  }

  function renderInlineDetails(d, status){
    const url = getUrl(d);
    const related = state.docs.filter(x => x.id !== d.id && x.programme_area === d.programme_area).slice(0,3);
    const keywords = (d.keywords || []).slice(0,12).map(k => `<span>${escapeHtml(k)}</span>`).join('') || '<span>No keywords listed</span>';
    const note = d.availability_note || d.notes || (isRequestRecord(d) ? STANDARD_REQUEST_NOTE : 'Use the listed access pathway and verify the document source before relying on it.');
    const action = isRequestRecord(d) ? 'Request this record through the EMA Information Centre, or add it to the request basket with other records.' : (url ? 'Open the public document or source page, or add it to the basket to export a document/link list.' : 'Review this record and request or verify the official copy.');
    return `<div class="inline-detail" aria-label="Additional information for ${escapeAttr(d.short_title || d.title)}">
      <div class="detail-grid">
        <section><h3>Access pathway</h3><p>${escapeHtml(d.source_label || accessText(d))}</p><p class="detail-note">${escapeHtml(note)}</p></section>
        <section><h3>Why included</h3><p>${escapeHtml(d.source_reliability || d.gazette_section || 'Referenced in the EMA document access register.')}</p><p><strong>Suggested action:</strong> ${escapeHtml(action)}</p></section>
      </div>
      <section><h3>Keywords</h3><div class="keyword-list">${keywords}</div></section>
      <section><h3>Related records</h3><div class="related-list inline">${related.length ? related.map(r => `<button class="related-item" type="button" data-related-search="${escapeAttr(r.short_title || r.title)}"><strong>${escapeHtml(r.short_title || r.title)}</strong><small>${escapeHtml(r.record_category || '')} · ${escapeHtml(statusInfo(r).label)}</small></button>`).join('') : '<p class="muted">No related records suggested.</p>'}</div></section>
    </div>`;
  }

  function toggleReadMore(id){
    if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
    renderResults();
    const row = document.querySelector(`[data-id="${cssEscape(id)}"]`);
    if (row) row.scrollIntoView({block:'nearest', behavior:'smooth'});
  }

  function addToBasket(id){ if (!state.basket.includes(id)) state.basket.push(id); saveBasket(); renderBasket(); renderResults(); }
  function removeFromBasket(id){ state.basket = state.basket.filter(x => x !== id); saveBasket(); renderBasket(); renderResults(); }
  function openBasketPanel(){ renderBasket(); els.basketPanel.classList.add('is-open'); els.basketPanel.setAttribute('aria-hidden','false'); }
  function closeBasketPanel(){ els.basketPanel.classList.remove('is-open'); els.basketPanel.setAttribute('aria-hidden','true'); }

  function renderBasket(){
    const records = getBasketRecords(); els.basketCountPill.textContent = records.length; els.generatedText.value = makeRequestText();
    if (!records.length) { els.basketItems.innerHTML = `<div class="empty-state"><p>No documents added yet. Search or filter for <strong>Held by EMA</strong> records, then add documents to prepare a request.</p></div>`; return; }
    els.basketItems.innerHTML = records.map(d => `<div class="basket-item ${hasPublicLink(d) ? 'public' : ''}"><div><strong>${escapeHtml(d.short_title || d.title)}</strong>${d.short_title && d.short_title !== d.title ? `<small>${escapeHtml(d.title)}</small>` : ''}<small>${escapeHtml(d.record_category || '')} · ${escapeHtml(d.programme_area || '')} · ${escapeHtml(statusInfo(d).label)}</small></div><button class="remove-item" type="button" aria-label="Remove ${escapeAttr(d.title)}" data-remove="${escapeAttr(d.id)}">×</button></div>`).join('');
    els.basketItems.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => removeFromBasket(btn.dataset.remove)));
  }

  function getBasketRecords(){ return state.basket.map(id => state.docs.find(d => d.id === id)).filter(Boolean); }
  function loadBasket(){ try { return JSON.parse(localStorage.getItem('emaRegisterBasket') || '[]'); } catch { return []; } }
  function saveBasket(){ localStorage.setItem('emaRegisterBasket', JSON.stringify(state.basket)); }

  function makeRequestText(){
    const records = getBasketRecords(); if (!records.length) return 'Add documents to the request basket to generate request text.';
    const requestRecords = records.filter(isRequestRecord); const publicRecords = records.filter(d => !isRequestRecord(d) && getUrl(d));
    const lines = ['Subject: Request for access to documents referenced in EMA’s Updated Public Statement 2024', '', 'I am requesting access to the following documents referenced in EMA’s Updated Public Statement 2024:', ''];
    const list = requestRecords.length ? requestRecords : records;
    list.forEach((d,i) => lines.push(`${i+1}. ${d.title}${d.year ? ' (' + d.year + ')' : ''}`));
    lines.push('', 'These records are listed as held by or accessible through EMA, but no public online copy is currently linked in this register. I am requesting guidance on availability and access through the EMA Information Centre.');
    if (publicRecords.length) { lines.push('', 'Public/source links also added to my document list:'); publicRecords.forEach((d,i) => lines.push(`${i+1}. ${d.title} — ${getUrl(d)}`)); }
    return lines.join('\\n');
  }
  async function copyRequestText(){ const txt = makeRequestText(); try { await navigator.clipboard.writeText(txt); els.copyRequestText.textContent = 'Copied'; setTimeout(() => els.copyRequestText.textContent = 'Copy request text', 1400); } catch { els.generatedText.select(); document.execCommand('copy'); } }
  function makeBasketCsv(){ return makeCsv(getBasketRecords()); }
  function makeCsv(records){ const headers = ['Short title','Document title','Document type','Knowledge area','Year','Source status','Access route','Public link','Request note','Evidence source','Keywords']; const rows = records.map(d => [d.short_title || d.title, d.title, d.record_category, d.programme_area, d.year || '', statusInfo(d).label, d.access_route || '', getUrl(d) || '', d.availability_note || d.notes || '', d.source_reliability || d.gazette_section || '', (d.keywords||[]).join('; ')]); return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n'); }
  function csvCell(v){ const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }
  function downloadFile(filename, content, type){ const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

  function statusInfo(d){ const s = String(d.source_status || '').toLowerCase(); if (isRequestRecord(d)) return {label:'Held by EMA', kind:'request'}; if (s.includes('ema source') || s.includes('source page') || s.includes('official ema')) return {label:'EMA Source Page', kind:'sourcepage'}; if (s.includes('external')) return {label: s.includes('citation') ? 'Externally Cited' : 'External Source', kind:'external'}; if (hasPublicLink(d)) return {label:'Public Link Found', kind:'public'}; return {label:d.source_status || 'Needs Verification', kind:'verify'}; }
  function hasPublicLink(d){ return Boolean(d.direct_url || d.source_url || d.has_direct_url || d.has_source_url) && !isRequestRecord(d); }
  function isRequestRecord(d){ return Boolean(d.has_request_pathway || d.source_type === 'ema_information_centre_request' || String(d.source_status||'').toLowerCase().includes('request required') || String(d.access_route||'').toLowerCase().includes('information centre')); }
  function getUrl(d){ return d.direct_url || d.source_url || ''; }
  function accessText(d){ if (isRequestRecord(d)) return 'Held by EMA. Request access through the EMA Information Centre.'; if (getUrl(d)) return 'Public link or source page available.'; return 'Needs verification before relying on this record.'; }

  function showLoadError(err){ els.resultCount.textContent = 'Database could not be loaded'; els.results.innerHTML = `<div class="empty-state"><h3>The database could not be loaded.</h3><p>${escapeHtml(err.message)}</p><p>For GitHub Pages, upload the full package to the repository root and keep <code>data/documents.json</code> in place.</p></div>`; }

  function makeShortTitle(title){ const t = cleanTitle(title); if (t.length <= 76) return t; return t.split(/[:.;]\s/)[0].slice(0,76).replace(/\s+\S*$/,'') + '…'; }
  function cleanTitle(v){ return String(v ?? '').replace(/\s+/g,' ').trim(); }
  function highlight(text){ const safe = escapeHtml(text); const q = state.lastQuery.trim(); if (!q) return safe; const tokens = q.split(/\s+/).filter(t => t.length > 1).slice(0,5).map(escapeRegExp); if (!tokens.length) return safe; return safe.replace(new RegExp(`(${tokens.join('|')})`,'ig'), '<mark>$1</mark>'); }
  function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cssEscape(v){ if (window.CSS && CSS.escape) return CSS.escape(v); return String(v).replace(/"/g,'\\"'); }
  function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function escapeAttr(v){ return escapeHtml(v); }
  function debounce(fn, ms){ let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
})();