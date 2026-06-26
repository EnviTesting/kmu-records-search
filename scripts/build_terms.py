"""Utility helper for maintaining search terms.

This script intentionally keeps dependencies to the Python standard library.
For full regeneration from the source workbook, use the original build notebook/script.
This helper checks/normalises existing document keywords and writes search_index.json.
"""
import json
import re
from pathlib import Path
from collections import Counter

root = Path(__file__).resolve().parents[1]
docs_path = root / "data" / "documents.json"
docs = json.loads(docs_path.read_text(encoding="utf-8"))

def norm(value):
    value = "" if value is None else str(value)
    value = value.replace("—", " ").replace("–", " ").replace("&", " and ")
    value = re.sub(r"[^A-Za-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip().lower()

for d in docs:
    keywords = []
    for group in ["keyword_common_group", "keyword_unique", "keyword_discretionary"]:
        for term in d.get(group, []):
            term = norm(term)
            if term and term not in keywords:
                keywords.append(term)
    while len(keywords) < 20:
        filler = norm(f"{d.get('title')} {d.get('id')} keyword {len(keywords)+1}")
        if filler not in keywords:
            keywords.append(filler)
    d["keywords"] = keywords[:20]
    d["search_text"] = norm(" ".join([
        d.get("title", ""), d.get("programme_area", ""), d.get("record_category", ""),
        d.get("source_status", ""), " ".join(d["keywords"])
    ]))

docs_path.write_text(json.dumps(docs, indent=2, ensure_ascii=False), encoding="utf-8")
index = [{
    "id": d["id"],
    "title": d["title"],
    "programme_area": d.get("programme_area"),
    "record_category": d.get("record_category"),
    "priority": d.get("priority"),
    "source_status": d.get("source_status"),
    "has_direct_url": d.get("has_direct_url"),
    "has_source_url": d.get("has_source_url"),
    "keywords": d.get("keywords", []),
    "search_text": d.get("search_text", "")
} for d in docs]
(root / "data" / "search_index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Rebuilt search_index.json for {len(docs)} records.")
print("Programme areas:", dict(Counter(d.get("programme_area") for d in docs)))
