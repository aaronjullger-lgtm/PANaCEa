# Prompt: Implement medicalUI.md Design System Upgrades into PANaCEa

> **Usage:** Copy this entire prompt into a Claude Code session with the PANaCEa repo mounted. Each phase is a self-contained sprint. Run them sequentially — each one should end with `npm test` and `npm run typecheck` passing.

---

## Context

You are working on **PANaCEa** (`StudyPANaCEa/`), an adaptive clinical education PWA for PA students. The codebase uses React 19 + TypeScript (strict) + Vite 6.2 + Tailwind CSS 3.4 + Framer Motion 12. Charts use Recharts 3.6. State management is Zustand + TanStack Query. The app deploys to Cloudflare Pages.

A research document (`medicalUI.md` in the repo root) analyzed the 2025–2026 UI stack landscape and recommended a progressive adoption plan. Your job is to implement those findings into this existing codebase **incrementally, without a rewrite**.

### What already exists (do NOT re-add or duplicate)
- `tailwindcss@3.4.18` — stay on v3 for now (v4 migration is a separate future effort)
- `framer-motion@12.23.24` — already installed, used across many components
- `recharts@3.6.0` — already the charting backbone
- `clsx@2.1.1` and `tailwind-merge@3.4.0` — already installed
- `Inter` font — already configured as the default `font-sans` in `tailwind.config.js`
- Custom semantic color tokens — extensive palette already in `tailwind.config.js` (action-blue, deep-plum, steel-blue, sage, dusty-rose, muted-amber, slate-teal, data-fail/pass/provisional/warning/neutral)
- Dark mode — already implemented with theme transition management in `src/index.css`

### What needs to be added (the medicalUI.md findings)
The implementation is organized into **6 phased sprints**, ordered by ROI and dependency. Each sprint is independently shippable.

---

## Phase 1 — Foundation: `cn()` utility + CVA + shadcn/ui init

**Goal:** Establish the shadcn/ui infrastructure so all subsequent work can use it.

**Steps:**
1. Install `class-variance-authority` as a dev dependency.
2. Create `lib/utils/cn.ts` exporting a `cn()` helper that composes `clsx` and `tailwind-merge` (the standard shadcn pattern). If a `cn` utility already exists anywhere in the repo, consolidate to this single location and update all imports.
3. Run `npx shadcn@latest init` — when prompted:
   - Style: Default
   - Base color: Slate (closest to existing palette)
   - CSS variables: Yes
   - Alias: `@/components/ui` for components, `@/lib/utils` for utilities
   - Tailwind config: `tailwind.config.js`
   - Global CSS: `src/index.css`
4. **Critically:** After init, audit what it changed in `tailwind.config.js` and `src/index.css`. Preserve all existing custom color tokens, safelist entries, and theme transition CSS. Merge shadcn's CSS variable block (`--background`, `--foreground`, `--primary`, etc.) into the existing `:root` and `.dark` selectors **without replacing them**. Map shadcn semantic tokens to the existing PANaCEa palette where sensible:
   - `--primary` → map to action-blue-500 (`#3B82F6`)
   - `--destructive` → map to existing `data-fail` token
   - `--muted` → map to existing secondary/tertiary surface tokens
5. Add the first shadcn component as a smoke test: `npx shadcn@latest add button`. Verify it renders correctly in both light and dark modes.
6. Run `npm test` and `npm run typecheck`. Fix any breakage.

**Files touched:** `package.json`, `tailwind.config.js`, `src/index.css`, `lib/utils/cn.ts`, `components/ui/button.tsx` (new), `components.json` (new, shadcn config)

---

## Phase 2 — Clinical Color Tokens (OKLCH)

**Goal:** Add a clinical-semantic color layer following medical traffic-light conventions, using OKLCH for perceptual uniformity.

**Steps:**
1. In `tailwind.config.js` under `theme.extend.colors`, add a `clinical` color group:
   ```js
   clinical: {
     normal:   'oklch(0.72 0.19 142)',   // green — correct, mastered, safe
     warning:  'oklch(0.80 0.16 84)',     // amber — borderline, needs review
     critical: 'oklch(0.63 0.26 29)',     // red — incorrect, failed, urgent
     info:     'oklch(0.65 0.15 250)',    // blue — neutral clinical data
   }
   ```
