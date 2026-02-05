# PANaCEa npm Scripts Reference

Scripts are grouped by domain. Use this when you need to run a one-off task or automation.

## Development

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run dev:server` | Start Express dev server (legacy, local only) |
| `npm run dev:all` | Run Vite + Express concurrently |
| `npm run dev:wrangler` | Run Vite with Wrangler Pages (Functions + env bindings) |
| `npm run build` | Production Vite build |
| `npm run build:server` | Build Express server (legacy) |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm run typecheck:ci` | TypeScript check with tsconfig.ci.json |
| `npm run lint` | ESLint (max-warnings 2000) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |

## Database

| Script | Description |
|--------|-------------|
| `npm run db:push` | Prisma db push (dev schema sync) |
| `npm run db:generate` | Prisma generate |
| `npm run db:studio` | Prisma Studio UI |
| `npm run db:migrate:deploy` | Deploy migrations (production) |
| `npm run db:migrate:dev` | Create/apply migrations (dev) |
| `npm run db:seed` | Run seed script |
| `npm run db:orchestrate` | Maintenance orchestrator |
| `npm run db:automate` | Orchestrate script (full) |
| `npm run db:automate:quick` | Orchestrate (quick) |
| `npm run db:automate:skip-gen` | Orchestrate (skip generation) |
| `npm run db:sync-to-registry` | Sync DB to registry files |
| `npm run db:validate` | Validate database |
| `npm run db:quality` | Check content quality |
| `npm run db:relationships` | Validate relationships |
| `npm run db:deduplicate` | Deduplicate records |
| `npm run db:generate-content` | Generate content |
| `npm run db:backup` | Emergency backup |
| `npm run db:restore` | Emergency restore |
| `npm run db:unify` | Unify condition/medical content |
| `npm run db:link-questions` | Link questions to conditions |
| `npm run db:health` | Data integrity monitor |
| `npm run db:fulltext-search` | Apply fulltext search |
| `npm run db:completeness` | Content completeness dashboard |
| `npm run db:enrich` | Enrich critical conditions |
| `npm run db:enrich-template` | Generate enrichment template |
| `npm run db:apply-enrichment` | Apply enrichment |
| `npm run db:deprecate-flagged` | Auto-deprecate flagged questions |
| `npm run db:audit-progress` | Audit user progress |

## Content & generation

| Script | Description |
|--------|-------------|
| `npm run sync:condition-content` | Convert MD to JSON for conditions |
| `npm run sync:all-registries` | Sync all registries |
| `npm run seed` | Alias for db:seed |
| `npm run seed:registry` | Seed DB from registry |
| `npm run seed:question-pool` | Seed question pool |
| `npm run regenerate:pool-v2` | Regenerate pool v2 |
| `npm run content-doctor:phase1` | Content doctor phase 1 |
| `npm run content-doctor:phase2` | Content doctor phase 2 |
| `npm run content-doctor:buzzwords` | Content doctor buzzwords |
| `npm run content-doctor:mnemonics` | Content doctor mnemonics |
| `npm run content-doctor:guidelines` | Content doctor guidelines |
| `npm run content-doctor:triads` | Content doctor triads |
| `npm run content-doctor:pearls` | Content doctor pearls |
| `npm run standardize:formatting` | Standardize content formatting |
| `npm run standardize:formatting:dry-run` | Dry run formatting |
| `npm run standardize:formatting:regenerate` | Regenerate with formatting |
| `npm run assess:adequacy` | Assess content adequacy |
| `npm run assess:adequacy:regenerate` | Regenerate adequacy |
| `npm run generate:lab` | Generate lab content |
| `npm run generate:clinical` | Generate clinical content |
| `npm run generate:missing-content` | Generate missing content |
| `npm run generate:test` | Test content generation |
| `npm run generate:basic-science-links` | Generate basic science links |
| `npm run generate:basic-science-links:incremental` | Incremental basic science links |
| `npm run generate:labtest-enhancer` | Lab test enhancer |
| `npm run generate:sens-spec` | Sensitivity/specificity filler |
| `npm run generate:mnemonics` | Mnemonic generator |
| `npm run generate:board-facts` | Board facts filler |
| `npm run generate:medical-content` | Medical content filler |

## Migrations (one-off)

