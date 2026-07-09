# Source Identity & Concept Identity Migration Proposal

**Date:** 2026-07-09
**Blocker (deep-research 2026-05-22):** "#1 blocker cited across 4 categories — no canonical source
identity or concept identity migration/backfill." (Database 73/100; also Progress/Weakness 75,
Study Sessions 81, Question Generation 81.)

## 1. Verified current state

Identity primitives are **partially modeled**, not yet unified/backfilled:

| Piece | State | Evidence |
|---|---|---|
| `SourceMaterial` model | ✅ Exists | `prisma/schema.prisma:1598`. |
| `originalSourceId` on some models | ✅ Present | `schema.prisma:1669`. |
| Generic `(sourceType, sourceId)` unique key | ✅ Present | `schema.prisma:4385-4397`. |
| `ConceptGap.sourceId` | ✅ Present | `schema.prisma:534-539`. |
| Concept identity in services | ✅ Used (`conceptId`) | `drillReviewService.ts`, `semanticConfusionService.ts`, `prerequisiteRemediationService.ts`. |
| **Canonical source-identity / concept-identity across the schema** | ⚠️ **Not unified** | No single canonical `conceptId`/`sourceId` FK spine; identifiers are per-model and partly free-text. |
| Migration/backfill to canonical IDs | ❌ Not done | The blocker. |

## 2. Why it's the #1 blocker

The FSRS scheduler, weakness tracking, and analytics key off concept/source identifiers. Without a
**stable canonical identity spine**, scheduling operates on potentially unstable identifiers
(free-text or per-model IDs), which threatens cross-surface joins (a question, its condition, its
concept, its source material) and longitudinal analytics.

## 3. Proposed direction (for approval — schema + data)

1. **Define canonical identities:** a `Concept` spine (stable `conceptId`) and a `Source` spine
   (stable `sourceId`) as first-class models with FKs, deprecating free-text identifiers.
2. **Add FKs incrementally:** attach `conceptId`/`sourceId` FKs to `Question`, `ReviewLog`,
   `UserProgress`, `ConfusionPair`, weakness/gap models — additive, nullable-first.
3. **Backfill:** map existing free-text/per-model identifiers onto the canonical spine on a DB copy;
   verify orphan counts = 0 before enforcing NOT NULL / FKs (mirror the `prisma/audit/` orphan-probe
   discipline already used in `CLAUDE.md`).
4. **Cutover:** switch reads to canonical IDs behind a flag; keep the old columns until parity proven.

## 4. Safe preparatory work (no approval)

- **Identity audit script (read-only):** enumerate every place a concept/source identifier is stored,
  its type (FK vs free-text), and orphan/mismatch counts. (`scripts/db/audit-learning-identity.ts`
  already exists — extend/run it in read-only mode and record findings.)
- **Contract doc:** define the target `Concept`/`Source` model shapes + the FK map (this doc is the start).
- **Join-integrity report:** count rows where question→condition→concept→source joins currently break.

## 5. Approval gates

- Any schema migration, FK addition, or data backfill = **Ask First** (schema + production data).
- Backfill must run on a copy first with orphan probes = 0 before touching production.
- Do not change FSRS scheduling keys until parity is proven by tests. **Do not** migrate production data
  without explicit approval.
