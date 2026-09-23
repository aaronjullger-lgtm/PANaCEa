# Reference overhaul and finish audit

Date: September 23, 2026. Branch: `design/site-usability-audit`. Continues the earlier [site usability audit](2026-09-23-design-audit.md). Scope: public landing design and copy, authentication presentation, and science/implementation research. No production deployment.

## Delivered

- Replaced the previous landing composition with the owner's ice-white, silver-blue, and navy reference direction: clear left hero, readable perspective study preview, dark study-challenge strip, five-stage learning engine, PA-focused feature section, rounded closing CTA, and footer.
- Added original decorative brain/glass artwork in responsive WebP sizes and a self-hosted Manrope subset. The tablet is semantic HTML; its sample values are labeled illustrative. No fabricated testimonials, adoption figures, percentage improvements, or pricing terms.
- Made the owner's product clarification central: implicit behavioral signals, concept-level memory, automatic review timing, and fresh question wording. Added a working two-prompt concept demonstration and an expandable primary-source science explanation.
- Aligned SEO and social descriptions with that product story. Removed unverified inventory counts from these descriptions.
- Preserved account entry via Clerk, actual section anchors, mode selection, and prior signed-in usability fixes. Landing controls open account creation; the public mode selector explains modes rather than starting an authenticated session.
- Added a source-based [science and differentiation audit](../research/2026-09-23-concept-learning-science-audit.md), [design reference brief](../design/landing-reference-brief.md), root `PRODUCT.md` and `DESIGN.md`, local design metadata, and [asset provenance](../../public/images/landing/PROVENANCE.md).

## UI audit findings resolved

| Finding | Resolution |
| --- | --- |
| Product value obscured by generic question-bank messaging | Behavioral concept scheduling now drives the hero, engine sequence, and science section. |
| Reference contains unsubstantiated learner results/testimonials | Replaced with demonstrated feature descriptions; sample dashboard numbers explicitly labeled. |
| Public demo had expensive animation layers | New hero uses HTML/CSS and a compressed decorative raster; no canvas/3D or Framer Motion dependency in the mounted hero. This is an architecture observation, not a measured Lighthouse improvement. |
| Focus and navigation require predictable behavior | Immediate native skip link; unified desktop/mobile breakpoint; menu Escape and focus return; stable keyboard tabs; named auth dialog with explicit focus restoration including an unmounted mobile trigger. |
| Artwork stacking could obscure the preview/caption | Figure is above decorative sculpture; artwork has no pointer interaction. Rendered geometry still needs viewport acceptance. |
| Shared auth backdrop inherited content-centering transform | Removed cinematic content animation classes from the fixed full-screen overlay. Dialog content retains its own positioning/animation. |
| Rapid Review copy implied unsupported FSRS updates | Copy now describes short recall practice and answer feedback, consistent with its scheduling exclusion. |
| Absolute fresh-question wording exceeded audited route guarantees | Changed to “Review the concept through fresh questions”; documented exposure-path gaps separately. |
| Tiny footer click areas | Minimum control height is 44px. |

## Independent finish review

A fresh reviewer inspected the supplied reference, generated asset, implementation, CSS, and product brief. Four targeted findings—backdrop transform, absolute fresh-question wording, Rapid Review scheduling copy, and artwork stacking—were fixed and independently rechecked. Final verdict: **source review passed; rendered verification blocked**. A separate documenter wrote `DESIGN.md` and `.impeccable/design.json` from the source.

No automated Impeccable launcher score, visual fidelity score, screenshot comparison, or WCAG conformance claim is made. The launcher was unavailable; the supported browser preview was blocked with `ERR_BLOCKED_BY_CLIENT`. The generation/reference images were inspected, but the rebuilt page could not be rendered in the available browser.

## Verification

Node 22, matching the repository requirement.

| Check | Result | Practical limit |
| --- | --- | --- |
| Focused unit/component regression suite | 57 tests pass across 6 files | Includes new landing navigation/auth focus/concept demo tests, training tabs, prior hero lifecycle, route registry, and dashboard readiness regression tests. Clerk is mocked in component tests. |
| Changed TS/TSX ESLint | Pass | Does not make the entire repository lint-clean. The earlier audit recorded 9 unrelated errors. |
| Vite production build | Pass | Uses Vite directly; no deployment or environment-file rewriting. Existing large-chunk warning remains. |
| Bundle budget | Pass | Approximately 5.3 MB total emitted JS and 288 KB CSS before compression. CSS is close to the 300 KB gate; this is whole-build output, not initial page transfer size. |
| Production TypeScript check | 7 existing errors, none in changed source | AI tracing configuration (4), Prisma aggregate recursive types (3). Repository-wide typecheck remains failing. |
| Reference and responsive source review | Pass with rendered acceptance pending | Breakpoints, stacking order, bounded modal layout, reduced motion, and tab behavior inspected. |
| Browser desktop/tablet/phone, actual zoom, live Clerk | Blocked / not verified | Supported preview failed. No after screenshots or measured Core Web Vitals available. |

Key checks use `vitest run` for `LandingPage`, `TrainingModesDock`, `HeroCanvas`, `routeRegistry`, `resolveDashboardWidgets`, and `ReadinessVitalsWidget`; `eslint` on changed TS/TSX; `vite build --mode production`; `scripts/check-bundle-size.mjs`; and `tsc --noEmit -p tsconfig.production.json`.

Source color calculations for the solid palette: body ink/paper 13.27:1, muted/paper 5.71:1, accent/paper 4.67:1, night text/panel 11.65:1, night muted/panel 7.93:1, large hero accent/paper 3.90:1. These calculations do not cover every blended background, gradient, state, or actual font rendering. Use rendered checks before making a conformance claim.

## Research findings that affect product claims

The scientific case is strongest for retrieval, spacing, personalization, and varied applications of a concept. PANaCEa-specific retention gains and time savings remain unmeasured in this audit.

Priority backend follow-ups, documented without changing the scheduler:

1. Canonical history snapshots omit behavioral fields consumed by historical confidence/RT adjustments, with a history-order mismatch as well.
2. Wilson bounds are read-only; confidence-interval-driven scheduling is not the present implementation.
3. Item-keyed Wilson history may include the just-created event and then append it again.
4. Seen-question tracking has failure/capacity/route gaps; validate no-repeat behavior and concept filters end to end.
5. Per-item difficulty calibration is distinct from a learner-level easy/medium/hard mix.

See the science audit for exact source paths, research citations, scope qualifiers, and acceptance criteria.

## Remaining release checks

- Review the branch at 390, 768, 1024, and 1440px plus 200% zoom. Confirm hero cropping, caption visibility, tablet text, tab overflow, sticky header anchors, and modal height.
- Exercise real Clerk sign-up/sign-in, error and loading states, focus restoration, and keyboard dismissal in light and system-dark preferences.
- Check reduced motion, forced colors, screen-reader landmark/order, focus visibility, and actual rendered contrast.
- Resolve or formally handle the existing repository typecheck/lint blockers before a clean release gate.
- Owner approval is required before merge/production deployment under `AGENTS.md`; the draft PR is the reviewable deliverable.
