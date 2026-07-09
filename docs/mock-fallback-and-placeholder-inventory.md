# Mock / Fallback / Placeholder Inventory (Phase 5)

**Rule:** classify each surface; flag anything *misleading* (unlabeled fake data presented as real). Prefer labeling/hiding over faking. Verified against current code.

## Legend
- ✅ **Labeled fallback** — uses mock only when real data absent, and tells the user.
- 🟡 **Scaffold / partial** — real code, not fully wired; not user-misleading.
- 🧪 **Experimental / placeholder** — clearly marked; behind a default-off path.
- ⛔ **Misleading** — fake data shown as real (none found).

| Surface | File(s) | Class | Evidence / note |
|---|---|---|---|
| Readiness vitals | `.../command-center/ReadinessVitalsWidget.tsx` + `page/commandCenterMockData.ts` | ✅ | per-metric `source`; visible `mock` badge; real analytics when available. |
| PANCE readiness timeline | `.../command-center/PanceReadinessTimelineWidget.tsx` | ✅ | "mock readiness" badge + explanatory note; falls back only when `!readiness.available`. |
| Today study prescription | `.../command-center/TodayStudyPrescriptionWidget.tsx` | ✅/🟡 | real logic with fallback path; owner-tracked persistence gap. |
| FSRS v7-alpha | `lib/fsrs-v7.ts`, `lib/fsrs-version-selector.ts` | 🧪 | `forgettingCurve: 'placeholder'`; **v6 is default**, no implicit migration. |
| Adaptive question selection | (no standalone service) | 🟡 | selection via `/api/srs/due` + `study/session/generate`; see `docs/api/API_OVERVIEW.md` for due-queue contract. |
| Progressive difficulty | `lib/services/progressiveDifficultyService.ts` | 🟡 | present; not fully wired into quiz flow. |
| Rotation profile / PANRE | `lib/fsrs/eorScheduler.ts`, config | 🟡 | EOR present; no `RotationProfileService`; PANRE strategic/absent. |
| AI tutor / GraphRAG live wiring | `components/.../AITutorDrawer.tsx`, `lib/services/search/graphRag.ts` | 🟡 | UI + services real; live calls need `GEMINI_API_KEY`/DB (infra-gated). |
| Lab cases / disabled drills (#75/#76/#77) | drill components + content scripts | 🟡 | content generation WIP; owner issues; gated on AI/DB. |
| `medicalComplianceService.scheduleReview` | `services/medicalComplianceService.ts` | 🟡 | explicit stub ("real implementation would persist…"); not user-facing; commented (Phase 1 lint fix). |
| `nccpa-question-weighting.exampleUsage` | `lib/nccpa-question-weighting.ts` | 🟡 | demo function; commented (Phase 1 lint fix). |
| Legacy Express `server.ts` + `_trash/old-routes/*` | `server.ts`, `_trash/` | 🟡 | dev-only, not deployed; retire per `deployment/README.md`. |

## Conclusion
- **⛔ Misleading surfaces found: 0.** The highest-risk dashboards label their mock/calibration state transparently.
- Remaining incompleteness is honest scaffold/experimental/WIP or infra-gated — **no code change made** (fixing would require new features and/or live secrets, both out of scope/gated).
- Recommendation for the owner: keep the "mock" labeling pattern as the standard for all future calibration-state widgets; complete adaptive-selection/progressive-difficulty wiring as a scoped follow-up PR.
