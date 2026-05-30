# Threat Model

**Threat posture: every attack path is mapped to a defended layer, and the demonstration risks created by this project are time-bounded and accepted.** The steady-state threat surface — credentials, build pipeline, runtime edge, application surface, and AI development environment — is addressed by the five control families documented in `security.md`. The temporary risks created during a scan cycle (intentional cloud misconfigurations) are explicitly scoped, contain no data, and are remediated within the same session (see Appendix A).

## At a glance

| Threat domain | Primary threats | Mitigations | Residual risk |
|---|---|---|---|
| **1. Credential & secrets** | Credential theft, leakage in git, exposure in published findings | GCP Secret Manager, runtime `trap` cleanup, Gitleaks (pre-commit + CI), identifier redaction | Commit of a new secret format Gitleaks doesn't yet pattern-match |
| **2. Build & supply chain** | Compromised dependency, malicious commit, CI runner takeover | 12 CI gates, SHA-pinned actions, `persist-credentials: false`, Dependabot, Zizmor | Zero-day in a pinned dependency before the next Dependabot PR |
| **3. Runtime edge** | DDoS, web attack payloads, origin bypass, bot scraping | Cloudflare WAF + DDoS + Bot Fight; 8 Worker rules; origin shared secret | Cloudflare account compromise; shared-secret leak (rotatable) |
| **4. Application surface** | XSS via injected JS, clickjacking, MIME sniffing, downgrade | CSP w/ nonce, HSTS, X-Frame, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | Browser-level zero-day |
| **5. AI development** | Destructive shell action via agent, data exfiltration via agent, secret written by agent | Sandboxed Claude Code (filesystem / network / command restrictions); permission prompts on destructive operations | Agent operating outside the sandbox; user fatigue approving prompts |

---

## 1. Credential & Secrets Threats

*The biggest credential risk is in-flight exposure, not storage. Secrets live in one vault, are scoped to specific resources, and any commit-time leak is caught twice.*

| Scenario | What happens | How it is addressed |
|---|---|---|
| Cloud provider credential is committed to git | A push exposes long-lived AWS / GCP / Azure credentials | Gitleaks runs as a pre-commit hook (blocks the commit locally) **and** in CI on every push (blocks the merge if the local hook was skipped) |
| Cloud credential leaks to disk between runs | Exported env vars persist after a scan and are later read by another process | `prowler/run_scan.sh` uses `trap cleanup EXIT` to unset all credential env vars on exit, including on error |
| Cloudflare origin shared secret is leaked | Attacker bypasses Cloudflare and reaches the Cloud Run origin directly | Secret stored in GCP Secret Manager; rotation requires only redeploying with the new secret value |
| Cloud account or resource identifier is exposed in published findings | Attacker uses the ID to fingerprint or enumerate the account | All cloud identifiers are stripped from findings JSON before publication; raw Prowler output (which contains unsanitized data) is never written to the published file |
| Local development machine is compromised | Attacker reads the project directory and discovers infrastructure configuration | Configuration files contain no secrets and no resource IDs (Hard Rules enforce this); Terraform state files are gitignored and never copied off the developer workstation |

---

## 2. Build & Supply Chain Threats

*The build is the new perimeter. Every dependency pins, every change passes 12 gates, and the CI runner carries no credentials to steal.*

| Scenario | What happens | How it is addressed |
|---|---|---|
| Compromised npm, pip, or Terraform dependency is pulled in | Malicious code enters the build pipeline through a library update | Dependabot opens weekly PRs to update dependencies; the Dependency Review workflow flags any added dependency with a known CVE before merge |
| Malicious commit is pushed to the repository | Bad code reaches the deployed dashboard | 12 automated CI checks run on every push and PR; all GitHub Actions are pinned to commit SHAs (not mutable tags); deployment is a manual step from the developer workstation, never auto-deployed from CI |
| CI runner is compromised | Attacker steals credentials persisted by the runner | `persist-credentials: false` is set on all checkout actions; no long-lived cloud credentials are stored in GitHub secrets — all credentials live in GCP Secret Manager and are fetched from WSL2 only |
| CI workflow itself is modified to bypass checks | Attacker amends a workflow file to skip security gates | Zizmor audits the workflows themselves for supply-chain weaknesses (action injection, expression-based RCE, etc.) on every change to `.github/workflows/` |
| Intentional Trivy findings on `iac/modules/` mask a genuine misconfiguration | Reviewer dismisses a real finding as expected noise | Findings on `iac/modules/` are pre-known and documented as the before-state baseline; findings elsewhere in the codebase are unexpected and must be triaged |

