# STRIDE Threat Model with DREAD Scoring

**Scope:** All components, outside-in from the public internet. Every trust boundary and element in the system is analysed. This document does not link mitigations — mitigation tracking is in a separate file.

**Status codes:** ✅ mitigated, ⚠️ partial mitigation, ❌ gap (no effective control in place).

---

## Methodology

**STRIDE variants applied:**

- **§4 STRIDE-per-element-type** — Each system element is classified as Process, Data Store, or External Entity. Only the STRIDE categories applicable to that element type are analysed.
- **§5 STRIDE-per-interaction** — Every trust boundary crossing (TB-1 through TB-15) is analysed for data-flow-applicable categories: Tampering (T), Info Disclosure (I), Denial of Service (D).

**Category matrix by element type:**

| Element Type | Applicable STRIDE Categories |
|---|---|
| External Entity | S (Spoofing), R (Repudiation) |
| Process | S, T, R, I, D, E (all six) |
| Data Store | T (Tampering), R (Repudiation), I (Info Disclosure), D (Denial of Service) |
| Data Flow | T (Tampering), I (Info Disclosure), D (Denial of Service) |

**DREAD scoring:** Each threat is scored on five dimensions, each 1–10. Composite = average of all five, rounded to one decimal place. Scores and scoring rationale are in §8.1; §4 and §5 contain system-level threat identification only. Scores reflect **inherent risk** — the threat class as the design enables it, independent of mitigation status. A mitigated threat (✅) retains its inherent score; the Status column records whether effective controls exist, not whether the threat's severity has changed.

| Abbrev | Dimension | Scale |
|---|---|---|
| Dmg | Damage — severity of impact if exploited | 1 = negligible; 10 = catastrophic / full system compromise |
| Rep | Reproducibility — ease of repeating the attack | 1 = rare / one-time conditions; 10 = trivially automated |
| Exp | Exploitability — skill and effort required | 1 = deep insider access required; 10 = no skill, no tools |
| Aff | Affected scope — systems/data impacted | 1 = one component; 10 = all credentials / full infrastructure |
| Dis | Discoverability — ease of finding the vulnerability | 1 = buried / internal only; 10 = publicly documented |

**Threat IDs:** Flat sequential T-001 through T-135, assigned in document order (§4 elements first, §5 interactions continuing; T-113 and T-114 added during validation; T-115–T-133 added for Cloudflare Worker and DevContainer gaps identified in code review; T-134–T-135 added for canonical STRIDE completeness). The Threat Register in §6 is the index.

**Out of scope:** Mitigation tracking; MITRE ATT&CK cross-validation; threat IDs back-referenced within component notes (register in §6 serves that purpose); dedicated §4 analysis of External Entity nodes (N-12, N-13, N-14) — their Spoofing and Repudiation threats manifest at trust boundaries already covered in §5 (N-12 → TB-1, TB-12; N-13 → TB-5 via T-034, T-041, T-090, T-091; N-14 → TB-8 via T-098).

---

## 1. Data Flow Diagram

### 1.1 DFD Nodes

| Node ID | Name | Type | Trust Zone | STRIDE Categories |
|---|---|---|---|---|
| N-01 | Cloudflare Worker | Process | Z-2 Cloudflare Edge | S, T, R, I, D, E |
| N-02 | Cloud Run / Dashboard | Process | Z-3 GCP Cloud Run | S, T, R, I, D, E |
| N-03 | GitHub Actions Runners | Process | Z-7 GitHub Actions Runner | S, T, R, I, D, E |
| N-04 | Makefile / WSL2 Workstation | Process | Z-8 WSL2 Operator Workstation | S, T, R, I, D, E |
| N-05 | Prowler Scanner (run_scan.sh) | Process | Z-8 WSL2 Operator Workstation | S, T, R, I, D, E |
| N-06 | Ingest Script (ingest_prowler.py) | Process | Z-8 WSL2 Operator Workstation | S, T, R, I, D, E |
| N-07 | AI Agent (Claude Code) | Process | Z-11 AI Agent | S, T, R, I, D, E |
| N-08 | Artifact Registry / Docker Image | Data Store | Z-4 GCP Artifact Registry | T, R, I, D |
| N-09 | GCP Secret Manager | Data Store | Z-5 GCP Secret Manager | T, R, I, D |
| N-10 | Public Repository | Data Store | Z-6 GitHub Platform | T, R, I, D |
| N-11 | Scan Output Filesystem | Data Store | Z-12 Scan Output Filesystem | T, R, I, D |
| N-12 | Public Internet Users | External Entity | Z-1 Public Internet | S, R |
| N-13 | npm / PyPI Registries | External Entity | Z-10 npm / PyPI Registries | S, R |
| N-14 | Cloud Provider APIs | External Entity | Z-9 Cloud Provider APIs | S, R |
| N-15 | DevContainer | Process | Z-13 DevContainer | S, T, R, I, D, E |

### 1.2 DFD Data Flows

| Flow ID | From Node | Data | To Node | Trust Boundary |
|---|---|---|---|---|
| F-01 | N-12 Public Internet | HTTP/HTTPS requests | N-01 Cloudflare Worker | TB-1 Internet → Edge |
| F-02 | N-01 Cloudflare Worker | Proxied HTTP + X-CF-Secret header | N-02 Cloud Run | TB-2 Edge → Origin |
| F-03 | N-04 WSL2 Workstation | gcloud secret fetch (5 credentials) | N-09 Secret Manager | TB-3 Workstation → Secret Store |
| F-04 | N-04 WSL2 Workstation | git push, gh CLI commands, workflow triggers | N-10 Public Repository | TB-4 Workstation → Source Control |
| F-05 | N-03 GitHub Actions | npm ci, pip install during workflow | N-13 npm / PyPI | TB-5 CI Runner → Package Registries |
| F-06 | N-04 WSL2 Workstation | docker build + docker push (make deploy) | N-08 Artifact Registry | TB-6 Workstation → Container Registry |
| F-07 | N-08 Artifact Registry | Container image pull on Cloud Run deployment | N-02 Cloud Run | TB-7 Registry → Cloud Run |
| F-08 | N-05 Prowler Scanner | Prowler CLI read-only API calls (15 checks × 3 clouds) | N-14 Cloud Provider APIs | TB-8 Workstation → Cloud APIs |
| F-09 | N-05 Prowler Scanner | OCSF JSON write to /var/tmp/prowler-output/ | N-11 Scan Output Filesystem | TB-9 Scanner → Scan Output |
| F-10 | N-11 Scan Output Filesystem | findings JSON → Vite build → Docker image | N-08 Artifact Registry (via build) | TB-10 Scan Output → Docker Build |
| F-11 | N-07 AI Agent | File reads/writes, bash execution, git operations | N-04 WSL2 Workstation | TB-11 AI Agent → Workstation |
| F-12 | N-12 Public Internet | Anonymous git clone, API reads, security doc reads | N-10 Public Repository | TB-12 Internet → Repository |
| F-13 | N-04 WSL2 Workstation | Container startup, bind-mount /workspace, NET_ADMIN capability grant | N-15 DevContainer | TB-13 |
| F-14 | N-15 DevContainer | Base image pull (node:20), binary downloads (gitleaks, Claude Code install script) | N-13 npm / PyPI Registries (reuse) | TB-14 |
| F-15 | N-15 DevContainer | Unauthenticated GitHub API fetch (IP ranges) + DNS resolution (dig) during firewall init | N-10 Public Repository / GitHub API | TB-15 |

---

## 2. Trust Zones

| ID | Zone Name | Description | Trust Level |
|---|---|---|---|
| Z-1 | Public Internet | External users, attackers, automated scanners — no trust assumed | Untrusted |
| Z-2 | Cloudflare Edge | Cloudflare-managed CDN/WAF network — controlled but not operator-owned | Partially trusted |
| Z-3 | GCP Cloud Run | GCP-managed container runtime — operator-deployed, GCP-operated | Trusted (GCP) |
| Z-4 | GCP Artifact Registry | GCP-managed container registry — operator-controlled, GCP-operated | Trusted (GCP) |
| Z-5 | GCP Secret Manager | GCP-managed secrets store — single vault for all cloud credentials | Trusted (GCP) |
| Z-6 | GitHub Platform | GitHub-hosted source control and CI/CD — operator-controlled repo, GitHub-operated platform | Partially trusted |
| Z-7 | GitHub Actions Runner | GitHub-hosted ephemeral CI runner — executes workflows, carries no cloud credentials | Partially trusted |
| Z-8 | WSL2 Operator Workstation | Local developer machine — operator-controlled, highest operator privilege | Trusted (operator) |
| Z-9 | Cloud Provider APIs | AWS, GCP, Azure control planes accessed during Prowler scan | Trusted (providers) |
| Z-10 | npm / PyPI Registries | External open-source package repositories — no integrity guarantee | Untrusted |
| Z-11 | AI Agent (Claude Code) | Claude Code process on WSL2 — bounded by sandbox, same filesystem access as operator | Partially trusted |
| Z-12 | Scan Output Filesystem | Local /var/tmp/prowler-output/ and dashboard/public/ — intermediate data between pipeline stages | Trusted (operator), unverified |
| Z-13 | DevContainer | Operator-built container running Claude Code on WSL2; network egress restricted by iptables firewall; shares /workspace bind-mount with host | Partially trusted |

---

## 3. Trust Boundaries

| ID | Boundary | From Zone | To Zone | Data Flows Crossing | Required Controls | Status |
|---|---|---|---|---|---|---|
| TB-1 | Internet → Edge | Z-1 | Z-2 | HTTP/HTTPS requests | WAF rules, DDoS protection, method allowlist (GET/HEAD/OPTIONS), path allowlist, encoding checks | ✅ |
| TB-2 | Edge → Origin | Z-2 | Z-3 | Proxied requests + X-CF-Secret | CF_SECRET validation at Cloud Run; IP allowlisting to Cloudflare CIDRs | ⚠️ (no IP allowlist at Cloud Run) |
| TB-3 | Workstation → Secret Store | Z-8 | Z-5 | gcloud secret fetch (5 credentials) | ADC authentication, MFA on operator identity, per-secret IAM bindings | ❌ (no per-secret IAM; no MFA on ADC; latest version unpin) |
| TB-4 | Workstation → Source Control | Z-8 | Z-6 | git push, workflow triggers | Branch protection rules, commit signing, gitleaks secret scan | ⚠️ (branch protection rules not visible from workflow files) |
| TB-5 | CI Runner → Package Registries | Z-7 | Z-10 | npm ci, pip install | Dependency review gate, lockfile pinning, SHA verification | ⚠️ (dependency-review gate present; no hash verification per package) |
| TB-6 | Workstation → Container Registry | Z-8 | Z-4 | docker push | GCP SA authentication, digest capture post-push, Trivy scan | ⚠️ (Trivy scans in CI, not at push time; race window exists) |
| TB-7 | Registry → Cloud Run | Z-4 | Z-3 | Container image pull | Image digest pinning in deploy command; Artifact Registry Reader role scoping | ⚠️ (digest pinned; SA permissions unverified) |
| TB-8 | Workstation → Cloud APIs | Z-8 | Z-9 | Prowler CLI API calls | Short-lived credentials, read-only IAM scope, env var cleanup trap | ⚠️ (credentials persist across all 3 clouds for full scan duration) |
| TB-9 | Scanner → Scan Output | Z-8 (Prowler process) | Z-12 | OCSF JSON to /var/tmp/prowler-output/ | Directory permissions (700), checksum alongside output | ❌ (dir created 0755 — no -m flag; no checksum) |
| TB-10 | Scan Output → Docker Build | Z-12 | Z-4 (via build) | findings JSON → Vite build → image | File integrity check before build; restricted write on dashboard/public/ | ❌ (no integrity check; existence-only gate in Makefile) |
| TB-11 | AI Agent → Workstation | Z-11 | Z-8 | File reads/writes, bash exec, git ops | Sandbox filesystem/network restrictions, permission prompts for destructive ops | ⚠️ (sandbox active; prompt injection bypasses intent) |
| TB-12 | Internet → Repository | Z-1 | Z-6 | Anonymous git clone, API reads, doc reads | Public read-only access; no secret data in repo; gitleaks scanning | ⚠️ (no secret data in repo; security docs disclose trust boundaries and gaps) |
| TB-13 | WSL2 Host → DevContainer | Z-8 | Z-13 | Container startup, bind-mount /workspace, NET_ADMIN capability grant | Digest-pinned base image; integrity-verified binaries; firewall active at container start; failIfUnavailable=true | ⚠️ (firewall active; binaries unverified; failIfUnavailable=false) |
| TB-14 | DevContainer Build → Container Registries | Z-13 | Z-10 | Base image pull, binary downloads (gitleaks, Claude Code) | Digest pin for base image; GPG/checksum for downloaded binaries; no curl\|bash | ❌ (node:20 unpinned; gitleaks unverified; Claude install via curl\|bash) |
| TB-15 | DevContainer Firewall → GitHub API | Z-13 | Z-6 | Unauthenticated IP range fetch, DNS resolution for allowlist | Authenticated API call; DNSSEC-validated DNS; retry/backoff on failure; atomic iptables apply | ❌ (unauthenticated; no DNSSEC; no retry; non-atomic rule apply) |

