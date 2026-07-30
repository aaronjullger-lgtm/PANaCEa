---
description: Systematic root-cause debugging — form hypotheses, investigate, confirm, fix. Use when something is broken and you don't know why.
agent: orchestrator
---

Debug the following issue systematically:

$ARGUMENTS

## Phase 1: Reproduce
- What is the expected behavior?
- What is the actual behavior?
- Can you reproduce it locally? If yes, write the exact steps.
- If it's a test failure, run the specific test and capture the full error output.

## Phase 2: Form Hypotheses (at least 3)
List at least 3 possible root causes, ranked by likelihood:
1. Most likely: ...
2. Possible: ...
3. Less likely: ...

## Phase 3: Investigate
For each hypothesis:
- What evidence would confirm or rule it out?
- Read the relevant code (use codegraph_explore for the symbols involved)
- Check recent git changes: `git log --oneline -10 -- <file>`
- Check if env vars, config, or external dependencies changed

## Phase 4: Confirm
- State which hypothesis was confirmed and why
- Show the exact line(s) of code that cause the bug

## Phase 5: Fix (minimal)
- Change the LEAST code possible
- Write or update a test that would have caught this bug
- Run the test to confirm it fails BEFORE the fix, then passes AFTER

## Phase 6: Verify
- Run the full test file for the changed code
- Run `npm run lint` on changed files
- Check for side effects — does this change affect anything else?

## Rules
- NEVER guess and patch. Always confirm the root cause first.
- If you can't reproduce it, say so — don't pretend to fix something you can't see.
- If the bug is in a third-party library, check if it's a known issue or version mismatch.
- If the fix requires a schema migration — STOP and ask Aaron.
