# Audit 12 — Repository Hygiene, Dead Code & Maintenance Clutter

**Date:** 2026-04-02
**Auditor perspective:** Senior full-stack engineer, production readiness review
**Scope:** Root directory clutter, stale documentation, dead components/hooks/services, duplicate file pairs, diagnostic script accumulation, build artifact leakage, deprecated code in tree
**Methodology:** Automated file counts, import-graph verification (grep across all .ts/.tsx excluding worktrees), git-tracked status checks, gitignore gap analysis

---

## Executive Summary

PANaCEa's codebase has grown organically through 11 audit-and-fix cycles, AI-assisted development, and rapid iteration. The functional code is solid, but the repository has accumulated significant maintenance debt: **320 documentation files** (42 audit reports in docs/ alone), **446 scripts** (52 one-off diagnostics), **8 duplicate component pairs**, **10+ duplicate service pairs**, **10 git-tracked screenshots** in the root, and **157 MB of stale worktree copies**. None of this blocks production, but it meaningfully slows onboarding, increases wrong-file-edit risk, and inflates CI/clone times.

**Severity breakdown:** 2 High, 6 Medium, 7 Low
**Blocks production:** None
**Estimated cleanup time:** 2–3 days (most is safe-to-delete immediately)

---

## Findings

### Finding 12-1: Root Directory Has 22 Markdown Files and 10 Tracked Screenshots
**Severity:** Medium | **Type:** Clutter | **Blocks production:** No

**Files:**
- 13 `AUDIT_*.md` files in root (should live in `docs/audits/`)
- 5 `SESSION_*.md` files in root (should live in `docs/sessions/`)
- `PLAN.md`, `DEPLOYMENT_STATUS.md` (should live in `docs/` or `plans/`)
- 10 `.jpeg` screenshots (`audit-*.jpeg`, `landing-*.jpeg`, `chrome-*.jpeg`) — all git-tracked, totaling ~1 MB

**Root cause:** Audit reports and screenshots were created at the repo root for convenience and never relocated. No gitignore rule covers root-level images.

**Impact:** `ls` at root returns 50+ items. New contributors see audit artifacts before they see source code. Screenshots inflate clone size permanently (in git history even if deleted).

**Fix:** Move `AUDIT_*.md` → `docs/audits/`, `SESSION_*.md` → `docs/sessions/`, screenshots → `docs/screenshots/` (or delete). Add `*.jpeg` / `*.png` to root `.gitignore` (public/images/ can be exempted with `!public/images/`). Consider `git filter-branch` or BFG to purge binaries from history if clone size matters.

---

### Finding 12-2: 320 Files in docs/ — 42 Are Audit Reports, Many Are Stale
**Severity:** Medium | **Type:** Documentation debt | **Blocks production:** No

**Details:**
- `docs/` contains 320 files total
- 42 are `AUDIT_*.md` reports (many from prior phases, now superseded)
- Remaining includes sprint summaries, phase completion reports, implementation summaries, architecture notes, and AI-generated analysis docs
- No index file, no directory structure, no indication of which docs are current

**Root cause:** Each development phase generated documentation that was never pruned or organized.

**Impact:** Documentation search is needle-in-haystack. Developers may reference stale audit findings that have already been fixed. `docs/` is effectively a write-only archive.

**Fix:** Create subdirectory structure: `docs/audits/`, `docs/architecture/`, `docs/sessions/`, `docs/archive/`. Move superseded docs into `docs/archive/`. Add `docs/INDEX.md` listing current docs. Delete clearly obsolete files (e.g., sprint summaries for completed sprints).

---

### Finding 12-3: 446 Scripts — 52 Are One-Off Diagnostics, 16 Are Pre-Marked Deprecated
**Severity:** Medium | **Type:** Dead code | **Blocks production:** No

**Details:**
- `scripts/` contains 446 files
- 52 match diagnostic patterns (`test-*`, `check-*`, `verify-*`, `debug-*`, `fix-*`, `audit-*`, `scan-*`, etc.)
- 16 files already live in `scripts/deprecated/` but are still in the tree
- Additional loose diagnostic scripts at root: `query.ts`, `audit-queries.js`, `audit-queries.mjs`

