# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities **privately** — do not open a
public issue for security problems.

- Preferred: use GitHub's **private vulnerability reporting** for this repository
  (Security tab → "Report a vulnerability"). This keeps the report confidential
  until a fix is available.
- Include: affected area/endpoint, reproduction steps, impact, and any suggested
  remediation.

Please do **not** include real secrets, credentials, tokens, or production data in
a report. If a credential was exposed, state which one and where — not its value.

## Scope

PANaCEa is an edge-deployed medical-education platform (Cloudflare Pages
Functions, Prisma/Supabase, Clerk auth). Reports of concern include:

- Authentication / authorization bypass (Clerk, RBAC).
- Row-Level-Security (RLS) gaps exposing another user's data.
- Injection (though all DB access is via Prisma; no raw SQL).
- Input-validation gaps on `functions/api/**` mutation endpoints. Hardened endpoint contracts are documented in `docs/api/API_OVERVIEW.md`; schema tests live in `functions/api/__tests__/validation-hardening.test.ts`.
- Secret exposure in source, logs, or client bundles.
- XSS / content-injection in rendered clinical content.

## Handling

- Acknowledged reports are triaged by severity (CVSS-style: critical/high/medium/low).
- Fixes for critical/high issues are prioritized; a coordinated disclosure timeline
  is agreed with the reporter where practical.
- Dependency advisories are surfaced by the CI `npm audit` step and tracked in
  `docs/dependency-vulnerability-triage.md`.
- API mutation validation contracts: `docs/api/API_OVERVIEW.md`.

## Supported

The `main` branch (production deploy target) is the supported surface. Older
branches and preview/experimental features are best-effort.
