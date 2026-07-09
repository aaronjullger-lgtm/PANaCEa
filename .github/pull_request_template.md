<!--
PANaCEa PR template. Keep it honest and evidence-backed (see docs/agent-safety-checklist.md).
Delete sections that don't apply.
-->

## Summary

<!-- What & why, in 1–3 sentences. -->

## Scope

<!-- What changed / intentionally out of scope. `git diff --stat` should match this. -->

## Screenshots (UI changes)

<!-- REQUIRED for UI: light + dark (and key breakpoints). No screenshots = visual QA not done. -->

## Commands run

<!-- Paste real results. Mark pre-existing vs introduced failures.
Baseline: npm run typecheck has 2 pre-existing errors (renderStructuredRationale.ts); npm run lint has 3 no-empty errors. -->
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test` (or `npm run test:critical`)
- [ ] `npm run build`

## Impact checklist

- **Security / auth / RLS:** <!-- none / describe; auth/RLS changes need human approval -->
- **Database:** <!-- none / schema/migration (migrations need approval, must be additive/reversible) -->
- **Performance / bundle:** <!-- none / notable -->
- **Accessibility:** <!-- none / checked (keyboard, contrast, light+dark) -->

## Known risks & follow-ups

<!-- Residual risks, anything unverified, follow-up issues. -->

## Agent workflow used

<!-- e.g. feature-build / bug-fix / security-review (see .cursor/workflows/); N/A if human-authored -->

<!-- Reminder: no secrets; no production data/deploys; no weakening tests/auth/RLS; no unverified success claims. -->
