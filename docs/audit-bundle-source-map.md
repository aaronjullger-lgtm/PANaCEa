# Audit Bundle — Source-of-Truth Map (Phase 0)

**Mission:** Normalize the attached audit bundle, separate stale from live findings, and verify every claim against current repository code before acting.
**Verification baseline:** branch `cursor/panacea-audit-stabilization-efdd`, HEAD `1f0d0ed5` (the exact commit the DevOps specialist audit was run against).
**Governing principle:** *Current repository code wins over audit text. Documentation is a lead, not truth, unless clearly corroborated by code.*

---

## 1. Documents reviewed & classification

| # | Bundle file | Stated date / commit | Type | Confidence of its findings |
|---|---|---|---|---|
| 1 | `audit_code_quality.md` | Jun 27 2026, indexed at `0ef58a0b` | **Primary specialist audit** (Code Quality) | High (source-verified), a few over-severities |
| 2 | `audit_devops_production.md` | Jun 27 2026, commit `1f0d0ed5` (== current HEAD) | **Primary specialist audit** (DevOps) | High — most current, matches HEAD |
| 3 | `audit_feature_completeness.md` | 2025-06-27 | **Primary specialist audit** (Features) | Medium-High |
| 4 | `audit_ui_ux_accessibility.md` | Jun 2026 | **Primary specialist audit** (UI/UX/a11y) | High for a11y (verified live) |
| 5 | `PANaCEa_Deep_Audit_Final_Report.md` | Jun 27 2026, main | **Aggregate/synthesis** (source-verified) | Medium — 1 finding proven WRONG (see §3) |
| 6 | `FSRS_AUDIT_REPORT.md` | "2025" | **Older focused specialist** (FSRS math) | Medium — math claims still hold; pipeline claim STALE |
| 7 | `security_audit_report.md` | 2025-01-21 | **Older focused specialist** (Security) | Medium — largely confirms mature security |
| 8 | `INFRASTRUCTURE_READINESS_REPORT.md` | (Deep-audit sub-report) | **Sub-report** referenced by #5 | Medium (dup of specialist content) |
| 9 | `PANaCEa_Feature_Completeness_Audit.md` | (Deep-audit sub-report) | **Sub-report / near-dup of #3** | Medium |
| 10-16 | `PANaCEa_Audit_sec00…sec06.md` | main `0ef58a0b` | **Section splits of the combined "Full Repository Audit"** (== the `.docx`) | Derived from #1-4; no new evidence |
| 17 | `PANaCEa_Audit.agent.final.md` | — | **Aggregate final** of the combined report | Derived |
| 18 | `PANaCEa_Audit.agent.outline.md` | — | **Outline** of the combined report | Derived (navigation only) |
| 19 | `PANaCEa_Full_Repository_Audit.docx` | main `0ef58a0b` | **Aggregate (binary)** — same content as sec00-06 | Derived |
| 20 | `plan.md` | — | **Audit methodology plan** (not an audit) | N/A |
| 21 | `plan copy.md` | — | **Audit methodology plan** (near-dup of #20) | N/A |

**Duplicate / derivative clusters:**
- `sec00–06` + `agent.final` + `agent.outline` + `.docx` are all the **same combined report**, itself synthesized from the 4 specialist audits (#1–4). Treat #1–4 as canonical; the rest add no independent evidence.
- `INFRASTRUCTURE_READINESS_REPORT` and `PANaCEa_Feature_Completeness_Audit` are the Deep-Audit's own sub-reports (dup of specialist content).
- `plan.md` / `plan copy.md` are methodology, not findings.

---

## 2. Main findings per document (condensed)

- **Code Quality (6.3/10):** dep vulns (#211/#212), hardcoded secrets in `wrangler.toml`, regex XSS sanitizer "dev-only," App.tsx god component, orphaned files, tsconfig sprawl; strong schema & TS strictness.
- **DevOps (C+):** no LICENSE, 252 branches, no staging, `--commit-dirty=true`, no npm-audit-in-CI, no Dependabot/SECURITY.md, 2 P0 "data identity" claims; strong CI (16 workflows), automation, backups.
- **Feature Completeness (78%):** #227 `/api/srs/due` 500, #239 study-loop, #210 FSRS Session UI, adaptive-selection/progressive-difficulty gaps, provenance pipeline; mature FSRS/DDx/OSCE/analytics.
- **UI/UX & a11y (6.9/10; a11y 4.5/10):** ProgressRing zero ARIA (#232), underpopulated `components/a11y/`, undocumented contrast, viz components lack ARIA; excellent perf & PWA.
- **Deep Audit (65-70%):** raises initial 40-45% estimate; flags ReviewLog pipeline "broken" and "Question frontend missing" (both disproven below).
- **FSRS audit:** core v6 math correct; retrievability factor deviation (intentional); "ReviewLog not written by production" (disproven below).
- **Security audit:** auth/validation/secrets/rate-limiting mature; prompt-injection & response-timing partial.

---

## 3. Contradictions & resolutions (verified against current code)

### C1 — Production readiness: 40-45% vs 65-70% vs C+ (6.5/10)
**Resolution:** Current code shows auth (Clerk+RBAC), Zod validation, rate limiting, secret redaction, CI (16 workflows), 190-model schema, 9,900+ tests are all real and mature. The 40-45% "artifact-only" estimate is **stale/inferential**. Reality ≈ "advanced but pre-launch": a small set of real, mostly-procedural blockers remain. **Confidence: high (code-verified).**

### C2 — "No production code writes to ReviewLog" (FSRS + Deep audits) vs wired
**Resolution: STALE / FALSE.** `lib/services/drillReviewService.ts` calls `prisma.reviewLog.create` (lines 1618, 2119) through the dedicated `lib/services/reviewLogService.ts` (`createReviewLogEntry`), which validates DB CHECK constraints and gates `review_type` (`real`/`rapid_guess`/`cram`/`practice`). The stale claim originates from `docs/AUDIT_REVIEW_LOG_SCHEMA_FSRS.md`. **Confidence: high.**

### C3 — "Question answering frontend missing (QuestionCard/QuizSession)" (Deep Audit FINDING-007)
**Resolution: FALSE.** `components/session/QuizView.tsx` (2274 lines) + `components/session/QuestionDisplay.tsx` exist and are the core study surface. The Deep Audit looked for specific filenames that don't match this repo's naming. **Confidence: high.**

### C4 — `/api/srs/due` returns 500 (#227)
**Resolution: LIKELY ALREADY ADDRESSED IN CODE.** `functions/api/srs/due.ts` reads canonical `Card` + `UserTopicProgress` + `UserProgress`, dedups overlapping rows, and its `catch` returns an **empty, resilient payload (200), not 500**. It ships with `functions/api/srs/due.test.ts` (14 KB). Issue remains open but the code path no longer 500s. **To confirm in Phase 2 by running the test.**

### C5 — Regex XSS sanitizer is a production security hole
**Resolution: OVER-SEVERITY / MOSTLY STALE.** `lib/middleware/validation.ts` (the flagged file) is imported only by legacy `server.ts` (Express, dev-only) and `_trash/old-routes/*`. Production Cloudflare functions use `functions/api/_shared/validation.ts` + Zod `.strict()`. `dompurify` is present only transitively (not a direct dep), so a DOMPurify migration is still a **new direct dependency → approval-gated**. **Confidence: high.**

### C6 — FSRS retrievability factor deviation is a bug
**Resolution: INTENTIONAL & DOCUMENTED.** `factor = w[19]` (ts-fsrs defaults; R(S,S)≈75.4%) is a deliberate, in-code-documented product choice, not a defect. No scheduling-semantics change without tests + product/science approval.

### C7 — #210 lists "Again/Hard/Good/Easy" rating buttons
**Resolution: DOCS LEAD TO IGNORE.** PANaCEa is **implicit-only**: FSRS rating is behaviorally derived (`lib/implicit-metrics.ts`); there are **no explicit student-facing rating buttons** (confirmed by product owner + CLAUDE.md). The issue text is aspirational/legacy wording. **Session-UI work must never solicit an explicit rating.**

---

## 4. Findings that MUST be verified in current code before any action

| Finding | Verified? | Result |
|---|---|---|
| ReviewLog production writes | ✅ | Wired (C2) — stale claim |
| `/api/srs/due` 500 | ⏳ Phase 2 | Code hardened; run test to confirm |
| Study-loop #239 | ✅ (issue read) | Fix lives in **open PR #239**, blocked on live secrets/infra — verify presence in branch, do not re-implement |
| ProgressRing ARIA (#232) | ✅ | LIVE — zero ARIA in current file |
| Viz components ARIA | ✅ (exist) | Need per-file audit in Phase 6 |
| `--commit-dirty=true` | ✅ | LIVE (`deploy.yml:107`) |
| wrangler.toml committed keys | ✅ | LIVE — VITE_ client-public keys (pk_live_/anon/DSN); no true secrets |
| No LICENSE | ✅ | LIVE — owner decision required |
| Dep vulns | ✅ | 25 vulns; most dev/build tooling; prod-relevant: react-router-dom, @clerk/shared→js-cookie, nodemailer |
| npm audit in CI | ✅ | Absent — safe to add advisory step |
| 259 remote branches | ✅ | LIVE hygiene — deletion approval-gated |

---

*Phase 0 complete. Live vs stale separation drives Phases 2–8. Approval-gated items are documented, not acted upon.*
