# PANaCEa public landing design

Documented September 23, 2026. Verdict: **source-reviewed; rendered acceptance pending**. This describes the implemented public landing page and its Clerk entry presentation, not a deployed release or the authenticated application's theme.

## Direction and scope

The owner's supplied full-page reference replaces the prior landing direction with silver-white reading surfaces, ice-blue clinical accents, deep navy sections, and a decorative brain/glass sculpture. A large, quiet headline and an HTML study-plan preview establish the first viewport. The story moves from the difficulty of choosing what to study to a behavioral learning loop, fresh-question retrieval, practice modes, and account creation.

The design thesis is “Study with purpose; remember with confidence.” The product story is inference-first: answer accuracy, timing, and revisions inform concept-level recall estimates, and the memory model guides review timing. Students do not rate their confidence or choose Hard/Easy. The production scheduler's implicit binary Again/Good behavior remains unchanged. Statistical confidence intervals do not currently drive scheduling; Wilson bounds and shadow calibration are separate, read-only signals. Fresh wording communicates the intended concept-review experience, not a universal guarantee that every route prevents repeated questions.

The owner reference sets composition and material direction. No random seed, seed design, automated detector result, or fidelity score was used. The Impeccable launcher was unavailable during this session. `PRODUCT.md` and `docs/design/landing-reference-brief.md` record the product and direction contracts.

## Source of truth

`components/landing/LandingPage.tsx` composes the shipped surface. `components/landing/landing.css` defines its styling, scoped to `.landing-page` and `.landing-auth` so the authenticated app retains its own theme. Landing-specific illustrative data lives in `referenceContent.ts`; navigation and practice-mode descriptions come from `content.ts`. Older components still present in this directory are not the authority for the mounted landing page.

## Palette and materials

| CSS token | Value | Role |
| --- | --- | --- |
| `--landing-paper` | `#eef2f6` | Main light field and inset panels |
| `--landing-white` | `#fbfcfd` | Raised light surfaces |
| `--landing-ink` | `#172936` | Primary text and primary actions |
| `--landing-muted` | `#4d6172` | Secondary light-surface text |
| `--landing-line` | `#c8d3dd` | Light-surface dividers |
| `--landing-accent` | `#486f97` | Links, icons, focus outlines |
| `--landing-accent-soft` | `#a9c8e7` | Navy-surface accents and focus |
| `--landing-navy` | `#182833` | Contrast sections and tablet shell |
| `--landing-panel` | `#223642` | Tablet panels |
| `--landing-panel-raised` | `#2b4252` | Raised dark treatment |
| `--landing-night-text` | `#f3f7fb` | Primary dark-surface text |
| `--landing-night-muted` | `#bed0df` | Secondary dark-surface text |
| `--landing-night-line` | `#425563` | Dark-surface dividers |

The shared corner token is `14px`; actual components use purpose-specific radii: `7px` actions, `8px` tabs, `10px` tablet panels, `16px` concept/mode cards, `18px` auth dialog, and a `28px` tablet shell. The shared shadow is `0 22px 48px -30px rgb(22 40 55 / 40%)`. Fine one-pixel dividers and restrained layered shadows carry the material treatment. The hero's pale gradient, blue heading emphasis (`#527ca5`), tablet metal edge (`#81909b`), and practice-card fill (`#dde6ee`) remain local CSS values rather than shared tokens.

## Typography and spacing

Manrope is locally hosted at `public/fonts/Manrope-Latin.woff`, registered as `Manrope Landing`, with variable weights 200–800 and `font-display: swap`; the fallback stack is `Inter, sans-serif`. Its SIL Open Font License 1.1 notice is included at `public/fonts/Manrope-OFL.txt`; font provenance is in the asset handoff.

| Role | Implemented treatment |
| --- | --- |
| Hero headline | `clamp(2.8rem, 4.75vw, 4.2rem)`, weight 500, line-height 1.05 |
| Section heading | `clamp(1.9rem, 3vw, 2.8rem)`, weight 500, line-height 1.2 |
| Heading tracking | `-0.035em` for h1/h2 |
| Body | `0.95rem`, line-height 1.75 |
| Hero description | `0.97rem`, line-height 1.85, maximum 43ch on desktop |
| Eyebrow | `0.69rem`, weight 700, uppercase, `0.17em` tracking |
| Primary action | `0.85rem`, weight 600, minimum height 52px |
| Secondary actions | Minimum height 44px; practice tabs 48px |

