# Knowledge Records Search Tool

A static GitHub Pages prototype for finding Environmental Management Authority (EMA) knowledge records and selected related environmental information for Trinidad and Tobago.

**Application version:** 8.2.0  
**Data version:** 2026.08.28.1  
**Design anchor:** v7.3.0 / v6.12 visual language  
**Searchable knowledge records:** 931  
**EMA in the News:** 701 stories / 785 article records / 963 source options  
**Data Search:** 65 catalogue entries  
**AAQMN:** 9 station/host-site points

## Release approach

Version 8.2 is a quality-of-life and findability refinement, not a redesign. It keeps the established v7.3/v8.1 page structure and institutional styling while reducing interface competition, standardising navigation, improving progressive refinement, expanding source-based spatial associations and making the Knowledge Canvas easier to scan.

There is **no AI search in this release**. Controlled keyword search remains the production retrieval method.

## Main pages

- `index.html` — **Knowledge Records Search**: reports, policies, plans, legal material, research, institutional publications and other indexed records.
- `datasets.html` — **Data Search**: datasets, tables, surveys, spreadsheets, spatial data and data-bearing publications.
- `preview.html` — **Spatial Discovery**: geographic associations for the current search or browse view.
- `news.html` — **EMA in the News**: simple dynamic analysis of media coverage plus story/source search.
- `insights.html` — **Knowledge Insights** with two tabs:
  - **Chart Insights** for quantitative understanding of the indexed collection.
  - **Knowledge Canvas** for exploring evidence/governance baskets and the institutions represented in them.

All five tools are linked in the persistent navigation.

## Canonical knowledge record sets

| Record set | File | Records |
|---|---|---:|
| EMA Document Access Register | `data/documents.json` | 282 |
| EMA News & Events | `data/press_releases.json` | 108 |
| Judgments & Proceedings | `data/judgments.json` | 30 |
| External / government / institutional references | `data/external_references.json` | 300 |
| Parliamentary Evidence | `data/parliamentary_evidence.json` | 35 |
| Government Gazette & Legal Notices | `data/gazette_records.json` | 15 |
| Research & Statistical Context | `data/statistical_context.json` | 65 |
| Regional Environmental Sources | `data/regional_references.json` | 21 |
| International — Trinidad & Tobago-specific | `data/international_references.json` | 43 |
| Environmental Video | `data/videos.json` | 32 |
| **Total** |  | **931** |

`data/master_list.json`, `data/master_list.csv`, `data/search_index.json`, `data/groups.json` and `data/related_index.json` are derived maintenance/discovery files.

## Search and findability

The three searchable collections — Records, Data and News — use the same controlled terminology utilities in `assets/search-utils.js`.

The current interface supports:

- controlled synonyms and aliases;
- simple singular/plural variants;
- source-institution filtering;
- search within the current result set;
- `+` suggestions that narrow the existing query rather than replacing it;
- visible active filters and clear/reset actions;
- search/filter state stored in the URL/session so Spatial Discovery can inherit useful context;
- mobile filters that initiate and display results without first requiring a typed query.

The main search keeps related/external records opt-in. Dataset and media collections remain distinct from the 931-record master rather than being merged into an undifferentiated result count.

## Knowledge Insights and Knowledge Canvas

Chart Insights remains the default view and summarizes record distribution, source mix, metadata quality, access and collection coverage.

The Knowledge Canvas reorganizes the same filtered record set into seven discovery baskets:

1. Legislation & Regulation
2. Policy & Strategy
3. Plans & Management
4. Projects & Activities
5. Data & Monitoring
6. Research & Evidence
7. Guidance & Public Information

Each basket is presented first as a compact overview card with a record count, leading institutions and a short preview. **View records** opens a focused basket panel with search-within-basket and institution refinements. This avoids nested mini-scroll areas while retaining direct access to the underlying records. Institution chips can narrow the whole canvas. These are **record-coverage views**, not assessments of institutional responsibility, statutory mandate, performance or governance quality.

