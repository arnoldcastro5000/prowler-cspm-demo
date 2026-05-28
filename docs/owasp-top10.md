# OWASP Top 10 — Web Application Security (2025)

This project deploys a read-only React dashboard on Cloud Run behind Cloudflare. The application has no user input, no authentication system, no database, and no backend API. Mapped against the OWASP Top 10 for Web Application Security (2025 edition): **six categories are mitigated, two are not applicable to a static read-only architecture, and two carry documented residual risk.** Each category is detailed below with its controls and gaps; the **residual risk register** at the end consolidates the two outstanding items (R01: runtime markdown fetch without SRI; R02: SIEM out of scope).

## Status at a glance

| # | Category | Status | Why |
|---|---|---|---|
| A01 | Broken Access Control | 🟢 Mitigated | Worker enforces path + method allowlist; origin secret blocks direct Cloud Run access; no user roles to bypass |
| A02 | Security Misconfiguration | 🟢 Mitigated | 7 nginx security headers; SHA-pinned container images; Terraform validate + Trivy in CI |
| A03 | Software Supply Chain Failures | 🟢 Mitigated | SHA-pinned deps and Actions; Dependabot + Dependency Review + Zizmor; Python ingest uses stdlib only |
| A04 | Cryptographic Failures | 🟢 Mitigated | Cloudflare Full (Strict) TLS; HSTS one year; no custom crypto; secrets in GCP Secret Manager only |
| A05 | Injection | ⚪ Does not apply | No input surface; React auto-escapes; Zod validates findings; CSP nonce blocks inline scripts |
| A06 | Insecure Design | 🟢 Mitigated | Threat model + ADR predate deployment; minimal architecture (no API); defence-in-depth at every layer |
| A07 | Authentication Failures | ⚪ Does not apply | No user accounts, login, sessions, cookies, JWTs, or password storage |
| A08 | Software or Data Integrity Failures | 🟡 Accepted risk | Build artifacts and findings integrity strong; **R01**: runtime markdown fetch from GitHub lacks SRI |
| A09 | Security Logging and Alerting Failures | 🟡 Partially mitigated | Cloud Logging + Cloudflare analytics in place; **R02**: no SIEM or real-time alerting (intentionally out of scope) |
| A10 | Mishandling of Exceptional Conditions | 🟢 Mitigated | Explicit error codes at every layer; nginx fails closed without origin secret; `trap cleanup EXIT` in scan pipeline |

---

## A01: Broken Access Control

**Status:** 🟢 Mitigated

The dashboard is a public read-only site with no user roles, no multi-user access control, and no data mutation endpoints. The only access control boundary is between the public internet and the Cloud Run origin — the Cloudflare Worker validates every request before proxying.

**Controls in place:**

- Cloudflare Worker enforces a path allowlist (`VALID_PATHS` + `ASSETS_PATTERN`) — requests to unlisted paths return 404.
- HTTP methods restricted to GET/HEAD/OPTIONS — all other methods return 405.
- Host header validation blocks misdirected requests.
- Origin protected by `X-CF-Secret` header — direct Cloud Run access without the header returns 403.
- No user roles, no privilege levels, no authorization logic to bypass.

See `docs/security.md` → Pillar 3 (Defended Runtime Edge). See `docs/threat-model.md` → Pillar 3 → Worker security rules. For infrastructure access control (Secret Manager IAM, Terraform credentials, scan pipeline guards), see `docs/security.md` → Pillar 1 (Credential & Secrets Hygiene) and `docs/owasp-genai.md` → ASI03 (Identity & Privilege Abuse).

---

## A02: Security Misconfiguration

**Status:** 🟢 Mitigated

Security headers, container images, and infrastructure configuration are all explicitly defined and validated in CI.

**Controls in place:**

- `nginx.conf` sets 7 security headers: CSP (with per-request nonce), HSTS, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Permissions-Policy (disables camera, microphone, geolocation, payment), Referrer-Policy, Cache-Control (no-cache on HTML/JSON).
- Docker base images pinned to SHA digests (`node:20-alpine@sha256:...`, `nginx:1.27-alpine@sha256:...`).
- CI: `terraform-validate.yml` checks Terraform format and validity on every push.
- CI: `trivy.yml` scans IaC for known misconfigurations (SARIF output uploaded to GitHub Security tab).
- Cloudflare Worker blocks path traversal attempts (`%2e%2e`, null bytes, encoded sequences).
- nginx error pages do not expose version information or stack details.

