# OWASP GenAI Security Frameworks

This project was built with Claude Code, an AI coding agent. The LLM is the *development tool*, not a feature in the application — the deployed dashboard does not call any model and contains no AI runtime surface. This document maps two additional OWASP GenAI frameworks to this project's development workflow; the OWASP Top 10 for LLM Applications is covered separately in `docs/owasp-llm.md`.

**Part 1** (OWASP Top 10 for Agentic Applications, 2026): **6 mitigated · 1 not applicable · 2 partially mitigated (R01, R02) · 1 accepted (R03).**

**Part 2** (LLM AI Cybersecurity & Governance Checklist v1.1): **5 mitigated · 4 not applicable · 4 adapted to single-developer scale.** The four "partially applicable" governance items are *scaling adaptations* (the requirement only partially fits a one-person project), not control gaps, so they do not appear in the residual risk register.

Three open residual risks across both frameworks, consolidated in the **residual risk register** at the end:
- **R01** — agent goal hijack (blast radius contained; model-level vector cannot be eliminated; same residual as `owasp-llm.md` → R01)
- **R02** — initial AI-driven dependency selection has no typosquat detection (same residual as `owasp-llm.md` → R02)
- **R03** — human-agent trust: single-developer judgment cannot be technically enforced

---

# Part 1: OWASP Top 10 for Agentic Applications (2026)

The OWASP Top 10 for Agentic Applications identifies the most critical security risks facing autonomous AI agents. Claude Code operates as an agent in this project — it plans, decides, and acts across tools and files.

## Status at a glance — Part 1

| # | Category | Status | Why |
|---|---|---|---|
| ASI01 | Agent Goal Hijack | 🟡 Partially mitigated | **R01**: blast radius contained (sandbox approval, network allowlist, `--dry-run` makes) — model-level injection vector cannot be fully prevented |
| ASI02 | Tool Misuse & Exploitation | 🟢 Mitigated | Per-command sandbox approval; only `run_scan.sh` pre-approved for edits; `git push` not auto-allowed |
| ASI03 | Identity & Privilege Abuse | 🟢 Mitigated | Sandbox network restriction blocks all cloud provider APIs even though developer ADC is configured on the machine |
| ASI04 | Agentic Supply Chain Compromise | 🟡 Partially mitigated | **R02**: AI-fabricated typosquat in initial dep selection has no specific detection (same residual as LLM03) |
| ASI05 | Unexpected Code Execution | 🟢 Mitigated | Sandbox approval gate; 11 CI workflows validate committed code; no `eval` / `innerHTML` / `subprocess` in codebase |
| ASI06 | Memory & Context Poisoning | 🟢 Mitigated | Auto-memory writes are per-call user-visible (Write tool calls); memory files gitignored and outside the repo PR surface; CLAUDE.md changes visible in `git diff` |
| ASI07 | Insecure Inter-Agent Communication | ⚪ Does not apply | Single agent in single session; no inter-agent messaging or orchestration |
| ASI08 | Cascading Agent Failures | 🟢 Mitigated | Multiple gates break cascades: `--dry-run`; CI required before scans; Zod runtime validation; no auto-merge, no auto-deploy |
| ASI09 | Human–Agent Trust Exploitation | 🟡 Accepted risk | **R03**: single-developer judgment; sandbox prompts create friction but cannot enforce critical thinking |
| ASI10 | Rogue Agents | 🟢 Mitigated | Per-command approval makes goal drift visible in real time; CI catches rogue changes |

---

## ASI01: Agent Goal Hijack

**Status:** 🟡 Partially mitigated

Attackers could manipulate Claude Code's goals by embedding adversarial instructions in files the agent reads — a crafted comment in a dependency README, a malicious resource name in Prowler output, or hidden instructions in a PR description. If successful, the agent could be redirected to remove CI checks, weaken Terraform security rules, or add unauthorized dependencies. Goal hijack is fundamentally a model-level vulnerability that wrapper controls cannot eliminate; the controls below contain the *blast radius* of a successful hijack rather than prevent the vector itself.

**Controls in place:**

- `CLAUDE.md` hard rules constrain the agent's behavior regardless of file content — no credentials, no hardcoded IDs, no new packages, no schema changes.
- Sandbox settings (`autoAllowBashIfSandboxed: false`) require explicit user approval for every shell command, preventing injected instructions from silently executing.
- Make commands are restricted to `--dry-run` variants only.
- Network access is limited to `api.github.com` — the agent cannot fetch attacker-controlled payloads.

