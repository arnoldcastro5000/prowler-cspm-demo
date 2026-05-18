# Setup Guide

Full reproduction instructions for the Prowler CSPM demo. Everything here assumes you are starting from scratch with three fresh cloud accounts.

---

## Makefile Workflow

```bash
make before     # provisions misconfigured infrastructure (runs locally)
make scan       # runs Prowler → ingests to Firestore → exports JSON → rebuilds and deploys container
make after      # provisions hardened infrastructure (runs locally)
make rescan     # runs Prowler → ingests to Firestore → exports JSON → rebuilds and deploys container
```

`make before` and `make after` run locally with your cloud CLIs authenticated.
`make scan` and `make rescan` execute on the GCP e2-micro VM: they run Prowler,
ingest findings to Firestore, export static JSON files, rebuild the container,
and redeploy to Cloud Run.

---

## Prerequisites

### 1. Cloud accounts (demo/disposable)
- [ ] AWS free tier account → [aws.amazon.com/free](https://aws.amazon.com/free)
- [ ] GCP free tier account → [cloud.google.com/free](https://cloud.google.com/free)
- [ ] Azure free tier account → [azure.microsoft.com/free](https://azure.microsoft.com/en-us/free)

### 2. GCP infrastructure
Same GCP account hosts the VM, database, Terraform state, and dashboard.

- [ ] Create a GCP project
- [ ] Enable Firestore in Native mode → [Firestore setup](https://cloud.google.com/firestore/docs/quickstart-servers)
- [ ] Create a Cloud Storage bucket for Terraform state
- [ ] Enable Compute Engine API

  > **Warning:** enabling the Compute Engine API automatically creates four default
  > firewall rules that open SSH (port 22), RDP (port 3389), and ICMP to the
  > entire internet (`0.0.0.0/0`). These must be deleted immediately before
  > provisioning any VM.

- [ ] Delete default firewall rules immediately after enabling Compute Engine:
  - Delete `default-allow-ssh`
  - Delete `default-allow-rdp`
  - Delete `default-allow-icmp`
- [ ] Enable IAP API and create `allow-ssh-iap` firewall rule (source: `35.235.240.0/20`, TCP 22)
- [ ] Grant your user account `roles/iap.tunnelResourceAccessor`
- [ ] Provision an e2-micro Compute Engine instance (US region) → [free tier details](https://cloud.google.com/free/docs/free-cloud-features#compute)
- [ ] Enable Cloud Run API → [Cloud Run setup](https://cloud.google.com/run/docs/setup)
- [ ] Enable Secret Manager API → [Secret Manager setup](https://cloud.google.com/secret-manager/docs/quickstart)
- [ ] Enable Container Registry or Artifact Registry API for container builds
- [ ] Set Cloud Run to require `CF-Access-Secret` header — reject all requests that omit it

### 3. Prowler credentials (stored in GCP Secret Manager)
- [ ] AWS: create an IAM user with `SecurityAudit` managed policy attached
      → generate access key pair → store as two secrets in Secret Manager
      (`<aws-access-key-id-secret>` and `<aws-secret-access-key-secret>`)
      → [AWS IAM docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_managed-vs-inline.html)
- [ ] GCP: create a service account with `Viewer`, `Security Reviewer`,
      and `Cloud Datastore User` roles → generate key file → store as one secret
      (`<gcp-service-account-key-secret>`) in Secret Manager
      → [GCP service accounts](https://cloud.google.com/iam/docs/service-accounts-create)
- [ ] Azure: create a service principal with `Reader` role on the subscription
      → consolidate all four values into one JSON secret (`<azure-credentials-secret>`):
      `{"client_id":"...","client_secret":"...","tenant_id":"...","subscription_id":"..."}`
      → [Azure service principal](https://learn.microsoft.com/en-us/cli/azure/create-an-azure-service-principal-azure-cli)
- [ ] Cloudflare: store CF-Access-Secret value as `<cloudflare-cf-access-secret>` in Secret Manager
- [ ] Grant the e2-micro Compute Engine service account
      `Secret Manager Secret Accessor` role on all `prowler/*` secrets
- [ ] Do NOT store any credentials in `/etc/environment` or any file on disk

### 4. Terraform CLI
- [ ] Install Terraform ≥ 1.6 → [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install)
- [ ] Authenticate to AWS, GCP, and Azure CLIs locally before running `make before`

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
| `s3_bucket_public_access_block` | Critical | Storage | `s3_bucket_public` |
| `iam_password_policy_minimum_length_14` | Medium | IAM | `iam_password_policy_min_length` |
| `ec2_securitygroup_allow_ingress_from_internet_to_ssh_port_22` | Critical | Networking | `security_group_open_ssh` |
| `cloudtrail_multi_region_enabled` | High | Logging | `cloudtrail_enabled` |
| `s3_bucket_server_side_encryption_enabled` | High | Encryption | `s3_encryption_enabled` |

### GCP
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `gcs_bucket_public_access_prevention` | Critical | Storage | `gcs_bucket_public` |
| `gcp_compute_firewall_allows_ingress_from_internet_to_ssh` | Critical | Networking | `firewall_open_ssh` |
| `iam_service_account_admin_privileges` | High | IAM | `service_account_admin` |
| `logging_log_metric_filter_audit_config_changes` | High | Logging | `audit_logging_enabled` |
| `kms_key_rotation_enabled` | High | Encryption | `kms_rotation_enabled` |

### Azure
| Check ID | Severity | Category | Terraform Variable |
|---|---|---|---|
| `storage_blob_public_access_level_is_disabled` | Critical | Storage | `blob_public_access` |
| `network_rdp_access_restricted_from_internet` | Critical | Networking | `nsg_rdp_open` |
| `iam_subscription_roles_owner_custom_not_created` | High | IAM | `custom_owner_role` |
| `monitor_activity_log_alert_create_update_security` | High | Logging | `activity_log_alerts` |
| `defender_ensure_microsoft_defender_for_cloud_is_set_to_on` | High | threat-protection | `defender_enabled` |

---

## Firestore Collections

| Collection | Written by | Read by |
|---|---|---|
| `findings_before` | Prowler ingest script | export_json.py → findings_before.json |
| `findings_after`  | Prowler ingest script | export_json.py → findings_after.json  |


### Document schema

All findings (Prowler) share this normalised shape:

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
| AWS access key ID | Secret Manager: `<aws-access-key-id-secret>` | Prowler |
| AWS secret access key | Secret Manager: `<aws-secret-access-key-secret>` | Prowler |
| GCP service account key | Secret Manager: `<gcp-service-account-key-secret>` | Prowler + export_json.py |
| Azure credentials (JSON) | Secret Manager: `<azure-credentials-secret>` | Prowler |
| `CF-Access-Secret` | Secret Manager: `<cloudflare-cf-access-secret>` + Cloud Run env var | Origin protection |

The e2-micro fetches all secrets at runtime via the Secret Manager API.
No credentials are stored on disk. The VM's attached service account
is the only identity that needs to exist outside Secret Manager.

Never commit any of the above to the repository.
