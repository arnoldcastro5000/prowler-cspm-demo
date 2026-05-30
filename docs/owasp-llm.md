# OWASP Top 10 for LLM Applications (2025)

This project was built with Claude Code, an AI coding agent. The LLM is the *development tool*, not a feature in the application — the deployed dashboard does not call any model and contains no AI runtime surface. Mapped against the OWASP Top 10 for LLM Applications (2025 edition): **five categories are mitigated, two are not applicable (model training and vector-database risks the project does not implement), two carry documented residual risk** (LLM01 prompt injection — blast radius contained but model-level vector cannot be eliminated; LLM03 supply chain — AI-fabricated typosquat in initial dep selection has no specific detection), **and one is accepted by design** (LLM07: `CLAUDE.md` is published to the public repository because transparency is the point of a portfolio project). Each category is detailed below with controls in place; the **residual risk register** at the end consolidates the three open items (LLM-R01, LLM-R02, LLM-R03) with treatments named.

## Status at a glance

| # | Category | Status | Why |
|---|---|---|---|
| LLM01 | Prompt Injection | 🟡 Partially mitigated | **LLM-R01**: blast radius contained (sandbox approval gate, network allowlist, `--dry-run` makes) — model-level injection vector cannot be fully prevented through wrapper controls |
| LLM02 | Sensitive Information Disclosure | 🟢 Mitigated | `redact_resource()` in ingest strips IDs; `.gitignore` excludes state/creds; CI `hardcoded-config-check` + Gitleaks |
| LLM03 | Supply Chain Vulnerabilities | 🟡 Partially mitigated | Known-bad caught (Dependency Review + Dependabot); Actions + Docker images SHA-pinned; hard rule blocks new deps — **LLM-R02**: AI-fabricated typosquat in initial dep selection has no specific detection |
| LLM04 | Data and Model Poisoning | ⚪ Does not apply | Project uses Claude Code as a third-party tool; no training, fine-tuning, or model hosting |
| LLM05 | Improper Output Handling | 🟢 Mitigated | React auto-escape; no `eval()` / `innerHTML` / `subprocess`; Zod validation; CSP + nosniff; TS strict + ESLint |
| LLM06 | Excessive Agency | 🟢 Mitigated | Per-command approval; make `--dry-run` only; `git push` not auto-allowed; `make deploy` needs human |
| LLM07 | System Prompt Leakage | 🟡 Accepted risk | **LLM-R03**: `CLAUDE.md` is public by design; secret names ≠ values; `.claude/settings.local.json` is gitignored |
| LLM08 | Vector and Embedding Weaknesses | ⚪ Does not apply | No vector DB, embedding store, or RAG pipeline |
| LLM09 | Misinformation | 🟢 Mitigated | 12 CI checks; Prowler before/after as IaC integration test; OWASP ZAP; single-dev review; Zod runtime validation |
| LLM10 | Unbounded Consumption | 🟢 Mitigated | Sandbox prevents runaway commands; Cloudflare CDN + DDoS + Bot Fight; Worker rules 4 & 6; Cloud Run scales to zero |

---

## LLM01: Prompt Injection

**Status:** 🟡 Partially mitigated

Claude Code reads `CLAUDE.md`, project files, and scan output as context during development sessions. If any file in the working tree contained adversarial instructions — a crafted comment in a dependency README, a malicious resource name in Prowler output, or an injected PR description — it could attempt to influence the agent to bypass its hard rules. Prompt injection is fundamentally a model-level vulnerability that wrapper controls cannot eliminate; the controls below contain the *blast radius* of a successful injection rather than prevent the vector itself.

**Controls in place:**

- `CLAUDE.md` hard rules explicitly prohibit committing credentials, hardcoded IDs, and schema changes — the agent's system prompt constrains its behavior regardless of file content.
- Sandbox settings (`autoAllowBashIfSandboxed: false`) require explicit user approval for every shell command, preventing injected instructions from silently executing.
- Make commands are restricted to `--dry-run` variants only — even a successfully injected prompt cannot trigger `terraform apply` or `make deploy`.
- Network access is limited to `api.github.com` — the agent cannot exfiltrate data or fetch attacker-controlled payloads.
- `.gitignore` excludes `node_modules/`, `prowler/output/`, and `*.tfstate` from version control, though the agent can still read these locally during development.

**Residual risk (LLM-R01):** see Residual risk register.

