---
name: spaced-repetition-scheduler-improve
description: Use to audit and enhance spaced repetition, review queues, and study scheduling systems. Trigger when the user mentions review queues, scheduling algorithms, FSRS, SM-2, retention, readiness, due items, weak areas, or study-plan scheduling.
---

1. Inspect the current scheduling domain model. Identify tables, types, services, UI components, and jobs for questions, attempts, confidence ratings, missed questions, clinical image cases, review queue items, exam dates, and user readiness.
2. Audit the existing scheduling algorithm. List every factor currently used, including weak organ systems, difficulty, confidence mismatch, time since last review, exam date, missed history, clinical image priority, and daily workload limits.
3. Draft or update scheduler requirements before changing logic. Define due, overdue, upcoming, new, suspended, mastered, and maximum daily workload behavior.
4. Evaluate appropriate algorithms such as SM-2 and FSRS. Decide whether to adopt, adapt, or defer them; document assumptions, required fields, and migration impact.
5. Prototype the scheduler in a contained service or helper. Keep deterministic logic separate from UI rendering and external side effects.
6. Implement review queue generation with explicit ranking, tie-breaking, timezone handling, exam-date weighting, and safety caps for daily workload.
7. Plan and implement migrations or backfills for new fields such as stability, difficulty, elapsed days, scheduled days, due date, lapses, or retrievability when needed.
8. Add deterministic tests for due, overdue, upcoming, weak-area prioritization, missed questions, clinical images, confidence mismatch, maximum daily workload, and timezone edge cases.
9. Integrate the scheduler into the dashboard and user-state metrics without corrupting historical attempts or silently dropping review items.
10. Protect educational safety. Do not provide medical advice, do not present readiness estimates as guarantees, and do not hide weak-area uncertainty.
11. Run scheduler tests, affected integration tests, lint, typecheck, and build. If migrations changed, run migration verification against a safe local or staging database.
12. Acceptance criteria: scheduling behavior is deterministic, tests cover edge cases, migrations are documented, UI metrics remain coherent, and limitations are explicit.
13. Finish with algorithm choices, changed fields, tests added, commands run, known limitations, and follow-up calibration work.