**Residual risk (R01):** see Residual risk register.

See `docs/owasp-llm.md` → LLM01 (Prompt Injection) for the LLM-specific perspective on the same attack vector.

---

## ASI02: Tool Misuse & Exploitation

**Status:** 🟢 Mitigated

Claude Code has access to bash, file editing, and git. Unsafe tool composition — chaining `git add . && git push` in one command, recursive file deletions, resource-exhausting loops, or running `terraform apply` directly — could cause damage if allowed to execute without oversight.

**Controls in place:**

- Sandbox enabled with `autoAllowBashIfSandboxed: false` — every command requires human approval.
- Only `prowler/run_scan.sh` has pre-approved edit permission; all other file modifications require approval.
- Make targets restricted to `--dry-run` only — the agent cannot trigger real infrastructure operations.
- `git push` is not in the auto-allow list.
- Network restricted to `api.github.com` — cannot reach cloud provider APIs or package registries.

See `docs/owasp-llm.md` → LLM06 (Excessive Agency) for the full control list. See `docs/security.md` → Pillar 5 (AI Development Guardrails).

---

## ASI03: Identity & Privilege Abuse

**Status:** 🟢 Mitigated

Claude Code runs with the developer's filesystem permissions and could theoretically invoke `gcloud`, AWS CLI, or Azure CLI under the human's identity. Delegated authority means the agent could access Secret Manager, modify infrastructure, or push code — all operations the human can perform.

**Controls in place:**

- Sandbox network restriction blocks all cloud provider API endpoints — the agent cannot reach AWS, GCP, or Azure APIs even though `gcloud auth` ADC is configured on the machine.
- Make commands restricted to `--dry-run` — no `terraform apply`, no `make deploy`.
- `git push` not auto-allowed.
- `run_scan.sh` guards require committed code and green CI before scans execute.
- Credentials are in Secret Manager, not on disk — but the network restriction is the primary barrier.

The network restriction is the critical control here. The agent runs under the user's identity but cannot reach any endpoint where that identity has privileges.

---

## ASI04: Agentic Supply Chain Compromise

**Status:** 🟡 Partially mitigated

Claude Code dynamically trusts MCP tool schemas, reads dependency manifests, and could be influenced by compromised external tool definitions. If a MCP server returned malicious tool schemas, or if a dependency's metadata contained adversarial instructions, the agent's behavior could be manipulated through the supply chain. Going forward, the hard rule + per-command approval gate on `npm install` controls *future* additions; the residual is in the *initial selection* — every dep was AI-chosen, and a typosquat already in `package-lock.json` that has not yet been flagged in any vulnerability database has no current detection.

**Controls in place:**

- `CLAUDE.md` hard rule: do not add npm packages, pip packages, or Terraform providers not already in the stack.
- `autoAllowBashIfSandboxed: false` — `npm install` requires explicit user approval.
- MCP servers in `.claude/settings.local.json` are explicitly configured, not dynamically discovered.
- Python ingest uses only the standard library (zero third-party dependencies).

**Residual risk (R02):** see Residual risk register.

See `docs/owasp-llm.md` → LLM03 (Supply Chain Vulnerabilities) for the full supply chain defence inventory including CI workflows, Dependabot, SHA-pinned actions, and Docker digest pinning.

---

## ASI05: Unexpected Code Execution

**Status:** 🟢 Mitigated

Claude Code generates TypeScript, Python, HCL, and shell code, and can execute generated code via bash. Agent-generated code that runs without validation could introduce vulnerabilities — a shell command with injection, a Python script with `eval()`, Terraform that opens security groups wider than intended, or a Vite config that disables security features.

**Controls in place:**

- `autoAllowBashIfSandboxed: false` — generated code cannot execute without human approval at the command level.
- 11 CI workflows validate all committed code: TypeScript strict mode, ESLint type-checked, Bandit (Python), Trivy (IaC), shellcheck (bash), secret scan, hardcoded config check.
- Prowler before/after scan pattern serves as an integration test — if the Terraform is wrong, Prowler catches it.
- Make commands restricted to `--dry-run`.
- No `eval()`, `subprocess.call(shell=True)`, `dangerouslySetInnerHTML`, or `os.system` in the codebase.

