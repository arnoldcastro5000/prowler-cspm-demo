# OWASP Top 10 for LLM Applications (2025)

This project was built entirely by Claude Code, an AI coding agent. The LLM is
the development tool, not a feature in the application. The following maps each
OWASP LLM risk to this project's development workflow and documents the controls
in place.

---

## LLM01: Prompt Injection

**Status: Mitigated**

Claude Code reads `CLAUDE.md`, project files, and scan output as context during
development sessions. If any file in the working tree contained adversarial
instructions — a crafted comment in a dependency README, a malicious resource
name in Prowler output, or an injected PR description — it could attempt to
influence the agent to bypass its hard rules.

**Controls in place:**

- `CLAUDE.md` hard rules explicitly prohibit committing credentials, hardcoded IDs, and schema changes — the agent's system prompt constrains its behavior regardless of file content.
- Sandbox settings (`autoAllowBashIfSandboxed: false`) require explicit user approval for every shell command, preventing injected instructions from silently executing.
- Make commands are restricted to `--dry-run` variants only — even a successfully injected prompt cannot trigger `terraform apply` or `make deploy`.
- Network access is limited to `api.github.com` — the agent cannot exfiltrate data or fetch attacker-controlled payloads.
- `.gitignore` excludes `node_modules/`, `prowler/output/`, and `*.tfstate` from version control, though the agent can still read these locally during development.

**Recommended future control:** Add a `.claudeignore` file to exclude `prowler/output/`, `node_modules/`, and `*.tfstate` from the agent's context entirely, reducing the surface area for indirect prompt injection through attacker-influenced file content.

---

## LLM02: Sensitive Information Disclosure

**Status: Mitigated**

Claude Code has read access to the entire project directory during development.
Files in the working tree may contain real cloud resource identifiers — Prowler
scan output with ARNs and subscription IDs, Terraform state with resource
metadata, or shell scripts referencing Secret Manager secret names. If the agent
echoed these values into committed code, logs, or debug output, real
infrastructure identifiers could leak into the public repository.

**Controls in place:**

- `redact_resource()` in `ingest/ingest_prowler.py` strips AWS account IDs, S3 bucket names, GCP project IDs, and Azure subscription paths before writing to `dashboard/public/`. Published findings contain only resource types (e.g., `azure:Microsoft.Storage/storageAccounts`), not real identifiers.
- `.gitignore` excludes `*.tfstate`, `*.tfstate.backup`, credential files (`*credentials*.json`, `*-key.json`), `prowler/output/`, and the `.claude/` directory.
- `CLAUDE.md` hard rules prohibit hardcoding cloud account IDs, resource IDs, regions, credentials, and personal email addresses.
- CI: `hardcoded-config-check.yml` scans source files for 12-digit AWS account IDs, Azure UUIDs, AWS resource IDs, hardcoded regions, and personal emails on every push and PR.
- CI: `secret-scan.yml` runs Gitleaks on every push and PR to catch exposed credentials.
- Sandbox: network restricted to `api.github.com` — the agent cannot send project data to arbitrary external endpoints.

See `docs/security.md` → Credential Handling, Data Redaction, Secret Scanning.

---

## LLM03: Supply Chain Vulnerabilities

**Status: Mitigated**

Claude Code selected every dependency in this project — npm packages, pip
packages, Terraform providers, GitHub Actions, and Docker base images. An AI
agent recommends packages from its training data without independently verifying
authenticity. A typosquatted or compromised package recommended by the LLM would
enter the project's supply chain.

**Controls in place:**

- CI: `dependency-review.yml` scans npm and pip dependencies for known vulnerabilities on every PR that modifies package files.
- Dependabot opens automated PRs weekly for outdated npm, pip, and GitHub Actions dependencies (`.github/dependabot.yml`).
- All GitHub Actions in CI are pinned to exact commit SHAs, not mutable version tags — verified across all 11 workflow files.
- Docker base images in `dashboard/Dockerfile` are pinned to SHA digests (`node:20-alpine@sha256:...`, `nginx:1.27-alpine@sha256:...`).
- CI: `zizmor.yml` audits GitHub Actions workflows for supply chain risks.
- `CLAUDE.md` hard rule: do not add npm packages, pip packages, or Terraform providers not already in the stack.
- Sandbox: `autoAllowBashIfSandboxed: false` — the agent cannot run `npm install` without explicit user approval.
- Python ingest uses only the standard library (zero third-party dependencies).

**Recommended future control:** Add a SAST scanner (e.g., Semgrep) to CI to catch code-level security anti-patterns that type checking and linting do not detect — injection, XSS, insecure randomness, and other patterns in AI-generated code.

See `docs/security.md` → CI/CD Workflows.

---

## LLM04: Data and Model Poisoning

**Status: Does not apply**

This risk concerns adversaries manipulating an LLM's training data or
fine-tuning to produce biased or malicious outputs. This project uses Claude Code
as a third-party development tool via Anthropic's API — it does not train,
fine-tune, or host any model. The project has no influence over Claude Code's
training data or model weights.

`CLAUDE.md` hard rules and sandbox settings provide session-level behavioral
constraints that operate independently of model training, but these are
guardrails on usage, not defenses against model poisoning.

---

## LLM05: Improper Output Handling

**Status: Mitigated**

AI-generated code goes directly into a production codebase. If Claude Code
introduced `dangerouslySetInnerHTML`, `eval()`, shell injection, or other unsafe
output patterns, the deployed application would be vulnerable — and the
vulnerability would have been authored by the AI, not a human.

**Controls in place:**

