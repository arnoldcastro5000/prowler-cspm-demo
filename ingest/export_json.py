#!/usr/bin/env python3
"""Read both Firestore collections and write static JSON files to dashboard/public/."""

import json
from pathlib import Path

from google.cloud import firestore

PROJECT_ID = "***REDACTED-GCP-PROJECT***"
OUTPUT_DIR = Path(__file__).parent.parent / "dashboard" / "public"

COLLECTIONS = {
    "findings_before": "findings_before.json",
    "findings_after": "findings_after.json",
}

SCHEMA_FIELDS = (
    "id", "source", "category", "provider", "severity",
    "title", "resource", "check_id", "status", "scanned_at", "raw",
)


def export_collection(db: firestore.Client, collection_name: str, output_path: Path) -> int:
    findings = []
    for doc in db.collection(collection_name).stream():
        d = doc.to_dict()
        finding = {field: d.get(field, "") for field in SCHEMA_FIELDS}
        findings.append(finding)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(findings, f, indent=2, default=str)

    return len(findings)


def main() -> None:
    db = firestore.Client(project=PROJECT_ID)

    for collection_name, filename in COLLECTIONS.items():
        output_path = OUTPUT_DIR / filename
        count = export_collection(db, collection_name, output_path)
        print(f"Exported {count} documents from '{collection_name}' → {output_path}")


if __name__ == "__main__":
    main()
