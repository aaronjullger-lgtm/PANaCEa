# PANaCEa Study Modes Functionality Audit

Status: initial and specialist-pass consolidation, updated 2026-05-01 18:59 EDT.

## Summary

Study-mode readiness grade: **62/100, D/no-launch**.

The current launch candidates are `core_adaptive` and the newly mounted `system_drill` slice. Both use the same CoreAdaptiveSession/QuizView review pipeline; `system_drill` is intentionally narrow and targets a selected organ system through `mode: "targeted"` / `focus: "topic"`. Many other modes have registry entries, route definitions, or older UI components, but are intentionally or effectively blocked by `productionDeferred`, private beta gates, missing mounted components, or incomplete backend/data contracts. The release strategy should keep those hidden until each mode has a real mounted slice, canonical session settings, canonical submit behavior, persistence, progress/FSRS rules, empty/error states, and tests.

## Readiness Evidence

- `config/lazyComponents.tsx` maps many modes to `productionDeferred`.
- `lib/modes/modeReadiness.ts` marks `core_adaptive` and `system_drill` as `REAL_MOUNTED_MODE_IDS`.
- `lib/modes/privateBetaVisibility.ts` now derives visibility from `isModeDiscoverable`, which hides deferred modes.
- `pages/PracticePage.tsx` recommendations are filtered through `isPrivateBetaModeVisible`; `system_drill` can now surface because it is real-mounted, while deferred modes stay hidden.
- `components/layout/DrillViewRouter.tsx` blocks invisible modes with an unavailable state.
- `components/session/CoreAdaptiveSession.tsx` uses `/api/study/session/generate`; its QuizView settings now derive focus/systems from the selected or plan launch scope instead of a blanket due-focus.
- Daily Challenges is route-gated because its underlying challenge modes are not ready.
- Real protected admin/clinical/evidence/utility pages are mounted where backing components exist, but study-mode discoverability still depends on `modeReadiness`.

## Study Mode Readiness Table

| Study Mode | UI Exists | Backend Exists | Data Persists | FSRS/Progress Updates | Tests Exist | Production Ready | Blockers |
|---|---|---|---|---|---|---|---|
| `core_adaptive` | Yes | Yes, `/api/study/*`, `/api/drills/submit-review` | Partial | Yes via drillReviewService | Yes | Partial | Identity/condition FK and production runtime smoke. |
| PANCE main | Yes via core adaptive | Yes | Partial | READINESS path | Partial | Partial | Launch/task linkage improved; needs canonical plan/dashboard truth. |
| EOR / rotation | Partial via core adaptive | Partial | Partial | EOR clamp exists, urgency not threaded on submit | Partial | No | Urgency multiplier not applied; planner context incomplete. |
| Didactic exam | Structural only | Partial blueprint support | Partial | Unproven | Minimal | No | Needs course/exam scoped planning, language, and routing tests. |
| PANRE / maintenance | Structural only | Partial blueprint support | Partial | Unproven | Minimal | No | Needs calm maintenance cadence and distinct planner/session profile. |
| `system_drill` | Yes via `StudyModeAdaptiveSession` | Yes, shared `/api/study/session/generate` + submit-review | Partial | TARGETED via shared CoreAdaptiveSession/QuizView path | Yes | Partial | Needs browser smoke and canonical identity migration; deliberately narrow system-scope launch. |
| `condition_drill` | Registry/deferred | Partial | Unproven | Should be TARGETED/DRILL | Minimal | No | Deferred; condition identity not canonical. |
| `subcategory_drill` | Registry/deferred | Partial | Unproven | Unproven | Minimal | No | Deferred; route/data contract incomplete. |
| `pharmacology` | Registry/deferred | Partial drug APIs | Unproven | Unproven | Some API tests | No | Deferred; visible recommendation risk. |
| `first_line_treatment` | Registry/deferred | Partial | Unproven | Unproven | Minimal | No | Deferred. |
| `rapid_recall` | Registry/deferred | Partial `/api/srs/due` compatibility route now reads canonical progress | Legacy UI contract | Attempt-only intended | Partial | No | Deferred UI and mode contract still need real attempt-only implementation. |
| `cram_mode` | Registry/deferred | Partial | Attempt-only intended | No FSRS intended | Minimal | No | Deferred; ensure no FSRS contamination. |
| `mini_lab` | Registry/deferred | Partial labs APIs | Unproven | Unproven | Some hook/API tests | No | Deferred and sample mode risk. |
| `contrastive_drill` | Registry/deferred | Partial | Unproven | Unproven | Minimal | No | Deferred; confusion-pair pipeline incomplete. |
| `photo_drill` | Deferred | Partial media APIs | Partial | Submit-review path possible | Hook tests | No | Media inventory, hidden; prior dummy fallback fixed but not production-ready. |
| ECG/Derm/Imaging drills | Deferred/route entries | Partial media/reference | Partial | Unproven | E2E specs exist | No | Media inventory and route readiness not proven. |
| OSCE/patient encounter | Deferred | Mock/gated endpoints | Partial schema | Isolated | Some tests | No | Deterministic mocks, DO split, schema drift. |
| PANCE simulator/full sit-down | Deferred | Legacy exam endpoints gated | Partial | Separate | Some tests | No | Feature-gated, not launch surface. |
| Collaboration/social | Hidden/mock | Missing `/api/social/*` | No | No | No | No | Mock UI and missing API. |