**Improvement opportunities:**

- Add a `.claudeignore` file to exclude `prowler/output/`, `node_modules/`, and `*.tfstate` from the agent's context entirely, reducing the surface area for indirect prompt injection through attacker-influenced file content.

See `docs/security.md` → Pillar 5 (AI Development Guardrails).

---

## LLM02: Sensitive Information Disclosure

**Status:** 🟢 Mitigated

Claude Code has read access to the entire project directory during development. Files in the working tree may contain real cloud resource identifiers — Prowler scan output with ARNs and subscription IDs, Terraform state with resource metadata, or shell scripts referencing Secret Manager secret names. If the agent echoed these values into committed code, logs, or debug output, real infrastructure identifiers could leak into the public repository.

**Controls in place:**

- `redact_resource()` in `ingest/ingest_prowler.py` strips AWS account IDs, S3 bucket names, GCP project IDs, and Azure subscription paths before writing to `dashboard/public/`. Published findings contain only resource types (e.g., `azure:Microsoft.Storage/storageAccounts`), not real identifiers.
- `.gitignore` excludes `*.tfstate`, `*.tfstate.backup`, credential files (`*credentials*.json`, `*-key.json`), `prowler/output/`, and the `.claude/` directory.
- `CLAUDE.md` hard rules prohibit hardcoding cloud account IDs, resource IDs, regions, credentials, and personal email addresses.
- CI: `hardcoded-config-check.yml` scans source files for 12-digit AWS account IDs, Azure UUIDs, AWS resource IDs, hardcoded regions, and personal emails on every push and PR.
- CI: `secret-scan.yml` runs Gitleaks on every push and PR to catch exposed credentials.
- Sandbox: network restricted to `api.github.com` — the agent cannot send project data to arbitrary external endpoints.

See `docs/security.md` → Pillar 1 (Credential & Secrets Hygiene).

---

## LLM03: Supply Chain Vulnerabilities

**Status:** 🟡 Partially mitigated

Claude Code selected every dependency in this project — npm packages, pip packages, Terraform providers, GitHub Actions, and Docker base images. An AI agent recommends packages from its training data without independently verifying authenticity. A typosquatted or compromised package recommended by the LLM would enter the project's supply chain. Going forward, the hard rule + per-command approval gate on `npm install` controls *future* additions; the residual is in the *initial selection* — a typosquat already in `package-lock.json` from the AI-driven setup that has not yet been flagged in any vulnerability database has no current detection.

**Controls in place:**

- CI: `dependency-review.yml` scans npm and pip dependencies for *known* vulnerabilities on every PR that modifies package files. (Does not detect novel typosquats.)
- Dependabot opens automated PRs weekly for outdated npm, pip, and GitHub Actions dependencies (`.github/dependabot.yml`).
- All GitHub Actions in CI are pinned to exact commit SHAs, not mutable version tags — immune to namespace hijack on the Actions registry.
- Docker base images in `dashboard/Dockerfile` are pinned to SHA digests (`node:20-alpine@sha256:...`, `nginx:1.27-alpine@sha256:...`) — immune to image namespace hijack.
- CI: `zizmor.yml` audits GitHub Actions workflows for supply chain risks.
- `CLAUDE.md` hard rule: do not add npm packages, pip packages, or Terraform providers not already in the stack — blocks the agent from adding any new dep.
- Sandbox: `autoAllowBashIfSandboxed: false` — the agent cannot run `npm install` without explicit user approval.
- Python ingest uses only the standard library (zero third-party dependencies).

**Residual risk (LLM-R02):** see Residual risk register.

**Improvement opportunities:**

- Add `npm audit` to `frontend-ci.yml` to check installed packages against known vulnerabilities (covers npm specifically, beyond Dependency Review).
- Add a SAST scanner (e.g., Semgrep) to CI to catch code-level security anti-patterns in dependencies — injection, XSS, insecure randomness, suspicious post-install scripts, and other patterns in AI-recommended packages.
- Consider adding `--ignore-scripts` to `npm ci` in CI to prevent lifecycle script execution during build.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain).

---

## LLM04: Data and Model Poisoning

**Status:** ⚪ Does not apply

This risk concerns adversaries manipulating an LLM's training data or fine-tuning to produce biased or malicious outputs. This project uses Claude Code as a third-party development tool via Anthropic's API — it does not train, fine-tune, or host any model. The project has no influence over Claude Code's training data or model weights.

