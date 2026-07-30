# Route Consistency Audit

Last updated: 2026-05-19

## Routes QA'd

Final screenshots and metadata were generated for these routes:

- `/study`
- `/study/review`
- `/practice`
- `/study/path`
- `/study/knowledge`
- `/study/utilities`
- `/clinical-profile`
- `/gap-analysis`
- `/clinical-eye`
- `/progress`
- `/medical-database`
- `/study?modal=settings`

Viewports:

- `1280x800`
- `1440x900`
- `1512x982`
- `1728x1117`
- `1920x1080`

Artifacts:

- Screenshots: `docs/ui-redesign/screenshots/final/`
- Metadata: `docs/ui-redesign/screenshots/final/qa-results.json`

## Routing Fixes

- Added `ROUTES.STUDY_REVIEW = '/study/review'`.
- Added `/study/review` to `ROUTE_REGISTRY`.
- Added lazy `ReviewPage` import and React Router route in `config/AppRoutes.tsx`.
- Updated nav rail Review item from `/study?mode=review` to `ROUTES.STUDY_REVIEW`.
- Updated dashboard and progress Review actions to use `ROUTES.STUDY_REVIEW`.
- Preserved legacy `/study?mode=review` behavior for internal session-launch compatibility.
- Hardened guest-mode fallback rendering for `/study/path`, `/clinical-profile`, and `/gap-analysis` so API/auth misses no longer collapse into abandoned empty-state pages.
- Renamed the `/clinical-profile` nav item from "Clinical Cases" to "Clinical Profile" so the rail label matches the rendered route.
- Added guest-safe Knowledge Atlas lane previews so `/study/knowledge` remains visually complete without authenticated reference-library calls.
- Prevented guest-mode visual QA from firing global DB preloads, clinical-profile API fetches, or external database health checks on mount.
- Offset guest/incident banners on desktop so the fixed nav rail does not cover top-level status text.
- Verified the nav Settings target `/study?modal=settings` as part of the final screenshot matrix and fixed modal layering above the shell.

## Consistency Results

- Final screenshot metadata reports `60` route/viewport captures.
- `overflowX`: none.
- `hasPrivateBetaGate`: none.
- `authWall`: none.
- `alerts`: none.
- `consoleErrorCaptures`: none.
- `badResponseCaptures`: none.
- `hasVisibleMain`: true across the final matrix.
- `/clinical-eye` now renders the actual Clinical Eye workspace instead of a private-beta placeholder.
- `/study?modal=settings` renders the settings/profile control-center modal without shell overlap or document-level overflow.
- `/study/knowledge` now renders a guest-safe clinical atlas preview in local guest mode instead of an auth-required content alert.

## Known Route Notes

- `/study/utilities` reports right-edge card positions inside a horizontally clipped lane selector at `1280x800`, but the document width equals the viewport width and `overflowX` is false. This is an internal carousel/strip behavior, not document-level horizontal page overflow.
