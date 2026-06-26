const state = {
  docs: [],
  filtered: [],
  summary: null,
  renderLimit: window.matchMedia("(max-width: 640px)").matches ? 40 : 120,
  baseRenderLimit: window.matchMedia("(max-width: 640px)").matches ? 40 : 120,
  loadDiagnostics: []
};

const DOCUMENT_PATHS = [
  "data/documents.json",
  "./data/documents.json",
  "documents.json",
  "./documents.json",
  "EMA_KM_documents_searchable.json",
  "./EMA_KM_documents_searchable.json",
  "data/EMA_KM_documents_searchable.json",
  "./data/EMA_KM_documents_searchable.json"
];

const SUMMARY_PATHS = [
  "data/summary.json",
  "./data/summary.json",
  "summary.json",
  "./summary.json"
];

const REQUEST_LABEL = "Held by EMA. Request access through the EMA Information Centre.";
const REQUEST_NOTE = "This document is referenced in EMA’s Updated Public Statement 2024 and should be held by or accessible through EMA. No public online copy is currently linked in this register. Request access through the EMA Information Centre.";
const INFO_CENTRE_REQUEST_URL = "https://www.ema.co.tt/information-centre-general-request/";

const byId = id => document.getElementById(id);
const norm = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const requestText = doc => `I am requesting access to the following document referenced in EMA's Updated Public Statement 2024: ${doc.title}. Please advise on availability and the process for access through the EMA Information Centre.`;

init();

async function init() {
  try {
    const rawDocs = await loadFirstJson(DOCUMENT_PATHS, true);
    const docs = normaliseDocumentPayload(rawDocs).map(normaliseRecord);
    if (!docs.length) throw new Error("Document JSON loaded, but contained no document records.");

    const summary = await loadFirstJson(SUMMARY_PATHS, false).catch(() => buildSummary(docs));
    state.docs = docs;
    state.summary = normaliseSummary(summary, docs);

    hydrateFilters(docs);
    renderSummary(state.summary, docs);
    applyFilters();
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    renderLoadError(error);
  }
}

async function loadFirstJson(paths, required) {
  const attempts = [];
  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      attempts.push(`${path}: HTTP ${response.status}`);
      if (!response.ok) continue;
      const data = await response.json();
      state.loadDiagnostics.push(`Loaded ${path}`);
      return data;
    } catch (error) {
      attempts.push(`${path}: ${error.message}`);
    }
  }
  if (!required) throw new Error(`Optional JSON not found. Tried: ${attempts.join(" | ")}`);
  throw new Error(`Database JSON not found or could not be parsed. Tried: ${attempts.join(" | ")}`);
}

function normaliseDocumentPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.documents)) return payload.documents;
  if (payload && Array.isArray(payload.records)) return payload.records;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function normaliseRecord(doc) {
  const hasDirectUrl = Boolean(doc.direct_url || doc.has_direct_url);
  const hasSourceUrl = Boolean(doc.source_url || doc.has_source_url);
  const hasAnyUrl = hasDirectUrl || hasSourceUrl;
  const internalHint = Boolean(doc.is_internal_ema_record) || /internal|policy|manual|procedure|sop|audit|valuation|human resource|procurement|hse|qms|quality management/i.test([doc.record_category, doc.title, doc.notes, doc.source_status].join(" "));
  const requestPathway = Boolean(doc.has_request_pathway) || Boolean(doc.source_placeholder === "EMA_INFORMATION_CENTRE_REQUEST") || (!hasAnyUrl) || internalHint;

  return {
    ...doc,
    has_direct_url: hasDirectUrl,
    has_source_url: hasSourceUrl,
    has_source_pathway: Boolean(doc.has_source_pathway) || hasSourceUrl || requestPathway,
    has_request_pathway: requestPathway,
    source_type: doc.source_type || (requestPathway ? "ema_information_centre_request" : hasDirectUrl ? "public_direct_link" : hasSourceUrl ? "source_page" : "unknown"),
    source_label: doc.source_label || (requestPathway ? REQUEST_LABEL : ""),
    source_placeholder: doc.source_placeholder || (requestPathway ? "EMA_INFORMATION_CENTRE_REQUEST" : ""),
    availability_note: doc.availability_note || (requestPathway ? REQUEST_NOTE : ""),
    access_route: doc.access_route || (requestPathway ? "EMA Information Centre" : "Public web link"),
    source_status: doc.source_status || (requestPathway ? "Held by EMA - Request Required" : "Public Link Found")
  };
}

function buildSummary(docs) {
  return {
    generated_at: new Date().toISOString().slice(0, 10),
    record_count: docs.length,
    source_access_note: REQUEST_NOTE,
    request_pathway_label: REQUEST_LABEL,
    request_pathway_note: REQUEST_NOTE
  };
}

