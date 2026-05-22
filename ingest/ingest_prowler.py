#!/usr/bin/env python3
"""Normalise Prowler OCSF JSON output and write findings to dashboard/public/."""

import json
import os
import re
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
    "storage_secure_transfer_required_is_enabled": "storage",
}


def redact_resource(uid: str, provider: str) -> str:
    """Strip account/subscription/project identifiers, keep resource type and name."""
    if provider == "aws":
        # arn:aws:s3:::bucket-name → aws:s3:::*** (bucket names redacted)
        if uid.startswith("arn:aws:s3:::"):
            return "aws:s3:::***"
        # arn:aws:cloudtrail:...:trail/name → aws:cloudtrail:*** (trail names redacted)
        if ":cloudtrail:" in uid:
            return "aws:cloudtrail:***"
        # arn:aws:ec2:us-east-1:123456789012:instance/i-abc → aws:ec2:instance/i-abc
        uid = re.sub(r"^arn:aws:", "aws:", uid)
        uid = re.sub(r":\d{12}:", ":", uid)
        uid = re.sub(r":[a-z0-9-]+:\d{12}", "", uid)
        return uid
    if provider == "azure":
        # /subscriptions/<uuid>/resourceGroups/rg/providers/Type/name → azure:Type/name
        uid = re.sub(r"/subscriptions/[^/]+", "", uid)
        uid = re.sub(r"/resourceGroups/[^/]+", "", uid, flags=re.IGNORECASE)
        uid = re.sub(r"/providers/", "", uid, count=1)
        return f"azure:{uid.lstrip('/')}" if uid.strip("/") else "azure:subscription"
    if provider == "gcp":
        # projects/<project-id>/... → gcp:...
        uid = re.sub(r"projects/[^/]+/", "", uid)
        # strip project ID from service account emails
        uid = re.sub(r"@[^.]+\.iam\.gserviceaccount\.com", "@***.iam.gserviceaccount.com", uid)
        # strip numeric prefix from default compute SA (1234567890-compute@developer...)
        uid = re.sub(r"^\d+-compute@developer\.gserviceaccount\.com$", "***-compute@developer.gserviceaccount.com", uid)
        # strip bare project IDs or bare numeric resource IDs (no slashes, not a known safe form)
        if "/" not in uid and "gserviceaccount.com" not in uid and not uid.startswith("locations/"):
            uid = "***"
        return f"gcp:{uid}"
    return uid


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
        raw_uid = resources[0].get("uid", "") if resources else ""
        provider = finding.get("unmapped", {}).get("provider", "").lower()
        resource_uid = redact_resource(raw_uid, provider)

        docs.append({
            "id": str(uuid.uuid4()),
            "source": "prowler",
            "check_id": check_id,
            "title": finding.get("finding_info", {}).get("title", ""),
            "status": status_code.lower(),
            "severity": finding.get("severity", "").lower(),
            "provider": provider,
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
