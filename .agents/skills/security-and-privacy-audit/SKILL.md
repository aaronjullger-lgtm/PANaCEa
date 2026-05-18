---
name: security-and-privacy-audit
description: Use to identify and fix high-risk security and privacy issues related to authentication, authorization, secrets, API routes, database access, payments, and logging. Trigger when the user requests a security audit, privacy review, auth review, or sensitive-data hardening.
---

1. Define the audit scope and threat model. Identify protected data, user roles, admin surfaces, payment flows, external services, logs, and deployment environments.
2. Audit secrets and environment variables without printing values. Ensure secrets are server-only, not committed, not logged, not exposed to client bundles, and rotated if exposure is suspected.
3. Review authentication and session handling. Verify token storage, session expiration, CSRF posture when relevant, password or OAuth flows, MFA/admin requirements, and logout behavior.
4. Check object-level and function-level authorization. Confirm users can access only their own data and admin-only actions are enforced server-side.
5. Validate API inputs and outputs. Add schema validation, rate limiting where appropriate, safe error messages, and consistent handling for malformed or unauthorized requests.
6. Review database access and RLS policies. Confirm policies match business rules, deny by default where possible, and include tests for cross-user access denial.
7. If payments exist, verify webhook signature validation, idempotency, replay protection, event ordering, and least-privilege payment metadata storage.
8. Review logging, analytics, AI traces, crash reports, and monitoring for sensitive data leakage. Redact tokens, health data, student data, payment data, and other regulated or private content.
9. Implement focused fixes only. Do not weaken auth, disable RLS, remove validation, expose debug endpoints, or make broad rewrites during an audit unless required and approved.
10. Run security-relevant tests, authorization tests, lint, typecheck, dependency audit if configured, and build. Document anything that requires staging or production validation.
11. Acceptance criteria: high-risk issues are fixed or explicitly recorded, secrets remain hidden, authorization is server-enforced, sensitive logs are redacted, and tests cover critical denial paths.
12. Finish with findings ordered by severity, files changed, tests added, commands run, residual risks, and recommended follow-up work.
