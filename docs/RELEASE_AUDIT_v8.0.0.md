# TRACE Release Audit — v8.0.0

**Release date:** 27 August 2026  
**Application version:** 8.0.0  
**Data version:** 2026.08.27.4  
**Searchable knowledge records:** 931

## Release position

TRACE v8.0.0 is an upgrade of the established v7.3/v6.12 static GitHub Pages application rather than a redesign. Keyword search remains the production retrieval method; AI search is not implemented.

## Canonical knowledge base

| Record set | Records |
|---|---:|
| EMA Document Access Register | 282 |
| EMA News & Events | 108 |
| Judgments & Proceedings | 30 |
| External / government / institutional references | 300 |
| Parliamentary Evidence | 35 |
| Government Gazette & Legal Notices | 15 |
| Research & Statistical Context | 65 |
| Regional Environmental Sources | 21 |
| International — Trinidad & Tobago-specific | 43 |
| Environmental Video | 32 |
| **Total** | **931** |

## Major v8 changes verified

- TRACE product naming applied while retaining the v7.3 interaction and visual baseline.
- EMA/external-source toggle preserved.
- EMA in the News rebuilt as 701 story parents, 785 article children and 963 source options.
- Publisher aliases such as `103.1FM` and `103.1 FM` are normalised.
- News/media uses amber proportional rings distinct from teal knowledge-record circles.
- Nine AAQMN stations are available as an off-by-default discovery layer with coordinate-verification metadata.
- Three optional IMA Marine Data Hub layers are available with one-at-a-time selection, runtime ArcGIS layer discovery and cache fallback.
- IMA records retain source attribution and support an explicit `Request from the IMA` pathway when a public file is unavailable.
- Dataset Discovery contains 68 entries.
- Controlled keyword expansion contains 50 concepts/synonym groups.
- Candidate-only EMA/IMA press-release refresh and optional IMA spatial-cache refresh workflows are included.
- Official EMA YouTube refresh now derives the current data version from `data/version.json` instead of hard-coding an older release.

## Automated QA

The following release checks pass:

- `python tools/build_master_list.py` — **PASS: 931 records**
- `python tools/build_related_index.py` — **PASS: related suggestions generated**
- `python tools/validate_data.py` — **PASS**
- `python tools/validate_relationships.py` — **PASS: 931 records / 25 curated relationships / 15 boundary features / 50 search concepts**
- `python tools/audit_knowledge_base.py` — **PASS: zero open High/Medium findings**
- `python tools/smoke_static_site.py` — **PASS: 5 pages**
- JavaScript syntax checks — **PASS**
- GitHub Actions YAML parsing — **PASS**

The automated audit intentionally fails CI if a future release has an open High or Medium finding.

## Refresh safeguards

- EMA/IMA press-release harvesting creates review candidates only; it does not insert records into the canonical database automatically.
- Routine run timestamps/status files are not staged by the scheduled workflow, avoiding timestamp-only commits.
- IMA spatial refresh preserves existing cached geometry if the upstream service is unavailable and does not create synthetic geometry.
- The release does not ship a failed sandbox refresh status as though it were production state; status manifests begin in a neutral `not_run_in_release_environment` state.

## Known limitations

- External URL syntax is automatically checked; live availability of every external URL is not asserted by the release audit.
- The current sandbox could not reliably initialise a full headless Chromium session, so the release uses structural/static browser smoke tests plus JavaScript syntax validation. A live GitHub Pages browser check remains appropriate after deployment.
- EMA News & Events in the canonical knowledge base was last captured on 18 August 2026. The 27 August release updates other source families and does not imply a same-day EMA news-page refresh.
- Maps, source classifications, related-record suggestions and media groupings support discovery only and do not constitute an EMA determination, legal interpretation, regulatory boundary, compliance status or environmental-condition finding.

## Release decision

**PASS — suitable for GitHub Pages deployment as TRACE v8.0.0**, subject to the stated information-discovery safeguards and a normal post-deployment browser check.
