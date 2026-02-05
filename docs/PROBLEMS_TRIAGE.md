# Problems Triage: Stabilizing the Codebase

## 1. Initialization Error (Fixed)

**Error:** `Cannot access 'productTourShouldShow' before initialization` in `App.tsx`.

**Cause:** A **Temporal Dead Zone (TDZ)** bug. The `useEffect` that schedules the product tour was declared **above** the variables it uses in its dependency array (`productTourShouldShow`, `showProductTour`, `isOnboardingModalOpen`). When React runs the component, it evaluates the effect’s dependency array **in the same run** as the rest of the body, so those `const`/`let` values were not yet initialized.

**Fix applied:** The product-tour block (the `hasScheduledTour` ref and the `useEffect`) was **moved down** so it runs **after** all of these are declared:

- `showProductTour` / `setShowProductTour`
- `productTourShouldShow` (from `useProductTourShouldShow()`)
- `isOnboardingModalOpen`

So the effect and its dependency array are evaluated only after those variables exist. No circular dependency; purely declaration order.

---

## 2. Root-Cause Patterns (500+ Problems)

To see what’s driving the count, run:

```bash
# TypeScript errors only (by code)
npx tsc --noEmit 2>&1 | sed 's/.*error TS/TS/' | sort | uniq -c | sort -rn

# ESLint (if you use it in CI)
npx eslint . --format compact 2>&1 | head -100
```

Typical patterns and how to handle them:

| Pattern | Likely count | Source | Action |
|--------|---------------|--------|--------|
| **Unused imports / variables** | Often 100+ | ESLint `@typescript-eslint/no-unused-vars` (currently **off** in this repo) | Leave off until you fix in batches, or turn to `warn` and fix file-by-file. |
| **`any` types** | Variable | `@typescript-eslint/no-explicit-any` (currently **off**) | Keep off until you add types incrementally. |
| **Deprecation (e.g. `Question`, `useTheme`)** | Dozens | SonarQube / IDE “deprecated” hints | Treat as tech-debt: rename or replace types/hooks over time; not runtime bugs. |
| **Cognitive complexity** | Many | SonarQube “refactor function”) | Lower priority; refactor when touching the function. Can relax or disable in Sonar if it drowns out real issues. |
| **Unnecessary assertion** | Tens | SonarQube / TypeScript | Remove redundant `as T` or tighten types; safe to fix in bulk. |
| **`noUncheckedIndexedAccess`** | Can be 100+ | `tsconfig.json` | Access on `arr[i]` becomes `T | undefined`. Either fix with optional chaining / checks or temporarily set to `false` to reduce noise (weaker safety). |
| **Inline styles** | Few | E.g. Edge Tools / a11y lint | Prefer classes; fix when editing. |

So: a large share of the 500+ are often **unused vars, deprecation, complexity, and indexed access**. Real bugs are usually: **TDZ/initialization**, **null/undefined** misuse, and **wrong types** in critical paths.

---

## 3. Config Changes to Reduce Noise

### ESLint (`eslint.config.js`)

Already relaxed:

- `@typescript-eslint/no-unused-vars`: **off**
- `@typescript-eslint/no-explicit-any`: **off**
- `react-hooks/exhaustive-deps`: **off**

To **hide more noise** (e.g. from SonarQube-style rules in the IDE) without changing this file, use **Editor/IDE rule overrides** (e.g. disable “Cognitive Complexity” or “Unnecessary assertion” in the Problems view) so only **TypeScript** and **ESLint** errors show.

To **re-enable** gradually:

1. Turn `@typescript-eslint/no-unused-vars` to `"warn"` and fix one folder at a time.
2. Leave `no-explicit-any` off until you’re ready to type key modules.

### TypeScript (`tsconfig.json`)

- **`noUnusedLocals` / `noUnusedParameters`**: already **false**; TypeScript won’t report unused locals/params. Unused code is then mostly from ESLint if you turn that rule on.
- **`noUncheckedIndexedAccess`**: **true** in this repo, so every `arr[i]` is `T | undefined`. If that alone generates hundreds of errors:
  - **Option A:** Set to **false** temporarily so `arr[i]` is `T` again. Fewer errors, weaker safety.
  - **Option B:** Keep **true** and fix with `arr[i] ?? default` or optional chaining; do it by file or by subsystem.

Suggested **temporary** relaxation only if you need to unblock (revert once you fix):

```jsonc
// tsconfig.json - optional
"noUncheckedIndexedAccess": false
```

---

## 4. Bulk-Fix Strategies

1. **Unused imports**
   - Use “Organize Imports” / “Remove Unused Imports” in the editor (e.g. VS Code/Cursor) on the whole folder.
   - Or: `npx eslint --fix` if you re-enable a rule that auto-fixes unused imports.

2. **Unnecessary type assertions**
   - Search for ` as ` and remove or replace with proper types where the assertion doesn’t change the type.

3. **Deprecations**
   - `Question` → use the non-deprecated type or alias (e.g. `QuizQuestion`) everywhere and delete the deprecated one.
   - `useTheme` → replace with the recommended hook or wrapper and then remove the deprecation.

4. **Indexed access**
   - Prefer `arr.at(i)` or `arr[i] ?? default` where you expect a value; add null checks where the index might be out of bounds.

5. **Cognitive complexity**
   - Extract helpers or smaller components; do it when you’re already refactoring that file.

---

## 5. What to Focus On First

1. **Runtime / build:** Fix **initialization/TDZ** (done), **type errors in `functions/` and `lib/`** (Edge/API surface), and any **red** TypeScript errors in files you run or deploy.
2. **Noise:** Use **config + IDE** so “Problems” are mostly **TypeScript + ESLint**; hide or downgrade Sonar “refactor”/“deprecation” if they hide real bugs.
3. **Incremental cleanup:** Re-enable one rule at a time (e.g. `no-unused-vars` as warn), fix a directory, then repeat.

This keeps the app stable while you reduce the 500+ to a manageable set of real issues.