For a full risk analysis of the CI/CD pipeline against the **OWASP Top 10 CI/CD Security Risks**, see `docs/owasp-cicd.md`.

---

## 3. Runtime Edge Threats

*The only legitimate path runs through Cloudflare. Direct origin requests, malformed payloads, and unexpected methods are all rejected before they can do harm.*

All visitor traffic passes through Cloudflare (which provides firewall, DDoS protection, and caching) before reaching the application server on Google Cloud. A secret shared between Cloudflare and the server ensures that only traffic routed through Cloudflare is accepted. Direct access to the server is blocked.

```
Visitor → Cloudflare (firewall, DDoS protection) → Cloudflare Worker (adds secret) → Application server (verifies secret)
```

### Origin protection

| Scenario | What happens | How it is addressed |
|---|---|---|
| Someone discovers the application server's direct address | They try to access it without going through Cloudflare | The server rejects any request that does not carry the shared secret |
| The shared secret is leaked | An attacker could bypass Cloudflare and reach the server directly | The secret is stored in Google Cloud's Secret Manager and can be rotated by redeploying |
| The Cloudflare Worker stops working | The dashboard goes down because the secret is no longer being added to requests | Manual intervention is required to fix and redeploy the Worker |

### Cloudflare edge protections

| Scenario | What happens | How it is addressed |
|---|---|---|
| Automated scanners probe for common vulnerabilities | Bots send SQL injection, path traversal, and other attack payloads to the dashboard | WAF blocks malicious requests before they reach Cloud Run. The dashboard is static HTML with no backend API, so most payloads would fail anyway. |
| An attacker floods the dashboard with traffic | Volumetric DDoS attack aims to take the site offline | Cloudflare absorbs the traffic at the edge. Without it, Cloud Run would scale up (incurring cost) or hit its concurrency limit and go down. |
| Millions of requests hit the application server | Cost-based attack or traffic spike overwhelms Cloud Run | CDN caches static assets at the edge. Repeated requests are served from Cloudflare's cache, not the container. |
| Automated bots scrape or spam the dashboard | Bots send high volumes of requests mimicking real traffic | Bot Fight Mode detects known bot patterns and issues computationally expensive challenges that increase the cost for bots to continue. Included on the free plan but cannot be customized. |
| Requests arrive from fake or non-standard browsers | Bots and crawlers send malformed HTTP headers or no user agent | Browser Integrity Check evaluates client behavior across multiple requests and blocks clients that do not behave like a real browser session. |
| Someone bypasses Cloudflare and hits Cloud Run directly | All other Cloudflare protections are skipped | The Worker adds `X-CF-Secret` to every request; Cloud Run rejects anything without it. This makes all other Cloudflare features mandatory — you cannot skip them. |

### Worker security rules

The Cloudflare free plan does not support custom WAF rules, method filtering, or path filtering. The Worker is the only place to enforce these controls. These 8 rules fill the gap between Cloudflare's managed protections and what a paid plan would provide. Rule numbers match the implementation order in `cloudflare/worker.js`.

