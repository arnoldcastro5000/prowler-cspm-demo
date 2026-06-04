# Executive Security Assessment — prowler-cspm

**Date:** June 2026  
**Full technical register:** `docs/stride.md`

---

## Governing Finding

A structured analysis of every component in the prowler-cspm pipeline identified 135 distinct security risks. The three highest-scored findings are a deliberate consequence of publishing this project openly — a design tradeoff that is documented and accepted below. The risks requiring decisions live in the three areas that follow: the AI coding assistant operates with no containment controls, software components enter the pipeline without integrity verification, and the scan results used as compliance evidence can be altered without detection. Each of these is a confirmed, unmitigated exploit path. None requires advanced technical skill to execute.

---

## Accepted Risk: Public Portfolio Design Tradeoff

The three highest-scored risks in this analysis share a common cause: making the architecture, trust boundaries, and known security gaps of this system publicly readable. An attacker — or an automated tool — can read that documentation and construct an attack plan in seconds. This is the equivalent of publishing a building's floor plan with every unlocked door labeled.

This risk was identified, scored, and formally accepted. In a production deployment, these documents would be access-controlled, or the sensitive details would be redacted before publication. For a public proof-of-concept portfolio, the tradeoff is intentional: demonstrating the depth of the analysis requires showing the analysis. The fact that this class of risk was identified at all — including the reflexive risk of the threat model document describing itself as an attack surface — is itself evidence of methodology rigor.

| Risk | Score (1–10)¹ | Decision |
|---|---|---|
| Automated tools use published security documentation to map exploitable gaps in seconds | 8.6 | Accepted — PoC design tradeoff |
| Published threat model serves as a pre-built attack roadmap for any actor | 8.4 | Accepted — PoC design tradeoff |
| All security documentation is readable by any actor on the internet | 8.4 | Accepted — PoC design tradeoff |

¹ *Risk scores are composite averages across five dimensions: severity of harm, ease of reproduction, skill required, breadth of impact, and ease of discovery. Each dimension is rated 1–10; the composite is the mean. Scores reflect inherent risk, independent of whether a control exists.*

---

## Actionable Risk Areas

### 1. The AI Coding Assistant Can Be Directed to Act on an Attacker's Behalf

The AI coding assistant in this pipeline holds the cloud credentials it needs to read secrets, deploy code, and reconfigure infrastructure. It reads instructions from GitHub — issues, pull requests, and code comments. There is currently no verification that those instructions originate from an authorized person.

An attacker who posts a crafted message in a public GitHub issue can cause the assistant to execute cloud commands without any human reviewing or approving the action. This is not a theoretical concern: this exact pattern was confirmed against four major AI coding platforms in 2026, with multiple documented cases of the assistant reading credentials from the workstation and transmitting them over its allowed network connection. If that happens, the attacker gains the same level of access to cloud infrastructure as the engineer running the tool.

No control currently prevents any of these paths. The assistant runs with full operator-level permissions. There is no approval requirement before it executes infrastructure commands, no log of what it did in a given session, and no network restriction that would block it from sending data to an external destination.

**What an attacker gains:** Cloud credentials, the ability to deploy arbitrary code to the running application, and the ability to modify or delete infrastructure — triggered by a single message in a GitHub issue, with no human in the loop.

| Specific Risk | Score |
|---|---|
| Assistant reads cloud credentials and sends them externally | 7.2 |
| Malicious GitHub content causes the assistant to execute unauthorized infrastructure changes | 7.0 |
| Assistant acts with full operator-level cloud access when compromised | 6.8 |

---

### 2. Software Components Enter the Pipeline Without Verification

The development environment is assembled by downloading software from the internet and running it immediately, with no check that what arrived is what was expected. The base container image is not locked to a specific verified version — a different version could be silently substituted between two builds. The AI coding assistant is installed by fetching a script from a website and executing it directly. A tool used to prevent secrets from being committed to source control is downloaded the same way — no signature, no checksum, no version pin.

If any of these sources were tampered with between the last known-good build and the next installation, malicious code would enter the development environment before any security scan could detect it. This class of attack occurred multiple times in 2026, with poisoned versions of widely-used tools remaining available for as little as 40 minutes before being removed.

The environment is also configured with a system-level permission that allows any process running inside it to reconfigure the firewall rules controlling its outbound network connections. This path requires no software vulnerability — any code that runs inside the container, for any reason, can use this permission to remove all network controls. This has been demonstrated in security research without exploiting any specific flaw.

**What an attacker gains:** Arbitrary code execution inside the development environment, with access to every file the engineer has open and the ability to remove the controls that restrict where the environment can send data.

| Specific Risk | Score |
|---|---|
| Container environment can disable its own network controls using a granted permission | 6.6 |
| AI assistant installed via unverified download script — silent substitution possible | 5.8 |
| Base container image not locked to a verified version — different runtime can be silently substituted | 5.8 |

---

### 3. The Scan Results Used as Compliance Evidence Can Be Silently Altered

