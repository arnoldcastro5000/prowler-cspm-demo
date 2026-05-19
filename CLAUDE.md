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
│       │   └── terraform.tfstate    # Local state — do not commit
│       └── after/                   # Hardened state
│           ├── main.tf
│           ├── terraform.tfvars     # All insecure toggles = false
│           └── terraform.tfstate    # Local state — do not commit
├── prowler/
│   └── run_scan.sh                  # Fetches secrets from Secret Manager, scans all three providers, writes JSON output files locally
├── ingest/
│   └── ingest_prowler.py            # Normalises Prowler JSON → writes findings JSON directly to dashboard/public/
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
| IaC | Terraform ≥ 1.6 | HCL only, no CDK. State stored locally — do not use GCS backend |
| Scanner | Prowler (latest stable) | CLI, not SDK. Runs locally on WSL2 |
| Ingest | Python 3.11 | ingest_prowler.py only — writes findings JSON directly to dashboard/public/ |
| Backend | GCP Cloud Run | Serves the React app as a container |
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind CSS + shadcn/ui | No other UI frameworks |
| Validation | zod | Runtime schema validation for fetched JSON; `Finding` type inferred from zod schema |
| Linting | ESLint + @typescript-eslint/parser + @typescript-eslint/eslint-plugin | `recommended-type-checked` ruleset; type-aware linting combined with tsc and vite build in CI |
| Edge | Cloudflare (free tier) | DNS, WAF, CDN, DDoS |
| Secrets | GCP Secret Manager | All cloud provider credentials — fetched at runtime by WSL2 |
| Registry | GCP Artifact Registry | Docker image storage |

---

## Findings JSON Schema

`ingest_prowler.py` writes two static JSON files directly to `dashboard/public/`:

| File | Written by | Baked into image by |
|---|---|---|
| `dashboard/public/findings_before.json` | `ingest_prowler.py` after `make scan` | `make deploy` |
| `dashboard/public/findings_after.json` | `ingest_prowler.py` after `make rescan` | `make deploy` |

Every document in both files shares this exact shape:

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
| `s3_bucket_level_public_access_block` | high | storage | `s3_bucket_public` |
| `iam_password_policy_minimum_length_14` | medium | iam | `iam_password_policy_min_length` |
| `ec2_instance_port_ssh_exposed_to_internet` | critical | networking | `security_group_open_ssh` |
| `cloudtrail_multi_region_enabled` | high | logging | `cloudtrail_enabled` |
| `s3_bucket_default_encryption` | medium | encryption | `s3_encryption_enabled` |

### GCP
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `cloudstorage_bucket_public_access` | critical | storage | `gcs_bucket_public` |
| `compute_firewall_ssh_access_from_the_internet_allowed` | critical | networking | `firewall_open_ssh` |
| `iam_sa_no_administrative_privileges` | high | iam | `service_account_admin` |
| `logging_log_metric_filter_and_alert_for_audit_configuration_changes_enabled` | medium | logging | `audit_logging_enabled` |
| `kms_key_rotation_enabled` | low | encryption | `kms_rotation_enabled` |

### Azure
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `storage_blob_public_access_level_is_disabled` | high | storage | `blob_public_access` |
| `network_rdp_internet_access_restricted` | high | networking | `nsg_rdp_open` |
| `iam_subscription_roles_owner_custom_not_created` | high | iam | `custom_owner_role` |
| `monitor_alert_create_update_security_solution` | medium | logging | `activity_log_alerts` |
| `defender_ensure_defender_for_server_is_on` | high | threat-protection | `defender_enabled` |

---

## The Two-Environment Pattern

`before` = misconfigured state. All Terraform variables that control
misconfigurations are set to `true`. Prowler fires on all 15 checks.

`after` = hardened state. All Terraform variables are set to `false`. Prowler reports
zero findings.

The `before` and `after` environments use separate local Terraform state files.
They are not the same state — never run `terraform apply` for one
environment inside the other's directory.

---

## Makefile Targets

| Target | Runs where | What it does |
|---|---|---|
| `make before` | WSL2 | `terraform apply` for `iac/environments/before` |
| `make scan` | WSL2 | Fetches credentials from Secret Manager, runs Prowler locally, runs ingest_prowler.py → writes `findings_before.json` to `dashboard/public/` |
| `make after` | WSL2 | `terraform apply` for `iac/environments/after` |
| `make rescan` | WSL2 | Same as scan, writes `findings_after.json` to `dashboard/public/` |
| `make deploy` | WSL2 | docker build (both JSON files baked in), docker push to Artifact Registry, deploys to Cloud Run — only run after GitHub Actions quality gate is green |

---

## Credentials — Never Commit Any of These

| Secret | Where it lives | Used by |
|---|---|---|
| AWS access key ID | Secret Manager: `<aws-access-key-id-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| AWS secret access key | Secret Manager: `<aws-secret-access-key-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| GCP service account key | Secret Manager: `<gcp-service-account-key-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| Azure credentials (JSON) | Secret Manager: `<azure-credentials-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| `CF-Access-Secret` | Secret Manager: `<cloudflare-cf-access-secret>` + Cloud Run env var | `make deploy` on WSL2 — sets Cloud Run env var at deploy time |


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
- **Do not** add fields to the findings JSON schema without explicit instruction.
- **Do not** add IAM users outside of what is defined in the Terraform modules.
- **Do not** put credentials, keys, or secrets in any file tracked by git.
- **Do not** commit `terraform.tfstate` files — state is local only.
- **Do not** use a GCS backend for Terraform — state is stored locally.
- **Do not** use Flexible SSL mode — only Full (Strict).
- **Do not** expose Cloud Run directly — all traffic routes through Cloudflare at `prowler.cloudsecuritypractice.com`.
- **Do not** store credentials in `/etc/environment` or any file on disk. All secrets are fetched at runtime from GCP Secret Manager by WSL2 using `gcloud auth` ADC.
- The ingest script is `ingest_prowler.py`. There is no `export_json.py` and no `ingest_semgrep.py`.
