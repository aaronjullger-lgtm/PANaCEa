# PANaCEa Feature Risk Register — Top 10 Cross-Cutting Risks

> Generated 2026-04-02. Covers risks that span multiple features or affect the platform holistically.

## Risk Summary Table

| # | Risk | Severity | Likelihood | Features Affected | Mitigation |
|---|------|----------|------------|-------------------|------------|
| 1 | Gemini API cost escalation | High | High | #1, #4, #8, #17, #18, #20, #21 | See below |
| 2 | Prisma migration conflicts | Medium | Medium | #2, #5, #6, #10, #15, #19, #21 | See below |
| 3 | FSRS pipeline regression | Critical | Low | #6, #7, #8, #13, #17, #19, #20 | See below |
| 4 | Cloudflare Edge function size/time limits | High | Medium | #1, #4, #8, #14, #15, #18 | See below |
| 5 | External API dependency failures | Medium | High | #1, #4, #7, #18, #21 | See below |
| 6 | Mobile performance degradation | Medium | Medium | #9, #13, #16, #19, #20 | See below |
| 7 | Scope creep on transformative features | High | High | #19, #20, #21 | See below |
| 8 | Solo developer burnout / rotation conflicts | Critical | High | All | See below |
| 9 | Data consistency across offline/online | Medium | Medium | #14, #15, #10 | See below |
| 10 | Auth token handling in workers/SW | Medium | Low | #13, #14, #15 | See below |

---

## Detailed Risk Analysis

### Risk 1: Gemini API Cost Escalation

**Description:** Seven features add new Gemini API calls. Search grounding, PubMed context injection, free-text grading, and voice OSCE all increase per-request costs. Without controls, monthly Gemini spend could increase 3-5x.

**Affected features:** #1 (Search Grounding), #4 (PubMed), #8 (Elaboration grading), #17 (Teach-Back grading), #18 (Trials), #20 (Clinical Eye), #21 (Voice OSCE)

