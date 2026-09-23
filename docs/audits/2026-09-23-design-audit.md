# PANaCEa design and usability audit

Date: 2026-09-23. Baseline: `08d103d90b243680f7074d03ff437fb0ca6165f4`.
Site: https://studypanacea.com. Branch: `design/site-usability-audit`.

## Decision

Refine the existing clinical identity around one clear next action. Keep graphite, ice-blue text, cyan actions, and the scanner, but give the message breathing room. Replace the moving training-card grid with stable mode selection. Show missing analytics honestly. Extend the same accessibility improvements to shared dialogs and question content.

This is a source-backed audit plus a desktop review of the live homepage and its interactive dashboard preview. It is **not** a completed visual acceptance review of the changed branch or a WCAG conformance certification. Authenticated pages were reviewed in source, not through a signed-in student account. The app has hundreds of components; the review targeted the entry, study-navigation, dashboard, question, and shared-dialog paths rather than claiming exhaustive coverage of every drill/admin screen.

## Findings and disposition

Severity: P1 = material usability, accessibility, or trust problem; P2 = friction or maintainability; P3 = polish. The focused review identified 16 findings (8 P1, 8 P2), addressed in this branch. No verified P0 blocker in the inspected paths. A whole-site numeric accessibility/health score is withheld because authenticated flows and the changed responsive layouts have not been browser-validated.

| Priority | Finding and evidence at baseline | User impact | Change / disposition |
|---|---|---|---|
| P1 | `LandingPage.tsx`: full navigation starts at `lg`, but the menu button and menu stop at `sm`. | At 640–1023px, section links are unavailable. | Unified full-navigation/menu switch at `xl`; tablet gets the menu. Header actions start at `md`, with smaller-screen actions inside the menu. |
| P1 | `TrainingModesDock.tsx`: `onMouseEnter` changes selection, active tile spans two columns, and active-only content changes its height. | Targets move beneath a pointer; reading and selecting require continuous reorientation. | Stable compact selector and adjacent details panel. Hover only changes styling; selection requires click or keyboard focus. |
| P1 | All nine training tabs are tab stops; no Home/End behavior; descriptions are included in oversized accessible labels. | Long, repetitive keyboard/screen-reader navigation. | One roving tab stop, orientation-aware arrows, wrapping, Home/End, a focusable panel, concise names, and explicit tab/panel associations. |
| P1 | `ReadinessVitalsWidget.tsx` falls back to invented numeric values and trends, including an optimistic readiness status; a small `mock` badge is the only visible qualification. | A student may mistake illustrative progress for their own measured readiness. | Missing metrics display an em dash and “Not enough data.” Hide synthetic context, trend, progress, and optimistic color; accessible descriptions explain the absence of data. Real measurements remain unchanged. |
| P1 | Real dashboard metrics inherit sample sparklines from `metricWithFallback`; pace inherits a sample progress value when plan completion is absent. | A real value can be paired with a fictional trend or progress bar. | Clear inherited sparklines, accept readiness trends only with actual available data, omit unknown pace progress. A real zero is now shown as zero instead of a minimum 6% bar. |
| P1 | `HeroCanvas.tsx`: initial render and every ResizeObserver callback start an animation chain; only the most recent ID is canceled. | Resizing can multiply work and leave animation callbacks running after unmount. | Exactly one animation chain, complete cleanup, resize-only geometry measurement, viewport and document-visibility pausing. |
| P1 | `ui/dialog.tsx`: centered dialog has no viewport height cap; the close control is approximately 24px. The landing auth dialog adds `overflow-hidden`. | Long forms can extend beyond small/short screens; closing is harder on touch devices. | Dynamic-viewport height limit, internal vertical scrolling, overscroll containment, viewport margins, and 44px close control. Preserve Radix focus/escape behavior. |
| P1 | `QuestionDisplay.tsx`: clinical tables have no local overflow container. | Wide tables can force the question surface beyond a narrow screen. | Keyboard-focusable, named, horizontally scrollable table region; smaller mobile padding and wrapping. Preserve sanitization, clinical text, and highlighting. |
| P2 | Live hero shows three feature cards, three repeated metric cards, multiple scanner labels, and an animated CTA on a full-page grid. | Competing emphasis obscures the value proposition and next action. | One headline, descriptive paragraph, primary/secondary action pair, simple capability list. Remove duplicate metric cards and page-wide grid. Keep scanner examples labeled as illustrative. |
| P2 | Baseline copy exposes implementation/design language: “training instrument dock,” “study surface,” “Diagnostic Atlas OS.” | New users must translate internal terminology before understanding the product. | Plain navigation labels, study-plan CTA, clearer headlines and training descriptions, and “Your study overview.” No new efficacy claims or testimonials. |
| P2 | `DiagnosticScrollStory.tsx` reserves `520vh` for five stages. The dashboard preview began roughly 9,430px down the observed desktop page. | Excessive scrolling delays useful product exploration. | Reduce reserved track to `280vh` and add a keyboard-accessible “Skip to study modes” link. Preserve all five stages and the reduced-motion alternative. |
| P2 | Root landing wrapper uses `overflow-hidden` around a sticky header. The header is absent in the observed scrolled dashboard preview. | Navigation does not remain available as intended through the long page. | Use horizontal clipping without introducing an overflow scroll container. Requires branch browser confirmation. |
| P2 | `LandingPage.tsx` references undefined `--atlas-bg-elevated` for the auth dialog. | Invalid background styling can fall back unpredictably. | Use existing `--atlas-surface-elevated`. |
| P2 | `HeroCanvas.tsx` reads root-level colors despite scoped themes. | Canvas and surrounding surface can disagree. | Read inherited color variables from the canvas element. |
| P2 | Decorative mode chart levels are generated from the mode ID string length. | A data-shaped display implies evidence that does not exist. | Remove the arbitrary chart and demo percentage; display actual mode descriptions, protocols, and preview points from the existing content module. |
| P2 | Dense glass, borders, glows, and repeated scanning effects dominate the page. | Visual fatigue and unnecessary compositing obscure hierarchy. | Scoped matte graphite surfaces, no repeated CTA scan effects, quieter containers, stronger type hierarchy and visible outline focus. No changes to operational theme globals. |

