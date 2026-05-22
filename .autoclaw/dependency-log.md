# .autoclaw/dependency-log.md

## Core Dependencies
_From package.json — to be verified during discovery pass_

| Package | Purpose | Risk |
|---------|---------|------|
| react 19.2 | UI framework | Low (official) |
| @clerk/clerk-react + @clerk/backend | Auth | Low (official) |
| @prisma/client 7.6 | Database ORM | Low (official) |
| @tanstack/react-query 5.90 | Server state | Low (popular) |
| zustand 5.0 | Client state | Low (popular) |
| framer-motion | Animations | Low (popular) |
| tailwindcss 3.4 | Styling | Low (official) |
| vitest 4.1 | Testing | Low (popular) |
| @playwright/test | E2E testing | Low (official) |
| hono | HTTP framework (Edge) | Low (official) |
| zod | Schema validation | Low (popular) |

## Pending Additions (needs approval)
- `web-push` — notification cron (Sprint 18)

## Dependency Rules
1. Check if equivalent exists in repo before adding
2. Verify package reputation and maintenance
3. Check bundle impact
4. Check security advisories
5. Pin versions per repo conventions
6. Log here with justification
