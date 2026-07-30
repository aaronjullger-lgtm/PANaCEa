# ETL Script Architecture Plan: Normalize Medical Content

## Objective
Ingest, validate, and rewrite all `MedicalContent` JSON columns to a homogeneous structure, ensuring consistency across all records and enabling reliable data processing across the PANaCEa platform.

## Scope
Target columns:
- `content` (JSONB)
- `clinical_pearls` (JSONB)
- `classic_triad` (JSONB)
- `age_demographic` (JSONB)
- `differentials` (JSONB)
- `synonyms` (JSONB)

## Core Technology Stack
- **Runtime**: Node.js (TypeScript) – run as a one‑off script via `npm run normalize:medical‑content`.
- **AI Integration**: `@ai‑sdk/google` with `generateObject` to enforce schema compliance and fill missing fields.
- **Validation**: Zod schemas for each column, providing strict structural guarantees.
- **Database**: Prisma ORM with connection pooling for batch updates.
- **Resilience**: Exponential backoff for Gemini API rate limits, transaction‑safe updates, idempotent execution.

## Script Logic Flow

### 1. Prisma Connection Setup
```typescript
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { generateObject } from 'ai';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  // Explicit connection pool configuration
  log: ['error', 'warn'],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
```

### 2. Batch Selection
- Query records lacking a `normalization_version` field (or where version < current).
- Process in batches of **50 records** to balance throughput and memory.
- Order by `updatedAt` to prioritize recently‑touched content.

```typescript
const BATCH_SIZE = 50;
let cursor: string | undefined;

do {
  const batch = await prisma.medicalContent.findMany({
    where: {
      OR: [
        { normalization_version: null },
        { normalization_version: { lt: CURRENT_NORMALIZATION_VERSION } },
      ],
    },
    take: BATCH_SIZE,
    orderBy: { updatedAt: 'asc' },
    cursor: cursor ? { id: cursor } : undefined,
  });
  if (batch.length === 0) break;
  cursor = batch[batch.length - 1].id;
  await processBatch(batch);
} while (true);
```

### 3. AI‑Driven Normalization per Record
For each record, collect all six JSON columns and send them to Gemini with a system prompt that instructs:

> “You are a medical‑content normalization expert. Given the following raw JSON fields, transform them to match the exact Zod schemas provided. Fill missing fields with plausible, medically accurate values. Preserve all existing correct information. Return a JSON object with the six normalized fields.”

The AI call uses `generateObject` with the unified schema (see below) to guarantee output shape.

```typescript
const normalized = await generateObject({
  model: genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }),
  schema: UnifiedMedicalContentSchema,
  prompt: `Normalize the following medical‑content fields...`,
  // Include raw JSON values as part of the prompt
});
```

### 4. Validation & Error Handling
- Parse the AI output with Zod; if validation fails, log the error and skip the record (do not update).
- Compare the normalized values with the original; if identical, mark as processed without a write.
- Any record that cannot be normalized after three retries is logged for manual review.

### 5. Database Update within a Transaction
```typescript
await prisma.$transaction(async (tx) => {
  await tx.medicalContent.update({
    where: { id: record.id },
    data: {
      content: normalized.content,
      clinical_pearls: normalized.clinical_pearls,
      classic_triad: normalized.classic_triad,
      age_demographic: normalized.age_demographic,
      differentials: normalized.differentials,
      synonyms: normalized.synonyms,
      normalization_version: CURRENT_NORMALIZATION_VERSION,
      updatedAt: new Date(),
    },
  });
});
```

### 6. Progress Logging
- Emit a log every batch with counts of succeeded, skipped, and failed records.
- Write a summary JSON file at the end for audit.

## Production Resilience Strategies

### Rate Limiting & Exponential Backoff
- Gemini API has quota limits (requests per minute). Implement a token‑bucket or queue‑based throttler.
- On a 429/503 response, pause with exponential backoff (1s, 2s, 4s, … up to 32s) before retrying.
- Use a shared `Semaphore` to limit concurrent AI requests to 5.

