# The 2025–2026 stack for a professional medical education UI

**shadcn/ui, Motion, and Tremor form the core of the best modern React UI stack for a solo developer building a clinical education PWA on Vite and Tailwind CSS.** This combination delivers production-grade quality with progressive adoption, strong accessibility defaults, zero vendor lock-in, and a total additional bundle cost under 80 KB gzipped. The React ecosystem has converged dramatically since 2023: copy-paste component ownership has won over monolithic packages, CSS variables have replaced runtime CSS-in-JS, and Tailwind v4's CSS-first configuration means your design tokens and utility classes now live in the same file. For a PA exam prep platform, the specific patterns from AMBOSS, Anki, and UWorld — split-panel question views, spaced repetition heatmaps, and traffic-light clinical color coding — map cleanly onto this stack.

---

## The component library landscape has a clear winner

**shadcn/ui** dominates the React ecosystem in 2026 with **94,000+ GitHub stars** and a copy-paste architecture that gives you full code ownership. Rather than installing a package you can't modify, you run `npx shadcn add button` and the component source code lands directly in your project. It's built on Radix UI primitives for accessibility and Tailwind CSS for styling. Since December 2025, you can alternatively choose Base UI (by MUI) as the underlying primitive layer — a significant development given Radix UI's slowing maintenance after WorkOS acquired the original team.

For a medical education dashboard, shadcn/ui provides **50+ components** including data tables, forms, modals, command palettes, and charts. Its progressive adoption story is excellent: you add individual components one at a time without touching existing code. The `cn()` utility (combining clsx and tailwind-merge) handles class name composition, and CVA (Class Variance Authority) manages component variants — this is the standard pattern adopted by the wider ecosystem.

**Three alternatives worth understanding.** Mantine (**490,000+ weekly npm downloads**, 120+ components, 40+ hooks) is the best "batteries-included" option if you want everything pre-built, though its CSS bundle doesn't tree-shake and requires PostCSS configuration alongside Tailwind. HeroUI v3 (formerly NextUI, rebranded January 2025) is a ground-up rewrite on React Aria + Tailwind v4, offering **75+ web components** with beautiful defaults and native CSS animations replacing Framer Motion — strong if you want opinionated aesthetics. Base UI reached **v1.0 in December 2025** with a full-time MUI team behind it, making it the most future-proof headless primitive if Radix maintenance continues declining.

For medical-specific components, **Medplum** is an open-source FHIR-native healthcare platform built on Mantine that provides clinical UI elements like patient timelines, lab result displays, and medication lists. While overkill for an exam prep app, its component patterns are worth studying. The **Ember Dashboard Template** ($69–$349) offers 50+ healthcare-specific pages built on shadcn/ui with Recharts, covering vitals monitoring, patient management, and clinical workflows.

**Recommended stack:** shadcn/ui as the primary component library, with Base UI primitives as the long-term foundation. Add components incrementally — no rewrite required.

---

## Motion and Tremor handle animation and data visualization

**Motion v12** (formerly Framer Motion, renamed mid-2025) is the definitive React animation library. It powers the polished micro-interactions seen on Linear and Vercel sites. The bundle can be as small as **4.6 KB** with `LazyMotion` and the `m` component for initial render, lazy-loading the full **34 KB** engine as needed. The API is declarative and React-idiomatic: `whileHover`, `whileTap`, `AnimatePresence` for exit animations, and layout animations that "just work." Version 12 added hardware-accelerated scroll, OKLCH color animation, and React 19 support. The `useReducedMotion` hook respects user accessibility preferences automatically.

**AutoAnimate** (2.5 KB) complements Motion perfectly for list and form animations. One line — `useAutoAnimate()` — automatically animates DOM additions, removals, and reordering. Use it for flashcard decks, question lists, and study session queues. Together, these two libraries cost under **40 KB** and cover every animation need from micro-interactions to page transitions.

For charts, **Tremor** is the optimal choice for a Tailwind-based medical dashboard. Acquired by Vercel in 2025, it provides **35+ dashboard-focused components** (area charts, bar charts, line charts, donut charts, spark charts, KPI cards, trackers) built natively on Tailwind CSS + Recharts. Like shadcn/ui, it uses a copy-paste model giving you full code ownership. Dark mode works out of the box. The **shadcn/ui charts** package is an equally valid choice — it wraps Recharts with a `ChartConfig` system and CSS variable theming that auto-adapts to light/dark modes. Both use Recharts v3 underneath, adding approximately **40–50 KB** gzipped.

