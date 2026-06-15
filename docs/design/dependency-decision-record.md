# Landing Page — Dependency Decision Record

Goal: deliver a category-defining signature visual without bloating the bundle or
introducing a second design system. Every candidate from the research shortlist was
evaluated against the existing stack.

| Library | Decision | Rationale |
|---|---|---|
| **Motion / Framer Motion** | **Use (already installed)** | Section reveals, hero entrance, legend cross-fades, reduced-motion via `useReducedMotion`. No new dep. |
| **Lucide** | **Use (already installed)** | Baseline interface icons. Clinical/product symbolism is hand-drawn on canvas. |
| **shadcn/Radix** | **Use existing only** | The repo already wraps Radix (`components/ui/dialog`) and has the `studypanacea` primitive layer. Adding more would duplicate the design system the prompt warns against. |
| **React Three Fiber + drei + postprocessing** | **Reject** | The signature "Clinical Learning Engine" is achievable with a single, dependency-free 2D `<canvas>` (~10KB component, no runtime dep). R3F + three scene graph would add ~150KB+ to a public landing page and a WebGL context the page does not need. The 2D approach is faster, mobile-safe, and degrades trivially under reduced-motion. Three.js is present in the repo but intentionally not pulled into this route. |
| **Lenis (smooth scroll)** | **Reject** | Risks native-scroll/accessibility regressions; the prompt only allows it if it *materially* improves WebGL sync. We have no full-page WebGL, so it adds risk for no benefit. |
| **Magic UI** | **Reject (patterns only)** | Studied animated-component patterns; reimplemented the relevant idea (staged emphasis loop) natively in Atlas styling rather than importing, to avoid a component-showcase look. |
| **XYFlow** | **Reject (for now)** | A genuine interactive confusion-map could justify it later, but the hero loop is a guided narrative, not a user-manipulable graph. Adding a node-graph lib here would be decorative. |
| **Theatre.js** | **Reject** | Specialist 3D choreography tool; unnecessary without an R3F scene, and adds editor/runtime weight. |

**Net new runtime dependencies added: none.** New code is one canvas component plus one
section component, both built on the existing Atlas token system and `studypanacea` primitives.
