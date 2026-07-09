---
name: dark-mode-testing
description: Verify UI renders correctly in both light and dark mode using the project's tokens. Use after any styling change, since PANaCEa ships light and dark themes.
---

# Dark mode testing

Ensure both themes render correctly with the Stormy Slate token system.

## When to use

- After any color/styling change.
- When adding new components or surfaces.

## Instructions

1. Run `npm run dev` (localhost:3000) and open the target screen.
2. Toggle the theme (use the app's theme control; if unavailable, toggle the `dark` class / `prefers-color-scheme`).
3. In **both** themes verify against `.cursor/rules/ui-design-system.mdc`:
   - Only CSS variables/tokens are used — no hardcoded hex, no `#000000`/`bg-black` (dark mode uses deep navy `--color-bg-primary`, not black).
   - Text meets contrast in both themes (gold text uses `--color-accent-button`).
   - Borders, cards, and elevation use the token surfaces (`--color-bg-secondary/tertiary`, `--color-border`).
   - Data-viz colors are muted slate in both themes (not bright semantic colors).
4. Screenshot each screen in light and dark.

## Verification

- Light and dark screenshots attached.
- No unreadable/low-contrast text; no pure-black backgrounds.
- No raw hex introduced (`rg -n "#[0-9a-fA-F]{3,6}" <changed files>` — allowed only under `lib/tokens/`).

## Failure recovery

- Hardcoded color found: replace with the appropriate `--color-*` token or add a token in `index.css` and expose it via the token layer.
- Token missing for a needed shade: propose adding it to the token layer rather than inlining hex.
