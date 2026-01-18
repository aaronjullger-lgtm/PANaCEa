# Search Engine Quick Reference

## API Endpoint

```
GET /api/content/search
```

### Query Parameters

- `q` (required): Search query (min 2 chars)
- `limit` (optional): Max results 1-50 (default: 10)
- `type` (optional): `condition`, `drug`, or `condition,drug` (default: both)

### Example Requests

```bash
# Search everything
curl "https://your-app.com/api/content/search?q=diabetes"

# Search only conditions
curl "https://your-app.com/api/content/search?q=heart&type=condition"

# Search with limit
curl "https://your-app.com/api/content/search?q=beta&limit=5"

# Test alias matching
curl "https://your-app.com/api/content/search?q=MI"
# Returns: Myocardial Infarction (shows matched alias)
```

### Response Format

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

## Frontend Integration

### React Component

```tsx
import { useState, useEffect } from 'react';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounce utility
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/content/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`
        );
        const data = await response.json();
        setResults(data.results);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search medical content..."
      />
      {loading && <div>Searching...</div>}
      {results.map((result) => (
        <div key={result.id}>
          <h3>{result.title}</h3>
          <p>{result.snippet}</p>
        </div>
      ))}
    </div>
  );
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

## Backend Service (Node.js/Express)

### Using the service directly

```typescript
import { searchContent, searchConditions, searchDrugs } from '@/lib/services/contentSearchService';

// Search both conditions and drugs
const results = await searchContent('diabetes', 10);

// Search only conditions
const conditions = await searchConditions('pneumonia', 5);

// Search only drugs
const drugs = await searchDrugs('aspirin', 10);

// Filter by type programmatically
const filtered = await searchContent('heart', 10, ['condition']);
```

### Express route example

```typescript
import express from 'express';
import { searchContent } from './lib/services/contentSearchService';

const router = express.Router();

router.get('/search', async (req, res) => {
  const { q, limit = '10', type } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query required' });
  }

  if (q.trim().length < 2) {
    return res.status(400).json({ error: 'Query too short' });
  }

  try {
    const includeTypes = type
      ? type.split(',').filter((t) => ['condition', 'drug'].includes(t))
      : ['condition', 'drug'];

    const results = await searchContent(
      q,
      parseInt(limit as string, 10),
      includeTypes as ('condition' | 'drug')[]
    );

    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
```

## Match Types Explained

| Type      | Description                       | Example                                        |
| --------- | --------------------------------- | ---------------------------------------------- |
| `exact`   | Exact match or starts with query  | "diabetes" matches "Diabetes Mellitus"         |
| `alias`   | Matched via medical alias         | "MI" matches "Myocardial Infarction"           |
| `fuzzy`   | Partial match with typo tolerance | "diabets" matches "Diabetes Mellitus"          |
| `keyword` | Found in system/drug class        | "beta" matches drugs with class "Beta-Blocker" |

## Scoring System

Results are ranked by score (highest first):

- **100**: Exact name match
- **90**: Exact alias match
- **80**: Name starts with query
- **70**: Alias starts with query
- **60**: Keyword match (system/drug class)
- **50**: Name contains query
- **30-50**: Fuzzy match (based on similarity)

## Testing Scenarios

### 1. Exact Match

```bash
curl "/api/content/search?q=diabetes"
# Should return "Diabetes Mellitus" as top result
```

### 2. Alias Matching

```bash
curl "/api/content/search?q=MI"
# Should return "Myocardial Infarction" with matchedAlias: "MI"
```

### 3. Typo Tolerance

```bash
curl "/api/content/search?q=diabets"
# Should still find "Diabetes Mellitus" (fuzzy match)
```

### 4. Partial Search

```bash
curl "/api/content/search?q=acute%20cor"
# Should find "Acute Coronary Syndrome"
```

### 5. System Filter

```bash
curl "/api/content/search?q=CV"
# Should list cardiovascular conditions
```

### 6. Drug Class

```bash
curl "/api/content/search?q=beta%20blocker&type=drug"
# Should list beta-blocking drugs
```

### 7. Brand Name

```bash
curl "/api/content/search?q=Tylenol&type=drug"
# Should find "Acetaminophen"
```

## Error Handling

### Client-side

```typescript
try {
  const response = await fetch('/api/content/search?q=' + query);

  if (!response.ok) {
    const error = await response.json();
    console.error('Search failed:', error.message);
    // Show error to user
    return;
  }

  const data = await response.json();
  setResults(data.results);
} catch (error) {
  console.error('Network error:', error);
  // Show network error to user
}
```

### Expected Error Responses

**400 - Missing query:**

```json
{
  "error": "Query parameter \"q\" is required",
  "message": "Please provide a search query"
}
```

**400 - Query too short:**

```json
{
  "error": "Query too short",
  "message": "Search query must be at least 2 characters"
}
```

**500 - Database error:**

```json
{
  "error": "Internal server error",
  "message": "Failed to search content",
  "details": "Connection timeout" // Only in development
}
```

## Performance Tips

1. **Debounce user input**: Wait 300ms after typing stops
2. **Limit results**: Use `limit` parameter (max 50)
3. **Cache responses**: 5-minute cache on API responses
4. **Filter early**: Use `type` parameter to search only what's needed
5. **Abort previous requests**: Cancel pending fetches when query changes

### Abort Controller Example

```typescript
const controller = new AbortController();

useEffect(() => {
  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/content/search?q=${query}`, { signal: controller.signal });
      // Process response...
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
        return;
      }
      console.error('Search failed:', error);
    }
  };

  fetchResults();

  // Cleanup: abort on unmount or new query
  return () => controller.abort();
}, [query]);
```

## Troubleshooting

### No results returned

- ✅ Check database has data (run registry sync)
- ✅ Verify aliases are populated
- ✅ Test with simple query (e.g., "diabetes")

### Search is slow

- ✅ Check database indexes exist
- ✅ Verify connection pooling is configured
- ✅ Monitor network latency

### Aliases not matching

- ✅ Ensure aliases are stored as array in database
- ✅ Check PostgreSQL `hasSome` operator works
- ✅ Verify data was synced from registry

### Debounce not working

- ✅ Check delay value (300ms recommended)
- ✅ Verify useDebounce hook is used correctly
- ✅ Test with console.log to see timing

## File Locations

- **Service (Node.js)**: `lib/services/contentSearchService.ts`
- **Service (Cloudflare)**: `functions/api/_shared/content-search.ts`
- **API Endpoint**: `functions/api/content/search.ts`
- **React Component**: `components/CommandPalette.tsx`
- **Documentation**: `SEARCH_ENGINE_UPGRADE.md`
- **Quick Reference**: `SEARCH_QUICK_REFERENCE.md` (this file)

## Next Steps

After implementing basic search:

1. ✅ Test with real medical data
2. ⏭️ Add search analytics (track popular queries)
3. ⏭️ Implement autocomplete suggestions
4. ⏭️ Add search history per user
5. ⏭️ Create advanced filters (system, difficulty, high-yield)
6. ⏭️ Highlight matched text in results
7. ⏭️ Add "Did you mean?" for typos
