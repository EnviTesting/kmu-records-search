# Knowledge Records Search Tool — Release Audit v8.2.0

**Application version:** 8.2.0  
**Data version:** 2026.08.28.1  
**Release date:** 28 August 2026  
**Design anchor:** v7.3 / v8.1 familiar interface

## Release inventory

- 931 searchable knowledge records
- 701 EMA-in-the-News story parents
- 785 media article records
- 963 media source options
- 65 Data Search catalogue entries
- 12 established EMA/core spatial discovery places
- 19 curated external institutional discovery points
- 9 AAQMN station/host-site points
- 50 controlled search concepts
- 25 curated relationships
- 15 local ADM1 fallback boundary features

## v8.2 user-interface and QoL changes

- Standardised five-page navigation while preserving the established visual identity.
- Kept the Records Search landing state focused; the result/refinement workspace appears after a search, browse or filter action.
- Retained search-within-results, Institution filtering and additive `+` search suggestions.
- Improved mobile landing behaviour so navigation remains available.
- Separated Spatial Discovery into EMA records, external institutional records, media coverage, AAQMN stations and administrative coverage.
- Added source-based external record geography without introducing new live GIS dependencies.
- Added a direct EMA public monitoring-data action to every AAQMN station popup.
- Retained Chart Insights and redesigned the Knowledge Canvas as overview baskets with focused drill-down rather than nested scrolling.
- Unified EMA-in-the-News filtering so one search state drives both charts and story results.
- Retained fallback value tables for news analytical charts.

## Data/provenance safeguards

- External spatial points are discovery associations only. They are not regulatory, hazard, property or legal boundaries.
- Points are included only where the indexed source or a curated source-based association supports the named place.
- Selected IMA press-release locations are stored as explicit source geography and remain attributed to the Institute of Marine Affairs.
- Media coverage is always separate from official/knowledge records.
- AAQMN coordinates retain their verification/provisional status; the map does not convert provisional host/locality coordinates into asserted exact EMA station GPS.
- No live IMA REST/GIS dependency is present in the release.

## Automated release checks

The release candidate passed:

- canonical record validation;
- cross-record relationship/search-term validation;
- EMA-in-the-News analytical-model validation;
- Spatial Discovery association / AAQMN portal validation;
- conservative knowledge-base audit with no open High/Medium findings;
- static five-page navigation/control/asset smoke test;
- JavaScript syntax checks;
- GitHub Actions YAML parsing.

## Environment limitation

A local rendered-page Chromium check could not be completed because the execution environment blocks browser navigation to the local HTTP server. This does not affect the static validation results, but a normal post-deployment visual/browser check on GitHub Pages remains recommended, especially for chart sizing, mobile layout and Leaflet rendering.

## Release assessment

**PASS — suitable for GitHub Pages deployment as Knowledge Records Search Tool v8.2.0**, subject to the normal post-deployment browser check and the stated information-discovery safeguards.
