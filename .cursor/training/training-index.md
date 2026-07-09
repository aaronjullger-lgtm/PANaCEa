# Agent Training Index

Repo-local onboarding/playbook files loaded as context (not model fine-tuning). Read the primer(s) relevant to your task before editing. They summarize what an agent needs to do the right thing here, and link to the authoritative rules/skills/workflows.

## Primers
- `panacea-stack-primer.md` — the stack, layout, commands (start here).
- `fsrs-domain-primer.md` — spaced-repetition core (safety-critical).
- `cloudflare-functions-primer.md` — Edge API rules.
- `supabase-prisma-safety-primer.md` — DB/schema/RLS safety.
- `clerk-auth-primer.md` — auth model.
- `ui-design-quality-primer.md` — design system + no-slop.
- `testing-primer.md` — how to verify.
- `security-primer.md` — secrets/authz/validation.
- `common-agent-mistakes.md` — the top ways agents go wrong here.

## Worked examples (imitate the "good", avoid the "bad")
- `example-good-final-report.md` / `example-bad-final-report.md`
- `example-good-ui-review.md` / `example-bad-ui-review.md`
- `example-good-security-review.md` / `example-bad-security-review.md`

## How this connects
- Rules (`.cursor/rules/`) = always/scoped guidance · Skills (`.cursor/skills/`) = procedures · Workflows (`.cursor/workflows/`) = ordered recipes · Agents (`.cursor/agents/`) = roles · Memory (`.cursor/memory/`) = durable facts/lessons · Evals (`.cursor/evals/`) = rubrics. Map: `docs/agent-workflow-orchestration.md`.
