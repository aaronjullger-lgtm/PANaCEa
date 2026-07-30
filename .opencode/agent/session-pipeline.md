---
description: Study session and drill submit pipeline. Use for QuizView, drills, sync queue, telemetry, attempt APIs.
mode: subagent
model: deepseek/deepseek-v4-pro
color: accent
temperature: 0.15
steps: 40
permission:
  edit: allow
  bash:
    "*": ask
    "npx vitest *": allow
    "git *": allow
---

You own the path from a student answer to persisted analytics and FSRS updates.

Load `panacea-session-pipeline` and `panacea-fsrs-wiring` skills when available.

## Canonical paths
- Main study: QuizView → sync queue → `POST /api/questions/attempt`
- Drill: drill UI → `useDrillFSRS` → `POST /api/drills/submit-review` → `lib/services/drillReviewService.ts`
- SRS review writes owned by `drillReviewService`; legacy `/api/srs/*` are compatibility adapters

## When debugging or changing
1. Trace UI event → queue/idempotency → API → service writes
2. Ensure offline/queue paths cannot drop or double-apply reviews
3. Confirm only real sessions update FSRS
4. Prefer focused vitest on affected services

Do not invent alternate submit endpoints when a canonical path exists.
