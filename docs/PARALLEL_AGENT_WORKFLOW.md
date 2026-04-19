# Parallel-Agent Workflow

**Status:** Proposed — supersedes the earlier `GITHUB_OFFRAMP_PLAN.md`.
**Owner:** Aaron (solo dev, multiple concurrent AI agents)
**Last updated:** 2026-04-18

---

## Problem statement

Multiple AI agents (Claude Code, Codex, Desktop Commander sessions, etc.) run
concurrently against this repo. When they share a single working tree they
collide on:

1. **`.git/index.lock`** — two agents running `git add` / `git commit` / `git
   stash` at the same time. The second loses.
2. **`gc.log.lock` / `maintenance.lock`** — background `git gc` /
   `git maintenance` fires while an agent is writing, leaves a stale lock,
   and blocks the next op until the lock is manually cleared.
3. **Meshing divergence** — two agents both push to the same branch; one gets
   a non-fast-forward rejection or a merge conflict that nobody is online to
   resolve.
4. **CI queue bottleneck** — every push runs five blocking CI gates
   sequentially (lint, typecheck, test-critical, build+size, gitleaks). Two
   pushes close together → the second waits 8–12 min.

Each of these has a different fix. Bundling them together led to the earlier
"just remove GitHub" proposal, which was off-target: GitHub is not the
bottleneck.

---

## Design principles

- **Isolation per agent.** No two agents write to the same `.git/index`.
- **One writer to `main`.** Agents push personal branches; a coordinator
  merges and pushes `main`.
- **Fast local feedback.** CI gates mirrored locally so failures surface in
  seconds, not 10 minutes after a push.
- **No background git ops.** Scheduled maintenance runs on demand, never
  opportunistically in the middle of an agent's commit.
- **Cron independent of CI.** Scheduled jobs (reservoir top-up, analytics,
  reminders) don't sit behind the CI queue.

---

## Architecture

### 1. Git worktrees — one per agent

Each agent gets its own worktree. Each worktree has its own `.git/index`,
`.git/HEAD`, and working copy. The underlying object database is shared,
which is safe (object writes are atomic, content-addressed, and non-locking
for reads).

```bash
# One-time setup from the main clone at ~/GitHub/StudyPANaCEa
git worktree add ../panacea-agent-a feat/agent-a-work
git worktree add ../panacea-agent-b feat/agent-b-work
git worktree add ../panacea-agent-c feat/agent-c-work

# List
git worktree list

# Tear down when done
git worktree remove ../panacea-agent-a
```

**Convention:** worktree path = `../panacea-agent-<letter>`; branch =
`feat/agent-<letter>-<scope>` or `wip/agent-<letter>-<ticket>`.

**What this fixes:** `.git/index.lock` races disappear. Agents can run
`git add`, `git commit`, `git status` concurrently with zero contention.

### 2. Disable background git maintenance

Git ≥ 2.30 spawns background `git maintenance` and `git gc` processes. On a
repo this size they buy nothing and cause `.git/gc.log.lock` races.

```bash
# Run once in ~/GitHub/StudyPANaCEa
git config gc.auto 0
git config maintenance.auto false

# If maintenance is already scheduled, unregister it
git maintenance unregister || true
```

Run manual GC monthly instead: `git gc --prune=now` from an idle repo.

### 3. Branch-per-agent, coordinator-merges-to-main

```
                      ┌─► feat/agent-a-work ─┐
main ─ (checked out) ─┼─► feat/agent-b-work ─┼─► coordinator ─► main
                      └─► feat/agent-c-work ─┘
```

**Agents:**
- Work on `feat/agent-<letter>-<scope>` off `main`.
- Commit freely (with `--no-verify` on WIP commits — pre-commit hook runs on
  merge, not on every agent save).
- Push to their personal branch with `--no-verify` as needed.
- **Never push `main` directly.**

**Coordinator (you, or a dedicated coordinator agent):**
- Lives in the root worktree (`~/GitHub/StudyPANaCEa` on `main`).
- Periodically (or on demand) merges agent branches:
  ```bash
  git checkout main
  git pull --ff-only
  git merge --no-ff feat/agent-a-work -m "merge: agent-a sprint N"
  git merge --no-ff feat/agent-b-work -m "merge: agent-b sprint N"
  # Resolve any conflicts here, once, in one place
  bash scripts/git-hooks/pre-push.sh  # runs all 5 CI gates locally
  git push
  ```
- If a coordinator merge fails its local gate, the offending agent branch is
  kicked back to the agent for fixes — the bad code never hits `main` or
  burns a CI run.