See `docs/owasp-llm.md` → LLM05 (Improper Output Handling) for the output-handling perspective.

---

## ASI06: Memory & Context Poisoning

**Status:** 🟢 Mitigated

Claude Code's session context is built from `CLAUDE.md`, file reads at session start, and auto-memory entries from `~/.claude/projects/<project-hash>/memory/`. If an attacker modified `CLAUDE.md` via a malicious PR — removing hard rules, changing the schema definition, or altering the session start checklist — the agent's future reasoning would be poisoned. Auto-memory entries persist across sessions and could similarly influence future reasoning if an attacker persuaded the agent (via prompt injection) to write malicious facts. Trojan comments in source code or modified workflow files could also manipulate within-session behavior.

**Controls in place:**

- `CLAUDE.md` is committed to git — all changes are visible in `git diff` and tracked in commit history.
- Auto-memory writes happen through explicit `Write` tool calls, visible to the user at the time of write — no silent memory updates.
- Auto-memory files live in `~/.claude/projects/<project-hash>/memory/` — outside the project directory, gitignored from the repo (no PR vector), under the user's exclusive filesystem control.
- Human reviews all commits (single-developer project, no auto-merge).
- CI runs on every push and PR — modifications to any file in the repo trigger the full pipeline.
- `.claude/settings.local.json` is gitignored — sandbox config cannot be modified via PR or external contribution.

Auto-memory writes are per-call user-visible rather than silent, and memory files are outside the repo's PR surface — the cross-session poisoning vector is bounded to what an attacker could persuade the agent to write under direct user observation.

---

## ASI07: Insecure Inter-Agent Communication

**Status:** ⚪ Does not apply

This risk concerns multi-agent architectures with agent-to-agent messaging, delegation, or orchestration. This project uses a single Claude Code agent operating in a single session at a time. There are no inter-agent messages, no agent orchestration layers, and no agent-to-agent delegation.

MCP tool servers could be considered adjacent components, but they are explicitly configured in `.claude/settings.local.json` (not dynamically discovered), and the sandbox network restriction limits which servers the agent can reach.

---

## ASI08: Cascading Agent Failures

**Status:** 🟢 Mitigated

A small agent error could propagate through connected systems. A wrong Terraform variable name might pass `terraform validate` but cause the wrong resource to be misconfigured during a scan. A broken `ingest_prowler.py` change could produce corrupt JSON that the dashboard renders as misleading security data. A typo in a CI workflow could silently disable a security check.

**Controls in place:**

- Make commands restricted to `--dry-run` — the agent cannot trigger real infrastructure changes that would cascade.
- `run_scan.sh` guards require committed code and green CI before scanning, creating a dependency chain that blocks downstream effects of upstream errors.
- Zod schema validation rejects malformed findings at runtime — corrupt data does not render silently.
- 11 CI checks validate code at multiple layers (type safety, lint, security, build).
- Human reviews all commits before they reach main.
- No auto-merge, no auto-deploy — human gates break the cascade.

---

## ASI09: Human–Agent Trust Exploitation

**Status:** 🟡 Accepted risk

Claude Code produces persuasive, well-formatted explanations with high confidence. A single developer could over-rely on the agent — approving a security-relevant bash command without reading it carefully, accepting a "this change is safe" explanation for a risky modification, rubber-stamping a commit because the agent described it convincingly, or trusting the agent's claim that a CI check is unnecessary.

**Controls that reduce but do not eliminate:**

- `autoAllowBashIfSandboxed: false` forces a deliberate approval decision on every command, creating friction that demands attention.
- `git push` not auto-allowed — a separate approval gate.
- 11 CI checks provide independent validation (the human does not have to catch everything alone).
- Session start checklist forces the developer to check CI status before proceeding.

**Residual risk (R03):** see Residual risk register.

---

## ASI10: Rogue Agents

**Status:** 🟢 Mitigated

Claude Code could drift from its intended objectives — pursuing "improvements" beyond what was requested, refactoring code that should remain stable, modifying CI workflows to reduce the security checks that constrain it, or adding dependencies despite the hard rule prohibiting it.

**Controls in place:**