| Rule | Scenario | What happens | How it is addressed |
|---|---|---|---|
| 1 | A POST, PUT, or DELETE request is sent to the dashboard | The site is read-only — any write method is by definition malicious or accidental | The Worker returns 405 Method Not Allowed for any method other than GET, HEAD, or OPTIONS. OPTIONS is allowed because browser extensions or Cloudflare features may trigger CORS preflight requests. |
| 2 | A GET request arrives with a body | Attackers use GET-with-body to exploit differences in how proxies and servers parse requests (HTTP desync) | The Worker returns 400 Bad Request if the request has a body |
| 3 | A request contains encoded path traversal or null bytes | Double-encoded sequences like `%252e%252e` bypass basic traversal detection | The Worker inspects the raw URL before parsing and blocks encoded traversal sequences and null bytes |
| 4 | A request has an extremely long URL | Attackers pad URLs to overflow buffers or evade WAF pattern matching | The Worker returns 414 URI Too Long for paths exceeding 256 characters |
| 5 | A request targets a path that does not exist or an unexpected file type under `/assets/` | Scanners probe for `/wp-admin`, `/.env`, `/.git/config`, `/admin`, `/api/`, web shells, and PHP backdoors | The Worker checks the path against an allowlist of valid routes and static files. `/assets/` paths must match Vite's naming convention and only `.js` and `.css` extensions are allowed. Returns 404 for anything else. |
| 6 | A request carries oversized headers | Attackers use large headers for log flooding, cookie-bombing, or resource exhaustion | The Worker returns 431 if total headers exceed 16KB or any single header exceeds 4KB. Thresholds account for Cloudflare's own headers and enterprise proxy headers. |
| 7 | A request arrives with an unexpected Host header | Host header injection enables cache poisoning and DNS rebinding | The Worker validates the Host header against the expected domain, comparing case-insensitively and allowing the port variant (`:443`) |
| 8 | A blocked request is cached by Cloudflare's CDN | An attacker triggers a block for a legitimate path, and the error response gets cached | All error responses include `Cache-Control: no-store` to prevent caching |

---

## 4. Application Surface Threats

*Even a static, read-only site carries browser-default attack surface. Six headers close those paths.*

The dashboard is a static site with no login, no forms, and no user input. These headers protect against threats that exist even for a read-only public site:

| Scenario | What happens | How it is addressed |
|---|---|---|
| Malicious JavaScript is injected via a compromised repository or npm dependency | The script tries to steal data or load external resources | `Content-Security-Policy` limits where scripts can send data and blocks inline scripts without the per-request nonce. Also prevents loading resources from unauthorized external domains. |
| A visitor's first request is intercepted over HTTP | An attacker performs SSL stripping before the redirect to HTTPS | `Strict-Transport-Security` tells the browser to never attempt HTTP for this domain. |
| The dashboard is embedded in an iframe on a malicious site | An attacker attempts clickjacking by overlaying invisible controls | `X-Frame-Options: DENY` prevents any site from framing the dashboard. Low risk since there are no interactive controls, but it closes the path entirely. |
| A JSON findings file is served with the wrong MIME type | The browser misinterprets the file as executable JavaScript | `X-Content-Type-Options: nosniff` prevents MIME-type sniffing, ensuring files are treated as their declared type. |
| A visitor clicks an external link on the landing page | The full URL path leaks to GitHub or LinkedIn via the referrer header | `Referrer-Policy` limits referrer information sent to external sites. |
| Injected script tries to access device hardware | A compromised dependency attempts to use camera, microphone, geolocation, or payment APIs | `Permissions-Policy` disables these browser features entirely. The dashboard does not use them, so disabling them eliminates an entire class of attack surface. |

The most meaningful headers for this project are **CSP** (limits the blast radius of a code compromise) and **HSTS** (prevents downgrade attacks). The others are defence-in-depth — low effort, but they close off attack paths that would otherwise exist by browser default.

---

## 5. AI Development Threats

*AI-assisted development inherits the same least-privilege principle as any other tool — bounded filesystem, network, and command access.*

| Scenario | What happens | How it is addressed |
|---|---|---|
| Agent attempts a destructive shell command (`rm -rf`, force-push, branch delete) | Could destroy local work or rewrite shared history | Sandbox requires explicit user permission for destructive operations; the agent cannot bypass the prompt |
| Agent writes a credential or other secret to a project file | Secret could later be committed to git and leak | Sandbox restricts writes to the project directory only; the Gitleaks pre-commit hook + CI scan catch any secret pattern before it reaches the remote |
| Agent reads sensitive files outside the project (SSH keys, browser profile, shell rc files) | Could exfiltrate them via a network call | Sandbox restricts the filesystem read scope; network egress is restricted to an explicit allowlist |
| Agent exfiltrates project data to an external endpoint | Findings, code, or secrets sent to an attacker-controlled service | Network restrictions enforce an allowlist of approved hosts; arbitrary outbound requests are blocked |

---

## Appendix A — Accepted demonstration risks (scan window)

