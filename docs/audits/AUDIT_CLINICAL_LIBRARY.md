# Audit 7 — Clinical Library Browsing & Content Presentation Layer

**Date:** 2026-04-01
**Auditor perspective:** Senior full-stack engineer
**Scope:** Library landing page, search/filter/sort, condition/drug/topic detail pages, linked medical content rendering, structured content components, loading/empty/error states, relation rendering (differentials, labs, imaging, buzzwords), content provenance/freshness indicators.

---

## Executive Summary

The Clinical Reference Library is the most polished subsystem in PANaCEa. The `ClinicalReferenceLibrary.tsx` component, `SmartConditionView`, and supporting APIs form a genuinely useful clinical browsing experience with keyboard navigation, URL state sync, virtualized lists, retrievability badges, semantic search, and a two-phase detail loading pattern. The code quality is high.

The issues that exist are **architectural inconsistencies** (auth mismatch between endpoints, redundant client-side filtering, duplicate normalization parsers), **data robustness gaps** (UUID leaking into confusion pair display, drug search requiring exact array match), and a **total absence of content provenance/freshness indicators** — a significant trust gap for a medical education tool. Nothing here blocks production for the core browsing experience; the drug library search bug and auth inconsistency are the highest-priority fixes.

---

## Finding 1 — Auth Mismatch Between Library Endpoints

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Type** | Security / Consistency |
| **Files** | `functions/api/content/library.ts` (authenticatedEndpoint), `functions/api/content/condition/[conditionId]/details.ts` (publicEndpoint), `functions/api/content/condition/[conditionId]/summary.ts` (publicEndpoint), `functions/api/content/search.ts` (publicEndpoint) |
| **Blocks Production** | No — but creates confusing behavior |

**Root Cause:** The main library endpoint (`/api/content/library`) and systems endpoint (`/api/content/systems`) use `authenticatedEndpoint`, requiring a Clerk JWT. But the condition detail endpoints (`/summary`, `/details`) and the content search endpoint (`/api/content/search`) use `publicEndpoint` — no auth required.

**User Impact:** A signed-out user cannot browse the library (correct), but if they somehow reach a condition detail URL directly, they can load full clinical content without authentication. More importantly, the client always sends `Authorization: Bearer ${token}` headers, so if the token is expired/missing the library fails while detail endpoints succeed — inconsistent failure modes confuse debugging.

**Recommended Fix:**
- Make all clinical content endpoints consistently `authenticatedEndpoint`, or
- Make all of them `publicEndpoint` if clinical content is intentionally open.
- Pick one strategy and apply uniformly across `/api/content/*`.

---

## Finding 2 — Drug Library Search Requires Exact Array Element Match

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Type** | Functional Bug |
| **Files** | `functions/api/drugs/library.ts:61-65` |
| **Blocks Production** | No — but severely degrades search UX |

**Root Cause:** The drug search `where.OR` clause uses `{ indications: { hasSome: [search] } }`. Prisma's `hasSome` on a string array requires the search string to be an **exact match** of an array element. Searching "hypertension" will only match if the exact string `"hypertension"` exists as a complete element in the `indications` array — not `"Hypertension"`, not `"Treatment of hypertension"`, not `"essential hypertension"`.

The `genericName` and `brandName` searches use `contains` (partial match, case-insensitive), but indication search is effectively broken for partial or differently-cased terms.

**User Impact:** Students searching drugs by indication (a common workflow — "what treats CHF?") get zero results unless their query exactly matches a stored indication string, including case.

**Recommended Fix:**
```ts
// Replace hasSome with a raw SQL query for array element ILIKE matching:
// OR use: { indications: { has: search } } with normalized lowercase
// Best: Use a computed search_vector on Drug table (like MedicalContent has)
// Quick fix: use Prisma raw query
where.OR = [
  { genericName: { contains: search, mode: 'insensitive' } },
  { brandName: { contains: search, mode: 'insensitive' } },
  Prisma.sql`EXISTS (SELECT 1 FROM unnest("Drug"."indications") AS ind WHERE ind ILIKE ${'%' + search + '%'})`,
];
```

---

## Finding 3 — Redundant Client-Side Filtering Over Server-Filtered Data

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Type** | Performance / Correctness |
| **Files** | `components/library/ClinicalReferenceLibrary.tsx:321-340` (filteredContent memo), `functions/api/content/library.ts:74-78` (server where clause) |
| **Blocks Production** | No |

