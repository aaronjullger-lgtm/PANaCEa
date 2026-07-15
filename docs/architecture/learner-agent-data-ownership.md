# Learner Agent — Data Ownership

## Principle

**Postgres is canonical.** Durable Object state is ephemeral/session-oriented. KV holds user-approved memories only in v1.

## Ownership matrix

| Data | Owner | Learner Agent access |
|------|-------|----------------------|
| User identity | Postgres `User` + Clerk | Read via resolver; never trust client `userId` |
| FSRS scheduling | Postgres `UserProgress`, `Card` | Read via tools; write via `submitDrillReview` only |
| Attempts | Postgres `QuestionAttempt` | Write via drill pipeline, not agent prompts |
| Study plans | Postgres `DailyStudyPlan`, `StudyPlan` | Read; revision via workflow + study-plan APIs |
| Recommendations (persisted) | Postgres `StudyRecommendation` | Not written by Learner Agent v1 |
| Next-best-action (computed) | `learnerNextActionService` | Ephemeral; returned to client/DO |
| Agent conversation turns | LearnerAgent DO | Bounded buffer; not long-term memory |
| Approved learner memories | KV `learner-memory:{userId}` | User confirm/correct/delete via API |
| Connection tokens | KV `learner-connect:{token}` | 5-minute TTL |
| Reminder metadata | KV `learner-reminder:{userId}:{id}` | Idempotent create |
| Graph clinical knowledge | Postgres `GraphNode`/`GraphEdge` | Read via grounded content / graphRag |
| Graphiti / Neo4j | N/A | Not used |

## What the model must not own

- Mastery scores
- FSRS parameters
- Assignment records (unless learner explicitly states and confirms as memory)
- Exam dates not in profile
- Rotation requirements not in profile or plan data

## Memory policy summary

See `lib/services/learnerAgent/memoryPolicy.ts`. High-impact categories require confirmation. Full transcripts are not persisted by default.