## Positive foundations retained

- Existing semantic tokens, shared controls, Radix dialogs, skip navigation, and explicit section labels.
- Device/memory/data-saver eligibility checks before loading the hero canvas.
- Reduced-motion fallbacks for the scanner and diagnostic story.
- Real URL-based app navigation, `aria-current` in the navigation rail, mobile safe-area treatment, and clearly labeled quiz-toolbar controls.
- Existing question sanitization and separation between UI rendering and the review-submission pipeline.
- Dedicated content data and lazy loading for the dashboard preview.

## Remaining work, in priority order

1. **Browser acceptance of this branch.** Inspect 390×844, 768×1024, 1024×768, and 1440×900; both ordinary and reduced motion. Check long auth forms, mobile-menu focus return, tab overflow, sticky navigation, 200% zoom, and wide question tables. Localhost was rejected by the provided cloud browser (`ERR_BLOCKED_BY_CLIENT`), so no after screenshots or successful responsive browser run are claimed.
2. **Signed-in journeys.** Confirm fresh-account, populated, loading, and partial-failure dashboard states using a permitted test account. The readiness cards are corrected here, but other dashboard widgets still use fallbacks (for example `TodayStudyPrescriptionWidget.tsx` and `commandCenterMockData.ts`). Review each before claiming the entire dashboard is production-data-only.
3. **Product promise versus beta availability.** The marketing mode list includes nine capabilities while app routing applies private-beta visibility rules. Confirm release scope before presenting every mode as immediately available. No features were newly exposed here.
4. **Global motion handling.** `index.css` uses a global `0.01ms` reduced-motion override. Replace it carefully with component-specific alternatives in a separate cross-app pass; this affects more than the audited page.
5. **Navigation and data density.** Mobile navigation labels are 10px in `NavRail.tsx`. Review legibility with long labels and actual devices. Dashboard still contains nested cards and dense multicolor metrics beyond the changed empty states.
6. **Media quality.** Current anatomy/image scenes are abstract or synthetic and must remain clearly labeled. Any replacement should have a defined educational role and proper provenance. No generated medical imagery or unrelated promotional video was added.
7. **Performance measurement.** Bundle gate passes, but Vite still warns about a chunk over 700kB; CSS is near the repository budget. Measure real LCP/INP/CLS and mobile frame time before asserting performance gains. Canvas lifecycle improvements are verified behaviorally, not by a reported benchmark.
8. **Existing lint debt.** Repository-wide lint reports nine errors in untouched files; see verification below. Do not represent this branch as making the entire repository clean.

