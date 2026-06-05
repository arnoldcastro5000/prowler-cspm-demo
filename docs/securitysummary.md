# Security Controls — Executive Summary

**Date:** June 2026  
**Technical detail:** `docs/security.md` — full control specifications  
**Companion document:** `docs/threat-model.md` — risk assessment this document responds to  

---

## Security Posture at a Glance

Five defence-in-depth control layers protect this proof-of-concept and the prowler-cspm pipeline from the public internet to the developer workstation. Every risk identified in the companion risk assessment has been analysed — risks with implemented controls are verified in production or confirmed at container startup; risks without controls have been formally accepted with documented rationale. Four residual risks — scan output chain of custody, single-session credential exposure, cache poisoning, and runtime markdown integrity (WEB-R01) — have been assessed and accepted as appropriate for a single-operator proof-of-concept; the rationale for each is documented below. The remaining open gaps in the AI agent sandbox are noted with the controls that partially address them.

| Control | Threat it addresses | Verification | Gaps |
|---|---|---|---|
| **1. Edge and Network Defence** | Unauthorized access, volumetric attacks, direct origin bypass | Direct-to-origin requests return 403 in production | Cache poisoning via origin headers — accepted |
| **2. Application Hardening** | Cross-site scripting, clickjacking, content injection | OWASP ZAP scan against deployed application | WEB-R01: runtime markdown fetch without SRI — accepted (see §2) |
| **3. Secrets and Credential Hygiene** | Credentials stolen or leaked into code | Two independent secret scans on every commit | Single-session credential exposure — accepted |
| **4. Build Pipeline and Supply Chain** | Compromised dependencies, CI pipeline takeover | 15 automated security checks (14 CI gates + pre-commit hook) on every push and pull request | Scan output chain of custody — accepted |
| **5. AI Agent Sandbox** | AI assistant hijacked, credentials exfiltrated, unauthorized cloud actions | Firewall self-test on every container startup | Firewall can be disabled by any container process; base image and install scripts not integrity-verified; sandbox degrades silently if bubblewrap absent (T-123); no structured audit trail for agent session actions (T-050) |

---

## 1. Edge and Network Defence

**Threat addressed:** An attacker bypassing the security layer to reach the application server directly, flooding the application with traffic to make it unavailable, or exploiting common web attack patterns.

The application is reachable through one path only: Cloudflare's network, which sits in front of the application server and filters every request before it arrives. Volumetric traffic floods are absorbed automatically. Common web attack patterns — including attempts to inject malicious code into the application or extract data through crafted requests — are blocked by Cloudflare's managed rule set. Automated bots and scanners are challenged.

Every request that passes through Cloudflare has a secret value added to it before it is forwarded to the application server. The application server checks for that value and rejects any request that does not carry it with a 403 error. This means direct access to the application server — bypassing Cloudflare entirely — is blocked regardless of what the request looks like.

Eight additional rules run inside Cloudflare before any request reaches the application server. They enforce method restrictions (only standard browser requests are allowed), block oversized or malformed requests, validate the host header to prevent cache abuse, and return error-safe responses that Cloudflare's CDN will never cache.

**Verified by:** Direct requests to the application server URL return 403 in the production environment. All traffic reaches the application through `prowler.cloudsecuritypractice.com` only.

**Accepted risk — cache poisoning.** Cloudflare speeds up the site by storing copies of pages at servers around the world and serving those stored copies to visitors, rather than fetching fresh content from the application server on every request. Cache poisoning is an attack where an adversary manipulates what gets stored in that cache, so that visitors are served tampered or malicious content instead of the real page.

For this attack to succeed, an adversary would first need to gain control of the application server itself — the Google Cloud container where the site originates. Only from that position could they influence what Cloudflare stores and serves. An adversary who has already taken control of the application server has effectively compromised the entire system; poisoning the cache is one additional step they could take from that position, not an independent or lower-bar threat.

Because this risk can only be reached after a more serious breach has already occurred, and because this project holds no user data and runs as a single-operator proof-of-concept, this risk is accepted without additional mitigation.

---

## 2. Application Hardening

**Threat addressed:** An attacker injecting malicious scripts into the page, embedding the application in a deceptive frame, or exploiting browser behaviour to execute code in a visitor's browser.

Six security instructions are sent to every visitor's browser with each page load. These instructions tell the browser where it is allowed to load resources from (same-origin only, plus a small set of explicitly named exceptions), that the page must never be embedded inside another site, that referrer information must not be leaked to external sites on navigation, that the browser must never guess at the content type of a file it receives, and that the connection must always use an encrypted channel. Unused browser features — camera, microphone, location — are disabled at the browser level, not just hidden.