## EMA in the News

The media archive is deliberately separate from the knowledge-record master:

- `data/ema_news_stories.json` — 701 conservative story parents.
- `data/ema_in_news.json` — 785 article records.
- `data/ema_news_sources.json` — 963 article/source options.

The page supports dynamic filtering by year, topic, publication and location, with simple charts for:

- coverage over time;
- coverage by topic;
- coverage by publication.

Charts use the cleaned story/article model. Story-level counts are used where the unit is a story; publication counts use the associated article records. Each chart also has a readable values table so the underlying information remains available if visual rendering fails.

Media frequency is not an EMA finding of environmental incidence, severity, causation, compliance or risk.

## Spatial Discovery

Spatial Discovery is an information-association view rather than a general GIS application.

Independent controls allow users to choose what appears on the map:

- **EMA records** — on by default, shown in teal.
- **External institutional records** — off by default, shown separately from EMA holdings.
- **News coverage** — off by default, shown in amber.
- **AAQMN stations** — off by default, with coordinate-verification status retained.
- **Administrative coverage** — independently switchable.

The map includes the established EMA/core discovery places plus a curated set of source-based locations for external institutional records, including selected IMA press releases and technical records. External geography is added only where the source or curated record association supports the place; national records are not assigned invented point locations. Knowledge records and media therefore appear together only when the user deliberately enables them. The simple associated-record/story list remains available alongside the map.

Each AAQMN station popup prioritises the EMA public monitoring portal for current and historical air-quality data, followed by related EMA records and media coverage where available.

Live IMA REST/spatial layers are **not part of this release**. IMA remains a first-class knowledge source in Records and Data Search, with Institute of Marine Affairs attribution and the IMA Library/request pathway where appropriate.

## Source and access model

Important access states include:

- `open_online` — an authoritative/public source can be opened.
- `request_ema` — an EMA Information Centre/request pathway is indexed.
- `request_ima` — an IMA-held record is identified but a public file is not available; use **Request from the IMA** / IMA Library.
- `reference_only` — the record is confirmed for discovery without asserting a public file/request route.
- `link_review` — a stored link requires review.

Related sources are visibly attributed. Institution labels indicate the institution represented by the indexed record; they should not be interpreted as a statement of statutory responsibility.

## Scheduled maintenance

### EMA / IMA press-release candidates

`.github/workflows/refresh-source-candidates.yml` runs weekly or manually. It harvests candidate EMA/IMA press-release records into `data/candidates/`, validates the knowledge base, and only commits candidate files when their content changes. Candidates are **not** automatically inserted into canonical records.

### Official EMA YouTube metadata

`.github/workflows/harvest-youtube.yml` retains the optional official EMA YouTube refresh. It requires `YOUTUBE_API_KEY` in GitHub Secrets.

## Validation

After editing canonical JSON:

```bash
python tools/build_master_list.py
python tools/build_related_index.py
python tools/validate_data.py
python tools/validate_relationships.py
python tools/validate_news_data.py
python tools/validate_spatial_discovery.py
python tools/audit_knowledge_base.py
python tools/smoke_static_site.py
```

A release should not be published with open High/Medium automated audit findings.

## GitHub Pages deployment

Upload the contents of this folder to the repository root and preserve the directory structure. No framework or application server is required. Enable GitHub Pages for the selected branch/root.

Because the application uses `fetch()` for local JSON, test through GitHub Pages or a local HTTP server rather than opening `index.html` directly with `file://`.

## Information-use safeguard

The Knowledge Records Search Tool is an information-discovery prototype. Descriptions, classifications, keyword expansion, media groupings, charts, maps and related-record suggestions help users locate sources. They do **not** provide legal advice, determine legal effect/applicability, establish regulatory jurisdiction or compliance status, or represent an EMA determination. Review the original authoritative source and applicable EMA process before formal reliance.
