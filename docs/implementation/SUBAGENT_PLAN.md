# Subagent Plan

Subagents here are conceptual decomposition roles, not parallel execution tracks. One implementation thread runs at a time. This document exists to make the division of responsibility explicit so the work stays coherent across a multi-task run.

## Audit Interpreter

- **Purpose.** Re-read the relevant section of `UNFINISHED_WORK_MASTER_AUDIT.md` before each task; classify each claim as `accurate`, `stale`, or `already fixed`; write that classification into `AUDIT_RECONCILIATION.md`.
- **When to use.** Before starting any task. Also any time the audit and code disagree.
- **Files inspected.** `UNFINISHED_WORK_MASTER_AUDIT.md`, all `docs/**` references the audit points at, and the code files cited as evidence.
- **Allowed changes.** None to source code. Only writes `AUDIT_RECONCILIATION.md` entries and queue notes.
- **Forbidden.** Taking the audit's word for anything the code actually contradicts.
- **Handoff.** Writes a one-paragraph "verify-first" block into the task's progress note (`docs/implementation/progress/[TASK-ID].md`) before the Repo Mapper or implementer touches code.

## Repo Mapper

- **Purpose.** Locate the exact files to change. Establish existing patterns to imitate (imports, middleware wrappers, schema organization, logger usage, error codes).
- **When to use.** At the start of any task that touches files the current session has not already read.
- **Files inspected.** Any file in-scope for the task, plus sibling files under the same directory to confirm the pattern.
- **Allowed changes.** Read only.
- **Forbidden.** Editing files or running any write operations.
- **Handoff.** Writes a "planned-code-changes" block into the progress note with specific line ranges and the pattern to apply.

## Backend API Agent

- **Purpose.** Apply Zod validation and middleware wrappers to Cloudflare edge functions in `functions/api/**`. Preserve existing auth model, Prisma client lifecycle, logging, and error-response shape.
- **When to use.** All TASK-002…TASK-006 work in this run.
- **Files inspected.** `functions/api/**`, `functions/api/_shared/middleware.ts`, `functions/api/_shared/zodSchemas.ts`, `lib/api/schemas/**`.
- **Allowed changes.** Adding `import { z } from 'zod'`, defining a local request schema or importing a shared one, swapping raw `onRequestPost` handlers into `authenticatedEndpoint(schema, handler)` / `adminAuthenticatedEndpoint` / `publicEndpoint`, and wiring `validated.body` into the handler body in place of `await request.json()`. Minimal, pattern-preserving.
- **Forbidden.** Changing the handler's business logic, changing the response shape, introducing new production dependencies, changing auth requirements (e.g. making an admin endpoint public), changing Prisma query behavior, changing rate-limit defaults, renaming env vars.
- **Handoff.** Reports which endpoints are now PASS under the improved audit and notes any endpoint that needed a non-trivial refactor (those are marked `partial` and punted).

## Frontend Implementation Agent

- **Purpose.** Single-location UI fixes. Specifically TASK-001 — removing the OSCE bogus `queueAnswer` write.
- **Files inspected.** `components/modes/PatientEncounterMode.tsx`, `lib/sync/syncManager.ts` or wherever `queueAnswer` is defined, `hooks/useConditionSchedule.ts` (the condition-level scheduler that stays).
- **Allowed changes.** Removing the bogus `syncManager.queueAnswer` block (and its enclosing `if (currentCase)` only if the condition-schedule call is also gone — it isn't, so keep the `if`). Keep `updateConditionSchedule` intact.
- **Forbidden.** Altering OSCE grading flow, rubric handling, or `completeOSCESession`. No FSRS wiring changes.
- **Handoff.** Notes the exact line range removed and confirms the condition-schedule call remains.

## Testing/Verification Agent

- **Purpose.** Re-run the improved Zod audit and improved Prisma audit after each subsystem cluster. Spot-check typecheck on touched files.
- **When to use.** After every task and at the end of the run.
- **Allowed changes.** Running audit scripts; never edits.
- **Forbidden.** Declaring a task complete if the improved audit still flags the just-touched endpoints.
- **Handoff.** Writes audit deltas into the task's progress note and into `IMPLEMENTATION_LOG.md`.

## Docs/Reconciliation Agent

- **Purpose.** Keep `IMPLEMENTATION_QUEUE.md`, `IMPLEMENTATION_LOG.md`, `AUDIT_RECONCILIATION.md`, and each `docs/implementation/progress/[TASK-ID].md` note in sync with reality.
- **When to use.** After every task outcome, including partial and blocked outcomes.
- **Allowed changes.** All files under `docs/implementation/**` and reconciliation notes that mention sections of `UNFINISHED_WORK_MASTER_AUDIT.md`.
- **Forbidden.** Editing the master audit itself (reconciliation is additive, not destructive).

## Non-goals (explicitly not run this session)

- Data/Prisma Agent — this run requires zero schema changes.
- Workflow/Automation Agent — push reminder scheduler / backup-restore verification are deferred.
- Any subagent that would introduce a new production dependency.

## Parallelism policy

No parallel agent execution this run. Tasks are sequenced to share momentum across similar changes (all admin endpoints, then all user-facing writes, then all content pipeline writes). The Audit Interpreter and Repo Mapper run inline as disciplined pre-reads before each task rather than as separately spawned agents.