**Root cause:** Diagnostic scripts were created during debugging sessions and never cleaned up. The `scripts/deprecated/` directory was created but not followed through with deletion.

**Impact:** `scripts/` is overwhelming to navigate. New developers can't distinguish production scripts (seed, migrate) from throwaway diagnostics. CI scans more files than necessary.

**Fix:**
1. Delete `scripts/deprecated/` entirely (already marked dead)
2. Move diagnostic scripts to `scripts/archive/` or delete outright
3. Delete root `query.ts`, `audit-queries.js`, `audit-queries.mjs`
4. Create `scripts/README.md` categorizing remaining scripts (seed, migrate, content-generation, maintenance)

---

### Finding 12-4: 8 Duplicate Component Pairs — Wrong-File-Edit Risk
**Severity:** High | **Type:** Architecture debt | **Blocks production:** No

**Duplicate pairs (verified by import analysis):**

| Component | Location A (Active) | Location B (Dead/Duplicate) | Status |
|---|---|---|---|
| DrillShell | `components/drill/DrillShell.tsx` | `components/layout/DrillShell.tsx` | B is dead — only importer is an example file |
| AnswerFeedback | `components/session/AnswerFeedback.tsx` | `components/quiz/AnswerFeedback.tsx` | B is dead — zero importers |
| BookmarksPanel | `components/library/BookmarksPanel.tsx` | `components/panels/BookmarksPanel.tsx` | A is active (MenuView imports it); B dead |
| ExplanationPanel | `components/session/ExplanationPanel.tsx` (active, imported by AnswerFeedback) | `components/questions/ExplanationPanel.tsx` (also imported by QuizView) | **Both have importers — needs careful merge** |

Additional pairs with lower risk: `ProgressBar`, `LoadingSpinner`, `ThemeToggle` have near-identical implementations in multiple locations.

**Root cause:** Components were duplicated during directory reorganizations without removing originals. No barrel exports enforce single source of truth.

**Impact:** A developer editing `components/layout/DrillShell.tsx` would see zero effect in production (the active version is in `drill/`). ExplanationPanel is the highest risk — two different files both imported from different consumers, potentially diverging.

**Fix:** Delete confirmed-dead duplicates (DrillShell/layout, AnswerFeedback/quiz, BookmarksPanel/panels). For ExplanationPanel, audit both consumers, consolidate to one file, update imports.

---

### Finding 12-5: 10+ Duplicate Service Pairs — Confusing Import Paths
**Severity:** High | **Type:** Architecture debt | **Blocks production:** No

**Verified duplicates:**

| Service | Copies | Active Import Path | Dead Copies |
|---|---|---|---|
| contentService | 3 copies | `lib/api/contentService.ts` (frontend), `lib/services/cms/contentService.ts` (backend) | `lib/services/content/contentService.ts` (unclear) |
| sessionService | 3 copies | `services/core/sessionService.ts` or `services/session/sessionService.ts` | `lib/services/session/sessionService.ts` |
| questionService | 2 copies | `services/core/questionService.ts` | `services/questionService.ts` (root has importers in App.tsx, SessionContext) |
| adaptiveFSRSService | 2 copies | `services/domain/adaptiveFSRSService.ts` | `services/ai/adaptiveFSRSService.ts` (only test imports) |

**Root cause:** Service layer was reorganized from flat `services/` to `services/core/`, `services/domain/`, `lib/services/` without removing originals. Some old import paths persisted in consumer files.

**Impact:** Bug fixes applied to the wrong copy are silently lost. The root `services/questionService.ts` is still imported by `App.tsx` and `SessionContext.tsx` — those consumers may be using stale logic if `services/core/questionService.ts` was the intended replacement.

**Fix:** For each duplicate pair: verify which version has the latest logic, update all importers to the canonical path, delete the duplicate. **Critical:** `questionService` at root still has active importers — update `App.tsx` and `SessionContext.tsx` first.

---

