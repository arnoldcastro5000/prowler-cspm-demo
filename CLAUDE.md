# CLAUDE.md — AI Working Context

This file is the source of truth for every AI coding session in this repo.
Do not deviate from the decisions documented here. Do not add dependencies,
collections, fields, or components not listed here without explicit instruction.

---

## What This Project Is

A DevSecOps reference project that scans real cloud infrastructure across AWS,
GCP, and Azure for misconfigurations using Prowler, then displays a before/after
remediation dashboard. Built entirely on free-tier services. There is no
continuous monitoring — all findings are point-in-time scan snapshots.

---

## Repository Structure

```
/
├── .github/
│   ├── workflows/                   # CI/CD pipelines
│   └── dependabot.yml               # Automated dependency updates (npm, pip, GitHub Actions)
├── iac/
│   ├── modules/
│   │   ├── aws/                     # Reusable AWS Terraform resources
│   │   ├── gcp/                     # Reusable GCP Terraform resources
│   │   └── azure/                   # Reusable Azure Terraform resources
│   └── environments/
│       ├── before/                  # Misconfigured state
│       │   ├── main.tf
│       │   ├── terraform.tfvars     # All insecure toggles = true
│       │   └── backend.tf           # GCS backend
│       └── after/                   # Hardened state
│           ├── main.tf
│           ├── terraform.tfvars     # All insecure toggles = false
│           └── backend.tf           # GCS backend
├── prowler/
│   └── run_scan.sh                  # Fetches secrets from Secret Manager, scans all three providers, writes JSON output files
├── ingest/
│   ├── ingest_prowler.py            # Normalises Prowler JSON → Firestore schema
│   └── export_json.py               # Reads Firestore → writes static JSON to dashboard/public/
├── dashboard/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Before.tsx
│   │   │   └── After.tsx
│   │   ├── types/
│   │   │   └── finding.ts
│   │   └── components/
│   ├── Dockerfile
│   └── ...
├── Makefile
├── CLAUDE.md                        # This file
└── README.md
```

---

## Tech Stack — Exact Versions

| Layer | Technology | Notes |
|---|---|---|
| IaC | Terraform ≥ 1.6 | HCL only, no CDK |
| Scanner | Prowler (latest stable) | CLI, not SDK |
| Ingest | Python 3.11 | ingest_prowler.py + export_json.py |
| Database | GCP Firestore (Native mode) | No SQL, no other collections |
| Backend | GCP Cloud Run | Serves the React app as a container |
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind CSS + shadcn/ui | No other UI frameworks |
| Validation | zod | Runtime schema validation for fetched JSON; `Finding` type inferred from zod schema |
| Linting | ESLint + @typescript-eslint/parser + @typescript-eslint/eslint-plugin | `recommended-type-checked` ruleset; type-aware linting combined with tsc and vite build in CI |
| Edge | Cloudflare (free tier) | DNS, WAF, CDN, DDoS |
| Secrets | GCP Secret Manager | All cloud provider credentials |
| Export | Python 3.11 | export_json.py only |

---

## Firestore

### Collections

| Collection | Written by | Read by |
|---|---|---|
| `findings_before` | Prowler ingest script | export_json.py → findings_before.json |
| `findings_after`  | Prowler ingest script | export_json.py → findings_after.json  |

**Do not create any other collections.**

### Document Schema

Every document in both collections shares this exact shape:

```json
{
  "id": "uuid",
  "source": "prowler",
  "category": "storage | iam | networking | logging | encryption | threat-protection",
  "provider": "aws | gcp | azure",
  "severity": "critical | high | medium | low",
  "title": "string",
  "resource": "arn",
  "check_id": "prowler check ID",
  "status": "fail | pass",
  "scanned_at": "ISO 8601 timestamp",
  "raw": {}
}
```

**Do not add fields to this schema without explicit instruction.**

---

## Prowler Checks — All 15

