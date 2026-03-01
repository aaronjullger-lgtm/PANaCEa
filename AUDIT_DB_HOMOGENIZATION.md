# Database Homogenization Audit Report

**Project:** PANaCEa (Physician Assistant National Certifying Exam Adaptive Engine)  
**Audit Date:** March 2026  
**Audit Team:** Database Admin Expert, Project Research, Code Skeptic, Architect  
**Report Version:** 1.0

---

## Executive Summary

This audit synthesizes findings from four independent investigations into the PANaCEa database homogenization effort. The goal is to ensure a single source of truth for medical content, eliminate static taxonomies, and guarantee consistent JSON structure across all `MedicalContent` records.

**Key Findings:**

1. **Schema & Data Model** – The `MedicalContent` table contains six JSONB columns with heterogeneous shapes. Query patterns are served by existing single‑column indexes, but a composite index on `(status, system)` is missing, affecting filtered lookups.
2. **Frontend Homogeneity** – 54 instances of static medical taxonomies were identified across components, config files, and registries. These violate the “database‑first” principle and create maintenance overhead.
3. **JSON Resilience** – Most JSON access patterns use optional chaining and guards, but a few brittle direct accesses exist. The `age_demographic` column poses medium risk due to ambiguous schema.
4. **ETL Architecture** – A fully‑specified script (`scripts/normalize‑medical‑content.ts`) can homogenize all JSON columns using AI‑assisted normalization, Zod validation, and production‑grade resilience.

**Recommendation:** Implement the ETL script as the primary vehicle for data homogenization, followed by systematic migration of static taxonomies to database tables and the addition of missing indexes.

---

## 1. Schema & Data Model Audit

*Conducted by Database Admin Expert*

### 1.1 Table Overview
- **Table:** `MedicalContent`
- **Fields:** 45+ columns, six JSONB columns:
  - `content` – Main clinical narrative, diagnostics, treatment, etc.
  - `clinical_pearls` – Array of key teaching points.
  - `classic_triad` – Array of classic triad signs.
  - `age_demographic` – Age‑group information (ambiguous shape).
  - `differentials` – Differential diagnoses with reasons.
  - `synonyms` – Alternative condition names.
- **Current Indexes:** Single‑column indexes on `conditionId`, `createdBy`, `status`, `system`, `updatedAt`.

### 1.2 Query Patterns
| Pattern | Frequency | Performance |
|---------|-----------|-------------|
| `WHERE status = 'PUBLISHED' AND system = 'CV'` | High | **Missing composite index** |
| `WHERE system IN (...)` | Medium | Covered by `system` index |
| `WHERE status = 'DRAFT'` | Low | Covered by `status` index |
| JSONB field access (`content->>'condition'`) | High | No GIN index on `content` |

### 1.3 Index Recommendations

| Index | Type | Rationale |
|-------|------|-----------|
| `(status, system)` | Composite B‑Tree | Accelerates the most frequent filtered queries |
| `(system, status)` | Composite B‑Tree | Alternative if `system` selectivity is higher |
| `content` (JSONB) | GIN (`jsonb_path_ops`) | Enables efficient searches within the `content` field |
| `(updatedAt DESC)` | Single column (existing) | Already present; keep for batch‑processing order |

### 1.4 Data Integrity Observations
- JSON columns allow `null` as well as empty arrays/objects, leading to inconsistent default handling.
- No database‑level constraints enforce shape uniformity across records.
- The `normalization_version` field (proposed) will track which records have been homogenized.

---

## 2. Frontend Homogeneity Compliance Check

*Conducted by Project Research*

### 2.1 Static Taxonomy Inventory

| Category | File Pattern | Violation Count | Example |
|----------|--------------|-----------------|---------|
| Component‑level mappings | `SYSTEM_NAMES`, `SYSTEM_ICONS` | 12 | `components/SystemBadge.tsx` |
| Type‑level enumerations | `SystemCode` union type | 1 | `src/types/conditions.ts` |
| Configuration arrays | `config/*.ts` | 8 | `config/rotation‑systems.ts` |
| Medical registries | `src/registries/*.ts` | 33 | `src/registries/drugRegistry.ts` |
| **Total** | **4 categories** | **54 instances** | |

