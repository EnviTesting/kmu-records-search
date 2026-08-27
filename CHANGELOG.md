# Changelog

## v8.0.0 — 27 August 2026

- Renamed the working platform **TRACE — Environmental Information Discovery Platform** while retaining the v7.3/v6.12 design language and search-first structure.
- Expanded the canonical searchable knowledge base from 654 to **931 records** with source-attributed national, IMA, Social Development, Planning, Energy, Public Utilities, CSO, ODPM, RIC and development-partner material.
- Preserved the EMA/external-source toggle and keyword search; no AI search is implemented.
- Rebuilt EMA in the News as **701 story parents / 785 article children / 963 source options**; repaired chart/render compatibility and normalised publisher labels.
- Added distinct amber media proportional rings in Spatial Discovery.
- Added 9 optional AAQMN station/host-site points with coordinate-verification metadata.
- Added three optional IMA Marine Data Hub layers with one-at-a-time selection, runtime layer-ID discovery and cache fallback.
- Added explicit **Request from the IMA** access handling across search, My List and Dataset Discovery.
- Expanded Dataset Discovery to **68 entries** and controlled search concepts to **50**.
- Added conservative GitHub Actions candidate harvesting for EMA/IMA releases and optional IMA spatial-cache refresh.
- Normalised release metadata to data version **2026.08.27.4** and regenerated master/search/related indexes.
- Automated knowledge-base audit passes with no open integrity findings.

## v7.3.0 — 26 August 2026

- Rebuilt the release from the actual **v6.12.0 package** so the established visual shell and interaction model remain the product baseline.
- Retained the compact **v7 My List** as the deliberate usability exception to the v6.12 presentation.
- Restored the full v6.12 canonical databases and expanded the knowledge master from **629 to 654 records**; removed dependence on partial/demo fallback data.
- Added **21 Regional Environmental Source records** and increased the T&T-specific international set to 43 while keeping broader Caribbean material out of the hard T&T-only international collection.
- Added controlled user-facing classification: **13 Knowledge Areas** and **10 simplified Record Types**, preserving original labels as metadata.
- Populated **EMA in the News** with **785 non-OCR headline records** covering 11 Dec 2025–24 Jul 2026; excluded EMA Unit/manager mappings and archived clipping/OCR-only entries.
- Kept media outside ordinary Spatial Discovery by default; added an explicit **Show media articles** switch that starts OFF and does not affect knowledge-record coverage counts.
- Restored the actual Trinidad & Tobago ADM1 **GeoJSON** boundary file and v6.12 Leaflet/local-fallback behaviour.
- Expanded the spatial place registry from 9 to **12 curated places** while preserving information-coverage safeguards.
- Added **Dataset Discovery** with **64 catalogue entries** and bundled official/contextual spreadsheets.
- Restored the v6.12 **32-record video database** as the canonical searchable video source; `youtube_videos.json` now contains real records instead of an empty placeholder.
- Updated the YouTube harvester to merge additional official-channel uploads directly into `videos.json` and deduplicate by YouTube video ID.
- Removed the Environmental Intelligence/live-news prototype from the release.
- Added subtle quality-of-life improvements inside the v6.12 shell: quoted phrase search, `/` focus shortcut, shareable URL filter state, regional source filtering and Datasets quick filtering.
- Data version: **2026.08.26.1**.

## v6.12.0 — 25 August 2026

- Expanded the curated knowledge base from 585 to **629 records** without adding new source families.
- Reconciled EMA News & Events with the earlier 98-record public-communication register and restored **22 historical EMA public communications from 2020–2024** using official EMA webpages; the News & Events set now contains 108 records while retaining newer 2025–2026 entries already captured.
- Added selected CSO records for household water/sanitation context, land use, biodiversity, fisheries, water resources, coastal areas, natural hazards, solid waste and greenhouse-gas data.
- Added selected NIHERST records on energy services, agro-processing, tourism, maritime skills, climate data and niche manufacturing.
- Added three RIC discovery records on water/wastewater service standards, electricity transmission/distribution losses and energy efficiency, preserving their published consultation status.
- Added explicit `source_agency` and `host_agency` metadata for research/statistical material so a hosting website is not mistaken for authorship. EMA ambient-air-quality reports hosted by CSO now display EMA as the source agency and CSO as the host.
- Stored the normalized access pathway (`Open online`, `Request from EMA`, `Reference only`, `Link under review`) in the canonical records as well as deriving it in the interface.
- Added a small metadata-quality panel to Knowledge Insights showing indexing completeness rather than source quality.
- Preserved the information-discovery safeguard: no inferred legal effect, applicability, compliance status, jurisdiction or EMA determination.
- Final data version: **2026.08.25.6**.

## v6.11.0 — 25 August 2026

- Expanded the environmental knowledge base from 543 to 585 records using curated Trinidad and Tobago material from Planning, Public Utilities, Energy, Trade, Rural Development/Local Government, RIC, CSO and NIHERST.
- Added Gazette No. 81 of 2025 from the Ministry of Planning-hosted official Gazette PDF as a neutral discovery record for published ministerial assignments relevant to environmental governance.
- Removed the **Related sources** metric tile from the homepage header; related sources remain available through search and filtering.
- Added a separate `news.html` **News & Intelligence** page with Dashboard and Search views over EMA News & Events.
- Extended Preview Lab administrative-area discovery using the 15-feature Trinidad and Tobago ADM1 fallback layer.
- Kept Leaflet + OpenStreetMap as the preferred map experience and the locally stored T&T boundary as the offline/library fallback.
- Renamed the contextual source family to **Research & Statistical Context**.
- Preserved neutral source-based wording and explicit safeguards against inferring legal effect, regulatory jurisdiction, compliance status or EMA determinations.
- Cleaned the GitHub repository structure: one canonical data copy under `data/`, no historical audit clutter, no Python caches, no one-off migration files and no raw shapefile working directory in the deployable package.

## v6.10.0 — 25 August 2026

- Added access-pathway filtering, controlled search-term expansion and Related information.
- Added mobile search-first loading.
- Rebuilt Preview Lab with Leaflet 1.9.4 and OpenStreetMap plus a local T&T boundary fallback.
- Replaced public technical collection terminology with **Knowledge Insights**, **knowledge base** and **information coverage** wording.

## v6.9.0 — 25 August 2026

- Added Preview Lab as a separate page.
- Added verified EMA Knowledge Series video links.
- Added EMA-guided environmental observances with international custodian/campaign links.

## v6.8.0 — 25 August 2026

- Added Parliament, Gazette, Research/Statistical, Trinidad-and-Tobago-specific international and environmental video source families.
- Introduced a generated master list and hard Trinidad and Tobago geographic restriction for international records.