---

## 4. STRIDE-per-Element Analysis

---

### 4.1 Cloudflare Worker *(Process — N-01, Z-2)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-1, TB-2.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-001 | Spoofing | Attacker bypasses Cloudflare entirely and hits Cloud Run directly; only CF_SECRET prevents them from masquerading as a Cloudflare proxy | ⚠️ |
| T-002 | Tampering | Worker code modified via write-access push to strip path validation, method enforcement, or secret injection | ⚠️ |
| T-003 | Repudiation | Free-tier Cloudflare log retention is limited — request history unavailable for extended forensics | ⚠️ |
| T-004 | Info Disclosure | CF_SECRET injected as `X-CF-Secret` on **every** proxied origin request (worker.js line 84), not only on errors — the header transits the edge→origin path on all traffic; error telemetry is a secondary vector | ⚠️ |
| T-114 | Info Disclosure | Worker passes `Authorization`, `Cookie`, and `X-Forwarded-*` client headers to origin unstripped (no semantic sanitization, only size/encoding validation), and injects `X-CF-Secret` on every request — origin receives both unsanitized client headers and the edge secret simultaneously | ⚠️ |
| T-005 | Denial of Service | Oversized/malformed requests exhaust edge resources before WAF inspection completes | ✅ |
| T-006 | EoP | Path traversal to serve unintended content via encoded variants, null bytes, or backslashes | ✅ |

| T-115 | Info Disclosure | `X-CF-Secret` is injected on every origin request — if Cloud Run is exploitable via SSRF, or forwards requests to a downstream service, the header value is reachable without Cloudflare credentials | ⚠️ |
| T-116 | Tampering | Worker forwards Cloud Run response headers unmodified — if the origin sets a cacheable `Cache-Control` header, Cloudflare's edge caches the response and serves it to subsequent clients; no `Cache-Control: no-store` override in the Worker enables cache poisoning | ❌ |
| T-117 | Tampering | Worker path validation blocks `%2e%2e` (single-encoded) but not `%252e%252e` (double-encoded) — the double-encoded variant passes Worker inspection and is decoded at the application layer; Unicode normalization variants also unaddressed | ❌ |
| T-118 | EoP | GitHub → Cloudflare Worker deployment is an unmodeled trust boundary; the Cloudflare API token is held as a GitHub Secret; token compromise = attacker deploys arbitrary Worker code, overriding path validation, method allowlist, secret injection, and WAF from outside the repository | ❌ |

**Key risk:** The CF_SECRET / Cloud Run URL pair is a single point of failure for the entire edge perimeter — there is no second factor if CF_SECRET leaks. A compromised Cloudflare API token (T-118) achieves the same outcome without touching the repository.

---

### 4.2 Cloud Run / Dashboard *(Process — N-02, Z-3)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-2, TB-7.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-007 | Spoofing | Attacker reaches Cloud Run directly without Cloudflare — CF_SECRET is the only guard; no Cloudflare IP allowlist at origin | ⚠️ |
| T-008 | Tampering | Findings JSON in the running container modified after deployment — serving layer state diverges from the audited build artifact | ✅ |
| T-009 | Tampering | Docker Engine AuthZ plugin bypass: oversized request bodies circumvent plugin evaluation, enabling unprivileged container creation with host filesystem access | ⚠️ |
| T-010 | Repudiation | Cloud Run request handling cannot be audited — no structured log of inbound requests exists | ✅ |
| T-011 | Info Disclosure | Resource IDs leak through imperfect redaction — ingest_prowler.py regex covers known AWS/GCP/Azure patterns but passes unexpected formats unredacted | ⚠️ |
| T-012 | Info Disclosure | CF_SECRET comparison at Cloud Run not verified constant-time — timing oracle attack possible against header validation | ⚠️ |
| T-013 | Denial of Service | Attacker who knows the Cloud Run URL and CF_SECRET hits the origin directly, bypassing all Cloudflare DDoS protection | ❌ |
| T-014 | EoP | nginx serving layer exposed to RCE via memory corruption and request-handling vulnerabilities — no continuous re-scan detects new CVE disclosures after the last image build | ✅ |
| T-015 | EoP | Container process escapes to host via privileged execution | ✅ |
| T-016 | EoP | ImageRunner: Cloud Run SA with `run.services.update` + `iam.serviceAccounts.actAs` can pull private images without explicit Artifact Registry Reader — verify SA is not over-permissioned | ⚠️ |

---

### 4.3 CI/CD Pipeline — GitHub Actions *(Process — N-03, Z-7)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-4, TB-5.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-017 | Spoofing | Malicious actor with write access triggers workflow with crafted push; no required code review enforced by branch protection | ⚠️ |
| T-018 | Spoofing | Prompt injection in GitHub issue or PR bodies, when processed by an AI coding assistant with repository access, can leak CI/CD tokens or trigger unintended actions — this repo uses AI-assisted development against the same issue/PR surface | ⚠️ |
| T-019 | Tampering | Workflow YAML modified to skip gitleaks, Trivy, or Semgrep gates — no branch protection enforcement visible from workflow files | ⚠️ |
| T-020 | Tampering | Actions cache poisoning via fork combined with imposter commits can introduce malicious build artifacts; this repo does not use `pull_request_target` and SHA-pins all actions, reducing but not eliminating exposure | ⚠️ |
| T-021 | Repudiation | Unauthorized workflow execution by a compromised or spoofed actor cannot be detected or attributed | ✅ |
| T-022 | Info Disclosure | Compromised third-party Action dumps runner memory to workflow logs; no cloud credentials in this runner, but GITHUB_TOKEN is in scope | ⚠️ |
| T-023 | Info Disclosure | Compromise of the Trivy GitHub Action used in docker-build.yml can chain into stolen PyPI credentials and backdoored packages — the action's supply chain is outside operator control | ❌ |
| T-024 | Denial of Service | CI flooded with commits to exhaust free-tier Actions minutes — no per-actor rate limiting | ⚠️ |
| T-025 | EoP | Compromised third-party Action gains GITHUB_TOKEN scope | ✅ |

---

### 4.4 Makefile / WSL2 Workstation *(Process — N-04, Z-8)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-3, TB-4, TB-6, TB-8.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-026 | Spoofing | Operator GCP identity hijacked — no MFA enforcement visible on the ADC path; compromised machine = all operations spoofable under operator identity | ❌ |
| T-027 | Tampering | before.tfvars / after.tfvars tampered locally with no integrity check before `terraform apply` | ⚠️ |
| T-028 | Repudiation | `make before` / `make scan` leave no audit trail beyond shell history — only `make deploy` writes deploy.log | ⚠️ |
| T-029 | Info Disclosure | Credential values exposed in terminal output — Makefile uses `$(shell gcloud secrets versions access latest ...)` inline; if `set -x` is active, credential values appear in shell traces | ❌ |
| T-030 | Denial of Service | Operator locked out of GCP on ADC token expiry — no local credential fallback; all Makefile targets blocked | ⚠️ |
| T-031 | EoP | Same operator identity used for secret fetch, Artifact Registry push, Cloud Run deploy, and Terraform — no per-operation least-privilege enforcement | ⚠️ |
| T-032 | EoP | Local privilege escalation via unpatched WSL2 kernel vulnerabilities — multiple active LPE paths exist on the operator workstation, converting any local code execution into full operator-level access | ❌ |

---

### 4.5 Prowler Scanner — run_scan.sh *(Process — N-05, Z-8)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-3, TB-8, TB-9.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-033 | Spoofing | Prowler binary replaced with a fake that generates clean findings — no binary hash or signature check (Spoofing: the fake binary impersonates the authentic Prowler process identity) | ❌ |
| T-034 | Spoofing | AI-suggested package names may match attacker-registered PyPI packages — no verification step exists between an AI tool's suggestion and `pip install`, enabling dependency confusion on any AI-generated package name | ❌ |
| T-035 | Tampering | Prowler OCSF output tampered between write to /var/tmp/prowler-output/ and ingest read — no checksum | ⚠️ |
| T-036 | Repudiation | Scan timestamp self-reported by Prowler — not from a trusted time source; old output re-ingested with a new timestamp is indistinguishable from a fresh scan | ⚠️ |
| T-037 | Info Disclosure | All three cloud credential sets (AWS, GCP, Azure) live in environment variables for the full scan duration — accessible to any child process Prowler spawns | ⚠️ |
| T-038 | Info Disclosure | GCP SA key written to /var/tmp as a temporary file (`mktemp /var/tmp/gcp_key_XXXXXX.json`, mode 0600) — not world-readable, but path is discoverable via /var/tmp listing; if the process is killed before the cleanup trap fires, the file persists with a guessable name pattern | ❌ |
| T-113 | Info Disclosure | `AZURE_CREDS` — the raw Azure credentials JSON blob fetched from Secret Manager — is never unset by the cleanup trap; the trap unsets the four parsed Azure variables but not the raw JSON source variable, which persists in shell memory after script exit and is exposed via core dump, shell inspection tool, or any subprocess spawned post-exit | ❌ |
| T-039 | Denial of Service | Cloud API rate limiting causes scan to complete with missing provider output — failure is silent if ≥1 provider succeeds; partial scan reported as clean | ⚠️ |
| T-040 | EoP | Over-permissioned scan credentials — Prowler needs read-only access; if credentials carry write permissions, theft = write access to scanned infrastructure | ⚠️ |
| T-041 | Info Disclosure | Python supply chain compromise via pip during Prowler setup or updates — malicious package versions with short publication windows (minutes to hours) can be installed before discovery and quarantine | ⚠️ |

---

### 4.6 Ingest Script — ingest_prowler.py *(Process — N-06, Z-8)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-9, TB-10.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-042 | Spoofing | Crafted Prowler JSON passed as CLI argument to inject false findings — no authentication on input source | ❌ |
| T-043 | Tampering | Output findings JSON modified after write to dashboard/public/ but before `make deploy` — no checksum or signature | ❌ |
| T-044 | Repudiation | No audit trail linking output JSON to a specific scan run or Prowler execution — scanned_at and source fields are self-reported | ❌ |
| T-045 | Info Disclosure | Resource ID leaks through incomplete redaction regex — patterns cover known AWS/GCP/Azure formats but unexpected resource types pass through unredacted | ⚠️ |
| T-046 | Info Disclosure | AI-generated redaction logic in ingest_prowler.py may contain subtle regex flaws undetectable by Semgrep or Trivy | ⚠️ |
| T-047 | Denial of Service | Malformed Prowler JSON raises unhandled exception (no try/except around json.load) — `make deploy` checks file existence only, so stale findings from a previous run are baked into the image | ❌ |
| T-134 | EoP | `ingest_prowler.py` executes with full operator-level WSL2 privileges — any reachable code execution (malformed Prowler JSON triggering a Python deserialization flaw, path traversal in output write) escalates directly to operator rights; no subprocess isolation or privilege drop wraps the script | ❌ |

---

