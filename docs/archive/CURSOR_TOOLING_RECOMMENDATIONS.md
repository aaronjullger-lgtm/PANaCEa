# Cursor Tooling Recommendations — MCP Servers, Extensions, AI Tools

**Purpose:** Analysis and implementation of 5 MCP servers, 5 extensions, 5 AI tools, and additional suggestions to increase efficiency and support more complex work in PANaCEa.

---

## 1. Five MCP Servers (Recommended & Configured)

| # | Server | Role | Why for PANaCEa |
|---|--------|------|------------------|
| 1 | **Cloudflare** | Cloudflare docs and reference | Deploy target is Cloudflare Pages; agents can look up Workers/Pages APIs and config without leaving the IDE. |
| 2 | **Prisma** | Manage Prisma Postgres (migrations, schema, instances) | DB is Prisma + Supabase; agents can run migrations, inspect schema, and get up-to-date Prisma guidance. |
| 3 | **Supabase** | Create and manage Supabase projects | Postgres and auth live on Supabase; manage projects and get Supabase-specific context. |
| 4 | **Playwright** | E2E browser testing | Repo already uses Playwright; MCP gives agents direct control to run and debug E2E tests from context. |
| 5 | **GitHub** | Repo management, issues, PRs | Code lives on GitHub; create issues, draft PR descriptions, and query repo state from the agent. |

**Configuration:** Project-level config is in `.cursor/mcp.json`. Merge that into your global `~/.cursor/mcp.json` if you prefer one place, or rely on project-level when opening this repo.

**Optional env/tokens:** GitHub MCP needs `GITHUB_PERSONAL_ACCESS_TOKEN` in the server `env` (create at GitHub → Settings → Developer settings → Personal access tokens). Supabase/Prisma may need tokens if you use write or project-specific features.

---

## 2. Five Extensions (Recommended & in `recommendations`)

| # | Extension ID | Purpose |
|---|----------------|--------|
| 1 | `dbaeumer.vscode-eslint` | ESLint in the editor; enforce project lint rules. |
| 2 | `esbenp.prettier-vscode` | Format on save; align with project Prettier config. |
| 3 | `bradlc.vscode-tailwindcss` | Tailwind IntelliSense, class ordering, preview. |
| 4 | `Prisma.prisma` | Schema highlighting, format, Go to definition for `schema.prisma`. |
| 5 | `ms-playwright.playwright` | Run and debug Playwright tests from the sidebar. |

**Five additional recommendations** (already added to `.vscode/extensions.json`):

| # | Extension ID | Purpose |
|---|----------------|--------|
| 6 | `ZixuanChen.vitest-explorer` | Run Vitest tests from the sidebar. |
| 7 | `usernamehw.errorlens` | Inline errors and warnings. |
| 8 | `eamodio.gitlens` | Git blame, history, and compare. |
| 9 | `mikestead.dotenv` | Syntax highlight and optional validation for `.env`. |
| 10 | `bradlc.vscode-tailwindcss` | (duplicate in table for clarity; already in list) — Wrangler/Cloudflare: use official Cloudflare extension if you want dashboard/deploy from IDE. |

Install: open the repo in Cursor/VS Code and accept the workspace extension recommendations, or run `code --install-extension <id>` for each.

---

## 3. Five AI Tools to Incorporate

These are Cursor-side “AI tools” (rules, behaviors, and one doc) that make the agent more effective without adding new MCP servers.

| # | AI Tool | What it is | Where implemented |
|---|---------|------------|--------------------|
| 1 | **MCP-first for docs and infra** | Prefer Cloudflare / Prisma / Supabase / Playwright MCPs for docs, schema, and deploy/test instead of generic web search. | `.cursor/rules/mcp-and-tooling.mdc` |
| 2 | **Test-and-fix loop** | When changing code that has tests, run the relevant tests (Vitest or Playwright) and fix failures before concluding. | `.cursor/rules/mcp-and-tooling.mdc` |
| 3 | **Structured code review** | When reviewing a branch, use GitKraken `code_review_branch` for naming; optionally use GitHub MCP to create or update PR/issue. | `.cursor/rules/mcp-and-tooling.mdc` |
| 4 | **Browser check for UI changes** | After editing routes or UI, use cursor-ide-browser MCP to open the app and confirm key flows (or state that Playwright E2E should be run). | `.cursor/rules/mcp-and-tooling.mdc` |
| 5 | **Single “health check” workflow** | One place that lists: build, lint, unit tests, E2E (or browser MCP), and deploy checklist. Agent can run steps and report. | `docs/AGENT_HEALTH_CHECK_WORKFLOW.md` |

---

## 4. Anything Else Suggested

- **Semantic search / @codebase:** Use Cursor’s semantic search and @codebase so the agent has full repo context for refactors and cross-file changes.
- **Cost guardrail:** Keep the existing rule: do not run bulk/high-volume Gemini (or other paid LLM) calls without explicit permission (see `.cursor/rules/autonomous-behavior.mdc`).
- **Extension: Cloudflare Wrangler:** If you use Wrangler often, add the official Cloudflare extension for logs and deploy from the IDE.
- **Optional MCPs later:** Context7 (up-to-date code docs), firecrawl (web crawl/scrape for docs), Perplexity (research). Add when you need deeper doc or research context.
- **CI alignment:** Ensure `npm run build`, `vitest`, and Playwright commands in `.github/workflows/ci.yml` match what the agent runs locally so “run the same as CI” is a single mental model.

---

## 5. Summary of What Was Implemented

| Item | Location | Action |
|------|----------|--------|
| 5 MCP servers | `.cursor/mcp.json` | Project-level config added (Cloudflare, Prisma, Supabase, Playwright, GitHub). |
| 5+ extensions | `.vscode/extensions.json` | Recommendations list extended (ESLint, Prettier, Tailwind, Prisma, Playwright, Vitest, Error Lens, GitLens, DotENV). |
| 5 AI tools | `.cursor/rules/mcp-and-tooling.mdc` + `docs/AGENT_HEALTH_CHECK_WORKFLOW.md` | New rule file + health-check workflow doc. |

After pulling: install recommended extensions when prompted, set `GITHUB_PERSONAL_ACCESS_TOKEN` for GitHub MCP if you use it, and restart Cursor so `.cursor/mcp.json` is picked up.