### AWS
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `s3_bucket_public_access_block` | critical | storage | `s3_bucket_public` |
| `iam_password_policy_minimum_length_14` | medium | iam | `iam_password_policy_min_length` |
| `ec2_securitygroup_allow_ingress_from_internet_to_ssh_port_22` | critical | networking | `security_group_open_ssh` |
| `cloudtrail_multi_region_enabled` | high | logging | `cloudtrail_enabled` |
| `s3_bucket_server_side_encryption_enabled` | high | encryption | `s3_encryption_enabled` |

### GCP
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `gcs_bucket_public_access_prevention` | critical | storage | `gcs_bucket_public` |
| `gcp_compute_firewall_allows_ingress_from_internet_to_ssh` | critical | networking | `firewall_open_ssh` |
| `iam_service_account_admin_privileges` | high | iam | `service_account_admin` |
| `logging_log_metric_filter_audit_config_changes` | high | logging | `audit_logging_enabled` |
| `kms_key_rotation_enabled` | high | encryption | `kms_rotation_enabled` |

### Azure
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `storage_blob_public_access_level_is_disabled` | critical | storage | `blob_public_access` |
| `network_rdp_access_restricted_from_internet` | critical | networking | `nsg_rdp_open` |
| `iam_subscription_roles_owner_custom_not_created` | high | iam | `custom_owner_role` |
| `monitor_activity_log_alert_create_update_security` | high | logging | `activity_log_alerts` |
| `defender_ensure_microsoft_defender_for_cloud_is_set_to_on` | high | threat-protection | `defender_enabled` |

---

## The Two-Environment Pattern

`before` = misconfigured state. All Terraform variables that control
misconfigurations are set to `true`. Prowler fires on all 15 checks.

`after` = hardened state. All Terraform variables are set to `false`. Prowler reports
zero findings.

The `before` and `after` environments use separate Terraform state files
in GCS. They are not the same state — never run `terraform apply` for one
environment inside the other's directory.

---

## Makefile Targets

| Target | Runs where | What it does |
|---|---|---|
| `make before` | Locally | `terraform apply` for `iac/environments/before` |
| `make scan` | e2-micro VM | Fetches secrets, runs Prowler, ingests to Firestore, exports JSON, rebuilds and deploys container |
| `make after` | Locally | `terraform apply` for `iac/environments/after` |
| `make rescan` | e2-micro VM | Same as scan, writes to `findings_after` |

---

## Credentials — Never Commit Any of These

| Secret | Where it lives | Used by |
|---|---|---|
| AWS access key ID | Secret Manager: `<aws-access-key-id-secret>` | Prowler |
| AWS secret access key | Secret Manager: `<aws-secret-access-key-secret>` | Prowler |
| GCP service account key | Secret Manager: `<gcp-service-account-key-secret>` | Prowler + export_json.py |
| Azure credentials (JSON) | Secret Manager: `<azure-credentials-secret>` | Prowler |
| `CF-Access-Secret` | Secret Manager: `<cloudflare-cf-access-secret>` + Cloud Run env var | Origin protection |


---

## Session Start Checklist

At the start of every AI session, before doing any work:

1. Run `gh run list --limit 10` and report any failed or in-progress workflow runs.
2. For any failed run, run `gh run logs <run-id> --failed` and summarise the failure.
3. Do not proceed with new work until failures are acknowledged by the user.

---

## Hard Rules

- **Do not** add npm packages, pip packages, or Terraform providers not already
  in the stack.
- **Do not** create Firestore collections other than `findings_before` and
  `findings_after`.
- **Do not** add fields to the Firestore document schema.
- **Do not** add IAM users outside of what is defined in the Terraform modules.
- **Do not** put credentials, keys, or secrets in any file tracked by git.
- **Do not** use Flexible SSL mode — only Full (Strict).
- **Do not** expose Cloud Run directly — all traffic routes through Cloudflare.
- **Do not** store credentials in `/etc/environment` or any file on disk. All secrets are fetched from GCP Secret Manager at runtime by run_scan.sh.
- The ingest script is ingest_prowler.py. The export script is export_json.py. There is no ingest_semgrep.py.