### 4. Local pre-push gate (already built)

`scripts/git-hooks/pre-push.sh` mirrors the 5 CI jobs in `.github/workflows/ci.yml`:
lint → typecheck:ci → test:critical → build + bundle size → gitleaks.

Install once: `bash scripts/git-hooks/install-hooks.sh`.

**Coordinator runs it on merged `main`.** Agents pushing to personal branches
can bypass with `git push --no-verify` — that's intentional. The goal is to
surface failures locally *before they reach `main`*, not to block every WIP
commit.

### 5. CF Worker cron (already built)

`crons/panacea-cron-worker/` — a standalone Cloudflare Worker with cron
triggers that POSTs to the existing `/api/cron/*` endpoints. Replaces the
three GitHub Actions cron workflows.

**Why this matters here:** scheduled work (reservoir maintenance, analytics
rollup, push reminders) no longer sits in the GH Actions queue behind
feature pushes. If CI is backed up, cron still fires on time.

Deploy once:
```bash
cd crons/panacea-cron-worker
npx wrangler secret put CRON_SECRET       # same as Pages CRON_SECRET
npx wrangler secret put PRODUCTION_URL    # https://studypanacea.com
npx wrangler deploy
```

Then disable the three GH Actions cron workflows (delete the `schedule:`
trigger or rename to `.yml.disabled`).

---

## Current-state cleanup (required before rollout)

The working tree is on `codex-study-session-prod-hotfix-v2` with ~187
uncommitted files and ~91 unpushed commits. Every agent is fighting over that
single worktree's `.git/index`.

**Required:**
1. Either land that branch (merge to `main`, push) or formally abandon it
   (stash to a `parked/` branch, `git reset --hard`, force-push is NOT needed
   because the branch stays remote-only).
2. Before creating agent worktrees, the root worktree must be on a clean
   `main` synced with origin.

This cleanup is destructive-adjacent (abandoning uncommitted work) and needs
explicit approval — it is NOT part of the "just do it" authority set.

---

## Rollout order

1. ✅ **Workflow doc** — this file.
2. **Repo config** — `git config gc.auto 0` + `git config maintenance.auto false` in the main repo.
3. **Install hooks** — `bash scripts/git-hooks/install-hooks.sh` (one-time).
4. **Branch cleanup** — resolve `codex-study-session-prod-hotfix-v2` (requires approval).
5. **Create agent worktrees** — `git worktree add ../panacea-agent-{a,b,c}` off a clean `main`.
6. **Deploy CF cron Worker** — `cd crons/panacea-cron-worker && npx wrangler deploy` (requires approval — production deploy).
7. **Disable GH Actions cron workflows** — rename `*.yml` → `*.yml.disabled` in `.github/workflows/` (requires approval — touches CI).

Steps 2, 3, and 1 are reversible and safe to execute without approval. Steps
4, 6, 7 require explicit approval.

---

## Operational notes

### Emergency lock recovery

If a stale lock survives (unlikely with `gc.auto 0`):

```bash
# Check first — is any git process actually running?
pgrep -a git

# If nothing is running, the lock is stale. Move it (don't rm).
mv .git/index.lock ~/.Trash/panacea-git-index.lock-$(date +%Y%m%d-%H%M%S)
mv .git/gc.log.lock ~/.Trash/panacea-gc-log-lock-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
mv .git/objects/maintenance.lock ~/.Trash/panacea-maintenance-lock-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
```

### Coordinator cadence

Not every hour. Recommendation: coordinator runs when a visible "agent done"
signal exists — an agent drops a marker file (`.agent-done-<letter>`) in its
worktree, or emits a TodoList completion, or pings Aaron directly. Merging
too frequently burns CI; merging too rarely lets branches diverge.

### Conflict policy

Conflicts get resolved at the coordinator, not the agent. Agents are not
trusted to pick the right resolution without full cross-branch context.
Coordinator uses `git mergetool` or manual edit, runs the local pre-push
gate, then pushes.

### What about PRs?

Optional. The coordinator pattern doesn't require PRs — direct merges to
`main` are fine for a solo dev. Keep PRs if you want GitHub's diff UI for
review; skip them if CLI diff is enough.

---

## What this replaces

- `docs/GITHUB_OFFRAMP_PLAN.md` — earlier, narrower plan that treated GitHub
  as the problem. Superseded by this doc. Can be deleted once the CF cron
  worker is deployed and the cron Actions workflows are disabled.
