# Build Chunk Triage

Last updated: 2026-05-19

## Command

```bash
npm run build
```

## Result

- Exit code: `0`
- Build tool: Vite `6.4.2`
- Modules transformed: `4634`
- Build duration: `22.50s`
- PWA precache: `154` entries, `7038.04 KiB`

## Warning

Vite emitted the standard large chunk warning:

```text
Some chunks are larger than 700 kB after minification.
```

Largest chunks shown in the build output include:

- `three.module-*.js`: `732.72 kB`, gzip `188.09 kB`
- `vendor-*.js`: `695.67 kB`, gzip `207.64 kB`
- `index-*.js`: `685.42 kB`, gzip `148.22 kB`
- `EnhancedSettingsTab-*.js`: `483.35 kB`, gzip `140.04 kB`
- `ToolkitHub-*.js`: `277.56 kB`, gzip `45.56 kB`
- `QuizView-*.js`: `269.82 kB`, gzip `60.43 kB`
- `AdminDashboard-*.js`: `265.20 kB`, gzip `29.26 kB`

## Assessment

The warning is not a build failure and appears consistent with the repo's existing bundle profile. The UI redesign adds a small lazy Review chunk:

- `ReviewPage-*.js`: `11.88 kB`, gzip `2.61 kB`

The guest-safe Knowledge route now builds as:

- `KnowledgeBaseHub-*.js`: `156.89 kB`, gzip `26.42 kB`

The redesign did not add React Three Fiber, drei, GSAP, or a new UI library.

## Recommendation

Do not block this UI redesign on the existing chunk warning. Future performance work should target:

- isolating Three.js/anatomy code behind route-level lazy imports where not already isolated
- reviewing `EnhancedSettingsTab` and `ToolkitHub` for sub-route lazy loading
- confirming `manualChunks` still groups vendor libraries intentionally
- running a post-merge bundle-size check if bundle budgets are tightened
