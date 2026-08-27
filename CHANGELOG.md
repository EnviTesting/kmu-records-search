# Changelog

## 8.1.0 — 27 August 2026

- Restored the product name **Knowledge Records Search Tool**.
- Preserved the established v7.3/v6.12 interface and styling while refining findability.
- Fixed mobile filters so filter interactions initiate and display results without requiring a prior typed search.
- Added **Search within results**, **Source institution** filtering and controlled `+` query refinements.
- Added shared search utilities across Records Search, Data Search and EMA in the News, including simple singular/plural variants.
- Added URL/session search-state persistence and passed useful context into Spatial Discovery.
- Promoted **Data Search** to persistent navigation and removed the ambiguous main-search Dataset shortcut.
- Removed live IMA REST/spatial-layer functionality and the three REST-layer catalogue entries; IMA remains fully attributed in knowledge/data records and request pathways.
- Separated Spatial Discovery display controls into independent **Knowledge records**, **News coverage** and **AAQMN** toggles.
- Rebuilt EMA in the News as a simple dynamic meta-analysis over 701 story parents and 785 article records, with fallback value tables for every chart.
- Retained Knowledge Insights charting and added a **Knowledge Canvas** tab with seven evidence/governance baskets and institution-based exploration.
- Removed unnecessary `cache: no-store` behaviour while retaining versioned asset requests.
- Added release validation for News analytical data and updated static smoke checks for the v8.1 controls.

**Data snapshot:** 931 knowledge records; 701 media stories; 785 media article records; 65 Data Search entries; 9 AAQMN stations.

## Earlier releases

The v7.3/v6.12 application established the core interface, filtered keyword search, source/access model, My List, Knowledge Insights, Spatial Discovery and EMA in the News. Subsequent corpus work expanded the searchable master to 931 records and introduced the story-parent media model retained in v8.1.
