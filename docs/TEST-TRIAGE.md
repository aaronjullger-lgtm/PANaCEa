# Vitest Test Triage

Sprint 7 prerequisite: identify every failing Vitest file, decide "fix now"
vs "exclude with sunset date", then promote `test-full` from advisory to
blocking in `ci.yml`.

Last updated: 2026-04-18.

---

## The goal

`CLAUDE.md` records: **"3200+ tests passing (205/213 test files)"** —
8 test files are known to fail, mostly from React 19 + testing library
compat friction. They must be either fixed or explicitly excluded from the
Vitest run before we can promote the full-suite job to blocking.

Leaving them in limbo is the worst option: advisory runs get ignored,
flakes normalize, and real regressions hide in the noise.

---

## Step 1 — measure the real failure set first

**Do not trust the static guesses below without measurement.** The actual
failing files may have changed since CLAUDE.md was written. The earliest
work in this triage is to produce a concrete failing-file list.

```bash
# Run the full suite, save JSON results for parsing.
NODE_OPTIONS="--max-old-space-size=4096" \
  npx vitest run --reporter=json --outputFile=.test-results.json

# Extract the failing files.
node -e "
  const r = JSON.parse(require('fs').readFileSync('.test-results.json','utf8'));
  const failed = r.testResults.filter(t => t.status === 'failed');
  console.log('Failing files:', failed.length);
  failed.forEach(t => console.log('  -', t.name));
"
```

Commit the resulting list to this doc under **"Actual failing files
(as of YYYY-MM-DD)"**. Everything downstream depends on that list.

---

## Step 2 — suspected failing files (static audit)

Based on `CLAUDE.md` hints ("React 19 compat issues in admin, Goals,
offline tests") plus static inspection of the test files, these are the
likely candidates. All contain `@testing-library/react` renders of
components that use `useAuth`, `fetch`, `framer-motion`, or sonner.

### A. Admin panels (4 files)

| File | Lines | Suspected issue |
|---|---:|---|
| `tests/components/admin/BulkApprovalPanel.test.tsx` | ~200 | `framer-motion` motion.div mock strips props; React 19 may flag unknown DOM attrs |
| `tests/components/admin/MappingEnrichmentDashboard.test.tsx` | ~300 | Heavy child-component mocking; async state transitions not wrapped in `act()` |
| `tests/components/admin/SuggestionTable.test.tsx` | ~250 | Similar to above |
| `tests/components/admin/mapping-enrichment/ChangePreviewModal.test.tsx` | ~150 | Modal portal rendering + async fetch |

**Note:** Spot-checking via `vitest run tests/components/admin/` on
2026-04-18 showed these passing individually in ~5s each. If they pass
in isolation but fail in the full suite, the issue is test-order /
mock leakage, not React 19 per se.

### B. Goals dashboard (1 file)

| File | Lines | Suspected issue |
|---|---:|---|
| `tests/components/Goals/GoalsDashboard.test.tsx` | ~400 | `QueryClientProvider` + Clerk mock + async state; React 19 may require `await act()` around `fireEvent` that triggers queries |

### C. Offline sync (3 files)

| File | Lines | Suspected issue |
|---|---:|---|
| `tests/components/offline/OfflineSyncIndicator.test.tsx` | ~200 | Module-scope mutable state (`syncStatusState`, `onlineState`) leaks across tests |
| `tests/cms/offlineSync.test.ts` | ~300 | Overrides `global.localStorage` per-test; fights vitest.setup.ts `ensureLocalStorage()` |
| `tests/useDrillFSRS-offline-fallback.test.ts` | ~250 | Hook test with navigator.onLine toggling |

That's **8 candidates**, matching the 8-file count in CLAUDE.md.

---

## Step 3 — per-file disposition

For each actually-failing file, pick one of three dispositions:

### 3a. Fix now (preferred)

Criteria: fix is <30 min of work, root cause is clear, regression risk low.

Common fixes for React 19 + testing-library:

1. **Wrap `fireEvent` that triggers async state in `await act()`**
   ```tsx
   // Before
   fireEvent.click(screen.getByText('Save'));
   await screen.findByText('Saved');

   // After
   await act(async () => {
     fireEvent.click(screen.getByText('Save'));
   });
   expect(await screen.findByText('Saved')).toBeTruthy();
   ```

2. **Use `findBy*` instead of `getBy*` after state updates**
   ```tsx
   // Before
   expect(screen.getByText(/No goals yet/i)).toBeTruthy();

   // After
   expect(await screen.findByText(/No goals yet/i)).toBeTruthy();
   ```

3. **Filter motion props from framer-motion mocks**
   ```tsx
   // Before
   motion: {
     div: ({ children, initial, animate, exit, transition, ...props }) =>
       <div {...props}>{children}</div>,
   }

   // After — also filter whileHover, whileTap, variants, layoutId, etc.
   const motionDiv = ({
     children, initial, animate, exit, transition,
     whileHover, whileTap, variants, layoutId, layout,
     ...props
   }) => <div {...props}>{children}</div>;
   ```

4. **Reset module-level test state in `beforeEach`**
   ```tsx
   const syncStatusState = { pendingCount: 0, /* ... */ };
   beforeEach(() => {
     Object.assign(syncStatusState, { pendingCount: 0, lastSyncTime: null, isOffline: false });
   });
   ```

### 3b. Skip individual test with reason

Use `it.skip('reason: Sprint-X', () => { ... })` when only one or two
tests in a file fail and the fix requires component refactor. The rest
of the file stays in the blocking set.

### 3c. Exclude file with sunset date

Last resort. Add to `vitest.config.ts` exclude list:

```ts
exclude: [
  '**/node_modules/**',
  'e2e/**',
  'temp_repos/**',
  // Sunset 2026-06-01 — React 19 + framer-motion test setup needs refactor.
  // Tracked in docs/TEST-TRIAGE.md §3c.
  'tests/components/admin/MappingEnrichmentDashboard.test.tsx',
],
```

Rules for exclusion:

- Must include a sunset date comment (max 90 days from exclusion).
- Must be tracked here (file + reason + date).
- Excluded files still need to be *opened* during the sunset sprint —
  "excluded forever" is not an allowed outcome.

---

## Step 4 — promotion criteria

Once Step 3 is complete:

1. **Two consecutive green `test-full` runs on main** (no flakes in 48h).
2. **No new `it.skip(...)` added without corresponding triage entry here.**
3. Update `.github/workflows/ci.yml`:
   - Remove `continue-on-error: true` from the `test-full` job.
   - Add `test-full` to `all-gates-pass.needs`.
4. Update `docs/CI-GATES.md` to move `test-full` from advisory to blocking.

---

## Decisions recorded

_Fill in as dispositions are made. Keep this table current — it's the
source of truth for "which tests are excluded and why"._

| File | Disposition | Owner | Date | Notes |
|---|---|---|---|---|
| _(none yet)_ | — | — | — | — |

---

## Related

- `.github/workflows/ci.yml` — where `test-full` lives as advisory.
- `docs/CI-GATES.md` — ratchet plan (item #1 is this triage).
- `vitest.config.ts` — `exclude` list + coverage thresholds.
- `vitest.setup.ts` — global test setup (localStorage, env vars).
