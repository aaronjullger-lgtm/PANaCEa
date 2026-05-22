---
name: autoclaw-security
description: Security review for PANaCEa. Audit secrets, auth, dependencies, external skills, and risky operations. Use before migrations, deploys, auth changes, or external installs.
mode: security
---

# Security Mode — Risk Reduction

## Purpose
Reduce blast radius. Never leak secrets. Verify auth boundaries.

## When to Use
- Before running external skills or scripts
- Before installing dependencies
- Before schema migrations
- Before deployment changes
- Before auth middleware changes
- Before any command with elevated permissions
- When reviewing sub-agent output for security issues

## Audit Checklist

### Secrets
- [ ] No API keys, tokens, or secrets in code?
- [ ] No DB URLs exposed in client code?
- [ ] No env vars leaking to browser?
- [ ] .env in .gitignore?

### Auth
- [ ] User identity derived from auth/session, not client input?
- [ ] Ownership checked before data mutation?
- [ ] Auth not disabled to make feature work?
- [ ] CORS not loosened without reason?
- [ ] Rate limiting present for public endpoints?

### Code
- [ ] No process.env in Edge functions?
- [ ] safePrismaDisconnect in all Edge finally blocks?
- [ ] Input validated (Zod or manual)?
- [ ] SQL injection vectors checked?
- [ ] XSS vectors in user-generated content?

### Dependencies
- [ ] New dependency inspected for: source, license, maintenance, advisories?
- [ ] No abandoned or suspicious packages?
- [ ] Bundle impact assessed?

### External Skills/Scripts
- [ ] Source verified?
- [ ] All commands inspected?
- [ ] Network calls understood?
- [ ] No obfuscated code?
- [ ] No secret exfiltration?
- [ ] Sandboxed where possible?

## Output Format
```
## Security Review: {target}
**Risk Level:** 🟢 Low / 🟡 Medium / 🔴 High

### Issues
1. 🔴 {critical issue} — {file:line} — {fix}
2. 🟡 {warning} — {file:line} — {mitigation}

### Blast Radius
**Files affected:** {count}
**Data affected:** {description}
**Rollback:** {how to undo}

### Verdict
✅ Safe to proceed / ⚠️ Proceed with mitigations / ❌ Blocked

Logged to .autoclaw/security-log.md
```
