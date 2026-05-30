# Security Controls

**Security posture: defence-in-depth applied to every stage of the lifecycle.** Secrets are never on disk; every code change passes through automated gates; the runtime surface is reduced to a single hardened path; the application enforces modern browser controls; and the AI development environment runs sandboxed.

## At a glance

| Control family | Threat addressed | Primary controls | Verified by |
|---|---|---|---|
| **1. Credential & secrets hygiene** | Credential theft, exposure in git | GCP Secret Manager, runtime `trap` cleanup, Gitleaks (pre-commit + CI), data redaction | Two independent Gitleaks scans + redaction in published findings |
| **2. Secure build & supply chain** | Compromised dependencies, CI takeover | 13 automated security checks, SHA-pinned actions, `persist-credentials: false`, Dependabot, Socket.dev, Trivy, Zizmor | CI gate status on every push and PR |
| **3. Defended runtime edge** | DDoS, web attacks, origin bypass | Cloudflare WAF + DDoS + Bot Fight + SSL Strict; 8 Worker rules; origin shared secret | Direct-to-origin requests return 403; Worker Lint CI |
| **4. Hardened application surface** | XSS, clickjacking, MIME sniffing, downgrade | 6 HTTP security headers (CSP w/ nonce, HSTS, X-Frame, etc.) | OWASP ZAP baseline scan |
| **5. AI development guardrails** | Inadvertent destructive change, data exfiltration via agent | Sandboxed Claude Code (filesystem / network / command restrictions) | Sandbox config enforced on every session |

---

## 1. Credential & Secrets Hygiene

*Credentials live in one place, are never written to disk, and are scanned twice before they can leak.*

### Credential handling

- All cloud credentials (AWS, GCP, Azure) are stored in **GCP Secret Manager** — never on disk, never in environment files, never committed to git.
- Credentials are fetched at runtime by WSL2 using `gcloud auth` ADC. See `prowler/run_scan.sh` and `Makefile`.
- `run_scan.sh` uses a `trap cleanup EXIT` to unset all exported credential environment variables on exit, whether the scan succeeds or fails.
- The Cloudflare origin validation secret is fetched from Secret Manager at deploy time and set as a Cloud Run environment variable — it is never stored in the image or repository.

### Secret scanning

| Control | Where | Trigger |
|---|---|---|
| **Gitleaks** (pre-commit hook) | `.git/hooks/pre-commit` | Every manual `git commit` |
| **Gitleaks** (GitHub Actions) | `.github/workflows/secret-scan.yml` | Every push and PR |

Both scans run independently — the local hook catches secrets before they leave the machine; the CI workflow catches anything that slips through.

### Data redaction

- All cloud account identifiers are stripped from findings JSON before publication — account IDs, subscription IDs, resource IDs, and bucket names are removed or replaced with placeholders.
- The raw Prowler output field is not written to findings JSON, as it contains unsanitized scan data.

### Terraform state

- **Terraform state** is stored locally on the WSL2 machine and excluded from git via `.gitignore`. No remote backend — state files contain sensitive values and never leave the developer workstation.

---

## 2. Secure Build & Supply Chain

*Every change ships through 13 automated security gates. Dependencies pin to SHAs and are reviewed weekly.*

13 automated security checks run on every push and pull request. All GitHub Actions steps pin dependencies to exact commit SHAs, not mutable version tags. `persist-credentials: false` is set on all checkout actions.

| Workflow | What it protects against |
|---|---|
| Semgrep SAST | Scans the dashboard and Cloudflare Worker source files (.ts, .tsx, .js) for injection and cross-site scripting (XSS) issues |
| Python Lint (Ruff · Bandit) | Scans the Python ingest code for security flaws and code-quality issues before they ship |
| Secret Scan (Gitleaks) | Scans every commit and the full git history for leaked credentials, API keys, and tokens before they reach the public repo |
| Hardcoded Config Check (custom grep) | Blocks cloud account IDs, resource identifiers, regions, and personal emails from being hardcoded in source code |
| Dependency Review (GitHub) | Flags any newly added or updated dependency with known security vulnerabilities before it merges |
| Socket.dev (GitHub App) | Scans npm package manifests (package.json, package-lock.json) for malware, typosquatting, obfuscated code, and other supply-chain compromise indicators before dependencies are approved for merge |
| Trivy | Scans the Terraform for insecure infrastructure patterns — public exposure, missing encryption, weak access — before it reaches live infrastructure |
| Zizmor | Audits the GitHub Actions workflows for CI/CD security flaws — script injection, over-broad permissions, unpinned actions |
| Worker Lint (ESLint) | Lints the Cloudflare Worker — the edge security layer — catching JavaScript errors before it ships to the edge |
| Frontend CI (TypeScript · ESLint · Vite · lockfile-lint) | Validates lockfile integrity against the official npm registry (supply-chain) and catches type errors, code-quality issues, and broken builds in the dashboard TypeScript source (.ts, .tsx) before they reach the live site |
| Shellcheck | Catches shell-scripting bugs and unsafe quoting in the scan automation before they cause silent failures |
| Terraform Validate | Catches malformed Terraform — invalid syntax, type errors, and broken references — before an apply touches live cloud infrastructure |
| Docker Build | Catches container and Dockerfile build errors before deployment, so a broken or undeployable image never reaches the live site |

Additional notes:

- The intentional misconfigurations in `iac/modules/` are expected Trivy findings — they represent the before-state infrastructure this project is designed to demonstrate.
- **Dependabot** opens automated PRs weekly for outdated npm, pip, and GitHub Actions dependencies (`.github/dependabot.yml`).
- For a full risk analysis of the CI/CD pipeline against the **OWASP Top 10 CI/CD Security Risks**, see `docs/owasp-cicd.md`.

---

## 3. Defended Runtime Edge

*The dashboard is reachable through one hardened path — Cloudflare's WAF and 8 Worker rules. Direct origin access returns 403.*

### Cloudflare edge

| Feature | Status | What it does |
|---|---|---|
| **DDoS Protection** | Always on | Blocks volumetric and application-layer attacks automatically |
| **WAF (Managed Rules)** | Always on | Blocks common attacks — SQLi, XSS, etc. |
| **Bot Fight Mode** | Enabled | Challenges automated bots and scrapers |
| **Browser Integrity Check** | Enabled (default) | Blocks requests with suspicious or spoofed browser headers |
| **SSL Full (Strict)** | Enabled | End-to-end encrypted, validates origin certificate |
| **Cloudflare Worker** | Enabled | Injects `X-CF-Secret` header — direct Cloud Run access returns 403 |

### Cloud Run origin

- **Cloudflare origin protection** — A Cloudflare Worker injects a shared secret header (`X-CF-Secret`) on every proxied request. nginx on Cloud Run validates that header and rejects requests without it with 403, preventing direct origin bypass.
- **Backend access blocked** — Direct access to the Cloud Run backend URL is blocked — requests without the secret header are rejected with 403. All browser traffic reaches the app through `prowler.cloudsecuritypractice.com` only.
- **Static findings JSON** — no backend API, no database, no authentication surface. Findings are baked into the Docker image at build time. See `docs/adr/0001-static-findings-json-baked-into-container.md`.

### Cloudflare Worker security rules

The Cloudflare free plan does not include custom WAF rules, method filtering, or path filtering. The Worker fills that gap with 8 rules enforced before any request reaches Cloud Run. Rule numbers match the implementation order in `cloudflare/worker.js`.

| Rule | What it does |
|---|---|
| **1. Method restriction** | Allows only GET, HEAD, and OPTIONS. Returns 405 for POST, PUT, DELETE, and all other methods. |
| **2. Body rejection** | Blocks GET/HEAD requests that carry a body, preventing HTTP desync attacks. |
| **3. Traversal and null byte detection** | Inspects the raw URL for encoded path traversal sequences (`%2e%2e`, `%252e`, `%2f`, `%5c`) and null bytes (`%00`) before parsing. |
| **4. URL length limit** | Returns 414 for paths exceeding 256 characters, blocking buffer overflow and WAF evasion attempts. |
| **5. Path allowlist** | Checks every path against an explicit set of valid routes and static files. `/assets/` paths must match Vite's naming convention with only `.js` and `.css` extensions. Returns 404 for everything else. |
| **6. Header size limits** | Returns 431 if total headers exceed 16 KB or any single header exceeds 4 KB, preventing log flooding and resource exhaustion. |
| **7. Host header validation** | Validates the Host header against the expected domain (case-insensitive, allows `:443` variant). Returns 421 for mismatches, blocking cache poisoning and DNS rebinding. |
| **8. Error cache prevention** | All error responses include `Cache-Control: no-store` so blocked requests are never cached by Cloudflare's CDN. |

---

## 4. Hardened Application Surface

*The application enforces modern browser controls and is verified by dynamic scanning.*

### HTTP security headers

Applied in `dashboard/nginx.conf` — active on the deployed Cloud Run container:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframe embedding |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage on external navigation |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS for 1 year |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables unused browser features |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<per-request>'; img-src 'self' github.com; connect-src 'self' raw.githubusercontent.com; style-src 'self'; font-src 'self'` | Prevents cross-site scripting (XSS) by restricting resource loading to same-origin plus explicitly allowed external domains. Per-request nonce allows Cloudflare Bot Fight Mode scripts without `unsafe-inline`. |

### DAST — Dynamic Application Security Testing

OWASP ZAP baseline scan is run manually against the deployed application. The scan covers passive checks across all discovered URLs.

---

## 5. AI Development Guardrails

*AI-assisted development runs under least privilege — bounded filesystem, network, and command access.*

Claude Code was used throughout this project with sandboxed execution enabled. The sandbox enforces:

- **Filesystem restrictions** — write access is limited to the project directory and designated temporary paths. System directories, shell configuration files, and Claude Code settings are read-only.
- **Network restrictions** — outbound network access is restricted to an explicit allowlist of permitted hosts. Arbitrary external requests are blocked.
- **Command restrictions** — destructive shell operations are subject to permission prompts requiring explicit user approval before execution.

This ensures that AI-assisted development cannot inadvertently write to sensitive system paths, exfiltrate data to arbitrary endpoints, or execute destructive operations without human confirmation — maintaining the same security posture as a principle of least privilege applied to the development toolchain itself.

---

## Appendix — Hard rules (enforced in CLAUDE.md)

- No hardcoded cloud account IDs, project IDs, subscription IDs, or tenant IDs anywhere in code or configuration.
- No hardcoded cloud regions inline in scripts or Terraform — defined as named variables only.
- No hardcoded AWS resource IDs (security group IDs, instance IDs, VPC IDs).
- No credentials, keys, or secrets in any file tracked by git.
- No personal email addresses or usernames in source code.