### 4.7 AI Agent — Claude Code *(Process — N-07, Z-11)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-11, TB-4.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-048 | Spoofing | Prompt injection via GitHub issues, PR titles, or review comments hijacks agent behavior — the attack class is confirmed exploitable against this agent platform | ❌ |
| T-049 | Tampering | Hijacked agent modifies workflow YAMLs, Terraform, or ingest script before committing — write access to full project directory | ⚠️ |
| T-050 | Repudiation | Actions taken by AI agent cannot be cleanly attributed — intermediate file writes and shell commands during a session leave no structured audit trail beyond shell history | ⚠️ |
| T-051 | Info Disclosure | Agent reads credentials or env vars and exfiltrates via network calls — confirmed exploit pattern: agent holds credential → executes action → authenticates to production | ❌ |
| T-052 | Info Disclosure | AI-generated code in this repo may contain exploitable vulnerabilities undetectable by traditional SAST scanning — Semgrep cannot detect novel logic flaws introduced by code generation | ❌ |
| T-053 | Denial of Service | Agent exhausts API budget, runs infinite loops, or deletes critical files during a runaway or hijacked session | ⚠️ |
| T-054 | EoP | Prompt-injected agent bypasses permission prompts (user-fatigue or pre-approved tool classes) and executes `gcloud`, `terraform`, `docker` with operator-level IAM rights | ⚠️ |

**Key risk:** A prompt injection delivered via a malicious GitHub issue or PR body can hijack Claude Code into reading credentials from the environment and exfiltrating them — no malware installation required.

---

### 4.8 Artifact Registry / Docker Image *(Data Store — N-08, Z-4)*

*Applicable STRIDE categories: T, R, I, D. Relevant trust boundaries: TB-6, TB-7.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-055 | Tampering | Attacker with compromised GCP SA key pushes a malicious image under the expected tag | ❌ |
| T-056 | Tampering | Image tampered in registry between Trivy scan (CI) and digest capture in `make deploy` — race-condition window | ❌ |
| T-057 | Tampering | Docker Engine AuthZ plugin bypass enables unprivileged code to create privileged containers during the `docker build` / `docker push` steps of `make deploy` | ⚠️ |
| T-058 | Repudiation | Deployed container image cannot be traced to the build that produced it — no verifiable chain from running image to source commit | ✅ |
| T-059 | Info Disclosure | Stored image is built on nginx:1.30-alpine; Trivy scans at build time only — a newly disclosed CVE after the last build is present in the running image with no alerting or re-scan trigger | ✅ |
| T-060 | Denial of Service | Image push fails (Artifact Registry outage or rate limit) — no retry or fallback; `make deploy` cannot complete | ⚠️ |

---

### 4.9 GCP Secret Manager *(Data Store — N-09, Z-5)*

*Applicable STRIDE categories: T, R, I, D. Relevant trust boundaries: TB-3.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-061 | Tampering | Attacker with `secretmanager.versions.add` permission adds a malicious secret version; append-only versioning makes it detectable after the fact but not preventable in advance | ⚠️ |
| T-062 | Repudiation | Secret access by a compromised identity goes unlogged — no audit trail links credential use to the actor that fetched it | ✅ |
| T-063 | Info Disclosure | Single service account accesses all five secrets (AWS keys, GCP SA key, Azure credentials, CF_SECRET) — one compromised ADC token = full cross-cloud credential disclosure | ❌ |
| T-064 | Info Disclosure | Reading `prowler-gcp-service-account-key` yields a credential enabling SA impersonation across all GCP resources — one read event collapses the boundary between data access and infrastructure control | ❌ |
| T-065 | Denial of Service | Secret Manager unavailable (GCP outage or IAM revocation) — no local credential cache; `make scan`, `make before`, `make after`, `make deploy` all blocked | ⚠️ |

**Key risk:** Secret Manager is the highest-value target in the system. Compromise of the single operator SA = all cloud credentials across all three providers.

---

### 4.10 Public Repository *(Data Store — N-10, Z-6)*

*Applicable STRIDE categories: T, R, I, D. Relevant trust boundaries: TB-4, TB-12.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-066 | Tampering | Vulnerabilities in GitHub's internal Git infrastructure can allow authenticated users to execute arbitrary commands via git push — the platform itself is an attack surface outside operator control | ⚠️ |
| T-067 | Repudiation | AI-assisted attacks generate log entries indistinguishable from legitimate CI traffic — automated scanning blends with normal developer tooling | ⚠️ |
| T-068 | Info Disclosure | Published stride.md and threat-model.md enumerate trust boundaries, known gaps, and credential flows in a form optimised for automated ingestion — automated tools use this documentation to guide targeted vulnerability discovery | ❌ |
| T-069 | Info Disclosure | Automated AI tooling scans public repositories to discover exploitable vulnerabilities in seconds, without human direction — the attack surface is permanently exposed at public repository creation | ❌ |
| T-070 | Info Disclosure | Repository reveals package names, import conventions, and tooling choices — this reconnaissance enables attackers to pre-register AI-hallucinated package names on PyPI before developers install them | ❌ |
| T-071 | Info Disclosure | Git history retains sensitive patterns (resource IDs, account numbers) after removal — gitleaks scans commits but historical data remains in history indefinitely and is continuously harvested by automated scanners | ⚠️ |
| T-072 | Denial of Service | Automated AI-driven scanning floods CI/CD via automated PRs or issue creation — no per-actor rate limiting; free-tier minute exhaustion blocks all legitimate builds | ⚠️ |

**Key risk:** Publishing stride.md and threat-model.md in a public repo hands an AI-powered attacker a pre-built reconnaissance document. The same tools used to write these documents can be used to exploit the gaps they document.

---

### 4.11 Scan Output Filesystem *(Data Store — N-11, Z-12)*

*Applicable STRIDE categories: T, R, I, D. Relevant trust boundaries: TB-9, TB-10.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-073 | Tampering | /var/tmp/prowler-output/ created with `mkdir -p` (no -m flag) — resulting mode is 0755; directory is world-readable but not world-writable; TOCTOU risk: /var/tmp is world-writable with sticky bit, so an attacker can pre-create the path or a symlink before Prowler runs, redirecting scan output to an attacker-controlled location | ❌ |
| T-074 | Tampering | dashboard/public/findings_*.json mutable on local filesystem between ingest write and `make deploy` — no integrity protection in the window | ❌ |
| T-075 | Repudiation | No chain of custody linking scan output files to a specific Prowler execution — scanned_at and source fields are self-reported; old output re-ingested with a new timestamp is indistinguishable | ❌ |
| T-076 | Info Disclosure | Raw Prowler OCSF JSON contains unredacted resource IDs; output directory is world-readable on WSL2 during the ingest window — redaction is deferred to ingest_prowler.py | ❌ |
| T-077 | Denial of Service | Corrupt OCSF JSON causes unhandled ingest exception; `make deploy` checks only file existence — stale findings from previous run are baked into the image without any indication of failure | ❌ |

---

### 4.12 DevContainer *(Process — N-15, Z-13)*

*Applicable STRIDE categories: S, T, R, I, D, E. Relevant trust boundaries: TB-13, TB-14, TB-15, TB-11.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-119 | Spoofing | DevContainer base image (`node:20`) not digest-pinned in Dockerfile — supply chain substitution: a re-tagged or compromised image serves as the container's root environment with no detection | ❌ |
| T-120 | Tampering | Claude Code installed via `curl -fsSL https://claude.ai/install.sh \| bash` with no content hash or signature verification — executable replaced silently in transit or at source | ❌ |
| T-121 | Tampering | Gitleaks binary fetched from GitHub Releases via `curl` without GPG signature or SHA256 checksum — a tampered binary runs as the pre-commit hook on every commit made inside the container | ❌ |
| T-122 | EoP | `NET_ADMIN` + `NET_RAW` capabilities granted to the devcontainer; node user holds passwordless sudo on `init-firewall.sh` — any code running as node can re-invoke the script with a modified `firewall-extra-domains.txt`, or issue `iptables` commands directly, nullifying all egress controls | ❌ |
| T-123 | Tampering | `managed-settings.json` sets `failIfUnavailable: false` — if the bubblewrap sandbox is unavailable (e.g. kernel namespace restrictions active in the host), Claude Code executes all commands unsandboxed without any warning or failure signal | ❌ |
| T-124 | Info Disclosure | `commandhistory` named volume persists shell history across container recreations — `gcloud secrets versions access` commands and any credential values echoed during debugging persist in the volume and are readable to any future session mounting the same volume | ⚠️ |
| T-125 | Tampering | `init-firewall.sh` resolves allowed domains to IPs via `dig` (no DNSSEC) and fetches GitHub IP ranges via unauthenticated API call — both inputs are spoofable via DNS MitM or BGP hijack at container startup, allowing attacker-controlled IPs into the egress allowset | ❌ |
| T-126 | Denial of Service | `init-firewall.sh` applies iptables rules with individual `ipset add` / `iptables` invocations rather than atomic `iptables-restore` — a partial ruleset is active during the initialization window; if the script is interrupted, the container may start with an incomplete or absent firewall | ⚠️ |
| T-135 | Repudiation | Container lifecycle events — firewall initialization (`init-firewall.sh`), binary installation via `curl`, package installs — produce no tamper-evident audit record; Docker's default container logs are mutable and structurally incomplete; no WORM-equivalent trail of what executed during container startup exists | ⚠️ |

**Key risk:** The devcontainer was built to sandbox the AI agent, but `NET_ADMIN` + passwordless sudo on `init-firewall.sh` means any code running as the container's node user can reset the very network controls the container was designed to enforce. The sandbox defeats itself if the agent session is hijacked.

---

## 5. STRIDE-per-Interaction Analysis

> Each trust boundary is analysed for data-flow-applicable categories: T (Tampering), I (Info Disclosure), D (Denial of Service). Threat IDs continue from §4. DREAD scores are in §8.

---

### TB-1 — Internet → Edge *(Z-1 → Z-2)*

*Data crossing: HTTP/HTTPS requests from public internet to Cloudflare Worker.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-078 | Tampering | WAF rules bypassed via encoded request variants reaching the proxy before inspection completes | ✅ |
| T-079 | Info Disclosure | Client IP exposed to Cloudflare infrastructure (design intent — necessary for DDoS protection) | ✅ |
| T-080 | Denial of Service | Volumetric flood saturates Cloudflare edge resources before DDoS mitigation kicks in | ✅ |

---

### TB-2 — Edge → Origin *(Z-2 → Z-3)*

*Data crossing: Proxied HTTP requests with X-CF-Secret header injected by the Worker.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-081 | Tampering | Cloudflare platform modifies proxied request in transit (e.g., platform compromise or misconfiguration stripping or altering the injected header) | ⚠️ |
| T-082 | Info Disclosure | CF_SECRET header value logged by Cloudflare's internal request logging infrastructure — visible to Cloudflare staff | ⚠️ |
| T-083 | Denial of Service | Cloudflare proxy becomes unavailable — all requests to Cloud Run origin are blocked; no direct-origin fallback by design | ⚠️ |

---

### TB-3 — Workstation → Secret Store *(Z-8 → Z-5)*

*Data crossing: `gcloud secrets versions access latest` fetches all five credentials sequentially in one ADC session.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-084 | Tampering | `make scan` fetches `latest` version with no pinning — attacker with `secretmanager.versions.add` adds a malicious version; next scan silently consumes it; tamper is invisible at the store layer | ❌ |
| T-085 | Info Disclosure | All five credentials cross the boundary in one ADC session sequentially (AWS key → AWS secret → GCP SA key → Azure credentials → CF_SECRET); single token compromise = simultaneous cross-cloud credential disclosure with no isolation between fetches | ❌ |
| T-086 | Denial of Service | Secret Manager unavailable (GCP outage, IAM revocation, ADC expiry) blocks all pipeline stages — no local credential cache or fallback | ⚠️ |

---

### TB-4 — Workstation → Source Control *(Z-8 → Z-6)*

*Data crossing: git push, gh CLI commands, workflow trigger payloads.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-087 | Tampering | Force-push overwrites git history, removing evidence of a change — no branch protection prevents this | ⚠️ |
| T-088 | Info Disclosure | Secret accidentally committed and pushed before gitleaks scan catches it — gitleaks runs in CI after push, not as a pre-push hook | ⚠️ |
| T-089 | Denial of Service | GitHub platform unavailable blocks all CI/CD triggers — no fallback execution path | ⚠️ |

