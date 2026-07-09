---
name: Security review
about: Request or record a security review (auth, RLS, secrets, endpoints, data)
title: "[security] "
labels: security
---

## Scope
<!-- Endpoints/files/subsystem to review (e.g. functions/api/..., auth, RLS). -->

## Concern / trigger
<!-- What prompted this (new endpoint, auth change, data exposure worry, audit). -->

## Checks requested
- [ ] Secret scan of the diff
- [ ] Server-side authz (ownership, RBAC) on protected surfaces
- [ ] Zod input validation / safe error responses
- [ ] Edge safety (`context.env`, `safePrismaDisconnect`)
- [ ] RLS unchanged/strengthened

## Constraints
<!-- Report + additive hardening only. Never weaken auth/RLS/validation. Auth/RLS/secret changes need human approval. -->

## Notes
<!-- Workflow: .cursor/workflows/security-review.workflow.md; rubric: .cursor/evals/security-review-rubric.md -->
