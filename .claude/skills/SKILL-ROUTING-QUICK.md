# PANaCEa Skills — Quick Routing Guide

**Use this guide to quickly pick the right skill(s) for your problem.**

---

## By Problem Type

### FSRS / Review Scheduling
- **Stability/difficulty not updating?** → `fsrs-pipeline` + `fsrs-domain`
- **Drills not updating FSRS?** → `panacea-fsrs-wiring` + `session-orchestration`
- **Review intervals wrong?** → `fsrs-pipeline` + `fsrs-domain`
- **FSRS optimizer cost spike?** → `model-routing-escalation` + `perf-bundle-edge`

### Session / Questions Not Loading
- **Questions aren't loading?** → `session-orchestration` + `cf-edge-api`
- **Reservoir stuck/stale?** → `session-orchestration`
- **Answers aren't saving?** → `session-orchestration` + `cf-edge-api`
- **Sync failing / offline issues?** → `session-orchestration`
- **Drill wiring broken?** → `panacea-fsrs-wiring` + `session-orchestration`

### UI / State Management
- **Component crashes on undefined data?** → `async-state-hardening`
- **Page is blank / no empty state?** → `async-state-hardening` + `panacea-style-system`
- **Flicker or loading states broken?** → `async-state-hardening`
- **Component decomposition / refactor?** → `react-refactor`

### Metrics / Dashboard
- **Numbers look wrong?** → `dashboard-trust` + `fsrs-pipeline`
- **Chart crashes / blank chart?** → `dashboard-trust` + `async-state-hardening`
- **Accuracy or streak calculation wrong?** → `dashboard-trust` + `fsrs-pipeline`
- **New metric or widget?** → `dashboard-trust` + `panacea-verify`

### Database / Data
- **Query slow / migration failed?** → `prisma-data-integrity`
- **RLS not working / access control?** → `prisma-data-integrity` + `auth-policy-review`
- **Schema inconsistency?** → `prisma-data-integrity`
- **Sync/offline data issues?** → `session-orchestration` + `prisma-data-integrity`

### API / Backend
- **Endpoint 500 error?** → `cf-edge-api` + `panacea-verify`
- **Rate limiting / 429 errors?** → `ai-generation-safety` + `cf-edge-api`
- **Auth failing on endpoint?** → `auth-policy-review` + `cf-edge-api`
- **Edge function slow / timeout?** → `cf-edge-api` + `perf-bundle-edge`

### AI / Content Generation
- **Gemini returning bad results?** → `ai-generation-safety` + `clinical-content-gen`
- **Question generation failing?** → `ai-generation-safety` + `clinical-content-gen`
- **Clinical accuracy concern?** → `clinical-safety-review` + `clinical-content-gen`
- **Cost spike / token usage high?** → `model-routing-escalation` + `perf-bundle-edge`

### Knowledge Base / Clinical Library
- **Knowledge base broken / slow?** → `clinical-library-search`
- **Semantic search not working?** → `clinical-library-search`
- **Content enrichment issues?** → `clinical-library-search` + `clinical-content-gen`

### OSCE / Simulations
- **OSCE grading wrong?** → `osce-architect`
- **Patient encounter issues?** → `osce-architect`
- **Transcript / transcript quality?** → `osce-architect`

### Performance / Bundle
- **Slow page load?** → `perf-bundle-edge` + `cf-edge-api`
- **Cold start too slow?** → `perf-bundle-edge`
- **Large bundle size?** → `perf-bundle-edge` + `ui-primitive-consolidation`

### Testing / Verification
- **Test failing / test quality?** → `vitest-author`
- **Need full verification before PR?** → `panacea-verify`
- **Import or transpile errors?** → `panacea-verify`

### Refactoring / Long-Term Work
- **Duplicated code / dead files?** → `repo-hygiene`
- **Design debt / reusable UI?** → `ui-primitive-consolidation` + `panacea-style-system`
- **Component consolidation?** → `panacea-component-sprint`
- **Multi-day feature sprint?** → `sprint-pipeline`

### Setup / Tooling
- **Desktop Commander issues?** → `desktop-commander-deploy`
- **Build / development setup?** → `panacea-dev`
- **Don't know where to start?** → `panacea-navigator` → then one of the above

---

## Tier 1: Always Have These Ready

- **panacea-dev** — Every chat starts here; project structure, build commands, conventions
- **panacea-navigator** — Orient fast; find files, understand data flows
- **fsrs-pipeline** — Core differentiator; most bugs live here
- **session-orchestration** — Students spend 90% of time here
- **panacea-verify** — Final gate before PR

---

## How to Request a Skill

**Option 1: Explicit mention**
> "Use session-orchestration to debug why questions aren't loading"

**Option 2: Problem description (Claude auto-suggests)**
> "The session freezes when I submit an answer"
> → Claude should auto-trigger `session-orchestration`

**Option 3: Multiple skills (composition)**
> "Debug FSRS not updating + drills broken"
> → Use: `fsrs-pipeline` + `panacea-fsrs-wiring` + `session-orchestration`

---

## When Skills Don't Auto-Trigger

If Claude doesn't suggest a relevant skill:
1. Look up the problem type above
2. Mention the skill name explicitly
3. Example: "Use dashboard-trust to audit the accuracy metrics"

This guide helps until description optimization improves auto-triggering. After that, most skills will trigger automatically.

---

Last updated: 2026-04-06