### 2.2 High‑Density Violation Areas
1. **`src/registries/`** – 13 registry files, each containing arrays of medical terms (drugs, lab tests, symptoms, etc.).
2. **`config/rotation‑systems.ts`** – Hard‑coded mapping of clinical rotations to organ systems.
3. **`config/specialty‑caq.ts`** – Static specialty‑to‑system mappings.
4. **`config/training‑modes.ts`** – Training‑mode definitions with embedded system lists.

### 2.3 Migration Recommendations
- **Short‑term:** Create database tables (`MedicalTaxonomy`, `SystemMapping`, `RegistryEntry`) and seed them with the static data.
- **Medium‑term:** Replace frontend imports with API calls (`/api/taxonomy/{type}`) that fetch from the database.
- **Long‑term:** Implement an admin UI for curating taxonomies, enabling runtime updates without code deploys.

**Priority:** High – these static arrays are the primary obstacle to a true database‑first architecture.

---

## 3. Content JSON Resilience Analysis

*Conducted by Code Skeptic*

### 3.1 JSON Column Structure Hierarchy

| Column | Expected Shape | Default |
|--------|----------------|---------|
| `content` | `{ condition, system, overview, diagnostics, treatment, … }` | `{}` |
| `clinical_pearls` | `string[]` | `[]` |
| `classic_triad` | `string[]` (max 5) | `[]` |
| `age_demographic` | `string[]` **or** `{ typical, range }` | `[]` (ambiguous) |
| `differentials` | `Array<{ condition: string, reason?: string }>` | `[]` |
| `synonyms` | `string[]` | `[]` |

### 3.2 Robustness Assessment

| Pattern | Location | Robustness | Risk |
|---------|----------|------------|------|
| Optional chaining (`?.`) | Most frontend components | High | Low |
| Guard clauses (`if (field)`) | Backend API handlers | Medium | Low |
| Direct property access (`obj.field`) | Few legacy components | Low | Medium |
| `age_demographic` shape assumption | Multiple places | Low | **Medium** |

### 3.3 Risk Summary
- **Low overall** – The majority of code uses safe access patterns.
- **Medium risk** – The `age_demographic` column’s dual possible shapes (array vs. object) can cause runtime errors if not handled.
- **Low risk** – Missing fields are generally tolerated because of optional chaining and default empty arrays.

### 3.4 Recommendations
1. **Unify source of truth** – Ensure all JSON columns conform to a single Zod schema (see Section 4).
2. **Clarify `age_demographic` schema** – Decide on either an array of strings (`["Adult", "Elderly"]`) or a structured object; update all records accordingly.
3. **Enforce optional chaining** – Add ESLint rule `@typescript‑eslint/no‑non‑null‑assertion` to prevent unsafe `!.` operators.
4. **Add runtime validation** – Validate incoming JSON in API routes using the same Zod schemas.

---

## 4. ETL Script Architecture Plan

*Conducted by Architect*

### 4.1 Objective
Ingest, validate, and rewrite all `MedicalContent` JSON columns to a homogeneous structure, ensuring consistency across all records and enabling reliable data processing across the PANaCEa platform.

### 4.2 Core Technology Stack
- **Runtime:** Node.js (TypeScript) – run as a one‑off script via `npm run normalize:medical‑content`.
- **AI Integration:** `@ai‑sdk/google` with `generateObject` to enforce schema compliance and fill missing fields.
- **Validation:** Zod schemas for each column, providing strict structural guarantees.
- **Database:** Prisma ORM with connection pooling for batch updates.
- **Resilience:** Exponential backoff for Gemini API rate limits, transaction‑safe updates, idempotent execution.

