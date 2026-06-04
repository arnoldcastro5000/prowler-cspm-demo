# Security Controls

**Security posture: defence-in-depth applied to every stage of the lifecycle.** Secrets are never on disk; every code change passes through automated gates; the runtime surface is reduced to a single hardened path; the application enforces modern browser controls; and the AI development environment runs sandboxed.

## At a glance

| Control family | Threat addressed | Primary controls | Verified by |
|---|---|---|---|
| **1. Credential & secrets hygiene** | Credential theft, exposure in git | GCP Secret Manager, runtime `trap` cleanup, Betterleaks (CI) + Gitleaks (pre-commit), data redaction | Two independent secret scans + redaction in published findings |
| **2. Secure build & supply chain** | Compromised dependencies, CI takeover | 15 automated security checks, SHA-pinned actions, `persist-credentials: false`, Socket.dev, Trivy, Zizmor | CI gate status on every push and PR |
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
| **Betterleaks** (GitHub Actions) | `.github/workflows/secret-scan.yml` | Every push and PR |

Both scans run independently — the local hook catches secrets before they leave the machine; the CI workflow catches anything that slips through.

### Data redaction

- All cloud account identifiers are stripped from findings JSON before publication — account IDs, subscription IDs, resource IDs, and bucket names are removed or replaced with placeholders.
- The raw Prowler output field is not written to findings JSON, as it contains unsanitized scan data.

### Terraform state

- **Terraform state** is stored locally on the WSL2 machine and excluded from git via `.gitignore`. No remote backend — state files contain sensitive values and never leave the developer workstation.

---

## 2. Secure Build & Supply Chain

*Every change ships through 15 automated security checks (14 CI gates + pre-commit hook). Dependencies pin to SHAs and are reviewed weekly.*

15 automated security checks cover every push and pull request (14 CI gates) plus a pre-commit hook that runs before changes leave the developer's machine. All GitHub Actions steps pin dependencies to exact commit SHAs, not mutable version tags. `persist-credentials: false` is set on all checkout actions.

| Workflow | Rationale |
|---|---|
| Dependabot | Monitors committed dependency files; opens fix PRs when a CVE is found in an already-installed version. Software Composition Analysis (SCA) on post-merge, scheduled daily. |
| Dependency Review (GitHub) | Runs on every pull request and blocks merge if the incoming change introduces a known CVE. SCA on pre-merge, on every PR. |
| Socket.dev | Scans npm package manifests before dependencies are approved for merge. SCA focused on supply-chain threats (malware, typosquatting) rather than CVEs. |
| Semgrep SAST | Scans the dashboard and Cloudflare Worker source files (.ts, .tsx, .js) for injection and cross-site scripting (XSS) issues |
| Python Lint (Ruff · Bandit) | Scans the Python ingest code for security flaws and code-quality issues before they ship |
| Secret Scan (Betterleaks) | Scans every commit and the full git history for leaked credentials, API keys, and tokens |
| Secret Scan (Gitleaks) | Pre-commit hook — catches leaked credentials, API keys, and tokens before they leave the developer's machine |
| Hardcoded Config Check (custom grep) | Blocks cloud account IDs, resource identifiers, regions, and personal emails from being hardcoded in source code |
| Trivy | Scans the Terraform for insecure infrastructure patterns — public exposure, missing encryption, weak access — before it reaches live infrastructure |
| Zizmor | Audits the GitHub Actions workflows for CI/CD security flaws — script injection, over-broad permissions, unpinned actions |
| Worker Lint (ESLint) | Lints the Cloudflare Worker — the edge security layer — catching JavaScript errors before it ships to the edge |
| Frontend CI (TypeScript · ESLint · Vite · lockfile-lint) | Validates lockfile integrity against the official npm registry (supply-chain) and catches type errors, code-quality issues, and broken builds in the dashboard TypeScript source (.ts, .tsx) before they reach the live site |
| Shellcheck | Catches shell-scripting bugs and unsafe quoting in the scan automation before they cause silent failures |
| Terraform Validate | Catches malformed Terraform — invalid syntax, type errors, and broken references — before an apply touches live cloud infrastructure |
| Docker Build | Builds the image and scans it with Trivy for CRITICAL and HIGH CVEs (fixable only); SARIF results go to the GitHub Security tab. Catches build errors and known vulnerabilities before deployment. |

Additional notes:

- The intentional misconfigurations in `iac/modules/` are expected Trivy findings — they represent the before-state infrastructure this project is designed to demonstrate.
- For a full risk analysis of the CI/CD pipeline against the **OWASP Top 10 CI/CD Security Risks**, see `docs/owasp-cicd.md`.

**Accepted risk — scan output chain of custody.** Prowler writes findings JSON to `/var/tmp/prowler-output/` (mode 0755) and `dashboard/public/` before `make deploy`. Neither path is signature-protected. Tampering between scan and ingest is possible but requires an interactive session on the same WSL2 machine during the narrow window between `make scan` and `make deploy`. In a single-operator PoC context with no adversarial local access, this risk is accepted. Production deployment would require output signing and signature verification at ingest.

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

*Claude Code runs inside a DevContainer with three independent isolation controls: workspace bind-mount scoped to the project root only, a network egress firewall, and a bubblewrap process sandbox. The sandbox policy is enforced by the container image — not the user session.*

### DevContainer architecture

