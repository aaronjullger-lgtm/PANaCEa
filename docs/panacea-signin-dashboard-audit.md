# PANaCEa Sign-In Dashboard Audit

Date: 2026-04-26

## Active Wiring

- The signed-in `/study` route resolves to the `command_center` view in `config/AppRoutes.tsx`.
- The active signed-in home surface is `components/navigation/command-center/CommandCenterWorkspace.tsx`.
- `components/dashboard/DashboardPage.tsx` is legacy/unused for the current `/study` entrypoint and should not be the redesign target for this sprint.

## Current Risks

- The previous home surface exposed several competing starts: due review, adaptive session, practice, recommendations, companion tools, launch lanes, gap analysis, clinical profile, and rotation settings.
- The visual hierarchy read like a command-center dashboard rather than a single personalized clinical briefing.
- Deeper surfaces such as recommendations, tool grids, progress routes, and clinical profile links competed with the intended first action.
- Shell styling leaned on glass-heavy chrome and decorative radial backgrounds, which added visual activity before the student reached the actual study decision.

## Confidence UI Risk

- Manual confidence controls must not be introduced anywhere in the sign-in dashboard.
- Existing implicit confidence/calibration services can remain because they are behavioral analysis infrastructure.
- Dashboard copy should avoid student-facing phrases such as confidence rating, confidence selector, confidence slider, or how confident are you.
- Existing manual confidence-related components outside this sprint remain a separate cleanup risk, especially `components/quiz/ConfidenceCalibration.tsx`.

## Implementation Target

- Replace the `/study` default view with a four-zone clinical briefing:
  - Start Here
  - Tonight's Plan
  - Quiet Signals
  - Details When Needed
- Keep analytics available through Progress/Study Path rather than exposing dense analytics on sign-in.
