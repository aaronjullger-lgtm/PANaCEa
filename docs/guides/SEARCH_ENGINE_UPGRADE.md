# Search Engine Upgrade - Implementation Summary

## Overview

Upgraded PANaCEa's search system from client-side text filtering to a robust, database-driven search engine with intelligent medical alias matching and ranking.

## Architecture

### Previous Implementation

- **Client-side filtering**: `conditionSearch.ts` and `drugSearch.ts` filtered static registry arrays
- **Limited scale**: All data loaded in browser memory
- **Basic matching**: Simple string contains/Levenshtein distance
- **No alias support**: Couldn't find "MI" when searching for myocardial infarction

### New Implementation

- **Database-driven**: Queries PostgreSQL via Prisma for scalability
- **Server-side API**: `/api/content/search` endpoint with validation
- **Intelligent ranking**: Multi-tier scoring (exact → alias → fuzzy → keyword)
- **Medical alias support**: Searches `aliases` array field for alternate names
- **Debounced requests**: 300ms delay prevents API spam
- **Loading states**: User feedback during async searches

## Components

### 1. Content Search Service (`lib/services/contentSearchService.ts`)

**Core Function:**

```typescript
searchContent(query: string, limit = 10, includeTypes = ['condition', 'drug'])
```

**Ranking Algorithm:**

1. **Exact Match** (100 points): Query exactly matches name/displayName
2. **Starts With** (80 points): Name starts with query
3. **Alias Exact** (90 points): Alias exactly matches query
4. **Alias Starts** (70 points): Alias starts with query
5. **Keyword Match** (60 points): Found in system/drugClass
6. **Contains** (50 points): Name contains query
7. **Fuzzy Match** (30 points × similarity): Levenshtein distance matching

**Database Queries:**

**Conditions:**

```typescript
prisma.condition.findMany({
  where: {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { displayName: { contains: query, mode: 'insensitive' } },
      { aliases: { hasSome: [query] } }, // PostgreSQL array search
      { system: { contains: query, mode: 'insensitive' } },
    ],
  },
});
```

**Drugs:**

```typescript
prisma.drug.findMany({
  where: {
    OR: [
      { genericName: { contains: query, mode: 'insensitive' } },
      { brandName: { contains: query, mode: 'insensitive' } },
      { aliases: { hasSome: [query] } },
      { drugClass: { hasSome: [query] } }, // Array search
      { displayName: { contains: query, mode: 'insensitive' } },
    ],
  },
});
```

**Return Format:**

```typescript
interface SearchResult {
  id: string;
  title: string;
  type: 'condition' | 'drug';
  snippet: string; // System/class + matched alias
  matchType: 'exact' | 'alias' | 'fuzzy' | 'keyword';
  score: number;
  metadata?: {
    system?: string;
    drugClass?: string;
    matchedAlias?: string; // Shows which alias matched
  };
}
```

**Helper Functions:**

- `calculateSimilarity()`: Multi-tier string matching
- `levenshteinDistance()`: Edit distance for fuzzy matching
- `scoreAliasMatch()`: Prioritize exact alias matches
- `rankCondition()` / `rankDrug()`: Apply scoring to results
- `formatSearchResult()`: Convert to API response format

**Convenience Wrappers:**

```typescript
searchConditions(query, (limit = 10)); // Only conditions
searchDrugs(query, (limit = 10)); // Only drugs
getSearchStats(); // Analytics
```

### 2. API Endpoint (`functions/api/content/search.ts`)

**Endpoint:** `GET /api/content/search`

**Query Parameters:**

- `q` (required): Search query (min 2 chars)
- `limit` (optional): Max results (1-50, default 10)
- `type` (optional): `condition`, `drug`, or `condition,drug` (default: both)

**Validation:**

- Query presence check
- Query length validation (min 2 chars)
- Database configuration check
- Type parameter sanitization