## Study Mode Blockers

| Severity | Finding | Evidence | Fix | Verification |
|---|---|---|---|---|
| P1 | Deferred modes remain close to production navigation. | `config/lazyComponents.tsx`, `pages/PracticePage.tsx`, `config/routeRegistry.ts` | Apply `modeReadiness` to every visible mode card, recommendation, shortcut, command, and CTA. | Route registry and PracticePage visibility tests. |
| P1 | Practice recommendations can surface `system_drill` and `pharmacology`. | `pages/PracticePage.tsx` recommended IDs and filters | Add `isPrivateBetaModeVisible` filter and tests. | Component/unit test. |
| P1 | CoreAdaptiveSession passes broad `focus: 'due'` into all sessions. | `components/session/CoreAdaptiveSession.tsx` | Fixed for active session launches: settings are derived from launch scope, source, task ID, plan date, and explicit launch settings. | `components/session/CoreAdaptiveSession.test.ts`. |
| P1 | Drill/EOR urgency does not reach FSRS submit. | `functions/api/drills/submit-review.ts` passed undefined | Fixed: schema/context propagation now carries `urgency_multiplier` from session settings through sync queue and single/batch submit endpoints. | Submit route and batch route tests. |
| P1 | Study-plan tasks lose condition IDs. | `_shared/studyPlanService.ts` | Improved: condition/review IDs are preserved in the current normalized task shape; full V2 consolidation remains. | Study-plan V2 tests. |

## Recommended Enablement Order

1. `core_adaptive`: harden canonical launch, identity, review submit, and plan completion.
2. `condition_drill`: use the same QuizView/CoreAdaptive runner with explicit `sessionSettings.mode = 'drill'` and TARGETED context.
3. `system_drill`: same runner, system filter, TARGETED context.
4. `pharmacology`: only after drug/question source and progress mapping are proven.
5. `mini_lab`: only after lab payloads, scoring, explanation, and persistence are canonical.

## Acceptance Criteria Per Mode

- Discoverable only if `modeReadiness.discoverable === true`.
- Real mounted component, not `productionDeferred`.
- Launch route exists and is registered.
- Session generation source is canonical.
- Attempt submission persists through `/api/drills/submit-review` or an explicit non-FSRS attempt-only contract.
- Progress context is explicit.
- Loading, empty, error, stale, and partial failure states exist.
- Tests cover routing, session generation, submission, explanation, progress, and hidden/deferred states.
