# PANCE Blueprint Context Cache

The Main Session (Deep Think Tutor) and `/api/gemini/stream` can use a **pre-created Gemini context cache** so the model is grounded in PANCE blueprint content without sending the full text on every request.

## How it works

- **Client** sends optional `cachedContent: "cachedContents/xxx"` to `POST /api/gemini/stream`.
- If the client does **not** send `cachedContent`, the backend uses **`PANCE_BLUEPRINT_CACHE_NAME`** from the environment (when set).
- The cache is created once (or periodically) and referenced by name; Gemini uses it as context for the conversation.

## Creating the cache

### Option 1: Admin API (authenticated)

1. Obtain a valid Clerk token for an admin user.
2. `POST /api/admin/knowledge/ingest` with body:
   - `content`: PANCE blueprint / high-yield text (or use `fileUri` from Gemini Files if you uploaded a PDF).
   - `displayName`: e.g. `pance_blueprint_v1` (optional; default `cache_pance_master_v1`).
   - `ttlSeconds`: optional; default 24h (86400).
3. Response includes the created cache **name** (e.g. `cachedContents/abc123...`).
4. Set **`PANCE_BLUEPRINT_CACHE_NAME`** in Cloudflare Pages (and locally in `.env`) to that exact value.

### Option 2: Script (Node, for one-off or CI)

From project root, with `GEMINI_API_KEY` and optional `DATABASE_URL`:

```bash
# From extracted text file
npx tsx scripts/library/ingest-cache.ts --textFile ./path/to/pance-blueprint.txt --displayName pance_blueprint_v1 --ttl 86400

# Or from stdin
cat pance-blueprint.txt | npx tsx scripts/library/ingest-cache.ts --stdin --displayName pance_blueprint_v1 --ttl 86400
```

The script prints the cache name (e.g. `cachedContents/...`). Copy that value into:

- **Cloudflare Pages:** Project → Settings → Environment variables → `PANCE_BLUEPRINT_CACHE_NAME`
- **Local:** `.env` → `PANCE_BLUEPRINT_CACHE_NAME=cachedContents/...`

## TTL and refresh

- Caches expire (e.g. 24h or 7 days depending on `ttl`).
- When expired, Gemini returns an error if that cache is used; the client/backend will not send it.
- To refresh: create a new cache (Option 1 or 2), then update `PANCE_BLUEPRINT_CACHE_NAME` to the new name.

## References

- `env.example`: `PANCE_BLUEPRINT_CACHE_NAME`
- `functions/api/gemini/stream.ts`: uses `PANCE_BLUEPRINT_CACHE_NAME` when client does not send `cachedContent`
- `functions/api/admin/knowledge/ingest.ts`: creates cache via Gemini `cachedContents` API
- `scripts/library/ingest-cache.ts`: Node script to create cache from text file or stdin