---

### TB-5 — CI Runner → Package Registries *(Z-7 → Z-10)*

*Data crossing: `npm ci` and `pip install` during workflow execution.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-090 | Tampering | npm package dependency tampered with malicious version published under the expected name — lockfile pins version but not content hash | ❌ |
| T-091 | Tampering | pip install fetches a backdoored Prowler dependency published as a short-lived malicious version — the attack window is enough for CI to install before quarantine | ❌ |
| T-092 | Denial of Service | npm or PyPI registry unavailable blocks CI builds — lockfile is present but cannot install from a down registry | ⚠️ |

---

### TB-6 — Workstation → Container Registry *(Z-8 → Z-4)*

*Data crossing: `docker build` + `docker push` during `make deploy`.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-093 | Tampering | Attacker with stolen GCP SA key pushes a malicious image to Artifact Registry under the expected tag before `make deploy` captures the digest | ❌ |
| T-094 | Tampering | Race-condition between Trivy scan (CI) and `docker push` (`make deploy`) — a locally-built image is not Trivy-scanned at push time | ❌ |
| T-095 | Denial of Service | Artifact Registry rate limiting or outage causes `docker push` to fail — `make deploy` cannot complete | ⚠️ |

---

### TB-7 — Registry → Cloud Run *(Z-4 → Z-3)*

*Data crossing: Container image pull on Cloud Run deployment.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-096 | Tampering | Artifact Registry returns a different image than the deployed digest due to registry corruption or unexpected tag mutation | ⚠️ |
| T-097 | Denial of Service | Artifact Registry unavailable prevents Cloud Run from pulling the image on cold start or new revision deployment | ⚠️ |

---

### TB-8 — Workstation → Cloud APIs *(Z-8 → Z-9)*

*Data crossing: Prowler CLI read-only API calls across AWS, GCP, and Azure control planes.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-098 | Tampering | Prowler API requests tampered in transit via MITM against cloud control planes | ✅ |
| T-099 | Info Disclosure | Cloud credentials live in environment variables for the full scan duration; visible to any subprocess Prowler spawns — cleanup trap fires on exit only | ⚠️ |
| T-100 | Denial of Service | Cloud API rate limiting causes scan to complete with missing provider results — failure is silent if ≥1 provider succeeds, producing a misleadingly clean partial scan | ⚠️ |

---

### TB-9 — Scanner → Scan Output *(Z-8 Prowler process → Z-12)*

*Data crossing: Prowler writes OCSF JSON to /var/tmp/prowler-output/; ingest reads from the same path.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-101 | Tampering | /var/tmp/prowler-output/ is created 0755 (not world-writable); only root or the operator can write to it — but /var/tmp is world-writable with sticky bit, so an attacker can pre-create the path or a symlink before Prowler runs (TOCTOU), redirecting scan output; no checksum detects substitution | ❌ |
| T-102 | Info Disclosure | Raw Prowler OCSF JSON (unredacted resource IDs, check metadata, cloud identifiers) sits on a world-readable path during the ingest window — redaction is deferred to ingest_prowler.py | ❌ |
| T-103 | Denial of Service | Corrupt or truncated OCSF JSON raises an unhandled exception in ingest_prowler.py; `make deploy` checks only file existence — stale findings from the previous run are baked into the image silently | ❌ |

---

### TB-10 — Scan Output → Docker Build *(Z-12 → Z-4 via build)*

*Data crossing: dashboard/public/findings_*.json → Vite build (`npm run build`) copies public/ into dist/ → Docker image baked by `make deploy`.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-104 | Tampering | Findings JSON is mutable between ingest write and `make deploy` — no checksum gates the Docker build; a tamper here is baked permanently into the image and becomes the authoritative public scan record | ❌ |
| T-105 | Info Disclosure | Unexpected files placed in dashboard/public/ (e.g., debug output with unredacted identifiers from a malformed ingest run, or files written by a hijacked agent session) are silently included in the Vite build output and baked into the image | ❌ |
| T-106 | Denial of Service | `make deploy` checks only that findings JSON files exist — a failed or partial ingest leaving stale files from the previous run causes the build to proceed; the dashboard silently reverts to old data with no visible indication | ❌ |

---

### TB-11 — AI Agent → Workstation *(Z-11 → Z-8)*

*Data crossing: Claude Code file reads/writes, bash command execution, git operations on the WSL2 filesystem.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-107 | Tampering | Prompt-injected agent writes malicious code to source files or modifies workflow YAMLs before a commit — agent has write access to the full project directory | ⚠️ |
| T-108 | Info Disclosure | Agent reads GCP ADC credentials from filesystem or environment and transmits them via network calls permitted by the sandbox — same attack pattern as confirmed exploits across major AI coding agents | ❌ |
| T-109 | Denial of Service | Runaway agent session (infinite loop or large file operation) locks the terminal during a deployment window | ⚠️ |

---

### TB-12 — Internet → Repository *(Z-1 → Z-6)*

*Data crossing: Anonymous git clone, GitHub API reads, security documentation reads.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-110 | Tampering | Attacker submits PR with malicious GitHub Actions workflow or code changes — standard PR review is the only gate; branch protection rules not confirmed enforced | ⚠️ |
| T-111 | Info Disclosure | stride.md, threat-model.md, and architecture diagrams are readable by any actor; they enumerate trust boundaries, known gaps, and credential flows in structured form optimised for AI ingestion | ❌ |
| T-112 | Denial of Service | Automated AI-driven PR or issue flood exhausts maintainer bandwidth and free-tier CI minutes — no per-actor rate limiting | ⚠️ |

---

### TB-13 — WSL2 Host → DevContainer *(Z-8 → Z-13)*

*Data crossing: Container startup, bind-mount of /workspace, NET_ADMIN capability grant to container.*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-127 | Tampering | Dockerfile or devcontainer.json tampered on the WSL2 host before container build — malicious COPY instruction, capability addition, or modified managed-settings.json baked into the container image | ⚠️ |
| T-128 | Info Disclosure | `/workspace` bind-mount gives the container full read access to the WSL2 working tree — any credential files, `.env` files, or token caches present at the host path outside git-tracked content are readable by any process running inside the container | ⚠️ |
| T-129 | Denial of Service | Docker daemon unavailable or image build failure (Docker Hub outage, failed binary download) blocks all devcontainer sessions with no fallback path for AI-assisted development | ⚠️ |

---

### TB-14 — DevContainer Build → Container Registries *(Z-13 → Z-10)*

*Data crossing: base image pull (node:20 from Docker Hub), gitleaks binary (GitHub Releases), Claude Code install script (claude.ai).*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-130 | Tampering | `node:20` mutable tag on Docker Hub re-pointed to a different image version between builds — no digest pin means two builds of the same Dockerfile may produce containers with different runtime environments, libraries, or injected malware | ❌ |
| T-131 | Denial of Service | Docker Hub, GitHub Releases API, or claude.ai install endpoint unavailable — any single failure blocks the entire devcontainer build | ⚠️ |

---

### TB-15 — DevContainer Firewall → GitHub API *(Z-13 → Z-6)*

*Data crossing: `init-firewall.sh` fetches GitHub IP ranges via unauthenticated `/meta` API call; resolves allowed domains to IPs via `dig` (no DNSSEC).*

| Threat ID | Category | Threat | Status |
|---|---|---|---|
| T-132 | Tampering | GitHub `/meta` API response spoofed via DNS MitM or BGP hijack (unauthenticated, no integrity check) — attacker-controlled IP ranges inserted into the iptables allowset at container startup, bypassing all egress restrictions | ❌ |
| T-133 | Denial of Service | GitHub API unauthenticated rate limit (60 req/hr) exhausted before container startup — `init-firewall.sh` exits on API failure, leaving the container with no egress filtering | ❌ |

---

## 6. Threat Register

