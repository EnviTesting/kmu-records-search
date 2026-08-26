# EMA Document Search Tool

Static GitHub Pages prototype for discovering EMA records and selected related environmental information about Trinidad and Tobago.

**Application version:** 7.3.0  
**Data version:** 2026.08.26.1  
**Design anchor:** v6.12.0  
**Knowledge records:** 654  
**EMA in the News records:** 785  
**Dataset catalogue entries:** 64

## Design strategy

v7.3 is intentionally **not a visual redesign**. The user-facing shell, search flow, dense result-table presentation, Knowledge Insights layout, Spatial Discovery map/calendar layout, responsive behaviour and institutional styling are carried forward from v6.12. The v7 series primarily upgrades the **data, classifications, source coverage and relationships**.

The deliberate visible exception is **My List**: the compact v7 right-side implementation is retained because it is less intrusive and works across the tools.

## Pages

- `index.html` — main v6.12-style search experience
- `insights.html` — Knowledge Insights using 13 controlled Knowledge Areas and 10 simplified Record Types
- `preview.html` — **Spatial Discovery**, retaining the v6.12 map + environmental calendar presentation
- `news.html` — **EMA in the News**, using the public-safe external media archive
- `datasets.html` — Dataset Discovery, styled within the v6.12 visual language

There is **no Environmental Intelligence / live-news page** in this release.

## Canonical knowledge record sets

| Record set | File | Records |
|---|---|---:|
| EMA Document Access Register | `data/documents.json` | 279 |
| Judgments & Proceedings | `data/judgments.json` | 30 |
| EMA News & Events | `data/press_releases.json` | 108 |
| Government policy/agencies | `data/external_references.json` | 49 |
| Parliamentary Evidence | `data/parliamentary_evidence.json` | 35 |
| Government Gazette & Legal Notices | `data/gazette_records.json` | 15 |
| Research & Statistical Context | `data/statistical_context.json` | 42 |
| Regional Environmental Sources | `data/regional_references.json` | 21 |
| International — Trinidad & Tobago only | `data/international_references.json` | 43 |
| Environmental Video | `data/videos.json` | 32 |
| **Total** |  | **654** |

`data/master_list.json`, `data/master_list_v7.json`, `data/master_list.csv` and `data/search_index.json` are full derived union exports. This release does **not** use a 72-record demo fallback.

## Controlled classification

The original programme-area and record-type values are preserved on records for provenance, but user-facing filtering uses:

- **13 Knowledge Areas** in `data/taxonomy.json`
- **10 simplified Record Types** in `data/taxonomy.json`

This prevents the Knowledge Insights page and search filters from exposing the previous ~205 programme-area variants as separate user-facing categories.

## EMA in the News

`data/ema_in_news.json` contains **785 searchable headline records** covering **11 December 2025 to 24 July 2026**.

Public media handling in this release:

- archived clipping / OCR-only records are excluded;
- EMA Unit mappings are not exported into the public media dataset;
- manager actions, provisional EMA roles and responsibility mappings are not exported;
- article links, supporting links and unavailable links are distinguished;
- media records are not part of the main knowledge master;
- media records can appear in Spatial Discovery only when the **Show media articles** switch is enabled;
- the media layer is **OFF by default** and does not change the knowledge-record coverage counts.

## Videos and official EMA YouTube

`data/videos.json` is the canonical searchable video database and ships with the **32 verified video records from v6.12**. These records are searched by the main tool when related sources are enabled or the Videos quick filter is selected.

`data/youtube_videos.json` is a non-empty 32-record channel/inventory snapshot rather than an empty placeholder. The official EMA channel configuration is stored in `data/youtube_channel.json`:

- Channel ID: `UCNijSNnsG3RHDWVC8-LIC8g`
- Uploads playlist: `UUNijSNnsG3RHDWVC8-LIC8g`

`tools/harvest_youtube.py` and `.github/workflows/harvest-youtube.yml` can enumerate additional public uploads through the YouTube Data API when `YOUTUBE_API_KEY` is configured in GitHub Secrets. New uploads are merged directly into `data/videos.json` and deduplicated by YouTube video ID.

## Dataset Discovery

`data/dataset_catalog.json` contains **64 entries**, drawing from:

- the 42-record Research & Statistical Context collection;
- dataset/register records in national, regional and international sources;
- selected bundled official/contextual spreadsheets supplied for the prototype.

The catalogue separates source agency from host agency and distinguishes structured datasets from data-bearing publications/surveys.

Bundled reference spreadsheets are under `data/datasets/`.

## Spatial Discovery

Spatial Discovery preserves the v6.12 map/calendar design.

It includes:

- Leaflet + OpenStreetMap when available;
- the actual local Trinidad and Tobago ADM1 GeoJSON at `data/tt_adm1_fallback.geojson`;
- local boundary rendering when the basemap/Leaflet is unavailable;
- 12 curated discovery places;
- administrative-area information-coverage shading based on explicit indexed place terms;
- optional media article overlay, off by default;
- the 22-observance EMA-guided environmental calendar.

The GeoJSON is the production browser boundary asset. Raw shapefile components are intentionally not required by GitHub Pages.

Map density, counts and shading indicate **information coverage only**. They do not indicate environmental condition, risk, project boundaries, regulatory jurisdiction, compliance status or an EMA determination.

## Source model

The main search remains EMA-centred. Related sources can be opted into and include:

- Government / national sources
- Parliament
- Gazette
- Research & statistics
- **Regional environmental sources** — including selected CANARI, CARICOM, CCREEE, CARPHA, CCCCC, UNEP Caribbean Environment Programme, BCRC-Caribbean, CDEMA, CRFM, CDB and comparative OECS material
- International records with distinct Trinidad and Tobago scope
- Video

Regional-comparative material such as OECS outputs is labelled so it is not implied to apply formally to Trinidad and Tobago.

## Quality-of-life additions retained within the v6.12 shell

- compact persistent **My List** on the right;
- copy / CSV / JSON / email actions from My List;
- quoted phrase search;
- `/` keyboard shortcut to focus search;
- shareable search/filter URL state;
- Datasets quick filter;
- regional source filter;
- simplified user-facing Knowledge Area and Record Type filters;
- clear online / Information Centre request / reference / link-review access pathways;
- readable short titles with full bibliographic titles retained in record details.

## Product safeguards

This is an information-discovery prototype. Descriptions, classifications, media categories, search-term expansion, map associations and related-record suggestions help users locate sources. They do **not** provide legal advice, determine legal effect or applicability, establish regulatory jurisdiction or compliance status, or represent an EMA determination.

Users should review the original published source and applicable EMA process before formal reliance.

## GitHub Pages deployment

Upload the contents of this folder to the repository root and preserve the directory structure. No framework or application server is required.

Recommended layout:

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

Enable GitHub Pages from the repository branch/root you want to publish.

## Updating the knowledge base

After editing canonical JSON files:

```bash
python tools/build_master_list.py
python tools/build_related_index.py
python tools/validate_data.py
python tools/validate_relationships.py
python tools/audit_knowledge_base.py
node --check assets/app.js
node --check assets/insights.js
node --check assets/preview.js
node --check assets/news.js
node --check assets/datasets.js
node --check assets/mylist.js
```

The included GitHub Actions workflow performs core validation on pushes and pull requests.

## Important maintenance principle

The **v6.12 interface is the preferred formatting strategy**. Future v7-series work should normally change the data, source coverage, metadata, indexing and relationships without replacing the established interface unless there is a specific approved usability reason.