See `docs/security.md` → Pillar 4 (Hardened Application Surface) → HTTP security headers; Pillar 2 (Secure Build & Supply Chain).

---

## A03: Software Supply Chain Failures

**Status:** 🟢 Mitigated

Every dependency — npm packages, Docker base images, GitHub Actions, Terraform providers — is tracked through automated scanning, pinned to immutable identifiers, and updated via controlled pipelines.

**Controls in place:**

- CI: `dependency-review.yml` scans npm and pip dependencies for known vulnerabilities on every PR that modifies package files.
- Dependabot opens automated PRs weekly for outdated npm, pip, and GitHub Actions dependencies.
- All GitHub Actions pinned to exact commit SHAs, not mutable version tags.
- Docker base images pinned to SHA digests — updates are explicit and reviewed.
- CI: `zizmor.yml` audits GitHub Actions workflows for supply chain risks.
- CI: `secret-scan.yml` and `hardcoded-config-check.yml` detect unauthorized modifications to source.
- Python ingest uses only the standard library (zero third-party dependencies).
- `CLAUDE.md` hard rule: do not add npm packages, pip packages, or Terraform providers not already in the stack.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain).

---

## A04: Cryptographic Failures

**Status:** 🟢 Mitigated

No custom cryptography exists in this project. TLS is handled entirely by Cloudflare (edge) and nginx (origin). No passwords, hashes, keys, or sensitive tokens are stored or processed by the application.

**Controls in place:**

- Cloudflare Full (Strict) SSL enforced — end-to-end encrypted with origin certificate validation.
- HSTS header: `max-age=31536000; includeSubDomains` — browsers enforce HTTPS for one year.
- Origin secret (`CF_ACCESS_SECRET`) transmitted via environment variable at deploy time — not stored in the container image or repository.
- No password storage, no session tokens, no key derivation, no hashing (no user accounts).
- All credentials for cloud providers stored in GCP Secret Manager — fetched at runtime, never written to disk.

See `docs/security.md` → Pillar 4 (Hardened Application Surface) → HTTP security headers; Pillar 1 (Credential & Secrets Hygiene).

---

## A05: Injection

**Status:** ⚪ Does not apply

The dashboard processes no user input. There are no forms, no query parameters interpreted by the application, no search functionality, no POST endpoints, no database, and no server-side code execution. The entire application serves static files.

**Why this does not apply:**

- No SQL, OS commands, LDAP, XPath, or expression language injection surface.
- Findings JSON validated by Zod schema (`FindingSchema`) before rendering — rejects unexpected fields or shapes.
- React 18 auto-escapes all JSX expressions. No `dangerouslySetInnerHTML`, `eval()`, or `innerHTML` in the codebase.
- CSP with per-request nonce blocks inline script injection.
- Remote markdown rendered via ReactMarkdown, which sanitizes HTML by default.

---

## A06: Insecure Design

**Status:** 🟢 Mitigated

The architecture is deliberately minimal — static files served from a container with no backend API. This was an explicit design decision documented in `docs/adr/0001-static-findings-json-baked-into-container.md`: no API means no API attack surface.

**Controls in place:**

- Threat model created before deployment (`docs/threat-model.md`) — documents attack scenarios, mitigations, and intentional scope exclusions.
- ADR-0001 documents the rationale for baking findings into the container image (no runtime data fetch, no database, no API).
- Read-only dashboard with no data mutation capability — the only failure mode is malformed JSON, caught by Zod validation.
- Defence in depth: Cloudflare edge (DDoS, WAF, Bot Fight) → Cloudflare Worker (path allowlist, method restriction, header validation) → nginx (origin secret validation, security headers) → static React app.

See `docs/threat-model.md`. See `docs/adr/0001-static-findings-json-baked-into-container.md`.

---

## A07: Authentication Failures

**Status:** ⚪ Does not apply

The dashboard has no user authentication system. There are no user accounts, no login pages, no sessions, no cookies, no JWTs, no password storage, no MFA, and no account lockout logic.

