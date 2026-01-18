# Multi-System Conditions Architecture

## Overview

This document describes the architecture for handling medical conditions that affect multiple organ systems (e.g., Sarcoidosis, SLE, Syphilis).

## Problem Statement

Many medical conditions affect multiple organ systems:

- **Sarcoidosis**: Primarily pulmonary, but also causes skin lesions (erythema nodosum), eye issues (uveitis), and cardiac conduction blocks
- **Systemic Lupus Erythematosus (SLE)**: Affects musculoskeletal, dermatology, renal, hematology, cardiovascular, and neurology systems
- **Syphilis**: Infectious disease that can present with skin rashes (secondary), neurological symptoms (neurosyphilis), and cardiovascular complications

### The Old Approach (Duplicates)

Previously, you might create separate entries:

```
PULM__interstitial__sarcoidosis
DERM__skin_lesions__sarcoidosis
HEENT__eye__sarcoidosis
```

**Problems:**

- ❌ Maintenance nightmare: Updating one doesn't update others
- ❌ Content drift: Different versions become inconsistent
- ❌ Wasted storage: Duplicate large content blobs
- ❌ User confusion: Same condition appears as different entities

### The New Approach (Tags + Context)

Single source of truth with system tags:

```json
{
  "conditionId": "PULM__interstitial__sarcoidosis",
  "condition": "Sarcoidosis",
  "system": "PULM",
  "relatedSystems": ["DERM", "HEENT", "CV"],
  "content": {
    /* single authoritative content */
  }
}
```

**Benefits:**

- ✅ Single source of truth
- ✅ Easy to maintain and update
- ✅ No duplicate content
- ✅ AI can focus questions based on context

## Architecture

### 1. Database Schema

```prisma
model MedicalContent {
  id             String   @id @default(uuid())
  conditionId    String   @unique
  system         String   // Primary system (e.g., "PULM")
  relatedSystems String[] @default([]) // Related systems (e.g., ["DERM", "HEENT"])
  subcategory    String
  condition      String
  content        Json
  // ... other fields

  @@index([system])
  @@index([relatedSystems]) // GIN index for array queries
}
```

### 2. Data Structure

```typescript
interface LoadedConditionData {
  conditionId: string;
  name: string;
  system: string; // Primary system
  subcategory: string;
  relatedSystems?: SystemCode[]; // NEW: Related systems
  meta: ConditionMeta;
  content: ConditionContentData;
}
```

### 3. Query Strategy

When a user takes a Dermatology quiz:

```typescript
// Get all conditions relevant to DERM system
const dermConditions = await getConditionsBySystem('DERM');

// SQL Query executed:
// SELECT * FROM "MedicalContent"
// WHERE status = 'published'
//   AND (system = 'DERM' OR 'DERM' = ANY(relatedSystems))
```

This returns:

- Conditions with `system: "DERM"` (primary dermatology conditions)
- Conditions with `relatedSystems: ["DERM", ...]` (e.g., Sarcoidosis, SLE)

### 4. Context-Aware AI Prompting

The real power comes from context injection during question generation:

```typescript
// User is studying Dermatology
const system = 'DERM';
const condition = await loadConditionData('PULM__interstitial__sarcoidosis');

// Generate question with context
const prompt = `
Generate a PANCE-style vignette for ${condition.name}.

CONTEXT: The student is studying ${system}.

INSTRUCTIONS:
- Focus on ${system}-specific manifestations
- For Sarcoidosis in DERM: Emphasize cutaneous findings (erythema nodosum, lupus pernio)
- You may mention pulmonary findings as context, but the key diagnostic reasoning should be dermatological
- Choose distractors that are other ${system} conditions

AVOID:
- Making this a pure pulmonology question
- Focusing only on bilateral hilar adenopathy
`;
```

## Implementation Guide

### Step 1: Apply Database Migration

```bash
# Apply the schema change
npx prisma migrate deploy

# Or for production
psql $DATABASE_URL -f prisma/migrations/20251211000000_add_related_systems/migration.sql
```

