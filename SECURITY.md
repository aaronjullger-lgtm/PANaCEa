# Security Policy

PANaCEa handles learner study data (progress, review history, analytics) for
PA students. This policy documents how security is maintained and how to
report vulnerabilities.

## Supported Versions

Only the current production deployment (Cloudflare Pages, `main` branch) is
supported. Older local/legacy Express routes (`routes/`) are development-only
and never deployed.

## Reporting a Vulnerability

Please **do not open a public issue** for security problems.

- Use GitHub's private vulnerability reporting: repository →
  **Security → Report a vulnerability** (preferred).
- Provide: affected endpoint/component, reproduction steps, impact, and any
  suggested fix. No proof-of-concept payloads in the first message.

You should receive an acknowledgment within 3 business days. Public
disclosure is coordinated before any fix ships.

## Security Posture

| Area | Mechanism |
| ---- | --------- |
| Authentication | Clerk (JWT session tokens, verified server-side via `authenticatedEndpoint` in `functions/api/_shared/auth.ts`) |
| Authorization | Role-based checks (`UserRole` enum: Student/Faculty/Admin) on admin/analytics endpoints; Supabase RLS on learner tables |
| Secrets | Never committed; read from 1Password (`Code` vault) by maintainers; required env vars documented in `CLAUDE.md` |
| Dependency hygiene | Dependabot (weekly, grouped) for npm + GitHub Actions; CodeQL analysis weekly |
| Secret scanning | gitleaks in `pre-commit` (repo-local copy scans staged files); never `git add .` |
| Edge runtime | No `process.env` in Cloudflare Functions — `context.env.*` only; Prisma clients always `safePrismaDisconnect` in `finally` |
| Rate limiting | Distributed `RATE_LIMIT_KV` namespace on shared API surfaces (e.g. Gemini proxy) |
| Frontend | Prisma is server-only (Vite stub); no API keys in client bundles beyond `VITE_*` publishable values |

## Reporting Discipline

- Never log secrets, tokens, or full user PII in console/Sentry messages.
- Structured error responses are `{ error: string }` — no stack traces to clients.
- Medical content: no diagnosis claims outside validated, sourced content;
  AI tutor/OSCE output is educational, not clinical advice.

## Contact

- Security issues: private security advisory (above).
- Maintainer: Aaron (project owner) — reachable via GitHub.

Last reviewed: 2026-07-31
