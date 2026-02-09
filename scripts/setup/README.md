# Setup Scripts

One-off or manual setup for Supabase and related infrastructure.

## Supabase Storage (Two-Bucket)

**File:** `supabase-storage-two-bucket.sql`

Creates two storage buckets and RLS policies for the “two-bucket” architecture:

| Bucket               | Public | Access |
|----------------------|--------|--------|
| `raw-source-vault`   | No     | Service role only (no anon/authenticated). |
| `public-assets`      | Yes    | SELECT for all; INSERT/UPDATE for service role only. |

**How to run:** Supabase Dashboard → SQL Editor → paste and run the script.  
If bucket `INSERT` fails (e.g. schema difference), create the buckets in Storage → New bucket, then run only the policy section of the script.