`CLAUDE.md` hard rules and sandbox settings provide session-level behavioral constraints that operate independently of model training, but these are guardrails on usage, not defenses against model poisoning.

---

## LLM05: Improper Output Handling

**Status:** 🟢 Mitigated

AI-generated code goes directly into a production codebase. If Claude Code introduced `dangerouslySetInnerHTML`, `eval()`, shell injection, or other unsafe output patterns, the deployed application would be vulnerable — and the vulnerability would have been authored by the AI, not a human.

**Controls in place:**

- React 18 auto-escapes all JSX expressions by default. No `dangerouslySetInnerHTML`, `innerHTML`, or `eval()` calls exist anywhere in the codebase.
- No `subprocess`, `os.system`, or `os.popen` calls in the Python ingest code.
- Zod schema validation (`FindingSchema`) validates all findings data at runtime before rendering — rejects unexpected fields or shapes.
- CSP header with per-request nonce restricts script sources to `self`, blocking inline scripts and external script injection.
- `X-Content-Type-Options: nosniff` prevents MIME-type sniffing of JSON files.
- The dashboard is fully read-only — no forms, no user input, no POST endpoints.
- Cloudflare Worker blocks all non-GET/HEAD/OPTIONS methods.
- CI: TypeScript strict mode + ESLint `recommended-type-checked` catch type errors and common anti-patterns.

**Improvement opportunities:**

- A SAST scanner in CI would automatically flag `dangerouslySetInnerHTML`, `eval()`, `document.write`, `subprocess.call(shell=True)`, and similar unsafe output patterns if the AI introduces them in future changes — turning a point-in-time observation into automated enforcement. (Same SAST scanner addresses LLM-R02 — see Residual risk register.)

See `docs/security.md` → Pillar 4 (Hardened Application Surface) → HTTP security headers; Pillar 2 (Secure Build & Supply Chain).

---

## LLM06: Excessive Agency

**Status:** 🟢 Mitigated

Claude Code can execute shell commands, modify files, and commit to git. Without constraints, the agent could run `terraform apply` against live infrastructure, push to main, install arbitrary packages, or modify CI workflows to remove security checks.

**Controls in place:**

- Sandbox enabled with `autoAllowBashIfSandboxed: false` — every bash command requires explicit user approval at runtime.
- Only `prowler/run_scan.sh` has pre-approved edit permissions. All other file modifications require approval.
- Make commands are restricted to `--dry-run` variants only (`make --dry-run before`, `make --dry-run scan`, etc.).
- Network access limited to `api.github.com` — cannot reach cloud provider APIs, package registries, or arbitrary endpoints.
- Git permissions limited to `git add *` and `git commit -m *` — `git push` is not auto-allowed.
- Deployment (`make deploy`) is not in the auto-allow list and requires human approval.
- `run_scan.sh` guards require committed code and green CI before executing scans.

See `docs/security.md` → Pillar 5 (AI Development Guardrails).

---

## LLM07: System Prompt Leakage

**Status:** 🟡 Accepted risk

`CLAUDE.md` functions as the system prompt for Claude Code sessions in this project. It contains the full repository structure, Makefile targets, Terraform variable names, Prowler check IDs, and GCP Secret Manager secret names. If this content were leaked, an attacker would learn the project's operational workflow and the exact names of secrets stored in Secret Manager.

**Why this is accepted:**

- `CLAUDE.md` is committed to the public repository — it is public by design. This is a portfolio project; transparency is the point.
- Secret names (e.g., `prowler-aws-access-key-id`) are names, not values. Knowing the name does not provide access without GCP IAM permissions and `gcloud auth` ADC.
- `.claude/settings.local.json` — which contains the sandbox permissions and auto-allow rules — is gitignored and not published. The operational constraints on the agent are not exposed.
- No real credentials, keys, tokens, or account IDs appear in `CLAUDE.md`.

**Residual risk (LLM-R03):** see Residual risk register.

---

## LLM08: Vector and Embedding Weaknesses

**Status:** ⚪ Does not apply

This risk concerns applications that use vector databases and embeddings for retrieval-augmented generation (RAG). This project does not use any vector database, embedding store, or RAG pipeline. There is no semantic search over code or documents. Claude Code's built-in codebase indexing is managed by Anthropic's infrastructure and is outside the project's control surface.

