---
name: form-testing
description: Test form behavior end to end — validation, error/empty/loading states, submission, and keyboard/a11y. Use when building or changing any form or input flow.
---

# Form testing

Exercise forms with valid, invalid, and edge-case input.

## When to use

- Adding/changing any form, input, or multi-step flow.

## Instructions

1. Run `npm run dev` and open the form (auth via the dev-auth URL if needed; never prod creds).
2. Test cases to cover:
   - **Empty submit** → required-field validation fires; no crash.
   - **Invalid input** → Zod/schema validation messages are clear and tied to fields (`aria-describedby`).
   - **Valid submit** → success path works; loading state shown while pending (TanStack Query mutation), then success/empty/error states render correctly.
   - **Boundary values** → very long text, unicode, leading/trailing spaces, min/max.
   - **Double submit / rapid clicks** → guarded (button disabled while pending).
   - **Keyboard only** → tab order, Enter submits, focus moves to the first error.
3. Confirm no secrets/PII are logged on submit.
4. Screenshot the validation and success states.

## Verification

- All cases above exercised in the browser with screenshots for validation + success.
- Client validation mirrors server (Zod) expectations; server still validates (never trust client).
- No console errors; no unhandled promise rejections.

## Failure recovery

- Missing loading state → add one (use existing spinner/skeleton components).
- Validation only client-side → ensure the endpoint validates with Zod too.
- If the submit hits a backend that's unavailable locally, test client validation/states and document the backend gap.
