# Study Plan Intelligence Audit

Date: 2026-05-02

Readiness: **72/100 (C)** for planning and **68/100 (D)** for dashboard next-best-action logic.

## Study Plan Intelligence Table

| Input | Source | Used Currently? | Should Be Used? | Issue | Fix |
|---|---|---|---|---|---|
| User goal | user/profile/plan routes | Partial | Yes | Not always propagated to selectors | Add goal to learning-state snapshot |
| Rotation | `rotation-systems.ts`, user context | Partial | Yes | EOR maps partial | Canonical rotation taxonomy |
| Exam date | study plan services, EOR clamp | Partial | Yes | Urgency not consistently passed to review submit | Propagate exam context through review/planner |
| Weak areas | `UserProgress`, Rolling360 | Yes | Yes | Weakness formula limited | Weighted weakness score |
| Due reviews | `UserProgress.nextReviewAt` | Yes | Yes | Some routes bypass shared due selector | Shared due selection service |
| Available days | plan prefs | Partial | Yes | Limited schedule constraints | Persist availability model |
| Daily workload | `dailyStudyAllocatorService.ts` | Yes | Yes | Needs missed-day recovery | Add recovery algorithm |
| Content coverage | blueprint services | Partial | Yes | Conflicting taxonomy weights | Canonical blueprint map |
| Missed days | inferred incompletely | Partial | Yes | No full replanning simulation | Add schedule-adjustment tests |
| Plan completion | plan/session models | Partial | Yes | Dashboard not always traceable | Link completed tasks to recommendation reasons |

## Recommendation Engine Table

| Signal | Current Source | Used in Recommendation? | Weight/Priority | Issue | Fix |
|---|---|---|---|---|---|
| Due reviews | `UserProgress` | Yes in main engine | High | Filter inconsistency | Shared due-review query |
| Weak areas | progress/accuracy | Yes | High | Weakness formula shallow | Weighted weakness model |
| Upcoming exam | plan context | Partial | High | Not universally available | Exam-context snapshot |
| Rotation topic needs | rotation maps | Partial | Medium/high | Partial maps | Canonical rotation maps |
| Recent attempts | attempts/review logs | Partial | Medium | Not consistently joined | Snapshot recent performance |
| Confidence | telemetry/review log | Limited | Medium | Calibration disconnected | Include calibration risk |
| Readiness score | analytics routes | Partial | Medium | Can lose system attribution | Fix progress attribution |
| Study plan | plan items | Partial | High | Legacy engine mismatch | Single engine reads active plan |
| User preferences/time | prefs | Partial | Medium | Availability model incomplete | Store daily availability and session size |

## Algorithm Proposal

Create a single `NextBestActionRanker` fed by `LearningStateSnapshot`.

Priority order:

1. Overdue FSRS reviews with high retrievability risk.
2. Weak blueprint areas with upcoming exam/rotation relevance.
3. Plan items due today.
4. New content needed for coverage.
5. Calibration or confidence-repair tasks after misleading performance.

Every recommendation should include `why`, `estimatedMinutes`, `mode`, `sourceSignals`, and `whatChangesAfterCompletion`.
