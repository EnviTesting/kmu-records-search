# Knowledge Records Search Tool — v8.2 refinement

Version 8.2 keeps the established v7.3/v8.1 structure familiar and concentrates on quality of life, findability and dependable discovery.

## Records Search

- persistent five-page navigation is standardised across the site;
- the landing page remains search-first, with the results workspace hidden until the user searches, browses or filters;
- `Search within these results`, Institution, Topic, Record type, Year and Access refinements are retained and revealed when useful;
- `+` suggestions narrow the active search instead of replacing it;
- search/filter state is preserved for Spatial Discovery where relevant;
- mobile users retain access to product navigation while the initial search experience remains compact.

## Spatial Discovery

- separate toggles for **EMA records**, **External institutional records**, **News coverage**, **Air-quality stations** and **Administrative coverage**;
- 12 established EMA/core discovery places remain;
- 19 curated external discovery points add geography from source-based external records, including selected IMA press releases and technical publications;
- a **Jump to place** control supports direct navigation without requiring marker hunting;
- the associated-information panel separates EMA, external institutional and media records;
- AAQMN station popups lead first to EMA's public current/historical monitoring portal, then to associated EMA records and media context where available;
- no live IMA REST/GIS dependency is used.

## Knowledge Insights

- **Chart Insights** remains the default tab for understanding what is indexed;
- **Knowledge Canvas** remains a second tab, but baskets are now overview cards rather than seven nested scroll windows;
- basket cards show record counts, leading institutions and a small preview;
- **View records** opens a focused drill-down with search-within-basket and institution refinement;
- Canvas counts describe records indexed in the tool, not institutional responsibility, completeness or performance.

## EMA in the News

- one shared search/filter state drives both Coverage Insights and Search Stories;
- Year, Topic, Publication and Location filtering updates the analytical view and the story view consistently;
- the timeline is given full-width emphasis, with topic/publication comparisons below;
- readable value tables remain available behind charts;
- media coverage remains separate from EMA knowledge records and is not an EMA finding.

## Data Search

- retained as a persistent primary navigation item;
- 65 catalogue entries remain separate from the 931-record knowledge-record master;
- terminology is aligned with Records Search, including **Institution** rather than a separate source-institution label.

## Release quality

- canonical data version: `2026.08.28.1`;
- a dedicated Spatial Discovery validator checks external point associations and AAQMN portal links;
- News analytical-model validation remains part of CI;
- static site smoke testing checks the new v8.2 controls and rejects retired IMA REST dependencies.
