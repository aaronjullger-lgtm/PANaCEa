# Known Failure Modes

Recurring traps observed in this repo. Each: date · context · lesson · evidence · where · lifetime.

## Stale audits treated as live backlog
- **Date:** 2026-07-09
- **Context:** `UNFINISHED_WORK_MASTER_AUDIT.md` (2026-04-16) and `pancea-deep-research-report` (2026-05-22)
  described many issues already fixed in code.
- **Lesson:** Always reconcile audit claims against current code (and re-run the *fixed* audit scripts)
  before queuing work. Prior fixes live in `docs/implementation/AUDIT_RECONCILIATION.md` (TASK-001…021).
- **Evidence:** OSCE `queueAnswer` already removed; `audit:zod` 0 FAIL; `NotificationLog` model+migration
  already exist; `routes/` already retired to `_trash/`.
- **Where:** any audit-driven mission.
- **Lifetime:** permanent.

## Audit-script false positives (wrapper-blindness)
- **Date:** 2026-07-09 (root cause fixed 2026-04-16)
- **Context:** original `audit-zod-validation.ts` reported "145 FAIL" because it didn't recognize the 7
  shared middleware wrappers, the TS-generic call form, or out-of-band security (CRON_SECRET/Svix).
- **Lesson:** trust the *fixed* audit output; don't re-derive endpoint counts from old audit prose.
- **Evidence:** post-fix `audit:zod` = 202 PASS / 0 FAIL.
- **Where:** `scripts/audit-*.ts`.
- **Lifetime:** permanent.

## Secret scanner false-positive on "development"
- **Date:** 2026-07-09
- **Context:** the pre-commit secret hook treats the value of env var `ENVIRONMENT` (= "development")
  as a secret, so any doc containing the substring "DEVELOPMENT" (e.g. the real filename
  `LOCAL_DEVELOPMENT.md`) is blocked.
- **Lesson:** for legitimate false positives on a non-secret env value, commit with
  `env -u ENVIRONMENT git commit ...` (surgical — all other secret detection stays active). Do NOT
  weaken the hook or add pragma noise to prose.
- **Evidence:** `docs/express-to-edge-retirement-map.md` line 36 blocked on "LOCAL_DEVELOPMENT.md".
- **Where:** committing docs that reference `LOCAL_DEVELOPMENT.md` or the word "development".
- **Lifetime:** temporary (until the hook's ENVIRONMENT rule is scoped).

## PatientEncounterMode active-view extraction is a prop-drilling trap
- **Date:** 2026-07-09
- **Context:** a prior full `EncounterActiveView.tsx` (1,267 lines, ~55 props) was created then
  backed out.
- **Lesson:** don't re-attempt a monolithic active-view extraction; extract low-coupling read-only
  leaves, or do a context-based state share first. See `do-not-repeat.md`.
- **Evidence:** commits `8b270979` (add wip) → `2af22271` (remove).
- **Where:** `components/modes/PatientEncounterMode.tsx`.
- **Lifetime:** permanent until a context refactor lands.