After the security scanner runs, it writes its findings to a folder on the local machine. That folder is configured with permissions that allow any other process running on the same machine to overwrite or modify the files. A separate script then reads those files and packages them into the application image, which is deployed and shown in the dashboard as evidence that security issues have been remediated.

There is no cryptographic signature on the findings. There is no checksum verification step. There is no audit log that would show whether the files were modified in the window between the scanner writing them and the application packaging them. A falsified result — one showing remediation that did not occur — would be indistinguishable from a legitimate one in the deployed application.

**What an attacker gains:** The ability to alter the compliance record without leaving a detectable trace, making the security dashboard show whatever outcome is desired.

| Specific Risk | Score |
|---|---|
| Falsified scan output is permanently baked into the deployed compliance image | 6.4 |
| Scanner output directory is writable by any process on the same machine | 6.4 |
| No audit trail connecting a specific scan run to the findings it produced | 6.6 |

---

## Risk Posture at a Glance

| Severity | Total | Fully Controlled | Partial Controls | No Controls |
|---|---|---|---|---|
| Critical (8.0–10) | 5 | 2 | 0 | 3 |
| High (6.0–7.9) | 60 | 6 | 23 | 31 |
| Medium (4.0–5.9) | 66 | 7 | 38 | 21 |
| Low (1.0–3.9) | 4 | 0 | 4 | 0 |
| **Total** | **135** | **15** | **65** | **55** |

*The 3 unmitigated Critical findings are the accepted PoC design tradeoffs documented above. Of the 55 fully uncontrolled risks, 31 are High severity — the majority concentrated in the three actionable areas described in this report.*

---

## Priority Actions

| Priority | Risk | Score | Recommended Decision |
|---|---|---|---|
| 1 | AI assistant uses live cloud credentials to execute actions triggered by GitHub content | 7.2 | Remove cloud credentials from the assistant's accessible scope; require human approval before any infrastructure command executes |
| 2 | A crafted GitHub issue or comment causes the assistant to modify infrastructure | 7.0 | Restrict the assistant's ability to read and act on GitHub Issues and PRs; sandbox its outbound network to an explicit allowlist |
| 3 | Public repository dependency patterns enable a targeted package substitution attack | 7.0 | Audit all dependencies against known attack patterns; pin every package to a specific verified version |
| 4 | Container environment can disable its own network controls using a built-in permission | 6.6 | Remove the capability that allows this; enforce network controls at the host level instead |
| 5 | No audit trail connects a scan run to the findings it produced | 6.6 | Log every scan execution with a timestamp and operator identity; store logs outside the scan output path |
| 6 | Falsified scan results would be permanently embedded in the compliance image | 6.4 | Cryptographically sign scan output immediately after the scanner writes it; reject unsigned results at the packaging step |
| 7 | Scanner output folder is writable by any local process | 6.4 | Restrict folder permissions to the scanner process owner; verify file ownership before ingestion |
| 8 | AI assistant and secret-scanning tool installed without integrity verification | 5.8 | Require checksum or signature verification for all downloaded executables before they run |

---

## Recommended Decisions

**Three decisions are required within 30 days:**

**1. Separate the AI coding assistant from live cloud credentials.**  
The assistant should not have access to production credentials during development sessions. Infrastructure actions — deploying code, modifying cloud resources — should require explicit human confirmation before execution. This eliminates the highest-consequence confirmed exploit path in the pipeline without requiring any architectural change.

**2. Verify all software before it executes.**  
Lock the base container image to a specific verified version. Require cryptographic verification for every downloaded binary before it runs. Remove the system-level permission that allows container processes to reconfigure network controls; enforce that boundary at the host instead.

**3. Add integrity protection to scan output.**  
Sign scan results immediately after they are written, using a key that the scanner process cannot access. Verify the signature before the packaging step reads the files. Reject and alert on any result that cannot be verified. This closes the compliance-falsification path with no change to the scanning workflow itself.

**Two decisions are recommended within 90 days:**

**4.** Implement an explicit approval step for any AI assistant action that touches credentials, source code history, or cloud infrastructure.

**5.** Trigger an automated re-scan of the deployed container image after every build. Newly disclosed vulnerabilities appear between builds with no current mechanism to detect them before the next planned deployment.

---

## Scope and Methodology

| | |
|---|---|
| **System analyzed** | prowler-cspm — public internet → Cloudflare edge → GCP Cloud Run → operator workstation, with AI agent and DevContainer integration |
| **Components covered** | 15 system nodes · 15 trust boundaries · 13 trust zones |
| **Threats identified** | 135 |
| **Method** | Each system component was analyzed for all applicable threat categories. Each connection between components across a trust boundary was analyzed separately for data-in-transit threats. Risk scoring used five dimensions rated 1–10 each (severity of harm, ease of reproduction, skill required, breadth of impact, ease of discovery); the composite score is the mean. Scores reflect inherent risk, independent of whether a control exists — a patched threat retains its inherent score; the control status is tracked separately. |
| **Assessment date** | June 2026 |
| **Full technical register** | `docs/stride.md` — all 135 threats with individual dimension scores, evidence citations, and mitigation status |