- React 18 auto-escapes all JSX expressions by default. No `dangerouslySetInnerHTML`, `innerHTML`, or `eval()` calls exist anywhere in the codebase.
- No `subprocess`, `os.system`, or `os.popen` calls in the Python ingest code.
- Zod schema validation (`FindingSchema`) validates all findings data at runtime before rendering — rejects unexpected fields or shapes.
- CSP header with per-request nonce restricts script sources to `self`, blocking inline scripts and external script injection.
- `X-Content-Type-Options: nosniff` prevents MIME-type sniffing of JSON files.
- The dashboard is fully read-only — no forms, no user input, no POST endpoints.
- Cloudflare Worker blocks all non-GET/HEAD/OPTIONS methods.
- CI: TypeScript strict mode + ESLint `recommended-type-checked` catch type errors and common anti-patterns.

**Recommended future control:** A SAST scanner in CI would automatically flag `dangerouslySetInnerHTML`, `eval()`, `document.write`, `subprocess.call(shell=True)`, and similar unsafe output patterns if the AI introduces them in future changes — turning a point-in-time observation into automated enforcement.

See `docs/security.md` → HTTP Security Headers, CI/CD Workflows.

---

## LLM06: Excessive Agency

**Status: Mitigated**

Claude Code can execute shell commands, modify files, and commit to git. Without
constraints, the agent could run `terraform apply` against live infrastructure,
push to main, install arbitrary packages, or modify CI workflows to remove
security checks.

**Controls in place:**

- Sandbox enabled with `autoAllowBashIfSandboxed: false` — every bash command requires explicit user approval at runtime.
- Only `prowler/run_scan.sh` has pre-approved edit permissions. All other file modifications require approval.
- Make commands are restricted to `--dry-run` variants only (`make --dry-run before`, `make --dry-run scan`, etc.).
- Network access limited to `api.github.com` — cannot reach cloud provider APIs, package registries, or arbitrary endpoints.
- Git permissions limited to `git add *` and `git commit -m *` — `git push` is not auto-allowed.
- Deployment (`make deploy`) is not in the auto-allow list and requires human approval.
- `run_scan.sh` guards require committed code and green CI before executing scans.

See `docs/security.md` → AI Development Sandbox.

---

## LLM07: System Prompt Leakage

**Status: Accepted risk**

`CLAUDE.md` functions as the system prompt for Claude Code sessions in this
project. It contains the full repository structure, Makefile targets, Terraform
variable names, Prowler check IDs, and GCP Secret Manager secret names. If this
content were leaked, an attacker would learn the project's operational workflow
and the exact names of secrets stored in Secret Manager.

**Why this is accepted:**

- `CLAUDE.md` is committed to the public repository — it is public by design. This is a portfolio project; transparency is the point.
- Secret names (e.g., `prowler-aws-access-key-id`) are names, not values. Knowing the name does not provide access without GCP IAM permissions and `gcloud auth` ADC.
- `.claude/settings.local.json` — which contains the sandbox permissions and auto-allow rules — is gitignored and not published. The operational constraints on the agent are not exposed.
- No real credentials, keys, tokens, or account IDs appear in `CLAUDE.md`.

---

## LLM08: Vector and Embedding Weaknesses

**Status: Does not apply**

This risk concerns applications that use vector databases and embeddings for
retrieval-augmented generation (RAG). This project does not use any vector
database, embedding store, or RAG pipeline. There is no semantic search over code
or documents. Claude Code's built-in codebase indexing is managed by Anthropic's
infrastructure and is outside the project's control surface.

---

## LLM09: Misinformation

**Status: Mitigated**

Claude Code could generate code that appears correct but contains subtle logical
errors — a Terraform security group rule that looks restrictive but actually
allows all traffic, a redaction regex that misses an edge case, a CSP header with
an overly permissive directive, or documentation claims that are inaccurate.

**Controls in place:**

- 11 CI checks run on every push and PR, including type checking, linting, security scanning (Bandit, Trivy, Gitleaks), and build verification.
- The Prowler before/after scan pattern is an integration test of the IaC: `make before` misconfigures 15 checks, `make scan` verifies all 15 fire, `make after` hardens them, `make rescan` verifies zero findings. If the Terraform is wrong, Prowler catches it.
- `run_scan.sh` guards require green CI before scanning, creating a dependency chain: code quality → infrastructure state → scan results.
- OWASP ZAP baseline scan validates that deployed security headers and Worker rules behave as documented (run manually).
- Human reviews all commits — single-developer project with no auto-merge.
- Zod schema validation catches malformed data at runtime, preventing silently corrupt findings from rendering.

See `docs/security.md` → CI/CD Workflows, DAST.

---

## LLM10: Unbounded Consumption

**Status: Mitigated**

On the development side, Claude Code could generate unbounded output, run
long-running commands, or create files that exhaust disk space. On the deployed
application side, the dashboard could be targeted for cost-based attacks against
Cloud Run.

**Controls in place — development side:**

- Sandbox limits and `autoAllowBashIfSandboxed: false` prevent runaway commands.
- Make commands restricted to `--dry-run` — the agent cannot trigger real infrastructure operations that consume cloud resources.

**Controls in place — deployed side:**

- Cloudflare CDN caches static assets at the edge, absorbing repeated requests before they reach the origin.
- Cloudflare DDoS protection and Bot Fight Mode limit volumetric attacks.
- Cloudflare Worker blocks oversized headers (rule 6) and oversized URLs (rule 4), preventing resource exhaustion via request inflation.
- Cloud Run scales to zero when idle — no baseline cost.
- No backend API, no database, no per-request LLM cost — the entire application is static files served from a container. The only variable cost is Cloud Run instances.

See `docs/security.md` → Infrastructure Security, CI/CD Workflows.