For the one chart type neither provides — the **calendar heatmap** essential for visualizing study activity (like GitHub's contribution graph) — add **@nivo/calendar** (~15–20 KB). Nivo's heatmap component is specifically designed for this pattern and includes built-in theming with beautiful defaults.

| Category | Library | Bundle (gzip) | Why |
|----------|---------|--------------|-----|
| Animation | Motion v12 + LazyMotion | ~4.6 KB initial | Micro-interactions, page transitions, gestures |
| List animation | AutoAnimate | ~2.5 KB | One-line list/form animations |
| Charts (primary) | Tremor or shadcn/ui charts | ~40–50 KB | Tailwind-native, dashboard-focused |
| Heatmap | @nivo/calendar | ~15–20 KB | Study activity calendar visualization |

GSAP became **completely free** in April 2025 (Webflow acquired GreenSock and opened all plugins), but its imperative API is less natural in React than Motion's declarative approach. React Spring (29K GitHub stars) is still maintained but has been surpassed by Motion in community adoption and features. Watch the experimental React `<ViewTransition>` component — it will eventually provide zero-cost page transitions using the browser's native View Transitions API, but it is not yet in stable React.

---

## Design system patterns worth stealing for clinical education

The most instructive design systems for a medical education dashboard are **Linear**, **Apple HIG**, **IBM Carbon**, and **Material Design 3**, each contributing different lessons.

**Linear's approach to information density** is the single most relevant pattern. Linear generates its entire theme from just **3 CSS variables** (base color, accent color, contrast), auto-producing 98 CSS custom properties. It uses the LCH color space for perceptually uniform colors, a dark-first design philosophy, and borders instead of shadows for depth. The critical principle: **"not every element should carry equal visual weight"** — navigation recedes while the content area dominates. For an exam prep app, this means your question content and performance data should command attention while chrome stays minimal.

**Material Design 3's three-tier token architecture** provides the most rigorous theming model: reference tokens (raw hex/pixel values) → system tokens (141 semantic tokens like `md-sys-color-primary`) → component tokens (per-component, referencing system tokens). This hierarchy ensures that changing a single system token cascades correctly through every component. shadcn/ui approximates this with its semantic CSS variable pairs (`--primary` / `--primary-foreground`).

**IBM Carbon** contributes the **8px spacing grid** (with a 2px mini unit for fine adjustments) and two typography modes — productive (product interfaces) and expressive (marketing/display). Its IBM Plex typeface family includes sans, serif, and mono variants designed for data-dense enterprise interfaces. Carbon's data visualization guidelines are particularly thorough for clinical dashboards.

**Apple's HIG** establishes the gold standard for typography hierarchy: a complete text style scale from Large Title (34pt) down to Caption2 (11pt), with Dynamic Type that scales everything based on user accessibility settings. The minimum **44×44pt touch target** and **8pt minimum padding** rules are non-negotiable for a PWA used by medical students on mobile.

**For medical education specifically**, the patterns from AMBOSS, UWorld, and Anki define the genre. AMBOSS uses a **split-panel architecture** — questions on the left, linked reference articles on the right — with difficulty ratings on a 1–5 "hammer" scale. UWorld simulates the actual Prometric exam interface with timed blocks of 40 questions. Anki's statistics dashboard displays **review heatmaps, retention rates, interval distributions, and daily review counts**. The FSRS (Free Spaced Repetition Scheduler) algorithm, integrated since Anki v23.10 and trained on 700 million+ reviews, is the state of the art for scheduling.

---

## Clinical color coding follows established medical conventions

Medical software uses a **traffic-light model** deeply ingrained in clinical practice: green for safe/normal, amber for caution, red for crisis, blue for life-threatening emergency. Hospital wristband standards (red = allergy, yellow = fall risk, purple = DNR) and lab result coding reinforce these associations. A medical education app should map its semantic color tokens to these conventions:

- `--clinical-normal` (green): Correct answers, mastered content, safe indicators
- `--clinical-warning` (amber): Borderline performance, content needing review
- `--clinical-critical` (red): Incorrect answers, failed items, urgent review needed
- `--clinical-info` (blue): Neutral clinical data, informational elements

**Color must never be the sole means of conveying information** (WCAG 1.4.1). Always pair color with icons, text labels, or patterns — critical for the ~8% of male users with color vision deficiency. Implement these as OKLCH CSS custom properties with shadcn/ui's `background`/`foreground` pair convention, overridden in `.dark` for dark mode.

---

## AI tools, icons, and typography for the solo developer

**v0.dev** (by Vercel) is the most practical AI tool for a React + Tailwind developer. It generates components aligned with shadcn/ui patterns via chat-based iteration, producing clean, editable React code. Use it to rapidly scaffold dashboard layouts, form interfaces, and data display components, then customize the output. **Figma AI** has become the most comprehensive design platform, with Figma Make generating interactive prototypes from prompts and a new Code-to-Canvas feature that reverse-engineers code into editable designs. **Locofy.ai** is the best Figma-to-code converter if you design in Figma first, with AI-powered auto-layout optimization and React/Next.js export. Galileo AI was acquired by Google in May 2025 and rebranded as **Google Stitch**, currently free in beta.

For icons, **Lucide** (1,500+ icons, ~1 KB per icon after tree-shaking) is the default choice — it ships with shadcn/ui and most AI-generated templates. Supplement with **Health Icons** (healthicons.org), a purpose-built MIT-licensed set of **400+ medical icons** covering stethoscopes, syringes, anatomy, lab equipment, and clinical workflows. If you want weight variants (thin through bold plus duotone), **Phosphor Icons** offers 1,500+ base icons across 6 weights with a dedicated **144-icon medical category**. Heroicons (by Tailwind Labs, ~300 icons in 4 styles including the new 16px Micro variant) is the tightest Tailwind integration but has the smallest set.

**Inter remains the industry standard** for data-dense dashboard typography. Its tabular figures (`font-feature-settings: "tnum"`) ensure numbers align perfectly in tables and charts — essential for score displays, timing data, and statistics. The variable font supports weights from 100 to 900 with optical sizing that adapts automatically for small text readability. Inter is used by Figma, Notion, NASA, and GitLab. **Geist Sans** (by Vercel) is the modern alternative with a geometric aesthetic influenced by Swiss design, available on Google Fonts with a companion Geist Mono for code display. For a medical education app, the recommended pairing is **Inter for body text and data** (leveraging tabular figures and tall x-height) with **Geist Mono or JetBrains Mono for code, lab values, and dosage displays**. The full Inter variable font can be subsetted to approximately **43 KB** WOFF2.

---

## Tailwind v4 and design tokens change the configuration model

Tailwind CSS v4 (released January 2025) is a fundamental shift: **configuration moves from JavaScript to CSS**. The `tailwind.config.js` file is replaced by `@theme` directives in your CSS, and a new Rust-based Oxide engine delivers **3.5–5x faster full builds** and **100x+ faster incremental builds**. Design tokens declared in `@theme` automatically generate both utility classes and CSS custom properties, unifying what were previously two separate systems.

```css
@import "tailwindcss";
@theme {
  --color-clinical-normal: oklch(0.72 0.19 142);
  --color-clinical-warning: oklch(0.80 0.16 84);
  --color-clinical-critical: oklch(0.63 0.26 29);
  --font-body: "Inter", sans-serif;
  --font-mono: "Geist Mono", monospace;
}
```

This single block creates utility classes (`text-clinical-normal`, `bg-clinical-warning`), makes the values available as CSS variables (`var(--color-clinical-normal)`), and enables Tailwind's IDE autocomplete — all without a JavaScript config file. The default color palette now uses **OKLCH**, a perceptually uniform color space that produces more consistent scales on modern P3 displays.

shadcn/ui's theming system layers on top with **semantic CSS variable pairs**: `--primary`/`--primary-foreground`, `--destructive`/`--destructive-foreground`, `--muted`/`--muted-foreground`, plus chart tokens (`--chart-1` through `--chart-5`) and a radius scale. Dark mode is handled by overriding these same variables in a `.dark` selector. The `@theme inline` pattern in v4 bridges shadcn's CSS variables into Tailwind's utility system. For multi-theme support, define additional CSS classes (`.theme-clinical`, `.theme-high-contrast`) and swap them at the root element.

The established utility stack for this architecture is **CVA** (Class Variance Authority) for component variants, **tailwind-merge** for safe class name deduplication, and **clsx** for conditional class composition. shadcn/ui's `cn()` helper wraps these into a single function. **Tailwind Plus** (formerly Tailwind UI, $299 one-time) provides 500+ professionally designed component templates — a worthwhile accelerator for a solo developer, though shadcn/ui's free components cover most needs.

---

## Concrete implementation blueprint for the PA exam prep app

The complete recommended stack, ordered by implementation priority:

| Layer | Choice | Cost | Priority |
|-------|--------|------|----------|
| CSS framework | Tailwind CSS v4 | Free | Already in place — migrate config |
| Components | shadcn/ui (Radix or Base UI) | Free | Add incrementally per feature |
| Variant system | CVA + tailwind-merge + clsx | Free | Add with first shadcn component |
| Animation | Motion v12 (LazyMotion) | Free | Add for micro-interactions |
| Charts | Tremor or shadcn/ui charts | Free | Add for dashboard analytics |
| Heatmap | @nivo/calendar | Free | Add for study activity tracking |
| Icons | Lucide + Health Icons | Free | Swap existing icons progressively |
| Typography | Inter (body) + Geist Mono (data) | Free | Single font-face swap |
| AI prototyping | v0.dev | Free tier available | Use for scaffolding new views |
| Command palette | cmdk | Free | Add ⌘K for topic/drug search |
| Design tokens | CSS variables + @theme (OKLCH) | Free | Define once in global CSS |

The critical insight for progressive adoption: **every item in this stack can be added incrementally to an existing Vite + React + Tailwind app without a rewrite.** Start by installing shadcn/ui's CLI and adding a single component. Wire up your clinical color tokens as CSS variables. Swap to Inter. Each change improves quality independently while building toward a cohesive system.

The **total additional JavaScript bundle** for animation + charts + command palette is approximately **65–80 KB gzipped** with lazy loading — well within PWA performance budgets on Cloudflare Pages. The entire component and token layer adds zero runtime JavaScript since it's Tailwind CSS utilities resolved at build time. This is a professional-grade stack used in production by OpenAI, Vercel, Adobe, and Sonos — now accessible to a solo developer building clinical education software.