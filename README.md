# EMA Knowledge Access Register — Two Database Version

This GitHub Pages package contains a static, mobile-friendly knowledge access tool that searches across two JSON databases:

1. **Document Access Register** — documents, forms, laws, policies, reports and request-pathway records derived from EMA's Updated Public Statement 2024.
2. **EMA Press Release Register** — first-pass reference table of EMA Latest News / media release-style posts captured from the EMA Latest News archive.

The page is designed to remain simple and fast on phones while supporting deeper inspection through in-row **Read more** cards.

## What's included

```text
index.html
assets/
  app.js
  styles.css
data/
  documents.json
  press_releases.json
  search_index.json
documents.json
press_releases.json
EMA_KM_documents_searchable.json
EMA_press_releases_searchable.json
manifest.webmanifest
service-worker.js
LICENSE
LICENSE-DATA
NOTICE
```

## Key features

- Searches both databases together by default.
- Database tabs: **All databases**, **Documents**, **Press releases**.
- Mobile-friendly list-first layout.
- Short title first, full formal title below.
- In-row **Read more** details card.
- Quick filters for public links, held-by-EMA records, forms/guides, laws/rules, reports/studies, internal/governance records, media releases and priority records.
- Document Request Basket can export request-required records and public link lists as CSV, JSON or text.
- Public press release records can be added to the basket as a link/export list.

## Deployment

Upload all unzipped contents to the root of a GitHub repository and enable GitHub Pages.

Keep both database files in place:

```text
data/documents.json
data/press_releases.json
```

The app also includes root-level fallback copies to reduce loading errors on GitHub Pages.

## Cache note

If the page looks old after uploading, hard refresh the browser. On desktop use `Ctrl + F5`. On mobile, clear site data or open the page in a private/incognito tab once.

## Data note

The press release database is a first-pass register from EMA Latest News. It should be reviewed periodically because the archive is live and may change. Some source URLs are generated from the public WordPress post title/date pattern and should be verified when used for formal citation.

## License

Code is licensed under MIT. Curated metadata and documentation are licensed under CC BY 4.0. Linked official or third-party records remain subject to their own rights and access terms.
