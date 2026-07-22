# AI Service Consolidation Plan

**Goal:** Merge 4 AI directories (14 files, 5,016 lines) into `functions/api/ai/` with clear sub-routes.

## Current State

```
functions/api/
├── ai/                          (1 file, 151 lines)
│   └── generate-mnemonic.ts
├── gemini/                      (2 files, 685 lines)
│   ├── index.ts                 — health check + model listing
│   └── stream.ts                — streaming chat completions
├── intelligence/                (8 files, 3,630 lines)
│   ├── analyze-session.ts       (873 lines) — session analysis + insights
│   ├── concept-gaps.ts          (592 lines) — prerequisite gap detection
│   ├── learning-profile.ts      (495 lines) — learner profile generation
│   ├── pance-readiness.ts       (286 lines) — PANCE readiness score
│   ├── prerequisite-remediation.ts (339 lines) — remediation suggestions
│   ├── profile.ts               (439 lines) — profile CRUD
│   ├── socratic-remediation.ts  (123 lines) — Socratic questioning
│   └── tutor.ts                 (488 lines) — AI tutor chat
└── vision/                      (3 files, 545 lines)
    ├── analyze-3d.ts            — 3D anatomy analysis
    ├── analyze.ts               — image analysis
    └── grade-spatial.ts         — spatial reasoning grading
```

## Target State

```
functions/api/ai/
├── chat/
│   └── stream.ts                ← from gemini/stream.ts
├── models/
│   └── index.ts                 ← from gemini/index.ts (model listing)
├── mnemonics/
│   └── generate.ts              ← from ai/generate-mnemonic.ts
├── sessions/
│   └── analyze.ts               ← from intelligence/analyze-session.ts
├── learning/
│   ├── concept-gaps.ts          ← from intelligence/concept-gaps.ts
│   ├── profile.ts               ← from intelligence/profile.ts + learning-profile.ts (merge?)
│   ├── pance-readiness.ts       ← from intelligence/pance-readiness.ts
│   ├── prerequisites.ts         ← from intelligence/prerequisite-remediation.ts
│   └── socratic.ts              ← from intelligence/socratic-remediation.ts
├── tutor/
│   └── chat.ts                  ← from intelligence/tutor.ts
└── vision/
    ├── analyze.ts               ← from vision/analyze.ts
    ├── analyze-3d.ts            ← from vision/analyze-3d.ts
    └── grade-spatial.ts         ← from vision/grade-spatial.ts
```

## Migration Steps

### Phase 1: Create target dirs + move files (pure renames)
- Move `vision/*` → `ai/vision/*`
- Move `ai/generate-mnemonic.ts` → `ai/mnemonics/generate.ts`
- Move `gemini/stream.ts` → `ai/chat/stream.ts`
- Move `gemini/index.ts` → `ai/models/index.ts`
- Move `intelligence/*` → `ai/learning/*` (and `ai/tutor/chat.ts`)
- Update all internal imports

### Phase 2: Update Hono routes
- Update `functions/_middleware.ts` or route registry
- Ensure all `/api/gemini/*`, `/api/intelligence/*`, `/api/vision/*` paths still work (redirect or alias)

### Phase 3: Update frontend API calls
- Search for `/api/gemini/`, `/api/intelligence/`, `/api/vision/` in all components
- Replace with `/api/ai/chat/`, `/api/ai/learning/`, `/api/ai/vision/`

### Phase 4: Verify + clean up
- Run full test suite
- Remove empty directories
- Update CLAUDE.md documentation

## Risk Assessment
- **Low risk:** Pure file moves with import updates
- **Medium risk:** Route path changes (need frontend updates)
- **High risk:** Merging profile.ts + learning-profile.ts (overlapping concerns)

## Estimated Effort
- Phase 1: 2hr (mechanical file moves + import fixes)
- Phase 2: 30min (route updates)
- Phase 3: 1hr (frontend API call updates)
- Phase 4: 30min (verification + cleanup)
- **Total: ~4hr**