### Finding 12-6: 3 contentService Copies with Known Bug in Active One
**Severity:** Medium | **Type:** Bug amplification | **Blocks production:** No (degraded feature)

**Files:**
- `lib/api/contentService.ts` — Frontend copy, **has the `Object.entries()` array-as-map bug** (Audit 10 Finding 10-6)
- `lib/services/cms/contentService.ts` — Backend copy, used by Edge functions
- `lib/services/content/contentService.ts` — Unclear which consumers, if any

**Root cause:** Content service was forked for frontend vs backend needs, but then a third copy appeared during a reorganization. The buggy frontend copy was never reconciled with the backend version.

**Impact:** The known array-as-map bug (Audit 10) corrupts content IDs on the browser path. Having 3 copies makes it unclear where to apply the fix — a developer might fix the wrong file.

**Fix:** Fix the `Object.entries()` bug in `lib/api/contentService.ts`. Determine if `lib/services/content/contentService.ts` has any importers; if not, delete it. Document that frontend uses `lib/api/` and backend uses `lib/services/cms/`.

---

### Finding 12-7: 957 Files Contain @deprecated Markers
**Severity:** Low | **Type:** Technical debt indicator | **Blocks production:** No

**Details:** `grep -rl "@deprecated"` across .ts/.tsx returns 957 matches. This includes worktree copies (which inflate the count ~3×), but even accounting for that, ~300+ source files contain deprecated annotations that have not been acted upon.

**Root cause:** Deprecation markers were added during refactors as "TODO: remove later" signals, but removal never happened.

**Impact:** Low direct impact, but the sheer volume means `@deprecated` has lost its signaling value. When everything is deprecated, nothing is.

**Fix:** Audit the highest-traffic deprecated files (services, hooks). For genuinely dead code, delete. For code that's actually still needed, remove the misleading `@deprecated` tag. Prioritize files in `lib/` and `services/` over test files.

---

### Finding 12-8: Build Artifacts Partially Git-Tracked
**Severity:** Medium | **Type:** Repo hygiene | **Blocks production:** No

**Tracked items that shouldn't be:**
- `test-output.log` (7.5 KB) — not in `.gitignore`
- `backup/` directory — `.gitignore` has `backups/` (plural) but actual directory is `backup/` (singular)
- Root `.jpeg` screenshots — no image gitignore rule for root
- `query.ts`, `audit-queries.js`, `audit-queries.mjs` — no gitignore rule

**Already correctly gitignored:** `dist/`, `logs/`, `test-results/` (covered)

**Root cause:** Gitignore rules don't match actual directory names (backup vs backups). Ad-hoc files were created and committed without updating gitignore.

**Impact:** Clone includes unnecessary files. CI may process test output or backup files. New commits to these files add noise to diffs.

**Fix:** Add to `.gitignore`: `backup/`, `test-output.log`, `*.jpeg` (root-level), `audit-queries.*`, `query.ts`. Run `git rm --cached` on tracked files to untrack without deleting locally.

---

### Finding 12-9: 157 MB of Stale Agent Worktrees
**Severity:** Low | **Type:** Disk waste | **Blocks production:** No

**Path:** `.claude/worktrees/` — contains `agent-a4846084/` and `agent-a50bba78/`

**Root cause:** Claude Code agent operations created git worktrees that weren't cleaned up after completion.

**Impact:** 157 MB of duplicated source code. Import grep results are polluted with worktree matches (visible in every `grep -rl` during this audit). No production impact.

**Fix:** `rm -rf .claude/worktrees/`. Add `.claude/worktrees/` to `.gitignore` if not already covered by `.claude/` rule.

---

### Finding 12-10: routes/ Directory (19 Files) Is Local-Dev-Only but Confusing
**Severity:** Low | **Type:** Clarity | **Blocks production:** No

**Details:** `routes/` contains 19 Express route handlers used only for local development. They're excluded from `tsconfig.json` compilation, but nothing else signals their status.

**Root cause:** The project migrated from Express to Cloudflare Edge Functions but kept the Express routes for local development convenience.