The script loading policy uses a value that changes with every single request, which allows a third-party security script from Cloudflare to run while still blocking any other inline script that an attacker might try to inject. This is one of the stronger configurations available for preventing cross-site scripting.

The deployed application is scanned manually using an automated tool that simulates the kinds of probing an attacker would perform against a live site — checking every discoverable URL for exploitable behaviour.

**Verified by:** OWASP ZAP baseline scan against the deployed application at `prowler.cloudsecuritypractice.com`.

**Accepted risk (WEB-R01):** Findings data is baked into the container image at build time — no runtime API, no database, no user input processing. Eight pages fetch markdown at runtime from `raw.githubusercontent.com`; ReactMarkdown sanitizes all HTML output (no XSS vector). This fetch carries no subresource integrity (SRI) protection — a compromised GitHub account could poison rendered content. This is accepted as WEB-R01 in `docs/owasp-top10.md §A08`. No open gaps have been identified in the core hardening controls (CSP, HSTS, headers, DAST scan) at the current application scope.

---

## 3. Secrets and Credential Hygiene

**Threat addressed:** Cloud credentials being stored on disk, committed to the repository, or exposed in logs and error output — any of which would give an attacker the same access to cloud infrastructure as the operator.

All cloud credentials — for AWS, GCP, and Azure — are stored in a managed secrets vault, not on the developer's machine or in any file. They are fetched from the vault at the moment they are needed and held only in memory for the duration of the scan. When the scan ends, whether it succeeds or fails, a cleanup step explicitly removes the credentials from memory before the process exits. Exception: one component of the Azure credential set is not fully cleared from process memory when the scan completes — it persists in the running session until the process exits (T-113 in `docs/stride.md`).

The secret that allows Cloudflare to authenticate to the application server is fetched from the same vault at deployment time and injected directly into the running application. It is never written to the container image or stored in the repository.

Two independent checks scan every code change for accidentally included credentials before they can become public. The first runs on the developer's machine at the moment of every commit, before the change leaves the workstation. The second runs automatically in the cloud pipeline on every push and pull request. If either scan finds a credential pattern, the commit or the pipeline is blocked.

All cloud account identifiers are removed from scan results before they are included in the application. The raw, unredacted scan output is never published.

Terraform state is stored locally on the WSL2 machine and excluded from the repository via `.gitignore`. No remote backend is used — state files contain sensitive resource metadata and cloud credentials and never leave the developer workstation.

**Verified by:** Two independent credential scans on every commit (Gitleaks pre-commit hook + Betterleaks CI workflow). Both scan the new changes and the full git history.

**Accepted risk — single-session credential exposure.** All three cloud providers' credentials are fetched in a single session. A session compromised while credentials are in memory exposes access to all three simultaneously. Isolating credentials per provider would require significant pipeline redesign. In a single-operator PoC where the scan runs interactively and credentials are held in memory only for the duration of the scan, this risk is accepted.

---

## 4. Build Pipeline and Supply Chain

**Threat addressed:** A compromised software package entering the codebase, a malicious change bypassing review, or the automated build process being manipulated to produce a tampered output.

Fifteen automated security checks cover every code change before it can be merged or deployed — 14 CI gates on every push and pull request, plus a pre-commit hook that runs before changes leave the developer's machine. No change reaches production without passing all of them. The checks cover: scanning the source code for injection vulnerabilities, verifying that no dependency added to the project has a known security issue at the time of merge, checking the container image for known vulnerabilities before it ships, auditing the build pipeline configuration itself for weaknesses that could allow it to be hijacked, and validating the infrastructure definitions before they touch live cloud resources.

Every external tool in the CI/CD build pipeline is locked to a specific verified version at the time it was reviewed and approved, and all checkout actions set `persist-credentials: false` so the GitHub token is not available to downstream steps. A tool that is later compromised cannot silently substitute itself into the pipeline — the pipeline will reject it because the version no longer matches. An automated service reviews all dependencies daily and opens a change request when updates are available, so version locks stay current without manual tracking. Note: development environment toolchain integrity (DevContainer base image, install scripts) is a separate open gap documented in §5.

**Verified by:** CI gate status on every push and pull request. All 15 checks must pass for a change to merge. For a full risk analysis of the CI/CD pipeline against the OWASP Top 10 CI/CD Security Risks, see `docs/owasp-cicd.md`.