2. Also define these as CSS custom properties in `src/index.css` `:root` block for use outside Tailwind:
   ```css
   --clinical-normal: oklch(0.72 0.19 142);
   --clinical-warning: oklch(0.80 0.16 84);
   --clinical-critical: oklch(0.63 0.26 29);
   --clinical-info: oklch(0.65 0.15 250);
   ```
   And darker variants in the `.dark` block.
3. Add the new utility classes to the `safelist` in `tailwind.config.js`:
   ```js
   'bg-clinical-normal', 'bg-clinical-warning', 'bg-clinical-critical', 'bg-clinical-info',
   'text-clinical-normal', 'text-clinical-warning', 'text-clinical-critical', 'text-clinical-info',
   'border-clinical-normal', 'border-clinical-warning', 'border-clinical-critical', 'border-clinical-info',
   ```
4. **Do NOT replace** existing `data-fail`, `data-pass`, etc. tokens. The clinical tokens are an additional semantic layer for medical-context UI. Document the relationship in a brief comment block.
5. Run `npm test` and `npm run typecheck`.

**Files touched:** `tailwind.config.js`, `src/index.css`

---

## Phase 3 — Typography & Mono Font

**Goal:** Add Geist Mono for lab values, dosages, and code; enable tabular figures on Inter.

**Steps:**
1. Install `geist` font package (`npm install geist`) OR add a `@font-face` declaration in `src/index.css` pointing to a self-hosted WOFF2 subset of Geist Mono (prefer self-hosted for PWA offline support — download from Google Fonts or the Vercel `geist` npm package and place in `public/fonts/`).
2. Add `mono: ['Geist Mono', 'ui-monospace', 'monospace']` to `fontFamily` in `tailwind.config.js`, alongside the existing `sans` entry.
3. Add a global utility class in `src/index.css`:
   ```css
   .tabular-nums { font-feature-settings: "tnum"; }
   ```
   (Tailwind v3 already has `tabular-nums` utility — verify it works with Inter. If so, skip the manual class.)
4. Identify 3–5 components that display numeric data (scores, timers, statistics, lab values, dosages) and add `font-mono` class to their numeric display elements. Good candidates:
   - Score/percentage displays in dashboard widgets
   - Timer display in QuizView
   - Lab value displays in MiniLabDrill
   - Dosage text in PharmDrill
   - Statistics numbers in analytics panels
5. Run `npm test` and `npm run typecheck`.

**Files touched:** `tailwind.config.js`, `src/index.css`, `public/fonts/` (new), 3–5 component files (targeted `className` additions only)

---

## Phase 4 — Icons: Lucide + Health Icons

