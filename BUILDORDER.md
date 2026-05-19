# BUILDORDER.md — Build Sequence

Work through this file top to bottom. Each item is one AI session.
Check items off as you complete them. Do not skip ahead — later items
depend on earlier ones being correct and tested.

At the start of every AI session, provide:
1. The contents of `CLAUDE.md`
2. This file with completed items checked
3. The specific item you are building

---

## Phase 0 — GitHub Actions

Create all CI workflows before writing any application code. Workflows run on
PR and push to main unless otherwise noted. Path filters ensure each workflow
only triggers when relevant files change.

---

- [ ] **`.github/workflows/frontend-ci.yml`**

  Runs on all PRs and pushes to main. Steps in order:
  1. `tsc --noEmit` — type check
  2. `eslint src` — lint with `recommended-type-checked` ruleset
  3. `vite build` — production build
  All three steps run in sequence; failure stops the pipeline.

- [ ] **`.github/workflows/terraform-validate.yml`**

  Path filter: `iac/**`. Matrix over `before` and `after` environments.
  Steps: `terraform fmt --check`, `terraform init -backend=false`, `terraform validate`.

- [ ] **`.github/workflows/secret-scan.yml`**

  Runs on every push and PR (no path filter — scans all files).
  Uses `gitleaks/gitleaks-action@v2`.

- [ ] **`.github/workflows/python-lint.yml`**

  Path filter: `ingest/**`. Runs `ruff check ingest/` against Python 3.11.

- [ ] **`.github/workflows/docker-build.yml`**

  Path filter: `dashboard/**`. Builds the Docker image without pushing.
  Validates the container compiles before it reaches Cloud Run.

- [ ] **`.github/workflows/shellcheck.yml`**

  Path filter: `prowler/**`. Lints `run_scan.sh` with `ludeeus/action-shellcheck`.

- [ ] **`.github/workflows/trivy.yml`**

  Path filter: `iac/**`. Runs on PRs and push to main. Scans Terraform for
  misconfigurations using `aquasecurity/trivy-action` (replaces deprecated tfsec).
  Uploads findings to GitHub Security tab via SARIF.

- [ ] **`.github/workflows/zizmor.yml`**

  Path filter: `.github/workflows/**`. Runs on PRs and push to main.
  Static security analysis of GitHub Actions workflow files using
  `zizmorcore/zizmor-action`. Findings uploaded to GitHub Security tab
  (Advanced Security — free for public repos).

- [ ] **`.github/dependabot.yml`**

  Runs every Monday 09:00 UTC. Opens automated PRs for outdated or vulnerable
  dependencies across three ecosystems: npm (`/dashboard`), pip (`/ingest`),
  and GitHub Actions (`/`).

---

## Phase 1 — Terraform Modules

These are the reusable building blocks. Build all three before touching
the environments. Each module defines resources and variables only —
no provider configuration, no backend.

---

- [ ] **`iac/modules/aws/main.tf`**

  Define the 5 AWS resources controlled by Terraform variables.
  Each variable is a boolean — `true` = misconfigured, `false` = hardened.

  | Variable | Resource | Misconfigured when true |
  |---|---|---|
  | `s3_bucket_public` | `aws_s3_bucket_public_access_block` | public access block disabled |
  | `iam_password_policy_min_length` | `aws_iam_account_password_policy` | `minimum_password_length = 8` |
  | `security_group_open_ssh` | `aws_security_group` | ingress port 22 open to `0.0.0.0/0` |
  | `cloudtrail_enabled` | `aws_cloudtrail` | trail not created |
  | `s3_encryption_enabled` | `aws_s3_bucket_server_side_encryption_configuration` | encryption not applied |

  Hardened equivalents: public access block enabled, `minimum_password_length = 14`,
  SSH restricted to no source, CloudTrail multi-region trail created, SSE-S3 applied.

---

- [ ] **`iac/modules/gcp/main.tf`**

  Define the 5 GCP resources controlled by Terraform variables.

  | Variable | Resource | Misconfigured when true |
  |---|---|---|
  | `gcs_bucket_public` | `google_storage_bucket` | `public_access_prevention = "inherited"` |
  | `firewall_open_ssh` | `google_compute_firewall` | ingress port 22 open to `0.0.0.0/0` |
  | `service_account_admin` | `google_project_iam_member` | service account has `roles/editor` or higher |
  | `audit_logging_enabled` | `google_logging_metric` | log metric filter for audit config changes not created |
  | `kms_rotation_enabled` | `google_kms_crypto_key` | `rotation_period` not set |

  Hardened equivalents: `public_access_prevention = "enforced"`, SSH firewall rule removed,
  service account has `roles/viewer` only, log metric created, rotation period set to `7776000s` (90 days).

---

