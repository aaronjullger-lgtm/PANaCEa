# PANaCEa Landing Page — Master Workflow (Higgsfield + Motion)

> Synthesizes: the pasted "Architectural and Strategic Blueprint" doc, the Drive
> "PANaCEa Landing Page Workflow" doc (same content), the "PANaCEa App
> Development and UI Research" doc, the "PANaCEa Comprehensive Features,
> Science, and Value Proposition" doc, and the actual code in
> `components/landing/`. Where the pasted blueprint conflicts with what's
> already built, **the existing codebase + Aaron's own prior research wins**.

## 1. Design system: Diagnostic Atlas OS (authoritative)

The pasted blueprint proposes a generic "Ocean Depth" palette
(`#0A1628`, "Luxury Terminal" typography). **Do not use it.** PANaCEa already
ships its own, more specific system — **Diagnostic Atlas OS**
(`theme-diagnostic-atlas` in `index.css`) — and it's further along than the
blueprint's suggestion. Tokens (from `index.css`):

| Token | Value | Use |
|---|---|---|
| `--atlas-bg` | `#020711` / `#020814` | page background |
| `--atlas-bg-soft` | `#06111f` | panel background |
| `--atlas-accent-cyan` | `#67e8f9` | primary accent, scanner glow |
| `--atlas-accent-blue` | `#60a5fa` | secondary accent |
| `--atlas-accent-violet` | `#a78bfa` | tertiary accent |
| `--atlas-accent-pulse-pink` | `#fb7185` | alert/pulse highlight |
| `--atlas-success-green` | — | "stable"/success states |

Any generated asset (image or video) **must** be prompted with these exact
hex values, not generic "medical blue" — see Section 3.

## 2. Motion stack

- **Motion** (`motion/react`, the Framer Motion rebrand) — already in use
  throughout `components/landing/`. Stays primary for entrance transitions,
  `useReducedMotion()` gating, and layout animation.
- **anime.js v4** — recommended (not yet added) for the signature SVG
  path-morph: EKG trace → FSRS retention-decay curve. Candidate location:
  inline SVG in `Hero.tsx` near `HeroScannerPanel`, or as a standalone
  component if reused elsewhere (dashboard empty-states).
- **Lenis** — recommended (not yet added) for smooth scroll. Only add if a
  real jank problem shows up on the long scroll-story (`DiagnosticScrollStory`
  → `TrainingModesDock` → `ClinicalImageTraining`); don't add speculatively.
- **Hard rule:** at most one heavy WebGL/3D centerpiece on the whole page.
  `HeroCanvas.tsx`'s procedural canvas already fills that slot — a Higgsfield
  video is a *background ambience layer*, not a second centerpiece.
- Transform/opacity-only animations for perf; durations <300ms for UI
  micro-interactions; every animated component must check
  `useReducedMotion()` / respect `prefersReducedMotion`.

## 3. Higgsfield asset pipeline (design-time only)

Per the UI Research doc: Higgsfield is a **design-time asset generator**,
never a runtime API dependency. Generate once, download, commit the static
file, never call Higgsfield from the running app.

**Pipeline: still → animate (avoids text-to-video hallucination).**

1. `models_explore(action: 'recommend', type: 'image', input: 'text')` to pick
   a still-image model. Current pick: `nano_banana_pro` (best for
   text/diagram-adjacent precision); in practice the API has silently routed
   one request to `nano_banana_2` — acceptable fallback, re-roll if fidelity
   is off.
2. `generate_image` with a prompt that encodes the exact atlas hex codes
   (Section 1) and the EKG→retention-curve motif. `get_cost: true` first to
   confirm spend (observed: 2 credits for a 2k 16:9 still).
3. Poll with `job_display` (`job_status` is permission-denied in this
   environment — don't use it).
4. Once `status: "completed"`, download the `rawUrl` PNG into
   `public/assets/`.
5. Animate it: `generate_video` with `model: "seedance_2_0"`, the completed
   image job's id passed as `medias: [{ value: <image_job_id>, role:
   "start_image" }]` (no need to re-upload — a prior job id works directly as
   a media reference), `generate_audio: false` (ambient background loop,
   muted autoplay — don't pay for audio you'll never play). Observed cost: 36
   credits for 8s/720p/16:9.
6. Download the completed video into `public/assets/`.

**Status as of this doc:**
- Still image: `public/assets/hero-scanner-bg.webp` (job
  `5f53a801-7a11-49ea-8815-be15446a4e3b`, model `nano_banana_2`, 2k 16:9
  source; resized to 1600px wide and re-encoded WebP q78 via the repo's
  existing `sharp` devDependency — 8.2MB raw PNG -> 61KB).
- Ambient video: `public/assets/hero-scanner-ambient.mp4` (job
  `eb481df2-0279-4eeb-964f-6ae4269f98ed`, `seedance_2_0`, 8s/720p/16:9, no
  audio, ~3MB) — completed and downloaded.

**Where it's wired in:** `Hero.tsx` → `HeroScannerPanel`, as a poster
image / fallback background sitting *behind* the existing `HeroCanvas`
procedural scanner, gated by the same `useCanRenderHeroCanvas()` perf check
already in place (≥1024px viewport, `deviceMemory >= 4`,
`hardwareConcurrency >= 4`, no `saveData`). On low-power devices the static
PNG poster is shown with `HeroCanvasFallback()`'s existing CSS-only treatment;
never autoplay heavy video on a gated-out device.

## 4. Copy rules (from the Value-Prop + UI Research docs)

**Banned phrases** — never use:
- "the perfect time" → use "the modeled right time" / "near your forgetting
  threshold"
- "confidence interval" (user-facing) → use "concept confidence" /
  "readiness confidence"
- "revolutionary", bro-marketing, fake-founder-speak
- Generic AI-startup visual clichés: blue-gradient SaaS, stock medical
  website, crypto dashboard, fake neon futurism, glassmorphism with nothing
  underneath it, motion with no explanatory purpose

**FSRS-accurate phrasing:** say "predicted probability of recall falls to
90%", never "the perfect mathematical moment."

**Verbatim taglines available for use** (from the Features/Value-Prop doc,
Section 24) — pull into `content.ts` as needed; don't paraphrase them into
something blander.

## 5. Implementation checklist

- [x] Generate on-brand hero background still (Higgsfield `nano_banana_2`)
- [x] Generate ambient hero background video (Higgsfield `seedance_2_0`)
- [x] Download both into `public/assets/`
- [ ] Wire poster image + video into `Hero.tsx` / `HeroScannerPanel`, gated by
      `useCanRenderHeroCanvas()`
- [ ] Verify `useReducedMotion()` disables/hides the video, not just slows it
- [ ] Typecheck (`npm run typecheck`) + smoke-test `npm run dev`
- [ ] Optional follow-up (separate task, not in this pass): anime.js EKG→FSRS
      curve SVG morph; Lenis smooth scroll; `content.ts` copy refresh with
      verbatim taglines

## 6. What NOT to do

- Don't replace `HeroCanvas.tsx`'s procedural scanner — it works, it's
  accessible, it's cheap to render. The Higgsfield asset supplements it as
  ambience, not a replacement.
- Don't adopt the pasted blueprint's literal color/typography spec — it
  predates and conflicts with the already-implemented Atlas system.
- Don't call Higgsfield MCP tools from application runtime code — assets are
  generated once, downloaded, committed, and served statically.
- Don't ship the video without a static-poster/reduced-motion fallback path.
