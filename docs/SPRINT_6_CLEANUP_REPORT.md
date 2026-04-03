# Sprint 6 — Repository Cleanup Report

**Date:** 2026-04-03
**Scope:** Repo hygiene, dead code removal, doc organization, .gitignore hardening

---

## Summary

Sprint 6 addresses the maintenance debt identified in the comprehensive audit. The cleanup targets root-level clutter, stale documentation, tracked binary artifacts, one-off scripts, and .gitignore gaps — all without touching product behavior.

**Total files targeted for removal: ~60 files + 2 directories**

---

## A. Changes Made Directly

### 1. Import Fix: `MenuView.tsx`

`components/navigation/MenuView.tsx` line 41 imported `DrugEntry` from `@/src/archived/pharm-old/drugTypes` — the only live reference blocking deletion of `src/archived/`. Verified that `types/pharm.ts` exports an identical `DrugEntry` interface. Changed import to `@/types/pharm`.

### 2. `.gitignore` Hardened

Added rules to prevent recurrence of common clutter patterns:

- `/*.jpeg`, `/*.jpg`, `/*.png` — no images at repo root
- `public/Gemini_Generated_Image_*` — AI-generated images
- `public/HEADER*.png` — stale header assets
- `/SESSION_*.md`, `/*_CHECKLIST*.md`, `/DEPLOYMENT_STATUS*.md`, `/PLAN.md` — session/status files at root
- `backup/`, `src/archived/`, `prisma/*.backup*` — backup directories
- `scripts/temp-*`, `scripts/temp_*`, `scripts/test-*` — one-off scripts

### 3. `docs/INDEX.md` Rewritten

The previous index was from January 10, 2026, referenced dead links, and didn't reflect current architecture. New index:

- Declares `CLAUDE.md` as the canonical source of truth
- Organizes docs into "Currently Relevant" (last 30 days) vs "Reference" vs "Historical"
- Documents all subdirectories
- Includes build commands and key file quick reference
- Acknowledges the ~200 historical docs without over-curating them

---

## B. Cleanup Script: `scripts/sprint6-cleanup.sh`

A safe, idempotent bash script that handles all git rm operations. Supports `--dry-run` mode.

### Phase 1 — Root Screenshots (10 files, ~1.1 MB)

| File | Size | Reason |
| --- | --- | --- |
| audit-dashboard-full.jpeg | 79 KB | Point-in-time screenshot, no references |
| audit-dashboard-top.jpeg | 85 KB | Same |
| audit-dashboard.jpeg | 85 KB | Duplicate of above |
| audit-landing.jpeg | 197 KB | Same |
| audit-modal.jpeg | 53 KB | Same |
| chrome-landing-full.jpeg | 307 KB | Same |
| landing-below-fold.jpeg | 190 KB | Same |
| landing-desktop.jpeg | 114 KB | Same |
| landing-forced-grid.jpeg | 116 KB | Same |
| landing-full.jpeg | 196 KB | Same |

### Phase 2 — Root Markdown Files (23 files, ~400 KB)

All `AUDIT_*.md`, `SESSION_*.md`, `DEPLOYMENT_STATUS.md`, and `PLAN.md` at root. Zero runtime references. Already covered by .gitignore patterns.

### Phase 3 — Stale Public Assets (11 files)

10 `Gemini_Generated_Image_*.png` files and `HEADER V1.png`. Not referenced in any TSX/HTML/CSS.

### Phase 4 — Backup/Archived Directories

- `backup/` — contains only `roomodes/.roomodes.backup.20260305`
- `src/archived/` — `pharm-old/` and `pptx-assets/` (import fix applied first)
- `prisma/schema-review-log.backup.txt`

### Phase 5 — One-Off Scripts (15 files)

All `scripts/temp-*` and `scripts/test-*` files. These are diagnostic/exploration scripts, not part of the test suite (which lives in `tests/`).

### Phase 6 — Defunct Configs (3 files)

`ecosystem.config.js`, `docker-compose.yml`, `lighthouserc.js` — superseded by wrangler.toml / Cloudflare Pages.

---

## C. Verify-Before-Delete List (NOT in cleanup script)

These items need human judgment before removal:

| Item | Concern |
| --- | --- |
| `podcast-service/` | Standalone service, referenced in `functions/api/podcast/generate.ts` as external URL. Safe if podcast feature is not in use. |
| `scripts/deprecated/` | 17 entry generator scripts (v1 and v2). May still be useful for content generation sprints. |
| `gcp-fsrs-optimizer/` | Python FSRS optimizer service. Separate from main app but may be used for param tuning. |
| `plans/` directory (33 files) | Historical planning docs. Low risk but may have sentimental/reference value. |
| `docs/*.md` (200+ historical) | Point-in-time docs. Conservative approach: keep, acknowledge in index as historical. |

---

## D. How to Run

```bash
# From repo root:

# 1. Preview what will be removed
bash scripts/sprint6-cleanup.sh --dry-run

# 2. Execute cleanup
bash scripts/sprint6-cleanup.sh

# 3. Verify nothing broke
npm run typecheck
npm test

# 4. Commit
git add .gitignore docs/INDEX.md components/navigation/MenuView.tsx
git commit -m "chore: Sprint 6 repo cleanup — remove stale artifacts, fix imports, harden gitignore"
```

---

## E. Follow-Up Maintenance Guidance

1. **Root-level files:** The .gitignore now blocks most common clutter patterns. Any new doc should go in `docs/`, any new plan in `plans/`.

2. **docs/ sprawl:** Consider a quarterly review to move clearly obsolete docs to `docs/archive/` (currently doesn't exist as a separate folder — could be created in a future sprint).

3. **scripts/ sprawl:** 250+ scripts is still high. A future sprint could audit `scripts/` more aggressively, moving one-off generators to `scripts/deprecated/` and consolidating utilities.

4. **CLAUDE.md as source of truth:** Keep this updated as the canonical project context. It's more useful than any single doc in `docs/`.

5. **Gemini images in public/:** The .gitignore now blocks these. If AI-generated images are needed, they should go through the proper media pipeline to `public/images/`.
