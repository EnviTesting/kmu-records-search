import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
docs = json.loads((root / "data" / "documents.json").read_text(encoding="utf-8"))
errors = []
for d in docs:
    if len(d.get("keyword_common_group", [])) != 5:
        errors.append((d.get("id"), "keyword_common_group must have 5 terms"))
    if len(d.get("keyword_unique", [])) != 5:
        errors.append((d.get("id"), "keyword_unique must have 5 terms"))
    if len(d.get("keyword_discretionary", [])) != 10:
        errors.append((d.get("id"), "keyword_discretionary must have 10 terms"))
    if len(d.get("keywords", [])) != 20:
        errors.append((d.get("id"), "keywords must have 20 terms"))
    if len(set(d.get("keywords", []))) != 20:
        errors.append((d.get("id"), "keywords must be unique within the record"))

if errors:
    print("Validation failed:")
    for err in errors[:50]:
        print(err)
    raise SystemExit(1)

print(f"OK: {len(docs)} records validated with 20 keywords each.")
