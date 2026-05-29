# OWASP Top 10 CI/CD Security Risks

This project's CI/CD pipeline comprises 11 GitHub Actions workflows that lint, validate, and scan on every push and PR; a manual `make deploy` from WSL2 that builds and pushes the dashboard container to GCP Artifact Registry; and a Cloudflare Worker deployed from GitHub via wrangler. Infrastructure across AWS, GCP, and Azure is managed with Terraform, and all cloud credentials live in GCP Secret Manager. Mapped against the OWASP Top 10 CI/CD Security Risks: **seven categories are mitigated and three carry documented residual risk** (R01: no programmatic gate between CI status and `make deploy`; R02: no image signing or provenance attestation; R03: no CI failure alerting or deploy audit trail). Each risk is detailed below with controls in place and improvement opportunities; the **residual risk register** at the end consolidates the three open items with proposed treatments.

## Status at a glance

| # | Category | Status | Why |
|---|---|---|---|
| CICD-SEC-1 | Insufficient Flow Control Mechanisms | 🟡 Partially mitigated | CI is advisory (**R01**); single-dev review + manual deploy is the compensating gate |
| CICD-SEC-2 | Inadequate Identity and Access Management | 🟢 Mitigated | Minimal `permissions:` blocks; `persist-credentials: false`; no shared CI service accounts |
| CICD-SEC-3 | Dependency Chain Abuse | 🟢 Mitigated | All Actions and base images SHA-pinned; Dependabot weekly; zero Python 3rd-party — **highest-relevance risk for this project** |
| CICD-SEC-4 | Poisoned Pipeline Execution (PPE) | 🟢 Mitigated | Single-dev (no fork PRs); Zizmor audit; `contents: read`; no `pull_request_target` |
| CICD-SEC-5 | Insufficient PBAC | 🟢 Mitigated | CI has zero cloud credentials; deploy is manual and local-only |
| CICD-SEC-6 | Insufficient Credential Hygiene | 🟢 Mitigated | All creds in GCP Secret Manager; Gitleaks pre-commit + CI; `trap cleanup EXIT` in scan pipeline |
| CICD-SEC-7 | Insecure System Configuration | 🟢 Mitigated | GitHub-hosted runners only (ephemeral, patched); no self-hosted runners |
| CICD-SEC-8 | Ungoverned Usage of Third-Party Services | 🟢 Mitigated | All Actions SHA-pinned; Dependabot weekly; Zizmor audit |
| CICD-SEC-9 | Improper Artifact Integrity Validation | 🟡 Partially mitigated | Build inputs SHA-pinned; build + deploy on same machine; **R02**: no image signing or provenance |
| CICD-SEC-10 | Insufficient Logging and Visibility | 🟡 Partially mitigated | GH run history + SARIF in Security tab; **R03**: no CI failure alerts, no deploy audit log |

---

## CICD-SEC-1: Insufficient Flow Control Mechanisms

**Status:** 🟡 Partially mitigated

Flow control mechanisms prevent code from reaching production without passing required gates. This project's 12 CI workflows are advisory — nothing programmatically blocks `make deploy` if they fail. Branch protection rules are not enforced, and there are no GitHub Environment protection rules on Cloud Run deployment.

**Controls in place:**

- 12 CI workflows run on every push and PR — TypeScript strict, ESLint, Bandit, Semgrep, Trivy, shellcheck, secret scan, hardcoded config check, dependency review, Zizmor, Docker build, Terraform validate.
- `run_scan.sh` guards require committed code and green CI before scans execute.
- Single developer reviews all commits — no auto-merge.
- Deployment is manual (`make deploy` from WSL2, never triggered by CI).
- Session start checklist in `CLAUDE.md` requires checking CI status before any work.

**Improvement opportunities:**

- Add a CI status check in the `make deploy` target — query `gh run list` and abort if the latest run on `main` failed.
- Enable GitHub branch protection on `main` requiring status checks to pass before merge.
- Add a pre-deploy verification step that validates both findings JSON files exist and pass Zod schema validation.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain).

---

## CICD-SEC-2: Inadequate Identity and Access Management

