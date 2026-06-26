#!/usr/bin/env python3
"""Lightweight data validation for the static GitHub Pages register."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "data" / "documents.json", ROOT / "data" / "press_releases.json"]
REQUIRED = ["id", "title", "keywords"]

def validate(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"{path}: expected a JSON array")
    ids = set()
    problems = []
    for i, rec in enumerate(data, start=1):
        if not isinstance(rec, dict):
            problems.append(f"row {i}: not an object")
            continue
        for field in REQUIRED:
            if field not in rec or rec[field] in (None, ""):
                problems.append(f"row {i}: missing {field}")
        if rec.get("id") in ids:
            problems.append(f"row {i}: duplicate id {rec.get('id')}")
        ids.add(rec.get("id"))
        kws = rec.get("keywords")
        if not isinstance(kws, list):
            problems.append(f"row {i}: keywords must be a list")
        elif len(kws) != 20:
            problems.append(f"row {i}: expected 20 keywords, got {len(kws)}")
    return len(data), problems

def main():
    total = 0
    all_problems = []
    for f in FILES:
        count, problems = validate(f)
        total += count
        print(f"{f.relative_to(ROOT)}: {count} records")
        all_problems.extend([f"{f.name}: {p}" for p in problems])
    print(f"Total records: {total}")
    if all_problems:
        print("\nProblems:")
        for p in all_problems[:200]:
            print("-", p)
        raise SystemExit(1)
    print("Validation passed.")

if __name__ == "__main__":
    main()
