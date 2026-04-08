Run the full PANaCEa verification pipeline: typecheck + unit tests.

1. Run `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` and report pass/fail
2. Run `npx vitest run` and report test count + pass/fail
3. If either fails, show only the first error — don't dump the full log
4. Report results concisely: "typecheck: pass | tests: 254/254 pass"