## Verification

Runtime: Node 22.23.2 (repository-required major). Dependencies installed from the committed lockfile; Prisma client generated locally. No new dependencies, database writes, migrations, auth/RLS changes, or production deployment.

| Check | Result |
|---|---|
| Targeted Vitest: landing selector, canvas lifecycle, readiness provenance, route registry, adaptive widget resolution | 52/52 pass, 5 files |
| Changed TypeScript/TSX file lint | Pass, no errors |
| Full repository lint | 9 errors, 294 warnings; errors are outside changed files |
| Production TypeScript check after Prisma generation | Fails: identical 7 errors on baseline and changed branch; no errors in changed files |
| Vite production build | Pass; existing >700kB chunk warning |
| Repository bundle-size gate | Pass; first build: JS 5376.2kB / 8200kB, CSS 263.4kB / 300kB |
| `git diff --check` | Pass |
| Changed-branch desktop/mobile visual acceptance | Blocked by local-preview browser access; not claimed |
| Authenticated end-to-end study submission | Not run; no test session established |

Full-lint errors: `components/dashboard/adaptive/widgets/registry.tsx` (unsafe optional-chain assertion); `lib/agents/bridge.ts` (two require imports); `lib/langchain/deepagent.ts`; `lib/services/agents/toolRegistry.ts` (three require imports); `lib/services/gradeModulationCoordinator.ts` (const assertion); `packages/agents-dashboard/next-env.d.ts` (triple-slash reference).

The first TypeScript attempt lacked generated Prisma exports because install lifecycle scripts had been disabled during setup. The client was then generated from the existing schema without connecting to or altering production data.

Baseline comparison confirmed the same seven TypeScript errors before and after these changes. New behavior tests were also exercised against the original components and failed, then the improved components were restored.

Full-typecheck errors after generation: three undefined `tracingConfig` references in `lib/langchain/router.ts`; missing `AIEnvKeys.LANGSMITH_ENDPOINT` in `lib/langchain/tracing.ts`; three Prisma aggregate type recursion errors in `lib/services/drillReviewService.ts`.

## Tool and scope choices

GitHub supplied the source of truth. Superpowers verification, the repository navigator/style/verify guidance, and Impeccable supplied the audit workflow. Prompt Perfect refined the brief. Context7 verified Motion's reduced-motion APIs. Supabase confirmed the named PANaCEa project exists and is healthy; no student records were read and no schema was changed. Figma/video/knowledge-graph/GPU tools were not needed for these source changes, and adding new integrations would not address the verified defects.

The Impeccable context launcher returned permission denied, so existing repository context was read directly. The bundled detector was not run; all findings above are manually verified source findings or explicitly identified visual observations.

## Release boundary

Prepare this work as a draft pull request. Repository `AGENTS.md` and `CLAUDE.md` require approval before production deployment; main also auto-deploys. Do not merge or deploy until the branch has been visually reviewed and Aaron approves production release.
