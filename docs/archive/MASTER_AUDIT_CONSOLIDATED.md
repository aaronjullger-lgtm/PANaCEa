# PANaCEa Master Audit Consolidated Report

**Consolidation Date:** 2026-03-01  
**Source Audits:**  
1. `AUDIT_FSRS_TELEMETRY.md` – FSRS v6 & Telemetry Audit  
2. `AUDIT_DB_HOMOGENIZATION.md` – Database Homogenization Audit  
3. `AUDIT_MAIN_SESSION_UI.md` – Main Session UI & Analytics Dashboard Audit  
4. `AUDIT_AI_SAFETY.md` – AI Security Architecture Audit  

**Purpose:** Provide a unified view of audit findings across the PANaCEa platform, highlighting critical deviations, risks, and recommended remediation steps. This document preserves all original findings while organizing them thematically for comprehensive review.

**Audience:** Engineering leadership, security team, product owners, and developers responsible for implementing fixes.

---

## 1. Introduction

This report consolidates four independent audit reports conducted in March 2026. Each audit targeted a distinct subsystem of the PANaCEa platform:

- **FSRS Telemetry & Dual‑Output Logic** – Mathematical correctness of the FSRS v6 scheduling algorithm, telemetry integrity, and dual‑output (continuous confidence + discrete rating) implementation.
- **Database Homogenization** – Schema optimization, elimination of static frontend taxonomies, JSON resilience, and ETL architecture for medical‑content normalization.
- **Main Session UI & Analytics Dashboard** – Performance tracking, design‑system compliance (“Stormy Slate” aesthetic), and data‑resilience patterns.
- **AI Safety** – Anti‑hallucination controls, Edge Function resilience, and staging‑lake protocol adherence.

The audits were performed by specialized experts (Code Reviewer Expert, Database Admin Expert, React Specialist Elite, Security Auditor Pro) using manual code inspection, automated pattern detection, and risk‑assessment frameworks.

**Overall Status:** The PANaCEa codebase exhibits strong architectural patterns in core mathematical logic and data resilience, but critical violations exist in silent‑tracking implementation, design‑system compliance, and operational resilience of AI integrations. Immediate remediation is required in high‑severity areas before production deployment.

---

## 2. Audit 1: FSRS Telemetry & Dual‑Output Logic

**Source:** `AUDIT_FSRS_TELEMETRY.md`  
**Audit Date:** 2026‑03‑01  
**Audited Files:** `lib/fsrs.ts`, `lib/implicit‑metrics.ts`, `lib/services/drillReviewService.ts`

### 2.1 Executive Summary

The audit verified the dual‑output logic that produces a continuous implicit‑confidence score (for analytics) and a discrete FSRS rating (for scheduling). While the core mathematical implementation is sound, three deviations were identified concerning rapid‑guess logging, telemetry storage, and a deprecated function.

### 2.2 Summary of Mathematical Deviations

| Deviation ID | Description | Location | Severity | Impact |
|--------------|-------------|----------|----------|--------|
| **DEV‑001** | Rapid‑guess attempts are **not** written to the `ReviewLog` table. The guard clause `!isRapidGuess` prevents `prisma.reviewLog.create` from being executed for rapid guesses. | `drillReviewService.ts:427` | Medium | Violates requirement that rapid guesses be logged in `ReviewLog` with `telemetry.rapid_guess = true`. FSRS optimizer lacks these records for analytics. |
| **DEV‑002** | The `ReviewLog.telemetry` field does **not** contain the complete, unaltered telemetry object received from the client. Instead, a curated subset of fields is stored. | `drillReviewService.ts:519‑531` | Low | Telemetry integrity partially compromised; omitted fields not required for FSRS optimization. |
| **DEV‑003** | The deprecated `deriveImplicitRating` function returns a `confidence` value that is **not** independent of the derived `rating`. For incorrect answers, `confidence` is hard‑coded to 0.95. | `implicit‑metrics.ts:198` | Low | Only relevant for legacy code; production uses `deriveContinuousRating`. |

### 2.3 Audit Findings

#### Objective 1: Dual‑Output Logic Verification  
**Status:** ✅ **PASS**  

**Evidence:**  
- The production‑grade function `deriveContinuousRating` correctly produces two independent outputs: a continuous floating‑point `grade` (1.0–4.0) and a discrete `discreteRating` (1–4) via `gradeToRating`.  
- The continuous `grade` is used for analytics (stored as `grade_continuous` in `ReviewLog`), while the discrete `rating` is passed to `FSRS.next()`.  
- No contamination between the two outputs.

**Line References:**  
- `implicit‑metrics.ts:318‑377` (`deriveContinuousRating`)  
- `implicit‑metrics.ts:372‑377` (`gradeToRating`)  
- `drillReviewService.ts:281` (call to `deriveContinuousRating`)  
- `drillReviewService.ts:317` (`rating = continuousResult.discreteRating`)

#### Objective 2: Data Purity Enforcement  
**Status:** ⚠️ **PARTIAL FAIL**  

**Evidence:**  
- **Rapid‑guess guard clause works correctly:** When `effectiveDurationMs < MVRT` (default 500 ms) or `telemetry.rapid_guess` is true, `isRapidGuess` becomes true. The condition `!isRapidGuess` prevents FSRS state updates. **PASS**.  
- **Rapid guesses are recorded in `QuestionAttempt`:** The `telemetryJson` includes `server_computed.is_rapid_guess = true`. **PASS**.  
- **Rapid guesses are NOT recorded in `ReviewLog`:** The `prisma.reviewLog.create` call is inside the `if (question.conditionId && countForFSRS && !isRapidGuess)` block. Consequently, rapid‑guess attempts are absent from the `ReviewLog` table. **FAIL**.

