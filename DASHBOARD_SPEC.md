# DASHBOARD_SPEC.md — Frontend Blueprint

This document specifies exactly what the dashboard builds. It governs the
frontend only. All component definitions, data bindings, states, and layout
rules are defined here. Do not invent components, views, or data fields not
listed in this file.

---

## Routes

| Route | Page Component | JSON File |
|---|---|---|
| `/before` | `Before.tsx` | `findings_before` |
| `/after` | `After.tsx` | `findings_after` |
| `/` | Redirects to `/before` | — |

The Before page fetches `findings_before.json` only. The After page fetches both JSON files.

---

## Shared Layout

Every page has the following top-to-bottom structure:

```
┌─────────────────────────────────┐
│  Page Header                    │
├─────────────────────────────────┤
│  Summary Bar (4 stat cards)     │
├─────────────────────────────────┤
│  Filter Bar                     │
├─────────────────────────────────┤
│  Findings Table                 │
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
  collection (ISO 8601, formatted as human-readable date and time)

---

### 2. Summary Bar

**Location:** Below page header, full width. Four stat cards in a row.

**Cards:**

| Card | Value | How computed |
|---|---|---|
| Total Findings | Count of all documents | `findings.length` |
| Critical | Count where `severity === "critical"` | filtered count |
| High | Count where `severity === "high"` | filtered count |
| Providers | Count of distinct `provider` values in `findings_before.json` | If count ≠ 3, display error state on card |

**Before page expected values:** 15 total (3 critical, 7 high, 4 medium, 1 low), 3 providers.
**After page expected values:** 0 total, 0 critical, 0 high, 3 providers.

**Data source:** Total, Critical, and High derived from the page's primary findings array. Providers always derived from `findings_before.json` — the Before page uses its own fetched data; the After page uses the already-fetched `findings_before.json`.

---

### 3. Filter Bar

**Location:** Below Summary Bar, above Findings Table.

**Controls:**

| Filter | Type | Options |
|---|---|---|
| Provider | Multi-select toggle | `aws`, `gcp`, `azure` |
| Severity | Multi-select toggle | `critical`, `high`, `medium`, `low` |
| Category | Multi-select toggle | `storage`, `iam`, `networking`, `logging`, `encryption`, `threat-protection` |

**Behaviour:**
- Filters are additive (AND logic within a group, i.e. selecting `aws` and
  `gcp` shows findings from either).
- Default state: all options selected (unfiltered).
- Filters apply to the Findings Table only. Summary Bar always reflects the
  full unfiltered dataset.
- A "Clear filters" control resets all filters to default.

**Data source:** No fetches. Operates on the in-memory findings array.

---

### 4. Findings Table

**Location:** Below Filter Bar.

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
When the collection returns zero documents or all documents have
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

**Purpose:** Shows every finding that moved from `fail` in `findings_before`
to `pass` in `findings_after`, matched by `check_id`.

**How it is computed (frontend only, no backend calls):**
1. Read the already-fetched array from `findings_before`.
2. Read the already-fetched array from `findings_after`.
3. For each document in `findings_before` where `status === "fail"`:
   find the matching document in `findings_after` by `check_id`.
4. If the match has `status === "pass"`, include in changelog.
5. Sort by severity descending, then provider alphabetically.

**Columns:**

| Column | Field | Source collection |
|---|---|---|
| Provider | `provider` | Either (should match) |
| Severity | `severity` | `findings_before` |
| Category | `category` | `findings_before` |
| Check ID | `check_id` | Either (should match) |
| Title | `title` | `findings_before` |
| Resource | `resource` | `findings_before` |
| Status change | — | Static: renders "FAIL → PASS" |

**Header label:** "Remediation Changelog — 15 issues resolved" (count is
dynamic based on matched records).

**Empty state:** Not expected in normal operation (after state should always
have 0 findings). If shown, display: *"No remediated findings to display."*

**Loading state:** Same skeleton loader pattern as Findings Table.

**Data source:** Requires two parallel fetch() calls. Both JSON files are fetched when the /after route loads.
 The Before page does not fetch `findings_before` for this purpose.

---

## Types and Validation

All components share a single `Finding` type defined in `dashboard/src/types/finding.ts`.
The type is inferred from a zod schema — do not define the type separately.

```ts
import { z } from "zod"

export const FindingSchema = z.object({
  id: z.string(),
  source: z.literal("prowler"),
  category: z.enum(["storage", "iam", "networking", "logging", "encryption", "threat-protection"]),
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
- Real-time updates — findings are point-in-time snapshots. No Firestore
  listeners or live updates.
- Any route other than `/before` and `/after`.