| Threat ID | Component / Boundary | Category | Threat (short) | Status | Score | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| T-001 | 4.1 Cloudflare Worker | Spoofing | Bypass Cloudflare, hit Cloud Run directly | ⚠️ | 6.4 | High | — |
| T-002 | 4.1 Cloudflare Worker | Tampering | Worker code modified via push to strip controls | ⚠️ | 5.6 | Medium | — |
| T-003 | 4.1 Cloudflare Worker | Repudiation | Free-tier log retention insufficient for forensics | ⚠️ | 5.6 | Medium | — |
| T-004 | 4.1 Cloudflare Worker | Info Disclosure | CF_SECRET in Cloudflare error telemetry | ⚠️ | 5.4 | Medium | — |
| T-005 | 4.1 Cloudflare Worker | Denial of Service | Oversized requests exhaust edge resources | ✅ | 7.4 | High | — |
| T-006 | 4.1 Cloudflare Worker | EoP | Path traversal to serve unintended content | ✅ | 5.8 | Medium | — |
| T-007 | 4.2 Cloud Run | Spoofing | Direct origin access bypasses Cloudflare | ⚠️ | 6.2 | High | — |
| T-008 | 4.2 Cloud Run | Tampering | Serving layer state diverges from audited build artifact | ✅ | 5.2 | Medium | — |
| T-009 | 4.2 Cloud Run | Tampering | Docker Engine AuthZ bypass | ⚠️ | 6.2 | High | [→ EV-009] |
| T-010 | 4.2 Cloud Run | Repudiation | Cloud Run request handling cannot be audited | ✅ | 6.6 | High | — |
| T-011 | 4.2 Cloud Run | Info Disclosure | Resource IDs via incomplete redaction | ⚠️ | 5.6 | Medium | — |
| T-012 | 4.2 Cloud Run | Info Disclosure | CF_SECRET comparison not constant-time | ⚠️ | 5.2 | Medium | — |
| T-013 | 4.2 Cloud Run | Denial of Service | Direct Cloud Run DoS bypass via CF_SECRET | ❌ | 6.4 | High | — |
| T-014 | 4.2 Cloud Run | EoP | nginx RCE via unpatched image vulnerabilities | ✅ | 8.0 | Critical | [→ EV-014] |
| T-015 | 4.2 Cloud Run | EoP | Container escape to host | ✅ | 5.2 | Medium | — |
| T-016 | 4.2 Cloud Run | EoP | ImageRunner SA over-permission | ⚠️ | 5.2 | Medium | — |
| T-017 | 4.3 CI/CD Pipeline | Spoofing | Malicious write-access push triggers workflow | ⚠️ | 5.4 | Medium | — |
| T-018 | 4.3 CI/CD Pipeline | Spoofing | AI assistant GITHUB_TOKEN leak via issue/PR injection | ⚠️ | 5.2 | Medium | [→ EV-018] |
| T-019 | 4.3 CI/CD Pipeline | Tampering | Workflow YAML modified to skip security gates | ⚠️ | 5.6 | Medium | — |
| T-020 | 4.3 CI/CD Pipeline | Tampering | Actions cache poisoning + imposter commits via fork | ⚠️ | 5.6 | Medium | [→ EV-020] |
| T-021 | 4.3 CI/CD Pipeline | Repudiation | Unauthorized workflow execution cannot be detected or attributed | ✅ | 6.0 | High | — |
| T-022 | 4.3 CI/CD Pipeline | Info Disclosure | Compromised Action dumps runner memory | ⚠️ | 5.4 | Medium | [→ EV-022] |
| T-023 | 4.3 CI/CD Pipeline | Info Disclosure | Trivy action compromise chains to backdoored PyPI package | ❌ | 4.8 | Medium | [→ EV-023] |
| T-024 | 4.3 CI/CD Pipeline | Denial of Service | CI flooded to exhaust Actions minutes | ⚠️ | 6.6 | High | — |
| T-025 | 4.3 CI/CD Pipeline | EoP | Compromised Action gains GITHUB_TOKEN | ✅ | 5.2 | Medium | — |
| T-026 | 4.4 Makefile / WSL2 | Spoofing | GCP identity hijacked — no MFA on ADC | ❌ | 6.0 | High | — |
| T-027 | 4.4 Makefile / WSL2 | Tampering | tfvars tampered before terraform apply | ⚠️ | 5.4 | Medium | — |
| T-028 | 4.4 Makefile / WSL2 | Repudiation | make scan / make before leave no audit trail | ⚠️ | 6.6 | High | — |
| T-029 | 4.4 Makefile / WSL2 | Info Disclosure | Credential values in terminal via $(shell ...) | ❌ | 6.4 | High | — |
| T-030 | 4.4 Makefile / WSL2 | Denial of Service | Locked out on ADC token expiry | ⚠️ | 6.0 | High | — |
| T-031 | 4.4 Makefile / WSL2 | EoP | Operator identity over-permissioned for all GCP ops | ⚠️ | 6.0 | High | — |
| T-032 | 4.4 Makefile / WSL2 | EoP | WSL2 kernel LPE — multiple active paths on unpatched kernel | ❌ | 6.2 | High | [→ EV-032] |
| T-033 | 4.5 Prowler Scanner | Spoofing | Prowler binary replaced with fake | ❌ | 5.4 | Medium | — |
| T-034 | 4.5 Prowler Scanner | Spoofing | AI-hallucinated package name confusion via PyPI pre-registration | ❌ | 5.8 | Medium | [→ EV-034] |
| T-035 | 4.5 Prowler Scanner | Tampering | Output JSON tampered before ingest | ⚠️ | 6.0 | High | — |
| T-036 | 4.5 Prowler Scanner | Repudiation | Scan timestamp self-reported by Prowler | ⚠️ | 6.2 | High | — |
| T-037 | 4.5 Prowler Scanner | Info Disclosure | All 3 cloud credentials in env for full scan | ⚠️ | 6.0 | High | — |
| T-038 | 4.5 Prowler Scanner | Info Disclosure | GCP SA key in /var/tmp — path discoverable; persists if process killed before cleanup | ❌ | 6.6 | High | — |
| T-039 | 4.5 Prowler Scanner | Denial of Service | API rate limiting causes silent partial scan | ⚠️ | 5.4 | Medium | — |
| T-040 | 4.5 Prowler Scanner | EoP | Over-permissioned scan credentials | ⚠️ | 5.4 | Medium | — |
| T-041 | 4.5 Prowler Scanner | Info Disclosure | Python supply chain via pip — short-lived malicious versions | ⚠️ | 5.8 | Medium | [→ EV-041] |
| T-042 | 4.6 Ingest Script | Spoofing | Crafted Prowler JSON injects false findings | ❌ | 5.8 | Medium | — |
| T-043 | 4.6 Ingest Script | Tampering | Output JSON modified before make deploy | ❌ | 6.0 | High | — |
| T-044 | 4.6 Ingest Script | Repudiation | No audit trail linking output to scan run | ❌ | 6.6 | High | — |
| T-045 | 4.6 Ingest Script | Info Disclosure | Resource IDs via incomplete redaction regex | ⚠️ | 5.6 | Medium | — |
| T-046 | 4.6 Ingest Script | Info Disclosure | AI-generated redaction logic flaws | ⚠️ | 5.0 | Medium | [→ EV-052] |
| T-047 | 4.6 Ingest Script | Denial of Service | Unhandled exception → stale findings baked | ❌ | 5.6 | Medium | — |
| T-048 | 4.7 AI Agent | Spoofing | Prompt injection via GitHub issues/PRs | ❌ | 7.0 | High | [→ EV-048] |
| T-049 | 4.7 AI Agent | Tampering | Hijacked agent modifies source/workflow files | ⚠️ | 6.6 | High | — |
| T-050 | 4.7 AI Agent | Repudiation | Agent actions lack structured audit trail | ⚠️ | 6.2 | High | — |
| T-051 | 4.7 AI Agent | Info Disclosure | Agent exfiltrates credentials via network | ❌ | 7.2 | High | [→ EV-051] |
| T-052 | 4.7 AI Agent | Info Disclosure | AI-generated code contains exploitable vulns | ❌ | 6.0 | High | [→ EV-052] |
| T-053 | 4.7 AI Agent | Denial of Service | Runaway agent exhausts budget or locks terminal | ⚠️ | 5.0 | Medium | — |
| T-054 | 4.7 AI Agent | EoP | Injected agent runs with operator-level IAM | ⚠️ | 6.8 | High | — |
| T-055 | 4.8 Artifact Registry | Tampering | Malicious image pushed under expected tag | ❌ | 5.6 | Medium | — |
| T-056 | 4.8 Artifact Registry | Tampering | Race-condition tamper between Trivy scan and deploy | ❌ | 5.0 | Medium | — |
| T-057 | 4.8 Artifact Registry | Tampering | Docker Engine AuthZ bypass in build pipeline | ⚠️ | 6.0 | High | [→ EV-009] |
| T-058 | 4.8 Artifact Registry | Repudiation | Deployed image cannot be traced to its build | ✅ | 5.0 | Medium | — |
| T-059 | 4.8 Artifact Registry | Info Disclosure | nginx CVE exposure in stored image — no continuous re-scan | ✅ | 8.0 | Critical | [→ EV-059] |
| T-060 | 4.8 Artifact Registry | Denial of Service | Image push failure blocks deployment | ⚠️ | 4.0 | Low | — |
| T-061 | 4.9 Secret Manager | Tampering | Malicious secret version added by attacker | ⚠️ | 5.6 | Medium | — |
| T-062 | 4.9 Secret Manager | Repudiation | Secret access by compromised identity goes unlogged | ✅ | 5.4 | Medium | — |
| T-063 | 4.9 Secret Manager | Info Disclosure | Single SA accesses all 5 secrets | ❌ | 6.4 | High | — |
| T-064 | 4.9 Secret Manager | Info Disclosure | GCP SA key read → SA impersonation across GCP | ❌ | 6.4 | High | — |
| T-065 | 4.9 Secret Manager | Denial of Service | Secret Manager unavailable blocks all pipeline | ⚠️ | 4.6 | Medium | — |
| T-066 | 4.10 Public Repo | Tampering | GitHub platform RCE via git push | ⚠️ | 5.0 | Medium | [→ EV-066] |
| T-067 | 4.10 Public Repo | Repudiation | AI attacks blend with legitimate CI traffic | ⚠️ | 6.8 | High | — |
| T-068 | 4.10 Public Repo | Info Disclosure | stride.md / threat-model.md as attack roadmap | ❌ | 8.4 | Critical | [→ EV-068] |
| T-069 | 4.10 Public Repo | Info Disclosure | Automated AI tooling discovers exploitable vulns in seconds | ❌ | 8.6 | Critical | [→ EV-069] |
| T-070 | 4.10 Public Repo | Info Disclosure | Repo patterns enable AI-driven package confusion attack | ❌ | 7.0 | High | [→ EV-070] |
| T-071 | 4.10 Public Repo | Info Disclosure | Git history retains sensitive patterns | ⚠️ | 6.8 | High | — |
| T-072 | 4.10 Public Repo | Denial of Service | Automated PR/issue flood exhausts CI minutes | ⚠️ | 6.6 | High | — |
| T-073 | 4.11 Scan Output FS | Tampering | /var/tmp/prowler-output/ 0755; TOCTOU via world-writable /var/tmp parent | ❌ | 6.4 | High | — |
| T-074 | 4.11 Scan Output FS | Tampering | dashboard/public/ mutable before make deploy | ❌ | 6.4 | High | — |
| T-075 | 4.11 Scan Output FS | Repudiation | No chain of custody on scan output | ❌ | 6.2 | High | — |
| T-076 | 4.11 Scan Output FS | Info Disclosure | Unredacted OCSF JSON world-readable | ❌ | 6.0 | High | — |
| T-077 | 4.11 Scan Output FS | Denial of Service | Stale findings baked on ingest failure | ❌ | 5.6 | Medium | — |
| T-078 | TB-1 Internet → Edge | Tampering | WAF bypass via encoded variants | ✅ | 6.0 | High | — |
| T-079 | TB-1 Internet → Edge | Info Disclosure | Client IP exposed to Cloudflare (design intent) | ✅ | 7.6 | High | — |
| T-080 | TB-1 Internet → Edge | Denial of Service | Volumetric flood vs. Cloudflare edge | ✅ | 7.8 | High | — |
| T-081 | TB-2 Edge → Origin | Tampering | Cloudflare platform modifies proxied request | ⚠️ | 4.0 | Low | — |
| T-082 | TB-2 Edge → Origin | Info Disclosure | CF_SECRET in Cloudflare internal logs | ⚠️ | 5.6 | Medium | — |
| T-083 | TB-2 Edge → Origin | Denial of Service | Cloudflare proxy unavailable | ⚠️ | 5.2 | Medium | — |
| T-084 | TB-3 Workstation → Secrets | Tampering | latest version poisoning — malicious version consumed silently | ❌ | 6.0 | High | — |
| T-085 | TB-3 Workstation → Secrets | Info Disclosure | All 5 credentials in single ADC session | ❌ | 6.6 | High | — |
| T-086 | TB-3 Workstation → Secrets | Denial of Service | Secret Manager unavailable blocks pipeline | ⚠️ | 4.6 | Medium | — |
| T-087 | TB-4 Workstation → Repo | Tampering | Force-push overwrites git history | ⚠️ | 4.6 | Medium | — |
| T-088 | TB-4 Workstation → Repo | Info Disclosure | Secret committed before gitleaks catches it | ⚠️ | 5.8 | Medium | — |
| T-089 | TB-4 Workstation → Repo | Denial of Service | GitHub unavailable blocks CI triggers | ⚠️ | 4.6 | Medium | — |
| T-090 | TB-5 CI → Packages | Tampering | npm package tampered in registry | ❌ | 6.0 | High | — |
| T-091 | TB-5 CI → Packages | Tampering | pip install fetches backdoored dependency | ❌ | 6.0 | High | [→ EV-091] |
| T-092 | TB-5 CI → Packages | Denial of Service | npm/PyPI registry unavailable blocks CI | ⚠️ | 4.6 | Medium | — |
| T-093 | TB-6 Workstation → Registry | Tampering | Malicious image pushed with stolen SA key | ❌ | 6.0 | High | — |
| T-094 | TB-6 Workstation → Registry | Tampering | Race-condition tamper between scan and push | ❌ | 5.0 | Medium | — |
| T-095 | TB-6 Workstation → Registry | Denial of Service | Artifact Registry push failure | ⚠️ | 4.2 | Low | — |
| T-096 | TB-7 Registry → Cloud Run | Tampering | Registry returns different image than digest | ⚠️ | 4.8 | Medium | — |
| T-097 | TB-7 Registry → Cloud Run | Denial of Service | Registry unavailable on Cloud Run cold start | ⚠️ | 5.0 | Medium | — |
| T-098 | TB-8 Workstation → Cloud APIs | Tampering | MITM against cloud control plane API calls | ✅ | 4.6 | Medium | — |
| T-099 | TB-8 Workstation → Cloud APIs | Info Disclosure | Credentials visible to Prowler subprocesses | ⚠️ | 6.0 | High | — |
| T-100 | TB-8 Workstation → Cloud APIs | Denial of Service | Rate limiting causes silent partial scan | ⚠️ | 5.4 | Medium | — |
| T-101 | TB-9 Scanner → Output | Tampering | TOCTOU via world-writable /var/tmp — output path pre-created or symlinked before Prowler runs | ❌ | 6.0 | High | — |
| T-102 | TB-9 Scanner → Output | Info Disclosure | Raw unredacted output world-readable | ❌ | 6.0 | High | — |
| T-103 | TB-9 Scanner → Output | Denial of Service | Corrupt JSON → ingest fails → stale bake | ❌ | 5.6 | Medium | — |
| T-104 | TB-10 Output → Docker Build | Tampering | Tamper permanence via build bake | ❌ | 6.4 | High | — |
| T-105 | TB-10 Output → Docker Build | Info Disclosure | Unexpected files baked via Vite public/ | ❌ | 5.2 | Medium | — |
| T-106 | TB-10 Output → Docker Build | Denial of Service | Existence-only gate → stale findings baked | ❌ | 5.6 | Medium | — |
| T-107 | TB-11 AI Agent → Workstation | Tampering | Injected agent modifies source/workflow files | ⚠️ | 6.6 | High | — |
| T-108 | TB-11 AI Agent → Workstation | Info Disclosure | Agent reads and exfiltrates credentials | ❌ | 6.8 | High | [→ EV-051] |
| T-109 | TB-11 AI Agent → Workstation | Denial of Service | Runaway agent locks terminal | ⚠️ | 5.0 | Medium | — |
| T-110 | TB-12 Internet → Repo | Tampering | Malicious PR with workflow/code changes | ⚠️ | 6.4 | High | — |
| T-111 | TB-12 Internet → Repo | Info Disclosure | Security docs disclose trust boundaries to AI tools | ❌ | 8.4 | Critical | [→ EV-068] |
| T-112 | TB-12 Internet → Repo | Denial of Service | Automated PR/issue flood exhausts CI minutes | ⚠️ | 6.4 | High | — |
| T-113 | 4.5 Prowler Scanner | Info Disclosure | AZURE_CREDS raw JSON blob not unset in cleanup trap — persists in shell memory post-exit | ❌ | 5.4 | Medium | — |
| T-114 | 4.1 Cloudflare Worker | Info Disclosure | Worker passes auth/cookie/forwarded headers unstripped and injects X-CF-Secret on every request | ⚠️ | 5.6 | Medium | — |
| T-115 | 4.1 Cloudflare Worker | Info Disclosure | X-CF-Secret on every origin request — reachable via SSRF or downstream forwarding | ⚠️ | 5.6 | Medium | — |
| T-116 | 4.1 Cloudflare Worker | Tampering | Origin response headers unmodified — cacheable responses cached at CF edge; cache poisoning vector | ❌ | 6.8 | High | — |
| T-117 | 4.1 Cloudflare Worker | Tampering | Double-encoded path traversal (%252e%252e) bypasses Worker validation regex | ❌ | 5.2 | Medium | — |
| T-118 | 4.1 Cloudflare Worker | EoP | GitHub→Cloudflare deployment unmodeled; API token compromise = arbitrary Worker code deployed | ❌ | 6.4 | High | [→ EV-073] |
| T-119 | 4.12 DevContainer | Spoofing | node:20 not digest-pinned — supply chain substitution undetectable | ❌ | 5.4 | Medium | — |
| T-120 | 4.12 DevContainer | Tampering | Claude Code installed via curl\|bash with no integrity verification | ❌ | 5.8 | Medium | [→ EV-071] |
| T-121 | 4.12 DevContainer | Tampering | Gitleaks binary fetched without GPG/checksum — tampered pre-commit hook | ❌ | 5.2 | Medium | — |
| T-122 | 4.12 DevContainer | EoP | NET_ADMIN + passwordless sudo on init-firewall.sh — node user nullifies all egress controls | ❌ | 6.6 | High | [→ EV-072] |
| T-123 | 4.12 DevContainer | Tampering | failIfUnavailable=false — Claude Code runs unsandboxed without warning if bubblewrap unavailable | ❌ | 5.4 | Medium | — |
| T-124 | 4.12 DevContainer | Info Disclosure | commandhistory volume persists credential-bearing shell history across container recreations | ⚠️ | 6.2 | High | — |
| T-125 | 4.12 DevContainer | Tampering | init-firewall.sh DNS/API poisonable — attacker-controlled IPs inserted into egress allowset at startup | ❌ | 6.0 | High | — |
| T-126 | 4.12 DevContainer | Denial of Service | Non-atomic iptables init — container starts with partial/absent firewall on script interruption | ⚠️ | 4.6 | Medium | — |
| T-127 | TB-13 WSL2 → DevContainer | Tampering | Dockerfile/devcontainer.json tampered on host before build | ⚠️ | 5.2 | Medium | — |
| T-128 | TB-13 WSL2 → DevContainer | Info Disclosure | /workspace bind-mount exposes host credential files to container | ⚠️ | 5.8 | Medium | — |
| T-129 | TB-13 WSL2 → DevContainer | Denial of Service | Docker daemon unavailable blocks all devcontainer sessions | ⚠️ | 4.6 | Medium | — |
| T-130 | TB-14 DevContainer → Registries | Tampering | node:20 mutable tag re-pointed between builds — different runtime without detection | ❌ | 5.4 | Medium | — |
| T-131 | TB-14 DevContainer → Registries | Denial of Service | Docker Hub / GitHub Releases / claude.ai unavailable blocks container build | ⚠️ | 3.8 | Low | — |
| T-132 | TB-15 DevContainer → GitHub API | Tampering | GitHub /meta API spoofed via DNS MitM — attacker IPs inserted into iptables allowset | ❌ | 6.0 | High | — |
| T-133 | TB-15 DevContainer → GitHub API | Denial of Service | Unauthenticated rate limit (60 req/hr) exhausted — container starts with no egress filtering | ❌ | 5.6 | Medium | — |
| T-134 | 4.6 Ingest Script | EoP | Operator-level code execution via malformed Prowler JSON — no subprocess isolation or privilege drop | ❌ | 5.4 | Medium | — |
| T-135 | 4.12 DevContainer | Repudiation | Container lifecycle events leave no tamper-evident audit trail | ⚠️ | 6.0 | High | — |

