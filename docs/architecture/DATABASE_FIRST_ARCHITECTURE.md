# Database-First Architecture Implementation

## Overview

PANaCEa has been refactored to use a **database-first architecture** where all medical content is stored in and retrieved from the Supabase PostgreSQL database via Prisma. This eliminates reliance on static JSON files and enables intelligent, cost-effective database usage.

## Key Changes

### 1. conditionDataLoader.ts - Database Only

**Location**: `services/conditionDataLoader.ts`

**Changes**:

- ✅ Removed ALL filesystem (`fs`) operations
- ✅ All functions now query Prisma exclusively
- ✅ No file-based fallbacks
- ✅ Requires `DATABASE_URL` environment variable

**Functions**:

```typescript
// Load condition data by ID (on-demand, not bulk)
loadConditionData(conditionId: string): Promise<LoadedConditionData | null>

// Get all published condition IDs
getAllConditionIds(): Promise<string[]>

// Get conditions by system (supports multi-system via relatedSystems)
getConditionsBySystem(system: string): Promise<string[]>
```

**Multi-System Support**:
The `getConditionsBySystem()` function now queries both:

- Primary system match: `{ system: 'CV' }`
- Related system match: `{ relatedSystems: { has: 'CV' } }`

This allows conditions like Sarcoidosis (primary: PULM) to appear in DERM and HEENT quizzes.

### 2. Frontend Services - Database First with Fallbacks

**Location**:

- `lib/utils/dataLoader.ts`
- `lib/loadConditions.ts`
- `lib/api/contentService.ts`
- `src/conditionContent.generated.ts`
- `services/patientEncounterGenerator.ts`
- `lib/utils/apiConfig.ts` (shared API URL utility)

**Changes**:

- ✅ All services try database API endpoint first
- ✅ Graceful fallback to empty datasets if API unavailable
- ✅ No static JSON file imports (prevents build failures)
- ✅ Lazy loading - content fetched on-demand
- ✅ Shared API URL configuration utility

**Pattern**:

```typescript
import { getApiEndpoint, API_ENDPOINTS } from './utils/apiConfig';

async function loadData() {
  try {
    // 1. Try database API using shared utility
    const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);
    const response = await fetch(apiUrl);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Database API unavailable');
  }

  // 2. Return empty - content loaded on-demand
  return {};
}
```

### 3. CMS Service - relatedSystems Support

**Location**: `lib/services/cms/contentService.ts`

**Changes**:

- ✅ `ContentData` interface includes `relatedSystems?: string[]`
- ✅ `createDraft()` persists `relatedSystems` array
- ✅ All content operations preserve multi-system tags

## Database Schema

### MedicalContent Model

```prisma
model MedicalContent {
  id          String @id @default(uuid())
  conditionId String @unique
  system      String
  subcategory String
  condition   String

  // Multi-system tagging
  relatedSystems String[] @default([])

  // Content stored as JSONB
  content Json

  // Workflow state
  status  String @default("draft")
  version Int    @default(1)

  // Indexes for efficient queries
  @@index([conditionId])
  @@index([system])
  @@index([relatedSystems]) // Enables fast multi-system queries
  @@index([status])
}
```

## Efficiency & Cost Optimization

### On-Demand Loading

- **No bulk loads**: Content fetched individually via `loadConditionData()`
- **Lazy initialization**: Frontend services load data only when needed
- **Smart caching**: Client-side caching reduces repeat queries

### Indexed Queries

All database queries use indexed fields:

- `conditionId` (unique index)
- `system` (index)
- `relatedSystems` (index)
- `status` (index)

### Query Patterns

**Single Condition** (most efficient):

```typescript
const condition = await loadConditionData('CV__ecg__atrial_fibrillation');
// Uses unique index on conditionId
```

**System Filtering** (efficient):

```typescript
const conditions = await getConditionsBySystem('CV');
// Uses indexes on system + relatedSystems
```

**List All IDs** (use sparingly):

```typescript
const allIds = await getAllConditionIds();
// Returns only IDs, not full content
```

