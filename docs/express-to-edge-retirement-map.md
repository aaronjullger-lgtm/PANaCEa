# Express-to-Edge Retirement Map

**Date:** 2026-07-09
**Scope:** `server.ts`, the legacy `routes/**` Express layer, and the `dev:server` / `dev:all` /
`build:server` package scripts vs. the production Cloudflare Pages Functions under `functions/api/**`.

## 1. Current state (verified against code)

The migration is **effectively complete** — further along than the 2026-04-16 audit implies:

| Artifact | State (2026-07-09) | Evidence |
|---|---|---|
| `routes/**` Express layer | **Already retired** — moved to `_trash/old-routes/` | `routes/` does not exist; `find` for it returns nothing; `registerRoutes` exists only in `_trash/old-routes/index.ts`. |
| `server.ts` | **Broken / orphaned** | Line 38 `import { registerRoutes } from './routes'` resolves to a non-existent module. The file cannot run. |
| `dev:server`, `dev:all`, `build:server` | **Dead** | All depend on `server.ts`, which fails to import `./routes`. |
| Production API | ✅ Cloudflare Pages Functions | `functions/api/**` (557+ endpoints), the sole production path. |
| Working local dev | ✅ `npm run dev` (Vite) + `npm run dev:wrangler` (production-like CF Functions) | `package.json` scripts. |

**Conclusion:** the split-brain is already resolved in production terms. What remains is *dead
legacy scaffolding* (`server.ts` + 3 scripts) that still advertises an Express backend which no
longer exists.

## 2. Classification

| Item | Classification | Action |
|---|---|---|
| `_trash/old-routes/**` | Dead / already retired | None (already trashed). |
| `server.ts` | Dead / broken import | **Recommend removal** — Ask First (dev-workflow change). |
| `dev:server`, `dev:all`, `build:server` scripts | Dead (depend on broken `server.ts`) | **Recommend removal** — Ask First. |
| `functions/api/**` | Production canon | Keep. |

## 3. Why this run does NOT delete `server.ts` / the scripts

Per `CLAUDE.md`, changes to developer workflow / architecture are **Ask First**. Removing `server.ts`
and the `dev:server`/`dev:all`/`build:server` scripts:
- changes the documented local-dev story (`CLAUDE.md` lists `npm run dev:all`, and `LOCAL_DEVELOPMENT.md`
  may reference it), and
- although the code is already broken, deletion is a one-way workflow decision.

So it is documented here + in `docs/cursor-followup-issues.md` as a recommended follow-up, not executed.

## 4. Recommended follow-up (Ask First)

1. Delete `server.ts`.
2. Remove `dev:server`, `dev:all`, `build:server` from `package.json`.
3. Update `CLAUDE.md` and `LOCAL_DEVELOPMENT.md` to make `npm run dev` + `npm run dev:wrangler` the
   canonical local-dev commands.
4. Optionally delete `_trash/old-routes/` once confident nothing references it.
5. Prune now-unused Express-only deps (`express`, `cors`, `helmet`, `express-rate-limit`, `@types/express`,
   `@types/cors`) **only after** confirming no other consumer — a separate dependency-hygiene PR.

**Risk if left as-is:** low functional risk (the code is already unrunnable), but ongoing confusion —
docs imply an Express backend that does not exist. **Rollback:** trivial (revert the deletion PR).