**Mitigation strategy:**
- Track per-feature API cost using the existing rate limiter's logging
- Set hard monthly budget caps in Google Cloud Console
- Use `gemini-2.5-flash` (cheaper) for all non-critical calls; reserve `gemini-2.5-pro` for OSCE grading only
- Cache aggressively: PubMed enrichment, clinical trial data, and search grounding results per condition (not per question)
- For free-text grading (#8, #17): batch multiple student responses if volume grows
- Voice OSCE (#21): enforce 10-minute session limits, use TTS/STT bridge before upgrading to Live API

**Monitoring:** Add a `gemini_cost_tracking` tag to each API call. Build a simple cost dashboard showing spend per feature per day.

---

### Risk 2: Prisma Migration Conflicts

**Description:** Seven features modify `prisma/schema.prisma`. Running migrations serially over 10 weeks risks conflicts if multiple branches develop in parallel, or if a migration fails mid-deploy.

**Affected features:** #2, #5, #6, #10, #15, #19, #21

**Mitigation strategy:**
- Batch migrations by sprint (see DEPENDENCY_GRAPH.md "Migration Batch A/B/C")
- Always run `npx prisma migrate dev` locally before deploying
- Never modify an existing migration file — create a new one
- Use `prisma migrate diff` to preview changes before applying
- Keep a migration log: which feature added which fields
- If a migration fails in production: use `prisma migrate resolve --rolled-back` and fix before retrying

---

### Risk 3: FSRS Pipeline Regression

**Description:** The FSRS implicit rating pipeline is the heart of the app. Seven features introduce new drill types or modify the review flow. A regression that silently breaks FSRS scheduling (e.g., submissions not reaching the pipeline, ratings always defaulting to "Good") would undermine the entire learning system without obvious symptoms.

**Affected features:** #6, #7, #8, #13, #17, #19, #20

**Mitigation strategy:**
- **Canary test:** After each new drill type, verify the complete chain: drill answer → `useDrillFSRS` → `/api/drills/submit-review` → `drillReviewService` → `ReviewLog` creation → `UserProgress` update
- **Automated smoke test:** Create a Vitest integration test that submits a drill answer and checks that `ReviewLog` and `UserProgress` were updated with correct `sessionType: 'drill'`
- **Dashboard metric:** Add a "FSRS health" metric: daily count of ReviewLog entries by sessionType. Alert if drill entries drop to 0.
- **Web Worker (#13):** Test that worker-computed FSRS values match main-thread values exactly (bit-for-bit). Use a deterministic test case.

---

### Risk 4: Cloudflare Edge Function Size/Time Limits

**Description:** Cloudflare Workers have a 1MB compressed script size limit and 30-second CPU time limit (50ms on free plan, 30s on paid). Features that add PubMed API calls, Gemini calls with search grounding, and free-text grading may push against these limits.

**Affected features:** #1, #4, #8, #14, #15, #18

**Mitigation strategy:**
- Keep Edge functions thin: move heavy logic to `lib/` (shared code) and import only what's needed
- For PubMed + Gemini chains (#4): make the PubMed call first, then pass results to Gemini — don't nest async calls deeper than 2 levels
- Monitor function execution time via Cloudflare Analytics
- If hitting limits: split long operations into two requests (client orchestrates), or use Cloudflare Durable Objects for stateful operations
- For the service worker (#14, #15): these run client-side, no Edge limits apply

---

### Risk 5: External API Dependency Failures

**Description:** Five features depend on external APIs (Gemini, PubMed, ICD-10 MCP, Clinical Trials MCP). Any of these can have downtime, rate limits, or breaking changes.

**Affected features:** #1, #4, #7, #18, #21

**Mitigation strategy:**
- **Every external call must have a fallback.** If PubMed is down, question generation still works (just without citations). If ICD-10 MCP is down, drill uses cached code data.
- **Pre-cache where possible:** ICD-10 codes (#7) should be cached locally after first fetch. PubMed results per condition should be cached in `questionData`. Trial data should have a 24-hour cache.
- **Timeout enforcement:** All external API calls should have a 5-second timeout. Gemini calls should have 15-second timeout.
- **Error tracking:** Log all external API failures to Sentry with feature tag. Set up alerts for >5% failure rate.

---

### Risk 6: Mobile Performance Degradation

**Description:** PA students study on phones during rotations. Features that add DOM manipulation (text highlighting), heavy rendering (3D anatomy), or complex charts (heatmap, calendar) can degrade the mobile experience.

**Affected features:** #9, #13, #16, #19, #20

**Mitigation strategy:**
- **Performance budget:** No feature should increase Lighthouse Performance score by more than 5 points
- **Lazy loading:** 3D anatomy viewer (#19) and clinical eye (#20) must be code-split and lazy-loaded
- **Touch optimization:** Text highlighting (#9) must use touch events, not just mouse events. Test on actual devices.
- **Low-end device testing:** Test on a 3-year-old phone (e.g., iPhone 11, Pixel 5) as the baseline
- **Web Worker (#13):** This feature actually *mitigates* mobile performance issues by offloading FSRS

---

### Risk 7: Scope Creep on Transformative Features

**Description:** Features #19 (3D Anatomy), #20 (Clinical Eye), and #21 (Voice OSCE) are estimated at 1-3 weeks each. Transformative features have a strong tendency to expand scope as implementation reveals complexity. A solo developer could spend 2 months on these alone.

**Affected features:** #19, #20, #21

**Mitigation strategy:**
- **MVP definition before starting:** Write a 1-paragraph "this is done when..." for each. For #19: "Done when 5 heart/brain/knee/spine/abdomen models load, rotate, and annotation hotspots are clickable." Not "comprehensive anatomy atlas."
- **Time-box ruthlessly:** If a feature isn't working after 150% of estimated time, ship what's functional and defer the rest.
- **Phase the work:** #21 Voice OSCE is explicitly three phases. Ship Phase 1 (TTS/STT bridge) first. Phase 2 and 3 are optional extensions.
- **Don't start Sprint 7+ until Sprints 1-6 are shipped and stable.** The first 18 features collectively deliver more PANCE impact than the last 3.

---

### Risk 8: Solo Developer Burnout / Rotation Conflicts

**Description:** You're a PA-S2 on clinical rotations doing 10-12 hour shifts. This plan spans 10 weeks of coding. Rotation demands will inevitably conflict with development time.

**Affected features:** All

**Mitigation strategy:**
- **Flexible sprint boundaries:** Sprints are 1-week targets, not deadlines. A sprint that takes 2 weeks is fine.
- **Prioritize Tier 1 ruthlessly:** If you only complete Sprints 1-3 (features 1-9), you've already shipped the highest-impact work. Everything after Sprint 3 is gravy.
- **Use streak freezes (Feature #2) on yourself:** When a rotation week is brutal, use the weekend to rest, not code. The codebase will be there next week.
- **Commit working increments:** Every implementation step in these plans produces something testable. If you finish 3 of 5 steps on a feature, you still have working code.
- **Leverage Claude Code:** Each plan's implementation steps are designed as standalone Claude Code tasks. "Do Step 3 of Feature 7" should be a complete instruction.

---

### Risk 9: Data Consistency Across Offline/Online

**Description:** Background Sync (#14) and peer stats (#10) create scenarios where data can be submitted out of order or duplicated. A student answers Q1 offline, then Q1 again online — which attempt counts?

**Affected features:** #14, #15, #10

**Mitigation strategy:**
- **Idempotency keys:** Every offline-queued submission should include a UUID generated client-side. The server should reject duplicates.
- **Timestamp ordering:** When syncing offline answers, use the client-side timestamp (stored in `OfflineAnswer.timestamp`), not the server receipt time, for FSRS scheduling
- **Peer stats isolation:** Peer stats aggregation (#10) should only count the first attempt per user per question (prevent inflation from retries)
- **Conflict resolution rule:** If the same `questionId + userId + timestamp` exists in `QuestionAttempt`, skip the insert (upsert with conflict ignore)

---

### Risk 10: Auth Token Handling in Workers and Service Workers

**Description:** Web Workers (#13), Background Sync (#14), and Push Notifications (#15) all need authenticated API access. Clerk tokens expire, and service workers can't access the DOM to refresh tokens.

**Affected features:** #13, #14, #15

**Mitigation strategy:**
- **Web Worker (#13):** Pass the token as a parameter to each worker call. Workers don't need persistent auth — they receive the token from the main thread per-invocation.
- **Background Sync (#14):** Store a long-lived session token (not the Clerk JWT) in IndexedDB specifically for service worker use. Alternatively, have the service worker request a fresh token via `clients.matchAll()` → `postMessage` to any open tab.
- **Push Notifications (#15):** Push sending is server-side (cron job), so auth isn't an issue. The notification click handler opens the app, which has normal auth.
- **Token refresh pattern:** Create a `getServiceWorkerToken()` utility that either returns a cached token or requests a new one via the main thread. Include this in `lib/services/sync/offlineStore.ts`.