## Error Handling

### Missing Database Connection

```typescript
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not configured');
  return null; // or empty array
}
```

### Database Query Failures

```typescript
try {
  const result = await prisma.medicalContent.findUnique(...);
  return result;
} catch (error) {
  console.error('Database query failed:', error);
  return null;
}
```

### Frontend API Unavailable

```typescript
try {
  const response = await fetch('/api/content/all');
  if (response.ok) return await response.json();
} catch (error) {
  console.warn('API unavailable, using fallback');
}
return {}; // Empty dataset - load on-demand
```

## Testing

### Test Coverage

- ✅ `tests/conditionDataLoader.test.ts` - 10 tests, all passing
- Tests database-only behavior
- Tests multi-system queries
- Tests error conditions

### Running Tests

```bash
npm test -- tests/conditionDataLoader.test.ts
```

## Migration Path

### For Developers

**Old (File-Based)**:

```typescript
const content = loadConditionContentFile();
const condition = content[conditionId];
```

**New (Database-First)**:

```typescript
const condition = await loadConditionData(conditionId);
```

### For Scripts

Scripts that previously used JSON files should:

1. Import from `services/conditionDataLoader`
2. Use async/await for database queries
3. Ensure `DATABASE_URL` is set

## Environment Variables

### Required

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true"
```

### Optional

```bash
DIRECT_DATABASE_URL="postgresql://..." # For migrations (bypass pooler)
VITE_API_URL="http://localhost:3001"   # API base URL (defaults to localhost:3001)
```

### API Configuration

The `lib/utils/apiConfig.ts` utility provides centralized API URL management:

- Automatically detects browser vs server environment
- Uses `VITE_API_URL` environment variable
- Falls back to `http://localhost:3001`
- Provides type-safe endpoint definitions

```typescript
import { getApiEndpoint, API_ENDPOINTS } from './utils/apiConfig';

// Get full URL for content endpoint
const url = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);
// Returns: "http://localhost:3001/api/content/all" (or production URL)
```

## Production Deployment

### Cloudflare Pages

1. Set `DATABASE_URL` environment variable
2. Build succeeds with no JSON file dependencies
3. Frontend uses `/api/content/all` endpoint
4. Serverless functions query database directly

### Traditional Node Server

1. Set `DATABASE_URL` in `.env`
2. Run `npm run dev:all` for full stack
3. Backend (`server.ts`) handles database queries
4. Frontend connects via proxy

## Performance Considerations

### Connection Pooling

- Use Supabase "Transaction" mode for serverless
- Add `?pgbouncer=true` to connection string
- Prisma Accelerate extension for edge runtime

### Query Optimization

- Always filter by `status: 'published'`
- Use indexes for all WHERE clauses
- Fetch only needed fields with `select`

### Caching Strategy

- Client-side: Cache API responses in memory
- Server-side: Consider Redis for hot paths
- Database: Prisma Accelerate provides query caching

## Troubleshooting

### Build Fails

- Ensure no static JSON imports remain
- Check TypeScript types are correct
- Run `npm run build` to verify

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly
- Check Supabase project is active
- Test connection with `npx prisma db pull`

### Missing Content

- Verify content is `published` in database
- Check `conditionId` format is correct
- Use `npx prisma studio` to inspect data

## Future Enhancements

1. **Query Result Caching**: Implement Redis for frequently accessed conditions
2. **Full-Text Search**: Add PostgreSQL full-text search on content
3. **Content Versioning**: Leverage ContentVersion table for rollbacks
4. **Real-Time Updates**: Use Supabase subscriptions for live content updates
5. **Analytics**: Track most-queried conditions for optimization

## Related Documentation

- `DATABASE_IMPLEMENTATION.md` - Database schema details
- `ADMIN_CMS_IMPLEMENTATION.md` - CMS workflow
- `MULTI_SYSTEM_CONDITIONS.md` - Cross-system tagging
- `DEVELOPER_GUIDE.md` - General development guide
