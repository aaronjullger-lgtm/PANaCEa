# Git History Rewrite Runbook

**Purpose:** Remove large binary blobs and sensitive files from the full git history.  
**Status:** PENDING EXECUTION — do not run until repo is in a stable, all-hands-agreed state.  
**Risk:** Destructive and irreversible without a full backup. All collaborators must re-clone.

---

## 1. Pre-Flight Checklist

Before starting, confirm all of the following:

- [ ] All open branches are merged or backed up locally
- [ ] All collaborators are notified and have pushed their local changes
- [ ] A full local backup of the repo exists: `cp -r StudyPANaCEa StudyPANaCEa.backup`
- [ ] GitHub branch protections are noted (they may need to be temporarily disabled)
- [ ] CI/CD pipelines are paused or acknowledged
- [ ] `git-filter-repo` is installed: `pip3 install git-filter-repo`

---

## 2. Files to Remove from History

Based on `git rev-list --all --objects` analysis (largest blobs):

| File | Size | Reason |
|------|------|---------|
| `panacea_full_dump.sql` | ~68 MB | Full database dump — may contain PII |
| `codebase.md` | ~38 MB | AI-generated repo snapshot |
| `repomix-output.xml` | ~19 MB | AI tool output |
| `data/conditionContent.json` | ~21 MB | Generated content data |
| `data/conditionContent.clean.json` | ~21 MB | Generated content data |
| `conditionContent.final.json` | ~20 MB | Generated content data |
| `conditionContent.generated.json` | ~12 MB | Generated content data |
| `conditionContent.scrubbed.json` | ~11 MB | Generated content data |
| `prod-ca-2021.crt` | unknown | SSL certificate (should not be committed) |
| `enrichment-log.json` | unknown | Dev artifact |
| `content-priority-report.csv` | unknown | Dev artifact |
| `*.session.sql` | varies | Supabase session files with potential queries |

---

## 3. Rewrite Command

**Tool:** [`git-filter-repo`](https://github.com/newren/git-filter-repo) (preferred over BFG due to active maintenance and accuracy)

```bash
# Step 1: Clone a fresh mirror of the repo
git clone --mirror git@github.com:aaronjullger-lgtm/PANaCEa.git panacea-mirror
cd panacea-mirror

# Step 2: Remove large/sensitive files from all history
git filter-repo --invert-paths --path panacea_full_dump.sql \
  --path codebase.md \
  --path repomix-output.xml \
  --path conditionContent.final.json \
  --path conditionContent.generated.json \
  --path conditionContent.scrubbed.json \
  --path prod-ca-2021.crt \
  --path enrichment-log.json \
  --path content-priority-report.csv \
  --path-glob "*.session.sql" \
  --path-glob "data/conditionContent*.json"

# Step 3: Verify the files are gone
git log --all --full-history -- codebase.md
# Should return nothing

# Step 4: Check history integrity
git fsck --full --no-reflogs

# Step 5: Check new repo size
git count-objects -vH
```

---

## 4. Force-Push to Remote

```bash
# Step 6: Add remote back (filter-repo strips it for safety)
git remote add origin git@github.com:aaronjullger-lgtm/PANaCEa.git

# Step 7: Force-push all branches and tags
git push origin --force --all
git push origin --force --tags
```

> **Warning:** This rewrites all commit SHAs. Every branch pointer on GitHub will change.  
> GitHub will keep a cache of the old objects for ~90 days — open a GitHub Support ticket  
> to have them purge the cached objects if needed.

---

## 5. Collaborator Recovery Steps

Every person who has a clone must run:

```bash
# Option A: Re-clone (simplest, recommended)
cd ..
rm -rf StudyPANaCEa
git clone git@github.com:aaronjullger-lgtm/PANaCEa.git

# Option B: If they have local branches to preserve
git fetch --all
git reset --hard origin/main   # for the main branch
# For each local branch: git rebase --onto <new-sha> <old-sha> <branch>
```

---

## 6. Post-Rewrite Validation

```bash
# Confirm no large blobs remain in history
git rev-list --all --objects | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sort -k3 -n -r | head -20

# Confirm pack size
git gc --aggressive --prune=now
git count-objects -vH
# Target: pack size < 200 MB
```

---

## 7. GitHub-Specific Steps

1. **Invalidate GitHub's cache:** Go to Settings → Danger Zone → "This will delete the repository's cache." (Or contact GitHub Support.)
2. **Update branch protections** if they were disabled during the rewrite.
3. **Verify Cloudflare Pages** still deploys correctly (deploy SHA changes but the code is identical).
4. **Rotate any secrets** that were in the files being removed (especially `panacea_full_dump.sql`).

---

## 8. Secrets to Rotate After Rewrite

If any of these were ever committed (check the files being removed):

- `DATABASE_URL` / Supabase connection strings
- `CLERK_SECRET_KEY` (sk_live_*)
- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Any API keys found in `.env` files committed by mistake

**Even after history rewrite, assume any key that was in git history is compromised** and rotate it in the respective dashboard.

---

## 9. Prevention (Already Done)

The following measures are now in place to prevent new large files entering history:

- `.gitignore` updated to block: `*.md` (AI reports), `codebase.md`, `repomix-output.xml`, `*.session.sql`, `*.crt`, `enrichment-log.json`, `content-priority-report.csv`
- `gitleaks/gitleaks-action@v2` runs on every PR/push to main (see `.github/workflows/ci.yml`)
- `.gitleaks.toml` configured to allow-list known-safe public keys and block new secret patterns

---

*Runbook created: 2026-03-13 | Last updated: 2026-03-13*  
*Owner: Engineering Lead | Review before execution.*
