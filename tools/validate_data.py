#!/usr/bin/env python3
"""Validation for the static EMA Document Search Tool corpus."""
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "data" / "documents.json",
    ROOT / "data" / "press_releases.json",
    ROOT / "data" / "judgments.json",
]
REQUIRED = ["id", "title", "keywords", "corpus_version"]

def valid_url(value):
    if not value:
        return True
    try:
        p = urlparse(str(value))
        return p.scheme in {"http", "https"} and bool(p.netloc)
    except Exception:
        return False

def validate(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"{path}: expected a JSON array")
    ids = set(); problems = []
    for i, rec in enumerate(data, start=1):
        if not isinstance(rec, dict):
            problems.append(f"row {i}: not an object"); continue
        for field in REQUIRED:
            if field not in rec or rec[field] in (None, ""):
                problems.append(f"row {i}: missing {field}")
        rid = rec.get("id")
        if rid in ids: problems.append(f"row {i}: duplicate id {rid}")
        ids.add(rid)
        kws = rec.get("keywords")
        if not isinstance(kws, list) or not kws:
            problems.append(f"row {i}: keywords must be a non-empty list")
        if not (rec.get("description") or rec.get("summary_snippet")):
            problems.append(f"row {i}: missing contextual description")
        for field in ["source_url", "direct_url", "source_page_url", "description_source_url"]:
            if not valid_url(rec.get(field)): problems.append(f"row {i}: invalid {field}: {rec.get(field)}")
        if path.name == "judgments.json":
            for field in ["court", "record_type", "case_status", "source_url"]:
                if not rec.get(field): problems.append(f"row {i}: judgment/proceeding missing {field}")
    return len(data), problems, ids

def main():
    total = 0; all_problems = []; all_ids = set()
    for f in FILES:
        count, problems, ids = validate(f); total += count
        overlap = all_ids & ids
        if overlap: problems.append(f"IDs duplicated across record sets: {sorted(overlap)[:10]}")
        all_ids |= ids
        print(f"{f.relative_to(ROOT)}: {count} records")
        all_problems.extend([f"{f.name}: {p}" for p in problems])
    print(f"Total records: {total}")
    if all_problems:
        print("\nProblems:")
        for p in all_problems[:300]: print("-", p)
        raise SystemExit(1)
    print("Validation passed.")

if __name__ == "__main__": main()
