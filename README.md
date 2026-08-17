# EMA Document Search Tool

Static GitHub Pages search interface for three public-facing record sets:

1. **Document Access Register** — `data/documents.json`
2. **Judgments & Proceedings** — `data/judgments.json`
3. **EMA News & Events** — `data/press_releases.json`

**Application version:** 6.2.2  
**Corpus version:** 2026.08.17.1  
**Release date:** 17 August 2026

## Product approach

The tool is a retrieval tool. It does not provide legal advice, infer organisational positions, or state institutional effects that are not expressly established by the source material. Brief record descriptions are intentionally conservative and are used only to help a user understand what a record is about before opening the authoritative source.

Public users can search, filter, select, export and open records. Corpus additions and corrections are not made from the public interface; users are directed to contact the Knowledge Management Unit for review.

## v6.2.2 interface update

- Added a compact **Suggest a record or correction** disclosure to the right side of the results header.
- When expanded, the left side shows the current counts for Documents, Judgments & Proceedings, and News & Events; the right side provides Knowledge Management contact guidance and the authoritative-source reminder.
- Added **Report broken link** directly to search-result rows as a secondary text action where a source link exists.
- Corpus version remains **2026.08.17.1**; this is an interface-only maintenance release.

## v6.2.1 maintenance update

- Renamed the public-facing product to **EMA Document Search Tool**.
- Set the Knowledge Management contact to **rseemungal@ema.co.tt**.
- Added a contextual **Report a broken link** action to records that have a source link. The email is pre-filled with the record title, record ID and captured source URLs.
- Updated low-result search assistance and record-suggestion emails to use the new product name and Knowledge Management contact.
- Corpus version remains **2026.08.17.1**; no record data were added or removed in this maintenance release.

## v6.2.0 corpus update

- Added a dedicated **Judgments & Proceedings** record set.
- Added the Environmental Commission's published EMA-related judgment inventory plus verified High Court, Court of Appeal and Privy Council records.
- Distinguishes judgments, rulings, permission decisions and pending appeal proceedings.
- Updated **EMA News & Events through 17 August 2026**, adding six entries after the prior 5 June 2026 cutoff.
- Added brief contextual descriptions to records. Descriptions are either source-grounded or explicitly limited to catalogue metadata.
- Changed **Add** into a toggle: `+ Add` → `✓ Added`; clicking again removes the record.
- Renamed the visible basket to **Selected records**.
- Added assistance when a search returns **0–4 results**, including a pre-filled contact action for the Knowledge Management Unit.
- Removed the public-facing "Why this record is included" and "Suggested action" interpretation panels.
- Added corpus version metadata and a post-build audit.

## GitHub Pages deployment

Upload the **contents of this folder** to the repository root, preserving the folder structure.

```text
index.html
assets/
  app.js
  styles.css
data/
  documents.json
  judgments.json
  press_releases.json
  search_index.json
  summary.json
  version.json
  audit_report.json
  schema.json
tools/
  validate_data.py
  audit_corpus.py
scripts/
  build_terms.py
VERSION.json
AUDIT_2026-08-17.md
manifest.webmanifest
service-worker.js
README.md
LICENSE
LICENSE-DATA
NOTICE
```

Then enable **Settings → Pages** for the repository branch/root used for the site.

## Canonical data files

Edit the files in `data/` first. Root-level copies are retained only as loading fallbacks for GitHub Pages.

The public app loads:

```text
data/documents.json
data/judgments.json
data/press_releases.json
```

## Corpus governance

- Do not add interpretive statements about the EMA or the effect of a judgment unless an authoritative source expressly establishes the statement and the wording is suitable for a neutral catalogue.
- For legal records, preserve the distinction between a **judgment**, **ruling**, **permission-to-appeal decision** and **pending appeal proceeding**.
- Where no reliable official direct link is available, use a source/index page or a clearly labelled legal source rather than inventing a URL.
- A repeated case name at different court levels is not a duplicate when it represents a separate proceeding.
- The legal inventory is a verified working set; it is **not labelled as exhaustive of every proceeding involving EMA**.
- The Knowledge Management contact is configured in the `KMU_CONTACT_EMAIL` constant near the top of `assets/app.js`. Version 6.2.2 uses `rseemungal@ema.co.tt` for record suggestions, corrections, search assistance and broken-link reports.

## Validation and audit

Run:

```bash
python tools/validate_data.py
python tools/audit_corpus.py
node --check assets/app.js
```

The audit checks required metadata, duplicate IDs, URL syntax, contextual descriptions, conservative wording, legal status/type consistency, News & Events freshness and summary counts.

`AUDIT_2026-08-17.md` records the release audit and `data/audit_report.json` provides machine-readable results.

## Record selection

Selected records are stored in browser local storage. Users can:

- add/remove a record from the result row;
- review Selected records;
- export CSV or JSON;
- generate access-request text for records that do not have a public direct link.

## Licensing

- Code: MIT (`LICENSE`)
- Curated metadata and repository documentation: CC BY 4.0 (`LICENSE-DATA`)
- Linked official EMA, Government, court, tribunal and third-party source materials retain their own copyright and reuse terms.