> **Severity bands:** 1.0–3.9 = Low, 4.0–5.9 = Medium, 6.0–7.9 = High, 8.0–10.0 = Critical.

---

## 7. Summary: Top Threats by DREAD Score

*Top 12 non-trivially-mitigated threats sorted by DREAD composite score. Full DREAD scoring details in §8.1; evidence basis in §8.2.*

| Rank | Threat ID | Score | Status | Component | Category | Threat |
|---|---|---|---|---|---|---|
| 1 | T-069 | 8.6 | ❌ | Public Repository | Info Disclosure | Automated AI tooling scans public code for exploitable vulnerabilities in seconds, without human direction |
| 2 | T-068 | 8.4 | ❌ | Public Repository | Info Disclosure | Published stride.md / threat-model.md as attack roadmap for automated vulnerability discovery |
| 3 | T-111 | 8.4 | ❌ | TB-12 Internet → Repo | Info Disclosure | Security docs disclose trust boundaries and gaps to any internet actor |
| 4 | T-051 | 7.2 | ❌ | AI Agent | Info Disclosure | Agent reads credentials and exfiltrates via network calls — confirmed exploit pattern |
| 5 | T-048 | 7.0 | ❌ | AI Agent | Spoofing | Prompt injection via GitHub issues, PR titles, or review comments hijacks Claude Code |
| 6 | T-070 | 7.0 | ❌ | Public Repository | Info Disclosure | Repo reveals dependency patterns enabling AI-driven package confusion attack on PyPI |
| 7 | T-054 | 6.8 | ⚠️ | AI Agent | EoP | Prompt-injected agent executes gcloud/terraform/docker with operator-level IAM |
| 8 | T-067 | 6.8 | ⚠️ | Public Repository | Repudiation | AI-assisted attacks blend with legitimate CI traffic — indistinguishable in audit logs |
| 9 | T-108 | 6.8 | ❌ | TB-11 AI Agent → Workstation | Info Disclosure | Agent reads GCP ADC credentials and transmits via allowed network calls |
| 10 | T-116 | 6.8 | ❌ | 4.1 Cloudflare Worker | Tampering | Origin response headers unmodified — cacheable responses cached at CF edge; cache poisoning vector |
| 11 | T-038 | 6.6 | ❌ | Prowler Scanner | Info Disclosure | GCP SA key in /var/tmp (mode 0600) — path discoverable; persists if process killed before cleanup trap |
| 12 | T-122 | 6.6 | ❌ | 4.12 DevContainer | EoP | NET_ADMIN + passwordless sudo on init-firewall.sh — node user can nullify all egress controls |

---

## 8. DREAD Scoring and Threat Evidence

### 8.1 DREAD Scores

*Dmg = Damage, Rep = Reproducibility, Exp = Exploitability, Aff = Affected scope, Dis = Discoverability. Each 1–10; Score = average. Scoring Notes populated where evidence or design conditions drove dimension values; cross-references resolve to §8.2.*