### Step 2: Populate relatedSystems

```bash
# Run the migration script to populate common multi-system conditions
npm run migrate:related-systems
```

This automatically populates relatedSystems for conditions like:

- Sarcoidosis → ["DERM", "HEENT", "CV", "NEURO"]
- SLE → ["DERM", "RENAL", "HEME", "CV", "NEURO"]
- Syphilis → ["DERM", "NEURO", "CV"]
- HIV/AIDS → ["DERM", "NEURO", "GI", "PULM"]
- And 20+ more common multi-system conditions

### Step 3: Create Content with relatedSystems

```typescript
import { createDraft } from './lib/services/cms/contentService';

await createDraft(
  prisma,
  {
    conditionId: 'PULM__interstitial__sarcoidosis',
    system: 'PULM',
    subcategory: 'Interstitial',
    condition: 'Sarcoidosis',
    relatedSystems: ['DERM', 'HEENT', 'CV', 'NEURO'], // NEW
    content: {
      overview: '...',
      clinicalPresentation: '...',
      // ... rest of content
    },
  },
  options
);
```

### Step 4: Query Multi-System Conditions

```typescript
import { getConditionsBySystem } from './services/conditionDataLoader';

// Get all conditions for a system (includes relatedSystems)
const dermConditions = await getConditionsBySystem('DERM');

// Load specific condition with relatedSystems
const condition = await loadConditionData('PULM__interstitial__sarcoidosis');
console.log(condition.relatedSystems); // ['DERM', 'HEENT', 'CV', 'NEURO']
```

## Common Multi-System Conditions

### Pulmonology Primary

- **Sarcoidosis** → DERM, HEENT, CV, NEURO
- **Tuberculosis** → ID, NEURO, MSK, GU

### Rheumatology/MSK Primary

- **SLE** → DERM, RENAL, HEME, CV, NEURO
- **Scleroderma** → DERM, GI, PULM, RENAL, CV
- **Dermatomyositis** → DERM, PULM, CV
- **Vasculitis** → DERM, RENAL, NEURO, PULM

### Infectious Disease Primary

- **Syphilis** → DERM, NEURO, CV
- **HIV/AIDS** → DERM, NEURO, GI, PULM
- **Lyme Disease** → MSK, NEURO, CV, DERM

### Endocrine Primary

- **Diabetes Mellitus** → CV, RENAL, NEURO, DERM
- **Hyperthyroidism** → CV, NEURO, MSK, HEENT
- **Hypothyroidism** → CV, NEURO, DERM, GI

### Hematology Primary

- **Amyloidosis** → CV, RENAL, GI, NEURO
- **Hemochromatosis** → ENDO, CV, MSK, GI

### Gastroenterology Primary

- **Wilson's Disease** → NEURO, PSYCH, HEENT
- **IBD/Crohn's/UC** → MSK, DERM, HEENT

## AI Question Generation Examples

### Example 1: Sarcoidosis in Dermatology Quiz

**Context-Aware Prompt:**

```
Generate a question for Sarcoidosis.
Context: Dermatology exam.
Focus: Cutaneous manifestations (erythema nodosum, lupus pernio).
Distractors: Other skin conditions (rosacea, cellulitis, Sweet syndrome).
```

**Generated Question:**

> A 35-year-old African American woman presents with tender red nodules on her shins and dry cough. Chest X-ray shows bilateral hilar adenopathy. Skin biopsy reveals non-caseating granulomas. What is the diagnosis?

### Example 2: Sarcoidosis in Pulmonology Quiz

**Context-Aware Prompt:**

```
Generate a question for Sarcoidosis.
Context: Pulmonology exam.
Focus: Pulmonary manifestations (bilateral hilar LAD, restrictive pattern).
Distractors: Other ILD conditions (IPF, hypersensitivity pneumonitis).
```

**Generated Question:**

