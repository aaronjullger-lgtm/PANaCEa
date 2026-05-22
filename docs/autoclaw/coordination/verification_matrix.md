# Verification Matrix

What was verified, by which agent, with what result.

| Date | Agent | Test | Result | Notes |
|------|-------|------|--------|-------|
| — | — | — | — | No verifications recorded yet |

## Verification Standards

- FSRS/session changes: targeted FSRS tests → `npm run test:critical`
- Edge endpoint changes: endpoint test + middleware test → `npm run typecheck`
- View/routing changes: route registry test → `npm run typecheck` → `npm run build`
- Dashboard/metrics: service math tests + component test
- Offline/sync: sync manager tests + idempotency tests
- Content: targeted tests + manual clinical safety review
