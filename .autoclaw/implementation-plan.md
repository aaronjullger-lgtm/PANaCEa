# .autoclaw/implementation-plan.md — Strategic Plan

## Objective
Make StudyPANaCEa production-functional, maintainable, fast, secure, and pleasant to use.

## Current Phase: Stability & Verification
Focus: verify existing functionality, fix broken paths, complete pending migrations.

### Phase 1: Discovery & Verification (current)
- Full repo discovery
- Test health audit
- Build verification
- Identify broken routes/UI/data paths

### Phase 2: Learning Pipeline Hardening
- Verify study session flow end-to-end
- Verify FSRS pipeline (implicit rating → scheduling → persistence)
- Verify question reservoir (generation → queuing → assignment)
- Verify analytics from real review data

### Phase 3: Architecture Cleanup
- QuizView refactor completion
- Drill routing consolidation
- PatientEncounterMode decomposition
- CSS variable migration (238 hex → vars)
- Inline styles → Tailwind (1063 instances)

### Phase 4: Production Readiness
- Apply pending Prisma migrations
- Performance audit
- Security review
- Test coverage expansion

## Risks
- QuizView refactor: 192 TS errors, state wiring needed
- Pending migrations: 4+ DDL changes awaiting approval
- Drill routing split: architectural decision needed

## Dependencies
- Migration approval required from Aaron
- Build must stay green throughout
- 3200+ tests must not regress