**Accepted risk — scan output chain of custody.** After the security scanner runs, it writes its findings to a folder on the local machine. That folder can be modified before the output is packaged into the application image, and there is no signature or verification step in between. Exploiting this requires an adversary with an interactive session on the developer's machine during the narrow window between the scan completing and the image being built. In a single-operator PoC with no adversarial local access, this risk is accepted. A production deployment would require output signing and signature verification at packaging time.

---

## 5. AI Agent Sandbox

**Threat addressed** *(from companion risk assessment, scores 7.2 / 7.0 / 6.8):* The AI coding assistant being directed by a malicious instruction — delivered through a GitHub issue or pull request comment — to execute cloud commands, read credentials, or exfiltrate data. This is the highest-scored unmitigated threat class in the risk assessment, with confirmed real-world exploits across major AI coding platforms in 2026.

The development environment runs inside an isolated container. The container is given access to only one location on the developer's machine: the project directory. The rest of the host filesystem — including the folders where cloud credentials are stored — is not mounted into the container and is not visible to anything running inside it. The cloud credential management tool is not installed in the container at all. This means the AI assistant has no path to cloud credentials through the filesystem, regardless of its other capabilities.

Every time the container starts, a firewall is configured that blocks all outbound network connections by default. The only destinations the AI assistant can reach are those on an explicit allowlist: GitHub's infrastructure (for source control), the package registry used by the project, the Anthropic API (for the AI assistant itself), and the VS Code extension marketplace. Every other outbound connection is rejected. The firewall runs a self-test on every startup — it confirms that an arbitrary external website is unreachable and that the approved destinations are reachable — and the container will not finish starting if either check fails.

Within the container, the AI assistant runs inside a second layer of isolation — a process-level sandbox that limits which files it can write to, which commands it can run without explicit human approval, and where it can send data. This sandbox is enforced by a policy file baked into the container image itself. A developer cannot weaken or disable it from inside the container. The policy requires explicit human confirmation before the assistant can perform destructive or irreversible operations.

Credential scanning is also built into the development environment. Gitleaks runs as a pre-commit hook inside the container, catching accidentally included secrets before they leave the workstation. The CI pipeline runs a separate scan using Betterleaks on every push and pull request, providing a second independent check against the full git history.

The developer account inside the container has elevated permissions for exactly one operation: running the firewall setup script at startup. No other administrative action is available to it.

**Verified by:** The firewall script confirms its own rules on every container startup. Startup fails if the verification does not pass. The enforced policy file is embedded in the container image and cannot be modified at runtime.

| What is controlled | How |
|---|---|
| Credential filesystem access | Container bind-mount scoped to project directory only — credential stores are not present inside the container |
| Outbound network destinations | Firewall allowlist — only GitHub, npmjs.org, Anthropic API, VS Code marketplace |
| File system write access | Process sandbox — write access limited to project directory and designated temp paths |
| Destructive commands | Explicit human approval required before execution |
| Credential scanning | Pre-commit hook runs inside the container on every commit |
| Policy enforcement | Policy baked into container image — not configurable by the user session |

**Residual risk:** Four gaps remain in this control family.

First, the base container image is not locked to a specific verified version, and the scripts used to install development tools are not verified before they run. If either were substituted, malicious code could enter the container before any of the above controls are active. Second, the firewall requires a system-level network permission to function. Any process that achieves code execution inside the container holds that same permission and could use it to reconfigure or disable the firewall without exploiting any software vulnerability. Third, the process sandbox is configured to continue running — without restrictions and without alerting the user — if the isolation layer is unavailable. A container that starts without the isolation layer would give the AI assistant unrestricted access with no visible indication that the protection is absent (T-123 in `docs/stride.md`). Fourth, agent actions inside the container leave no structured audit trail beyond shell history — there is no per-session log of which commands were run or which files were modified by the assistant (T-050 in `docs/stride.md`).

---

## Appendix: Hard Rules

The following constraints are enforced in the project's AI working context and verified by automated pipeline checks on every commit. They close the class of accidental information disclosure that is hardest to catch in code review.

- No cloud account identifiers (account IDs, project IDs, subscription IDs, tenant IDs) anywhere in code or configuration — all must be derived at runtime
- No cloud regions hardcoded inline in scripts or infrastructure definitions — defined as named variables only
- No infrastructure resource identifiers (security group IDs, instance IDs, VPC IDs, subnet IDs, AMI IDs) in any committed file
- No credentials, keys, or secrets in any file tracked by version control
- No personal email addresses or usernames in source code
