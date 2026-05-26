# Security Controls

A consolidated reference of all security decisions and controls applied to this project.

---

## Credential Handling

- All cloud credentials (AWS, GCP, Azure) are stored in **GCP Secret Manager** — never on disk, never in environment files, never committed to git.
- Credentials are fetched at runtime by WSL2 using `gcloud auth` ADC. See `prowler/run_scan.sh` and `Makefile`.
- `run_scan.sh` uses a `trap cleanup EXIT` to unset all exported credential environment variables on exit, whether the scan succeeds or fails.
- The Cloudflare origin validation secret is fetched from Secret Manager at deploy time and set as a Cloud Run environment variable — it is never stored in the image or repository.

## Secret Scanning

| Control | Where | Trigger |
|---|---|---|
| **Gitleaks** (pre-commit hook) | `.git/hooks/pre-commit` | Every manual `git commit` |
| **Gitleaks** (GitHub Actions) | `.github/workflows/secret-scan.yml` | Every push and PR |

Both scans run independently — the local hook catches secrets before they leave the machine; the CI workflow catches anything that slips through.

## Infrastructure Security

### Cloudflare Edge

| Feature | Status | What it does |
|---|---|---|
| **DDoS Protection** | Always on | Blocks volumetric and application-layer attacks automatically |
| **WAF (Managed Rules)** | Always on | Blocks common attacks — SQLi, XSS, etc. |
| **Bot Fight Mode** | Enabled | Challenges automated bots and scrapers |
| **Browser Integrity Check** | Enabled (default) | Blocks requests with suspicious or spoofed browser headers |
| **SSL Full (Strict)** | Enabled | End-to-end encrypted, validates origin certificate |
| **Cloudflare Worker** | Enabled | Injects `X-CF-Secret` header — direct Cloud Run access returns 403 |

### Cloud Run Origin

- **Cloudflare origin protection** — A Cloudflare Worker injects a shared secret header (`X-CF-Secret`) on every proxied request. nginx on Cloud Run validates that header and rejects requests without it with 403, preventing direct origin bypass.
- **Backend access blocked** — Direct access to the Cloud Run backend URL is blocked — requests without the secret header are rejected with 403. All browser traffic reaches the app through `prowler.cloudsecuritypractice.com` only.
- **Static findings JSON** — no backend API, no database, no authentication surface. Findings are baked into the Docker image at build time. See `docs/adr/0001-static-findings-json-baked-into-container.md`.

## IaC Security

- **Trivy** scans Terraform modules for misconfigurations on every push and PR (`.github/workflows/trivy.yml`). Findings upload to the GitHub Security tab via SARIF.
- **Terraform validate** runs `terraform fmt --check` and `terraform validate` on every push and PR (`.github/workflows/terraform-validate.yml`). Catches syntax errors and formatting issues.
- **Terraform state** is stored locally on the WSL2 machine and excluded from git via `.gitignore`. No remote backend.
- The intentional misconfigurations in `iac/modules/` are expected Trivy findings — they represent the before-state infrastructure this project is designed to demonstrate.

## CI/CD Pipeline Security

- **Zizmor** audits GitHub Actions workflow files for supply chain risks on every push and PR (`.github/workflows/zizmor.yml`). Findings upload to the GitHub Security tab via SARIF.
- All GitHub Actions steps pin dependencies to exact commit SHAs, not mutable version tags.
- `persist-credentials: false` is set on all checkout actions.
- **Hardcoded config check** (`.github/workflows/hardcoded-config-check.yml`) scans source files on every push and PR for hardcoded cloud account identifiers, resource IDs, regions, and personal identifiers.

## Code Quality and Safety

- **Shellcheck** lints `run_scan.sh` on every push and PR (`.github/workflows/shellcheck.yml`).
- **Ruff** lints `ingest_prowler.py` on every push and PR (`.github/workflows/python-lint.yml`).
- **Frontend CI** runs `tsc --noEmit`, `eslint`, and `vite build` on every push and PR (`.github/workflows/frontend-ci.yml`).
- **Docker build** validates the container compiles on every push and PR (`.github/workflows/docker-build.yml`).
- **Dependabot** opens automated PRs weekly for outdated npm, pip, and GitHub Actions dependencies (`.github/dependabot.yml`).
- **Dependency Review** scans PRs that change dependency files for known vulnerabilities using GitHub's Advisory Database (`.github/workflows/dependency-review.yml`).

## Data Redaction

- All cloud account identifiers are stripped from findings JSON before publication — account IDs, subscription IDs, resource IDs, and bucket names are removed or replaced with placeholders.
- The raw Prowler output field is not written to findings JSON, as it contains unsanitized scan data.

## HTTP Security Headers

Applied in `dashboard/nginx.conf` — active on the deployed Cloud Run container:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframe embedding |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage on external navigation |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS for 1 year |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables unused browser features |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<per-request>'; img-src 'self' github.com; connect-src 'self' raw.githubusercontent.com; style-src 'self'; font-src 'self'` | Prevents cross-site scripting (XSS) by restricting resource loading to same-origin plus explicitly allowed external domains. Per-request nonce allows Cloudflare Bot Fight Mode scripts without `unsafe-inline`. |

## DAST — Dynamic Application Security Testing

OWASP ZAP baseline scan is run manually against the local development server (`http://localhost:5173/`). The scan covers passive checks across all discovered URLs.

---

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
