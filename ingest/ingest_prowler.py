#!/usr/bin/env python3
"""Normalise Prowler OCSF JSON output and write findings to dashboard/public/."""

import json
import os
import sys
import uuid

DASHBOARD_PUBLIC = os.path.join(os.path.dirname(__file__), "..", "dashboard", "public")

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


def ingest(json_file: str, target: str) -> None:
    with open(json_file) as f:
        findings = json.load(f)

    docs = []
    skipped = 0

    for finding in findings:
        status_code = finding.get("status_code", "").upper()
        if status_code not in ("FAIL", "PASS"):
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

        docs.append({
            "id": str(uuid.uuid4()),
            "source": "prowler",
            "check_id": check_id,
            "title": finding.get("finding_info", {}).get("title", ""),
            "status": status_code.lower(),
            "severity": finding.get("severity", "").lower(),
            "provider": finding.get("unmapped", {}).get("provider", "").lower(),
            "category": category,
            "resource": resource_uid,
            "scanned_at": finding.get("time_dt", ""),
            "raw": finding,
        })

    os.makedirs(DASHBOARD_PUBLIC, exist_ok=True)
    out_path = os.path.join(DASHBOARD_PUBLIC, f"{target}.json")
    with open(out_path, "w") as f:
        json.dump(docs, f, indent=2)

    print(f"Wrote {len(docs)} findings to '{out_path}' ({skipped} skipped).")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <json_file> <target>")
        print("  target: findings_before | findings_after")
        sys.exit(1)

    json_file, target = sys.argv[1], sys.argv[2]

    if target not in ("findings_before", "findings_after"):
        print("ERROR: target must be 'findings_before' or 'findings_after'")
        sys.exit(1)

    ingest(json_file, target)
