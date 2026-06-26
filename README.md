# EMA Knowledge Management Search Framework

This is a lightweight, GitHub Pages-ready document search framework built from `EMA_Document_KM_Framework.xlsx`.

It acts as a small JSON-backed database for Gazette-referenced EMA documents and records.

## What is included

- `index.html` — browser search interface
- `styles.css` — EMA-inspired light UI styling with status-coloured cards and mobile-first controls
- `app.js` — client-side filtering/search/export logic
- `data/documents.json` — full KM document database (258 records)
- `data/search_index.json` — compact searchable index
- `data/groups.json` — programme area common keyword groups
- `data/summary.json` — database summary and counts
- `data/document.schema.json` — JSON schema for each record
- `data/keyword_audit.csv` — QA file showing the 20 generated keywords for every record
- `scripts/validate.py` — checks JSON structure and keyword counts
- `scripts/build_terms.py` — utility script for regenerating/normalising keywords from `documents.json`

## Keyword rule used

Every document has exactly **20 searchable keyword terms**:

1. **5 common programme/group terms** — shared by documents in the same programme area, such as Air, Water, Waste, CEC, Noise, Biodiversity, Finance, HR, etc.
2. **5 unique record/title terms** — generated from the document title, document ID, acronym, year or distinctive words.
3. **10 discretionary terms** — derived from category, Gazette section, source status, access route, custodian, KM value, priority, source availability and related metadata.

Each record stores the keywords in these fields:

```json
"keyword_common_group": [],
"keyword_unique": [],
"keyword_discretionary": [],
"keywords": []
```

## Run locally

Because the page fetches JSON, open it through a small local web server instead of double-clicking the HTML file:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files in this folder to the repository root.
3. Go to **Settings → Pages**.
4. Set the source to the `main` branch and `/root`.
5. Save. GitHub will publish the search page.

## Validate

```bash
python scripts/validate.py
```

The validator checks that each record has exactly 20 keywords, with 5 common, 5 unique and 10 discretionary terms.

## Suggested KM use

Use this as a first-pass public knowledge register. For production use, add:

- version / approval date
- review cycle
- retention category
- document owner
- access classification
- source verification date
- checksum or local file path once downloaded
- tags for public-facing versus internal-only records

## Caveat

This database reflects the register built from the Gazette-derived spreadsheet and previously located online links. Some records are listed as Information Centre / FOIA likely because no public direct PDF was found.


## EMA Information Centre request pathway

Records referenced in the Gazette but without a public online file are treated as **held by EMA**, not as missing. For those records, the framework uses the standard source label:

> Held by EMA. Request access through the EMA Information Centre.

The longer availability note used in the JSON and workbook is:

> This document is referenced in EMA’s Updated Public Statement 2024 and should be held by or accessible through EMA. No public online copy is currently linked in this register. Request access through the EMA Information Centre.

The search interface displays these items as an **EMA request pathway** rather than a broken or missing link.

## Mobile-friendly GitHub Pages interface

This version is designed to load and work cleanly on phones as well as desktops.

Mobile improvements include:

- responsive single-column result cards on small screens
- compact hero/header copy so the search box appears quickly
- sticky search area for fast repeated searches
- horizontal quick-filter chips for common mobile actions
- collapsed advanced filters behind a **Filters** button on phones
- larger tap targets for search, filters, links and request buttons
- progressive result rendering: phones show an initial batch and use **Load more results** instead of rendering hundreds of cards at once
- copyable request text for records marked **Held by EMA — Request Required**
- installable web-app metadata through `manifest.webmanifest`
- basic offline/cache support through `service-worker.js` after the first successful load

The app remains fully static. It can still be hosted from GitHub Pages without a server or database.


## GitHub Pages database loading notes

This version is tolerant of different upload layouts. The app first tries to load `data/documents.json`. If that is not present, it also tries root-level JSON files such as `EMA_KM_documents_searchable.json` and `documents.json`.

Recommended upload structure:

```text
/index.html
/app.js
/styles.css
/manifest.webmanifest
/service-worker.js
/data/documents.json
/data/summary.json
/data/groups.json
/data/search_index.json
```

If you prefer the simplest setup, upload the standalone JSON file to the repository root as:

```text
EMA_KM_documents_searchable.json
```

Common causes of the database loading error:

- only `index.html` was uploaded, without the `data` folder;
- the folder was named `Data` instead of `data`;
- the file was renamed, for example `documents (1).json`;
- GitHub Pages is serving an older cached version. Refresh the page or clear the site cache after uploading this fixed version.


## EMA-inspired cosmetic update

This version uses a light, minimal visual style designed to feel closer to the EMA website: teal/green accents, soft white cards, rounded action chips and clear status badges. Result cards are lightly colour-coded by source pathway:

- green border/background tint — public direct link available;
- blue/teal tint — source page available;
- amber tint — held by EMA / request pathway;
- neutral grey — needs review.

The **Request from EMA** quick action opens the EMA Information Centre General Request page:

```text
https://www.ema.co.tt/information-centre-general-request/
```

The formal FOI request page is also available at:

```text
https://www.ema.co.tt/foi-request/
```

The request-required records can still be filtered using **Filters → Links → EMA request pathway**.
