# Security Controls

A consolidated reference of all security decisions and controls applied to this project.

---

## Credential Handling

- All cloud credentials (AWS, GCP, Azure) are stored in **GCP Secret Manager** — never on disk, never in environment files, never committed to git.
- Credentials are fetched at runtime by WSL2 using `gcloud auth` ADC. See `prowler/run_scan.sh` and `Makefile`.
- `run_scan.sh` uses a `trap cleanup EXIT` to unset all exported credential environment variables on exit, whether the scan succeeds or fails.
- The Cloudflare `CF-Access-Secret` is fetched from Secret Manager at deploy time and set as a Cloud Run environment variable — it is never stored in the image or repository.

## Secret Scanning

| Control | Where | Trigger |
|---|---|---|
| **Gitleaks** (pre-commit hook) | `.git/hooks/pre-commit` | Every manual `git commit` |
| **Gitleaks** (GitHub Actions) | `.github/workflows/secret-scan.yml` | Every push and PR |

Both scans run independently — the local hook catches secrets before they leave the machine; the CI workflow catches anything that slips through.

## Infrastructure Security

- **Cloudflare origin protection** — Cloud Run rejects any request missing the `CF-Access-Secret` header, preventing direct origin access. All public traffic enters through Cloudflare only. SSL mode is Full (Strict) end-to-end.
- **No public Cloud Run URL** — the service is not directly accessible; all traffic routes through `prowler.cloudsecuritypractice.com`.
- **Static findings JSON** — no backend API, no database, no authentication surface. Findings are baked into the Docker image at build time. See `docs/adr/0001-static-findings-json-baked-into-container.md`.

## IaC Security

- **Trivy** scans Terraform modules for misconfigurations on every push and PR (`.github/workflows/trivy.yml`). Findings upload to the GitHub Security tab via SARIF.
- **Terraform state** is stored locally in `iac/environments/` and excluded from git via `.gitignore`. No remote backend.
- The intentional misconfigurations in `iac/modules/` are expected Trivy findings — they represent the before-state infrastructure this project is designed to demonstrate.

## CI/CD Pipeline Security

- **Zizmor** audits GitHub Actions workflow files for supply chain risks on every push and PR (`.github/workflows/zizmor.yml`). Findings upload to the GitHub Security tab via SARIF.
- All GitHub Actions steps pin dependencies to exact commit SHAs, not mutable version tags.
- `persist-credentials: false` is set on all checkout actions.
- **Hardcoded config check** (`.github/workflows/hardcoded-config-check.yml`) scans source files on every push and PR for hardcoded AWS account IDs, Azure subscription UUIDs, AWS resource IDs, regions, and personal email addresses.

## Code Quality and Safety

- **Shellcheck** lints `run_scan.sh` on every push and PR (`.github/workflows/shellcheck.yml`).
- **Ruff** lints `ingest_prowler.py` on every push and PR (`.github/workflows/python-lint.yml`).
- **Frontend CI** runs `tsc --noEmit`, `eslint`, and `vite build` on every push and PR (`.github/workflows/frontend-ci.yml`).
- **Docker build** validates the container compiles on every push and PR (`.github/workflows/docker-build.yml`).
- **Dependabot** opens automated PRs weekly for outdated npm, pip, and GitHub Actions dependencies (`.github/dependabot.yml`).

## Data Redaction

- `ingest_prowler.py` strips all cloud account identifiers from the `resource` field before writing findings JSON:
  - AWS: S3 bucket names, CloudTrail trail names, account IDs, EC2 instance IDs, regions
  - Azure: subscription IDs, resource group paths — retains `Microsoft.Namespace/ResourceType` only
  - GCP: all resource UIDs replaced with `gcp:***`
- The `raw` Prowler field is not written to findings JSON — it contained unsanitized scan output including internal UUIDs and account identifiers.

## HTTP Security Headers

Applied in `dashboard/nginx.conf` — active on the deployed Cloud Run container:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframe embedding |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage on external navigation |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS for 1 year |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables unused browser features |

`Content-Security-Policy` is not yet enforced — it will be added after tuning in report-only mode.

## AI Development Sandbox

Claude Code was used throughout this project with sandboxed execution enabled. The sandbox enforces:

- **Filesystem restrictions** — write access is limited to the project directory and designated temporary paths. System directories, shell configuration files, and Claude Code settings are read-only.
- **Network restrictions** — outbound network access is restricted to an explicit allowlist of permitted hosts. Arbitrary external requests are blocked.
- **Command restrictions** — destructive shell operations are subject to permission prompts requiring explicit user approval before execution.

This ensures that AI-assisted development cannot inadvertently write to sensitive system paths, exfiltrate data to arbitrary endpoints, or execute destructive operations without human confirmation — maintaining the same security posture as a principle of least privilege applied to the development toolchain itself.

---

## Hard Rules (enforced in CLAUDE.md)

- No hardcoded cloud account IDs, project IDs, subscription IDs, or tenant IDs anywhere in code or configuration.
- No hardcoded cloud regions inline in scripts or Terraform — defined as named variables only.
- No hardcoded AWS resource IDs (security group IDs, instance IDs, VPC IDs).
- No credentials, keys, or secrets in any file tracked by git.
- No personal email addresses or usernames in source code.