The only authentication mechanism is the origin secret (`X-CF-Secret`) between the Cloudflare Worker and Cloud Run — this is infrastructure-level access control, not user-facing authentication. It prevents direct access to the Cloud Run origin but does not authenticate individual users.

---

## A08: Software or Data Integrity Failures

**Status:** 🟡 Accepted risk

Most integrity controls are strong. The residual risk is the remote markdown fetch pattern used by two dashboard pages.

**Controls in place:**

- All GitHub Actions pinned to exact commit SHAs — not mutable tags that could be poisoned.
- Docker base images pinned to SHA digests.
- Findings JSON baked into the container at build time — no remote fetch, no runtime integrity risk.
- CI: `secret-scan.yml` (Gitleaks) detects unauthorized modifications that introduce credentials.
- CI: `hardcoded-config-check.yml` detects cloud account IDs or resource identifiers introduced into source.

**Residual risk (R01):**

- `ThreatModel.tsx` and `Security.tsx` fetch markdown at runtime from `raw.githubusercontent.com` with no subresource integrity (SRI) or signature verification. If the GitHub account were compromised, poisoned markdown would render on the dashboard. ReactMarkdown sanitizes HTML (no XSS from this vector), but the content itself could be misleading or defamatory.
- SRI is not practical for dynamic markdown content (the hash changes on every commit). The mitigation is GitHub account security (2FA, audit log) — outside this project's direct control.

---

## A09: Security Logging and Alerting Failures

**Status:** 🟡 Partially mitigated

Logging exists at the infrastructure level but no centralized alerting is configured. This is documented as an intentional scope exclusion.

**Controls in place:**

- nginx logs to stdout/stderr — Cloud Run captures these in Cloud Logging.
- Cloudflare provides analytics, firewall events, and bot detection metrics on the free tier.
- OWASP ZAP baseline scan is run manually against the deployed application.

**Gaps — intentionally out of scope (R02):**

- No centralized log aggregation or SIEM.
- No security alerting for repeated 403/404 patterns or anomalous traffic.
- No client-side error reporting.
- Blocked requests in the Cloudflare Worker return appropriate error codes but are not logged to an external alerting system.
- No real-time notification for security events.

See `docs/threat-model.md` → Appendix B — Out-of-scope threats (continuous monitoring, SIEM, and notifications are explicitly listed as out of scope).

---

## A10: Mishandling of Exceptional Conditions

**Status:** 🟢 Mitigated

The application handles error paths explicitly — no component fails open or silently continues with unsafe defaults when an unexpected condition occurs.

**Controls in place:**

- Cloudflare Worker returns specific error codes for every failure path (400, 403, 404, 405, 414, 421, 431, 502) — each with `Cache-Control: no-store` to prevent error responses from being cached.
- nginx returns 403 when the `X-CF-Secret` header is missing — does not fall through to serving content without origin validation.
- Zod schema validation rejects malformed findings JSON at parse time — the dashboard renders a loading state rather than displaying corrupt data.
- `ThreatModel.tsx` and `Security.tsx` catch fetch errors and display an error state rather than crashing or rendering partial content.
- `run_scan.sh` uses `trap cleanup EXIT` to ensure credential environment variables are unset on both success and failure — no credentials leak on unexpected script termination.

---

## Residual risk register

| ID | Category | Risk | Status | Treatment / compensating control |
|---|---|---|---|---|
| **R01** | A08 — Software or Data Integrity Failures | Markdown fetched at runtime from `raw.githubusercontent.com` by `ThreatModel.tsx` and `Security.tsx` has no SRI or signature verification; a compromised GitHub account could poison rendered content | Accepted | ReactMarkdown sanitizes HTML (no XSS from this vector); residual is misleading or defamatory content. Compensating control: GitHub account 2FA and audit log review — outside this project's direct control. SRI is impractical because the markdown changes on every commit. |
| **R02** | A09 — Security Logging and Alerting Failures | No centralized log aggregation, SIEM, real-time alerting on 403/404 patterns, or external forwarding of Worker-blocked requests | Out of scope | Documented as intentional scope exclusion for a single-developer portfolio project. See `docs/threat-model.md` → Appendix B. Treatment if scope expands: forward Cloud Logging + Cloudflare events to an external SIEM (e.g., Grafana Cloud, Better Stack) and add alerting rules for blocked-request anomalies. |