**Status:** 🟢 Mitigated

Single-developer project with no shared credentials. GitHub account security (2FA) is the primary identity control. CI workflows use minimal permissions.

**Controls in place:**

- All workflows declare explicit `permissions:` blocks with minimal scope — `contents: read` in most cases, `security-events: write` only where SARIF uploads require it.
- `persist-credentials: false` on all checkout actions — prevents the `GITHUB_TOKEN` from persisting in the git config.
- All cloud credentials stored in GCP Secret Manager, not GitHub Secrets.
- No shared CI service accounts or tokens beyond the automatically provisioned `GITHUB_TOKEN`.
- `GITHUB_TOKEN` used only in Gitleaks with read-only scope.

**Improvement opportunities:**

- Document the GitHub account's 2FA status and review personal access token scopes.
- Audit which GitHub Apps have repository access (if any).

See `docs/security.md` → Pillar 1 (Credential & Secrets Hygiene).

---

## CICD-SEC-3: Dependency Chain Abuse

**Status:** 🟢 Mitigated

This is the most relevant CI/CD risk for this project. The pipeline consumes npm packages (dashboard), GitHub Actions (12 workflows), Docker base images, and Terraform providers. A compromised dependency could execute during `npm ci`, `docker build`, or workflow steps.

**Controls in place:**

- All GitHub Actions pinned to exact commit SHAs — not mutable version tags.
- Docker base images pinned to SHA digests in `dashboard/Dockerfile`.
- Dependabot opens automated PRs weekly for outdated npm, pip, and GitHub Actions dependencies.
- CI: `dependency-review.yml` scans npm and pip dependency changes for known vulnerabilities on every PR.
- CI: `zizmor.yml` audits GitHub Actions workflows for supply chain risks.
- Python ingest uses only the standard library (zero third-party dependencies).
- `CLAUDE.md` hard rule: do not add npm packages, pip packages, or Terraform providers not already in the stack.
- `npm ci` used in CI and Docker build — respects `package-lock.json` exactly, rejects unexpected mutations.

**Improvement opportunities:**

- Add `npm audit` to the `frontend-ci.yml` workflow to check installed packages against known vulnerabilities.
- Consider adding `--ignore-scripts` to `npm ci` in CI to prevent lifecycle script execution during build.
- Add container image scanning (Trivy) on the built Docker image, not just IaC — acknowledged in `docs/threat-model.md` as not yet implemented.
- Consider generating an SBOM (Software Bill of Materials) during Docker build.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain). See `docs/owasp-top10.md` → A03 (Software Supply Chain Failures).

---

## CICD-SEC-4: Poisoned Pipeline Execution (PPE)

**Status:** 🟢 Mitigated

PPE occurs when an attacker modifies CI pipeline definitions or injects code into files consumed by pipelines to gain code execution in the CI environment. Three variants exist: Direct PPE (modify workflow files), Indirect PPE (modify files consumed by pipelines such as `Makefile` or `package.json`), and Public PPE (via fork PRs from untrusted contributors).

**Controls in place:**

- Single developer controls all commits — no external contributors, no fork PRs from untrusted sources.
- CI: `zizmor.yml` audits workflows for injection vulnerabilities (e.g., unsanitized `${{ github.event.*.body }}` in shell commands).
- All workflows use `contents: read` permissions — cannot modify the repository from within CI.
- `persist-credentials: false` prevents git credential leakage from checkout steps.
- No `pull_request_target` triggers, which would run with write permissions on fork PRs.
- No `workflow_dispatch` with user-controlled inputs that could inject into shell commands.

**Improvement opportunities:**

- If the repository becomes public, add a `CODEOWNERS` file requiring approval for `.github/workflows/` changes.
- If the repository becomes public, avoid `pull_request_target` triggers or ensure they do not check out the PR's head ref.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain).

---

## CICD-SEC-5: Insufficient PBAC (Pipeline-Based Access Controls)

**Status:** 🟢 Mitigated

