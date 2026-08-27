# TRACE upgrade stages

## Stage 1 — Stability, News and AAQMN

- Retain the v7.3 structure and visual language.
- Repair EMA in the News rendering/chart behaviour.
- Use the 701-story / 785-article model and normalised source names.
- Add amber media symbology to Spatial Discovery.
- Add AAQMN as an off-by-default, verification-aware layer.
- Expand controlled keyword/synonym discovery.

## Stage 2 — IMA and controlled external discovery

- Add IMA as an explicitly attributed external source family.
- Add `Request from the IMA` access handling linked to the IMA Library.
- Introduce IMA Marine Data Hub integration without assuming a layer ID.
- Keep optional spatial layers off by default and display at most one IMA layer at a time.
- Add conservative live-service/cache fallback.

## Stage 3 — Consolidated TRACE v8

- Reconcile high-value national, statistical, social-sector, international and development-partner records without bulk-importing noise.
- Preserve the external-record toggle.
- Refresh Knowledge Insights, Dataset Discovery, source registry and release metadata.
- Add review-only EMA/IMA press-release candidate harvesting and IMA spatial-cache refresh via GitHub Actions.
- Validate the canonical record union, relationships and conservative-description safeguards.
- Keep AI search out of the production GitHub build.