**Line References:**  
- `drillReviewService.ts:350‑351` (`isRapidGuess` definition)  
- `drillReviewService.ts:427` (guard condition)  
- `drillReviewService.ts:355‑404` (`QuestionAttempt` creation with `is_rapid_guess`)  
- `drillReviewService.ts:490‑533` (`ReviewLog` creation – only reached when `!isRapidGuess`)

#### Objective 3: Telemetry Integrity Validation  
**Status:** ⚠️ **PARTIAL PASS**  

**Evidence:**  
- **Required fields are present:** `ReviewLog.telemetry` includes `par_time_ms`, `latency_ratio`, `answer_changes`, and `circadian_phase` with correct data types. **PASS**.  
- **Non‑truncated values:** Stored values are exact numbers/strings computed on the server. **PASS**.  
- **Complete serialization is NOT achieved:** The `telemetry` field does **not** contain the full, unaltered telemetry object from the request. It omits client‑reported fields such as `duration_ms`, `question_type`, `mvrt_threshold_ms`, `hint_viewed`, etc. **FAIL**.

**Line References:**  
- `drillReviewService.ts:519‑531` (`ReviewLog.telemetry` object)  
- `drillReviewService.ts:138‑150` (`SubmitDrillReviewInput.telemetry` type)

### 2.4 Prescriptive Unit Test Specification

To formally prove the dual‑output logic operates as designed, implement the following Vitest test suites:

#### Test File: `lib/implicit‑metrics.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { deriveContinuousRating, DEFAULT_IMPLICIT_CONFIG } from './implicit‑metrics';
import { Rating } from './fsrs';

describe('deriveContinuousRating', () => {
  // --- Test Set 1: Correctness & Grade Boundaries ---
  describe('grade boundaries and discrete rating mapping', () => {
    it('maps grade < 1.5 to Rating.Again', () => {
      // … test implementation
    });
    // … additional test cases
  });

  // --- Test Set 2: Confidence Independence ---
  describe('confidence calculation independence', () => {
    it('confidence does not affect discrete rating', () => {
      // … test implementation
    });
    // … additional test cases
  });

  // --- Test Set 3: Rapid‑Guess Guard Integration ---
  describe('integration with rapid‑guess guard', () => {
    it('returns valid rating even when duration < 500ms', () => {
      // … test implementation
    });
  });

  // --- Test Set 4: Edge Cases ---
  describe('edge cases', () => {
    it('handles missing parTimeMs (defaults to 30 s)', () => {
      // … test implementation
    });
    // … additional test cases
  });
});
```

#### Test File: `lib/services/drillReviewService.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { submitDrillReview } from './drillReviewService';
import { PrismaClient } from '@prisma/client';
import { Rating } from '../fsrs';