The desktop container is `min(100% - 6rem, 1280px)`. Standard sections use 90px vertical padding, reduced to 65px at 1023px and 52px at 700px. Section-specific spacing is intentional; there is no global spacing-token scale. Labels inside the desktop tablet are deliberately compact and require rendered readability review.

## Components and behavior

| Component | Structure and behavior |
| --- | --- |
| `LandingBrand` / header | SVG crosshair mark, letter-spaced wordmark, sticky light header, section anchors, login and sign-up actions |
| `Hero` | Four-line desktop headline, account-creation CTA, how-it-works anchor, product preview, decorative responsive sculpture |
| `StudyPlanPreview` | Real HTML, navy tablet perspective, focus action, illustrative 68% recall estimate, today's plan, system bars; labelled “Example plan” and “Illustrative learner data” |
| `StudyChallenges` | Navy contrast band with five study problems and simple line icons |
| `LearningEngine` | Five numbered steps: practice, behavior, memory model, automatic timing, new retrieval context |
| `ConceptLearning` | Two illustrative prompts for one concept; explicit toggle and polite live announcement; native details disclosure for science and evidence limits |
| `TrainingModesDock` | Explicitly selected tabs and one associated panel; roving tab stop, orientation-aware arrows, Home/End, selected-tab visibility in the narrow horizontal strip |
| `BuiltForStudents` | Navy section, device cues, three light capability cards; no invented testimonials or outcome statistics |
| Final CTA / footer | Light closing panel, account actions, navigation, and educational-use statement |
| `AuthDialog` | Existing Clerk forms inside Radix dialog; bounded scrolling, body scroll lock, Escape/focus behavior, trigger restoration with mobile-menu fallback |

The mobile menu closes on Escape and restores focus to its toggle. Crossing back to desktop also closes it. A skip link targets the focusable main region. Focus outlines are 3px with a 4px offset, using the lighter accent on dark surfaces. These are source-backed behaviors, not a completed assistive-technology audit.

## Responsive rules

| Boundary | Effective behavior |
| --- | --- |
| Above 1199px | Two-column hero; desktop navigation; five-column learning loop; vertical mode tabs; four-column footer |
| At 1199px | Container gutters become 2rem per side; challenge and student sections stack; final CTA reflows |
| At 1099px | Desktop navigation switches to a menu; desktop returns at 1100px |
| At 1023px | Hero stacks; preview centers; section padding becomes 65px; mode tabs become a horizontal scrolling strip; footer becomes three columns |
| At 700px | Gutters become 1.25rem per side; header is 76px tall; header account actions move into the menu; tablet loses perspective and becomes one column; system bars hide, while focus, recall estimate, and today's plan remain; learning loop, science, and practice cards stack; final CTA stacks; footer uses two columns |

Phone h1 uses `clamp(2.35rem, 8.4vw, 3.5rem)` and line-height 1.12. The late mobile rule restoring `.study-readiness` is intentional; reading only its earlier `display: none` rule misstates the effective design.

## Motion and assets

The only authored entrance is a 700ms, 10px vertical movement of the already-visible study preview, enabled only for `prefers-reduced-motion: no-preference`. There is no timed carousel. Small color/shadow hover transitions remain. Forced-colors rules add borders, use system highlight colors for preview marks, and hide decorative artwork.

`public/images/landing/learning-sculpture.webp` and `learning-sculpture-small.webp` are generated decorative artwork, not medical teaching imagery. The hero supplies 1600w/800w sources, declared 1600×667 dimensions, empty alternative text, and `aria-hidden`. The artwork ignores pointer events and sits below the copy and product preview in stacking order. Provenance is recorded in `public/images/landing/PROVENANCE.md` as part of the main handoff. Keep the responsive pair together when replacing it.

## Evidence and open acceptance

The finish session reports 57 focused tests passing, a successful production build and bundle gate, and passing changed-file ESLint. Production typecheck reports seven existing AI-tracing/Prisma group-by errors outside the landing changes. Independent source review passed after targeted fixes. These checks support source integrity, not reference fidelity.

The supported browser preview failed with `ERR_BLOCKED_BY_CLIENT`. No rendered screenshots, responsive visual pass, measured contrast pass, or fidelity score is claimed. Phone/tablet/desktop visual review, real Clerk rendering, focus visibility against rendered surfaces, compact tablet text, and sculpture/preview composition remain acceptance work in an accessible browser. The science disclosure distinguishes supporting research from prospective validation of PANaCEa itself; this design documentation does not independently validate linked papers or learning-outcome claims.
