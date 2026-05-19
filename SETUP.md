# Setup Guide

Full reproduction instructions for the Prowler CSPM demo. Everything here assumes you are starting from scratch with three fresh cloud accounts.

---

## Makefile Workflow

All targets run locally on WSL2. GitHub Actions must be green on `main` before running any make target.

```bash
make before     # provisions misconfigured infrastructure (local Terraform)
make scan       # runs Prowler locally, writes findings_before.json to dashboard/public/
make after      # provisions hardened infrastructure (local Terraform)
make rescan     # runs Prowler locally, writes findings_after.json to dashboard/public/
make deploy     # docker build (JSON baked in) → docker push → deploy to Cloud Run
```

`make before` and `make after` apply Terraform against the cloud providers using locally
authenticated CLIs. State is written to local `terraform.tfstate` files — no remote backend.

`make scan` and `make rescan` fetch credentials from Secret Manager using local `gcloud auth`
ADC, run Prowler locally against all three providers, and run `ingest_prowler.py` to write
normalised findings JSON directly to `dashboard/public/`.

`make deploy` builds the Docker image with the JSON files already in `dashboard/public/`,
pushes to Artifact Registry, and deploys to Cloud Run. Only run after GitHub Actions
quality gate is green on main.

---

## Prerequisites

### 1. Cloud accounts (demo/disposable)
- [ ] AWS free tier account → [aws.amazon.com/free](https://aws.amazon.com/free)
- [ ] GCP free tier account → [cloud.google.com/free](https://cloud.google.com/free)
- [ ] Azure free tier account → [azure.microsoft.com/free](https://azure.microsoft.com/en-us/free)

### 2. Local tools (WSL2)

- [ ] Docker → [Install Docker on WSL2](https://docs.docker.com/desktop/wsl/)
- [ ] gcloud CLI → [Install gcloud](https://cloud.google.com/sdk/docs/install)
- [ ] Terraform ≥ 1.6 → [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install)
- [ ] Prowler (latest stable) → [Prowler installation](https://docs.prowler.com/projects/prowler-open-source/en/latest/getting-started/installation/)
- [ ] Node.js + npm → [nodejs.org](https://nodejs.org/)
- [ ] Run `gcloud auth login` and `gcloud auth application-default login`
- [ ] Run `gcloud auth configure-docker <region>-docker.pkg.dev` to authenticate Docker to Artifact Registry
- [ ] Authenticate to AWS, GCP, and Azure CLIs for Terraform
- [ ] Add `terraform.tfstate` and `terraform.tfstate.backup` to `.gitignore` in both `iac/environments/before/` and `iac/environments/after/`

### 3. GCP infrastructure
Same GCP account hosts the dashboard, image registry, and credentials.

- [ ] Create a GCP project
- [ ] Enable Cloud Run API → [Cloud Run setup](https://cloud.google.com/run/docs/setup)
- [ ] Enable Secret Manager API → [Secret Manager setup](https://cloud.google.com/secret-manager/docs/quickstart)
- [ ] Enable Artifact Registry API → [Artifact Registry setup](https://cloud.google.com/artifact-registry/docs/docker/quickstart)
- [ ] Create a Docker repository in Artifact Registry
- [ ] Set Cloud Run to require `CF-Access-Secret` header — reject all requests that omit it

### 4. Credentials (stored in GCP Secret Manager)
- [ ] AWS: create an IAM user with `SecurityAudit` managed policy attached
      → generate access key pair → store as two secrets in Secret Manager
      (`<aws-access-key-id-secret>` and `<aws-secret-access-key-secret>`)
      → [AWS IAM docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_managed-vs-inline.html)
- [ ] GCP: create a service account with `Viewer` and `Security Reviewer` roles
      → generate key file → store as one secret (`<gcp-service-account-key-secret>`) in Secret Manager
      → [GCP service accounts](https://cloud.google.com/iam/docs/service-accounts-create)
- [ ] Azure: create a service principal with `Reader` role on the subscription
      → consolidate all four values into one JSON secret (`<azure-credentials-secret>`):
      `{"client_id":"...","client_secret":"...","tenant_id":"...","subscription_id":"..."}`
      → [Azure service principal](https://learn.microsoft.com/en-us/cli/azure/create-an-azure-service-principal-azure-cli)
- [ ] Cloudflare: store CF-Access-Secret value as `<cloudflare-cf-access-secret>` in Secret Manager
- [ ] Grant your local user account `Secret Manager Secret Accessor` role on all five secrets
- [ ] Do NOT store any credentials in `/etc/environment` or any file on disk

### 5. Cloudflare
- [ ] Acquire a domain (any registrar)
- [ ] Add site to Cloudflare and point domain nameservers to Cloudflare → [Cloudflare DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/)
- [ ] Create a DNS CNAME record for `prowler.cloudsecuritypractice.com` pointing to your Cloud Run service URL
- [ ] Set SSL/TLS mode to **Full (Strict)** — not Flexible
- [ ] Add a WAF custom rule to block requests not originating from Cloudflare IPs
- [ ] Generate a `CF-Access-Secret` header value and configure it in both Cloudflare (send on all requests) and Cloud Run (reject if missing)

---

## Prowler Check → Terraform Variable Mapping

Each check maps 1:1 to a Terraform variable in `iac/environments/before/terraform.tfvars` (all set to `true`) and `iac/environments/after/terraform.tfvars` (all set to `false`).

### AWS
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `s3_bucket_level_public_access_block` | High | Storage | `s3_bucket_public` |
| `iam_password_policy_minimum_length_14` | Medium | IAM | `iam_password_policy_min_length` |
| `ec2_instance_port_ssh_exposed_to_internet` | Critical | Networking | `security_group_open_ssh` |
| `cloudtrail_multi_region_enabled` | High | Logging | `cloudtrail_enabled` |
| `s3_bucket_default_encryption` | Medium | Encryption | `s3_encryption_enabled` |

### GCP
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `cloudstorage_bucket_public_access` | Critical | Storage | `gcs_bucket_public` |
| `compute_firewall_ssh_access_from_the_internet_allowed` | Critical | Networking | `firewall_open_ssh` |
| `iam_sa_no_administrative_privileges` | High | IAM | `service_account_admin` |
| `logging_log_metric_filter_and_alert_for_audit_configuration_changes_enabled` | Medium | Logging | `audit_logging_enabled` |
| `kms_key_rotation_enabled` | Low | Encryption | `kms_rotation_enabled` |

### Azure
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `storage_blob_public_access_level_is_disabled` | High | Storage | `blob_public_access` |
| `network_rdp_internet_access_restricted` | High | Networking | `nsg_rdp_open` |
| `iam_subscription_roles_owner_custom_not_created` | High | IAM | `custom_owner_role` |
| `monitor_alert_create_update_security_solution` | Medium | Logging | `activity_log_alerts` |
| `defender_ensure_defender_for_server_is_on` | High | threat-protection | `defender_enabled` |

---

## Findings JSON Schema

`ingest_prowler.py` writes two static JSON files directly to `dashboard/public/`:

| File | Written by |
|---|---|
| `dashboard/public/findings_before.json` | `ingest_prowler.py` after `make scan` |
| `dashboard/public/findings_after.json` | `ingest_prowler.py` after `make rescan` |

Both files are JSON arrays. Every document shares this shape:

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

---

## Credentials Reference

| Secret | Where it lives | Used by |
|---|---|---|
| AWS access key ID | Secret Manager: `<aws-access-key-id-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| AWS secret access key | Secret Manager: `<aws-secret-access-key-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| GCP service account key | Secret Manager: `<gcp-service-account-key-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| Azure credentials (JSON) | Secret Manager: `<azure-credentials-secret>` | Prowler (fetched by WSL2 during `make scan`) |
| `CF-Access-Secret` | Secret Manager: `<cloudflare-cf-access-secret>` + Cloud Run env var | `make deploy` on WSL2 — sets Cloud Run env var at deploy time |

All secrets are fetched at runtime from Secret Manager by WSL2 using `gcloud auth` ADC.
No credentials are stored on disk.

Never commit any of the above to the repository.