- `CLAUDE.md` hard rules define explicit boundaries the agent is instructed to follow.
- `autoAllowBashIfSandboxed: false` — every action requires human approval, making goal drift visible in real time.
- Only `prowler/run_scan.sh` has pre-approved edit permission — all other file modifications require explicit approval.
- `git push` not auto-allowed.
- CI validates that rogue changes are caught: type errors, lint failures, security scan findings, hardcoded config detection.

See `docs/security.md` → Pillar 5 (AI Development Guardrails).

---

# Part 2: LLM AI Cybersecurity & Governance Checklist v1.1

The OWASP LLM AI Cybersecurity & Governance Checklist is designed for organizations deploying LLM solutions. This project is a single-developer portfolio project — several governance items (Legal, Regulatory, Business Cases) do not apply at this scale; four items are *adapted to single-developer scale* with documented individual-scale equivalents. Each includes an explanation of how.

## Status at a glance — Part 2

| # | Category | Status | Why |
|---|---|---|---|
| GOV01 | Adversarial Risk | 🟢 Mitigated | Threat model + LLM Top 10 mapping + Agentic Top 10 mapping all in place |
| GOV02 | Threat Modeling | 🟢 Mitigated | `docs/threat-model.md` created before deployment; covers infrastructure + AI workflow |
| GOV03 | AI Asset Inventory | 🟢 Mitigated | Single AI tool (Claude Code) documented in CLAUDE.md; tech stack enumerated; deps tracked |
| GOV04 | AI Security and Privacy Training | 🟡 Adapted to single-dev scale | No team to train; documentation suite (owasp-llm, security, threat-model, this doc) serves as the equivalent |
| GOV05 | Establish Business Cases | ⚪ Does not apply | Portfolio project — no business case, ROI, or risk-benefit analysis |
| GOV06 | Governance | 🟡 Adapted to single-dev scale | No corporate governance; CLAUDE.md + sandbox + CI + doc suite are the individual-scale equivalents |
| GOV07 | Legal | ⚪ Does not apply | No IT/legal partnerships; no DPAs; no end-user ToS (no accounts) |
| GOV08 | Regulatory | ⚪ Does not apply | No regulated data; demo accounts; no PII/PHI/financial; no SOC 2/HIPAA/GDPR applicability |
| GOV09 | Using or Implementing LLM Solutions | 🟢 Mitigated | Sandbox enforces FS/network/command restrictions; secrets in Secret Manager; 11 CI workflows |
| GOV10 | TEVV | 🟢 Mitigated | 11 CI workflows (T); ZAP scan (E); human review + CI gates (V); Prowler before/after + Zod (V) |
| GOV11 | Model and Risk Cards | 🟡 Adapted to single-dev scale | No model training; CLAUDE.md = operational model card; owasp-llm + this doc = risk card |
| GOV12 | RAG: LLM Optimization | ⚪ Does not apply | No RAG pipeline, vector DB, or embedding store |
| GOV13 | AI Red Teaming | 🟡 Adapted to single-dev scale | Cannot red-team Claude itself (third-party service); Prowler before/after is effective IaC red-teaming |

---

## GOV01: Adversarial Risk

**Status:** 🟢 Mitigated

Evaluate threats from adversaries targeting the AI-assisted development workflow and assess how existing controls may fail against GenAI-specific attacks.

**Controls in place:**

- `docs/threat-model.md` documents all threat scenarios including supply chain and repository compromise.
- `docs/owasp-llm.md` maps all 10 OWASP LLM risks with controls.
- This document (Part 1) maps all 10 OWASP agentic risks with controls.
- Layered defence: sandbox + hard rules + 11 CI workflows + human review.

See `docs/threat-model.md`, `docs/owasp-llm.md`.

---

## GOV02: Threat Modeling

**Status:** 🟢 Mitigated

Conduct threat modeling before deploying LLMs to identify and mitigate risks.

**Controls in place:**

- `docs/threat-model.md` covers: scan window risk (15 misconfigurations across 3 providers), running dashboard risk (attack scenarios with mitigations), Cloudflare Worker rules (8 rules), HTTP security headers, and credential compromise response procedure.
- The threat model was created before the dashboard was deployed and covers both infrastructure and AI development workflow.

See `docs/threat-model.md`.

---

## GOV03: AI Asset Inventory

**Status:** 🟢 Mitigated

Catalog all AI solutions, tools, and components including AI in software bills of materials.

**Controls in place:**