**Impact:** New developers may edit `routes/` thinking they're modifying the production API (which is in `functions/api/`). CLAUDE.md documents this, but the directory itself has no README.

**Fix:** Add `routes/README.md` stating "LOCAL DEV ONLY — production API is in functions/api/". Consider whether these routes are still needed given `npm run dev:wrangler` exists for production-like local development.

---

### Finding 12-11: plans/ Directory Has 23 Files with No Status Indicators
**Severity:** Low | **Type:** Documentation debt | **Blocks production:** No

**Details:** `plans/` contains 23 implementation plans, improvement plans, and upgrade plans. No indication of which are completed, in-progress, or abandoned.

**Root cause:** Plans were created per-feature and never marked as done or archived.

**Impact:** A developer reading `plans/IMPROVEMENT_PLAN.md` can't tell which items are done. Plans reference file paths and patterns that may have changed.

**Fix:** Add status headers (`## Status: COMPLETED / IN-PROGRESS / ABANDONED`) to each plan. Archive completed plans to `plans/archive/`. Alternatively, consolidate into a single living roadmap document.

---

### Finding 12-12: No Barrel Exports for Component or Service Directories
**Severity:** Low | **Type:** Import hygiene | **Blocks production:** No

**Details:** Neither `components/ui/` nor `services/core/` nor `lib/services/` has an `index.ts` barrel export. Every import must specify the exact file path: `import { Button } from '@/components/ui/button'`.

**Root cause:** Components were added individually without establishing a barrel export convention.

**Impact:** Import paths are verbose and fragile. Moving a component requires updating every importer (no single re-export point). Duplicate components (Finding 12-4) persist partly because there's no canonical barrel to make the "right" import obvious.

**Fix:** Add `components/ui/index.ts` that re-exports all UI primitives. Add `services/index.ts` barrel for core services. This makes the canonical import path obvious and enables single-point refactoring.

---

### Finding 12-13: Loose TypeScript/JS Files at Repository Root
**Severity:** Low | **Type:** Clutter | **Blocks production:** No

**Files:**
- `query.ts` — standalone database query script
- `audit-queries.js` — audit-related queries
- `audit-queries.mjs` — ESM version of audit queries

**Root cause:** Created during debugging sessions, committed to root for convenience.

**Impact:** Pollutes root directory. `query.ts` may contain hardcoded connection strings (security risk if public). Confusing for new developers.

**Fix:** Delete all three. If the queries are needed, move to `scripts/queries/`.

---

### Finding 12-14: ExplanationPanel Dual-Import Creates Silent Divergence Risk
**Severity:** Medium | **Type:** Architecture debt | **Blocks production:** No

**Details:**
- `components/session/AnswerFeedback.tsx` imports from `components/questions/ExplanationPanel.tsx`
- `components/session/QuizView.tsx` also references ExplanationPanel (needs re-verification of exact import path)
- A separate `components/session/ExplanationPanel.tsx` exists

This means two different ExplanationPanel implementations may be serving different consumers. If a developer fixes a bug in one, the other consumer still has the bug.

**Root cause:** Component duplication during directory reorganization with import paths never unified.

**Fix:** Diff both ExplanationPanel files. Keep the more complete version. Update all importers to use the canonical path. Delete the duplicate.

---

### Finding 12-15: .claude/worktree Paths Pollute grep Results Across Entire Codebase
**Severity:** Low | **Type:** Developer experience | **Blocks production:** No

**Details:** Every `grep -rl` or code search returns 2–3× the expected results because `.claude/worktrees/` contains full copies of the codebase. This was observable throughout this entire audit — every import verification returned worktree matches alongside real matches.

**Root cause:** Stale worktrees (Finding 12-9) aren't excluded from default search paths.

**Impact:** Developers using `grep`, IDE "Find in Files", or similar tools get confused by phantom matches in worktree copies. Could lead to editing worktree files instead of real source.

**Fix:** Delete stale worktrees (Finding 12-9). Add `.claude/` to IDE exclude patterns (`.vscode/settings.json` → `search.exclude`). Ensure `.gitignore` covers `.claude/worktrees/`.