- [ ] **`iac/modules/azure/main.tf`**

  Define the 5 Azure resources controlled by Terraform variables.

  | Variable | Resource | Misconfigured when true |
  |---|---|---|
  | `blob_public_access` | `azurerm_storage_account` | `allow_nested_items_to_be_public = true` |
  | `nsg_rdp_open` | `azurerm_network_security_group` | ingress port 3389 open to `0.0.0.0/0` |
  | `custom_owner_role` | `azurerm_role_definition` | custom role with `Owner`-equivalent permissions created |
  | `activity_log_alerts` | `azurerm_monitor_activity_log_alert` | alert for security policy changes not created |
  | `defender_enabled` | `azurerm_security_center_subscription_pricing` | Defender for Cloud set to `Free` tier |

  Hardened equivalents: `allow_nested_items_to_be_public = false`, RDP rule removed,
  custom owner role not created, activity log alert created, Defender set to `Standard` tier.

---

## Phase 2 — Terraform Environments

Environments consume the modules. Build `before` first — it is the
reference state. `after` mirrors it with all variables flipped.

---

- [ ] **`iac/environments/before/main.tf`**

  Call all three modules. Pass provider configurations.
  All misconfiguration variables set to `true`.
  Reference: `CLAUDE.md` → Two-Environment Pattern.

---

- [ ] **`iac/environments/before/terraform.tfvars`**

  All 15 Terraform variables set to `true`.
  Reference: `CLAUDE.md` → Prowler Checks — All 15 for variable names.

---

- [ ] **`iac/environments/after/main.tf`**

  Identical structure to `before/main.tf`. All variables set to `false`.

---

- [ ] **`iac/environments/after/terraform.tfvars`**

  All 15 Terraform variables set to `false`.

---

## Phase 3 — Scanner

Depends on: credentials created and stored in Secret Manager per `SETUP.md` §4.
Do not build this until the Secret Manager prerequisites are complete.

---

- [ ] **`prowler/run_scan.sh`**

  Bash script that runs locally on WSL2.

  Sequence:
  1. Fetch AWS, GCP, and Azure secrets from GCP Secret Manager using `gcloud secrets versions access` — do not fetch the CF-Access-Secret
  2. Export AWS credentials as environment variables for boto3
  3. Write GCP service account key to a temp file, set `GOOGLE_APPLICATION_CREDENTIALS`
  4. Parse Azure credentials JSON, export as environment variables
  5. Run Prowler for AWS: `prowler aws --check [5 check IDs] --output-formats json-ocsf --output-directory [path]`
  6. Run Prowler for GCP: `prowler gcp --check [5 check IDs] --project-id [project] --output-formats json-ocsf --output-directory [path]`
  7. Run Prowler for Azure: `prowler azure --check [5 check IDs] --output-formats json-ocsf --output-directory [path]`
  8. Clean up temp credential file

  Prowler runs sequentially, not in parallel.
  Reference: `CLAUDE.md` → Prowler Checks — All 15 for exact check IDs.
  Reference: `SETUP.md` → Credentials Reference for secret names.

---

## Phase 4 — Ingest Pipeline

Depends on: Phase 3 complete and a real Prowler JSON output file available
for each provider. Do not write `ingest_prowler.py` from memory — run
`run_scan.sh` once first and capture the actual JSON output to use as
the field mapping reference.

---

- [ ] **`ingest/ingest_prowler.py`**

  Python 3.11 script. Accepts two arguments: path to Prowler JSON output
  file, and target output filename (`findings_before` or `findings_after`).

  For each finding in the JSON:
  - Map Prowler fields to the normalised schema in `CLAUDE.md` → Findings JSON Schema
  - Generate a UUID for `id`
  - Set `source` to `"prowler"`
  - Write all findings as a JSON array directly to `dashboard/public/<target>.json`

  Do not infer field mappings — use the actual Prowler JSON output as the reference.
  Do not write to any destination other than `dashboard/public/findings_before.json`
  or `dashboard/public/findings_after.json`.

---

## Phase 5 — Dashboard

Depends on: `ingest_prowler.py` having produced real `findings_before.json`
and `findings_after.json` in `dashboard/public/`. Build components against
real data, not placeholder arrays.

Reference `DASHBOARD_SPEC.md` for every component — do not invent
behaviour, states, or fields not listed there.

---

- [ ] **Dashboard scaffold**

  Initialise the Vite + React 18 + TypeScript project in `dashboard/`.
  Install: Tailwind CSS, shadcn/ui, zod, eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin.
  Configure `tsconfig.json` with `strict: true`.
  Configure ESLint with `@typescript-eslint/recommended-type-checked` ruleset
  and `parserOptions.project` pointing to `tsconfig.json`.
  Configure routing: `/before` → `Before.tsx`, `/after` → `After.tsx`,
  `/` → redirect to `/before`.
  No other routes.

---

- [ ] **`dashboard/src/types/finding.ts`**

  Define `FindingSchema` using zod and export `Finding` as the inferred type.
  This is the single source of truth for the finding shape across all components.
  Reference: `DASHBOARD_SPEC.md` → Types and Validation.

---

- [ ] **`dashboard/src/components/PageHeader.tsx`**

  Renders project name, page label, nav links between `/before` and `/after`,
  and scan timestamp derived from the maximum `scanned_at` value in the
  fetched findings array.
  Reference: `DASHBOARD_SPEC.md` → Component 1.

