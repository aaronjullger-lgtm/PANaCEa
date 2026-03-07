# Stormy Slate Design System Spec

Clinical, modern aesthetic for PANaCEa: deep navy/slate backgrounds, off-white text, and **darker gold** accents. No pure black (#000000); no unauthorized saturated colors for UI chrome.

## Accent Colors

- **Primary accent (buttons, links, focus):** Darker gold `#7a6f52` (light mode), `#a89b7a` (dark mode).
- **Source of truth:** CSS variables in `index.css`:
  - `--color-accent`
  - `--color-accent-button`
  - `--color-accent-hover`
  - `--color-focus-ring`
- **Tailwind:** `.exam-mode` in `tailwind.config.js` overrides to `#7a6f52` for focus mode.

## Semantic Tokens

Use semantic tokens instead of raw Tailwind color classes:

- Backgrounds: `var(--color-bg-primary)`, `var(--color-bg-secondary)`
- Text: `var(--color-text-primary)`, `var(--color-text-muted)`
- Borders: `var(--color-border)`
- Accents: `var(--color-accent)`, `var(--color-accent-button)`
- Data: `var(--color-data-pass)`, `var(--color-data-fail)`

## When to Use

- Implementing or auditing UI for EOR, dashboard, and global chrome.
- Ensuring WCAG AA contrast (e.g. 4.5:1 for text, buttons).

## Reference

- `index.css` — root and `.dark` theme variables
- `tailwind.config.js` — exam-mode and utility overrides
- `.cursor/rules/ui-design-system.mdc` — project design rules
