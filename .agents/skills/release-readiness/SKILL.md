---
name: release-readiness
description: Use to verify that an application is safe, functional, performant, accessible, documented, and ready before a release or production deployment. Trigger when the user mentions release, launch, production deploy, ship checklist, or release notes.
---

1. Review the release scope, diff, branch status, linked issues, migrations, feature flags, deployment target, and rollback path. Identify high-risk files such as auth, payments, database migrations, API routes, and scheduler logic.
2. Run the repo's full verification sequence using the detected package manager: install if needed, lint, typecheck, tests, E2E tests when configured, and build. Record missing scripts as release-readiness gaps.
3. Validate core functionality manually or through E2E tests. Include signup, login, protected navigation, dashboard, practice questions, review queues, spaced repetition, AI tutor interactions, and payment flows when present.
4. Check for secrets exposure, sensitive data leaks, unsafe logs, public client bundles containing private keys, and accidental production credentials in local files.
5. Verify accessibility basics: keyboard navigation, visible focus states, ARIA labels for interactive controls, text contrast, semantic headings, form labels, and reduced-motion behavior.
6. Review performance and mobile behavior. Confirm large media, 3D components, and AI features are lazy-loaded or degraded gracefully and do not block primary workflows.
7. Confirm migrations, backfills, environment variables, feature flags, and deployment steps are documented. Ensure irreversible operations have backups or rollback plans.
8. Draft release notes with user-visible changes, fixes, known issues, rollout plan, monitoring plan, and rollback procedure.
9. Do not proceed with production deployment if critical verification fails, secrets are exposed, destructive migrations are unreviewed, or rollback is undefined unless the user explicitly accepts the risk.
10. Acceptance criteria: required checks pass or blockers are clearly documented, core flows are verified, release notes exist, rollback is clear, and monitoring is planned.
11. Finish with release status, blockers, commands run, files changed, known issues, release notes summary, and rollout or rollback instructions.