**Root Cause:** The client sends `system`, `subcategory`, and `highYield` as query parameters to the library API. The server applies these as Prisma `where` clauses. Then the client *re-filters* the returned data by the same criteria in `filteredContent`:

```ts
// Client re-filters what server already filtered:
if (activeSystem && activeSystem !== 'all')
  result = result.filter(item => item.system === activeSystem);
if (activeSubcategory)
  result = result.filter(item => item.subcategory === activeSubcategory);
if (highYieldOnly)
  result = result.filter(item => (item.pance_yield ?? 0) >= 3);
```

This is defensive and mostly harmless, but:
1. It masks server bugs — if the server returns wrong data, the client silently hides it instead of surfacing the error.
2. When `system=all` and no search is active, the server returns ALL conditions (no system filter). The client then filters to the active system, meaning unnecessary data transfer.
3. The KV cache key includes system/subcategory, so cache entries vary correctly, but the "all" case fetches everything.

**User Impact:** On initial load with "all systems", the entire medical content table is fetched even if the user only wants one system. This is bandwidth-wasteful on mobile.

**Recommended Fix:**
- Trust the server filter; remove client re-filtering for system/subcategory/highYield.
- OR: Remove the server filter and only filter client-side (simpler, allows caching one "all" response).
- If keeping both, add a comment explaining the defensive intent.

---

## Finding 4 — Confusion Pair Names Leak UUIDs When conditionName is Missing

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Type** | Data / UX |
| **Files** | `components/library/SmartConditionView.tsx:347-352` |
| **Blocks Production** | No |

**Root Cause:** In the HighYieldTab's differential diagnosis table, confusion pair display names fall through a chain: `pair.conditionName ?? pair.selectedConditionId ?? pair.mistakenForId`. There's a UUID-detection guard (`/^[0-9a-f]{8}-[0-9a-f]{4}/`), but `selectedConditionId` and `mistakenForId` may contain UUIDs that don't match this exact regex pattern (e.g., uppercase hex, different formats).

The summary API (`/summary`) maps confusion pairs from `ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent` and extracts the related MedicalContent's `condition` name. But the details API (`/details`) does NOT include confusion pairs at all — they only appear in the summary response. If the summary mapper fails to resolve the name, the raw UUID leaks through.

**User Impact:** Students occasionally see "Alternative Diagnosis" as a placeholder (the UUID fallback) instead of the actual condition name — losing educational value in the differential table.

**Recommended Fix:**
- Ensure the summary API always resolves condition names (JOIN on MedicalContent).
- Add the confusion pair data to the details endpoint as well, with proper name resolution.
- Make the UUID regex more robust: `/^[0-9a-fA-F]{8}-/.test(rawName)`.

---

## Finding 5 — No Content Provenance or Freshness Indicators

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Type** | User Trust |
| **Files** | `components/library/SmartConditionView.tsx`, `components/library/EnhancedConditionCard.tsx`, `components/library/ConditionDetailPanel.tsx` |
| **Blocks Production** | No |

**Root Cause:** No component in the library displays when content was last updated, what source it came from, or whether it has been clinically reviewed. The `MedicalContent` table has `createdAt`/`updatedAt` timestamps and a `status` field, but none of these surface in the UI.

For a medical education tool, this is a significant trust gap. Students have no way to assess whether a condition card reflects current clinical guidelines or outdated information.

**User Impact:** Students cannot distinguish between recently-verified content and stale entries. In clinical education, outdated treatment guidelines can lead to wrong answers on boards or, worse, clinical reasoning errors.

**Recommended Fix:**
- Add a "Last updated" timestamp to SmartConditionView header (from `updatedAt`).
- Add a freshness badge: "Updated < 30 days" (green), "30-180 days" (yellow), "> 180 days" (red/stale).
- Consider a "Source" or "Reviewed by" indicator for AI-generated vs manually curated content.
- Display the `status` field if it's anything other than `published`.

---

## Finding 6 — Drug Library Requires Class Selection Before Browsing

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Type** | UX / Discoverability |
| **Files** | `functions/api/drugs/library.ts:44-52` |
| **Blocks Production** | No |

**Root Cause:** The drug library API returns an empty array with `requiresSelection: true` when no drug class is selected AND no search query is provided. This means on first visit, the drug library shows zero content — the student must know which drug class they want before seeing anything.

Unlike the condition library (which shows all conditions grouped by system on initial load), the drug library starts blank.

**User Impact:** New users landing on the Pharmacopeia tab see an empty screen with "Please select a drug class to browse medications." This creates a perception of broken/empty content even when the database has hundreds of drugs.