- Single AI tool: Claude Code by Anthropic — documented in `CLAUDE.md` header and `docs/security.md` → Pillar 5 (AI Development Guardrails).
- No AI features in the deployed application.
- Tech stack fully enumerated in `CLAUDE.md` → Tech Stack with exact versions and constraints.
- All dependencies tracked in `package.json` and Terraform lock files.
- CI: `dependency-review.yml` and Dependabot provide ongoing dependency tracking.

**Improvement opportunities:**

- Add SBOM generation (Syft or Trivy SBOM mode) to CI for a machine-readable component inventory.

---

## GOV04: AI Security and Privacy Training

**Status:** 🟡 Adapted to single-dev scale

Single-developer project — there is no team to train and no awareness program to update. However, the documentation suite serves as the equivalent of training material: `docs/owasp-llm.md`, `docs/security.md`, `docs/threat-model.md`, and this document collectively document GenAI threats and the controls in place. Creating and maintaining these documents is the single-developer equivalent of a security awareness program.

---

## GOV05: Establish Business Cases

**Status:** ⚪ Does not apply

This is a portfolio project built to showcase DevSecOps skills. There is no business case to establish, no ROI to calculate, and no risk-benefit analysis to perform. The purpose is educational and professional — demonstrating that a developer can build, secure, and document a multi-cloud scanning pipeline.

---

## GOV06: Governance

**Status:** 🟡 Adapted to single-dev scale

No corporate governance structure exists — no board, no AI ethics committee, no oversight body. However, the project implements governance-equivalent controls at the individual level:

- `CLAUDE.md` hard rules define what the AI agent may and may not do.
- Sandbox configuration enforces those rules technically.
- CI provides automated enforcement.
- The documentation suite (`docs/security.md`, `docs/threat-model.md`, `docs/owasp-llm.md`, this document) provides transparency and accountability.

These are the governance artifacts for a one-person project.

---

## GOV07: Legal

**Status:** ⚪ Does not apply

No IT/legal partnerships to establish. No data processing agreements required. No terms of service for end users (the dashboard is a public portfolio site with no accounts). No AI-generated content licensing concerns (all code is committed by the developer). The only relevant legal relationship is between the developer and Anthropic under Claude Code's terms of service, which is outside this project's scope.

---

## GOV08: Regulatory

**Status:** ⚪ Does not apply

No regulated data is collected, processed, or stored. No PII, no PHI, no financial records. The scan findings come from demo accounts with no real workloads and are redacted before publication. No compliance frameworks apply (no SOC 2, no HIPAA, no GDPR data processing). The dashboard has no user accounts, no authentication, and no data collection.

---

## GOV09: Using or Implementing LLM Solutions

**Status:** 🟢 Mitigated

Threat-model LLM components, ensure data protection, and verify pipeline security. Claude Code IS the LLM solution — the development pipeline is the LLM deployment.

**Controls in place:**

- Sandbox settings enforce filesystem, network, and command restrictions.
- Data protection: network restricted to `api.github.com`, credentials in Secret Manager (not on disk), `.gitignore` excludes sensitive files, `CLAUDE.md` hard rules prohibit credential exposure.
- Pipeline security: 11 CI workflows, SHA-pinned GitHub Actions, Dependabot, `run_scan.sh` guards.

See `docs/security.md` → Pillar 5 (AI Development Guardrails); Pillar 1 (Credential & Secrets Hygiene); Pillar 2 (Secure Build & Supply Chain).

---

## GOV10: TEVV (Testing, Evaluation, Verification, and Validation)

**Status:** 🟢 Mitigated

Every line of code in this project was generated by Claude Code. TEVV applies to the entire codebase — all AI-generated output must be tested, evaluated, verified, and validated.

**Controls in place:**

- **Testing**: 11 CI workflows run on every push and PR — TypeScript strict, ESLint, Bandit, Trivy, shellcheck, secret scan, hardcoded config check, dependency review, Zizmor, Docker build, Terraform validate.
- **Evaluation**: OWASP ZAP baseline scan evaluates the deployed application's security posture.
- **Verification**: Human reviews all commits; `run_scan.sh` guards require green CI before scanning.
- **Validation**: Prowler before/after scan pattern validates that IaC produces the intended security state (15 checks deliberately misconfigured, then remediated); Zod schema validation rejects malformed data at runtime.

See `docs/security.md` → Pillar 2 (Secure Build & Supply Chain); Pillar 4 (Hardened Application Surface) → DAST.