---

## LLM09: Misinformation

**Status:** 🟢 Mitigated

Claude Code could generate code that appears correct but contains subtle logical errors — a Terraform security group rule that looks restrictive but actually allows all traffic, a redaction regex that misses an edge case, a CSP header with an overly permissive directive, or documentation claims that are inaccurate.

**Controls in place:**

- 12 CI checks run on every push and PR, including type checking, linting, security scanning (Bandit, Semgrep, Trivy, Gitleaks), and build verification.
- The Prowler before/after scan pattern is an integration test of the IaC: `make before` misconfigures 15 checks, `make scan` verifies all 15 fire, `make after` hardens them, `make rescan` verifies zero findings. If the Terraform is wrong, Prowler catches it.
- `run_scan.sh` guards require green CI before scanning, creating a dependency chain: code quality → infrastructure state → scan results.
- OWASP ZAP baseline scan validates that deployed security headers and Worker rules behave as documented (run manually).
- Human reviews all commits — single-developer project with no auto-merge.
- Zod schema validation catches malformed data at runtime, preventing silently corrupt findings from rendering.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain); Pillar 4 (Hardened Application Surface) → DAST.

---

## LLM10: Unbounded Consumption

**Status:** 🟢 Mitigated

On the development side, Claude Code could generate unbounded output, run long-running commands, or create files that exhaust disk space. On the deployed application side, the dashboard could be targeted for cost-based attacks against Cloud Run.

**Controls in place — development side:**

- Sandbox limits and `autoAllowBashIfSandboxed: false` prevent runaway commands.
- Make commands restricted to `--dry-run` — the agent cannot trigger real infrastructure operations that consume cloud resources.

**Controls in place — deployed side:**

- Cloudflare CDN caches static assets at the edge, absorbing repeated requests before they reach the origin.
- Cloudflare DDoS protection and Bot Fight Mode limit volumetric attacks.
- Cloudflare Worker blocks oversized headers (rule 6) and oversized URLs (rule 4), preventing resource exhaustion via request inflation.
- Cloud Run scales to zero when idle — no baseline cost.
- No backend API, no database, no per-request LLM cost — the entire application is static files served from a container. The only variable cost is Cloud Run instances.

See `docs/security.md` → Pillar 3 (Defended Runtime Edge); Pillar 2 (Secure Build & Supply Chain).

---

## Residual risk register

