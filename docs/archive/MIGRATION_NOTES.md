# Migration Notes - Multi-System Conditions Implementation

## Breaking Changes

### 1. Async Function Signatures

The following functions in `services/conditionDataLoader.ts` have been changed from synchronous to asynchronous:

#### `getAllConditionIds()`

**Before:**

```typescript
export function getAllConditionIds(): string[];
```

**After:**

```typescript
export async function getAllConditionIds(): Promise<string[]>;
```

**Migration:**

```typescript
// Old code (synchronous)
const ids = getAllConditionIds();

// New code (async)
const ids = await getAllConditionIds();
```

#### `getConditionsBySystem()`

**Before:**

```typescript
export function getConditionsBySystem(system: string): string[];
```

**After:**

```typescript
export async function getConditionsBySystem(system: string): Promise<string[]>;
```

**Migration:**

```typescript
// Old code (synchronous)
const conditions = getConditionsBySystem('CV');

// New code (async)
const conditions = await getConditionsBySystem('CV');
```

### Why This Change?

These functions were changed to async to support the database-first RAG (Retrieval-Augmented Generation) architecture. The functions now:

1. Check the database first (if `DATABASE_URL` is set)
2. Fall back to JSON files if database is unavailable
3. Enable multi-system condition queries via `relatedSystems` field

### Impact Assessment

**Low Impact**: These functions are primarily used internally by the condition loading system. External callers are minimal:

- `data/conditionDrillData.ts` has its own implementation (not affected)
- Most question generation code already uses the async `loadConditionData()` function
- The changes enable critical database-first functionality

## Non-Breaking Changes

### 1. Database Schema Addition

Added `relatedSystems` field to `MedicalContent`:

```sql
ALTER TABLE "MedicalContent"
ADD COLUMN "relatedSystems" TEXT[] DEFAULT ARRAY[]::TEXT[];
```

**Impact**: None - defaults to empty array for existing records.

### 2. Interface Updates

Updated `LoadedConditionData` interface:

```typescript
export interface LoadedConditionData {
  // ... existing fields
  relatedSystems?: SystemCode[]; // NEW: Optional field
}
```

**Impact**: None - field is optional, existing code continues to work.

### 3. CMS Service Updates

Updated `ContentData` interface:

```typescript
export interface ContentData {
  // ... existing fields
  relatedSystems?: string[]; // NEW: Optional field
}
```

**Impact**: None - field is optional with default empty array.

## Verification Checklist

After deploying these changes, verify:

### Build & Compilation

- [x] `npm run build` completes successfully
- [x] TypeScript compilation passes without errors
- [x] Prisma client generates correctly

### Functionality (requires DATABASE_URL)

- [ ] Database migration applies cleanly
- [ ] `await getAllConditionIds()` returns expected IDs
- [ ] `await getConditionsBySystem('CV')` returns cardiovascular conditions
- [ ] Multi-system conditions appear in multiple system queries
- [ ] Existing question generation continues to work

### Backward Compatibility

- [ ] Works without database (JSON fallback)
- [ ] Existing content loads correctly
- [ ] No errors with undefined relatedSystems
- [ ] Drill modes function properly

## Rollback Plan

If issues arise, you can rollback by:

### 1. Revert Code Changes

```bash
git revert <commit-hash>
```

### 2. Remove Database Column (if needed)

```sql
DROP INDEX IF EXISTS "MedicalContent_relatedSystems_idx";
ALTER TABLE "MedicalContent" DROP COLUMN IF EXISTS "relatedSystems";
```

### 3. Restore Previous Functions

If you need synchronous versions temporarily:

```typescript
// Synchronous wrapper (emergency fallback)
export function getAllConditionIdsSync(): string[] {
  try {
    const contentFile = loadConditionContentFile();
    return Object.keys(contentFile);
  } catch (error) {
    console.error('Error getting condition IDs:', error);
    return [];
  }
}
```