**Goal:** Add Lucide as the primary icon set (shadcn/ui's default) and Health Icons for medical-specific icons.

**Steps:**
1. Install `lucide-react`. Check if any existing icon library is used (e.g., `react-icons`, `heroicons`). Do NOT remove existing icon imports yet — this is additive.
2. Install `healthicons-react` (the React wrapper for healthicons.org's 400+ medical icons). If no React wrapper exists on npm, document the alternative approach (SVG sprite or direct SVG imports from the healthicons repo).
3. Create `components/ui/icons.ts` as a central re-export barrel:
   ```ts
   // Re-export commonly used icons for consistent imports
   export { Stethoscope, Heart, Brain, Pill, Activity, ... } from 'lucide-react';
   // Medical-specific icons from Health Icons
   export { ... } from 'healthicons-react'; // or custom SVG wrappers
   ```
4. In 2–3 existing components, replace one or two ad-hoc SVG icons or emoji with proper Lucide/Health Icons to demonstrate the pattern. Don't do a full migration — just establish the convention.
5. Run `npm test` and `npm run typecheck`.

**Files touched:** `package.json`, `components/ui/icons.ts` (new), 2–3 existing component files (icon swaps only)

---

## Phase 5 — Study Activity Heatmap with @nivo/calendar

**Goal:** Add a GitHub-style contribution heatmap to the dashboard showing daily study activity.

**Steps:**
1. Install `@nivo/calendar` and `@nivo/core` (peer dependency).
2. Create `components/charts/StudyHeatmap.tsx`:
   - Accept props: `data: Array<{ day: string; value: number }>` (ISO date strings + session/question counts)
   - Render `<ResponsiveCalendar>` with PANaCEa color tokens:
     - Empty days: surface background
     - Color scale: 4 steps from `clinical-info` (light) → `action-blue-600` (saturated)
   - Respect dark mode (check existing theme context/store pattern)
   - Include `<Suspense>` wrapper with a skeleton fallback
   - Use `React.lazy()` for the import since this is a heavy component
3. Wire it into the main dashboard layout. Find the existing dashboard component (likely `components/dashboard/`) and add the heatmap in an appropriate section. If the data isn't available yet from the API, use mock data with a `TODO` comment noting which endpoint will supply it.
4. Run `npm test` and `npm run typecheck`.

**Files touched:** `package.json`, `components/charts/StudyHeatmap.tsx` (new), one dashboard layout file

---

## Phase 6 — Command Palette with cmdk

**Goal:** Add a ⌘K / Ctrl+K command palette for quick navigation to topics, drugs, conditions, and drills.

**Steps:**
1. Install `cmdk` (the command menu primitive used by shadcn/ui's command component).
2. Add the shadcn command component: `npx shadcn@latest add command dialog`.
3. Create `components/command/CommandPalette.tsx`:
   - Global keyboard listener for ⌘K / Ctrl+K
   - Search groups: "Conditions", "Drugs", "Drills", "Navigation"
   - Each group sources from existing data (clinical library, navigation routes)
   - Use existing router (`react-router-dom`) for navigation on selection
   - Animate open/close with `framer-motion` `AnimatePresence`
4. Mount the CommandPalette at the app root level (likely in `App.tsx` or a layout wrapper).
5. For the initial version, populate with:
   - Static navigation items (Dashboard, Library, Settings, etc.)
   - If condition/drug data is available client-side (Zustand store or cached query), wire it in. Otherwise, use a debounced API search with the existing search endpoint.
6. Run `npm test` and `npm run typecheck`.

**Files touched:** `package.json`, `components/ui/command.tsx` (shadcn), `components/ui/dialog.tsx` (shadcn), `components/command/CommandPalette.tsx` (new), `App.tsx` or layout wrapper

---

## Global Constraints (apply to ALL phases)

1. **Read before writing.** Before modifying any file, read its full contents. Understand existing imports, patterns, and conventions. This is the #1 rule in PANaCEa development.
2. **Do not break existing functionality.** Every phase must end with `npm test` passing and `npm run typecheck` passing (use `NODE_OPTIONS="--max-old-space-size=4096"`).
3. **Preserve the existing design system.** The extensive color tokens in `tailwind.config.js` (action-blue, deep-plum, steel-blue, sage, dusty-rose, muted-amber, etc.) are used across 580+ components. Never remove or rename them.
4. **Stay on Tailwind v3.4.** The `@theme` directive and CSS-first config from v4 are noted for a future migration. Do not attempt a Tailwind v4 upgrade in this work.
5. **PWA bundle budget.** Total new JS should stay under 80 KB gzipped. Use `React.lazy()` and dynamic imports for heavy additions (@nivo, cmdk).
6. **No self-rated difficulty buttons.** PANaCEa uses implicit-only behavioral rating. Nothing in this UI work should introduce user-facing rating controls.
7. **Import alias.** Use `@/` for all imports (maps to repo root). Follow existing import ordering: React → third-party → `@/lib` → `@/hooks` → `@/components` → relative.
8. **File naming.** PascalCase for components (`StudyHeatmap.tsx`), camelCase for utilities (`cn.ts`).
9. **Ask before:** Adding production dependencies not listed above, modifying `prisma/schema.prisma`, changing auth middleware, or making any destructive git operation.
10. **Commit style.** One conventional commit per completed phase: `feat(ui): phase N — <short description>`.

---

## Execution Order

Run the phases sequentially: **1 → 2 → 3 → 4 → 5 → 6**. Phase 1 is the critical foundation — everything else depends on the `cn()` utility and shadcn/ui infrastructure it establishes. Phases 2–4 are independent of each other but light enough to do in order. Phases 5–6 are heavier features that build on the foundation.

If any phase breaks tests or typecheck, fix the breakage before proceeding to the next phase. Do not skip phases.

After all 6 phases, run a final verification:
```bash
npm test && NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit && npm run build
```
Report the results.
