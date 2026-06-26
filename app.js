const state = {
  docs: [],
  filtered: [],
  summary: null,
  renderLimit: window.matchMedia("(max-width: 640px)").matches ? 40 : 120,
  baseRenderLimit: window.matchMedia("(max-width: 640px)").matches ? 40 : 120
};

const byId = id => document.getElementById(id);
const norm = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const requestText = doc => `I am requesting access to the following document referenced in EMA's Updated Public Statement 2024: ${doc.title}. Please advise on availability and the process for access through the EMA Information Centre.`;

Promise.all([
  fetch("data/documents.json").then(r => r.json()),
  fetch("data/summary.json").then(r => r.json())
]).then(([docs, summary]) => {
  state.docs = docs;
  state.summary = summary;
  hydrateFilters(docs);
  renderSummary(summary, docs);
  applyFilters();
  registerServiceWorker();
}).catch(error => {
  byId("summaryCard").textContent = "The database could not be loaded. Check that data/documents.json is available.";
  console.error(error);
});

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
  byId("requestOnlyBtn").addEventListener("click", () => quickFilter({ linkFilter: "request" }));
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
    <small>Generated ${summary.generated_at}</small>
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
    const haystack = norm([doc.title, doc.search_text, doc.programme_area, doc.record_category, doc.source_status, ...(doc.keywords || [])].join(" "));
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
    node.querySelector(".record-id").textContent = doc.id;
    const priority = node.querySelector(".priority");
    priority.textContent = doc.priority || "Unprioritised";
    priority.classList.add(norm(doc.priority || "low"));
    const linkState = node.querySelector(".link-state");
    linkState.textContent = doc.has_direct_url ? "Direct link" : doc.has_source_url ? "Source page" : doc.has_request_pathway ? "EMA request pathway" : "No link yet";
    if (!doc.has_direct_url && !doc.has_source_url && !doc.has_source_pathway) linkState.classList.add("missing");
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
      actions.appendChild(requestBadge(doc.source_label || "Held by EMA. Request access through the EMA Information Centre."));
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
  const span = document.createElement("span");
  span.className = "request-badge";
  span.textContent = label;
  return span;
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
  const buttons = ["showAllBtn", "publicOnlyBtn", "requestOnlyBtn", "highPriorityBtn"].map(byId);
  buttons.forEach(button => button.classList.remove("active"));
  if (byId("linkFilter").value === "direct") byId("publicOnlyBtn").classList.add("active");
  else if (byId("linkFilter").value === "request") byId("requestOnlyBtn").classList.add("active");
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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    // GitHub Pages can still run the app without offline caching.
  });
}
