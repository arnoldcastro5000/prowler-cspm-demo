# DASHBOARD_SPEC.md — Frontend Blueprint

This document specifies exactly what the dashboard builds. It governs the
frontend only. All component definitions, data bindings, states, and layout
rules are defined here. Do not invent components, views, or data fields not
listed in this file.

---

## Routes

| Route | Page Component | JSON File |
|---|---|---|
| `/` | `Landing.tsx` | — |
| `/before` | `Before.tsx` | `findings_before.json` |
| `/after` | `After.tsx` | `findings_after.json` |
| `/frameworks` | Disabled tab — not implemented | — |

The Landing page is a standalone portfolio entry point — not a redirect. It targets hiring managers with a cloud security background. See Landing Page section below.

The Before page fetches `findings_before.json` only. The After page fetches both JSON files.

The tab bar (`Before | After | Frameworks`) appears on `/before` and `/after` only — not on the Landing page. The Frameworks tab is visible but disabled with a "Coming soon" tooltip.

---

## Landing Page

**Route:** `/`

**Layout:** Standalone — no tab bar, no Summary Bar, no findings.

**Sections top to bottom:**

1. **Hero** — two sentences establishing the scans are real, not mocked
2. **Credibility** — pipeline explanation: Terraform-provisioned resources, credentials in Secret Manager, scans from WSL2, hosted on Cloud Run behind Cloudflare
3. **Infrastructure diagram** — Mermaid diagram of the full pipeline: Terraform → cloud resources → Prowler → ingest → React dashboard → Cloud Run → Cloudflare
4. **Tech stack table** — IaC, scanner, frontend, hosting
5. **CTAs** — "View Before Scan →", "View After Scan →", "GitHub →"

---

## Dashboard Layout (Before and After pages)

Every dashboard page (`/before`, `/after`) has the following top-to-bottom structure:

```
┌─────────────────────────────────┐
│  Tab Bar (Before | After | *)   │
│  (* Frameworks — disabled)      │
├─────────────────────────────────┤
│  Page Header                    │
├─────────────────────────────────┤
│  Summary Bar (6 stat cards)     │
├─────────────────────────────────┤
│  Severity Filter                │
├─────────────────────────────────┤
│  Findings Table                 │
│  (grouped by Provider)          │
├─────────────────────────────────┤
│  Provider Status                │
│  (After page only)              │
├─────────────────────────────────┤
│  Remediation Changelog          │
│  (After page only)              │
└─────────────────────────────────┘
```

---

## Components

### 1. Page Header

**Location:** Top of page, full width.

**Renders:**
- Project name: "Prowler CSPM"
- Page label: "Before Remediation" on `/before`, "After Remediation" on `/after`
- Navigation links to switch between `/before` and `/after`
- Scan timestamp: `scanned_at` value from the most recent document in the
  fetched array (ISO 8601, formatted as human-readable date and time)

---

### 2. Summary Bar

**Location:** Below page header, full width. Six stat cards in a row.

**Cards:**

| Card | Value | How computed |
|---|---|---|
| Total Findings | Count of documents where `status === "fail"` | `findings.filter(f => f.status === "fail").length` |
| Critical | Count where `severity === "critical"` and `status === "fail"` | filtered count |
| High | Count where `severity === "high"` and `status === "fail"` | filtered count |
| Medium | Count where `severity === "medium"` and `status === "fail"` | filtered count |
| Low | Count where `severity === "low"` and `status === "fail"` | filtered count |
| Providers | Count of distinct `provider` values in `findings_before.json` | If count ≠ 3, display error state on card |

**Note:** Prowler scans the entire cloud account, not just Terraform-provisioned resources. The Summary Bar reflects all findings in the JSON file. The 15 target checks are a subset of what Prowler may return.

Note: `findings_after.json` contains 15 documents with `status === "pass"`. These are not
counted in the Summary Bar (which counts only FAIL findings) but are required by the
Remediation Changelog to confirm each check_id moved from fail to pass.

**Data source:** Total, Critical, High, Medium, and Low derived from the page's primary findings array (FAIL only). Providers always derived from `findings_before.json` — the Before page uses its own fetched data; the After page uses the already-fetched `findings_before.json`.

---

### 3. Severity Filter

**Location:** Below Summary Bar, above Findings Table.

**Controls:** Single severity selector — `all`, `critical`, `high`, `medium`, `low`.

**Behaviour:**
- Filters apply globally across all provider sections simultaneously.
- Default state: all severities shown.
- Applies to the Findings Table only. Summary Bar always reflects the full unfiltered dataset.

**Data source:** No fetches. Operates on the in-memory findings array.

---

### 4. Findings Table

**Location:** Below Severity Filter.

**Grouping:** Findings are grouped by provider (`aws`, then `gcp`, then `azure`). Each provider is a collapsible section header. Within each section, rows are sorted severity descending.

**Expandable rows:** Each row is expandable. Collapsed state shows Provider, Severity, Title, Resource. Expanded state additionally shows Category, Check ID, scanned_at, and a "Show raw" toggle that reveals the raw Prowler JSON blob (collapsed by default).

**Columns:**

| Column | Field | Notes |
|---|---|---|
| Provider | `provider` | Rendered as a badge: `aws` / `gcp` / `azure` |
| Severity | `severity` | Rendered as a coloured badge: critical=red, high=orange, medium=yellow, low=grey |
| Category | `category` | Plain text |
| Check ID | `check_id` | Monospace font |
| Title | `title` | Plain text |
| Resource | `resource` | Monospace font, truncated if long with full value on hover |
| Status | `status` | Badge: `fail`=red, `pass`=green |