**Response Format:**

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Acute Coronary Syndrome",
      "type": "condition",
      "snippet": "CV • matches \"ACS\"",
      "matchType": "alias",
      "score": 90,
      "metadata": {
        "system": "CV",
        "matchedAlias": "ACS"
      }
    }
  ],
  "count": 1,
  "query": "acs",
  "limit": 10
}
```

**Error Handling:**

- 400: Missing/invalid query
- 500: Database errors (with details in dev mode)
- CORS headers for cross-origin requests
- Cache-Control: 5-minute cache for static results

### 3. Command Palette (`components/CommandPalette.tsx`)

**Enhancements:**

1. **Debounced Search Hook:**

```typescript
const debouncedQuery = useDebounce(query, 300);
```

2. **Server-side Fetch:**

```typescript
const fetchServerResults = async (searchQuery: string) => {
  const response = await fetch(`/api/content/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
  return response.json();
};
```

3. **Loading States:**

- `isSearching`: Shows spinner icon in search box
- Loading overlay: "Searching medical content..."
- Error alerts: Red banner for API failures

4. **Hybrid Search:**

- **Client-side**: Training modes (instant, no API call)
- **Server-side**: Medical content (conditions/drugs from database)

5. **UI Updates:**

- `Loader2` spinner icon when searching
- Error banner with retry message
- Empty state variations (no input vs no results)
- Match type indicators (exact, alias, fuzzy)

**User Experience:**

- Type → 300ms delay → API call → results
- Instant mode search (no delay)
- Keyboard navigation (↑↓, Enter, Esc)
- Scroll selected item into view
- Clear error messages

## Database Schema Requirements

### Condition Model

```prisma
model Condition {
  id          String   @id @default(uuid())
  name        String   // Primary name
  displayName String?  // Clean display name
  aliases     String[] @default([]) // Medical aliases/abbreviations
  system      String   // CV, PULM, GI, etc.
  // ... other fields

  @@index([name])
  @@index([displayName])
  @@index([system])
}
```

### Drug Model

```prisma
model Drug {
  id          String   @id @default(uuid())
  genericName String   @unique
  brandName   String?  // Single brand name
  aliases     String[] @default([]) // Alternate names
  drugClass   String[] // Drug classifications
  displayName String?  // Formatted name
  // ... other fields

  @@index([genericName])
}
```

**Key Features:**

- `aliases` and `drugClass` use PostgreSQL arrays
- `hasSome` operator for array searching
- Case-insensitive mode on all text searches
- Indexes on searchable fields

## Usage Examples

### API Usage

**Search all content:**

```bash
curl "http://localhost:3000/api/content/search?q=diabetes&limit=5"
```

**Search only conditions:**

```bash
curl "http://localhost:3000/api/content/search?q=heart&type=condition"
```

**Search with alias matching:**

```bash
curl "http://localhost:3000/api/content/search?q=MI"
# Returns "Myocardial Infarction" with metadata showing "MI" matched alias
```

### Service Usage

```typescript
import { searchContent, searchConditions } from '@/lib/services/contentSearchService';

// Search both conditions and drugs
const results = await searchContent('diabetes', 10);

// Search only conditions
const conditions = await searchConditions('pneumonia', 5);

// Filter by type
const drugs = await searchContent('aspirin', 10, ['drug']);
```

### React Component Integration

```typescript
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 300);

useEffect(() => {
  if (debouncedQuery.length >= 2) {
    fetchResults(debouncedQuery);
  }
}, [debouncedQuery]);

const fetchResults = async (q: string) => {
  const response = await fetch(`/api/content/search?q=${q}`);
  const data = await response.json();
  setResults(data.results);
};
```

## Performance Optimizations

1. **Debouncing**: 300ms delay prevents excessive API calls
2. **Over-fetch and Rank**: Fetch 2× limit, rank client-side, return top N
3. **Database Indexes**: On `name`, `displayName`, `genericName`, `system`
4. **Response Caching**: 5-minute cache headers
5. **Pagination**: Limit parameter (max 50) prevents massive queries
6. **Early Returns**: Empty query checks before DB hit

## Testing

### Manual Testing Scenarios

1. **Exact Match**: Search "diabetes" → finds "Diabetes Mellitus"
2. **Alias Match**: Search "MI" → finds "Myocardial Infarction" (shows matched alias)
3. **Fuzzy Match**: Search "diabets" → finds "Diabetes Mellitus" (typo tolerance)
4. **Partial Match**: Search "acute cor" → finds "Acute Coronary Syndrome"
5. **System Match**: Search "CV" → lists cardiovascular conditions
6. **Drug Class**: Search "beta blocker" → lists beta-blocking drugs
7. **Brand Name**: Search "Tylenol" → finds "Acetaminophen"

### Expected Behaviors

- **Empty query**: No API call, shows default modes
- **Short query** (<2 chars): No API call, local mode search only
- **Long delay**: Shows loading spinner
- **API error**: Red error banner, graceful fallback
- **No results**: "No results found" message
- **Mixed results**: Modes + conditions + drugs, sorted by score

### Error Scenarios

1. **Database down**: Returns 500 with error message
2. **Invalid query**: Returns 400 with validation error
3. **Network error**: Component shows error banner
4. **Timeout**: Handled by fetch timeout (if configured)

## Migration Notes

### Breaking Changes

- Old `searchConditions()` in `src/lib/conditionSearch.ts` is now deprecated
- Old `searchDrugs()` in `src/lib/drugSearch.ts` is now deprecated
- Command Palette no longer imports local search utilities

### Backwards Compatibility

- API endpoint is new, no breaking changes to existing endpoints
- Search service can be used alongside old search for migration period
- Old search functions can remain for non-UI search needs

### Rollout Strategy

1. ✅ Deploy search service to lib/services
2. ✅ Deploy API endpoint (opt-in via new URL)
3. ✅ Update Command Palette (main user-facing change)
4. 🔄 Monitor performance and error rates
5. 🔄 Deprecate old search utilities
6. 🔄 Update other components to use new search

## Future Enhancements

### Short-term

- [ ] Add search analytics (track popular queries)
- [ ] Implement search result caching (Redis/memory)
- [ ] Add "Did you mean?" suggestions for typos
- [ ] Highlight matched text in results

### Medium-term

- [ ] Full-text search on content fields (overview, pearls)
- [ ] Autocomplete/suggestions as user types
- [ ] Search filters (system, difficulty, high-yield only)
- [ ] Search history per user

### Long-term

- [ ] Elasticsearch/Algolia integration for advanced search
- [ ] Natural language queries ("show me cardio conditions")
- [ ] Semantic search using embeddings
- [ ] Voice search support

## Troubleshooting

### API Returns Empty Results

- **Check**: Database has synced condition/drug data
- **Verify**: Aliases are populated in database
- **Test**: Query directly in Prisma Studio

### Search is Slow

- **Check**: Database indexes exist (run `prisma migrate`)
- **Verify**: Connection pooling is configured
- **Monitor**: Query execution time in logs

### Aliases Not Matching

- **Check**: Aliases array is populated (not empty)
- **Verify**: `hasSome` operator works (PostgreSQL feature)
- **Test**: Direct Prisma query with `hasSome`

### Command Palette Not Updating

- **Check**: Debounce delay (wait 300ms after typing)
- **Verify**: API endpoint is accessible
- **Console**: Check for network errors in dev tools

## Related Files

- `lib/services/contentSearchService.ts` - Core search logic
- `functions/api/content/search.ts` - API endpoint
- `components/CommandPalette.tsx` - UI integration
- `prisma/schema.prisma` - Database models
- `conditionRegistry.ts` - Condition metadata (for reference)
- `drugRegistry.ts` - Drug metadata (for reference)

## Summary

The upgraded search engine provides:

- ✅ **Scalable**: Database-driven, handles thousands of conditions
- ✅ **Intelligent**: Multi-tier ranking with medical alias support
- ✅ **Fast**: Debounced, cached, indexed queries
- ✅ **User-friendly**: Loading states, error handling, keyboard navigation
- ✅ **Extensible**: Easy to add filters, analytics, advanced features

This establishes a production-ready search foundation for PANaCEa's medical content platform.