---

## GOV11: Model and Risk Cards

**Status:** 🟡 Adapted to single-dev scale

This project does not train or fine-tune a model, so a traditional model card is not applicable. However, equivalent artifacts exist:

- `CLAUDE.md` defines the working context, hard rules, and session checklist — an operational model card equivalent documenting how the AI tool is configured and constrained.
- `docs/owasp-llm.md` and this document serve as the risk card — documenting known risks, mitigations, and accepted residual risks for the AI tool in use.

---

## GOV12: RAG: LLM Optimization

**Status:** ⚪ Does not apply

No retrieval-augmented generation pipeline exists. No vector database, no embedding store, no external knowledge retrieval. Claude Code's built-in codebase indexing is managed by Anthropic's infrastructure and is outside this project's control surface.

See `docs/owasp-llm.md` → LLM08 (Vector and Embedding Weaknesses).

---

## GOV13: AI Red Teaming

**Status:** 🟡 Adapted to single-dev scale

This project cannot red-team the Claude Code model itself — it is a third-party service operated by Anthropic. However, the controls around the agent can and should be tested.

**Controls in place:**

- OWASP ZAP baseline scan tests the deployed application's security posture.
- The Prowler before/after pattern is effectively red-teaming the IaC: deliberately misconfigure 15 checks, verify Prowler detects all 15, remediate, verify zero findings.
- Sandbox settings are documented and their enforcement can be verified by attempting to bypass them.

**Improvement opportunities:**

- Create a lightweight red team checklist that attempts to make the agent bypass `CLAUDE.md` hard rules, access blocked network endpoints, execute blocked commands, or modify files outside the approved edit list. Record the results as evidence that the controls hold.

---

## Residual risk register

| ID | Category | Risk | Status | Treatment / compensating control |
|---|---|---|---|---|
| **R01** | ASI01 Agent Goal Hijack | Adversarial file content (dependency README, Prowler scan output, PR description) could influence the agent. Sandbox prevents silent shell exec, network exfil, and infrastructure mutation, but the agent could still write subtly malicious code into files, recommend bad changes under plausible justification, or shape commit text. Goal hijack is a model-level vulnerability that wrapper controls cannot fully prevent. | Partial mitigation | **Compensating controls:** Sandbox `autoAllowBashIfSandboxed: false` (per-command approval); network restricted to `api.github.com`; make targets `--dry-run` only; `git push` not auto-allowed; single-developer review on every commit; 11 CI gates catch known-bad code patterns. **Treatment:** Add a `.claudeignore` file to exclude `prowler/output/`, `node_modules/`, and `*.tfstate` from the agent's context. Same treatment as `docs/owasp-llm.md` → R01. |
| **R02** | ASI04 Agentic Supply Chain Compromise | Claude Code chose every dependency in this project. Dependency Review catches *known* CVEs; Dependabot updates *existing* deps; SHA-pinning protects Actions and Docker base images. A typosquatted npm or pip package already in `package-lock.json` from the initial AI-driven selection — that has not yet been flagged in any vulnerability database — has no current detection mechanism. | Partial mitigation | **Compensating controls:** `CLAUDE.md` hard rule blocks the agent from adding any new dep; sandbox requires explicit approval for `npm install`; all GitHub Actions and Docker base images SHA-pinned; Python ingest uses only stdlib (zero third-party). **Treatment:** Add `npm audit` to `frontend-ci.yml` and a SAST scanner (e.g., Semgrep) to CI. Same treatment as `docs/owasp-llm.md` → R02. |
| **R03** | ASI09 Human–Agent Trust Exploitation | Claude Code produces persuasive, well-formatted explanations with high confidence. A single developer could over-rely on the agent — approving security-relevant commands without scrutiny, accepting "this change is safe" explanations rubber-stamp, or trusting claims that a CI check is unnecessary. | Accepted by design | **Compensating controls:** `autoAllowBashIfSandboxed: false` forces a deliberate approval decision on every command (friction demands attention); `git push` not auto-allowed (separate gate); 11 CI checks provide independent validation; session-start checklist requires CI status check. **Treatment:** None at the technical level — the residual is the single developer's own judgment. No control can fully prevent a human from trusting an AI agent too much. Compensate via deliberate slowdown on security-sensitive approvals and periodic re-reading of CLAUDE.md hard rules. |
