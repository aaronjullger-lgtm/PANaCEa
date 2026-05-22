# File Claims

Active file locks. Claims auto-expire after 4 hours of inactivity.

| Timestamp | Skill | Files | Task |
|-----------|-------|-------|------|
| 2026-05-22 18:00 EDT | panacea-repo-hygiene | learner-facing mode/session components (TBD after audit) | Reduce API-envelope callers in learner-facing components |
| 2026-05-22 18:00 EDT | panacea-session-pipeline | components/modes/PatientEncounterMode.tsx, lib/utils/encounterHelpers.ts | Decompose PatientEncounterMode (2,848→target ~1,500 lines) |

## Claim / Release Rules

- **Claim:** Add a row before dispatching an agent. Include timestamp, skill name, file list, and task summary.
- **Release:** Remove the row when the agent hands off or the claim expires.
- **Conflict:** If a new agent needs files already claimed, wait or reassign.
