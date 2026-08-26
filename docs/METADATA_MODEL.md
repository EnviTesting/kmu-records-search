# Metadata model — v6.12

The public application uses a small normalized discovery layer while preserving source-native metadata.

## Minimum discovery fields

- `id`, `title`, `record_type` / `record_category`
- `programme_area`, `year`, `keywords`, `description`
- `source_family`, `source_status`, `source_reliability`
- `source_agency` — organisation credited as the producer/source where the source inventory establishes this
- `host_agency` — organisation hosting the public copy where this differs from the source agency
- `access_status` — `open_online`, `request_ema`, `reference_only`, or `link_review`
- source page/direct URL fields and `data_version`

## Attribution rule

Do not infer authorship from the website hosting a file. For example, the CSO inventory states that the ambient-air-quality reports it hosts were prepared by the EMA Air Unit. In those records, `source_agency` is EMA and `host_agency` is CSO.

## Access rule

`access_status` describes the retrieval pathway exposed by this prototype; it is not a statement about legal public-access rights or disclosure obligations.

## Interpretation safeguard

Descriptions, topic assignments, relationships, map associations and source classifications are discovery metadata. They do not determine legal effect, applicability, compliance status, regulatory jurisdiction or an EMA position. Formal reliance should use the original published source and applicable EMA process.
