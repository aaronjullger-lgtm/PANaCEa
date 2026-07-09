---
name: agent-training-refresh
description: Keep the .cursor/training primers and examples accurate and useful. Use when the stack/conventions change or a primer is stale/misleading.
---

# Agent training refresh

Maintain the onboarding playbooks in `.cursor/training/`.

## When to use
- Stack/command/convention changes; a primer contradicts reality; a recurring mistake suggests a missing primer note.

## Instructions
1. Read the affected primer(s) and the authoritative source (rules/`AGENTS.md`/`.cursor/memory/project-facts.md`).
2. Fix drift; keep primers concise and operational; link to rules/skills/workflows instead of duplicating.
3. Update `common-agent-mistakes.md` when a new recurring mistake is confirmed (cross-ref `known-failure-modes.md`).
4. Keep good/bad examples realistic and short; don't add secrets or real data.

## Stop conditions
- Stop when primers match reality and aren't duplicative.

## Verification evidence
- What changed + confirmation the referenced commands/paths exist.

## Do not claim success unless
- The primer's commands/facts are verified against the repo.

## Recovery
- Conflicting guidance → reconcile with the authoritative rule and note it in `agent-lessons-learned.md`.
