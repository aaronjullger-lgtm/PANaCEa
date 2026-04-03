# PANaCEa Documentation Index

**Last Updated:** April 3, 2026
**Source of Truth:** `CLAUDE.md` (root) is the canonical project context for AI agents and developers.

---

## Start Here

| Document | Description |
| --- | --- |
| [CLAUDE.md](../CLAUDE.md) | Canonical project context: stack, architecture rules, FSRS pipeline, build commands |
| [README.md](../README.md) | Public-facing project overview |
| [docs/README.md](./README.md) | Guide to this docs folder |

---

## Currently Relevant (updated within last 30 days)

### Architecture & Systems

- [PANCE_BLUEPRINT.md](./PANCE_BLUEPRINT.md) - NCCPA blueprint mapping
- [FSRS_DATA_ISOLATION.md](./FSRS_DATA_ISOLATION.md) - FSRS data separation strategy
- [ROUTES_AND_VIEWS.md](./ROUTES_AND_VIEWS.md) - Route and view registry
- [LOADING_PATTERNS.md](./LOADING_PATTERNS.md) - Loading state patterns
- [LIBRARY_REDESIGN_IMPLEMENTATION.md](./LIBRARY_REDESIGN_IMPLEMENTATION.md) - Library feature redesign
- [LIBRARY_SEARCH_BEHAVIOR.md](./LIBRARY_SEARCH_BEHAVIOR.md) - Search UX spec

### OSCE & Drills

- [OSCE_ENHANCEMENT_SYSTEM.md](./OSCE_ENHANCEMENT_SYSTEM.md) - OSCE simulation system
- [OSCE_GRADING_AUDIT.md](./OSCE_GRADING_AUDIT.md) - Grading rubric audit
- [AUDIT_VIRTUAL_OSCE_AI_PATIENT.md](./AUDIT_VIRTUAL_OSCE_AI_PATIENT.md) - AI patient simulation

### Audits & Quality

- [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) - Active audit findings
- [AUDIT_CORE_SESSION_CHECKLIST.md](./AUDIT_CORE_SESSION_CHECKLIST.md) - Core session verification
- [AUDIT_COMPREHENSIVE_POST_IMPLEMENTATION.md](./AUDIT_COMPREHENSIVE_POST_IMPLEMENTATION.md) - Post-implementation review
- [INTELLIGENCE_LAYER_AUDIT.md](./INTELLIGENCE_LAYER_AUDIT.md) - Intelligence layer review
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) - Security posture review

### Operations

- [AUTOMATION_RUNBOOK.md](./AUTOMATION_RUNBOOK.md) - Automation playbook
- [AUTOMATION_SETUP_GUIDE.md](./AUTOMATION_SETUP_GUIDE.md) - Setup instructions
- [SMOKE_TEST_CHECKLIST.md](./SMOKE_TEST_CHECKLIST.md) - Deployment smoke tests
- [GIT_HISTORY_REWRITE_RUNBOOK.md](./GIT_HISTORY_REWRITE_RUNBOOK.md) - Git history cleanup

### Design

- [COLOR_TOKEN_REMEDIATION_PLAN.md](./COLOR_TOKEN_REMEDIATION_PLAN.md) - Design token fixes

---

## Reference Guides (stable, not frequently updated)

### Architecture

- [architecture/](./architecture/) - System architecture docs
- [EDGE_RUNTIME_PATTERNS.md](./EDGE_RUNTIME_PATTERNS.md) - Cloudflare Edge patterns
- [VALIDATION_PATTERNS.md](./VALIDATION_PATTERNS.md) - Zod/validation patterns

### Database & Deployment

- [deployment/](./deployment/) - Deployment guides
- [RLS_IMPLEMENTATION.md](./RLS_IMPLEMENTATION.md) - Row-level security
- [QUERY_OPTIMIZATION_GUIDE.md](./QUERY_OPTIMIZATION_GUIDE.md) - Query performance
- [DATABASE_INDEXING_STRATEGY.md](./DATABASE_INDEXING_STRATEGY.md) - Index strategy