**Recommended Fix:**
- Show a curated "Featured" or "High Yield" drugs view on initial load (e.g., `isHighYield: true` or `isFirstLine: true`).
- Or show all drug classes with counts, and load the first/largest class by default.
- The condition library's approach of showing everything grouped is the better UX pattern.

---

## Finding 7 — Duplicate Data Normalization Parsers

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | Code Quality / Maintenance |
| **Files** | `lib/utils/normalization.ts` (`parseListField`, `parseTextField`), `components/library/SmartConditionView.tsx:191-219` (local `parseListField`, `parseTextField`), `components/library/ConditionDetailPanel.tsx:27` (imports from normalization), `services/conditionContentService.ts` (`safeArrayJoin`, `hasArrayContent`) |
| **Blocks Production** | No |

**Root Cause:** Three separate implementations of JSONB field parsing exist:
1. `lib/utils/normalization.ts` — canonical, handles JSON strings, bullet lists, fake nulls, comma-delimited text.
2. `SmartConditionView.tsx:191-219` — local `parseListField`/`parseTextField` with slightly different behavior (no fake-null handling, no bullet-list detection).
3. `conditionContentService.ts` — `safeArrayJoin` and `hasArrayContent` with yet another parsing approach.

The SmartConditionView local parsers diverge from the canonical ones: they don't handle `"null"` strings, don't detect bullet-list structures, and split on `;` in addition to `,`.

**User Impact:** No immediate user-facing bug, but future content with edge-case formatting (e.g., `"null"` stored as a literal string) will render differently depending on which component displays it.

**Recommended Fix:**
- Delete the local parsers in SmartConditionView and import from `lib/utils/normalization`.
- Replace `conditionContentService.ts` helpers with the canonical functions.
- Single source of truth for all JSONB field parsing.

---

## Finding 8 — Library API Returns Error Responses With 200 Status (Masked by Middleware)

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | API Design |
| **Files** | `functions/api/content/library.ts:176-186` |
| **Blocks Production** | No |

**Root Cause:** When the library API catches an error, it returns:
```ts
return {
  data: { error: 'failed_to_load_library', message: '...', content: [], count: 0 },
  status: 503,
};
```

The `authenticatedEndpoint` middleware extracts `result.data` and sends it as the JSON body with the specified status. This works correctly for the status code. However, the error response also includes `content: []` and `count: 0`, making it look like a successful empty response to clients that don't check the `error` field.

The client does check `res.ok` and handles non-200 responses, so this doesn't cause a visible bug. But the shape ambiguity (error response looks like empty success) is fragile.

**User Impact:** None currently. Risk is that future client code or integrations parse the `content` array without checking for errors.

**Recommended Fix:**
- Remove `content: []` and `count: 0` from error responses.
- Or use a discriminated union: success responses have `{ content, count }`, error responses have `{ error, message }` — never both.

---

## Finding 9 — VirtualizedConditionList Uses Fixed Item Height

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | UX |
| **Files** | `components/library/VirtualizedConditionList.tsx:45` |
| **Blocks Production** | No |

**Root Cause:** The virtualized list uses a fixed `itemHeight` (default 180px) for all items. But `EnhancedConditionCard` varies in height based on content — a condition with 4 key features and diagnostic badges will be taller than one with none.

With fixed-height windowing, cards may be clipped or have excess whitespace. The threshold for using virtualization is `displayContent.length > 40`, so this only affects large result sets.

**User Impact:** In the "all systems" view with 40+ conditions, some cards may clip or have layout jumps when scrolling through the virtualized list.

**Recommended Fix:**
- Use a dynamic-height virtualization library (e.g., `@tanstack/react-virtual` with `estimateSize`).
- Or increase the default `itemHeight` to accommodate the tallest typical card (e.g., 260px) and accept some whitespace.

---

## Finding 10 — Content Search API Uses Condition Table (Not MedicalContent)

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Type** | Data Completeness |
| **Files** | `functions/api/_shared/content-search.ts:311-322`, `functions/api/content/library.ts:83-86` |
| **Blocks Production** | No |

**Root Cause:** The `/api/content/search` endpoint (used by the global search bar) queries the `Condition` table with `name`, `displayName`, `aliases`, and `system` fields. The `/api/content/library` endpoint (used by the library browser) queries `MedicalContent` with full-text search on `search_vector`.

