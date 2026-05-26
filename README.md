# Prowler CSPM

A cloud security reference project that scans real cloud infrastructure across AWS, GCP, and Azure for misconfigurations, then displays a before/after remediation dashboard. Documented for reproducibility.

Live demo → `prowler.cloudsecuritypractice.com`

---

## What This Project Does

**Cloud Security Posture Management (CSPM)**
Prowler scans 15 high-signal checks across AWS, GCP, and Azure — covering IAM, storage, networking, logging, and encryption. The demo environment is intentionally misconfigured using Terraform. Findings are captured as a snapshot, the infrastructure is hardened, and a second snapshot is taken. Both states are published to the dashboard.


The dashboard shows the before state (findings across critical, high, medium, and low severity across three clouds), the after state (all target checks remediated), and the full remediation changelog between the two scans.

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
                              │  Cloudflare Worker                 │
                              │  Injects X-CF-Secret header        │
                              └────────────┬───────────────────────┘
                                           │
                              ┌────────────▼───────────────────────┐
                              │  Cloudflare (CDN · WAF · DDoS · DNS│
                              │  · Workers)                        │
                              │  All public traffic enters here.   │
                              │  Direct Cloud Run access blocked.  │
                              └────────────────────────────────────┘

```

### Security boundary — Cloudflare to Cloud Run

A Cloudflare Worker adds a secret to every request before it reaches Cloud Run. Cloud Run rejects any request missing that secret. SSL mode is Full (Strict) end-to-end.

```
User → Cloudflare edge (WAF · CDN · DDoS) → Cloudflare Worker (injects X-CF-Secret) → Cloud Run (direct access blocked)
                                                                                                  ↑
                                                                             shared secret validated on every request
```

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Cloud environments tested | AWS, GCP, Azure | Demonstrates multi-cloud coverage in a single pipeline |
| Scanner | [Prowler](https://github.com/prowler-cloud/prowler) 5.27.0 | Native multi-cloud CSPM with structured JSON output |
| IaC | Terraform ≥ 1.6 | Reproducible before/after infrastructure states via tfvars toggle |
| Dashboard hosting | GCP Cloud Run | Serverless containers with scale-to-zero |
| Edge | Cloudflare \| CDN, WAF, DDoS protection, DNS | Full edge security layer; origin access blocked without shared secret |
| Secrets | GCP Secret Manager | All cloud credentials fetched at runtime, never stored on disk |
| Registry | GCP Artifact Registry | Docker image storage, GCP-native |
| AI Development | Claude Code (sandboxed) + [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) + [mattpocock/skills](https://github.com/mattpocock/skills) | Agentic workflows (TDD, domain grilling, issue breakdown) with LLM coding guardrails |
| CI/CD | GitHub Actions + Dependabot | Quality gate (tsc, eslint, docker build, shellcheck, trivy, zizmor) + automated dependency updates |
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind + zod | Static bundle with runtime schema validation, containerises cleanly |
| Development environment | WSL2 (Windows Subsystem for Linux) | Local Linux environment for Terraform, Prowler, and Docker |
| Architecture diagrams | [/aws-architecture-diagram](https://github.com/vidanov/aws-architecture-diagram-skill) skill | Generates validated draw.io architecture diagrams using official AWS4 icon libraries |

---

## Prowler Checks

15 checks across 3 providers and 5 categories, each mapped 1:1 to a Terraform variable that toggles the misconfiguration on or off.

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
| `storage_secure_transfer_required_is_enabled` | High | Storage |

Full check-to-Terraform variable mapping in [SETUP.md](SETUP.md).

---

## Reproducing the Demo

All workflows are gated by GitHub Actions — verify all checks are green on main before running any make target.

Infrastructure is created once during setup. `make before` and `make after` toggle the same resources between misconfigured and hardened states — no destroy/recreate between scans.

```bash
# One-time setup — initialises Terraform and creates all resources in the hardened state
make setup

# Scan cycle
make before     # misconfigs all 15 checks, starts EC2
make scan       # runs Prowler locally, writes findings_before.json
make after      # hardens all 15 checks, stops EC2
make rescan     # runs Prowler locally, writes findings_after.json
make deploy     # docker build + push + deploy to Cloud Run (after CI is green)
```

Full setup instructions, prerequisites, and credential configuration in [SETUP.md](SETUP.md).

---

## Cost Summary

### Hosting and operations

| Service | Provider | Cost |
|---|---|---|
| Cloud Run (dashboard hosting) | GCP | Up to 2M requests/month |
| Artifact Registry (image storage) | GCP | Up to 0.5 GB |
| Secret Manager (credentials) | GCP | Up to 6 secret versions / 10K access ops per month |
| Cloudflare (CDN, WAF, DDoS, DNS, Workers) | Cloudflare | 100k Workers requests/day |
| Prowler | Open source | Free |

### AWS resources (scanned by Prowler)

| Service | Cost |
|---|---|
| S3 bucket | Free tier — 5 GB storage, 20K GET, 2K PUT/month |
| EC2 instance (t2.micro) | Free tier — 750 hrs/month (stopped in after state) |
| CloudTrail | First trail free |
| IAM | Free |

### GCP resources (scanned by Prowler)

| Service | Cost |
|---|---|
| Cloud Storage bucket | Free tier — 5 GB, 50K read ops/month |
| Compute Engine firewall rules | Free |
| IAM service account | Free |
| KMS key | ~$0.06/month per active key version |
| Logging metric + alert policy | Free tier |

### Azure resources (scanned by Prowler)

| Service | Cost |
|---|---|
| Storage account | Free tier — 5 GB LRS |
| Network security group | Free |
| Custom role definition | Free |
| Activity log alert | Free |

### Other

| Service | Cost |
|---|---|
| Domain name (required for Cloudflare) | ~$14–21 CAD/year |
| Claude Pro subscription (Canada) | ~$27 CAD/month |

> **Disclaimer:** All costs are approximate and subject to change. Free tier eligibility depends on account age and usage — exceeding limits will incur charges. Canadian dollar amounts vary with exchange rates.

---

## Known Limitations

- Prowler is a point-in-time scanner, not continuous monitoring. The dashboard reflects scan snapshots, not live state.
- Cloudflare's free WAF provides managed rulesets only. Custom rules and advanced rate limiting require a paid plan.
- A domain name is required for Cloudflare integration and is not free.
- GCP Secret Manager covers 6 active secret versions. Azure credentials are consolidated into one JSON secret to stay within this limit.
- Terraform state is stored locally on the WSL2 machine. If the local machine is lost, resources still exist in the cloud but state must be reconstructed via `terraform import`.
- The Cloudflare Worker is in the critical path — if the Worker errors, the site goes down.

---

## Licence

MIT — see [LICENSE](LICENSE).