## Testing Recommendations

### Unit Tests

```typescript
describe('conditionDataLoader', () => {
  it('should load condition with relatedSystems', async () => {
    const condition = await loadConditionData('PULM__interstitial__sarcoidosis');
    expect(condition).toBeDefined();
    expect(condition?.relatedSystems).toContain('DERM');
  });

  it('should query by relatedSystems', async () => {
    const dermConditions = await getConditionsBySystem('DERM');
    // Should include Sarcoidosis even though primary system is PULM
    expect(dermConditions.some((id) => id.includes('sarcoidosis'))).toBe(true);
  });

  it('should handle missing relatedSystems gracefully', async () => {
    const condition = await loadConditionData('CV__ecg__atrial_fibrillation');
    expect(condition).toBeDefined();
    // Should work even if relatedSystems is undefined or empty
    expect(condition?.relatedSystems || []).toEqual(expect.any(Array));
  });
});
```

### Integration Tests

```typescript
describe('Multi-system condition workflow', () => {
  it('should create, query, and generate questions for multi-system condition', async () => {
    // 1. Create condition with relatedSystems
    const condition = await createDraft(
      prisma,
      {
        conditionId: 'TEST__test__multi',
        system: 'PULM',
        relatedSystems: ['DERM', 'CV'],
        content: {
          /* ... */
        },
      },
      options
    );

    // 2. Query by primary system
    const pulmConditions = await getConditionsBySystem('PULM');
    expect(pulmConditions).toContain('TEST__test__multi');

    // 3. Query by related system
    const dermConditions = await getConditionsBySystem('DERM');
    expect(dermConditions).toContain('TEST__test__multi');

    // 4. Load full condition data
    const loaded = await loadConditionData('TEST__test__multi');
    expect(loaded?.relatedSystems).toEqual(['DERM', 'CV']);
  });
});
```

## Performance Considerations

### Database Queries

- GIN index on `relatedSystems` enables efficient array queries
- Query pattern: `WHERE system = 'X' OR 'X' = ANY(relatedSystems)`
- Expected query time: <10ms for typical datasets

### Caching Strategy

If you experience performance issues:

```typescript
// Add simple in-memory cache
const systemConditionsCache = new Map<string, string[]>();

export async function getConditionsBySystem(system: string): Promise<string[]> {
  if (systemConditionsCache.has(system)) {
    return systemConditionsCache.get(system)!;
  }

  const conditions = await /* ... database query ... */;
  systemConditionsCache.set(system, conditions);

  // Cache for 5 minutes
  setTimeout(() => systemConditionsCache.delete(system), 5 * 60 * 1000);

  return conditions;
}
```

## Support & Troubleshooting

### Common Issues

**Issue**: TypeScript errors about Promise<string[]> vs string[]

```
Error: Type 'Promise<string[]>' is not assignable to type 'string[]'
```

**Solution**: Add `await` before function calls:

```typescript
const ids = await getAllConditionIds();
```

**Issue**: Database query fails

```
Error: Invalid `prisma.medicalContent.findMany()` invocation
```

**Solution**: Ensure DATABASE_URL is set and migration is applied:

```bash
npx prisma migrate deploy
```

**Issue**: relatedSystems is undefined

```
Error: Cannot read property 'includes' of undefined
```

**Solution**: Use optional chaining or default to empty array:

```typescript
const related = condition.relatedSystems || [];
```

## Documentation References

- Main documentation: `MULTI_SYSTEM_CONDITIONS.md`
- Migration guide: `prisma/migrations/20251211000000_add_related_systems/README.md`
- Schema definition: `prisma/schema.prisma`
- Service implementation: `services/conditionDataLoader.ts`
- CMS service: `lib/services/cms/contentService.ts`

## Timeline

- **Development**: December 11, 2024
- **Code Review**: December 11, 2024
- **Ready for Testing**: December 11, 2024
- **Production Deployment**: Pending database migration