These are **different tables** with different data. A condition may exist in `Condition` but not have a corresponding `MedicalContent` entry (or vice versa). Search results from `/api/content/search` return `Condition.id`, but the library and detail views expect `MedicalContent.id` or `MedicalContent.conditionId`.

The Levenshtein fuzzy matching in `content-search.ts` is computed client-side after fetching candidate rows — a nice touch for typo tolerance but means the DB still does a `contains` query first.

**User Impact:** Students may find a condition via global search that doesn't have a corresponding reference card in the library, leading to "Condition not found" errors when clicking through.

**Recommended Fix:**
- Join the search query against `MedicalContent` (or filter results to only include conditions with published MedicalContent).
- Alternatively, have the search results link directly to the `conditionId` that resolves in both systems.

---

## Finding 11 — SmartConditionView Two-Phase Loading Has No Retry for Details

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | UX |
| **Files** | `components/library/hooks/useSmartCondition.ts`, `components/library/SmartConditionView.tsx:500-508` |
| **Blocks Production** | No |

**Root Cause:** The `useSmartCondition` hook loads summary data on mount (fast) and details on demand via `fetchDetails()`. If the details fetch fails, the Presentation/Diagnostics/Management tabs show "Details couldn't be loaded. Use the Retry button above to try again." — but the referenced "Retry button" is the global refresh button in the library header, which refetches the entire content list, not the detail panel.

There's no dedicated retry button within the SmartConditionView detail panel itself.

**User Impact:** Students who see a detail loading failure must figure out that they need to use the header refresh button, which also resets their navigation state. The mismatch between the error message ("Retry button above") and the actual button location is confusing.

**Recommended Fix:**
- Add a retry button directly in the degraded-state message within each tab.
- Wire it to `fetchDetails()` from the `useSmartCondition` hook.

---

## Finding 12 — No Pagination on Library API for Large Datasets

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | Performance |
| **Files** | `functions/api/content/library.ts:113-144` |
| **Blocks Production** | No |

**Root Cause:** The library API has `page` and `pageSize` in its schema but doesn't use them — it fetches ALL matching `MedicalContent` rows in one query. The drug library correctly implements keyset pagination. With hundreds of conditions per system, this means the initial "all systems" load returns every published condition in a single response.

The KV cache mitigates repeat loads, and the data volume is currently manageable (~2-5KB per condition × ~500 conditions ≈ 1-2.5MB), but this doesn't scale.

**User Impact:** Initial page load on slow connections may take several seconds. The client correctly shows a loading spinner, so the UX is acceptable but not optimal.

**Recommended Fix:**
- Implement the pagination parameters that are already in the schema.
- Or use cursor-based pagination like the drug library does.
- Priority: Low until content grows beyond ~1000 conditions.

---

## Finding 13 — Subcategory Map Computed from Content Rather Than Systems API

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | Data Consistency |
| **Files** | `components/library/ClinicalReferenceLibrary.tsx:372-395` |
| **Blocks Production** | No |

**Root Cause:** The sidebar's subcategory tree is computed from the currently-loaded content (client-side grouping), not from the systems API. This means:
1. When viewing "all systems", subcategories show counts for all conditions.
2. When a system filter is active, subcategories only show counts for the filtered subset.
3. Subcategories that have zero conditions after high-yield filtering disappear from the sidebar entirely.

This is actually reasonable behavior but can be surprising when toggling high-yield mode causes subcategories to vanish.

**User Impact:** Minor — students may wonder where a subcategory went when enabling high-yield filter. The count updates correctly, but the disappearance of empty subcategories is jarring.

**Recommended Fix:**
- Show zero-count subcategories as disabled/grayed rather than hiding them.
- Or fetch subcategory metadata from a dedicated API endpoint.

---

## Finding 14 — DrugMaster Sections Default to Collapsed

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | UX |
| **Files** | `components/library/DrugMaster.tsx:178` |
| **Blocks Production** | No |

**Root Cause:** In the DrugMaster detail view, all sections default to `useState(false)` (collapsed). A student opening a drug detail sees only collapsed section headers — requiring clicks to reveal any content.

Compare this with SmartConditionView which opens the first section with content by default (`defaultOpen={sectionIndex++ === 0}`).

**User Impact:** Students must click to expand every section when viewing a drug, adding friction. The first section (typically "Clinical Use" or "Pharmacology") should auto-expand.

**Recommended Fix:**
- Apply the same `defaultOpen` pattern as SmartConditionView: first non-empty section opens automatically.

---

