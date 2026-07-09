# Current Baseline & Audit Reconciliation (Phase 1)

**Branch:** `cursor/panacea-audit-stabilization-efdd`
**Base commit:** `1f0d0ed5` (== the commit the DevOps specialist audit ran against)
**Package manager / runtime:** npm; Node engine `>=22` (`.node-version` = 22). `node_modules` already present (865 pkgs); no reinstall needed.

> All results below are from **local command execution** on this branch. Two small, safe, root-cause fixes were required to restore red baseline gates to green (documented inline).

---

## 1. Baseline command results

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` (`tsc -p tsconfig.production.json`) | ❌→✅ **PASS after fix** | 2× `TS2345` in `lib/study/renderStructuredRationale.ts` (lines 53, 105). Root cause: `rationale[key as keyof …]` widens to `string \| string[] \| object[]`, but `cleanText(value?: string)` only accepted `string`. Fix: param → `unknown` (helper already returns `''` for non-strings — behavior-preserving). Commit `611e115f`. |
| `npm run lint` (`eslint . --max-warnings 2000`) | ❌→✅ **PASS after fix** | 3× `no-empty` **errors** (`lib/nccpa-question-weighting.ts:382,393`, `services/medicalComplianceService.ts:741`) in demo/stub code. Fix: explanatory comments/`void` inside empty blocks. 251 warnings remain (under the 2000 cap; mostly `no-restricted-syntax` raw-hex + `prefer-const`). Commit `6cbafe53`. |
| `npm run build` (vite production) | ✅ **PASS** | Full client + PWA + Cloudflare Functions bundle generated. |
| `npm run test:critical` | ✅ **PASS** | 143 tests / 6 files (FSRS core, optimizer bridge, retrievability, EOR scheduler, canonical verification, study store). |
| `npm run audit:prisma` | ✅ **PASS** | 315 endpoints correctly call `safePrismaDisconnect` in `finally`; 0 failures. |
| `npm run audit:zod` | ✅ **PASS** | 202 mutation endpoints validated; 0 FAIL; 2 WARN (Sentry tunnel, Clerk webhook — Zod not applicable). |
| `npm run audit:services` | ✅ **PASS** | Informational; 15 service files, within target. |
| `npm audit --audit-level=moderate` | ⚠️ **25 vulns** | 2 critical, 11 high, 10 moderate, 2 low. See §3 + `docs/security-hardening-report.md`. |
| Targeted: `functions/api/srs/{due,submit,submit-compat}.test.ts` | ✅ **PASS** | 23 tests. Confirms `/api/srs/due` no longer 500s. |
| Targeted: `tests/drillReviewService.test.ts` | ✅ **PASS** | 17 tests. Confirms ReviewLog write path + isolation. |
| Targeted: loop tests (`reviewQuestionResolver`, `questions/attempt`, `study/session-generate`, `useStudyStore`, `questionIdentity`) | ✅ **PASS** | 69 tests. |
| `npm run test:e2e:a11y` | ⏸️ **Deferred** | Requires a running dev server (+ Clerk for authed routes); run in Phase 6/10 only if it works without live secrets. Not a code gate. |

**Net:** the branch's baseline compile/lint/build/critical-test gates are **green** after two small fixes that were themselves confirmed-live blockers (the production typecheck gate was red on HEAD).

---

## 2. Audit findings — confirmed LIVE vs STALE vs ENV-BLOCKED vs APPROVAL-REQUIRED

### Confirmed LIVE (actionable now, safe)
- **Production typecheck was red** (`renderStructuredRationale.ts`) — *fixed*.
- **Lint gate was red** (3 `no-empty`) — *fixed*.
- **`ProgressRing.tsx` has zero ARIA** (#232) — Phase 6.
- **Viz components lack ARIA** (`EpistemicGauge`, `Sparkline`, `TrendSparkline`, `AnimatedCounter`, `RadialProgress` all exist) — Phase 6.
- **`deploy.yml:107` `--commit-dirty=true`** — Phase 3 (repo-only).
- **No `npm audit` step in CI** — Phase 8 (advisory add).

### Confirmed STALE / already fixed (current code wins)
- **"No production code writes ReviewLog"** → wired (`drillReviewService` + `reviewLogService`); tests pass.
- **`/api/srs/due` 500 (#227)** → endpoint hardened; 23 tests pass. Issue is code-resolved (owner may close).
- **"Question answering frontend missing"** → `QuizView.tsx` + `QuestionDisplay.tsx` exist.
- **Regex XSS sanitizer "production hole"** → the flagged `lib/middleware/validation.ts` is legacy/dev-only (`server.ts` + `_trash/`); prod uses `_shared/validation.ts` + Zod. `audit:zod` = 0 fail.
- **FSRS retrievability deviation** → intentional/documented.

### ENV / credential-blocked (cannot complete here; not our keys)
- **#239 study-loop full remediation** — identity-contract migration `20260517000000_add_question_identity_contract` is applied and identity fields exist, but `withProgressLinkage` (serving gate) + `fsrsSkippedReason` (observability) are **absent** → they live in **open PR #239**, whose remaining steps need live `GEMINI_API_KEY`/`DATABASE_URL`/`CLERK_SECRET_KEY`. We verify + document; we do **not** re-implement or connect to prod.
- **Live/authenticated E2E smoke** — needs Clerk test creds + running edge runtime.

### APPROVAL-REQUIRED (documented, not acted upon)
- Committed `pk_live_`/anon/DSN in `wrangler.toml` (VITE_ client-public; no true secrets) → owner rotation.
- No LICENSE → owner picks.
- Dependency vulns → safe patch/minor only; majors gated.
- 259 remote branches → deletion gated.
- Any Prisma migration / DB backfill / staging / scheduler / deploy.

---

## 3. `npm audit` triage (summary; full plan in security-hardening-report.md)
- **2 critical:** `concurrently → shell-quote` (dev), `shell-quote` (dev). → dev tooling only.
- **11 high:** `react-router-dom`/`react-router` (prod), `@clerk/shared → js-cookie` (prod auth), `nodemailer` (server email), plus dev/build: `vite`, `miniflare`, `undici`, `ws`, `hono`, `protobufjs`, `js-cookie`.
- **Prod-facing priority:** `react-router-dom` (turbo-stream deserialization / open redirect), `@clerk/shared` (cookie injection), `nodemailer` (header injection).
- **Action:** apply safe patch/minor `npm audit fix` (no `--force`), re-audit, and gate any major/breaking upgrades (e.g., react-router major) behind approval.

---

*Phase 1 complete. Baseline is green; live/stale/blocked/approval buckets are evidence-backed. Broad implementation proceeds from here per the plan.*
