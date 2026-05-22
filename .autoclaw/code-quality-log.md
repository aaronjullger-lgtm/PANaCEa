# .autoclaw/code-quality-log.md — Maintainability Tracking

## High-Risk Areas
- `components/session/QuizView.tsx` (2045 lines) — largest component, needs decomposition
- `lib/services/drillReviewService.ts` (1620 lines) — core pipeline, high complexity
- `components/drill/PatientEncounterMode.tsx` (3488 lines) — largest file in repo
- QuizView refactor branch: 192 TS errors, parked

## Refactor Candidates
1. QuizView → extract into smaller hooks/components
2. PatientEncounterMode → decompose by drill type
3. DrillShell vs useDrillFSRS → consolidate routing
4. 238 hardcoded hex values → CSS variables
5. 1063 inline styles → Tailwind classes

## Duplication Risk
- Multiple drill components may share patterns — audit for shared hooks
- API endpoint wrappers may duplicate auth/error handling — use shared middleware

## Confusing Modules
- Drill routing split (DrillShell vs useDrillFSRS) — unclear which handles what
- Legacy `/api/srs/*` routes exist as compatibility adapters only
- Express routes in `routes/` are local-dev only, never deployed

## Code Health Commands
```bash
npm run typecheck    # Verify type safety
npm run lint         # Check code style
npm run build        # Verify production build
```
