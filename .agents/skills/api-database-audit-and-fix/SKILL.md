---
name: api-database-audit-and-fix
description: Use to audit and fix API endpoints, server actions, Supabase or database connections, environment configuration, authorization rules, and RLS policies. Trigger when the user reports API errors, database errors, connection failures, authorization problems, or inconsistent data.
---

1. Inspect the API architecture. List route handlers, server actions, edge functions, backend clients, API utilities, database clients, migrations, schemas, and generated types.
2. Audit environment variable names and usage without printing values. Confirm server-only secrets stay server-side and public variables are intentionally exposed.
3. Verify client/server boundaries for the framework in use. Ensure database service keys, admin clients, private API keys, and privileged logic are not bundled into client code.
4. Examine schema, migrations, indexes, constraints, read/write patterns, role usage, and row-level security policies. Confirm authorization rules match product behavior.
5. Reproduce the reported failure against local or staging data using safe credentials. Never run destructive operations on production unless the user explicitly approves and a rollback plan exists.
6. Implement the minimal fix: correct environment variable references, adjust client initialization, repair RLS policies, add missing fields, improve error handling, add validation, or enforce authorization.
7. Add regression coverage for API behavior, database rules, validation, and authorization. Include denial tests for cross-user access when user data exists.
8. Update configuration and migration documentation. Record required environment variables, migration order, local setup commands, and any backfill procedure.
9. Run targeted API/database tests, migration checks when available, lint, typecheck, and build. If external services are required, document what could not be verified locally.
10. Acceptance criteria: no secrets are exposed, API/database failures are resolved or isolated, authorization is explicit, data integrity is protected, and verification is reproducible.
11. Finish with endpoints or tables reviewed, fixes made, commands run, residual risks, and any production rollout or migration cautions.