function normaliseSummary(summary, docs) {
  return {
    generated_at: summary.generated_at || new Date().toISOString().slice(0, 10),
    record_count: summary.record_count || docs.length,
    source_access_note: summary.source_access_note || REQUEST_NOTE,
    request_pathway_label: summary.request_pathway_label || REQUEST_LABEL,
    request_pathway_note: summary.request_pathway_note || REQUEST_NOTE,
    ...summary
  };
}

function renderLoadError(error) {
  const summaryCard = byId("summaryCard");
  const diagnostics = state.loadDiagnostics.length ? state.loadDiagnostics.join("; ") : error.message;
  summaryCard.innerHTML = `
    <div class="load-error">
      <strong>The database could not be loaded.</strong>
      <p>Upload the full repository structure, including the <code>data</code> folder, or place <code>EMA_KM_documents_searchable.json</code> in the repository root. GitHub Pages file paths are case-sensitive.</p>
      <details>
        <summary>Technical details</summary>
        <pre>${escapeHtml(diagnostics)}</pre>
      </details>
    </div>
  `;
}

function hydrateFilters(docs) {
  const fields = [
    ["programmeFilter", "programme_area"],
    ["categoryFilter", "record_category"],
    ["statusFilter", "source_status"],
    ["priorityFilter", "priority"]
  ];
  for (const [selectId, field] of fields) {
    const select = byId(selectId);
    [...new Set(docs.map(d => d[field]).filter(Boolean))].sort().forEach(value => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
  }

  byId("searchBox").addEventListener("input", debounce(() => {
    state.renderLimit = state.baseRenderLimit;
    applyFilters();
  }, 120));

  ["programmeFilter", "categoryFilter", "statusFilter", "priorityFilter", "linkFilter"].forEach(id => {
    byId(id).addEventListener("change", () => {
      state.renderLimit = state.baseRenderLimit;
      updateQuickFilterState();
      applyFilters();
    });
  });

  byId("filterToggle").addEventListener("click", toggleFilters);
  byId("clearBtn").addEventListener("click", clearFilters);
  byId("downloadBtn").addEventListener("click", downloadFilteredJson);
  byId("loadMoreBtn").addEventListener("click", loadMoreResults);

  byId("showAllBtn").addEventListener("click", () => {
    clearFilters(false);
    applyFilters();
  });
  byId("publicOnlyBtn").addEventListener("click", () => quickFilter({ linkFilter: "direct" }));
  byId("highPriorityBtn").addEventListener("click", () => quickFilter({ priorityFilter: "High" }));
}

function renderSummary(summary, docs) {
  const direct = docs.filter(d => d.has_direct_url).length;
  const request = docs.filter(d => d.has_request_pathway).length;
  const external = docs.filter(d => norm(d.source_type).includes("external")).length;
  byId("summaryCard").innerHTML = `
    <div class="summary-grid">
      <div><strong>${summary.record_count}</strong><span>records</span></div>
      <div><strong>${direct}</strong><span>direct links</span></div>
      <div><strong>${request}</strong><span>EMA requests</span></div>
      <div><strong>${external}</strong><span>external sources</span></div>
    </div>
    <small>Generated ${escapeHtml(summary.generated_at)} • ${escapeHtml(state.loadDiagnostics.join("; "))}</small>
  `;
}

function applyFilters() {
  const q = norm(byId("searchBox").value).trim();
  const terms = q.split(/\s+/).filter(Boolean);
  const programme = byId("programmeFilter").value;
  const category = byId("categoryFilter").value;
  const status = byId("statusFilter").value;
  const priority = byId("priorityFilter").value;
  const links = byId("linkFilter").value;

  state.filtered = state.docs.filter(doc => {
    if (programme && doc.programme_area !== programme) return false;
    if (category && doc.record_category !== category) return false;
    if (status && doc.source_status !== status) return false;
    if (priority && doc.priority !== priority) return false;
    if (links === "direct" && !doc.has_direct_url) return false;
    if (links === "source" && !(doc.has_source_url || doc.has_source_pathway)) return false;
    if (links === "request" && !doc.has_request_pathway) return false;
    if (links === "missing" && (doc.has_direct_url || doc.has_source_url || doc.has_source_pathway)) return false;
    if (!terms.length) return true;
    const haystack = norm([doc.title, doc.search_text, doc.programme_area, doc.record_category, doc.source_status, doc.source_label, doc.availability_note, ...(doc.keywords || [])].join(" "));
    return terms.every(term => haystack.includes(term));
  });
  renderResults(state.filtered, terms);
}

function renderResults(docs, terms) {
  const shown = Math.min(docs.length, state.renderLimit);
  byId("resultCount").textContent = `${docs.length} result${docs.length === 1 ? "" : "s"}${docs.length > shown ? ` • showing ${shown}` : ""}`;
  byId("activeTerms").textContent = terms.length ? `Matching: ${terms.join(", ")}` : "Showing all records";
  const results = byId("results");
  const template = byId("resultTemplate");
  results.innerHTML = "";

  docs.slice(0, shown).forEach(doc => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".result-card");
    if (doc.has_direct_url) card.classList.add("has-direct");
    else if (doc.has_source_url) card.classList.add("has-source");
    else if (doc.has_request_pathway) card.classList.add("has-request");
    else card.classList.add("needs-review");
    node.querySelector(".record-id").textContent = doc.id;
    const priority = node.querySelector(".priority");
    priority.textContent = doc.priority || "Unprioritised";
    priority.classList.add(norm(doc.priority || "low"));
    const linkState = node.querySelector(".link-state");
    linkState.textContent = doc.has_direct_url ? "Direct link" : doc.has_source_url ? "Source page" : doc.has_request_pathway ? "EMA request pathway" : "No link yet";
    if (doc.has_direct_url) linkState.classList.add("direct");
    else if (doc.has_source_url) linkState.classList.add("source");
    else if (!doc.has_source_pathway) linkState.classList.add("missing");
    if (doc.has_request_pathway) linkState.classList.add("request");
    node.querySelector("h2").textContent = doc.title;
    node.querySelector(".meta-line").textContent = [doc.programme_area, doc.record_category, doc.year].filter(Boolean).join(" • ");
    node.querySelector(".km-value").textContent = doc.km_value || "No KM value note recorded.";

    const keywordCloud = node.querySelector(".keyword-cloud");
    (doc.keywords || []).forEach(keyword => {
      const span = document.createElement("span");
      span.textContent = keyword;
      keywordCloud.appendChild(span);
    });

    const meta = node.querySelector(".metadata");
    addMeta(meta, "Section", doc.gazette_section);
    addMeta(meta, "Status", doc.source_status);
    addMeta(meta, "Access route", doc.access_route);
    addMeta(meta, "Source pathway", doc.source_label);
    addMeta(meta, "Availability", doc.availability_note);
    addMeta(meta, "Reliability", doc.source_reliability);
    addMeta(meta, "Custodian", doc.custodian_or_owner);
    addMeta(meta, "Action", doc.action_needed);
    addMeta(meta, "Notes", doc.notes);

    const actions = node.querySelector(".card-actions");
    if (doc.direct_url) actions.appendChild(link("Open document", doc.direct_url));
    if (doc.source_url) actions.appendChild(link("Open source page", doc.source_url));
    if (doc.has_request_pathway) {
      actions.appendChild(requestBadge("Open EMA request page"));
      actions.appendChild(copyButton(doc));
    }
    results.appendChild(node);
  });

  const loadMore = byId("loadMoreBtn");
  loadMore.hidden = docs.length <= shown;
  loadMore.textContent = `Load more results (${docs.length - shown} remaining)`;
}