### Connection Management
- Prisma connection pools can be exhausted by long‑running batch scripts. Configure `pool_timeout` and `connection_limit` in the `DATABASE_URL`.
- Explicitly disconnect after each batch with `prisma.$disconnect()`? **No** – keep the connection alive but use a single client for the whole script.
- Use `prisma.$queryRaw` to check connection health before each batch.

### Idempotence & Safety
- **Idempotence**: The script can be re‑run any number of times; already‑normalized records (matching `normalization_version`) are skipped.
- **No data loss**: The original raw JSON is preserved in an audit table (`MedicalContentRawBackup`) before any update.
- **Rollback capability**: Each batch is wrapped in a transaction; if any record in the batch fails, the whole batch is rolled back.
- **Checkpoint resume**: Store the last processed `id` in a local file; if the script crashes, it can resume from that checkpoint.

### Error Logging
- All errors (API, validation, database) are logged to a structured logger (Winston) with context (record ID, field, error message).
- A summary of failed records is written to `./logs/normalization‑errors‑<timestamp>.json` for later triage.

## Final Schema Definitions

### Unified Schema (Zod)
The following Zod schema defines the expected shape for **each** JSON column. All fields are optional with sensible defaults.

```typescript
import { z } from 'zod';

// ---------- Column‑specific schemas ----------
export const ClinicalPearlsSchema = z
  .array(z.string().min(1))
  .default([])
  .describe('Array of full‑sentence clinical pearls.');

export const ClassicTriadSchema = z
  .array(z.string().min(1))
  .max(5)
  .default([])
  .describe('Array of 3–5 classic triad signs; empty if no triad exists.');

export const AgeDemographicSchema = z
  .array(z.string().min(1))
  .default([])
  .describe('Age groups affected, e.g., ["Adult", "Elderly"].');

export const SynonymSchema = z
  .array(z.string().min(1))
  .default([])
  .describe('Alternative names or abbreviations for the condition.');

export const DifferentialSchema = z.object({
  condition: z.string().min(1),
  reason: z.string().optional().default(''),
});
export const DifferentialsSchema = z
  .array(DifferentialSchema)
  .default([])
  .describe('Top differential diagnoses with reason for ruling out.');

// ---------- Content Column Schema ----------
// This is the existing MedicalContentSchema extended with missing fields.
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
  age_demographic: z
    .object({
      typical: z.string().optional(),
      range: z.string().optional(),
    })
    .optional(),
  synonyms: SynonymSchema,
  version: z.number().optional(),
  last_updated: z.string().optional(),
});

// ---------- Unified Schema for AI Output ----------
export const UnifiedMedicalContentSchema = z.object({
  content: MedicalContentSchema,
  clinical_pearls: ClinicalPearlsSchema,
  classic_triad: ClassicTriadSchema,
  age_demographic: AgeDemographicSchema,
  differentials: DifferentialsSchema,
  synonyms: SynonymSchema,
});
```

**Notes**:
- The `content` column uses the existing `MedicalContentSchema` but with guaranteed defaults for array fields.
- All array fields default to empty arrays, not `null`.
- The `age_demographic` column is normalized to a string array (e.g., `["Adult", "Elderly"]`) for simplicity; the nested object form is moved inside the `content` column.
- The `differentials` column is an array of `{ condition, reason }` objects.

## Implementation Notes

### Adding a `normalization_version` Field
Add to `prisma/schema.prisma`:
```prisma
model MedicalContent {
  // … existing fields …
  normalization_version String? @default("1.0.0")
}
```
Run `prisma migrate dev` before executing the script.

### Script Invocation
Add to `package.json`:
```json
"scripts": {
  "normalize:medical-content": "tsx scripts/normalize-medical-content.ts"
}
```

### Dry‑Run Mode
Support a `--dry‑run` flag that prints changes without writing to the database.

### Monitoring & Alerting
- Integrate with Sentry for error tracking.
- Send a Slack notification upon completion or if error rate exceeds 5%.

## Conclusion
This specification provides a complete blueprint for building a robust, idempotent ETL script that homogenizes all medical‑content JSON columns using AI‑assisted normalization. The design emphasizes safety, resilience, and maintainability, ensuring the PANaCEa database remains a consistent and reliable source of high‑quality medical content.

---
*Version: 1.0.0 · Last Updated: 2026‑03‑01*