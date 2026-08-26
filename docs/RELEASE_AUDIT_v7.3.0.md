# Release Audit — v7.3.0

**Release date:** 26 August 2026  
**Application version:** 7.3.0  
**Data version:** 2026.08.26.1  
**Design anchor:** v6.12.0

## Release intent

v7.3 corrects the earlier v7 packaging/design drift. The release is built directly from the uploaded v6.12 GitHub package, retaining its presentation and core interaction model while upgrading the underlying information architecture and databases. The compact v7 My List is intentionally retained.

## Database reconciliation

| Collection | Records |
|---|---:|
| EMA Document Access Register | 279 |
| Judgments & Proceedings | 30 |
| EMA News & Events | 108 |
| Government policy/agencies | 49 |
| Parliamentary Evidence | 35 |
| Government Gazette & Legal Notices | 15 |
| Research & Statistical Context | 42 |
| Regional Environmental Sources | 21 |
| International — Trinidad & Tobago only | 43 |
| Environmental Video | 32 |
| **Knowledge master** | **654** |

Supplementary databases:

- `ema_in_news.json`: **785** public-safe external media headline records
- `dataset_catalog.json`: **64** dataset/data-source entries
- `youtube_videos.json`: **32** real seeded video records, not an empty placeholder
- `spatial_preview.json`: **12** curated discovery places
- `environmental_observances.json`: **22** EMA-guided dates
- `tt_adm1_fallback.geojson`: **15-feature** Trinidad & Tobago ADM1 browser boundary layer

## Issues addressed

### Interface drift

**Resolved.** v6.12 HTML/CSS/interaction files are the baseline. v7.3 does not use the separate v7 card/dashboard design system.

### My List

**Retained from v7.** The compact persistent right-side implementation replaces the larger v6 drawer/dock while using the established search/results presentation around it.

### Partial main database

**Resolved.** No 72-record demo fallback is used. The package ships a complete 654-record master and all canonical source files.

### YouTube database was effectively empty

**Resolved for shipped records.** The 32 verified v6.12 video records are restored as the canonical searchable `videos.json`. `youtube_videos.json` is also populated with a real 32-record inventory snapshot. The optional official-channel harvester merges additional public uploads into `videos.json` when a YouTube API key is configured.

### EMA in the News was empty

**Resolved.** The page is populated from the supplied public-safe media archive. It contains 785 headline records, excludes 173 archived clipping/OCR-only records, and excludes EMA Unit/manager-analysis fields.

### Media and Spatial Discovery

**Resolved.** Media is not mapped by default. `Show media articles` is OFF at load. When enabled, media is shown only against curated places when the media record's explicit geography matches that place. Media does not alter the base knowledge-record coverage count or administrative shading.

### Dataset Discovery was too small

**Resolved.** The generated catalogue contains 64 entries and includes existing Research & Statistical Context material, dataset-type regional/international records and bundled structured spreadsheets.

### Trinidad & Tobago boundary asset omitted

**Resolved.** `data/tt_adm1_fallback.geojson` from the v6.12 package is included and remains the canonical GitHub/browser boundary asset. Raw shapefile components are not required by the deployed application.

### Overly granular classification

**Resolved at the user-facing layer.** Every canonical record now carries a controlled `knowledge_area` and `record_type_simplified`, while the original `programme_area`/record-type fields are retained for provenance. `groups.json` now resolves to 13 controlled Knowledge Areas rather than ~205 user-facing categories.

### Regional source gap

**Improved.** A separate 21-record Regional Environmental Sources collection includes selected CANARI, CARICOM, CCREEE, CARPHA, CCCCC, UNEP Caribbean Environment Programme, BCRC-Caribbean, CDEMA, CRFM, CDB, World Bank Caribbean and comparative OECS material. Broader regional material is not mislabelled as T&T-only international content.

### Environmental Intelligence prototype

**Removed**, as requested.

## Validation completed

- Canonical JSON validation: **PASS — 654 records**
- Cross-set ID reconciliation: **PASS**
- Curated/related relationship validation: **PASS — 25 curated relationships**
- Knowledge Insights hooks: **PASS**
- Spatial Discovery hooks and 22-date calendar: **PASS**
- EMA in the News dataset hook: **PASS**
- JavaScript syntax checks: **PASS**
- Local HTTP load test: **PASS — all five public pages plus master/media/video/GeoJSON assets returned HTTP 200**
- Audit result: no high/medium integrity findings; one informational note that the latest captured official EMA News & Events item is 18 August 2026 while this data release is dated 26 August 2026.

## Safeguards retained

Counts, classifications, map relationships and media categories are information-discovery aids. They do not indicate environmental condition, risk, legal effect, jurisdiction, compliance status, EMA responsibility or an EMA determination. Formal reliance should be placed on the original authoritative source and applicable EMA process.
