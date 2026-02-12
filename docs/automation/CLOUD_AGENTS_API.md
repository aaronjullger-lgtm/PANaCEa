# Cloud Agents API Integration

This project uses the **Cursor Cloud Agents API** to trigger background agents from scripts and CI (GitHub Actions). Agents run in the cloud and can suggest fixes, update docs, or open PRs.

## Prerequisites

- **API key:** From [Cursor Dashboard](https://cursor.com/dashboard) (Settings → API / Service Accounts). Create a key with permission to launch Cloud Agents.
- **Secrets:** Store the key as `CURSOR_AGENTS_API_KEY` in GitHub repo Secrets and in local `.env` (never commit it).

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `CURSOR_AGENTS_API_KEY` | Yes | API key for Basic Auth. |
| `CURSOR_AGENTS_BASE_URL` | No | Default `https://api.cursor.com`. Override for custom endpoint. |
| `CURSOR_AGENTS_REPO` | No (local) | Full GitHub repo URL. In CI, `GITHUB_REPOSITORY` is used. |

## Usage

### 1. Fire-and-forget (local or ad-hoc)

Launch an agent with a custom instruction; it runs in the cloud and you can close your machine.

```bash
# Load key from .env
npx tsx scripts/cloud-agents/trigger.ts --instruction "Refactor auth in contexts/ to use the new provider"

# With branch
npx tsx scripts/cloud-agents/trigger.ts -i "Add unit tests for lib/sessionInterleaving.ts" --branch develop

# Repo override (e.g. fork)
CURSOR_AGENTS_REPO=https://github.com/org/repo npx tsx scripts/cloud-agents/trigger.ts -i "Fix lint in components/"
```

### 2. CI (GitHub Actions)

Workflow `cloud-agents.yml` runs on PRs and optionally on push/schedule. It sets `AGENT_JOB` and `CHANGED_FILES`, then runs:

```bash
npx tsx scripts/cloud-agents/run-from-ci.ts
```

**Job types:** `edge-guard`, `living-docs`, `asset-perf`, `schema-sync`, `e2e-gap`, `pr-review`, `security-sentinel`, `lint-fix`.

To run a custom instruction from CI without a template, set:

```bash
AGENT_INSTRUCTION_OVERRIDE="Your full instruction here" npx tsx scripts/cloud-agents/run-from-ci.ts
```

### 3. Multi-repository (bulk)

Same instruction across several repos (e.g. shared libs or microservices):

```bash
npx tsx scripts/cloud-agents/bulk-repos.ts \
  --instruction "Update the logging library to 2.0 and fix breaking changes" \
  --repos owner/repo-a owner/repo-b
```

Repos can be `owner/name` or full `https://github.com/owner/name` URLs. Each launch uses `autoCreatePr: true` so the agent can open a PR per repo.

### 4. Programmatic (Node/TS)

```ts
import { launchAgent } from "./scripts/cloud-agents/client.js";

const { id } = await launchAgent({
  instruction: "Add tests for lib/foo.ts",
  repository: "https://github.com/owner/repo",
  ref: "main",
  autoCreatePr: true,
});
console.log("Agent run ID:", id);
```

## Example prompts (fire-and-forget)

- **Test generation:**  
  `"Generate unit tests for files in lib/ that have no adjacent *.test.ts. Use Vitest and existing patterns in this repo."`
- **Refactor:**  
  `"Refactor the authentication module in contexts/ and functions/api to use the new provider; keep Zod validation and Edge runtime rules."`
- **Docs:**  
  `"Update docs/api/API_OVERVIEW.md to include all routes under functions/api/exam/ and functions/api/srs/ with method, path, and one-line description."`

## Security and constraints

- **No MCP:** Agents only see repo context; they cannot call external DBs or tools.
- **Idempotency:** Prefer agents that open PRs or suggest changes; avoid direct pushes to main.
- **Secrets:** Use GitHub Secrets for `CURSOR_AGENTS_API_KEY` in workflows; use `.env` locally and keep it gitignored.

## Optional: Slack / internal tooling

A `/fix-bug [issue URL]` Slack command (or similar) can call a small backend that invokes the same client with an instruction like: *"Investigate and suggest a fix for this issue: [url]. Repo: StudyPANaCEa."* Implement that in a separate service using the same env and `launchAgent()` contract; see this doc for the API shape.

## References

- [Cursor: Launch an agent (API)](https://docs.cursor.com/background-agent/api/launch-an-agent)
- Plan: `.cursor/plans/cloud_agents_api_integration.plan.md`