| Threat ID | Component / Boundary | Dmg | Rep | Exp | Aff | Dis | Score | Severity | Scoring Notes |
|---|---|---|---|---|---|---|---|---|---|
| T-001 | 4.1 Cloudflare Worker | 7 | 6 | 5 | 7 | 7 | 6.4 | High | — |
| T-002 | 4.1 Cloudflare Worker | 9 | 3 | 4 | 8 | 4 | 5.6 | Medium | — |
| T-003 | 4.1 Cloudflare Worker | 3 | 7 | 5 | 6 | 7 | 5.6 | Medium | — |
| T-004 | 4.1 Cloudflare Worker | 8 | 4 | 3 | 8 | 4 | 5.4 | Medium | — |
| T-005 | 4.1 Cloudflare Worker | 5 | 8 | 7 | 9 | 8 | 7.4 | High | — |
| T-006 | 4.1 Cloudflare Worker | 6 | 5 | 5 | 8 | 5 | 5.8 | Medium | — |
| T-007 | 4.2 Cloud Run | 7 | 6 | 5 | 7 | 6 | 6.2 | High | — |
| T-008 | 4.2 Cloud Run | 8 | 4 | 4 | 7 | 3 | 5.2 | Medium | — |
| T-009 | 4.2 Cloud Run | 8 | 5 | 5 | 6 | 7 | 6.2 | High | Dis=7: Docker Engine AuthZ bypass publicly documented with PoC [→ EV-009] |
| T-010 | 4.2 Cloud Run | 3 | 8 | 8 | 6 | 8 | 6.6 | High | — |
| T-011 | 4.2 Cloud Run | 5 | 7 | 4 | 7 | 5 | 5.6 | Medium | — |
| T-012 | 4.2 Cloud Run | 8 | 3 | 5 | 7 | 3 | 5.2 | Medium | — |
| T-013 | 4.2 Cloud Run | 8 | 6 | 5 | 8 | 5 | 6.4 | High | — |
| T-014 | 4.2 Cloud Run | 9 | 7 | 7 | 8 | 9 | 8.0 | Critical | Rep=7, Exp=7, Dis=9: confirmed RCE chain with multiple PoCs and CVSS scoring; score reflects validated patched state [→ EV-014] |
| T-015 | 4.2 Cloud Run | 9 | 2 | 4 | 8 | 3 | 5.2 | Medium | — |
| T-016 | 4.2 Cloud Run | 7 | 4 | 5 | 6 | 4 | 5.2 | Medium | — |
| T-017 | 4.3 CI/CD Pipeline | 7 | 4 | 4 | 7 | 5 | 5.4 | Medium | — |
| T-018 | 4.3 CI/CD Pipeline | 8 | 3 | 4 | 7 | 4 | 5.2 | Medium | Exp=4, Dis=4: requires AI assistant with repo access and a crafted issue/PR body [→ EV-018] |
| T-019 | 4.3 CI/CD Pipeline | 9 | 3 | 4 | 8 | 4 | 5.6 | Medium | — |
| T-020 | 4.3 CI/CD Pipeline | 9 | 2 | 4 | 8 | 5 | 5.6 | Medium | Exp=4, Dis=5: fork-based attack; SHA-pinned actions reduce exposure [→ EV-020] |
| T-021 | 4.3 CI/CD Pipeline | 3 | 7 | 7 | 6 | 7 | 6.0 | High | — |
| T-022 | 4.3 CI/CD Pipeline | 7 | 4 | 4 | 7 | 5 | 5.4 | Medium | Dis=5: pattern documented in public supply-chain incident reports [→ EV-022] |
| T-023 | 4.3 CI/CD Pipeline | 8 | 2 | 3 | 6 | 5 | 4.8 | Medium | Rep=2: Trivy action is SHA-pinned; attack requires action compromise first [→ EV-023] |
| T-024 | 4.3 CI/CD Pipeline | 5 | 7 | 7 | 8 | 6 | 6.6 | High | — |
| T-025 | 4.3 CI/CD Pipeline | 8 | 3 | 4 | 7 | 4 | 5.2 | Medium | — |
| T-026 | 4.4 Makefile / WSL2 | 10 | 3 | 5 | 9 | 3 | 6.0 | High | — |
| T-027 | 4.4 Makefile / WSL2 | 7 | 4 | 5 | 7 | 4 | 5.4 | Medium | — |
| T-028 | 4.4 Makefile / WSL2 | 4 | 8 | 8 | 6 | 7 | 6.6 | High | — |
| T-029 | 4.4 Makefile / WSL2 | 9 | 5 | 5 | 8 | 5 | 6.4 | High | — |
| T-030 | 4.4 Makefile / WSL2 | 5 | 6 | 6 | 7 | 6 | 6.0 | High | — |
| T-031 | 4.4 Makefile / WSL2 | 8 | 4 | 5 | 8 | 5 | 6.0 | High | — |
| T-032 | 4.4 Makefile / WSL2 | 9 | 4 | 5 | 7 | 6 | 6.2 | High | Exp=5, Dis=6: active LPE paths on unpatched WSL2 kernels [→ EV-032] |
| T-033 | 4.5 Prowler Scanner | 9 | 3 | 4 | 8 | 3 | 5.4 | Medium | — |
| T-034 | 4.5 Prowler Scanner | 8 | 4 | 5 | 7 | 5 | 5.8 | Medium | Rep=4, Dis=5: confirmed APT tactic with demonstrated package pre-registration [→ EV-034] |
| T-035 | 4.5 Prowler Scanner | 8 | 5 | 5 | 7 | 5 | 6.0 | High | — |
| T-036 | 4.5 Prowler Scanner | 5 | 7 | 6 | 7 | 6 | 6.2 | High | — |
| T-037 | 4.5 Prowler Scanner | 8 | 5 | 5 | 8 | 4 | 6.0 | High | — |
| T-038 | 4.5 Prowler Scanner | 9 | 6 | 6 | 8 | 4 | 6.6 | High | — |
| T-039 | 4.5 Prowler Scanner | 6 | 5 | 4 | 7 | 5 | 5.4 | Medium | — |
| T-040 | 4.5 Prowler Scanner | 7 | 4 | 5 | 7 | 4 | 5.4 | Medium | — |
| T-041 | 4.5 Prowler Scanner | 8 | 4 | 5 | 7 | 5 | 5.8 | Medium | Rep=4, Dis=5: malicious versions observed with short quarantine windows (minutes to hours) [→ EV-041] |
| T-042 | 4.6 Ingest Script | 8 | 5 | 5 | 7 | 4 | 5.8 | Medium | — |
| T-043 | 4.6 Ingest Script | 8 | 6 | 5 | 7 | 4 | 6.0 | High | — |
| T-044 | 4.6 Ingest Script | 4 | 8 | 8 | 6 | 7 | 6.6 | High | — |
| T-045 | 4.6 Ingest Script | 5 | 6 | 5 | 7 | 5 | 5.6 | Medium | — |
| T-046 | 4.6 Ingest Script | 6 | 4 | 4 | 7 | 4 | 5.0 | Medium | Dis=4: AI-generated logic flaws are non-obvious and unlikely to be detected without manual review [→ EV-052] |
| T-047 | 4.6 Ingest Script | 6 | 5 | 5 | 7 | 5 | 5.6 | Medium | — |
| T-048 | 4.7 AI Agent | 9 | 5 | 6 | 8 | 7 | 7.0 | High | Rep=5, Exp=6, Dis=7: confirmed against three major AI agent platforms [→ EV-048] |
| T-049 | 4.7 AI Agent | 8 | 5 | 6 | 8 | 6 | 6.6 | High | — |
| T-050 | 4.7 AI Agent | 4 | 7 | 7 | 6 | 7 | 6.2 | High | — |
| T-051 | 4.7 AI Agent | 10 | 4 | 6 | 9 | 7 | 7.2 | High | Dmg=10, Dis=7: confirmed exploit chain across four AI coding platforms; pattern is publicly documented — agent holds credential → executes action → authenticates to production [→ EV-051] |
| T-052 | 4.7 AI Agent | 7 | 5 | 5 | 7 | 6 | 6.0 | High | Dis=6: research-backed prevalence; Semgrep cannot detect novel logic flaws from code generation [→ EV-052] |
| T-053 | 4.7 AI Agent | 5 | 4 | 4 | 7 | 5 | 5.0 | Medium | — |
| T-054 | 4.7 AI Agent | 10 | 4 | 6 | 9 | 5 | 6.8 | High | Dis=5: EoP path requires discovering that the operator SA holds run.services.update + iam.serviceAccounts.actAs — less publicly documented than the credential exfil pattern in T-051 |
| T-055 | 4.8 Artifact Registry | 9 | 3 | 4 | 8 | 4 | 5.6 | Medium | — |
| T-056 | 4.8 Artifact Registry | 9 | 2 | 3 | 8 | 3 | 5.0 | Medium | — |
| T-057 | 4.8 Artifact Registry | 8 | 4 | 5 | 7 | 6 | 6.0 | High | Dis=6: same engine vulnerability as T-009; affects docker build/push steps in make deploy [→ EV-009] |
| T-058 | 4.8 Artifact Registry | 4 | 5 | 5 | 6 | 5 | 5.0 | Medium | — |
| T-059 | 4.8 Artifact Registry | 9 | 7 | 7 | 8 | 9 | 8.0 | Critical | Rep=7, Exp=7, Dis=9: validated patched at current build; score reflects known CVE state — residual risk is future disclosures with no continuous re-scan [→ EV-059] |
| T-060 | 4.8 Artifact Registry | 4 | 3 | 3 | 6 | 4 | 4.0 | Low | — |
| T-061 | 4.9 Secret Manager | 9 | 3 | 4 | 9 | 3 | 5.6 | Medium | — |
| T-062 | 4.9 Secret Manager | 5 | 5 | 5 | 7 | 5 | 5.4 | Medium | — |
| T-063 | 4.9 Secret Manager | 10 | 4 | 5 | 9 | 4 | 6.4 | High | Identical profile to T-064 — both threats collapse the same single-SA-token boundary; T-063 is the access vector, T-064 is the escalation consequence; identical scores are intentional |
| T-064 | 4.9 Secret Manager | 10 | 4 | 5 | 9 | 4 | 6.4 | High | Identical profile to T-063 — see T-063 note; T-064 distinguishes that reading the GCP SA key specifically enables SA impersonation, making it the higher-consequence materialisation of the same root condition |
| T-065 | 4.9 Secret Manager | 5 | 3 | 3 | 8 | 4 | 4.6 | Medium | — |
| T-066 | 4.10 Public Repo | 8 | 2 | 3 | 7 | 5 | 5.0 | Medium | Rep=2, Exp=3: platform patched internally; requires authenticated access [→ EV-066] |
| T-067 | 4.10 Public Repo | 4 | 8 | 8 | 6 | 8 | 6.8 | High | — |
| T-068 | 4.10 Public Repo | 8 | 9 | 8 | 8 | 9 | 8.4 | Critical | Rep=9, Dis=9: threat model document is published and machine-readable — the threat is reflexive; document is the attack roadmap [→ EV-068] |
| T-069 | 4.10 Public Repo | 8 | 9 | 9 | 8 | 9 | 8.6 | Critical | Exp=9: zero human effort required — tools run autonomously against any public repo; Rep=9, Dis=9: automated discovery demonstrated at scale [→ EV-069] |
| T-070 | 4.10 Public Repo | 7 | 7 | 5 | 7 | 9 | 7.0 | High | Dis=9: repo is permanently public; import patterns immediately accessible to any actor [→ EV-070] |
| T-071 | 4.10 Public Repo | 6 | 8 | 6 | 7 | 7 | 6.8 | High | — |
| T-072 | 4.10 Public Repo | 4 | 7 | 7 | 7 | 8 | 6.6 | High | — |
| T-073 | 4.11 Scan Output FS | 8 | 6 | 6 | 7 | 5 | 6.4 | High | — |
| T-074 | 4.11 Scan Output FS | 8 | 6 | 6 | 7 | 5 | 6.4 | High | — |
| T-075 | 4.11 Scan Output FS | 5 | 7 | 7 | 6 | 6 | 6.2 | High | — |
| T-076 | 4.11 Scan Output FS | 6 | 6 | 6 | 7 | 5 | 6.0 | High | — |
| T-077 | 4.11 Scan Output FS | 6 | 5 | 5 | 7 | 5 | 5.6 | Medium | — |
| T-078 | TB-1 Internet → Edge | 7 | 4 | 5 | 8 | 6 | 6.0 | High | — |
| T-079 | TB-1 Internet → Edge | 2 | 9 | 9 | 9 | 9 | 7.6 | High | — |
| T-080 | TB-1 Internet → Edge | 6 | 8 | 8 | 9 | 8 | 7.8 | High | — |
| T-081 | TB-2 Edge → Origin | 6 | 2 | 2 | 7 | 3 | 4.0 | Low | — |
| T-082 | TB-2 Edge → Origin | 7 | 5 | 4 | 7 | 5 | 5.6 | Medium | — |
| T-083 | TB-2 Edge → Origin | 7 | 3 | 3 | 9 | 4 | 5.2 | Medium | — |
| T-084 | TB-3 Workstation → Secrets | 9 | 4 | 5 | 8 | 4 | 6.0 | High | — |
| T-085 | TB-3 Workstation → Secrets | 10 | 5 | 5 | 9 | 4 | 6.6 | High | — |
| T-086 | TB-3 Workstation → Secrets | 5 | 3 | 3 | 8 | 4 | 4.6 | Medium | — |
| T-087 | TB-4 Workstation → Repo | 6 | 3 | 4 | 6 | 4 | 4.6 | Medium | — |
| T-088 | TB-4 Workstation → Repo | 8 | 5 | 4 | 7 | 5 | 5.8 | Medium | — |
| T-089 | TB-4 Workstation → Repo | 5 | 3 | 3 | 8 | 4 | 4.6 | Medium | — |
| T-090 | TB-5 CI → Packages | 8 | 4 | 5 | 7 | 6 | 6.0 | High | — |
| T-091 | TB-5 CI → Packages | 8 | 4 | 5 | 7 | 6 | 6.0 | High | Rep=4, Dis=6: malicious versions documented with short quarantine windows [→ EV-091] |
| T-092 | TB-5 CI → Packages | 5 | 3 | 3 | 8 | 4 | 4.6 | Medium | — |
| T-093 | TB-6 Workstation → Registry | 9 | 4 | 5 | 8 | 4 | 6.0 | High | — |
| T-094 | TB-6 Workstation → Registry | 9 | 2 | 3 | 8 | 3 | 5.0 | Medium | — |
| T-095 | TB-6 Workstation → Registry | 4 | 3 | 3 | 7 | 4 | 4.2 | Low | — |
| T-096 | TB-7 Registry → Cloud Run | 9 | 2 | 2 | 8 | 3 | 4.8 | Medium | — |
| T-097 | TB-7 Registry → Cloud Run | 6 | 3 | 3 | 9 | 4 | 5.0 | Medium | — |
| T-098 | TB-8 Workstation → Cloud APIs | 8 | 2 | 2 | 8 | 3 | 4.6 | Medium | — |
| T-099 | TB-8 Workstation → Cloud APIs | 8 | 5 | 5 | 7 | 5 | 6.0 | High | — |
| T-100 | TB-8 Workstation → Cloud APIs | 6 | 5 | 4 | 7 | 5 | 5.4 | Medium | — |
| T-101 | TB-9 Scanner → Output | 8 | 5 | 5 | 7 | 5 | 6.0 | High | — |
| T-102 | TB-9 Scanner → Output | 6 | 6 | 6 | 7 | 5 | 6.0 | High | — |
| T-103 | TB-9 Scanner → Output | 6 | 5 | 5 | 7 | 5 | 5.6 | Medium | — |
| T-104 | TB-10 Output → Docker Build | 9 | 5 | 5 | 8 | 5 | 6.4 | High | — |
| T-105 | TB-10 Output → Docker Build | 6 | 4 | 5 | 7 | 4 | 5.2 | Medium | — |
| T-106 | TB-10 Output → Docker Build | 6 | 5 | 5 | 7 | 5 | 5.6 | Medium | — |
| T-107 | TB-11 AI Agent → Workstation | 9 | 4 | 6 | 8 | 6 | 6.6 | High | — |
| T-108 | TB-11 AI Agent → Workstation | 10 | 4 | 6 | 9 | 5 | 6.8 | High | Dmg=10, Exp=6: same exploit pattern as T-051; agent credential access + allowed network egress = production authentication [→ EV-051] |
| T-109 | TB-11 AI Agent → Workstation | 5 | 4 | 4 | 7 | 5 | 5.0 | Medium | — |
| T-110 | TB-12 Internet → Repo | 8 | 5 | 5 | 7 | 7 | 6.4 | High | — |
| T-111 | TB-12 Internet → Repo | 8 | 9 | 8 | 8 | 9 | 8.4 | Critical | Rep=9, Dis=9: security docs are publicly readable; same evidence basis as T-068 [→ EV-068] |
| T-112 | TB-12 Internet → Repo | 4 | 7 | 7 | 7 | 7 | 6.4 | High | — |
| T-113 | 4.5 Prowler Scanner | 7 | 5 | 5 | 7 | 3 | 5.4 | Medium | — |
| T-114 | 4.1 Cloudflare Worker | 4 | 7 | 6 | 6 | 5 | 5.6 | Medium | — |
| T-115 | 4.1 Cloudflare Worker | 8 | 4 | 5 | 7 | 5 | 5.8 | Medium | Dmg=8: CF_SECRET reachable without Cloudflare credentials if origin SSRF exists; Exp=5: requires prior origin compromise |
| T-116 | 4.1 Cloudflare Worker | 8 | 6 | 7 | 7 | 6 | 6.8 | High | Rep=6, Exp=7: automatic if origin returns cacheable headers — no attacker action needed; Dmg=8: cache poisoning enables serving malicious content to all users |
| T-117 | 4.1 Cloudflare Worker | 6 | 5 | 5 | 5 | 5 | 5.2 | Medium | Exp=5: double-encoding is a known bypass technique; Aff=5: limited to nginx static file access |
| T-118 | 4.1 Cloudflare Worker | 10 | 3 | 4 | 10 | 5 | 6.4 | High | Dmg=10, Aff=10: API token compromise = full Worker replacement, all edge controls stripped; Rep=3: requires GitHub Secret exfiltration first [→ EV-073] |
| T-119 | 4.12 DevContainer | 8 | 3 | 4 | 7 | 5 | 5.4 | Medium | Rep=3: requires Docker Hub write access or re-tag capability; Dis=5: unpinned tag is visible in Dockerfile |
| T-120 | 4.12 DevContainer | 9 | 3 | 4 | 8 | 5 | 5.8 | Medium | Dmg=9: arbitrary code in devcontainer during build; Rep=3: requires CDN or DNS compromise [→ EV-071] |
| T-121 | 4.12 DevContainer | 8 | 3 | 4 | 7 | 4 | 5.2 | Medium | Dmg=8: tampered pre-commit hook runs on every commit; Rep=3: requires GitHub Releases write access; Dis=4: less prominently documented than curl\|bash risk |
| T-122 | 4.12 DevContainer | 9 | 5 | 5 | 9 | 5 | 6.6 | High | Aff=9: NET_ADMIN bypass nullifies all egress controls; Exp=5: node user already has sudo path via init-firewall.sh; no CVE required [→ EV-072] |
| T-123 | 4.12 DevContainer | 8 | 4 | 4 | 8 | 3 | 5.4 | Medium | Dis=3: failIfUnavailable setting buried in managed-settings.json; consequence is silent full-privilege Claude Code execution |
| T-124 | 4.12 DevContainer | 8 | 6 | 5 | 7 | 5 | 6.2 | High | Rep=6: any session issuing gcloud commands writes to history; Aff=7: all credentials touched inside container potentially captured |
| T-125 | 4.12 DevContainer | 9 | 3 | 5 | 9 | 4 | 6.0 | High | Dmg/Aff=9: DNS/BGP MitM at firewall init = complete allowlist control; Rep=3: requires network-level positioning |
| T-126 | 4.12 DevContainer | 5 | 5 | 4 | 5 | 4 | 4.6 | Medium | Rep=5: every container restart goes through init; Dmg=5: temporary window; mitigated if init completes before first network activity |
| T-127 | TB-13 WSL2 → DevContainer | 8 | 3 | 4 | 7 | 4 | 5.2 | Medium | Rep=3: requires host filesystem write access; Dis=4: tamper would be visible in git diff |
| T-128 | TB-13 WSL2 → DevContainer | 7 | 5 | 5 | 7 | 5 | 5.8 | Medium | Rep=5: any container session; Aff=7: whatever credential files exist on the WSL2 host path |
| T-129 | TB-13 WSL2 → DevContainer | 4 | 4 | 4 | 7 | 4 | 4.6 | Medium | Dmg=4: availability impact only; Aff=7: all devcontainer sessions blocked |
| T-130 | TB-14 DevContainer → Registries | 8 | 3 | 4 | 7 | 4 | 5.2 | Medium | Same supply chain profile as T-119 at the interaction boundary; Rep=3: requires Docker Hub infrastructure compromise |
| T-131 | TB-14 DevContainer → Registries | 3 | 3 | 3 | 7 | 3 | 3.8 | Low | Dmg=3: availability impact only; Rep=3: requires registry outage |
| T-132 | TB-15 DevContainer → GitHub API | 9 | 3 | 5 | 9 | 4 | 6.0 | High | Same profile as T-125 at the interaction layer; Exp=5: DNS MitM requires network positioning |
| T-133 | TB-15 DevContainer → GitHub API | 7 | 4 | 5 | 7 | 5 | 5.6 | Medium | Dmg=7: container starts with no egress filtering; Exp=5: unauthenticated rate limit easily exhausted |
| T-134 | 4.6 Ingest Script | 8 | 3 | 5 | 7 | 4 | 5.4 | Medium | Exp=5: requires crafted Prowler JSON reaching a Python code execution path; Dis=4: ingest runs as a subprocess of make with no sandboxing |
| T-135 | 4.12 DevContainer | 4 | 7 | 7 | 6 | 6 | 6.0 | High | Rep=7, Exp=7: Docker container log mutation requires only host access; Dis=6: Docker log mutability is publicly documented |

