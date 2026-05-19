#!/usr/bin/env python3
"""Normalise Prowler OCSF JSON output and write FAIL findings to Firestore."""

import json
import sys
import uuid

from google.cloud import firestore

PROJECT_ID = "***REDACTED-GCP-PROJECT***"

# Maps Prowler check IDs to our schema category values.
# Only checks in this map will be ingested — unknown check IDs are skipped.
CHECK_CATEGORY = {
    # AWS
    "s3_bucket_level_public_access_block": "storage",
    "iam_password_policy_minimum_length_14": "iam",
    "ec2_instance_port_ssh_exposed_to_internet": "networking",
    "cloudtrail_multi_region_enabled": "logging",
    "s3_bucket_default_encryption": "encryption",
    # GCP
    "cloudstorage_bucket_public_access": "storage",
    "compute_firewall_ssh_access_from_the_internet_allowed": "networking",
    "iam_sa_no_administrative_privileges": "iam",
    "logging_log_metric_filter_and_alert_for_audit_configuration_changes_enabled": "logging",
    "kms_key_rotation_enabled": "encryption",
    # Azure
    "storage_blob_public_access_level_is_disabled": "storage",
    "network_rdp_internet_access_restricted": "networking",
    "iam_subscription_roles_owner_custom_not_created": "iam",
    "monitor_alert_create_update_security_solution": "logging",
    "defender_ensure_defender_for_server_is_on": "threat-protection",
}


def ingest(json_file: str, collection_name: str) -> None:
    db = firestore.Client(project=PROJECT_ID)
    collection = db.collection(collection_name)

    with open(json_file) as f:
        findings = json.load(f)

    ingested = skipped = 0

    for finding in findings:
        status_code = finding.get("status_code", "").upper()
        if status_code != "FAIL":
            skipped += 1
            continue

        check_id = finding.get("metadata", {}).get("event_code", "")
        category = CHECK_CATEGORY.get(check_id)
        if category is None:
            print(f"WARNING: unknown check_id '{check_id}' — skipping")
            skipped += 1
            continue

        resources = finding.get("resources", [])
        resource_uid = resources[0].get("uid", "") if resources else ""

        doc_id = str(uuid.uuid4())
        doc = {
            "id": doc_id,
            "source": "prowler",
            "check_id": check_id,
            "title": finding.get("finding_info", {}).get("title", ""),
            "status": "fail",
            "severity": finding.get("severity", "").lower(),
            "provider": finding.get("unmapped", {}).get("provider", "").lower(),
            "category": category,
            "resource": resource_uid,
            "scanned_at": finding.get("time_dt", ""),
            "raw": finding,
        }

        collection.document(doc_id).set(doc)
        ingested += 1

    print(f"Ingested {ingested} findings into '{collection_name}' ({skipped} skipped).")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <json_file> <collection_name>")
        sys.exit(1)

    json_file, collection_name = sys.argv[1], sys.argv[2]

    if collection_name not in ("findings_before", "findings_after"):
        print(f"ERROR: collection_name must be 'findings_before' or 'findings_after'")
        sys.exit(1)

    ingest(json_file, collection_name)
