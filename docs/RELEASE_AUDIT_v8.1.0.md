# Knowledge Records Search Tool — Release Audit v8.1.0

**Release date:** 27 August 2026  
**Application version:** 8.1.0  
**Data version:** 2026.08.27.5  
**Searchable knowledge records:** 931

## Release intent

This release retains the established v7.3/v6.12 interface and focuses on clarity, findability and reliability rather than adding another major feature layer.

## Completed interface changes

- Product name restored to **Knowledge Records Search Tool**.
- Data Search promoted to persistent navigation as a separate page.
- Mobile filter interactions now initiate and reveal results without requiring a prior typed query.
- Added **Search within results** and **Source institution** filtering.
- Added controlled `+` suggestions that narrow the current query.
- Added shared controlled search utilities across Records, Data and News, including simple singular/plural variants.
- Search/filter state is retained in URL/session state and useful context is passed into Spatial Discovery.
- Spatial Discovery now has independent toggles for **Knowledge records**, **News coverage** and **AAQMN stations**.
- Live IMA REST/spatial-layer functionality and its three Data Search catalogue entries were removed.
- IMA remains a first-class attributed source with IMA Library / **Request from the IMA** handling.
- Knowledge Insights retains quantitative charting and adds a separate **Knowledge Canvas** tab.
- The Knowledge Canvas groups the current filtered records into seven evidence/governance baskets and shows institutions represented.
- EMA in the News now provides a simple dynamic meta-analysis with coverage-over-time, topic and publication charts plus fallback value tables.

## Release inventory

- 931 searchable knowledge records.
- 701 EMA in the News story parents.
- 785 media article records.
- 963 media source options.
- 65 Data Search catalogue entries.
- 9 AAQMN station/host-site points.
- 50 controlled search concepts.
- 25 curated record relationships.
- 15 ADM1 fallback boundary features.

## Automated validation

The release passed:

- `tools/validate_data.py`
- `tools/validate_relationships.py`
- `tools/validate_news_data.py`
- `tools/audit_knowledge_base.py`
- `tools/smoke_static_site.py`
- `node --check` for every JavaScript asset

The News analytical validator confirmed all 701 story parents are chartable by date and that the 785 article records aggregate into 53 publication labels without broken story/article membership.

The knowledge-base audit contains **no open High/Medium findings**. Its only current informational note is that the captured EMA News & Events collection is current through 18 August 2026; this release should not be read as implying a same-day EMA news-page harvest.

## Browser-render limitation in this build environment

A Chromium `--headless --dump-dom` check was attempted through a local HTTP server, but the container Chromium process could not initialize its DBus environment and timed out before page rendering. This is an environment limitation rather than a detected application error. The release therefore uses stronger static DOM, JSON-hook, JavaScript-syntax and News analytical-data tests. A normal post-deployment browser check on GitHub Pages remains recommended.

## Information-use safeguard

Charts, Canvas groupings, map associations, media groupings, classifications and related-record suggestions describe indexed information and support discovery. They do not establish institutional mandate, legal effect, environmental condition, compliance status, causation, hazard extent or an EMA determination.

## Release decision

**PASS — suitable for GitHub Pages deployment as Knowledge Records Search Tool v8.1.0**, subject to a normal post-deployment browser check and the stated information-discovery safeguards.
