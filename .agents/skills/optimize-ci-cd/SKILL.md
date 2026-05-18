---
name: optimize-ci-cd
description: Use to audit, fix, and optimize CI/CD workflows including lint, typecheck, tests, build jobs, caching, environment variables, secret management, and deployment steps. Trigger when the user mentions GitHub Actions, CI failures, slow pipelines, deployment failures, or release automation.
---

1. Inspect workflow files such as `.github/workflows`, package manager scripts, lockfiles, deployment configs, Dockerfiles, platform config, and any existing release scripts.
2. Map each pipeline job to a purpose: install, lint, typecheck, unit tests, integration tests, E2E tests, build, migrations, preview deploy, production deploy, rollback, and notifications.
3. Identify missing, duplicated, flaky, or slow jobs. Confirm jobs use the correct package manager and lockfile mode such as `npm ci`, `pnpm install --frozen-lockfile`, or the repo's existing equivalent.
4. Optimize caching carefully. Cache package manager stores and Playwright browsers when appropriate; do not cache secrets, build outputs that can become stale, or generated files that mask broken builds.
5. Check environment variable and secret usage. Scope secrets to only the jobs that need them, avoid printing secret values, and prefer platform-provided secret stores.
6. Add explicit failure messages and actionable logs. Avoid silent failures, swallowed exit codes, and best-effort deployment commands in required checks.
7. Integrate lint, typecheck, tests, build, and deployment in the correct order. Ensure migrations run only in safe environments and preview deployments cannot mutate production data unexpectedly.
8. Use `scripts/check-workflows.sh` as a starting stub for validating required workflow files and expected package scripts.
9. Run local verification for any changed scripts and use workflow linting if configured. If CI cannot be executed locally, explain exactly what must be confirmed in the remote pipeline.
10. Acceptance criteria: CI uses the repo's package manager, required checks are explicit, cache keys are safe, secrets are scoped, deployment steps are gated, and failures are diagnosable.
11. Finish with pipeline changes, expected speed or reliability improvements, commands run, remaining risks, and follow-up optimizations.