function addMeta(dl, label, value) {
  if (!value) return;
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = value;
  dl.append(dt, dd);
}

function link(label, href) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = label;
  return a;
}

function requestBadge(label) {
  const a = document.createElement("a");
  a.className = "request-badge";
  a.href = INFO_CENTRE_REQUEST_URL;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = label;
  return a;
}

function copyButton(doc) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-request";
  button.textContent = "Copy request text";
  button.addEventListener("click", async () => {
    const text = requestText(doc);
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      setTimeout(() => button.textContent = "Copy request text", 1400);
    } catch {
      window.prompt("Copy request text:", text);
    }
  });
  return button;
}

function toggleFilters() {
  const panel = byId("filterPanel");
  const button = byId("filterToggle");
  const open = !panel.classList.contains("is-open");
  panel.classList.toggle("is-open", open);
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Hide filters" : "Filters";
}

function quickFilter(values) {
  ["programmeFilter", "categoryFilter", "statusFilter", "priorityFilter", "linkFilter"].forEach(id => byId(id).value = "");
  Object.entries(values).forEach(([id, value]) => byId(id).value = value);
  state.renderLimit = state.baseRenderLimit;
  updateQuickFilterState();
  applyFilters();
}

function updateQuickFilterState() {
  const buttons = ["showAllBtn", "publicOnlyBtn", "highPriorityBtn"].map(byId);
  buttons.forEach(button => button.classList.remove("active"));
  if (byId("linkFilter").value === "direct") byId("publicOnlyBtn").classList.add("active");
  else if (byId("priorityFilter").value === "High") byId("highPriorityBtn").classList.add("active");
  else byId("showAllBtn").classList.add("active");
}

function clearFilters(shouldApply = true) {
  ["searchBox", "programmeFilter", "categoryFilter", "statusFilter", "priorityFilter", "linkFilter"].forEach(id => byId(id).value = "");
  state.renderLimit = state.baseRenderLimit;
  updateQuickFilterState();
  if (shouldApply) applyFilters();
}

function loadMoreResults() {
  state.renderLimit += state.baseRenderLimit;
  renderResults(state.filtered, norm(byId("searchBox").value).trim().split(/\s+/).filter(Boolean));
}

function downloadFilteredJson() {
  const blob = new Blob([JSON.stringify(state.filtered, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ema-km-filtered-results.json";
  a.click();
  URL.revokeObjectURL(url);
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    // GitHub Pages can still run the app without offline caching.
  });
}