| File | Purpose |
|---|---|
| `.devcontainer/Dockerfile` | Image — `node:20` base, dev tools, `bubblewrap`, `iptables`/`ipset`, native Claude Code install, Gitleaks, managed settings |
| `.devcontainer/devcontainer.json` | Container config — workspace mount, named volumes, `NET_ADMIN`/`NET_RAW` capabilities, firewall activation |
| `.devcontainer/init-firewall.sh` | iptables egress firewall — runs on every container start via `postStartCommand` |
| `.devcontainer/managed-settings.json` | Claude Code org policy — baked into image at `/etc/claude-code/managed-settings.json`; cannot be overridden from inside the container |
| `.devcontainer/firewall-extra-domains.txt` | Optional extra egress allowlist — bind-mounted read-only |
| `.claude/settings.local.json` | Project-level Claude Code config — tool permissions, credential path denials, sandbox exclusions |

### Control 1 — Workspace bind-mount scoped to project root

The container mounts only the project root directory:

```
workspaceMount: source=${localWorkspaceFolder}, target=/workspace
```

The host home directory is not mounted. Cloud credential directories (`~/.aws`, `~/.ssh`, `~/.azure`, `~/.config/gcloud`) do not exist inside the container. The `gcloud` binary is not installed in the image. Claude Code cannot reach host credentials through the filesystem regardless of sandbox state.

As a second line of defence, `.claude/settings.local.json` adds explicit deny rules for those paths and the sandbox `filesystem.denyRead` list mirrors them:

```json
"permissions": {
  "deny": ["Read(**/.aws/**)", "Read(**/.ssh/**)", "Read(**/.azure/**)", "Read(**/.config/gcloud/**)"]
},
"sandbox": {
  "filesystem": {
    "denyRead": ["~/.aws", "~/.ssh", "~/.azure", "~/.config/gcloud"]
  }
}
```

### Control 2 — Network egress firewall

`init-firewall.sh` runs as root at every container startup. It flushes all existing rules, sets a default DROP policy on INPUT, OUTPUT, and FORWARD, and rebuilds an IP allowlist from:

| Destination | Source | Purpose |
|---|---|---|
| GitHub IP ranges | Live fetch from `api.github.com/meta` (web + api + git, CIDR-aggregated) | `git`, `gh` CLI |
| `api.anthropic.com` | DNS resolution at startup | Claude Code inference |
| `downloads.claude.ai` | DNS resolution at startup | Claude Code binary updates |
| `registry.npmjs.org` | DNS resolution at startup | npm |
| `marketplace.visualstudio.com`, `vscode.blob.core.windows.net`, `update.code.visualstudio.com` | DNS resolution at startup | VS Code extensions |
| Host network subnet | Detected from default route | Docker host communication |
| DNS (UDP 53), SSH (TCP 22), loopback | Static | Infrastructure |

On completion, the script self-verifies: it confirms `https://example.com` is unreachable and `https://api.github.com/zen` is reachable. The container does not finish starting (`waitFor: postStartCommand`) if either check fails.

The `node` user's sudo access is scoped to this script only — no other root operation is available (`/etc/sudoers.d/node-firewall`).

Additional domains can be allowlisted without modifying `init-firewall.sh` by adding them to `firewall-extra-domains.txt` (bind-mounted read-only from the host).

### Control 3 — Bubblewrap process sandbox

`bubblewrap` is installed in the image. Claude Code uses it for sub-process isolation. The sandbox is enforced by `managed-settings.json`, copied into the image at build time at the highest-precedence config path:

```json
{
  "sandbox": {
    "enabled": true,
    "enableWeakerNestedSandbox": true,
    "failIfUnavailable": false,
    "allowUnsandboxedCommands": false
  }
}
```

`enableWeakerNestedSandbox: true` allows bubblewrap to operate inside Docker using unprivileged user namespaces. `allowUnsandboxedCommands: false` blocks the `dangerouslyDisableSandbox` escape hatch. The project-level config mirrors this:

```json
"sandbox": { "enabled": true, "autoAllowBashIfSandboxed": false, "allowUnsandboxedCommands": false }
```

`gh` and `git` are excluded from the bubblewrap sandbox (`excludedCommands`) because both require network and filesystem access that the sandbox blocks — they remain subject to the network firewall and workspace mount scope.

**Note:** `failIfUnavailable: false` means Claude Code degrades to unsandboxed operation without warning if `bubblewrap` is absent. This is a known residual risk — see `docs/stride.md` T-123.

### Additional controls

**Gitleaks inside the container** — installed at `/usr/local/bin/gitleaks`. The repository's pre-commit hook runs inside the container on every `git commit`.

**Shell history isolation** — bash history is stored in a named Docker volume (`claude-code-bashhistory-<devcontainerId>`), scoped per container instance and not written to the host filesystem.

**WebFetch requires confirmation** — all outbound web fetches by Claude Code prompt for user approval (`"ask": ["WebFetch(*)"]`); `api.github.com` is pre-approved.

For the full configuration reference including rebuild instructions and a validation script, see `docs/devcontainer.md`.

---

## Appendix — Hard rules (enforced in CLAUDE.md)

- No hardcoded cloud account IDs, project IDs, subscription IDs, or tenant IDs anywhere in code or configuration.
- No hardcoded cloud regions inline in scripts or Terraform — defined as named variables only.
- No hardcoded resource IDs (security group IDs, instance IDs, VPC IDs, subnet IDs, AMI IDs) — applies to all providers.
- No credentials, keys, or secrets in any file tracked by git.
- No personal email addresses or usernames in source code.
