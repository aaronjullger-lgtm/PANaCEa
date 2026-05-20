# Lint Warning Triage

Last updated: 2026-05-19

## Command

```bash
npm run lint
```

## Result

- Exit code: `0`
- Problems: `270`
- Errors: `0`
- Warnings: `270`
- Potentially fixable warnings: `15`

The repo lint command is configured as:

```bash
eslint . --max-warnings 2000
```

## Warning Pattern

Most warnings are `no-restricted-syntax` warnings for raw hex colors outside `lib/tokens/`.

Common affected areas:

- dashboard surfaces
- clinical profile and gap analysis
- reference/library components
- toolkit and route pages
- pre-existing type/demo files with color maps

## Related To This UI Redesign

This branch improves the shared token layer and workspace primitives, and this continuation removed raw-hex warnings from the Knowledge, Clinical Profile, and Gap Analysis active route surfaces. It does not fully migrate every pre-existing route and legacy feature file to semantic tokens.

Notable active route warnings still include:

- `pages/ClinicalEyePage.tsx`
- `pages/PracticePage.tsx`
- `components/dashboard/StudyPathDashboard/index.tsx`
- `pages/MedicalDatabaseWorkspacePage.tsx`
- `components/modals/SettingsStatsModal.tsx`

## Recommendation

Do not block this UI redesign on all `270` existing warnings because the configured lint command passes. Schedule a focused token cleanup pass for the remaining active signed-in route pages, then lower `--max-warnings` once the remaining warning count is materially reduced.