## Finding 15 — Keyboard Navigation Arrow Keys Are Swapped (j/k vs Vim Convention)

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Type** | UX |
| **Files** | `components/library/ClinicalReferenceLibrary.tsx:506-511` |
| **Blocks Production** | No |

**Root Cause:** The keyboard navigation maps `j` to `handlePrevCondition` and `k` to... wait — actually ArrowRight/j → next, ArrowLeft/k → prev. In Vim convention, `j` = down (next) and `k` = up (prev). The implementation uses ArrowRight=j=next and ArrowLeft=k=prev, which matches **horizontal** Vim-like navigation (as in a card list) rather than vertical Vim convention.

This is defensible for a horizontal card browser. No actual bug, but worth documenting the intent.

**User Impact:** None — the mapping is consistent within the component.

**Recommended Fix:** No fix needed; document the intent in a comment.

---

## Top 10 Findings by Priority

| # | Finding | Severity | Fix Effort |
|---|---------|----------|-----------|
| 1 | Auth mismatch between library endpoints | HIGH | 30 min |
| 2 | Drug search `hasSome` requires exact match | HIGH | 45 min |
| 3 | Redundant client-side filtering | MEDIUM | 20 min |
| 4 | Confusion pair UUID leak | MEDIUM | 30 min |
| 5 | No content provenance/freshness indicators | MEDIUM | 2 hr |
| 6 | Drug library starts blank (no default view) | MEDIUM | 1 hr |
| 7 | Search API uses Condition table, not MedicalContent | MEDIUM | 1 hr |
| 8 | Duplicate normalization parsers | LOW | 30 min |
| 9 | VirtualizedConditionList fixed item height | LOW | 1 hr |
| 10 | No detail-panel retry button | LOW | 20 min |

---

## Three Highest-Leverage Fixes

### Fix A: Unify Auth Strategy (Finding 1)
**Change:** Make all `/api/content/*` endpoints use `authenticatedEndpoint`.
**Files:** `functions/api/content/condition/[conditionId]/details.ts`, `functions/api/content/condition/[conditionId]/summary.ts`, `functions/api/content/search.ts`
**Impact:** Consistent security boundary, consistent error behavior, simpler client auth handling.
**Risk:** Low — client already sends auth headers to these endpoints.

### Fix B: Fix Drug Search (Finding 2)
**Change:** Replace `hasSome` with `$queryRaw` for indication ILIKE matching, or add a `search_vector` column to the Drug table.
**Files:** `functions/api/drugs/library.ts`
**Impact:** Drug-by-indication search actually works — a common student workflow.
**Risk:** Low — the raw SQL is straightforward; alternatively add a migration for `search_vector` on Drug.

### Fix C: Add Content Freshness Indicators (Finding 5)
**Change:** Surface `updatedAt` as a "Last updated" line in SmartConditionView header. Add a color-coded freshness badge (green/yellow/red).
**Files:** `components/library/SmartConditionView.tsx`, `functions/api/content/condition/[conditionId]/summary.ts` (add `updatedAt` to select), `functions/api/content/library.ts` (add `updatedAt` to select)
**Impact:** Builds student trust in the reference content. Differentiates PANaCEa from static study resources.
**Risk:** Very low — purely additive UI change.

---

## Minimal Safe Implementation Plan

**Day 1 (2 hours):**
1. Fix Finding 1: Change `publicEndpoint` → `authenticatedEndpoint` in summary, details, and search endpoints. Test that client auth headers flow correctly.
2. Fix Finding 2: Replace `hasSome` with proper ILIKE-based indication search in drug library API.

**Day 2 (2 hours):**
3. Fix Finding 5: Add `updatedAt` to API select clauses. Add freshness badge to SmartConditionView.
4. Fix Finding 7: Delete local parsers from SmartConditionView, import from `lib/utils/normalization`.
5. Fix Finding 11: Add inline retry button to detail panel tabs.

**Day 3 (1 hour):**
6. Fix Finding 6: Default drug library to show high-yield or first-line drugs on initial load.
7. Fix Finding 4: Improve UUID regex in confusion pair display.

---

## What to Audit Next

**Audit 8 → Drill Components & Game Mechanics.** The 11 active drill hooks (`hooks/game/use-*.ts`) and 13 drill components all feed into FSRS via `useDrillFSRS`. Audit: drill lifecycle, question rendering accuracy, answer evaluation correctness, timing/telemetry collection per drill type, DrillShell integration, drill-specific scoring logic, and whether each drill type's behavioral metrics (answer switches, dwell time) are collected and meaningful.
