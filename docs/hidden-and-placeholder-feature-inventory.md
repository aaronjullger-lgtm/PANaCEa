# Hidden & Placeholder Feature Inventory

**Date:** 2026-07-09
**Purpose:** classify surfaces that *imply* a feature exists but are scaffold-only, hidden,
experimental, or placeholder — so misleading entrypoints are separated from real, shippable features.

Categories: **production-ready** · **admin-only** · **experimental-hidden** · **scaffold-only** ·
**remove-candidate**.

## 1. Inventory

| Surface | Category | Verified state | User-reachable? | Misleading? |
|---|---|---|---|---|
| Study groups / social (`services/domain/studyGroupService.ts`, `components/social/StudyGroupDashboard.tsx`) | **scaffold-only** | Service header: "STATUS: NOT YET IMPLEMENTED — no backend API endpoints exist." `functions/api/social/` does **not** exist. `config/lazyComponents.tsx:109` = "StudyGroupDashboard removed — social API not implemented" (unmounted). Still exported from `components/social/index.ts`. | **No** (not routed/mounted) | Low — not reachable by users. |
| `functions/api/admin/library-enrichment-logs.ts.disabled` | **admin-only / disabled** | `.disabled` (not deployed). `LibraryEnrichmentDashboard` expects it. | No | Low. |
| `functions/api/admin/library-enrichment-priority.ts.disabled` | **admin-only / disabled** | `.disabled` (not deployed). | No | Low. |
| `components/admin/LibraryEnrichmentDashboard.tsx` | **admin-only** | Dashboard exists; depends on the two `.disabled` endpoints. | Admin only | Medium (dashboard opens endpoints that are off). |
| `functions/api/spark/instant-calc.ts` | **experimental-hidden / placeholder** | Returns **501** when `SPARK_API_KEY` unset; otherwise serves **placeholder HTML** ("Instant Calc (Spark) not yet wired"). | If wired to UI | Honest (501/placeholder text is explicit). |
| `functions/api/smart-scribe/generate-infographic.ts` | **experimental-hidden / placeholder** | Returns a **placeholder infographic** (`/placeholder-infographic.svg`) on fallback; comment "This is a placeholder". | If wired to UI | Honest fallback. |
| `components/modes/osce/OSCEResultsView.tsx` | **remove-candidate** | Its only app render site (a dead branch in `PatientEncounterMode`) was removed this run; now referenced only by the `osce/index.ts` barrel. | No | None (dead). |

## 2. What was safe to change this run

- The dead `OSCEResultsView` render branch in `PatientEncounterMode` was removed (see the stabilization
  final report). `OSCEResultsView.tsx` itself is left as a documented **remove-candidate** (deleting a
  component file is Ask-First; the barrel still exports it harmlessly).
- No other surface was actively misleading users: study groups are **unmounted**, and the placeholder
  AI endpoints fail **honestly** (501 / explicit placeholder text). So no forced code change was needed
  to stop deception.

## 3. Recommendations (approval-gated)

| Item | Decision needed | Recommendation |
|---|---|---|
| Study groups / social | **Product: build or freeze** | If not near-term: delete/freeze `components/social/StudyGroupDashboard.tsx` + `services/domain/studyGroupService.ts` (or clearly mark experimental) so the scaffold stops implying a shipped feature. If near-term: build `functions/api/social/*` first. **Do not** build the backend without approval. |
| `library-enrichment-*.ts.disabled` | **Data-source decision** | Decide whether logs/priority come from files, a DB table, or an admin API; then re-enable or delete. Until then, hide the `LibraryEnrichmentDashboard` entrypoint from non-admins if it surfaces broken calls. |
| `spark/instant-calc`, `smart-scribe/generate-infographic` | **Roadmap decision** | Per audit §10: defer unless roadmap activates. If not on the roadmap, mark clearly experimental / hide the entrypoints. Do not add provider integrations (paid API) without approval. |
| `OSCEResultsView.tsx` | **Cleanup** | Delete once confirmed no dynamic import references it (Ask-First for file deletion). |

**Principle applied:** prefer hiding / documenting / removing misleading entrypoints over faking
completeness. No placeholder behavior was added; large features (study groups) are **not** built without
approval.