**Default sort:** Severity descending (critical → high → medium → low), then
provider alphabetically.

**Empty state (After page):**
When the fetched array is empty or all documents have
`status === "pass"`, display a message: *"No findings — all checks passed."*
Do not render the table. Do not render the Filter Bar.

**Loading state:**
Display a skeleton loader in place of the table while JSON data is loading. Skeleton should match the table column structure.

**Error state:**
If the fetch fails, display an inline error message:
*"Failed to load findings. Check your connection and try again."*
Do not display a blank page or throw an unhandled exception.

**Data source:** Full array from /findings_before.json or /findings_after.json, filtered in memory by the Filter Bar state.

---

### 5. Provider Status

**Location:** Below Findings Table, above Remediation Changelog. **After page only — not rendered on `/before`.**

**Purpose:** Shows the post-remediation scan status for each of the 3 cloud providers. Reuses the 7-column structure of the Findings Table. Rows are grouped by provider (`aws`, then `gcp`, then `azure`). Providers with 0 remaining findings show a single "All clear" row. Providers with findings show one row per finding.

**Columns:** Same 7 columns as the Findings Table — Provider, Severity, Category, Check ID, Title, Resource, Status.

**All clear row:** When a provider has 0 findings, render a single row with the provider badge in the Provider column and *"All clear"* in the Title column. Severity, Category, Check ID, Resource, and Status cells are empty.

**Sort within each provider group:** Severity descending (critical → high → medium → low).

**Error state:** If `findings_before.json` distinct provider count ≠ 3, display an inline error: *"Provider scan incomplete — expected 3 providers."*

**Loading state:** Same skeleton loader pattern as Findings Table.

**Data source:** `findings_after.json` (already fetched for the After page).

---

### 6. Remediation Changelog

**Location:** Below Provider Status. **After page only — not rendered on `/before`.**

**Purpose:** Shows every finding that moved from `fail` in `findings_before.json`
to `pass` in `findings_after.json`, matched by `check_id`.

**How it is computed (frontend only, no backend calls):**
1. Read the already-fetched array from `findings_before.json`.
2. Read the already-fetched array from `findings_after.json`.
3. For each document in `findings_before.json` where `status === "fail"`:
   find the matching document in `findings_after.json` by `check_id`.
4. If the match has `status === "pass"`, include in changelog.
5. Sort by severity descending, then provider alphabetically.

**Columns:**

| Column | Field | Source file |
|---|---|---|
| Provider | `provider` | Either (should match) |
| Severity | `severity` | `findings_before.json` |
| Category | `category` | `findings_before.json` |
| Check ID | `check_id` | Either (should match) |
| Title | `title` | `findings_before.json` |
| Resource | `resource` | `findings_before.json` |
| Status change | — | Static: renders "FAIL → PASS" |

**Header label:** "Remediation Changelog — 15 issues resolved" (count is
dynamic based on matched records).

**Empty state:** Not expected in normal operation (after state should always
have 0 findings). If shown, display: *"No remediated findings to display."*

**Loading state:** Same skeleton loader pattern as Findings Table.

**Data source:** Requires two parallel fetch() calls. Both JSON files are fetched when the /after route loads.
The Before page does not fetch `findings_before.json` for this purpose.

---

## Types and Validation

All components share a single `Finding` type defined in `dashboard/src/types/finding.ts`.
The type is inferred from a zod schema — do not define the type separately.

```ts
import { z } from "zod"

export const FindingSchema = z.object({
  id: z.string(),
  source: z.literal("prowler"),
  category: z.enum(["storage", "iam", "networking", "logging", "encryption"]),
  provider: z.enum(["aws", "gcp", "azure"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string(),
  resource: z.string(),
  check_id: z.string(),
  status: z.enum(["fail", "pass"]),
  scanned_at: z.string(),
  raw: z.record(z.unknown()),
})

export type Finding = z.infer<typeof FindingSchema>
```

Fetched JSON must be parsed with `FindingSchema.array().parse(data)` before use.
If parsing fails, surface the existing fetch error state — do not swallow the error.

---

## Data Fetching Rules

The dashboard reads two static JSON files served from the container's public directory:

- `/findings_before.json`
- `/findings_after.json`

Both files are fetched via plain `fetch()` on page load. No Firestore SDK.
No credentials. No authentication required.

`/before` fetches `/findings_before.json` only.
`/after` fetches both files (both are needed for Provider Status and the Remediation Changelog).

All filtering and sorting happens in memory on the fetched arrays.
Do not re-fetch on filter change.

---

## Severity Colour Tokens

Use these consistently across all badges and UI elements:

| Severity | Colour intent |
|---|---|
| `critical` | Red |
| `high` | Orange |
| `medium` | Yellow |
| `low` | Grey |
| `pass` | Green |
| `fail` | Red |

Implement as Tailwind CSS utility classes. Do not use inline styles.

---

## What This Spec Does Not Cover

- Authentication — the dashboard is public at `prowler.cloudsecuritypractice.com` behind Cloudflare. No login screen.
- Pagination — 15 documents maximum, no pagination needed.
- Search — not required.
- Export — not required.
- Real-time updates — findings are point-in-time snapshots. No live updates.
- `/frameworks` tab implementation — placeholder only in initial release.
