# .autoclaw/security-log.md

## Security Posture
- Auth: Clerk RBAC (UserRole: Student, Faculty, Admin)
- Edge: Clerk token verification via backend SDK
- Secrets: in .env (never committed), accessed via context.env.* in Edge
- FS: OpenClaw restricted to workspace-only after optimization
- Skills: 75 archived, 27 vetted active, external policy in skill-registry.md

## Risks to Monitor
- Pending migrations: must be reviewed before applying (DDL changes)
- New dependencies: require inspection checklist before install
- External skills: must pass full security review before install
- Auth middleware: never modify without approval

## Inspection Checklist (for any new dependency/skill)
1. Source verification
2. License check
3. Maintenance status
4. Security advisories
5. Network calls
6. File permissions
7. Shell commands
8. No obfuscated code
9. No secret exfiltration
10. Record review in this file

## Secrets (never commit, never expose)
- CLERK_SECRET_KEY
- DATABASE_URL / DIRECT_DATABASE_URL
- GEMINI_API_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SENTRY_AUTH_TOKEN
- Any JWT/session tokens
