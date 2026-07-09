# Validation History

> Canonical (tracked) location: `docs/agent-memory/`. `.cursor/memory/` is gitignored
> (`.gitignore:227`), so durable agent memory is persisted here instead.

Concise log of validation baselines captured during stabilization runs. Newest first.

## 2026-07-09 — Root-cause stabilization run (branch `cursor/panacea-root-cause-stabilization-72c0`)

| Check | Command | Before | After |
|---|---|---|---|
| Type safety (prod) | `npm run typecheck` | 2 errors | **0** |
| Lint | `npm run lint` | 3 errors, 254 warn | **0 errors**, 251 warn |
| Build | `npm run build` | pass (~17s) | pass (~17s) |
| Full tests | `npm test` | 9,850 pass / 1 skip / 0 fail (527 files) | **9,856 pass / 1 skip / 0 fail (528 files)** (+7 new tests) |
| Critical tests | `npm run test:critical` | 143 pass | 143 pass |
| `audit:zod` | — | 202 PASS / 2 WARN / 0 FAIL | unchanged |
| `audit:prisma` | — | all pass | unchanged |
| `audit:loading` | — | 1 content-spinner pattern | unchanged (broad advisory tail deferred) |

- **Context:** date 2026-07-09; permanent record.
- **Note:** full-strict `typecheck:all` still ~1,151 pre-existing error lines (services/optimizer,
  imageOptimizationService, admin/refinery/action) — NOT CI-gating (CI = `tsconfig.ci.json` /
  `tsconfig.production.json`). Documented in `docs/cursor-followup-issues.md`.