---

## Top 10 Findings by Impact

| Rank | Finding | Severity | What's at Risk |
|---|---|---|---|
| 1 | 12-5: 10+ duplicate service pairs | High | Bugs fixed in wrong file; stale logic served to users |
| 2 | 12-4: 8 duplicate component pairs | High | Wrong-file edits have zero effect; ExplanationPanel divergence |
| 3 | 12-6: 3 contentService copies (1 buggy) | Medium | Bug fix applied to wrong copy; content loading broken |
| 4 | 12-8: Build artifacts git-tracked | Medium | Repo bloat; gitignore mismatch (`backup` vs `backups`) |
| 5 | 12-1: 22 markdowns + 10 screenshots at root | Medium | Noisy root; permanent binary bloat in git history |
| 6 | 12-2: 320 docs files unorganized | Medium | Stale docs referenced as current; no discoverability |
| 7 | 12-3: 446 scripts, 52 diagnostics | Medium | Can't find production scripts; inflated repo size |
| 8 | 12-14: ExplanationPanel dual-import divergence | Medium | Silent bug divergence across consumers |
| 9 | 12-7: 957 @deprecated markers | Low | Deprecation signals meaningless at this volume |
| 10 | 12-9: 157 MB stale worktrees | Low | Grep pollution; wasted disk |

---

## 3 Highest-Leverage Fixes

### Fix 1: Consolidate Duplicate Services (Findings 12-5, 12-6)
**Effort:** 4 hours | **Impact:** Eliminates wrong-file-fix risk for the entire service layer

For each service duplicate:
1. Diff both copies to identify which has the latest logic
2. Update all importers to canonical path (`services/core/` for client, `lib/services/` for server)
3. Delete the dead copy
4. Fix the `Object.entries()` bug in the canonical `lib/api/contentService.ts`

**Critical path:** `questionService` — root copy still imported by `App.tsx` and `SessionContext.tsx`. Update these first.

### Fix 2: Delete Confirmed-Dead Components + Unify ExplanationPanel (Findings 12-4, 12-14)
**Effort:** 2 hours | **Impact:** Eliminates wrong-file-edit risk for component layer

1. Delete: `components/layout/DrillShell.tsx`, `components/quiz/AnswerFeedback.tsx`, `components/panels/BookmarksPanel.tsx`
2. Diff both ExplanationPanel files; keep the more complete version
3. Update all importers to the surviving ExplanationPanel path
4. Delete the duplicate

### Fix 3: gitignore Fix + Root Cleanup (Findings 12-1, 12-8, 12-13)
**Effort:** 1 hour | **Impact:** Clean root, correct gitignore, no more tracked artifacts

1. Add to `.gitignore`: `backup/`, `test-output.log`, `*.jpeg` (root), `query.ts`, `audit-queries.*`
2. `git rm --cached` on tracked artifacts
3. Move root `AUDIT_*.md` → `docs/audits/`, `SESSION_*.md` → `docs/sessions/`
4. Delete root screenshots or move to `docs/screenshots/`
5. Delete `query.ts`, `audit-queries.js`, `audit-queries.mjs`

---

## Safe Cleanup Immediately (No Verification Needed)

These files have **zero importers** or are confirmed non-functional. Delete without risk:

| File | Reason |
|---|---|
| `components/layout/DrillShell.tsx` | Zero production importers (only example file) |
| `components/quiz/AnswerFeedback.tsx` | Zero importers |
| `components/panels/BookmarksPanel.tsx` | Zero importers (library/ version is active) |
| `scripts/deprecated/` (16 files) | Already marked deprecated; exists as archive |
| `query.ts` (root) | Diagnostic script; not imported |
| `audit-queries.js` (root) | Diagnostic script; not imported |
| `audit-queries.mjs` (root) | Diagnostic script; not imported |
| `test-output.log` | Build artifact; not gitignored |
| `.claude/worktrees/` (157 MB) | Stale agent worktrees |
| Root `.jpeg` screenshots (10 files) | Audit artifacts; git-tracked binaries |
| `SESSION_*.md` (5 files at root) | Session artifacts; move or delete |
| 52 diagnostic scripts in `scripts/` | `test-*`, `check-*`, `verify-*`, `debug-*` one-offs |