PBAC controls limit what resources and environments a pipeline can access. In this project, CI workflows are strictly read-only — they lint, validate, and scan but never deploy, never access cloud credentials, and never modify infrastructure. Deployment happens exclusively from WSL2 via `make deploy`.

**Controls in place:**

- CI workflows have zero access to cloud credentials — all secrets are in GCP Secret Manager and accessed only from WSL2.
- No GitHub Secrets configured for cloud provider access.
- No deployment workflows — `make deploy` is manual and local-only.
- Workflow permissions are minimal: `contents: read` and `security-events: write` (only for SARIF uploads).
- CI cannot trigger `terraform apply`, `make deploy`, or any infrastructure mutation.

**Improvement opportunities:**

- Document this separation explicitly in `docs/security.md` — CI has no deployment capability by design.
- If deployment is ever automated in CI, use GitHub Environments with required reviewers and OIDC workload identity federation (not long-lived access keys).

See `docs/security.md` → Pillar 1 (Credential & Secrets Hygiene).

---

## CICD-SEC-6: Insufficient Credential Hygiene

**Status:** 🟢 Mitigated

Credentials are not stored in the CI system at all. All cloud credentials live in GCP Secret Manager and are fetched at runtime only from WSL2. The only credential present in CI is `GITHUB_TOKEN`, which is automatically provisioned, scoped to the repository, and short-lived.

**Controls in place:**

- Zero cloud credentials stored in GitHub Secrets.
- CI: `secret-scan.yml` (Gitleaks) runs on every push and PR to catch accidental credential commits.
- CI: `hardcoded-config-check.yml` catches cloud account IDs, resource IDs, and hardcoded regions.
- Pre-commit Gitleaks hook catches secrets before they leave the developer's machine.
- `run_scan.sh` uses `trap cleanup EXIT` to unset credential environment variables on exit.
- `CLAUDE.md` hard rules prohibit credentials in any file tracked by git.

**Improvement opportunities:**

- Document a credential rotation schedule (when cloud provider keys were last rotated).
- Consider migrating from long-lived access keys to short-lived credentials via OIDC workload identity federation for AWS and Azure.

See `docs/security.md` → Pillar 1 (Credential & Secrets Hygiene).

---

## CICD-SEC-7: Insecure System Configuration

**Status:** 🟢 Mitigated

The project uses GitHub-hosted runners exclusively. These are managed by GitHub, automatically patched, and ephemeral — each job runs on a fresh virtual machine that is destroyed after the workflow completes. No self-hosted runners exist.

**Controls in place:**

- GitHub-hosted runners only (`runs-on: ubuntu-latest`) — no persistent attack surface.
- No self-hosted runners to misconfigure, patch, or secure.
- All workflows pin specific action versions by commit SHA.
- `persist-credentials: false` on all checkout actions.
- No caching of sensitive data in CI.
- No Docker-in-Docker or privileged container execution in CI.

**Improvement opportunities:**

- Pin `runs-on: ubuntu-24.04` instead of `ubuntu-latest` for build reproducibility.
- Enable GitHub's secret scanning push protection at the repository level.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain).

---

## CICD-SEC-8: Ungoverned Usage of Third-Party Services

**Status:** 🟢 Mitigated

The project integrates several third-party GitHub Actions and uses Cloudflare for edge deployment. Each action is pinned to a specific commit SHA, and Dependabot proposes updates when new versions are available.

**Controls in place:**

- All GitHub Actions pinned to exact commit SHAs:
  - GitHub official: `actions/checkout`, `actions/setup-node`, `actions/setup-python`, `actions/dependency-review-action`, `github/codeql-action`
  - Vendor official: `hashicorp/setup-terraform`, `aquasecurity/trivy-action`
  - Security-focused: `zizmorcore/zizmor-action`, `zricethezav/gitleaks-action`
  - Community: `ludeeus/action-shellcheck`
- Dependabot monitors and proposes updates for all GitHub Actions weekly.
- CI: `zizmor.yml` audits workflows for third-party action risks.
- Cloudflare Worker deployed via `wrangler.toml` — Cloudflare pulls source from GitHub, no CI-driven push.

**Improvement opportunities:**

