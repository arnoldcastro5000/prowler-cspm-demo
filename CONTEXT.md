# Cloud Security Posture Management (CSPM) Dashboard

A portfolio project that scans real cloud infrastructure across AWS, GCP, and Azure for misconfigurations using Prowler, then displays a before/after remediation dashboard.

## Language

**Check**:
A rule definition that tests a specific security property against a cloud resource type. A check exists as a concept independent of whether it has been run. Identified by a `check_id` (e.g. `s3_bucket_level_public_access_block`).
_Avoid_: test, rule, policy, control (when meaning a Prowler check)

**Finding**:
The result of running a Check against a specific resource at a point in time. Always has a `status` (pass or fail) and a `scanned_at` timestamp. A single check may produce many findings across different resources.
_Avoid_: result, alert, violation, check (when meaning the output of a scan)

**Provider**:
One of the three cloud platforms scanned: AWS, GCP, or Azure.
_Avoid_: cloud, vendor, platform (when meaning a specific scannable cloud provider)

## Example dialogue

> **Reviewer:** "What's the difference between a check and a finding?"
> **Dev:** "A check is the rule — `s3_bucket_default_encryption` — it exists whether or not you've scanned. A finding is what you get when Prowler runs that check against a specific S3 bucket at a point in time. One check can produce many findings across different resources."
>
> **Reviewer:** "So the Scorecard shows all 15 findings as critical?"
> **Dev:** "No — the Scorecard counts only failing findings by severity. In the Before snapshot there are 3 critical, 7 high, 4 medium, 1 low across the 15 target checks. In the After snapshot all target checks pass, so the scorecard shows zero for those."
>
> **Reviewer:** "Where does the ISO27001 mapping show up?"
> **Dev:** "That's the Framework View — a third tab that's visible but disabled in the initial release. When it's built, it'll show coverage per framework. For now you just see the Coming soon label."

## Language

**Remediation Story**:
The before/after snapshot pair that proves a specific set of misconfigurations were found and fixed. The Before state has all checks failing; the After state has all checks passing. The dashboard exists to tell this story to a portfolio reviewer.
_Avoid_: before/after comparison, demo, showcase (when meaning this concept)

**Scorecard**:
The summary panel at the top of each page showing finding counts grouped by severity (critical, high, medium, low). The first thing a reviewer sees — establishes the severity of the posture before the findings list.
_Avoid_: summary, overview, stats panel

**Snapshot**:
The complete set of findings produced by a single Prowler scan run. The dashboard holds exactly two snapshots: Before and After. Each snapshot has a `scanned_at` timestamp.
_Avoid_: scan results, dataset, state

**Severity Filter**:
A global filter control on the Before/After pages that narrows the findings list to a specific severity across all provider sections simultaneously. Applied globally — not per-provider.
_Avoid_: severity dropdown, filter panel

**Finding Row**:
A single row in the findings list representing one Finding. Shows title, severity badge, and resource by default. Expandable to reveal category, check_id, and scanned_at. Raw Prowler output is not exposed in the UI.
_Avoid_: finding card, finding item

**Landing Page**:
The root route (`/`) — targets a hiring manager with a cloud security background. Contains: a two-sentence hero claim establishing the scans are real, a credibility section explaining the infrastructure pipeline, an infrastructure diagram, a tech stack table, and CTAs to Before/After snapshots and GitHub. Not an intro to CSPM — assumes the reader already knows the domain.
_Avoid_: home page, intro page, index

**Framework View**:
A planned third tab showing finding coverage mapped to security frameworks (ISO27001, CIS Controls). Not in the initial release — appears in the tab bar as a visible-but-disabled "Coming soon" tab. The routing and data model leave room for it without implementing it.
_Avoid_: compliance tab, framework tab
