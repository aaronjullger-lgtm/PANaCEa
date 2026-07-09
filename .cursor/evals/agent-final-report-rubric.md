# Rubric: Agent Final Report

Grades whether a run's final report is trustworthy and complete. Used by the Orchestrator/Reviewer and the `final-reporting` skill.

## Pass criteria (all required)
- Lists files changed (`git diff --stat`).
- Lists every command run with pass/fail and **real output** (not paraphrased).
- Distinguishes **pre-existing** vs **introduced** failures.
- Includes evidence appropriate to the change (screenshots for UI; logs/output otherwise).
- States residual risks and anything unverified.
- Lists human-approval items and where durable memory was updated.

## Scoring (0–5)
- 5: all pass criteria + clear, concise, reproducible.
- 3: minor omissions (e.g., missing risk list) but evidence present.
- 1: evidence thin or partial claims unbacked.
- 0: any automatic-failure condition.

## Evidence required
- Command outputs; screenshots for UI; `git diff --stat`.

## Automatic failure conditions
- Claimed success without commands run.
- Claimed visual QA without browser/screenshot evidence.
- Hidden/omitted unresolved failure.
- Auth/RLS weakened; secrets printed/committed; tests removed to pass.
- Package added without justification; production data touched; hallucinated file/import referenced.

## Examples of unacceptable claims
- "Everything works ✅" (no commands).
- "UI looks great" (no screenshots).
- "typecheck passes" while the 2 pre-existing errors are hidden.

## Must be reported
- Summary, files, commands+results, evidence, deviations, risks, approvals, memory updates.
