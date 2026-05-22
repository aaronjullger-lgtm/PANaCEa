# .autoclaw/test-log.md

## Test Commands
```bash
npm test                    # Full suite: 3200+ tests, 205+ files
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:e2e            # Playwright E2E
```

## Coverage Thresholds
- Global: 40% statements, 35% branches/functions/lines
- Critical paths (higher): `lib/fsrs.ts`, `lib/implicit-metrics.ts`, `lib/services/drillReviewService.ts`, `lib/confidence/**`, `lib/srs/**`, `store/**`, `functions/api/_shared/**`

## Known Gaps
- React 19 compat: some admin component tests excluded
- Goals tests: excluded
- Offline tests: excluded
- To be audited during discovery pass

## Verification Log
_Updates after each verification run_
