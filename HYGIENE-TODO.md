# Repo Hygiene TODO — Claude's Autonomous Sweep (2026-04-17)

File deletions are blocked by the sandbox Claude is running in; these are all
safe deletes that need `git rm` locally.

## Tier 1 — Delete (zero active callers, 410 Gone tombstones)

```bash
git rm functions/api/questions/review.ts        # 48 lines, 410 Gone
git rm functions/api/drill/log-attempt.ts       # 28 lines, 410 Gone
```

## Tier 2 — Verify no HTTP callers in last 30 days, then delete

```bash
# These are 301 redirects. Check Cloudflare logs for old-path traffic first.
git rm functions/api/drill/contrastive-batch.ts  # 22 lines, 301 → /api/drills/...
git rm functions/api/drill/overview.ts           # 17 lines, 301 → /api/drills/...
git rm functions/api/drill/photo-batch.ts        # deprecated backup of /api/drills/media
git rm functions/api/srs/sync.ts                 # legacy SM-2 sync endpoint
```

## Tier 3 — Requires migration before delete

1. **`lib/poolSelection.ts`** — `selectByPanceDistribution` + `fisherYatesShuffle`
   - Caller: `functions/api/questions/pool.ts`
   - Migrate to `BLUEPRINT_PERCENT_BY_ABBREVIATION` from `lib/constants/blueprint.ts`

2. **`lib/sessionInterleaving.ts`** — `ensureInterleaving` + `validateInterleaving`
   - Caller: `services/core/enhancedQuestionPool.ts`
   - Replacement exists: `lib/services/mainSessionQuestionSelector.ts` (v2.0.0+)

3. **`lib/toast.ts`** — deprecated imperative Toast API
   - 15 active callers; migrate each to `useToastStore` directly.

## Not safe to delete (Explore agent was wrong)

- `components/ui/ErrorState.tsx` — still exports `ErrorBoundaryFallback`,
  which is imported by `components/error/ErrorBoundary.tsx`. Keep as-is.
