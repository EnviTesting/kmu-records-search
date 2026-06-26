# EMA Document Access Register — List-first mobile package

This GitHub Pages package turns the EMA KM document register into a list-first, mobile-friendly document access tool.

## What changed

- The default results are now a compact **filterable list**, not large result bubbles.
- The top of the page uses a **document journey** prompt: “What do you need to do today?”
- Search remains prominent and works across titles, topics, laws, units, years, document types, and keywords.
- Quick filters are visible for public links, held-by-EMA records, forms, laws, reports, internal policies, and high-priority items.
- Result rows use subtle coloured borders:
  - Green: public link found
  - Teal: EMA source page
  - Blue: external public source
  - Amber: held by EMA / request pathway
  - Grey: needs verification
- Clicking **Details** opens the richer KM information only when needed.
- The **Request Basket** can collect records and generate:
  - request text
  - CSV file
  - JSON file
  - plain-text request letter
- The request page button opens the EMA Information Centre General Request page.
- The layout is mobile-first and works well on phone screens.

## Deployment

Upload the full unzipped contents to the root of a GitHub repository, then enable GitHub Pages.

Required files:

```text
index.html
assets/app.js
assets/styles.css
data/documents.json
documents.json
EMA_KM_documents_searchable.json
manifest.webmanifest
service-worker.js
```

The app tries multiple JSON locations, but `data/documents.json` should remain in place.

## Request pathway wording

Records without a public link can show:

> Held by EMA. Request access through the EMA Information Centre.

Longer note:

> This document is referenced in EMA’s Updated Public Statement 2024 and should be held by or accessible through EMA. No public online copy is currently linked in this register. Request access through the EMA Information Centre.

## Notes

This register is an independent knowledge-management aid based on documents referenced in EMA’s Updated Public Statement 2024, supplemented with public links and request pathways where available. Official copies, access decisions, and document availability should be confirmed through EMA.
