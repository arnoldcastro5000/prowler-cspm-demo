# Prowler CSPM

A DevSecOps reference project that scans real cloud infrastructure across AWS, GCP, and Azure for misconfigurations, then displays a before/after remediation dashboard. Built entirely on free-tier services.

Live demo → `prowler.cloudsecuritypractice.com/before` and `prowler.cloudsecuritypractice.com/after`

---

## What This Project Does

**Cloud Security Posture Management (CSPM)**
Prowler scans 15 high-signal checks across AWS, GCP, and Azure — covering IAM, storage, networking, logging, and encryption. The demo environment is intentionally misconfigured using Terraform. Findings are captured as a snapshot, the infrastructure is hardened, and a second snapshot is taken. Both states are published to the dashboard.


The dashboard shows the before state (15 findings across critical, high, medium, and low severity across three clouds), the after state (zero findings), and the full remediation changelog between the two scans.

---

## Architecture

```

┌─────────────────────────────────────────────────────────┐
│  GitHub Actions (quality gate)                          │
│  Validates all code before any infrastructure work      │
└───────────────┬─────────────────────────────────────────┘
                │ must pass before proceeding
┌───────────────▼─────────────────────────────────────────┐
│  WSL2 (local)                                           │
│  Terraform · Prowler · ingest_prowler.py                │
│  docker build · docker push · gcloud run deploy         │
└──────┬────────────────────────────────────┬─────────────┘
       │ fetches credentials at runtime     │ scans
┌──────▼──────────────────┐   ┌────────────▼────────────────────────┐
│  GCP Secret Manager     │   │  Cloud Targets (demo accounts)      │
│  All credentials        │   │  AWS · GCP · Azure                  │
└─────────────────────────┘   └─────────────────────────────────────┘

                     findings JSON baked into image at build time
                              ┌────────────────────────────────────┐
                              │  GCP Artifact Registry             │
                              └────────────┬───────────────────────┘
                                           │ deployed to
                              ┌────────────▼───────────────────────┐
                              │  GCP Cloud Run · React + Vite      │
                              │  prowler.cloudsecuritypractice.com │
                              └────────────┬───────────────────────┘
                                           │ origin — proxied through
                              ┌────────────▼───────────────────────┐
                              │  Cloudflare (CDN · WAF · DDoS · DNS│
                              │  All public traffic enters here.   │
                              │  Direct Cloud Run access blocked.  │
                              └────────────────────────────────────┘

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
| Ingest | Python 3.11 (ingest_prowler.py) | Normalises Prowler output → findings JSON baked into image |
| Backend | GCP Cloud Run | Serverless containers, always-free tier, GCP-native |
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind + shadcn/ui | Static bundle, modern UI components, containerises cleanly |
| Validation | zod | Runtime schema validation for fetched JSON |
| Edge security | Cloudflare (free tier) | CDN, WAF, DDoS protection, DNS |
| Secrets | GCP Secret Manager | Credential storage for all cloud provider keys |
| Registry | GCP Artifact Registry | Docker image storage |

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
| `storage_blob_public_access_level_is_disabled` | High | Storage |
| `network_rdp_internet_access_restricted` | High | Networking |
| `iam_subscription_roles_owner_custom_not_created` | High | IAM |
| `monitor_alert_create_update_security_solution` | Medium | Logging |
| `defender_ensure_defender_for_server_is_on` | High | threat-protection |

Full check-to-Terraform variable mapping in [SETUP.md](SETUP.md).

---

## Reproducing the Demo

All workflows are gated by GitHub Actions — verify all checks are green on main before running any make target.

Infrastructure is created once during setup. `make before` and `make after` toggle the same resources between misconfigured and hardened states — no destroy/recreate between scans.

```bash
# One-time setup (from iac/environments/)
terraform init && terraform apply -var-file=after.tfvars

# Scan cycle
make before     # misconfigs all 15 checks, starts EC2
make scan       # runs Prowler locally, writes findings_before.json
make after      # hardens all 15 checks, stops EC2
make rescan     # runs Prowler locally, writes findings_after.json
make deploy     # docker build + push + deploy to Cloud Run (after CI is green)
```

Full setup instructions, prerequisites, and credential configuration in [SETUP.md](SETUP.md).

---

## Free Tier Summary

| Service | Provider | Cost |
|---|---|---|
| Cloud Run (dashboard hosting) | GCP | Always free up to 2M requests/month |
| Artifact Registry (image storage) | GCP | Free up to 0.5 GB |
| Secret Manager (credentials) | GCP | Free up to 6 secret versions / 10K access ops per month |
| Cloudflare (CDN, WAF, DDoS, DNS) | Cloudflare | Always free |
| Prowler | Open source | Free |

---

## Known Limitations

- Prowler is a point-in-time scanner, not continuous monitoring. The dashboard reflects scan snapshots, not live state.
- Cloudflare's free WAF provides managed rulesets only. Custom rules and advanced rate limiting require a paid plan.
- A domain name is required for Cloudflare integration and is not free.
- GCP Secret Manager free tier covers 6 active secret versions. Azure credentials are consolidated into one JSON secret to stay within this limit.
- Terraform state is stored locally in `iac/environments/`. If the local machine is lost, resources still exist in the cloud but state must be reconstructed via `terraform import`.

---

## Licence

MIT — see [LICENSE](LICENSE).
