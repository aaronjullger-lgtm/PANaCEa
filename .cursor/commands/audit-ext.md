@Codebase

Act as a Lead DevOps & QA Engineer. We are prepping for immediate production launch.
I have a robust toolchain installed (SonarQube/ESLint, Testing Library, etc.), but I need you to run the CLI versions to see the errors.

**Your Mission:**
1.  **Static Analysis (Sonar/Lint):**
    * Run `npm run lint` (or `npx eslint .`).
    * **Action:** If there are high-severity errors (unused vars, potentially crashing logic), FIX them in the code. Ignore petty styling warnings.
2.  **Logic Check (The "Quokka" equivalent):**
    * Run `npm test` (or `npm run build` to check for type errors).
    * **Action:** If the build fails or tests crash, analyze the stack trace and fix the source file.
3.  **Browser Integrity (Playwright):**
    * Run the "Hunter-Killer" Playwright script we discussed earlier: `npx playwright test _production_audit.spec.ts`.
    * **Action:** Fix any console errors or network 500s it discovers.

**Constraints:**
* Do not ask for permission to fix "Red" errors (crashes/build failures). Just fix them.
* Log any complex issues you cannot fix in `PRE_LAUNCH_AUDIT.md`.