**Estimated savings:** ~160 MB disk, ~80 files removed, dramatically cleaner root and scripts/ directory.

---

## Cleanup Only After Verification

These files **have importers or ambiguous status**. Verify before modifying:

| File | Why Verification Needed |
|---|---|
| `components/questions/ExplanationPanel.tsx` | Imported by `session/AnswerFeedback.tsx` — diff against session/ version first |
| `components/session/ExplanationPanel.tsx` | May be imported by QuizView — check exact import path |
| `services/questionService.ts` (root) | Imported by `App.tsx`, `SessionContext.tsx` — update consumers first |
| `services/ai/adaptiveFSRSService.ts` | Imported by orchestration test — verify if test should use domain/ version |
| `lib/services/content/contentService.ts` | Third contentService copy — verify zero importers before deleting |
| `lib/services/session/sessionService.ts` | Third sessionService copy — verify zero importers |
| `routes/` (19 files) | Local dev only — verify `dev:wrangler` fully replaces before considering deletion |
| Root `AUDIT_*.md` files (13) | Still referenced? Move to `docs/audits/` rather than delete |
| `plans/` (23 files) | Some may be in-progress — add status headers before archiving |
| Files with `@deprecated` markers (~300 unique) | Many still imported — remove tag or remove file per case |

---

## Minimal Safe Implementation Plan

### Day 1: Safe Deletions + gitignore (2 hours)
1. Delete all files from "Safe Cleanup Immediately" table
2. Fix `.gitignore`: add `backup/`, `test-output.log`, `*.jpeg` (root), `audit-queries.*`, `query.ts`, `.claude/worktrees/`
3. `git rm --cached` on any remaining tracked artifacts
4. Run `npm run typecheck` to confirm no import breakage
5. Commit: "chore: remove dead files, fix gitignore gaps"

### Day 2: Service Deduplication (4 hours)
1. `questionService`: diff root vs core/ copy → update `App.tsx`, `SessionContext.tsx` imports → delete root copy
2. `contentService`: fix `Object.entries()` bug in `lib/api/` copy → verify `lib/services/content/` has zero importers → delete third copy
3. `sessionService`: diff all 3 copies → consolidate to canonical path → delete duplicates
4. `adaptiveFSRSService`: update orchestration test import → delete `services/ai/` copy
5. Run full test suite after each service consolidation
6. Commit: "refactor: consolidate duplicate services to canonical paths"

### Day 3: Component Deduplication + Directory Organization (3 hours)
1. Consolidate ExplanationPanel: diff both versions, keep the more complete, update all importers
2. Move root markdowns: `AUDIT_*.md` → `docs/audits/`, `SESSION_*.md` → `docs/sessions/`
3. Organize `scripts/`: move diagnostics to `scripts/archive/`, add `scripts/README.md`
4. Add `plans/` status headers or archive completed plans
5. Add `components/ui/index.ts` barrel export for UI primitives
6. Run full test suite
7. Commit: "refactor: organize docs, scripts, and components"

---

## What to Audit Next

**Audit 13 — Performance, Bundle Size & Load-Time Profiling** should examine:
- Vite bundle analysis (tree-shaking effectiveness with 446 scripts and 320 docs in tree)
- Code-splitting configuration (are drill components lazy-loaded?)
- Framer Motion bundle impact (imported in nearly every component)
- TanStack Query cache configuration and stale time tuning
- API waterfall analysis (sequential vs parallel data fetching on dashboard load)
- Image optimization (10 root JPEGs, ECG images in public/images/)
- Lighthouse CI integration for regression detection

This would complement the hygiene cleanup by quantifying the performance cost of the accumulated bloat and identifying the highest-impact optimizations for user-facing load times.

---

*Report generated from automated file counts, import-graph verification, and git-tracked status analysis. All "zero importer" claims verified by `grep -rl` across the full source tree (excluding node_modules and .claude/worktrees).*