This project intentionally creates security vulnerabilities in real cloud environments to demonstrate that they can be detected and fixed. During a scan cycle, real cloud resources across AWS, Google Cloud, and Azure are deliberately left in an insecure state. This window is kept as short as possible — typically under an hour — but during that time, the following exposures exist:

| Misconfiguration | Provider | What is exposed | What could happen |
|---|---|---|---|
| Remote login open to the internet | AWS | Server accepts SSH connections from any IP address | Unauthorized access attempts against the server |
| Storage bucket public access enabled | AWS | Bucket contents readable by anyone on the internet | Data theft if files were present |
| Weak password policy | AWS | Minimum password length set below 14 characters | Brute-force attacks against console login |
| Multi-region audit logging disabled | AWS | AWS API activity outside the primary region is not recorded in CloudTrail | An attacker operating in a non-logged region could act without leaving an audit trail |
| S3 bucket default encryption disabled | AWS | Objects uploaded to the bucket are not encrypted at rest unless explicitly specified | Data stored in the bucket is readable if the underlying storage is compromised |
| Storage bucket public access enabled | Google Cloud | Bucket contents readable by anyone on the internet | Data theft if files were present |
| Firewall allows remote login from any source | Google Cloud | SSH connections accepted from any IP address | Unauthorized access to any server using this firewall rule |
| Service account has administrative access | Google Cloud | A service account can perform any action in the project | Full project takeover if the service account key is compromised |
| Audit logging alert disabled | Google Cloud | No alert when audit configuration is changed | An attacker could modify logging without detection |
| Encryption key rotation disabled | Google Cloud | Encryption key is not rotated annually | Longer exposure window if the key is compromised |
| Storage account allows public access | Azure | Blobs readable by anyone on the internet | Data theft if files were present |
| Remote desktop open to the internet | Azure | Server accepts RDP connections from any IP address | Brute-force attacks, ransomware entry point |
| Custom role with owner permissions | Azure | A role with full subscription-level access exists | Full subscription takeover if the role is assigned to a compromised identity |
| Activity log alert disabled | Azure | No alert when security solutions are created or modified | An attacker could disable security controls without detection |
| Unencrypted storage connections allowed | Azure | Storage account accepts HTTP requests without encryption | Network traffic could be intercepted in transit |

### Why this is acceptable

- **No real data exists in these resources.** Storage buckets are empty. Servers run no applications. There is nothing to steal.
- **No real users are affected.** These are isolated demo accounts with no other users or workloads.
- **The window is minimized.** Misconfigurations are applied, scanned, and remediated in a single session.
- **The server is shut down after the scan.** Once remediation is applied, the server stops running entirely.
- **Credentials are limited in scope.** Each cloud provider's credentials can only modify the specific resources in this project.

### What could still go wrong

An attacker scanning the internet during the scan window could discover the open network ports. While login would fail (no credentials are configured on the server), the open port signals that the account exists and could attract further probing.

---

## Appendix B — Out-of-scope threats

These are intentional scope decisions, not oversights:

| Scenario | What happens | How it is addressed |
|---|---|---|
| Infrastructure changes between scans go undetected | This project captures point-in-time snapshots, not live state | Continuous monitoring is out of scope; each scan is a deliberate manual step |
| Security events are not forwarded to external platforms | The dashboard is self-contained with no log forwarding | SIEM integration is not needed for a single-developer portfolio project |
| No notifications are sent when findings change | Changes to cloud posture are only visible after the next scan cycle | Real-time alerting is out of scope |
| Only one account per cloud provider is scanned | The demonstration covers three providers but not multi-account environments | Multi-account scanning is not needed to demonstrate the pipeline |
| Findings data is not encrypted at rest | Findings JSON is baked into the container image as a static file | Findings are public by design and contain no sensitive information after redaction |
| The dashboard container image is not scanned | Trivy scans infrastructure code but not the final Docker image | Container image scanning would add value but is not yet implemented |

---

## Appendix C — Incident response: credential compromise

1. **Create a new version** of the secret in Google Cloud Secret Manager
2. **Revoke the old credential** in the affected cloud provider's console
3. **Redeploy the dashboard** if the compromised secret is the one shared with Cloudflare
4. **Review access logs** in Google Cloud Run and Cloudflare for unauthorized activity during the exposure window
5. **Check the code repository** for any accidental credential commits (automated scanning runs on every push, but verify manually)
