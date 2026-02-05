# Audit Follow-Up

**Created:** February 4, 2026  
**Context:** Post 10-step improvement plan; audits run as part of Step 8.

## Audits Run

- **audit:loading** – Run in Step 1. Addressed: context-specific Loader messages in App.tsx; "Loading..." in PhotoDrillCard (alt text) and DrugReferenceLibrary (default message).
- **audit:prisma** – Invoked in Step 8 (may timeout on large codebase). Fix Prisma disconnect usage where handlers do not call `safePrismaDisconnect` in `finally`.
- **audit:zod** – Invoked in Step 8 (may timeout). Ensure all POST/PUT endpoints validate input with Zod.
- **audit:services** – Not run (time). Triage service consolidation if duplicated logic found.
- **audit:components** – Not run (time). Triage component organization if needed.

## Critical Fixes Already Done (Plan Steps 1–7)

- Loading: Context-specific messages for Command Center, Menu, Toolkit, Quiz, Admin, etc.
- Placeholders: Dashboard mock PANCE removed; UserFriendlyStatsDisplay placeholders documented; ImagingViewer fallback documented; ContentEditor basic-science copy updated.
- Menu/Start Any Session: Hint "Complete 5+ questions to unlock" in DailyPrescription.
- DiagnosticDrillHub/Polypharmacy: Comments and SITE_AUDIT section 6.1 added.
- Type safety: Manual `updatedAt` removed from contentBranchingService and registrySync; environment.ts already correct.
- Labels: config/labels.ts added; SettingsStatsModal uses ARCHIVE_AND_RESET, TO_REVIEW_LABEL, CLEAR_TO_REVIEW; CommandCenterHub comment for fix.modeIds.

## Non-Blocking Follow-Up

1. Run `npm run audit:prisma` and fix any handlers missing `safePrismaDisconnect` in `finally`.
2. Run `npm run audit:zod` and add Zod schemas to any POST/PUT without validation.
3. Replace remaining generic spinners with SkeletonLoader on high-traffic screens (see audit:loading output).
4. ~~Study Tools tab → URL sync~~ **Done:** CommandCenterHub already updates URL on tab click (`navigate(\`/study${search}\`, { replace: true })` with `?tab=resources` / `?tab=analytics`).
