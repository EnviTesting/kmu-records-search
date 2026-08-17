# EMA Document Search Tool — Release Audit v6.2.2

**Release date:** 17 August 2026  
**Application version:** 6.2.2  
**Corpus version:** 2026.08.17.1  
**Corpus records:** 394 (unchanged)

## Scope

This is an interface-only maintenance release. No corpus records were added, removed, reclassified or edited.

## Interface changes checked

- The results header presents the result count on the left and **Suggest a record or correction** on the right.
- The suggestion area is collapsed by default and uses `aria-expanded` / `aria-controls` for its disclosure state.
- When expanded, the left side shows counts for the current filtered result set: Documents, Judgments & Proceedings, and News & Events.
- The right side provides the Knowledge Management contact route and the reminder to consult the original source for authoritative text.
- The record suggestion/correction email is generated from the current search and active filters and routes to `rseemungal@ema.co.tt`.
- **Report broken link** is shown directly on search-result rows only when a captured source URL is available.
- Broken-link emails include the record title, record ID, primary link and source/index page and route to `rseemungal@ema.co.tt`.
- The existing broken-link action remains available in the expanded record view.
- The former permanently visible footer guidance was removed to reduce page clutter.

## Validation completed

- `node --check assets/app.js` — passed.
- `node --check app.js` — passed.
- HTML ID/reference consistency checks for the new disclosure and result-breakdown controls — passed.
- `python tools/validate_data.py` — passed: 279 Documents, 85 News & Events, 30 Judgments & Proceedings; 394 total.
- `python tools/audit_corpus.py` — passed with no new integrity or conservative-description findings.
- Unified search index rebuilt for 394 records and revalidated.

## Known validation limitation

A headless Chromium render was attempted in the build environment but the browser process could not complete because of the container's system/DBus environment. Static HTML/JavaScript checks, syntax validation, data validation and corpus audit were completed successfully instead.
