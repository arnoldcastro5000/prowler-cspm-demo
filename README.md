# Prowler CSPM

A DevSecOps reference project that scans real cloud infrastructure across AWS, GCP, and Azure for misconfigurations, then displays a before/after remediation dashboard. Built entirely on free-tier services.

Live demo → `prowler.cloudsecuritypractice.com/before` and `prowler.cloudsecuritypractice.com/after`

---

## What This Project Does

**Cloud Security Posture Management (CSPM)**
Prowler scans 15 high-signal checks across AWS, GCP, and Azure — covering IAM, storage, networking, logging, and encryption. The demo environment is intentionally misconfigured using Terraform. Findings are captured as a snapshot, the infrastructure is hardened, and a second snapshot is taken. Both states are published to the dashboard.


The dashboard shows the before state (15 findings across critical, high, and medium severity across three clouds), the after state (zero findings), and the full remediation changelog between the two scans.

---

## Architecture

```

┌─────────────────────────────────────────────────────────┐
│  GCP Secret Manager                                     │
│  AWS · GCP · Azure · Cloudflare credentials             │
└───────────────┬─────────────────────────────────────────┘
                │ fetched at runtime by
┌───────────────▼─────────────────────────────────────────┐
│  Cloud Targets (demo accounts)                          │
│  AWS  ·  GCP  ·  Azure                                  │
└───────────────┬─────────────────────────────────────────┘
                │ scanned by (on demand)
┌───────────────▼─────────────────────────────────────────┐
│  GCP e2-micro (always-free VM)                          │
│  Prowler open-source · on-demand                        │
└───────────────┬─────────────────────────────────────────┘
                │ writes findings
┌───────────────▼─────────────────────────────────────────┐
│  GCP Firestore (always-free)                            │
│  findings_before  ·  findings_after                     │
└───────────────┬─────────────────────────────────────────┘
                │ exported by
┌───────────────▼─────────────────────────────────────────┐
│  export_json.py (runs on e2-micro)                      │
│  findings_before.json  ·  findings_after.json           │
└───────────────┬─────────────────────────────────────────┘
                │ bundled into
┌───────────────▼─────────────────────────────────────────┐
│  GCP Cloud Run · React + Vite (containerised)           │
│  prowler.cloudsecuritypractice.com                      │
└───────────────┬─────────────────────────────────────────┘
                │ origin — proxied through
┌───────────────▼─────────────────────────────────────────┐
│  Cloudflare (CDN · WAF · DDoS protection · DNS)         │
│  All public traffic enters here. Direct access to       │
│  Cloud Run origin is blocked.                           │
└─────────────────────────────────────────────────────────┘

```

### Security boundary — Cloudflare to Cloud Run

Cloud Run rejects any request missing a Cloudflare-issued `CF-Access-Secret` header, preventing origin bypass — a common misconfiguration in reverse proxy setups. SSL mode is Full (Strict) end-to-end.

```
User → Cloudflare edge (WAF · CDN · DDoS) → Cloud Run (origin, not public)
                                          ↑
                             CF-Access-Secret header required
```

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Scanner | Prowler (open source) | Native multi-cloud CSPM, structured JSON output |
| IaC | Terraform | Reproducible before/after infrastructure states |
| Database | GCP Firestore | Always-free, schemaless, no server to manage |
| Backend | GCP Cloud Run | Serverless containers, always-free tier, GCP-native |
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind + shadcn/ui | Static bundle, modern UI components, containerises cleanly |
| Validation | zod | Runtime schema validation for fetched JSON |
| Edge security | Cloudflare (free tier) | CDN, WAF, DDoS protection, DNS |
| Secrets | GCP Secret Manager | Credential storage for all cloud provider keys |
| Export | Python 3.11 (export_json.py) | Firestore → static JSON for frontend |

---

## Prowler Checks

15 checks across 3 providers and 6 categories, each mapped 1:1 to a Terraform variable that toggles the misconfiguration on or off.

### AWS
| Check ID | Severity | Category |
|---|---|---|
| `s3_bucket_level_public_access_block` | High | Storage |
| `iam_password_policy_minimum_length_14` | Medium | IAM |
| `ec2_instance_port_ssh_exposed_to_internet` | Critical | Networking |
| `cloudtrail_multi_region_enabled` | High | Logging |
| `s3_bucket_default_encryption` | Medium | Encryption |

### GCP
| Check ID | Severity | Category |
|---|---|---|
| `cloudstorage_bucket_public_access` | Critical | Storage |
| `compute_firewall_ssh_access_from_the_internet_allowed` | Critical | Networking |
| `iam_sa_no_administrative_privileges` | High | IAM |
| `logging_log_metric_filter_and_alert_for_audit_configuration_changes_enabled` | Medium | Logging |
| `kms_key_rotation_enabled` | Low | Encryption |

### Azure
| Check ID | Severity | Category |
|---|---|---|
| `storage_blob_public_access_level_is_disabled` | Critical | Storage |
| `network_rdp_access_restricted_from_internet` | Critical | Networking |
| `iam_subscription_roles_owner_custom_not_created` | High | IAM |
| `monitor_activity_log_alert_create_update_security` | High | Logging |
| `defender_ensure_microsoft_defender_for_cloud_is_set_to_on` | High | threat-protection |

Full check-to-Terraform variable mapping in [SETUP.md](SETUP.md).

---

## Reproducing the Demo

```bash
make before     # provisions misconfigured infrastructure
make scan       # runs Prowler, writes to findings_before
make after      # provisions hardened infrastructure
make rescan     # runs Prowler, writes to findings_after
```

Full setup instructions, prerequisites, and credential configuration in [SETUP.md](SETUP.md).

---

## Free Tier Summary

| Service | Provider | Cost |
|---|---|---|
| e2-micro VM (Prowler runner) | GCP | Always free |
| Firestore (findings store) | GCP | Always free up to 1 GB / 20K writes per day |
| Cloud Storage (Terraform state) | GCP | Always free up to 5 GB |
| Cloud Run (dashboard hosting) | GCP | Always free up to 2M requests/month |
| Cloudflare (CDN, WAF, DDoS, DNS) | Cloudflare | Always free |
| Prowler | Open source | Free |
| Secret Manager | GCP | Free up to 6 secret versions / 10K access ops per month |

---

## Known Limitations

- Prowler is a point-in-time scanner, not continuous monitoring. The dashboard reflects scan snapshots, not live state.
- The e2-micro has 1 GB RAM. Prowler scans each provider sequentially to stay within memory limits.
- Firestore free tier resets daily. High-volume rescanning could approach write limits.
- Cloudflare's free WAF provides managed rulesets only. Custom rules and advanced rate limiting require a paid plan.
- A domain name is required for Cloudflare integration and is not free.
- GCP Secret Manager free tier covers 6 active secret versions. Azure credentials
  are consolidated into one JSON secret to stay within this limit.

---

## Licence

MIT — see [LICENSE](LICENSE).