describe('drillReviewService rapid‑guess handling', () => {
  it('creates QuestionAttempt but skips ReviewLog when rapid‑guess detected', async () => {
    // … implement integration test that verifies DEV‑001.
  });

  it('stores full telemetry in QuestionAttempt.telemetryJson', async () => {
    // … verify that the complete telemetry object is preserved in QuestionAttempt.
  });

  it('stores curated telemetry subset in ReviewLog.telemetry', async () => {
    // … verify that ReviewLog.telemetry contains the required fields.
  });
});
```

### 2.5 Recommendations

1. **Fix DEV‑001:** Move the `prisma.reviewLog.create` call outside the rapid‑guess guard (or add a separate branch) so that rapid‑guess attempts are still logged with `telemetry.rapid_guess = true`. Ensure the `sessionType` is set to a value that excludes them from FSRS optimization (e.g., `'RAPID_GUESS'`).
2. **Fix DEV‑002:** Either update the requirement to accept a curated telemetry subset, or store the full incoming telemetry object in `ReviewLog.telemetry` (e.g., by spreading `...telemetry` into the object). Consider storing raw telemetry in a separate JSON column if the optimizer does not need it.
3. **Address DEV‑003:** No action required; the deprecated `deriveImplicitRating` is not used in production. The active `deriveContinuousRating` already satisfies the dual‑output requirement.
4. **Implement the prescribed unit tests** to provide formal proof of correctness and prevent regressions.

---

## 3. Audit 2: Database Homogenization

**Source:** `AUDIT_DB_HOMOGENIZATION.md`  
**Audit Date:** March 2026  
**Audit Team:** Database Admin Expert, Project Research, Code Skeptic, Architect

### 3.1 Executive Summary

This audit synthesizes findings from four independent investigations into the PANaCEa database homogenization effort. The goal is to ensure a single source of truth for medical content, eliminate static taxonomies, and guarantee consistent JSON structure across all `MedicalContent` records.

**Key Findings:**  
1. **Schema & Data Model** – The `MedicalContent` table contains six JSONB columns with heterogeneous shapes. Query patterns are served by existing single‑column indexes, but a composite index on `(status, system)` is missing, affecting filtered lookups.  
2. **Frontend Homogeneity** – 54 instances of static medical taxonomies were identified across components, config files, and registries. These violate the “database‑first” principle and create maintenance overhead.  
3. **JSON Resilience** – Most JSON access patterns use optional chaining and guards, but a few brittle direct accesses exist. The `age_demographic` column poses medium risk due to ambiguous schema.  
4. **ETL Architecture** – A fully‑specified script (`scripts/normalize‑medical‑content.ts`) can homogenize all JSON columns using AI‑assisted normalization, Zod validation, and production‑grade resilience.

### 3.2 Schema & Data Model Audit

*Conducted by Database Admin Expert*

#### Table Overview
- **Table:** `MedicalContent`
- **Fields:** 45+ columns, six JSONB columns:
  - `content` – Main clinical narrative, diagnostics, treatment, etc.
  - `clinical_pearls` – Array of key teaching points.
  - `classic_triad` – Array of classic triad signs.
  - `age_demographic` – Age‑group information (ambiguous shape).
  - `differentials` – Differential diagnoses with reasons.
  - `synonyms` – Alternative condition names.
- **Current Indexes:** Single‑column indexes on `conditionId`, `createdBy`, `status`, `system`, `updatedAt`.

#### Query Patterns

| Pattern | Frequency | Performance |
|---------|-----------|-------------|
| `WHERE status = 'PUBLISHED' AND system = 'CV'` | High | **Missing composite index** |
| `WHERE system IN (...)` | Medium | Covered by `system` index |
| `WHERE status = 'DRAFT'` | Low | Covered by `status` index |
| JSONB field access (`content->>'condition'`) | High | No GIN index on `content` |

#### Index Recommendations

| Index | Type | Rationale |
|-------|------|-----------|
| `(status, system)` | Composite B‑Tree | Accelerates the most frequent filtered queries |
| `(system, status)` | Composite B‑Tree | Alternative if `system` selectivity is higher |
| `content` (JSONB) | GIN (`jsonb_path_ops`) | Enables efficient searches within the `content` field |
| `(updatedAt DESC)` | Single column (existing) | Already present; keep for batch‑processing order |

#### Data Integrity Observations
- JSON columns allow `null` as well as empty arrays/objects, leading to inconsistent default handling.
- No database‑level constraints enforce shape uniformity across records.
- The `normalization_version` field (proposed) will track which records have been homogenized.

### 3.3 Frontend Homogeneity Compliance Check

*Conducted by Project Research*

#### Static Taxonomy Inventory

| Category | File Pattern | Violation Count | Example |
|----------|--------------|-----------------|---------|
| Component‑level mappings | `SYSTEM_NAMES`, `SYSTEM_ICONS` | 12 | `components/SystemBadge.tsx` |
| Type‑level enumerations | `SystemCode` union type | 1 | `src/types/conditions.ts` |
| Configuration arrays | `config/*.ts` | 8 | `config/rotation‑systems.ts` |
| Medical registries | `src/registries/*.ts` | 33 | `src/registries/drugRegistry.ts` |
| **Total** | **4 categories** | **54 instances** | |

#### High‑Density Violation Areas
1. **`src/registries/`** – 13 registry files, each containing arrays of medical terms (drugs, lab tests, symptoms, etc.).
2. **`config/rotation‑systems.ts`** – Hard‑coded mapping of clinical rotations to organ systems.
3. **`config/specialty‑caq.ts`** – Static specialty‑to‑system mappings.
4. **`config/training‑modes.ts`** – Training‑mode definitions with embedded system lists.

#### Migration Recommendations
- **Short‑term:** Create database tables (`MedicalTaxonomy`, `SystemMapping`, `RegistryEntry`) and seed them with the static data.
- **Medium‑term:** Replace frontend imports with API calls (`/api/taxonomy/{type}`) that fetch from the database.
- **Long‑term:** Implement an admin UI for curating taxonomies, enabling runtime updates without code deploys.

**Priority:** High – these static arrays are the primary obstacle to a true database‑first architecture.

### 3.4 Content JSON Resilience Analysis

*Conducted by Code Skeptic*

#### JSON Column Structure Hierarchy

| Column | Expected Shape | Default |
|--------|----------------|---------|
| `content` | `{ condition, system, overview, diagnostics, treatment, … }` | `{}` |
| `clinical_pearls` | `string[]` | `[]` |
| `classic_triad` | `string[]` (max 5) | `[]` |
| `age_demographic` | `string[]` **or** `{ typical, range }` | `[]` (ambiguous) |
| `differentials` | `Array<{ condition: string, reason?: string }>` | `[]` |
| `synonyms` | `string[]` | `[]` |

#### Robustness Assessment

| Pattern | Location | Robustness | Risk |
|---------|----------|------------|------|
| Optional chaining (`?.`) | Most frontend components | High | Low |
| Guard clauses (`if (field)`) | Backend API handlers | Medium | Low |
| Direct property access (`obj.field`) | Few legacy components | Low | Medium |
| `age_demographic` shape assumption | Multiple places | Low | **Medium** |

#### Risk Summary
- **Low overall** – The majority of code uses safe access patterns.
- **Medium risk** – The `age_demographic` column’s dual possible shapes (array vs. object) can cause runtime errors if not handled.
- **Low risk** – Missing fields are generally tolerated because of optional chaining and default empty arrays.

#### Recommendations
1. **Unify source of truth** – Ensure all JSON columns conform to a single Zod schema (see Section 3.5).
2. **Clarify `age_demographic` schema** – Decide on either an array of strings (`["Adult", "Elderly"]`) or a structured object; update all records accordingly.
3. **Enforce optional chaining** – Add ESLint rule `@typescript‑eslint/no‑non‑null‑assertion` to prevent unsafe `!.` operators.
4. **Add runtime validation** – Validate incoming JSON in API routes using the same Zod schemas.

### 3.5 ETL Script Architecture Plan

*Conducted by Architect*

#### Objective
Ingest, validate, and rewrite all `MedicalContent` JSON columns to a homogeneous structure, ensuring consistency across all records and enabling reliable data processing across the PANaCEa platform.

#### Core Technology Stack
- **Runtime:** Node.js (TypeScript) – run as a one‑off script via `npm run normalize:medical‑content`.
- **AI Integration:** `@ai‑sdk/google` with `generateObject` to enforce schema compliance and fill missing fields.
- **Validation:** Zod schemas for each column, providing strict structural guarantees.
- **Database:** Prisma ORM with connection pooling for batch updates.
- **Resilience:** Exponential backoff for Gemini API rate limits, transaction‑safe updates, idempotent execution.

#### Script Logic Flow
1. **Prisma Connection Setup** – Configure client with explicit pool settings.
2. **Batch Selection** – Query records lacking `normalization_version` (or with outdated version) in batches of 50, ordered by `updatedAt`.
3. **AI‑Driven Normalization** – For each record, send all six JSON columns to Gemini with a system prompt that instructs transformation to match the Zod schemas.
4. **Validation & Error Handling** – Parse AI output with Zod; skip records that fail validation after three retries.
5. **Database Update within a Transaction** – Update the six JSON columns and set `normalization_version = "1.0.0"`.
6. **Progress Logging** – Emit logs per batch and write a summary JSON file for audit.

#### Resilience Strategies
- **Rate Limiting & Exponential Backoff** – Throttle Gemini API requests; pause with exponential backoff (1s, 2s, 4s, …) on 429/503.
- **Connection Management** – Use Prisma connection‑pool configuration; health‑check before each batch.
- **Idempotence & Safety** – Skip already‑normalized records; preserve raw JSON in an audit table; wrap each batch in a transaction; support checkpoint resume.
- **Error Logging** – Structured logging (Winston) with context; write failed‑record summaries to disk.

#### Zod Schema Definitions
```typescript
// Column‑specific schemas
export const ClinicalPearlsSchema = z.array(z.string().min(1)).default([]);
export const ClassicTriadSchema = z.array(z.string().min(1)).max(5).default([]);
export const AgeDemographicSchema = z.array(z.string().min(1)).default([]);
export const SynonymSchema = z.array(z.string().min(1)).default([]);
export const DifferentialSchema = z.object({
  condition: z.string().min(1),
  reason: z.string().optional().default(''),
});
export const DifferentialsSchema = z.array(DifferentialSchema).default([]);

// Content column schema (existing MedicalContentSchema extended)
export const MedicalContentSchema = z.object({
  condition: z.string().optional().default(''),
  system: z.string().optional().default(''),
  overview: z.string().optional(),
  diagnostics: z.string().optional(),
  treatment: z.string().optional(),
  clinical_pearls: ClinicalPearlsSchema,
  buzzwords: z.array(z.string()).default([]),
  symptoms: z.string().optional(),
  pathophysiology: z.string().optional(),
  first_line_rx: z.string().optional(),
  gold_standard_dx: z.string().optional(),
  classic_patient: z.string().optional(),
  risks: z.string().optional(),
  prognosis: z.string().optional(),
  age_demographic: z.object({
    typical: z.string().optional(),
    range: z.string().optional(),
  }).optional(),
  synonyms: SynonymSchema,
  version: z.number().optional(),
  last_updated: z.string().optional(),
});

// Unified schema for AI output
export const UnifiedMedicalContentSchema = z.object({
  content: MedicalContentSchema,
  clinical_pearls: ClinicalPearlsSchema,
  classic_triad: ClassicTriadSchema,
  age_demographic: AgeDemographicSchema,
  differentials: DifferentialsSchema,
  synonyms: SynonymSchema,
});
```

**Note:** The `age_demographic` column is normalized to a string array for simplicity; the nested‑object form is moved inside the `content` column.

### 3.6 Overall Recommendations and Prioritized Action Plan

#### High‑Priority Actions (Next 1–2 Weeks)
| Action | Owner | Effort | Impact |
|--------|-------|--------|--------|
| Add composite index `(status, system)` on `MedicalContent` | DB Admin | Low | High |
| Create `normalization_version` column in `MedicalContent` table | DB Admin | Low | Medium |
| Implement ETL script `scripts/normalize‑medical‑content.ts` | Backend Engineer | Medium | High |
| Run script in dry‑run mode to validate changes | Backend Engineer | Low | Medium |

#### Medium‑Priority Actions (Next 3–4 Weeks)
| Action | Owner | Effort | Impact |
|--------|-------|--------|--------|
| Seed database tables for static taxonomies (`MedicalTaxonomy`, `SystemMapping`) | Full‑stack | Medium | High |
| Replace `src/registries/*.ts` imports with API calls | Frontend Engineer | High | Medium |
| Update `config/rotation‑systems.ts` etc. to query database | Frontend Engineer | Medium | Medium |
| Add GIN index on `content` JSONB column | DB Admin | Low | Medium |

#### Long‑Term Actions (Next 2–3 Months)
| Action | Owner | Effort | Impact |
|--------|-------|--------|--------|
| Build admin UI for taxonomy curation | Full‑stack | High | High |
| Enforce Zod validation in all API endpoints | Backend Engineer | Medium | High |
| Migrate remaining static enumerations (e.g., `SystemCode`) to database | Full‑stack | High | Medium |
| Implement real‑time content‑versioning and rollback | Backend Engineer | High | Medium |

#### Success Metrics
- **Data Homogeneity:** 100% of `MedicalContent` records have `normalization_version = "1.0.0"`.
- **Performance:** Filtered queries (`status + system`) execute under 50 ms.
- **Maintenance:** Zero static medical‑taxonomy arrays in the frontend codebase.
- **Resilience:** No runtime errors due to malformed JSON columns.

---

## 4. Audit 3: Main Session UI & Analytics Dashboard

**Source:** `AUDIT_MAIN_SESSION_UI.md`  
**Audit Date:** 2026‑03‑01  
**Auditor:** React Specialist Elite  
**Scope:** `components/session/`, `components/quiz/`, `components/dashboard/`, `hooks/`, `lib/services/rolling360Service.ts`

### 4.1 Executive Summary

This audit evaluates the Main Session quiz components and Analytics Dashboard against three core objectives:

1. **Performance & Silent Tracking Analysis** – Verify implicit metrics (`timeToFirstClick`, `totalDwellTime`, `answerSwitches`) use non‑rendering mechanisms (`React.useRef`) and do not cause unnecessary re‑renders.  
2. **Design System Compliance (“Stormy Slate” Aesthetic)** – Ensure UI adheres to the mandated clinical modern theme (deep navy, slate grays, crisp white only) with no unauthorized colors, gradients, or gamified elements.  
3. **Data Resilience & Fetching Efficiency** – Assess the Analytics Dashboard’s robustness, empty‑state handling, `Rolling360Buffer` logic, and query optimization.

**Overall Status:** **⚠️ Requires Attention** – The codebase exhibits strong architectural patterns for data resilience and telemetry capture, but critical violations exist in silent‑tracking implementation and design‑system compliance that must be remediated before production deployment.

### 4.2 Detailed Technical Findings

#### Objective 1: Performance & Silent Tracking Analysis

| File | Line(s) | Status | Description |
|------|---------|--------|-------------|
| `hooks/useImplicitMetrics.ts` | 116 | **FAIL** | `const [metrics, setMetrics] = useState<QuestionImplicitMetrics>(createInitialMetrics);` – Stores `timeToFirstClick`, `totalDwellTime`, `answerSwitches` in React state, triggering re‑renders on every metric update. |
| `components/session/QuizView.tsx` | 392–393 | **FAIL** | `const [answerChangeCount, setAnswerChangeCount] = useState<number>(0);` – Answer‑change count stored in React state, causing re‑renders. |
| `components/quiz/Tracker.tsx` | 70–85 | **PASS** | Uses `useRef` for `firstInteractionMsRef`, `answerChangeCountRef`, `hoverMsRef` – correct non‑rendering pattern. |
| `hooks/useResponseTelemetry.ts` | 77–317 | **PASS** | All telemetry data stored in `useRef` references; no state updates. |
| `components/session/QuizView.tsx` | 1146–1148 | **REVIEW** | Implicit metrics passed to submission payload via `implicitMetrics.metrics.timeToFirstClick ?? undefined` – depends on the flawed `useImplicitMetrics` hook. |

**Summary:** The silent‑tracking requirement is violated by `useImplicitMetrics` and `QuizView`’s answer‑change state. These metrics should be moved to `useRef` or a dedicated non‑rendering store (e.g., the behavioral‑tracker context) to eliminate unnecessary component re‑renders.

#### Objective 2: Design System Compliance (“Stormy Slate” Aesthetic)

| File / Pattern | Example | Status | Description |
|----------------|---------|--------|-------------|
| CSS Custom Properties (`index.css`, `public/critical.css`) | `--color-accent: #9a8f72;` (gold) | **FAIL** | Accent color is gold, not a slate gray or deep navy. Violates the “Stormy Slate” palette. |
| Unauthorized Tailwind color classes (across 50+ files) | `bg‑blue‑500`, `bg‑green‑500`, `bg‑red‑500`, `bg‑purple‑500`, `text‑orange‑600` | **FAIL** | Hundreds of instances of unauthorized color utilities. The design system mandates semantic tokens (`bg‑surface‑primary`, `text‑action‑primary`, etc.) only. |
| `components/analytics/EmptyChartState.tsx` | `bg‑[var(‑‑color‑accent)]` | **FAIL** | Uses CSS custom property that resolves to gold. |
| `components/analytics/AnalyticsDashboard.tsx` | `bg‑data‑pass/10`, `text‑data‑pass`, `bg‑data‑fail/10`, `text‑data‑fail` | **FAIL** | Data‑status colors (green, red, orange) are not part of the approved palette. |
| Semantic token usage (`bg‑surface‑primary`, `text‑action‑muted`) | `className="bg‑surface‑primary text‑action‑muted"` | **PASS** | Correct usage of semantic tokens where present. |
| Unauthorized gradients, shadows, animations | None detected | **PASS** | No gamified progress animations or bright gradients found. |

**Summary:** The UI deviates significantly from the “Stormy Slate” aesthetic. The gold accent color and widespread use of blue/green/red/purple Tailwind classes create a visually cluttered, non‑clinical experience. All color usage must be migrated to the approved semantic‑token system.

#### Objective 3: Data Resilience & Fetching Efficiency

| File | Line(s) | Status | Description |
|------|---------|--------|-------------|
| `lib/services/rolling360Service.ts` | 267–465 | **PASS** | `updateRolling360OnSubmit` uses atomic transactions, circular‑buffer logic, and O(1) reads/writes. Robust against zombie states. |
| `lib/services/rolling360Service.ts` | 472–514 | **PASS** | `getRolling360Stats` provides O(1) dashboard reads; optional calibration‑metrics queries are guarded by `skipCalibration` flag for Edge‑runtime safety. |
| `lib/services/rolling360Service.ts` | 525–624 | **REVIEW** | `calculateCalibrationMetrics` executes separate raw SQL queries for each metric (avg response time, confidence alignment). Could be combined into a single query for minor performance gain (low impact, as queries are limited to 60 rows). |
| `components/analytics/EmptyChartState.tsx` | 161–263 | **PASS** | Unified empty‑state pattern with baseline copy (“Not yet assessed”) and diagnostic CTA – ensures UI never feels “dead.” |
| `components/analytics/AnalyticsDashboard.tsx` | 698–709, 765–775 | **PASS** | Empty‑state handling for `systemPerformanceBarData.length === 0` and `trend === 'insufficient_data'` with clear CTAs. |
| `components/analytics/AnalyticsDashboard.tsx` | 154–191 | **PASS** | Data‑fetching uses `useEffect` with proper error handling and content‑type validation. No N+1 queries in frontend layer. |

**Summary:** The data‑resilience layer is well‑engineered. The `Rolling360Buffer` pattern ensures consistent performance, empty states are handled gracefully, and the dashboard queries are optimized for the Edge runtime. The only minor improvement opportunity is consolidating calibration‑metric queries.

### 4.3 Prescriptions & Recommendations

#### 1. Silent‑Tracking Fixes
- **Immediate:** Refactor `hooks/useImplicitMetrics.ts` to store metrics in `useRef` objects. Replace `useState` with a mutable ref and emit updates via a custom event or callback only when needed for submission.
- **Immediate:** Move `answerChangeCount` and `firstSelectedAnswer` in `QuizView.tsx` to the behavioral‑tracker context (`useBehavioralTracker`) or local refs.
- **Validation:** After changes, verify that no re‑renders are triggered by metric updates (using React DevTools profiling).

#### 2. Design‑System Remediation
- **High Priority:** Replace all hardcoded Tailwind color utilities (`bg‑blue‑*`, `text‑green‑*`, etc.) with semantic tokens (`bg‑surface‑primary`, `text‑action‑primary`, `bg‑data‑pass`, etc.). Use a global search/replace with careful review.
- **High Priority:** Update `--color‑accent` in CSS to a slate gray (e.g., `#64748b`) or deep navy (`#0f172a`). Ensure the accent variable is only used for interactive elements.
- **Medium Priority:** Audit all data‑status colors (`--color‑data‑pass`, `--color‑data‑fail`, `--color‑data‑provisional`) and remap them to approved slate‑gray variants (e.g., pass = slate‑600, fail = slate‑800, provisional = slate‑400).
- **Documentation:** Create a design‑token reference in `docs/design‑tokens.md` that lists the approved semantic tokens and their mappings.

#### 3. Data‑Layer Optimizations
- **Low Priority:** Consolidate the two raw SQL queries in `calculateCalibrationMetrics` into a single query that returns both `avg_time` and confidence‑alignment aggregates. This reduces round‑trips but is low‑impact given the 60‑row limit.
- **Preventive:** Add a lint rule (ESLint) to forbid arbitrary Tailwind color classes and enforce semantic‑token usage.

#### 4. Testing & Verification
- **Add Unit Tests:** Write tests for `useImplicitMetrics` and `useBehavioralTracker` to verify that metric updates do not cause re‑renders (mock `useRef` and check `setState` calls).
- **Visual Regression:** After design‑system changes, run visual‑regression tests to ensure the “Stormy Slate” aesthetic is consistently applied.
- **Performance Profiling:** Profile the dashboard with empty, partial, and full data sets to confirm O(1) read performance and absence of N+1 queries.

---

## 5. Audit 4: AI Safety

**Source:** `AUDIT_AI_SAFETY.md`  
**Audit Date:** 2026‑03‑01  
**Auditor:** Security Auditor Pro  
**Scope:** Gemini AI integration, Edge Function resilience, Staging Lake protocol

### 5.1 Executive Summary

A comprehensive security audit of the PANaCEa project's AI architecture was conducted, focusing on three critical security domains:

1. **Anti-Hallucination (Chain of Verification)** – Review of Gemini system prompts and validation pipelines.  
2. **Edge Function Resilience** – Assessment of Cloudflare Functions error handling, timeout management, and fallback mechanisms.  
3. **Staging Lake Protocol** – Validation of AI‑generated content staging and moderation workflows.

The audit identified a **generally robust** AI safety posture with strong anti‑hallucination controls and a well‑designed staging architecture. However, several operational gaps were discovered that could impact reliability and security under failure conditions.

**Overall Risk Rating:** **MEDIUM** (Controlled)

| Domain | Status | Risk Level |
|--------|--------|------------|
| Anti‑Hallucination (CoVe) | ✅ Strong implementation | Low |
| Edge Function Resilience | ⚠️ Mixed coverage | Medium |
| Staging Lake Protocol | ⚠️ Partially implemented | Medium |

### 5.2 Detailed Findings

#### 1. Anti‑Hallucination (Chain of Verification) – **PASS**
**Risk:** Low  
**Evidence:**  
- `lib/cove‑verification.ts` implements a full 4‑step verification pipeline (extract claims, verify against database, validate answers, check distractors).  
- Gemini system prompts (e.g., OSCE patient simulator in `services/ai/geminiService.ts`) include explicit instructions to avoid volunteering information and maintain medical accuracy.  
- Zod schema validation is consistently used across all AI endpoints (`functions/api/srs/analyze‑behavior.ts`, `functions/api/osce/grade‑soap.ts`, etc.).  
- The `generate‑enhanced.ts` endpoint integrates CoVe with retry logic (max 3 attempts) and confidence scoring.

**Recommendation:** Maintain current implementation; consider adding CoVe to all generative endpoints (currently missing from some batch‑generation scripts).

#### 2. Edge Function Resilience – **PARTIAL**
**Risk:** Medium  
**Evidence:**  
- ✅ **Timeout utilities exist:** `functions/api/_shared/timeout.ts` provides `fetchWithTimeout` and `withTimeout` functions.  
- ✅ **Some endpoints use timeouts:** `functions/api/user/rolling‑360‑stats.ts` and `functions/api/user/stability‑trend.ts` correctly wrap database calls.  
- ❌ **AI endpoints lack timeout protection:** `functions/api/_shared/analyzeBehaviorGemini.ts` calls Gemini without a timeout, risking hanging requests.  
- ❌ **Missing fallback to local math:** The Ghost Grader (`analyzeBehaviorGemini`) returns a default confidence of 0.5 on API failure but does **not** fall back to the local `deriveImplicitRating` algorithm (`lib/implicit‑metrics.ts`).  
- ✅ **Graceful degradation present:** `functions/api/srs/submit.ts` catches Gemini errors and logs a warning, continuing with the user’s self‑rating.

**Impact:** Prolonged Gemini API outages or latency spikes could cause request queue buildup, increased error rates, and degraded user experience. The lack of a local fallback reduces the system’s resilience when the AI service is unavailable.

**Recommendation:**  
1. Wrap all Gemini calls with `fetchWithTimeout` (suggested timeout: 30 s).  
2. Implement a fallback to `deriveImplicitRating` when the Ghost Grader fails, preserving behavioral‑rating inference without external dependencies.  
3. Apply timeout patterns consistently across all Edge Functions that call external APIs.

#### 3. Staging Lake Protocol – **PARTIAL**
**Risk:** Medium  
**Evidence:**  
- ✅ **Staging architecture exists:** `StagingQuestion` and `PreGeneratedQuestion` tables are defined in the Prisma schema.  
- ✅ **Staging service available:** `services/core/stagingQuestionService.ts` provides `saveToStaging`, `runAdequacyCheck`, and `promoteToLive` functions.  
- ✅ **Some flows use staging:** `functions/api/questions/generate.ts` queries `findSuitableStagingQuestion` before generating new content.  
- ❌ **Bypass of staging observed:** `functions/api/questions/generate‑enhanced.ts` writes directly to the `Question` table after CoVe verification, skipping the staging table.  
- ❌ **Batch generation scripts** (e.g., `scripts/jobs/replenish‑pool.ts`) insert directly into `PreGeneratedQuestion` without staging.

**Impact:** AI‑generated content that bypasses the staging lake may enter production without adequate validation, increasing the risk of low‑quality or erroneous questions being served to users. While CoVe verification provides a safety net, the staging lake is designed to add an additional layer of human/moderation review.

**Recommendation:**  
1. Enforce a policy that **all** AI‑generated questions must first be saved to `StagingQuestion`.  
2. Modify `generate‑enhanced.ts` to call `saveToStaging` and then auto‑promote after CoVe verification (or flag for human review if verification confidence is low).  
3. Update batch‑generation scripts to use the staging service.

### 5.3 Risk Assessment Matrix

| Risk | Likelihood | Impact | Severity | Mitigation Status |
|------|------------|--------|----------|-------------------|
| Gemini API timeout causing Edge Function hangs | Medium | Medium | Medium | Partial – timeout utilities exist but not consistently used |
| Missing fallback to local rating math | High | Low | Medium | Not implemented – default confidence used |
| Staging lake bypass leading to unvalidated content | Medium | Low | Low | Partial – CoVe provides verification, but staging skipped |
| Hallucination in AI‑generated medical content | Low | High | Medium | Strong – CoVe pipeline and system prompts mitigate |
| Data leakage via system prompts | Low | High | Low | Low – prompts reviewed, no sensitive data found |

### 5.4 Recommendations

#### Immediate (Next Sprint)
1. **Add timeouts to all Gemini calls** – Wrap `fetch` in `analyzeBehaviorGemini.ts` and other AI endpoints with `fetchWithTimeout`.  
2. **Implement local fallback for Ghost Grader** – On Gemini failure, call `deriveImplicitRating` with the available telemetry and use its output.  
3. **Audit all Edge Functions** for missing timeout wrappers using a regex search (`fetchWithTimeout|withTimeout`).

#### Short‑Term (Within 30 Days)
4. **Enforce staging‑lake‑first policy** – Update `generate‑enhanced.ts` and batch scripts to save to `StagingQuestion`, then promote after adequacy checks.  
5. **Add monitoring for staging bypass** – Create a dashboard alert when questions are created directly in the `Question` table without a corresponding staging record.  
6. **Extend CoVe to batch generation** – Ensure all automated content generation runs through the verification pipeline.

#### Long‑Term (Roadmap)
7. **Implement circuit‑breaker pattern** for Gemini API calls to prevent cascade failures.  
8. **Develop a human‑review UI** for the staging lake, enabling quick moderation of flagged questions.  
9. **Run regular penetration tests** on AI endpoints to validate prompt‑injection resistance.

### 5.5 Compliance Mapping

| Control | Status | Evidence |
|---------|--------|----------|
| **AI‑Specific** | | |
| Anti‑hallucination measures | ✅ Compliant | CoVe pipeline, system prompts |
| Input/output validation | ✅ Compliant | Zod schemas on all endpoints |
| Fallback mechanisms | ⚠️ Partial | Default confidence used, no local math fallback |
| **Operational Resilience** | | |
| Timeout handling | ⚠️ Partial | Timeout utilities exist but not universally applied |
| Staging & moderation | ⚠️ Partial | Staging lake implemented but bypassed in some flows |
| **Data Security** | | |
| No secrets in prompts | ✅ Compliant | No API keys or PII found in system prompts |
| Secure error logging | ✅ Compliant | `createEndpointLogger` used, no sensitive data leaked |

---

## 6. Cross‑Cutting Themes & Overall Recommendations

### 6.1 Common Patterns Across Audits

1. **Operational Resilience Gaps** – Both the AI safety audit and the FSRS telemetry audit highlight missing fallback mechanisms (local math fallback, rapid‑guess logging). The system often relies on a single path without graceful degradation.
2. **Design‑System Inconsistency** – The UI audit reveals widespread violation of the “Stormy Slate” palette, while the database homogenization audit identifies static taxonomies that violate the “database‑first” principle. Both reflect a lack of enforcement of architectural standards.
3. **Data Integrity vs. Performance Trade‑offs** – The FSRS telemetry audit shows curated telemetry (sacrificing completeness for performance), while the database audit highlights missing indexes (sacrificing performance for flexibility). These trade‑offs should be explicitly documented and justified.
4. **Testing Coverage** – All audits prescribe unit tests as a remediation step, indicating that test coverage is insufficient for critical logic (FSRS dual‑output, implicit‑metrics, rolling‑360 calculations, CoVe verification).

### 6.2 Systemic Risks

| Risk Category | Affected Audits | Severity |
|---------------|-----------------|----------|
| Silent‑tracking violations causing re‑renders | Main Session UI | High |
| Design‑system non‑compliance | Main Session UI | High |
| Missing fallback mechanisms | AI Safety, FSRS Telemetry | Medium |
| Staging‑lake bypass | AI Safety | Medium |
| Static taxonomies violating database‑first | Database Homogenization | Medium |
| Incomplete telemetry logging | FSRS Telemetry | Medium |
| Missing database indexes | Database Homogenization | Low |

### 6.3 Prioritized Action Plan

#### High Priority (Week 1–2)
1. **Fix silent‑tracking violations** – Refactor `useImplicitMetrics` and `QuizView` answer‑change state to use `useRef`.
2. **Remediate design‑system colors** – Replace all unauthorized Tailwind color utilities with semantic tokens; update `--color‑accent`.
3. **Add rapid‑guess logging** – Ensure rapid‑guess attempts are recorded in `ReviewLog` with appropriate `sessionType`.
4. **Implement Gemini timeouts** – Wrap all Gemini API calls with `fetchWithTimeout`.
5. **Create composite index** `(status, system)` on `MedicalContent`.

#### Medium Priority (Week 3–4)
6. **Implement local fallback for Ghost Grader** – Fall back to `deriveImplicitRating` when Gemini fails.
7. **Enforce staging‑lake‑first policy** – Modify `generate‑enhanced.ts` and batch scripts to save to `StagingQuestion`.
8. **Seed static taxonomies into database tables** – Create `MedicalTaxonomy`, `SystemMapping` tables and migrate frontend registries.
9. **Add unit tests** for `deriveContinuousRating`, `drillReviewService`, `rolling360Service`, and CoVe pipeline.
10. **Consolidate calibration‑metric queries** in `rolling360Service`.

#### Long‑Term (Month 2–3)
11. **Build admin UI for taxonomy curation** – Enable runtime updates of medical taxonomies.
12. **Implement circuit‑breaker pattern** for external API calls.
13. **Add lint rules** to enforce semantic‑token usage and prevent static taxonomies.
14. **Create human‑review UI** for staging‑lake moderation.
15. **Run penetration tests** on AI endpoints.

### 6.4 Success Metrics

- **Zero re‑renders** from implicit‑metric updates (verified via React DevTools).
- **100% semantic‑token compliance** in all UI components (no arbitrary color classes).
- **All rapid‑guess attempts** logged in `ReviewLog` with `telemetry.rapid_guess = true`.
- **All Gemini calls** have timeout protection (30 s).
- **100% of AI‑generated questions** pass through `StagingQuestion`.
- **Filtered queries** (`status + system`) execute under 50 ms.
- **Unit test coverage** > 90% for core algorithms (FSRS, implicit‑metrics, rolling‑360, CoVe).

---

## 7. Appendix

### 7.1 Source Audit Files

1. **FSRS Telemetry & Dual‑Output Logic** – [`AUDIT_FSRS_TELEMETRY.md`](AUDIT_FSRS_TELEMETRY.md)  
2. **Database Homogenization** – [`AUDIT_DB_HOMOGENIZATION.md`](AUDIT_DB_HOMOGENIZATION.md)  
3. **Main Session UI & Analytics Dashboard** – [`AUDIT_MAIN_SESSION_UI.md`](AUDIT_MAIN_SESSION_UI.md)  
4. **AI Safety** – [`AUDIT_AI_SAFETY.md`](AUDIT_AI_SAFETY.md)

### 7.2 Audit Metadata

| Audit | Date | Auditor(s) | Scope |
|-------|------|------------|-------|
| FSRS Telemetry | 2026‑03‑01 | Code Reviewer Expert | `lib/fsrs.ts`, `lib/implicit‑metrics.ts`, `lib/services/drillReviewService.ts` |
| Database Homogenization | March 2026 | Database Admin Expert, Project Research, Code Skeptic, Architect | `MedicalContent` schema, frontend taxonomies, JSON resilience, ETL architecture |
| Main Session UI | 2026‑03‑01 | React Specialist Elite | `components/session/`, `components/quiz/`, `components/dashboard/`, `hooks/`, `lib/services/rolling360Service.ts` |
| AI Safety | 2026‑03‑01 | Security Auditor Pro | Gemini AI integration, Edge Function resilience, Staging Lake protocol |

### 7.3 References

- **PANaCEa Architecture Documentation** – `ARCHITECTURE_COMPLETE.md`
- **Design System Guidelines** – `docs/design‑tokens.md` (to be created)
- **Database Schema** – `prisma/schema.prisma`
- **Edge Function Patterns** – `functions/api/_shared/`

---

**Consolidated by:** Documentation Writer  
**Last Updated:** 2026‑03‑01  
**Next Review:** 2026‑04‑01