# Machine Transfer Runbook

> Step-by-step setup for moving PANaCEa + sibling projects to a new machine.
> Companion to [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md) (covers daily dev once setup is done).

## What transfers automatically

| Thing | How it transfers |
|---|---|
| Source code | GitHub clone |
| Branches (incl. `feat/langfuse-tracing`, `feat/langchain-skills`) | `git fetch --all` after clone |
| Skills (`.agents/skills/`, `.claude/skills/`) | Tracked in git — comes with clone |
| Docs (this file, `LOCAL_DEVELOPMENT.md`, `docs/`) | Tracked in git — comes with clone |
| Secrets (Clerk, Supabase, Gemini, Langfuse, LangSmith, etc.) | 1Password PANaCEa Environment (cloud-stored — no transfer action needed) |

## What does NOT transfer

| Thing | Why | What to do |
|---|---|---|
| `node_modules/` | Per-machine, ~1GB | `npm install` after clone |
| `.venv/` (langchain-agent) | Per-machine, ~80MB | `uv sync` after clone |
| `.opencode/`, `.omo/`, `.audit/` | Runtime state — regenerates | Nothing — fresh start |
| `.claude/handoff.md` | Auto-generated handoff | Replaced by `docs/handoff-2026-07-28.md` (tracked) |
| 1Password `.env` pipe mounts | Per-machine absolute paths | Re-register via 1Password (see below) |
| Cloudflare Wrangler auth | Per-machine `wrangler login` token | Re-run `wrangler login` |
| GitHub CLI auth | Per-machine keychain | Re-run `gh auth login` |

---

## Prerequisites (install before starting)

```bash
# Apple Silicon macOS assumed. Adjust for other OSes.

# 1. Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Node 22 (the repo pins this version via .nvmrc)
brew install nvm
echo 'source $(brew --prefix nvm)/nvm.sh' >> ~/.zshrc
source ~/.zshrc
nvm install 22
nvm use 22

# 3. uv (Python package manager — used by langchain-agent sibling)
brew install uv

# 4. 1Password CLI (for .env inject pipes)
brew install --cask 1password-cli
# Also install 1Password desktop app from https://1password.com/downloads/
# Sign in to the desktop app with the same account that owns the PANaCEa Environment.
op signin  # follow prompts

# 5. GitHub CLI
brew install gh
gh auth login  # choose GitHub.com → HTTPS → login with browser

# 6. Cloudflare Wrangler (for `npm run deploy:local`)
npm install -g wrangler
wrangler login

# 7. (Optional) Playwright browsers — only if you'll run E2E tests
npx playwright install
```

---

## Clone the repos

```bash
mkdir -p ~/GitHub
cd ~/GitHub

# Main app
git clone https://github.com/aaronjullger-lgtm/PANaCEa.git StudyPANaCEa
cd StudyPANaCEa

# Pull all branches (the two feature branches aren't on `main` yet)
git fetch origin
git branch feat/langfuse-tracing origin/feat/langfuse-tracing
git branch feat/langchain-skills origin/feat/langchain-skills
# Optional: check out either branch to see the new work
# git checkout feat/langchain-skills

# Sibling Python agent scaffold
cd ~/GitHub
git clone https://github.com/aaronjullger-lgtm/langchain-agent.git
```

---

## Install deps

```bash
# StudyPANaCEa (Node)
cd ~/GitHub/StudyPANaCEa
npm install  # postinstall runs `prisma generate` automatically

# langchain-agent (Python via uv)
cd ~/GitHub/langchain-agent
uv sync
```

---

## Register the 1Password `.env` inject pipes

> The `.env` files are **managed by 1Password**, not generated. They appear as named pipes that read fresh values from the PANaCEa Environment on every access. You must register them on each machine.

The PANaCEa Environment ID is `yyhys7vw4jpovijz7oxjiwuxqe` (account `LSYKNVM7BJAENHJE2DYZHVY23Q`).

### Option A: via 1Password Desktop App (UI)

1. Open 1Password desktop app
2. Go to **Developer Tools → Environments → PANaCEa**
3. Under **Local .env files**, add two mounts:
   - Mount path: `/Users/<you>/GitHub/StudyPANaCEa/.env.1password`
   - Mount path: `/Users/<you>/GitHub/langchain-agent/.env`
4. Toggle both **Enabled**

### Option B: via 1Password MCP server (from an agent)

If your agent runtime has the 1Password MCP server connected, run:

