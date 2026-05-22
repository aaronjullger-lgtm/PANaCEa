# .autoclaw/product-notes.md

## Critical User Flows
1. **Study session:** Dashboard → QuizView → answer questions → AI feedback → analytics update
2. **Drill practice:** CommandCenterHub → drill selection → question flow → FSRS update
3. **Content browsing:** Clinical library → search conditions/drugs/guidelines
4. **Analytics:** AdaptiveDashboardPage → real review data → performance metrics
5. **Question generation:** AI generates → validated → persisted → assigned to user

## UX Gaps to Verify
- Loading states present on all data-fetching views
- Empty states intentional (not broken UI)
- Error states show user-actionable messages
- Form submissions deduped (disabled during submit)
- Navigation after completion is sensible
- Responsive layout works on common viewports
- No console errors in production build
- No fake/mock data in production paths

## Feature Gaps (from CLAUDE.md)
- Questions for under-represented PANCE blueprint areas (CV, PULM)
- QuizView refactor parked (192 TS errors)
- Pending Prisma migrations for UserDailyInsight, missing FKs, composite indexes
- Notification system (Sprint 18) — needs web-push package approval
- Bandit state on UserPreferences (Sprint 16) — not yet drafted

## Polish Needed
- Inline styles → Tailwind migration (1063 instances)
- Hardcoded hex → CSS variables (238 instances)
- Dashboard: verify all widgets show real data
