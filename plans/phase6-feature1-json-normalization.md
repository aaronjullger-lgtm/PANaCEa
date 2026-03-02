# Feature Specification: JSON Column Normalization & ETL Script

## Overview
This feature addresses the audit finding that `MedicalContent` JSON columns (`classic_triad`, `clinical_pearls`, `age_demographic`, `differentials`, `synonyms`, `content`) lack a consistent schema, risking runtime errors and complicating content updates. The solution adds a `normalization_version` column to track schema compliance and provides an ETL script to migrate existing records to a standardized structure.

## Requirements

### Functional Requirements
1. **Schema Migration**
   - Add `normalization_version` column (type `String`, default `"1.0.0"`) to `MedicalContent` table.
   - Column must be nullable to allow gradual migration; default value set via application logic.

2. **Zod Schema Definitions**
   - Define Zod schemas for each JSON column based on audit‑prescribed structures (see Appendix A).
   - Schemas must be exported from a shared module (`lib/validation/medicalContentSchemas.ts`).

3. **ETL Script (`scripts/normalize‑medical‑content.ts`)**
   - **Dry‑run mode:** Output a diff of proposed changes without writing to database.
   - **Live mode:** Apply changes in batches (default 50 records per transaction) with progress logging.
   - **Resume capability:** Track processed records to allow interruption and continuation.
   - **Validation:** After each batch, verify that transformed records pass Zod schema validation.
   - **Reporting:** Generate summary report (counts of updated, skipped, failed records).

4. **Backend Validation Middleware**
   - All `MedicalContent` write endpoints (create, update) must validate incoming JSON against Zod schemas.
   - Set `normalization_version = "1.0.0"` automatically on successful validation.

5. **API Endpoint for Migration Status**
   - `GET /api/content/normalization‑status` returns:
     - Total records, normalized count, pending count
     - List of columns with non‑compliant structures (sample records)

### Non‑Functional Requirements
- **Performance:** ETL script must process 10,000 records within 15 minutes (approx. 11 records/second).
- **Safety:** No data loss; original JSON stored in backup column or logged for rollback.
- **Idempotency:** Running the script multiple times yields the same final state.
- **Observability:** Detailed logs with structured JSON for ingestion into Cloudflare Logs.
- **Edge‑runtime compatibility:** Script must run in Node.js environment (not Edge Runtime).

## Architectural Design

### Database Schema Change
```prisma
model MedicalContent {
  // existing fields...
  normalization_version String?   // new field
  @@index([normalization_version])
}
```

**Migration Strategy:**
1. Create migration with `normalization_version` as nullable `String`.
2. Deploy migration.
3. Run ETL script in dry‑run mode to verify changes.
4. Run ETL script in live mode (off‑peak hours).
5. After migration, update Prisma schema to set `@default("1.0.0")` (optional).

### Zod Schemas (Appendix A)
Refer to `MASTER_AUDIT_CONSOLIDATED.md` section 3.5 for exact schema definitions. Key schemas:

```typescript
// lib/validation/medicalContentSchemas.ts
import { z } from 'zod';

export const classicTriadSchema = z.object({
  items: z.array(z.string()).length(3),
  explanation: z.string().optional(),
  yield: z.enum(['high', 'medium', 'low']).optional(),
});

export const clinicalPearlsSchema = z.object({
  pearls: z.array(z.object({
    text: z.string(),
    source: z.string().optional(),
    yield: z.enum(['high', 'medium', 'low']).optional(),
  })),
  updatedAt: z.string().datetime().optional(),
});

export const ageDemographicSchema = z.array(z.enum([
  'Neonate', 'Infant', 'Child', 'Adolescent', 'Adult', 'Elderly'
]));

export const differentialsSchema = z.object({
  common: z.array(z.string()),
  uncommon: z.array(z.string()).optional(),
  critical: z.array(z.string()).optional(),
});

export const synonymsSchema = z.array(z.string());

export const contentSchema = z.object({
  overview: z.string().optional(),
  pathophysiology: z.string().optional(),
  epidemiology: z.string().optional(),
  etiology: z.string().optional(),
  symptoms: z.string().optional(),
  physicalExam: z.string().optional(),
  diagnostics: z.string().optional(),
  treatment: z.string().optional(),
  complications: z.string().optional(),
  prognosis: z.string().optional(),
  riskFactors: z.string().optional(),
});
```

### ETL Script Architecture
```typescript
// scripts/normalize-medical-content.ts
interface NormalizeOptions {
  dryRun: boolean;
  batchSize: number;
  startId?: string;
  logFile?: string;
}

class MedicalContentNormalizer {
  constructor(private prisma: PrismaClient, private options: NormalizeOptions) {}

  async normalizeAll(): Promise<NormalizationSummary> {
    // 1. Query records where normalization_version IS NULL OR NOT "1.0.0"
    // 2. For each batch:
    //    - Transform each JSON column using schema‐safe coercion
    //    - Validate transformed object
    //    - If dryRun: collect diff
    //    - Else: update record with normalization_version = "1.0.0"
    // 3. Log progress and errors
    // 4. Return summary
  }

  private transformRecord(record: MedicalContent): TransformedMedicalContent {
    // Apply transformation rules:
    // - If classic_triad is string, parse as JSON
    // - If age_demographic is string, split by comma
    // - Ensure arrays are arrays, objects are objects
    // - Fill missing fields with null
  }
}
```

