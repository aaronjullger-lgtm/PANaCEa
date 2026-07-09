---
name: mcp-safety-review
description: Review an MCP server before enabling it (trust, scope, secrets, cloud-safety, prompt-injection risk). Use when someone proposes adding or enabling an MCP server.
---

# MCP safety review

Vet an MCP server before it gets write access to anything. See `mcp-and-tool-safety.mdc` and `docs/cursor-mcp-cloud-setup.md`.

## When to use

- A new MCP server is proposed, or you're wiring one for local/cloud use.

## Instructions

1. Trust: prefer official/first-party servers (GitHub, Supabase, Microsoft Playwright). For community servers, check publisher, stars, maintenance, and license. Do **not** run installer scripts.
2. Scope: enable the fewest tools needed. Databases → **read-only + non-production** (Supabase `--read-only`, dev project-ref).
3. Secrets: least-privilege, read-only tokens; stored as Cursor dashboard secrets or gitignored `.cursor/mcp.json` — never committed.
4. Cloud-safety: decide local-only (e.g., browser MCP) vs. cloud-safe (read-only GitHub/Supabase/docs).
5. Prompt-injection: if the server reads untrusted content (web/issues/DB rows), keep it read-only and don't chain its output into write actions without review.
6. Record the decision in `docs/cursor-mcp-cloud-setup.md` (enable now / later / avoid).

## Stop conditions

- Stop and reject if the server needs write access to production or unclear scopes.

## Verification

- `.cursor/mcp.example.json` stays secret-free and valid; `.cursor/mcp.json` remains gitignored.
- Documented: what it's for, cloud-safety, secrets, risks, default setting.

## Do not claim success unless

- The server is documented with least-privilege scope and no secrets in the repo.

## Recovery

- Uncertain trust → mark "avoid" or "later"; do not enable by default.