---

### 8.2 Threat Evidence

*Each entry documents the real-world incident, CVE, or research finding that establishes a threat class as concretely exploitable and justifies specific DREAD dimension values. Cross-references appear in §8.1 Scoring Notes.*

| EV ID | Threat ID(s) | Type | Reference | Detail |
|---|---|---|---|---|
| EV-009 | T-009, T-057 | CVE | CVE-2026-34040 (CVSS 8.8) | Docker Engine AuthZ plugin bypass via request bodies >1 MB; enables unprivileged container creation with host filesystem access; patched in Engine 29.3.1 |
| EV-014 | T-014 | CVE cluster | CVE-2026-42945 "NGINX Rift", CVE-2026-9256, CVE-2026-42926, CVE-2026-40460, nginx-poolslip zero-day | nginx RCE chain; arbitrary code execution as nginx worker process; patch: 1.30.2+. Validation: pinned image confirmed running nginx/1.30.2 — patched against all listed CVEs; residual risk is future disclosures after the last build |
| EV-018 | T-018 | Campaign | RoguePilot (Feb 2026) | Prompt injection in GitHub issue bodies leaks GITHUB_TOKEN via an AI coding assistant with repo access; confirmed against GitHub Copilot; same issue/PR surface active in this repo |
| EV-020 | T-020 | Campaign | Megalodon/TanStack (Mar–May 2026) | Actions cache poisoning combined with imposter commits introduced via fork; this repo mitigates via no `pull_request_target` + SHA-pinned actions |
| EV-022 | T-022 | Incident | tj-actions incident (Mar 2025) | Compromised GitHub Action dumped runner environment variables to workflow logs; 23,000 repos affected; GITHUB_TOKEN was in scope for all affected repos |
| EV-023 | T-023 | Campaign | LiteLLM chain attack (Mar 2026) | Trivy GitHub Action compromised → stolen PyPI credentials → backdoored package published; the same Trivy action is used in docker-build.yml in this repo |
| EV-032 | T-032 | CVE cluster | CVE-2026-46170 (MPTCP privilege escalation, HIGH), CVE-2026-43009 (eBPF verifier LPE, HIGH, May 2026) | Multiple active LPE paths on unpatched WSL2 kernels; both CVEs rated HIGH; the operator workstation runs WSL2 |
| EV-034 | T-034 | Campaign | PromptMink (Famous Chollima APT) | APT registers AI-hallucinated Python package names on PyPI before developers can verify; specifically targets projects using AI coding assistants for dependency suggestions |
| EV-041 | T-041 | Campaign | TeamPCP "Mini Shai-Hulud" (2026) | Targets widely-used Python packages with short-lived malicious versions; LiteLLM, Microsoft durabletask, PyTorch Lightning affected; malicious versions live 40 minutes to hours before quarantine |
| EV-048 | T-048 | Campaign | "Comment and Control" (Apr 2026) | Prompt injection via GitHub issue/PR body hijacks AI coding agent behavior; confirmed against Claude Code, Gemini CLI, and GitHub Copilot |
| EV-051 | T-051, T-108 | Research | Six confirmed exploits (2026) | Exploit pattern documented across Codex, Claude, GitHub Copilot, and Vertex AI: agent accesses credential → executes action → authenticates to production; no malware installation required |
| EV-052 | T-052, T-046 | Research | 2026 AI code vulnerability research | 78% of AI-generated code contains ≥1 exploitable vulnerability per 2026 research; 35 CVEs attributed to AI-generated code in March 2026 alone; traditional SAST cannot detect novel logic flaws introduced by code generation |
| EV-059 | T-059 | Validation | nginx/1.30.2 digest verification | Pinned image digest confirmed running nginx/1.30.2 — patched against CVEs in EV-014; residual risk: newly disclosed CVEs after the last build are present in the running image with no alerting or re-scan trigger |
| EV-066 | T-066 | CVE | CVE-2026-3854 (GitHub RCE, Apr 2026) | Authenticated users can execute arbitrary commands via git push against GitHub's internal Git infrastructure; GitHub patched internally; demonstrates the platform is an attack surface outside operator control |
| EV-068 | T-068, T-111 | Research | GitHub Security Lab Taskflow (Mar 2026) | Automated tool uses published threat model documentation to guide vulnerability discovery; published stride.md and threat-model.md serve as a pre-built reconnaissance roadmap for any actor |
| EV-069 | T-069 | Research | SwarmFlow + Taskflow (2026) | SwarmFlow (135 specialized agents) and Taskflow automatically scan public repositories to discover exploitable vulnerabilities in ≤30 seconds; first AI-generated zero-day confirmed May 2026 |
| EV-070 | T-070 | Campaign | PromptMink (Famous Chollima APT) | Same APT as EV-034; uses public repo reconnaissance — package names, import conventions, tooling choices — to identify which AI-hallucinated package names to pre-register on PyPI |
| EV-071 | T-120 | Campaign | curl-pipe-bash supply chain attacks (2024–2026) | Multiple widely-used install scripts (Homebrew, Rust/rustup, nvm, various SaaS CLIs) targeted via CDN compromise or DNS hijack; no content hash at install time = silent substitution with no user-visible indicator |
| EV-072 | T-122 | Research | Container NET_ADMIN capability abuse (2025) | Containers granted NET_ADMIN can reconfigure host netfilter via iptables/ipset; combined with a passwordless sudo path, provides a reliable egress-firewall reset requiring no CVE exploitation — any container code execution is sufficient |
| EV-073 | T-118 | Incident | Cloudflare API token exfiltration via GitHub Actions (2025) | Cloudflare API tokens stored as GitHub Secrets have been demonstrated exfiltrated via compromised Actions workflows; token holders can deploy arbitrary Worker code to all configured routes, bypassing all code review controls |
| EV-091 | T-091 | Campaign | TeamPCP campaign (Mar 2026) | Same threat actor as EV-041; LiteLLM backdoor version lived ~40 minutes before quarantine; specifically targets pip install in CI pipelines |