| ID | Category | Risk | Status | Treatment / compensating control |
|---|---|---|---|---|
| **LLM-R01** | LLM01 Prompt Injection | Adversarial file content (dep README, Prowler scan output, PR description) could influence the agent. Sandbox prevents silent shell exec, network exfil, and infrastructure mutation, but the agent could still write subtly malicious code into files, recommend bad changes under plausible justification, or shape commit text. Prompt injection is a model-level vulnerability that wrapper controls cannot fully prevent. | Partially mitigated | **Compensating controls:** Sandbox `autoAllowBashIfSandboxed: false` (per-command approval); network restricted to `api.github.com`; make targets `--dry-run` only; `git push` not auto-allowed; single-developer review on every commit; 12 CI gates catch known-bad code patterns. **Treatment:** Add a `.claudeignore` file to exclude `prowler/output/`, `node_modules/`, and `*.tfstate` from the agent's context, reducing the surface area for indirect prompt injection through attacker-influenced file content. |
| **LLM-R02** | LLM03 Supply Chain Vulnerabilities | The npm packages in this project were introduced during AI-assisted implementation. Neither the developer nor the agent independently verified package authenticity against the registry at selection time — a typosquatted package already in `package-lock.json` that has not yet been flagged in any vulnerability database has no current detection mechanism. Dependency Review catches *known* CVEs; Dependabot updates *existing* deps; SHA-pinning protects against namespace squatting on Actions and Docker images. | Accepted | **Compensating controls:** `CLAUDE.md` hard rule blocks adding any new dep; sandbox requires explicit approval for `npm install`; all GitHub Actions and Docker base images SHA-pinned (immune to namespace hijack); Python ingest uses only stdlib (zero third-party); install-script execution blocked via `npm ci --ignore-scripts` in CI and Docker build (RL-02); Semgrep SAST gates on first-party JS/TS source (RL-01). **Accepted:** no detection mechanism exists for a typosquatted package that has not yet been flagged in any vulnerability database. `npm audit` evaluated and not adopted as a gate — overlaps existing controls and cannot detect novel typosquats. See remediation log RL-02. |
| **LLM-R03** | LLM07 System Prompt Leakage | `CLAUDE.md` (the agent's system prompt) is committed to a public repository; it contains the full repo structure, Makefile targets, Terraform variable names, Prowler check IDs, and GCP Secret Manager secret names | Accepted | **Compensating controls:** Secret names are not values — knowing `prowler-aws-access-key-id` provides no access without GCP IAM + `gcloud auth` ADC. `.claude/settings.local.json` (sandbox permissions and auto-allow rules) is gitignored and not published. No real credentials, keys, tokens, or account IDs appear in `CLAUDE.md`. **Treatment:** None — accepted by design; transparency is the point of the portfolio project. If the repo ever moves private or carries real customer data, revisit by moving operational details into a gitignored `CLAUDE.local.md` and keeping only public-safe guidance in `CLAUDE.md`. |

---

## Remediation log

*Added 2026-05-29. The per-category assessments and the residual risk register above are retained as the original point-in-time review. This log records remediation completed since, without altering the original findings.*

### RL-01 — SAST scanner added in CI

Addresses the improvement opportunities under **LLM05** and **LLM03**, and part of the **LLM-R02** treatment.

**Implemented:** a Semgrep SAST gate now runs on every push/PR that touches `dashboard/src/**` or `cloudflare/**`.

- Workflow: `.github/workflows/semgrep.yml` — Semgrep pinned to `1.164.0`, SHA-pinned actions, gates on findings (`--error`), SARIF uploaded to **Security → Code scanning**.
- Rules: `.semgrep/rules.yml` — vendored locally (no registry pull → reproducible), covering `eval`, `new Function`, `document.write`, `innerHTML` assignment, and `dangerouslySetInnerHTML`.
- Validated: rules confirmed to fire against a positive-test fixture; 0 findings on current code.

| Original item | Status now |
|---|---|
| LLM05 — "A SAST scanner would flag `dangerouslySetInnerHTML`, `eval()`, `document.write`…" | ✅ Implemented for JS/TS — moves from point-in-time observation to automated regression enforcement. |
| LLM03 / LLM-R02 — "Add a SAST scanner (e.g., Semgrep)…" | ◑ Partially done (see scope note). |

**Scope clarification (for accuracy against the original wording):**

- Semgrep here scans **first-party source** (`dashboard/src`, `cloudflare`), **not** `node_modules`. It does not, on its own, detect typosquatted packages or malicious post-install scripts — so that part of the LLM-R02 treatment remains **open**.
- The Python example cited under LLM05 (`subprocess.call(shell=True)`) was already covered by **Bandit** (`python-lint.yml`, scanning `ingest/`). Semgrep was deliberately scoped to JS/TS to avoid overlap: Bandit owns Python, Trivy owns IaC, Semgrep owns JS/TS.

**LLM-R02 follow-ups:** see RL-02.

### RL-02 — Install-script execution blocked (`--ignore-scripts`)

Addresses the "malicious post-install scripts" element of the **LLM-R02** treatment.

**Implemented (2026-05-29):** `npm ci --ignore-scripts` is now used in both install paths — `.github/workflows/frontend-ci.yml` and `dashboard/Dockerfile` (build stage) — blocking dependency lifecycle (preinstall/install/postinstall) scripts from executing on CI runners and the Docker builder, the primary npm supply-chain RCE vector.

- Verified safe: only `esbuild` (binary delivered by an optional dependency, not its postinstall) and macOS-only `fsevents` declare install scripts; a clean `npm ci --ignore-scripts` produced a byte-identical build, and Frontend CI + Docker Build passed on commit `11b9a30`.

**Decision — `npm audit` not adopted as a gate:** it is known-advisory detection that overlaps the existing `dependency-review` action (PRs) and Dependabot (weekly + security alerts), currently reports 2 moderate advisories in build-toolchain transitive deps not exploitable in a static-site bundle (so a default gate would fail CI on non-issues), and cannot detect novel typosquats. If added later it should be advisory-only (`--audit-level=high`).

**LLM-R02 status:** the install-script execution path is now closed; the novel-typosquat-in-initial-selection core remains an **accepted residual** — no detection mechanism exists for an unreported typosquat.