### Security

- [security/](./security/) - Security documentation
- [AUTH_HEADER_AUDIT_REPORT.md](./AUTH_HEADER_AUDIT_REPORT.md) - Auth header patterns

### FSRS & Spaced Repetition

- [FSRS_V6_IMPLEMENTATION_SUMMARY.md](./FSRS_V6_IMPLEMENTATION_SUMMARY.md) - FSRS v6 overview
- [FSRS_V6_QUICK_REFERENCE.md](./FSRS_V6_QUICK_REFERENCE.md) - Quick reference
- [FSRS_STATISTICAL_OPTIMIZATION.md](./FSRS_STATISTICAL_OPTIMIZATION.md) - Statistical approach

### Features

- [features/](./features/) - Feature specifications
- [INTELLIGENT_SESSION_SPRINTS.md](./INTELLIGENT_SESSION_SPRINTS.md) - Adaptive sessions
- [PEARL_HARVESTER_PATTERN.md](./PEARL_HARVESTER_PATTERN.md) - Clinical pearl extraction

### Content & Media

- [MEDIA_INTEGRATION.md](./MEDIA_INTEGRATION.md) - Image/media system
- [CONTENT_ENRICHMENT_SYSTEM.md](./CONTENT_ENRICHMENT_SYSTEM.md) - Content pipeline
- [SCRIPTS_REFERENCE.md](./SCRIPTS_REFERENCE.md) - Script documentation

### UI/UX

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Design system tokens
- [MOBILE_FIRST_GUIDE.md](./MOBILE_FIRST_GUIDE.md) - Mobile design patterns
- [SPACING_SYSTEM_GUIDE.md](./SPACING_SYSTEM_GUIDE.md) - Spacing guidelines

---

## Subdirectories

| Directory | Contents |
| --- | --- |
| [api/](./api/) | API endpoint documentation |
| [architecture/](./architecture/) | System architecture |
| [audits/](./audits/) | Historical audit reports |
| [automation/](./automation/) | Automation & cron docs |
| [deployment/](./deployment/) | Deployment & CI/CD |
| [features/](./features/) | Feature specifications |
| [guides/](./guides/) | How-to guides |
| [implementation/](./implementation/) | Implementation details |
| [plans/](./plans/) | Development plans |
| [research/](./research/) | Research & exploration |
| [security/](./security/) | Security documentation |

---

## Historical / Archive

The remaining ~200 markdown files in this directory are historical documents from previous sprints and development phases (Jan-Mar 2026). They are kept for reference but are **not guaranteed to be current**. Key categories:

- `SPRINT_*_COMPLETION_SUMMARY.md` - Sprint completion reports (Sprints 1-5, B, C)
- `PHASE_*_*.md` - Phase implementation docs (Phases 1-10)
- `AUDIT_*.md` - Point-in-time audit reports
- `*_IMPROVEMENT_PLAN.md` - Historical improvement plans
- `*_IMPLEMENTATION_SUMMARY.md` - Implementation records

To search historical docs: `grep -ri "keyword" docs/`

---

## Build & Dev Commands

```bash
npm run dev            # Vite frontend
npm run dev:all        # Frontend + Express backend
npm run dev:wrangler   # Cloudflare Pages (production-like)
npm run typecheck      # TypeScript check
npm test               # Unit tests (vitest)
npm run test:e2e       # Playwright E2E
npm run db:studio      # Prisma Studio
```

---

## Key Files Quick Reference

```
CLAUDE.md                          # Canonical project context (source of truth)
App.tsx                            # Main React app entry
functions/api/                     # Cloudflare Edge API endpoints
lib/fsrs.ts                        # FSRS v6 implementation
lib/services/drillReviewService.ts # Core submission pipeline
components/session/QuizView.tsx    # Main session UI
prisma/schema.prisma               # Database schema
```
