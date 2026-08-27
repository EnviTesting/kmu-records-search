# TRACE

**Environmental Information Discovery Platform** — a static GitHub Pages prototype centred on Environmental Management Authority (EMA) records and selected related environmental information for Trinidad and Tobago.

**Application version:** 8.0.0  
**Data version:** 2026.08.27.4  
**Design anchor:** v7.3.0 / v6.12 visual language  
**Searchable knowledge records:** 931  
**EMA in the News:** 701 story parents / 785 selectable articles / 963 source options  
**Dataset Discovery:** 68 entries  
**AAQMN:** 9 station/host-site points

## Release approach

TRACE v8.0 deliberately preserves the v7.3 structure, interaction model and institutional styling rather than redesigning the application. The upgrade expands the knowledge base, repairs and restructures the News page, adds controlled spatial-discovery layers, improves source/access handling and adds maintainable refresh tooling.

There is **no AI search in this release**. Keyword/search-index retrieval remains the production discovery method.

## Pages

- `index.html` — primary keyword and filtered record discovery.
- `insights.html` — Knowledge Insights across controlled Knowledge Areas and Record Types; the related/external-source toggle is preserved.
- `preview.html` — Spatial Discovery and environmental calendar.
- `news.html` — EMA in the News using story parents with selectable article children.
- `datasets.html` — Dataset Discovery catalogue.

## Canonical knowledge record sets

| Record set | File | Records |
|---|---|---:|
| EMA Document Access Register | `data/documents.json` | 282 |
| EMA News & Events | `data/press_releases.json` | 108 |
| Judgments & Proceedings | `data/judgments.json` | 30 |
| External / government / institutional references | `data/external_references.json` | 300 |
| Parliamentary Evidence | `data/parliamentary_evidence.json` | 35 |
| Government Gazette & Legal Notices | `data/gazette_records.json` | 15 |
| Research & Statistical Context | `data/statistical_context.json` | 65 |
| Regional Environmental Sources | `data/regional_references.json` | 21 |
| International — Trinidad & Tobago-specific | `data/international_references.json` | 43 |
| Environmental Video | `data/videos.json` | 32 |
| **Total** |  | **931** |

`data/master_list.json`, `data/master_list.csv` and `data/search_index.json` are derived from those canonical sets. `data/related_index.json` is also generated and provides discovery-only related-record suggestions.

## Source and access model

TRACE remains EMA-centred. Related records are opt-in in the main search and are visibly attributed to their issuing source. Important access states are:

- `open_online` — an authoritative/public source can be opened.
- `request_ema` — an EMA Information Centre/request pathway is indexed.
- `request_ima` — an IMA-held record is identified but a public file is not available; use **Request from the IMA** / the IMA Library.
- `reference_only` — the record is confirmed for discovery, but no direct request pathway/file is asserted.
- `link_review` — a stored link requires review.

IMA records retain Institute of Marine Affairs attribution. IMA Library: <https://www.ima.gov.tt/library/>.

## EMA in the News

The media archive is intentionally separate from the 931-record knowledge master:

- `data/ema_news_stories.json` — 701 conservative story parents.
- `data/ema_in_news.json` — 785 selectable article children.
- `data/ema_news_sources.json` — 963 article/source options.

The dashboard uses **story-level counts for topics** and **article-level counts for publishers**. Publisher variants such as `103.1FM` / `103.1 FM` are normalised. Story parents preserve all available child articles instead of treating each URL as a separate environmental event.

News/media frequency is not an EMA finding of environmental incidence, severity, causation, compliance or risk.

## Spatial Discovery

Spatial Discovery remains an information-association tool rather than a general GIS application.

- Existing knowledge-record proportional circles remain teal.
- Media, when enabled, is shown with a separate amber proportional ring.
- The media layer is **off by default**.
- The 9 AAQMN stations are **off by default** and retain coordinate-verification status.
- Three IMA Marine Data Hub layers are available but **only one can be selected at a time**:
  - Caroni River Basin phase-1 water-quality sampling stations (1984)
  - Wetland locations
  - Oil and gas blocks in Trinidad and Tobago waters
- IMA layer IDs are discovered at runtime; the app does not assume `FeatureServer/0`.
- The browser attempts the live IMA REST layer first, then a GitHub-cached GeoJSON snapshot if present.
- The local Trinidad and Tobago ADM1 GeoJSON remains the map-boundary fallback.

Map density, locations and associations support discovery only; they do not represent regulatory jurisdiction, legal boundaries, environmental condition, hazard extent or an EMA determination.

## Dataset Discovery

`data/dataset_catalog.json` contains 68 entries. It distinguishes source agency, host agency, access status and dataset/data-bearing-publication type. Bundled reference spreadsheets are stored under `data/datasets/`.

## Search

Keyword search remains the primary retrieval method. `data/search_terms.json` contains 50 controlled concepts/synonym groups, including newer terms for IMA, AAQMN, marine/coastal issues, oil and gas blocks, ODPM, Social Development, CSO environmental compendia and related national terminology.

## Scheduled refreshes

### EMA / IMA press-release candidates and IMA spatial cache

`.github/workflows/refresh-source-candidates.yml` runs weekly or manually. It:

1. harvests **candidate** EMA and IMA press-release URLs into `data/candidates/`;
2. does **not** automatically insert those candidates into canonical record sets;
3. refreshes optional IMA GeoJSON caches in `data/spatial_cache/` when the Marine Data Hub is reachable;
4. preserves existing caches/candidates if an upstream service is unavailable;
5. rebuilds and validates canonical TRACE data before committing candidate/cache changes.

This conservative review step prevents a website-layout change from silently corrupting the public knowledge base.

### Official EMA YouTube

The existing `tools/harvest_youtube.py` / `.github/workflows/harvest-youtube.yml` workflow is retained. It requires `YOUTUBE_API_KEY` in GitHub Secrets. No AI/API model key is required by TRACE.

## Updating canonical records

After editing canonical JSON:

```bash
python tools/build_master_list.py
python tools/build_related_index.py
python tools/validate_data.py
python tools/validate_relationships.py
python tools/audit_knowledge_base.py
```

A release should not be published with open High/Medium automated audit findings.

## GitHub Pages deployment

Upload the contents of this folder to the repository root and preserve the directory structure. No framework or application server is required.

```text
.github/workflows/
.nojekyll
index.html
insights.html
preview.html
news.html
datasets.html
assets/
data/
docs/
tools/
README.md
CHANGELOG.md
VERSION.json
manifest.webmanifest
LICENSE
LICENSE-DATA
NOTICE
```

Enable GitHub Pages for the selected branch/root. Because the app uses `fetch()` for local JSON, test it through GitHub Pages or a local HTTP server rather than opening `index.html` directly with `file://`.

## Product safeguards

TRACE is an information-discovery prototype. Descriptions, classifications, keyword expansion, media groupings, maps and related-record suggestions help users locate sources. They do **not** provide legal advice, determine legal effect/applicability, establish regulatory jurisdiction or compliance status, or represent an EMA determination. Review the original authoritative source and applicable EMA process before formal reliance.
