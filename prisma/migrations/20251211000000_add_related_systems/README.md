# Migration: Add relatedSystems to MedicalContent

**Date:** December 11, 2024  
**Purpose:** Enable multi-system condition support for cross-listed medical conditions

## What This Migration Does

Adds a `relatedSystems` array field to the `MedicalContent` table to support conditions that belong to multiple organ systems.

### Schema Changes

1. **New Column:** `relatedSystems TEXT[]` with default empty array
2. **New Index:** GIN index on `relatedSystems` for efficient array queries
3. **Documentation:** Column comments explaining primary vs related systems

## Why This Change?

Some medical conditions (e.g., Sarcoidosis, SLE, Syphilis) affect multiple organ systems. Previously, these would need duplicate entries in different systems, creating a maintenance nightmare. With `relatedSystems`, we maintain a single source of truth:

```
Sarcoidosis:
  system: "PULM" (primary)
  relatedSystems: ["DERM", "HEENT", "CV"]
```

When a user takes a Dermatology quiz, the query searches:

```sql
WHERE system = 'DERM' OR 'DERM' = ANY(relatedSystems)
```

## How to Apply

### For Development (using Prisma)

```bash
npx prisma migrate deploy
```

### For Production (direct SQL)

```bash
psql $DATABASE_URL -f prisma/migrations/20251211000000_add_related_systems/migration.sql
```

### Verify Migration

```sql
-- Check column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'MedicalContent' AND column_name = 'relatedSystems';

-- Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'MedicalContent' AND indexname = 'MedicalContent_relatedSystems_idx';
```

## Backward Compatibility

- ✅ Existing records automatically get empty array `[]` as default
- ✅ Queries without `relatedSystems` continue to work (optional field)
- ✅ JSON file fallback maintained for development without database
- ✅ All loader functions check database first, then fall back to JSON

## Example Usage

### Creating Content with Related Systems

```typescript
import { createDraft } from './lib/services/cms/contentService';

await createDraft(
  prisma,
  {
    conditionId: 'PULM__interstitial__sarcoidosis',
    system: 'PULM',
    subcategory: 'Interstitial',
    condition: 'Sarcoidosis',
    relatedSystems: ['DERM', 'HEENT', 'CV'],
    content: {
      /* ... */
    },
  },
  options
);
```

### Querying Multi-System Conditions

```typescript
import { getConditionsBySystem } from './services/conditionDataLoader';

// Gets all dermatology conditions including those with relatedSystems: ['DERM']
const dermConditions = await getConditionsBySystem('DERM');
```

## Testing

After applying the migration:

1. Verify schema with `npx prisma db pull`
2. Test queries with multi-system conditions
3. Check that existing functionality still works
4. Validate index performance on large datasets

## Rollback

If needed, remove the column (will lose relatedSystems data):

```sql
DROP INDEX IF EXISTS "MedicalContent_relatedSystems_idx";
ALTER TABLE "MedicalContent" DROP COLUMN IF EXISTS "relatedSystems";
```

## Related Files

- `prisma/schema.prisma` - Schema definition
- `services/conditionDataLoader.ts` - Data loading with relatedSystems support
- `lib/services/cms/contentService.ts` - CMS operations
- `conditionRegistry.ts` - ConditionMeta interface already has relatedSystems
