# Risk Register

Known risks, do-not-touch areas, and fragile subsystems.

---

## High-Risk Subsystems (from panacea-navigator)

### RISK-001: FSRS / Review Submission
- **Severity:** critical
- **Subsystem:** `lib/fsrs.ts`, `lib/implicit-metrics.ts`, `lib/services/drillReviewService.ts`, `functions/api/drills/submit-review.ts`, `functions/api/srs/submit.ts`
- **Description:** Duplicate answer paths double-count progress. Incorrect rating normalization corrupts scheduling. Rapid-guess handling can bypass review records.
- **Mitigation:** Always load `panacea-fsrs-guardrails` before touching these files. Run targeted FSRS tests before and after changes. Preserve single-writer behavior.
- **Detected By:** Architecture review

### RISK-002: Main Session Pipeline
- **Severity:** critical
- **Subsystem:** `components/session/QuizView.tsx`, `components/session/hooks/useQuizSubmit.ts`, `lib/services/sync/syncManager.ts`
- **Description:** Advancing questions before durable submit state causes progress loss. Telemetry loss on session restore. Mode confusion (cram/rapid recall writing FSRS).
- **Mitigation:** Load `panacea-session-pipeline` before changes. Preserve double-submit guards and crash recovery. Test session restore flows.
- **Detected By:** Architecture review

### RISK-003: Edge Auth / API
- **Severity:** critical
- **Subsystem:** `functions/api/_shared/middleware.ts`, `functions/api/_shared/auth.ts`, `functions/api/_shared/prisma-edge.ts`
- **Description:** Bypassing shared auth/RBAC/validation. Using `process.env` instead of `context.env` in Edge handlers. Prisma imports leaking into frontend bundles.
- **Mitigation:** Use existing middleware wrappers. Never bypass auth to make tests pass. Run `npm run build` after Edge changes.
- **Detected By:** Architecture review

### RISK-004: Content / Refinery
- **Severity:** high
- **Subsystem:** `functions/api/content`, `functions/api/admin/refinery`, `functions/api/admin/staging`, `lib/services/search`
- **Description:** AI-generated clinical content with incorrect medical information. Missing citations. Content poisoning from unvalidated ingestion.
- **Mitigation:** Always review clinical correctness of generated content. Validate citations. Keep human-in-the-loop for medical accuracy.
- **Detected By:** Architecture review

### RISK-005: OSCE Simulation
- **Severity:** high
- **Subsystem:** `components/osce`, `components/modes/osce`, `functions/api/osce`, `lib/services/soap*`, `lib/services/osceStructuralScorer.ts`
- **Description:** AI-mediated encounters providing diagnosis/treatment advice. SOAP note grading errors. Structural scoring regressions.
- **Mitigation:** Frame all AI output as learning support, not medical advice. Validate grading rubrics. Test station transitions.
- **Detected By:** Architecture review

### RISK-006: Migration / Data Scripts
- **Severity:** critical
- **Subsystem:** `prisma/migrations/`, database scripts
- **Description:** Production migrations or destructive data scripts run without approval. Schema drift between dev and production.
- **Mitigation:** Never run migrations without explicit approval. Use `trash` not `rm`. Back up before destructive operations.
- **Detected By:** Coordinator guardrail

### RISK-007: Offline Sync
- **Severity:** high
- **Subsystem:** `lib/services/sync/`, PWA cache
- **Description:** Offline queue losing answers. Idempotency failures causing duplicate submissions. Cache serving stale content after deploy.
- **Mitigation:** Test offline → online transitions. Verify idempotency keys survive queue replay. Test with actual service worker lifecycle.
- **Detected By:** Architecture review

---

## Do Not Touch (without explicit approval)

- `.env` and `.env.*` files
- Production database connection strings
- Clerk auth configuration
- Wrangler deployment configuration
- FSRS parameters (`lib/fsrs.ts` parameter defaults)
- Production migration files
