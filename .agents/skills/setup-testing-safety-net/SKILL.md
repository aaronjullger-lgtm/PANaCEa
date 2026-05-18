---
name: setup-testing-safety-net
description: Use to build or improve a functionality safety net by auditing tests, identifying critical user flows, and setting up unit, integration, and E2E tests. Trigger when the user asks to add tests, protect core flows, prevent regressions, or improve verification.
---

1. Inspect the existing test setup before installing or editing anything. Read `package.json`, lockfiles, test config, CI workflows, existing `test` or `tests` directories, and framework-specific testing files.
2. Identify critical user flows for this product. Include signup/login, protected route access, dashboard usage, practice questions, spaced repetition and review queues, AI tutor or agent interactions, API endpoints, database migrations, and clinical image workflows when present.
3. Choose testing tools that match the existing stack. Prefer the repo's current tools; if none exist, propose the smallest practical setup such as Vitest with React Testing Library for unit/integration tests and Playwright for browser E2E tests.
4. Scaffold focused tests for the highest-risk flows first. Cover successful paths, authorization failures, validation errors, empty states, loading states, and regression cases tied to recent bugs.
5. Add deterministic test data helpers when needed. Use `scripts/seed-test-data.sh` as a starting stub for safe local or CI seed data and `scripts/use-test-database.sh` as a stub for test database environment checks.
6. Implement or update CI so install, lint, typecheck, tests, and build run in a predictable order. Use the detected package manager and existing scripts; document missing scripts instead of inventing command names silently.
7. Avoid real secrets and production data. Use mock credentials, isolated test databases, local fixtures, and explicit test environment variables. Do not weaken authentication or authorization to make tests pass.
8. Add regression tests for any bug fixed during the workflow. Keep tests close to the behavior being protected and avoid brittle implementation-detail assertions.
9. Run the relevant verification commands: package-manager install if dependencies changed, lint, typecheck, unit/integration tests, E2E tests when configured, and build.
10. Acceptance criteria: critical flows have executable tests, CI runs the safety net, test data is deterministic, failures are actionable, and remaining coverage gaps are documented.
11. Finish with a summary of tests added, helpers added, commands run, failures fixed, known gaps, and recommended next tests.