---

- [ ] **`dashboard/src/components/SummaryBar.tsx`**

  Four stat cards: Total Findings, Critical, High, Providers.
  Computed from the full unfiltered findings array passed as a prop.
  Reference: `DASHBOARD_SPEC.md` → Component 2.

---

- [ ] **`dashboard/src/components/FilterBar.tsx`**

  Multi-select toggles for Provider, Severity, and Category.
  Default state: all selected. Includes "Clear filters" control.
  Emits filter state to parent — does not fetch data.
  Reference: `DASHBOARD_SPEC.md` → Component 3.

---

- [ ] **`dashboard/src/components/FindingsTable.tsx`**

  Seven-column table with loading, empty, and error states.
  Accepts filtered findings array as prop.
  Severity and provider badges use Tailwind colour tokens from
  `DASHBOARD_SPEC.md` → Severity Colour Tokens.
  Reference: `DASHBOARD_SPEC.md` → Component 4.

---

- [ ] **`dashboard/src/components/ProviderStatus.tsx`**

  Accepts `findingsAfter` and `findingsBefore` arrays as props.
  Groups `findingsAfter` by provider (`aws`, `gcp`, `azure`).
  Renders one row per finding per provider using the same 7-column structure
  as FindingsTable. Providers with 0 findings render a single "All clear" row.
  If distinct provider count from `findingsBefore` ≠ 3, renders an inline error.
  Only rendered on the `/after` route.
  Reference: `DASHBOARD_SPEC.md` → Component 5.

---

- [ ] **`dashboard/src/components/RemediationChangelog.tsx`**

  Accepts `findingsBefore` and `findingsAfter` arrays as props.
  Computes the FAIL → PASS diff client-side by matching on `check_id`.
  Renders as a table with dynamic header count.
  Only rendered on the `/after` route.
  Reference: `DASHBOARD_SPEC.md` → Component 6.

---

- [ ] **`dashboard/src/pages/Before.tsx`**

  Fetches `/findings_before.json` on load.
  Composes: PageHeader, SummaryBar, FilterBar, FindingsTable.
  Does not render ProviderStatus or RemediationChangelog.
  Reference: `DASHBOARD_SPEC.md` → Routes, Shared Layout.

---

- [ ] **`dashboard/src/pages/After.tsx`**

  Fetches both `/findings_before.json` and `/findings_after.json` on load.
  Composes: PageHeader, SummaryBar, FilterBar, FindingsTable, ProviderStatus, RemediationChangelog.
  Reference: `DASHBOARD_SPEC.md` → Routes, Shared Layout.

---

- [ ] **`dashboard/Dockerfile`**

  Multi-stage build: `node:20-alpine` build stage → `nginx:1.27-alpine` serve stage.
  Both base images pinned by SHA digest.
  Copies `dashboard/public/findings_before.json` and
  `dashboard/public/findings_after.json` into the nginx public directory.
  Exposes port 8080 (Cloud Run default).
  No credentials, no environment variables required at runtime.

  Do not use `nginx:latest` or `node:latest` — pin to exact versions with SHA digest.

---

## Phase 6 — Orchestration

Depends on: all previous phases complete and tested end-to-end at least once manually.

---

- [ ] **`Makefile`**

  Five targets per `CLAUDE.md` → Makefile Targets. All run locally on WSL2.

  - `make before` — runs `terraform apply` in `iac/environments/before`
  - `make scan` — runs `prowler/run_scan.sh`, then `ingest/ingest_prowler.py`
    with `findings_before` as the target — writes `dashboard/public/findings_before.json`
  - `make after` — runs `terraform apply` in `iac/environments/after`
  - `make rescan` — same as `scan` with `findings_after` as the target —
    writes `dashboard/public/findings_after.json`
  - `make deploy` — runs `docker build` (both JSON files must already exist in
    `dashboard/public/`), pushes image to Artifact Registry, deploys to Cloud Run.
    Fetches CF-Access-Secret from Secret Manager and sets it as a Cloud Run env var.
    Only run after the GitHub Actions quality gate is green on main.

---

## Completion Checklist

All items above checked off, plus:

- [ ] `make before` runs without errors
- [ ] `make scan` produces `dashboard/public/findings_before.json` with 15 documents
- [ ] `findings_before.json` contains 15 documents matching the schema in `CLAUDE.md`
- [ ] Dashboard `/before` shows 15 findings (3 critical, 7 high, 4 medium, 1 low)
- [ ] `make after` runs without errors
- [ ] `make rescan` produces `dashboard/public/findings_after.json` with 0 documents
- [ ] Dashboard `/after` shows findings after remediation, Provider Status shows all 3 providers and findings status, and Remediation Changelog shows status of all findings from `/before`
- [ ] Cloud Run origin is not directly accessible — Cloudflare header required
- [ ] No credentials committed to the repository
- [ ] `terraform.tfstate` files are not committed to the repository