```
1password_create_local_env_file(
  accountId="LSYKNVM7BJAENHJE2DYZHVY23Q",
  environmentId="yyhys7vw4jpovijz7oxjiwuxqe",
  environmentName="PANaCEa",
  mountPath="/Users/<you>/GitHub/StudyPANaCEa/.env.1password"
)

1password_create_local_env_file(
  accountId="LSYKNVM7BJAENHJE2DYZHVY23Q",
  environmentId="yyhys7vw4jpovijz7oxjiwuxqe",
  environmentName="PANaCEa",
  mountPath="/Users/<you>/GitHub/langchain-agent/.env"
)
```

### Verify mounts work

```bash
# Should print key names with their character counts (values stay masked)
grep -E "^(GEMINI_API_KEY|LANGFUSE_PUBLIC_KEY|LANGSMITH_API_KEY)=" ~/GitHub/StudyPANaCEa/.env.1password | awk -F= '{printf "%s=(%d chars)\n", $1, length($2)}'
grep -E "^(GEMINI_API_KEY|LANGSMITH_API_KEY)=" ~/GitHub/langchain-agent/.env | awk -F= '{printf "%s=(%d chars)\n", $1, length($2)}'
```

If either is missing or empty: confirm the 1Password desktop app is running and signed in, then re-check.

---

## Database setup

```bash
cd ~/GitHub/StudyPANaCEa

# Pull the latest schema
npm run db:generate

# Apply migrations against your dev DB (DATABASE_URL comes from 1Password)
npm run db:migrate:dev

# Optional: inspect data
npm run db:studio
```

If you hit migrations that reference applied-but-unregistered DDL (e.g., the 2026-04-18 RLS/index migrations), resolve them with:

```bash
npx prisma migrate resolve --applied <migration_dir_name>
```

---

## Verify the setup

```bash
# StudyPANaCEa
cd ~/GitHub/StudyPANaCEa
npm run dev:all  # should boot without env errors

# langchain-agent
cd ~/GitHub/langchain-agent
uv run main.py  # should print "The weather in San Francisco is always sunny!"
```

If `uv run main.py` errors with `anthropic.BadRequestError: credit balance is too low`: that's expected — Aaron's Anthropic account is out of credits. The agent is configured to use Gemini by default. See `~/GitHub/langchain-agent/README.md` to swap providers.

---

## Agent runtime setup (optional, if you use Claude Code / OpenCode / Codex)

The PANaCEa repo has agent config in:
- `.claude/` — Claude Code commands + skills
- `.opencode/` — OpenCode session state (regenerates)
- `AGENTS.md` — shared operating rules for any agent
- `.mcp.json` / `mcp_config.json` — MCP server configs

To replicate the agent setup:

1. Install your preferred agent runtime (Claude Code, OpenCode, Codex, etc.)
2. Point it at this repo
3. Configure MCP servers per `.mcp.json` — the key ones for this project:
   - **1Password** (for env inject pipes)
   - **Context7** (for live library docs)
   - **Firecrawl** (for web search/scrape)
4. Sign in to 1Password in the desktop app (the MCP reads from there)

---

## Cleanup checklist (on the OLD machine, after transfer verified)

Only do this AFTER you've confirmed the new machine works:

- [ ] Push any final local branches: `git push --all` in both repos
- [ ] Confirm no untracked state matters (`.opencode/`, `.claude/handoff.md` are runtime-only)
- [ ] Optionally remove the OLD 1Password mounts (Desktop App → Developer Tools → disable)
- [ ] Optionally `rm -rf ~/GitHub/StudyPANaCEa ~/GitHub/langchain-agent` (only if cleaning up)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `op` CLI says "account not signed in" | `op signin`, follow prompts |
| 1Password `.env.1password` doesn't appear | Desktop app must be running. Toggle the mount off/on in Developer Tools. |
| `npm install` fails on Prisma | Run `npm rebuild` or `npm install --foreground-scripts` to see postinstall errors |
| `npm run typecheck` OOMs | Always use `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` |
| Langfuse traces not landing | Confirm `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` in 1Password env. Code silently no-ops without them. |
| LangSmith 403 on trace POST | Use `LANGSMITH_PERSONAL_ACCESS_TOKEN`. The langchain-agent `main.py` does this fallback automatically. |
| Langfuse + LangSmith confused | Langfuse = PANaCEa app's Gemini calls (TypeScript). LangSmith = sibling langchain-agent's LLM calls (Python). Different runtimes, complementary. |
| `feat/langfuse-tracing` branch missing locally | `git fetch origin && git branch feat/langfuse-tracing origin/feat/langfuse-tracing` |
