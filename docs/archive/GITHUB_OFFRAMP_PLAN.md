# GitHub Offramp Plan — 2026-04-18

**Author:** Claude (sandbox session)
**Status:** Draft for Aaron's review
**Constraint:** Must not lose any files or in-flight work. All phases reversible.

---

## TL;DR

Removing GitHub entirely is **safe** for your workflow **if and only if** you replace three things first:
1. A remote backup for your git history (or accept full laptop-loss risk)
2. Local enforcement of the 5 CI gates GitHub Actions runs today
3. A cron scheduler for the `/api/cron/*` endpoints (Cloudflare Pages Functions cannot do cron on their own)

The deploy pipeline itself is already replaceable — `npm run deploy:local` does the same `wrangler pages deploy` that GitHub Actions does.

---

## What GitHub is actually doing for you today

Audited from `.github/workflows/` on branch `codex-study-session-prod-hotfix-v2` on 2026-04-18:

| Job | File | What it does | Replacement lift |
|---|---|---|---|
| **Remote hosting** | (git remote) | Backup of full git history, 91+ unpushed commits live only on your laptop otherwise | Keep GitHub as silent mirror OR move to Gitea/Codeberg/GitLab |
| **Deploy** | `deploy.yml` | On main push + CI green, runs `npx wrangler pages deploy dist --project-name=panacea` | `npm run deploy:local` already does this — **no work needed** |
| **Lint** | `ci.yml` job `lint` | `npm run lint` with max-warnings 2000 | Local pre-push hook |
| **Typecheck** | `ci.yml` job `typecheck` | `npm run typecheck:ci` (FSRS core scope) | Local pre-push hook |
| **Unit tests (critical)** | `ci.yml` job `test-critical` | `npm run test:critical` (FSRS math + store) | Local pre-push hook |
| **Build + bundle budget** | `ci.yml` job `build-and-size` | `npm run build && npm run build:check-size` (1400 kB JS / 200 kB CSS / 350 kB chunk cap) | Local pre-push hook |
| **Secret scan** | `ci.yml` job `secret-scan` | `gitleaks` against `.gitleaks.toml` | Local pre-commit hook |
| **Unit tests (full)** | `ci.yml` job `test-full` *(advisory)* | Full vitest suite | Drop, or run on your own cadence |
| **E2E a11y** | `ci.yml` job `e2e-a11y` *(advisory)* | Playwright axe-core project | Drop, or run on your own cadence |
| **Hourly cron** | `hourly-automation.yml` | `npm run automation:hourly` — health checks | Replace (see §4) |
| **Daily cron** | `daily-automation.yml` | `npm run automation:daily` + curl aggregate-analytics, daily-prescription, replenish-pool | Replace (see §4) |
| **Weekly cron** | `weekly-automation.yml` | Weekly user reports + deep health checks | Replace (see §4) |
| **Neon** | `neon_workflow.yml` | Legacy (from Neon hosting? you're on Supabase now) | Verify unused, delete |
| **Cloud agents** | `cloud-agents.yml` | Codex cloud agent helper | Keep if you use it; orthogonal to this plan |

---

## Risk assessment

### Risk 1 — Backup loss (HIGH if remote is dropped entirely)

Current state on disk: 187 uncommitted changes, on a feature branch, with 91+ unpushed commits. If your MacBook dies today, Time Machine might save some of it, but live-editing work between backups is lost.

GitHub is free and invisible. The only reason to drop it as a mirror is if you don't trust GitHub specifically (terms of service, Copilot training, acquisition worries). If that's the motivation, fine — say the word and I'll include Gitea or Codeberg setup in the plan. **If the motivation is just "I don't use GitHub as a UI," keep it as a push-only backup mirror.**

### Risk 2 — Silent cron failure (HIGH if not replaced)

`wrangler.toml` comment (line you committed yourself):
> "Scheduled cache warming via cron triggers is not supported for Cloudflare Pages. Use an external scheduler (e.g., GitHub Actions, cron-job.org) to call /api/admin/cache/warm periodically."

If you drop `hourly-automation.yml`, `daily-automation.yml`, `weekly-automation.yml` without a replacement, these stop — but silently. No alert. You'd notice weeks later when `DailyUserAnalytics`, cache warming, pool replenishment, and health checks have been frozen.

Two clean replacements:
- **Cloudflare Workers Cron Triggers** (separate worker that hits your Pages API endpoints). ~5 min setup, runs inside Cloudflare, uses the same CF account.
- **cron-job.org / EasyCron** — free HTTP-pinger service. Zero code. Hits `https://studypanacea.com/api/cron/*` with your `CRON_SECRET` bearer token.

I recommend the CF Worker option — keeps everything inside Cloudflare, zero new third-party surface.

### Risk 3 — Regressions reaching prod (MEDIUM)

Branch protection + CI today means you literally cannot merge a broken build. Locally, you can `npm run deploy:local` at any state, even with type errors. Mitigation: pre-push hook that mirrors the 5 blocking gates AND a `predeploy` script that runs them before `wrangler pages deploy`.

---

## Three-phase plan

### Phase 1 — Replace, don't remove (1–2 days of calendar time)

**Goal:** Stand up local replacements for everything GitHub does. Keep GitHub Actions running in parallel so nothing goes dark.

1. **Install local pre-push gate.** Husky + lint-staged + gitleaks → runs the 5 blocking CI gates before every `git push`. Hook script delivered in this session at `scripts/git-hooks/pre-push.sh`.
2. **Install pre-commit secret scan.** gitleaks runs on staged files only. Fast.
3. **Stand up CF Worker cron.** Deploy a tiny Worker at `crons/panacea-cron-worker/` (scaffold delivered this session) that pings `/api/cron/*` on schedule. Keep GH Actions cron running in parallel for one week as a belt-and-suspenders check.
4. **Add `predeploy` script.** Runs lint + typecheck + test:critical + build + build:check-size + gitleaks before `wrangler pages deploy`. Makes `npm run deploy:local` as safe as GH Actions' deploy pipeline.
5. **Verify.** Push to a test branch, confirm pre-push hook catches a deliberately-broken commit. Verify CF Worker cron fires and the GH Actions cron also fires — both should produce the same side effects on your production DB (idempotent endpoints).

### Phase 2 — Decide about the remote (decision only, no action)

Pick one:

- **2A:** Keep GitHub as push-only mirror. No Actions. No branch protection. Just `git push origin <branch>`. Near-zero cost, high insurance. **Recommended.**
- **2B:** Move remote to Gitea/Forgejo (self-hosted), Codeberg, GitLab free, or SourceHut. Keeps a remote but off GitHub. Meaningful config work (SSH keys, DNS if self-hosted, etc.).
- **2C:** No remote at all. Time Machine + iCloud backups only. **Do not recommend** — catastrophic loss mode too likely.

### Phase 3 — Delete GitHub's automation surface (30 min)

After Phase 1 has run green for a full week:

1. Move `.github/workflows/*.yml` to `.github/workflows.archived/` (keep for recovery, don't delete outright).
2. Remove branch protection rules on main (GitHub Settings → Branches → Rules → delete).
3. If you chose 2A: you're done. The repo lives on, no automation.
4. If you chose 2B: add new remote, `git push <new> --all --tags`, then `git remote remove origin` and `git remote rename <new> origin`. Delete GitHub repo only after verifying the new remote has every commit (including reflog-only ones).
5. If you chose 2C: `git remote remove origin`. Proceed with Time Machine + iCloud as sole backup. **Strongly encourage reconsidering.**

---

## What I've built in this session (Phase 1 artifacts)

Delivered as NEW files only (no edits to shared files, no npm installs — those are your call):

- `docs/GITHUB_OFFRAMP_PLAN.md` *(this file)*
- `scripts/git-hooks/pre-push.sh` — runs lint + typecheck:ci + test:critical + build + check-size + gitleaks
- `scripts/git-hooks/pre-commit.sh` — runs gitleaks on staged files
- `scripts/git-hooks/install-hooks.sh` — wires the two scripts into `.git/hooks/` without needing husky (zero new deps)
- `crons/panacea-cron-worker/wrangler.toml` — Cloudflare Worker cron config
- `crons/panacea-cron-worker/src/index.ts` — Worker that POSTs to your `/api/cron/*` endpoints
- `crons/panacea-cron-worker/README.md` — deploy + verification steps

## What Aaron still needs to run

```bash
# One-time, after reviewing this plan:

# 1. Install the git hooks (zero new npm deps — raw shell hooks)
bash scripts/git-hooks/install-hooks.sh

# 2. Test the pre-push hook works
git commit --allow-empty -m "test: verify pre-push gate"
git push origin <current-branch>
# Expect: hook runs lint + typecheck + test:critical + build + check-size + gitleaks
# If all pass: push proceeds
# If any fail: push is blocked

# 3. Deploy the cron worker (Phase 1, parallel to GH Actions cron)
cd crons/panacea-cron-worker
npm install
# Set secrets (uses your existing CRON_SECRET from wrangler):
npx wrangler secret put CRON_SECRET
npx wrangler secret put PRODUCTION_URL    # https://studypanacea.com
npx wrangler deploy

# 4. Verify worker fires — wait 1 hour, then:
npx wrangler tail panacea-cron-worker

# 5. Run Phase 1 in parallel for one week. Check weekly:
#    - Pre-push hook blocked at least one bad push (run `git log --grep=WIP`)
#    - CF Worker cron logs show successful hits each hour/day
#    - GH Actions cron also green

# 6. Enter Phase 2 decision. Tell me your choice; I'll prepare Phase 3.
```

---

## Explicit NOT-RECOMMENDED moves

- **Do NOT** delete GitHub today, before Phase 1 is green. You'd lose CI + cron simultaneously.
- **Do NOT** skip the pre-push hook install. Without it, you're deploying without regression protection.
- **Do NOT** move the cron from GH Actions to `launchd` on your Mac. Your laptop sleeps; production cron can't sleep.
- **Do NOT** keep `deploy:local` as your only deploy path without a `predeploy` gate. GitHub Actions' value was the forced gate.

---

## FAQ

**Q: "I don't use GitHub's UI so why keep the repo?"**
A: Because GitHub's UI is not what the repo is *for*. It's a replicated object store that survives your laptop dying. You can never touch github.com in a browser and it still does its job.

**Q: "Can I just run `git push origin main` manually when I want to back up?"**
A: Yes. Phase 2A is exactly that. Automated push-on-commit is also an option via another git hook — trivial to add if you want it.

**Q: "Cloudflare Workers Cron Triggers vs cron-job.org?"**
A: CF Workers is $0 if you stay inside the free tier (100K requests/day — you're at ~50/day with 3 schedules). cron-job.org is also free but introduces a third-party dependency. Pick CF unless you want vendor diversity.

**Q: "What about gitleaks for secrets if I stop using GitHub?"**
A: It's delivered as a pre-commit hook this session. Runs locally. The GitHub-Action version was just running the same binary. No change in coverage.

**Q: "I have a gitleaks config already?"**
A: Yes — `.gitleaks.toml` exists. The local pre-commit hook uses the same ruleset, so the behavior is identical to CI.