**Transformation Rules:**
- **String to array:** `"Hypertension, Diabetes"` → `["Hypertension", "Diabetes"]`
- **String to object:** Attempt `JSON.parse`; if fails, wrap as `{ text: original }`
- **Missing fields:** Add with `null` or empty array/object as per schema.
- **Versioning:** Only update `normalization_version` if all columns pass validation.

### Integration Points
- **Prisma Client:** Use `@prisma/client` (Node.js), not edge client.
- **Logging:** Use `console.log` with structured JSON for Cloudflare Logs ingestion.
- **Error Handling:** Failed records are logged and skipped; script continues.
- **Configuration:** Environment variables for database connection (`DATABASE_URL`).

## Implementation Steps

### Step 1: Schema Migration
1. Create Prisma migration:
   ```bash
   npx prisma migrate dev --name add_normalization_version
   ```
2. Verify migration file includes `normalization_version` column.
3. Deploy migration to production database (via `prisma migrate deploy`).

### Step 2: Zod Schema Module
1. Create `lib/validation/medicalContentSchemas.ts` with exported schemas.
2. Add validation utilities:
   ```typescript
   export function validateMedicalContent(content: MedicalContent): ValidationResult {
     // validate each column
   }
   ```
3. Import schemas into existing validation layer (`lib/validation/zodSchemas.ts`).

### Step 3: ETL Script Development
1. Create `scripts/normalize-medical-content.ts` with CLI arguments (`--dry‑run`, `--batch‑size`, `--start‑id`).
2. Implement `MedicalContentNormalizer` class.
3. Add unit tests for transformation logic (`scripts/normalize‑medical‑content.test.ts`).
4. Test on local/staging database with sample data.

### Step 4: Backend Validation Middleware
1. Create middleware `validateMedicalContentJSON` to be used in `functions/api/content/*` endpoints.
2. Update `MedicalContent` create/update handlers to call middleware.
3. Ensure `normalization_version` is set automatically.

### Step 5: API Endpoint for Migration Status
1. Create `functions/api/content/normalization‑status.ts` (GET).
2. Query database for counts and sample non‑compliant records.
3. Protect endpoint with admin authentication (Clerk).

### Step 6: Integration Testing
1. Run ETL script in dry‑run mode on production data (read‑only) to estimate impact.
2. Schedule migration during maintenance window.
3. Execute live migration, monitor logs.
4. Verify post‑migration: all records have `normalization_version = "1.0.0"`.

## Success Criteria
- **Database:** 100% of `MedicalContent` records have `normalization_version = "1.0.0"`.
- **Validation:** All create/update endpoints reject invalid JSON with descriptive error messages.
- **Performance:** ETL script processes 10,000 records within 15 minutes.
- **Safety:** Zero data loss; rollback possible via backup (optional).
- **Observability:** Migration summary logged to Cloudflare Logs with structured JSON.

## Rollback Plan
1. **If migration fails:** Script is designed to be interruptible and resumable. No irreversible changes.
2. **If schema issues discovered:** Revert migration by dropping `normalization_version` column (requires another migration).
3. **Backup strategy:** Before migration, export `MedicalContent` table via `pg_dump` (handled by database admin).

## Dependencies
- Prisma migration capabilities.
- Node.js 18+ runtime for script execution.
- Access to production database (credentials via environment variables).

## Testing Plan
### Unit Tests
- Zod schema validation (positive/negative cases).
- Transformation functions (string→array, string→object, etc.).
- Batch processing logic.

### Integration Tests
- Run script against a test database with realistic fixture data.
- Verify that transformed records pass schema validation.
- Verify idempotency (running twice yields same result).

### Production Dry‑Run
- Execute script with `--dry‑run` on production database (read‑only) to generate diff report.
- Review diff for unexpected transformations.

## Timeline & Effort
- **Design & spec review:** 1 day
- **Schema migration & Zod schemas:** 2 days
- **ETL script development:** 3 days
- **Backend validation middleware:** 1 day
- **API endpoint:** 1 day
- **Testing & dry‑run:** 2 days
- **Production migration:** 1 day (scheduled)

**Total:** ~10 business days (2 weeks) for a single engineer.

## Appendix A: Full Zod Schema Definitions
See `MASTER_AUDIT_CONSOLIDATED.md` section 3.5 for complete schema definitions. Key excerpts:

```typescript
// From audit section 3.5
export const medicalContentJsonSchema = z.object({
  classic_triad: z.object({
    items: z.array(z.string()).length(3),
    explanation: z.string().optional(),
    yield: z.enum(['high', 'medium', 'low']).optional(),
  }).optional(),
  clinical_pearls: z.object({
    pearls: z.array(z.object({
      text: z.string(),
      source: z.string().optional(),
      yield: z.enum(['high', 'medium', 'low']).optional(),
    })),
    updatedAt: z.string().datetime().optional(),
  }).optional(),
  age_demographic: z.array(z.enum([
    'Neonate', 'Infant', 'Child', 'Adolescent', 'Adult', 'Elderly'
  ])).optional(),
  differentials: z.object({
    common: z.array(z.string()),
    uncommon: z.array(z.string()).optional(),
    critical: z.array(z.string()).optional(),
  }).optional(),
  synonyms: z.array(z.string()).optional(),
  content: z.object({
    overview: z.string().optional(),
    pathophysiology: z.string().optional(),
    // ... other fields
  }).optional(),
});
```

---
**Prepared by:** Architect  
**Date:** 2026‑03‑02  
**Version:** 1.0