> A 40-year-old presents with dyspnea and dry cough. PFTs show restrictive pattern. CT chest reveals bilateral hilar lymphadenopathy and upper lobe fibrosis. BAL shows CD4/CD8 ratio >3.5. What is the diagnosis?

### Example 3: SLE in Nephrology Quiz

**Context-Aware Prompt:**

```
Generate a question for SLE.
Context: Nephrology exam.
Focus: Lupus nephritis, proteinuria, renal involvement.
Distractors: Other glomerular diseases.
```

## Testing Strategy

### Unit Tests

```typescript
describe('getConditionsBySystem with relatedSystems', () => {
  it('should return conditions with matching primary system', async () => {
    const conditions = await getConditionsBySystem('DERM');
    expect(conditions).toContain('DERM__rash__eczema');
  });

  it('should return conditions with matching relatedSystems', async () => {
    const conditions = await getConditionsBySystem('DERM');
    expect(conditions).toContain('PULM__interstitial__sarcoidosis');
  });

  it('should not duplicate conditions', async () => {
    const conditions = await getConditionsBySystem('DERM');
    const unique = new Set(conditions);
    expect(conditions.length).toBe(unique.size);
  });
});
```

### Integration Tests

```typescript
describe('Multi-system condition workflow', () => {
  it('should create condition with relatedSystems', async () => {
    const condition = await createDraft(
      prisma,
      {
        conditionId: 'TEST__test__multi_system',
        system: 'CV',
        relatedSystems: ['NEURO', 'DERM'],
        // ...
      },
      options
    );

    expect(condition.relatedSystems).toEqual(['NEURO', 'DERM']);
  });

  it('should query by relatedSystems', async () => {
    const neuroConditions = await getConditionsBySystem('NEURO');
    expect(neuroConditions).toContain('TEST__test__multi_system');
  });
});
```

## Backward Compatibility

All changes are backward compatible:

1. **Empty Arrays**: Existing records without relatedSystems get `[]` by default
2. **Optional Fields**: All interfaces use `relatedSystems?` (optional)
3. **Fallback Logic**: JSON file loading still works without database
4. **Graceful Degradation**: Queries work with or without relatedSystems

## Performance Considerations

- **GIN Index**: Array queries use GIN index for efficient lookups
- **Published Only**: Queries filter `status = 'published'` to avoid unpublished content
- **Caching**: Consider caching condition lists by system in production
- **Lazy Loading**: Large data files (conditions.json) use code splitting

## Future Enhancements

1. **AI Tagging Script**: Auto-generate relatedSystems using AI analysis
2. **Visual Editor**: UI for managing relatedSystems in CMS
3. **Smart Suggestions**: Recommend relatedSystems based on content analysis
4. **Analytics**: Track which system contexts generate best learning outcomes
5. **Severity Levels**: Add `primary` vs `secondary` system tagging

## Migration Checklist

- [x] Update Prisma schema with relatedSystems field
- [x] Create database migration SQL
- [x] Add GIN index for array queries
- [x] Update conditionDataLoader.ts service
- [x] Update CMS contentService.ts
- [x] Create migration script with auto-population
- [x] Add npm script for easy execution
- [x] Document common multi-system conditions
- [x] Add backward compatibility safeguards
- [ ] Test with real database (requires DATABASE_URL)
- [ ] Populate production data
- [ ] Update AI prompting to use context
- [ ] Add analytics for multi-system questions

## Support

For questions or issues:

1. Check migration README: `prisma/migrations/20251211000000_add_related_systems/README.md`
2. Review this documentation
3. Run migration script: `npm run migrate:related-systems`
4. Verify with Prisma Studio: `npm run db:studio`

## Related Files

- `prisma/schema.prisma` - Schema definition
- `services/conditionDataLoader.ts` - Data loading logic
- `lib/services/cms/contentService.ts` - CMS operations
- `scripts/migrateRelatedSystems.ts` - Population script
- `conditionRegistry.ts` - Type definitions
