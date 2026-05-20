# Visual Completion Issues

Last updated: 2026-05-19

## Fixed During Completion QA

- Review route rendered an old flashcard/error state through `/study?mode=review`.
  - Fix: added `/study/review` as a proper review workspace and updated primary navigation/actions.
- Dashboard DOM included an unrelated private-beta placeholder below the main dashboard.
  - Fix: constrained `DrillViewRouter` to only render view IDs it owns.
- Clinical Images nav target rendered a private-beta placeholder even though the primary nav advertised it.
  - Fix: removed `/clinical-eye` from private-beta route hiding so the existing Clinical Eye page renders.
- Toolkit calculator cards contained nested button markup.
  - Fix: converted card containers to keyboard-activatable card controls and kept the pin button separate.
- Study Plan, Clinical Profile, and Weak Areas looked placeholder-like in guest/API-failure QA.
  - Fix: added guest-safe route previews with real clinical planning/profile/gap-analysis structure and explicit live-data status messaging.
- Knowledge showed guest-mode unavailable/status noise when the live clinical library mounted without authenticated backend data.
  - Fix: added guest-safe Knowledge Atlas previews and kept the live library path for authenticated sessions.
- Guest-mode Vite QA produced avoidable API/status noise from global health polling, DB preloads, clinical-profile fetches, and external database health checks.
  - Fix: skipped those calls in guest visual mode and made external health checks lazy/opt-in.
- Top-level guest/status banners were partially covered by the fixed desktop nav rail.
  - Fix: offset top-level banners by the desktop nav rail width.
- Settings/profile modal rendered underneath app chrome in the nav route screenshot.
  - Fix: raised the modal overlay stack, widened the control-center surface, and aligned modal chrome with the dark clinical shell.

## Final Visual QA Findings

- All required desktop-width screenshots were generated into `docs/ui-redesign/screenshots/final/`.
- No final captures have document-level horizontal overflow.
- No final captures show a sign-in gate or private-beta gate.
- No final captures report alert/status-role banners, console errors, or bad HTTP responses.
- The shell, nav rail, Review page, Clinical Eye page, Practice page, Progress page, Knowledge page, Study Plan page, Weak Areas page, Clinical Profile page, Resources page, Medical Database page, and Settings/Profile modal all render in local guest mode.

## Residual Visual Limitations

- The lane selector on `/study/utilities` intentionally clips overflow inside its own horizontal strip at narrow desktop width. The page itself does not overflow horizontally.
- Authenticated saved-progress, answer-submission, and Clerk user-menu states still require the dedicated authenticated QA path documented in `AUTH_QA_LIMITATION.md`.