### 4.3 Script Logic Flow
1. **Prisma Connection Setup** – Configure client with explicit pool settings.
2. **Batch Selection** – Query records lacking `normalization_version` (or with outdated version) in batches of 50, ordered by `updatedAt`.
3. **AI‑Driven Normalization** – For each record, send all six JSON columns to Gemini with a system prompt that instructs transformation to match the Zod schemas.
4. **Validation & Error Handling** – Parse AI output with Zod; skip records that fail validation after three retries.
5. **Database Update within a Transaction** – Update the six JSON columns and set `normalization_version = "1.0.0"`.
6. **Progress Logging** – Emit logs per batch and write a summary JSON file for audit.

### 4.4 Resilience Strategies
- **Rate Limiting & Exponential Backoff** – Throttle Gemini API requests; pause with exponential backoff (1s, 2s, 4s, …) on 429/503.
- **Connection Management** – Use Prisma connection‑pool configuration; health‑check before each batch.
- **Idempotence & Safety** – Skip already‑normalized records; preserve raw JSON in an audit table; wrap each batch in a transaction; support checkpoint resume.
- **Error Logging** – Structured logging (Winston) with context; write failed‑record summaries to disk.

### 4.5 Zod Schema Definitions
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

---

## 5. Overall Recommendations and Prioritized Action Plan

### 5.1 High‑Priority Actions (Next 1–2 Weeks)
| Action | Owner | Effort | Impact |
|--------|-------|--------|--------|
| Add composite index `(status, system)` on `MedicalContent` | DB Admin | Low | High |
| Create `normalization_version` column in `MedicalContent` table | DB Admin | Low | Medium |
| Implement ETL script `scripts/normalize‑medical‑content.ts` | Backend Engineer | Medium | High |
| Run script in dry‑run mode to validate changes | Backend Engineer | Low | Medium |

### 5.2 Medium‑Priority Actions (Next 3–4 Weeks)
| Action | Owner | Effort | Impact |
|--------|-------|--------|--------|
| Seed database tables for static taxonomies (`MedicalTaxonomy`, `SystemMapping`) | Full‑stack | Medium | High |
| Replace `src/registries/*.ts` imports with API calls | Frontend Engineer | High | Medium |
| Update `config/rotation‑systems.ts` etc. to query database | Frontend Engineer | Medium | Medium |
| Add GIN index on `content` JSONB column | DB Admin | Low | Medium |

### 5.3 Long‑Term Actions (Next 2–3 Months)
| Action | Owner | Effort | Impact |
|--------|-------|--------|--------|
| Build admin UI for taxonomy curation | Full‑stack | High | High |
| Enforce Zod validation in all API endpoints | Backend Engineer | Medium | High |
| Migrate remaining static enumerations (e.g., `SystemCode`) to database | Full‑stack | High | Medium |
| Implement real‑time content‑versioning and rollback | Backend Engineer | High | Medium |

### 5.4 Success Metrics
- **Data Homogeneity:** 100% of `MedicalContent` records have `normalization_version = "1.0.0"`.
- **Performance:** Filtered queries (`status + system`) execute under 50 ms.
- **Maintenance:** Zero static medical‑taxonomy arrays in the frontend codebase.
- **Resilience:** No runtime errors due to malformed JSON columns.

---

## Appendix: References to Source Audit Documents

1. **Schema & Data Model Audit** – Internal summary from Database Admin Expert (see `DATABASE_INDEXING_STRATEGY.md`).
2. **Frontend Homogeneity Compliance Check** – Detailed inventory from Project Research (see `AUDIT_FINDINGS.md`).
3. **Content JSON Resilience Analysis** – Robustness assessment from Code Skeptic (see `AUDIT_JSON_RESILIENCE.md`).
4. **ETL Script Architecture Plan** – Full specification from Architect (see `docs/normalize‑medical‑content‑spec.md`).

---

**Report generated by:** Documentation Writer  
**Last Updated:** 2026‑03‑01  
**Next Review:** 2026‑04‑01