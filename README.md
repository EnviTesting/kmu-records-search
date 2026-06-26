# EMA Knowledge Access Register — GitHub Hardened Build

This is a static GitHub Pages-ready register for searching two linked databases:

1. **Document Access Register** (`data/documents.json`)
2. **Press Release Register** (`data/press_releases.json`)

The interface is mobile-first, list-first, and designed to keep the first view simple: search, journey selection, quick filters, results, and a record basket.

## What was strengthened in this build

- Database loading is separated from interface rendering.
- The app loads the two databases independently; if one fails, the other can still be searched.
- Optional UI elements are guarded so missing header metrics or panels do not break the app.
- Records are normalised into one internal model before rendering.
- Search works across both databases with weighted scoring.
- Result rows use a fallback renderer so one malformed record cannot blank the table.
- The old service-worker/offline cache problem is addressed: this build unregisters old service workers and clears old caches.
- A visible app version and diagnostics panel are included in the footer.
- Root-level JSON fallback files are included for GitHub Pages troubleshooting, but the canonical files are in `data/`.
- A data validator is included at `tools/validate_data.py`.

## Recommended GitHub upload structure

Upload the **contents** of this folder to the repository root:

```text
index.html
assets/
  app.js
  styles.css
data/
  documents.json
  press_releases.json
  search_index.json
  schema.json
tools/
  validate_data.py
manifest.webmanifest
service-worker.js
README.md
LICENSE
LICENSE-DATA
NOTICE
```

The canonical database paths are:

```text
data/documents.json
data/press_releases.json
```

Root-level JSON copies are included as fallback only. Do not manually edit both versions. Edit the canonical `data/` versions first, then copy them to the root only if you still want fallback support.

## GitHub Pages setup

1. Create or open your GitHub repository.
2. Upload all files and folders from this package to the repository root.
3. Go to **Settings → Pages**.
4. Select the branch and root folder.
5. Wait a few minutes for GitHub Pages to publish.
6. Open the page in an incognito/private window for first testing.

## If the page looks old or behaves strangely

Earlier versions used a service worker cache. This build tries to remove old cached files, but browsers can still hold old content briefly.

Try these in order:

1. Click **Refresh app cache** in the search panel.
2. Hard refresh: `Ctrl + F5` on Windows.
3. Open the page in an incognito/private window.
4. On mobile, close the browser tab fully and reopen it.
5. Add `?v=4` to the end of the GitHub Pages URL.

## Built-in diagnostics

At the bottom of the page, click **Diagnostics**. It shows:

- app version
- which JSON paths loaded
- record counts
- current filtered count
- recent runtime notes

This is meant to make GitHub troubleshooting easier.

## Data validation

From a local terminal in the project folder:

```bash
python tools/validate_data.py
```

Expected result for this build:

- 258 document records
- 79 press release records
- 337 total records
- 20 keywords per record

## Record basket

The Record Basket can collect both public/source links and request-required records. It can:

- generate request text
- copy request text
- export a CSV
- export JSON
- open the EMA Information Centre General Request page

## Licence

This repository uses a split licensing approach.

- Code: MIT License. See `LICENSE`.
- Curated metadata, JSON records, taxonomy, and documentation: CC BY 4.0. See `LICENSE-DATA`.
- Official EMA, Government of Trinidad and Tobago, UN, UWI, World Bank, consultant, and third-party documents linked or referenced are not licensed by this repository. They remain subject to their own copyright, access, and reuse terms.


## Separated search/results layout

This version removes the sticky search-panel behaviour so result rows no longer appear to slide underneath the search controls. The search panel and record list are visually separated for easier reading on GitHub Pages and mobile browsers.

## Hidden diagnostics

The public page no longer shows troubleshooting controls to casual users. To reveal the admin/diagnostics panel, tap or click the small app version text in the footer seven times. The hidden panel includes:

- app version/build information
- database load diagnostics
- the Refresh app cache button for GitHub Pages cache issues

This is only a light UI concealment. The code is still visible in the repository, as expected for a static GitHub Pages app.
