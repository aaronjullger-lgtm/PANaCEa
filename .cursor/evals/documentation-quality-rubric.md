# Rubric: Documentation Quality

Grades docs/memory updates (used by Documentation agent + `repo-memory-update`/`repo-learning-loop`).

## Pass criteria (all required)
- Accurate: reflects reality; documented commands actually exist/work (spot-checked).
- Concise and high-signal; references authoritative sources instead of duplicating.
- Placed in the correct file (see `repo-memory-and-context.mdc`); no near-duplicate section created.
- Memory entries dated + evidence-backed; pre-existing vs introduced distinguished.
- No secrets/PII/huge logs; no unconfirmed one-off failures recorded as permanent truths.

## Scoring (0–5)
- 5: accurate, concise, correctly placed. 3: useful but verbose/slightly misplaced. 1: vague or duplicative. 0: any automatic failure.

## Evidence required
- What changed + why; spot-run command confirmation if commands were touched; clean secret scan.

## Automatic failure conditions
- Secrets/PII committed; invented features/commands; huge logs pasted.
- Turning a temporary failure into a permanent "truth" without confirmation.

## Examples of unacceptable claims
- "Updated docs" (nothing verified; commands don't exist).
- Pasting a full test log into memory.

## Must be reported
- Files updated, what durable facts/lessons recorded and where, remaining doc debt.