| Script | Description |
|--------|-------------|
| `npm run migrate:pharm` | Migrate pharm to DB |
| `npm run migrate:guidelines` | Migrate guidelines to DB |
| `npm run migrate:media-manifest` | Migrate media manifest to DB |
| `npm run migrate:buzzwords` | Migrate buzzwords to DB |
| `npm run migrate:production` | Apply production migration |
| `npm run migrate:related-systems` | Migrate related systems |

## Media & images

| Script | Description |
|--------|-------------|
| `npm run media:integrate` | Media integrator |
| `npm run media:process-existing` | Process existing photos |
| `npm run media:audit` | Audit media needs |
| `npm run infographic:match` | Match infographics |
| `npm run infographic:audit` | Audit infographics |
| `npm run images:fetch` | Fetch clinical images |
| `npm run images:fetch:dry-run` | Dry run image fetch |
| `npm run images:upload` | Upload helper |
| `npm run images:batch` | Batch upload |
| `npm run images:test` | Test image workflow |
| `npm run images:status` | Image acquisition status |
| `npm run images:list` | List images |
| `npm run images:plan` | Plan image acquisition |
| `npm run images:plan-system` | Plan by system |
| `npm run images:bulk` | Bulk image fetcher |
| `npm run images:bulk-one` | Bulk fetch one |
| `npm run images:preview` | Preview bulk fetch |
| `npm run images:curated` | Fetch curated images |
| `npm run images:local` | Process local images |

## Automation (scheduled / workers)

| Script | Description |
|--------|-------------|
| `npm run worker` | Background worker |
| `npm run schedule` | Schedule jobs |
| `npm run automation:hourly` | Hourly tasks |
| `npm run automation:daily` | Daily tasks |
| `npm run automation:weekly` | Weekly tasks |
| `npm run orchestrate:full` | Full automated pipeline |
| `npm run orchestrate:context-aware` | Context-aware orchestration |
| `npm run maintenance:weekly` | Weekly maintenance |
| `npm run maintenance:weekly:dry-run` | Weekly maintenance dry run |
| `npm run health-check` | Content health checker |
| `npm run system-health` | System health |
| `npm run stats:platform` | Platform statistics |
| `npm run stats:content` | Content statistics |

## Testing

| Script | Description |
|--------|-------------|
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E |
| `npm run test:e2e:wrangler` | E2E with Wrangler config |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:headed` | Playwright headed |
| `npm run test:smoke` | Smoke E2E (all-modes) |
| `npm run test:auth` | Auth E2E setup |
| `npm run test:auto-author` | Auto-author test |
| `npm run test:basic-science-links` | Basic science links test |

## Audits

| Script | Description |
|--------|-------------|
| `npm run audit:prisma` | Audit Prisma disconnect usage |
| `npm run audit:zod` | Audit Zod validation |
| `npm run audit:loading` | Audit loading states |
| `npm run audit:services` | Audit service consolidation |
| `npm run audit:components` | Audit component organization |
| `npm run audit:all` | Run all audits |

## Deploy & fix

| Script | Description |
|--------|-------------|
| `npm run pages:build` | Alias for build |
| `npm run pages:serve` | Wrangler pages dev (dist) |
| `npm run pages:dev` | Build + Wrangler pages dev |
| `npm run deploy:local` | Build + Wrangler pages deploy |
| `npm run fix:condition-ids` | Fix fake condition IDs |
| `npm run optimize-params` | Optimize params |
| `npm run demo:question-improvements` | Demo question improvements |
| `npm run demo:question-sprint-b` | Demo sprint B |
| `npm run demo:question-sprint-c` | Demo sprint C |
| `npm run pdf:batch-process` | Batch process PDFs |
| `npm run pdf:status` | Check PDF processing status |

## When to use what

- **CI/CD:** `typecheck`, `lint`, `build`, `test` (see `.github/workflows/ci.yml`).
- **Local dev:** `dev` or `dev:wrangler` for full stack.
- **DB changes:** `db:migrate:dev` then `db:generate`; production uses `db:migrate:deploy`.
- **Content fixes:** `content-doctor:*` or `standardize:formatting`.
- **One-off data:** `db:backup`, `db:restore`, `db:sync-to-registry`, etc.
