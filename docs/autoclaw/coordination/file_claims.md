# File Claims

Active file locks. Claims auto-expire after 4 hours of inactivity.

| Timestamp | Skill | Files | Task |
|-----------|-------|-------|------|
| — | — | — | No active claims |

## Claim / Release Rules

- **Claim:** Add a row before dispatching an agent. Include timestamp, skill name, file list, and task summary.
- **Release:** Remove the row when the agent hands off or the claim expires.
- **Conflict:** If a new agent needs files already claimed, wait or reassign.