- Maintain an inventory of all third-party actions with their purposes and last review date.
- Consider forking critical third-party actions into the org to eliminate upstream supply chain risk.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain).

---

## CICD-SEC-9: Improper Artifact Integrity Validation

**Status:** 🟡 Partially mitigated

Docker images are pushed to GCP Artifact Registry without signing or provenance attestation. No verification exists that the deployed image matches what CI validated. However, build and deploy happen on the same machine in the same `make deploy` invocation, so no artifact transits an untrusted network.

**Controls in place:**

- Docker base images pinned to SHA digests — integrity of build inputs is guaranteed.
- `npm ci` respects `package-lock.json` — integrity of npm dependencies during build.
- `make deploy` verifies both findings JSON files exist before building.
- GCP Artifact Registry is private — not publicly writable.
- Build and deploy happen on the same machine in the same command — no artifact handoff between systems.

**Residual risk (R02):** see Residual risk register.

**Improvement opportunities:**

- Sign images with cosign before pushing to Artifact Registry.
- Add image digest verification after push — compare local digest to registry digest.
- Generate and attach SLSA provenance attestations to Docker images.
- Log the image digest in deploy output for an audit trail.

See `docs/threat-model.md` → Appendix B (container image scanning listed as intentional scope exclusion).

---

## CICD-SEC-10: Insufficient Logging and Visibility

**Status:** 🟡 Partially mitigated

GitHub Actions retains run logs, and Trivy uploads SARIF results to the GitHub Security tab. However, there is no alerting on CI failures, no centralized view of security findings across workflows, and no audit trail for `make deploy` operations from WSL2.

**Controls in place:**

- GitHub Actions run history retained and visible in the repository.
- SARIF uploads from Trivy visible in the GitHub Security tab.
- Session start checklist in `CLAUDE.md` requires checking `gh run list` for failures at the start of every session.
- 11 independent workflows provide broad coverage — a failure in one does not silence the others.

**Residual risk (R03):** see Residual risk register.

**Improvement opportunities:**

- Set up GitHub Actions failure notifications via email or a webhook on workflow failure.
- Add a deploy log — `make deploy` appends timestamp, image digest, and git SHA to a local log file.
- Consider GitHub's audit log API for tracking repository setting changes.
- Aggregate SARIF findings from all security workflows into a single view.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain). See `docs/owasp-top10.md` → A09 (Security Logging and Alerting Failures).

---

## Residual risk register

| ID | Category | Risk | Status | Treatment / compensating control |
|---|---|---|---|---|
| **R01** | CICD-SEC-1 Insufficient Flow Control Mechanisms | `make deploy` is not programmatically blocked by failing CI; no GitHub branch protection on `main` requiring status checks | Partial mitigation | **Compensating controls:** single-developer review on every commit; manual deploy from WSL2; session-start checklist in `CLAUDE.md` requiring `gh run list` before any work. **Treatment:** add CI-status check inside `make deploy` (abort if the latest run on `main` failed); enable branch protection on `main` requiring all checks to pass before merge. |
| **R02** | CICD-SEC-9 Improper Artifact Integrity Validation | Docker images pushed to GCP Artifact Registry without signing or SLSA provenance attestation; no verification that the deployed image matches what CI validated | Partial mitigation | **Compensating controls:** build inputs SHA-pinned (Docker base, npm via `package-lock.json`); build and deploy happen on the same machine in the same command (no untrusted artifact handoff); Artifact Registry is private. **Treatment:** sign images with cosign before push; generate and attach SLSA provenance; log image digest in deploy output for an audit trail. |
| **R03** | CICD-SEC-10 Insufficient Logging and Visibility | No alerting on CI failures; no audit trail for `make deploy` operations from WSL2; no aggregated view of SARIF findings across workflows | Partial mitigation | **Compensating controls:** 11 independent workflows + GitHub run history + SARIF in Security tab; session-start checklist requires `gh run list` check. **Treatment:** add failure-notification webhook on workflow failure; `make deploy` appends timestamp + image digest + git SHA to a local log file; aggregate SARIF findings into a single view. |
