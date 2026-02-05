# Design System Audit

Run the design system audit to catch UI violations before they reach production.

## Commands

```bash
npm run audit:design-system        # Fails on forbidden patterns (bg-black, gray-900, etc.)
npm run audit:design-system:strict # Also reports preferred semantic token migrations
```

## What It Checks

**Forbidden (exit code 1):**
- `bg-black`, `text-black`, `border-black`, `#000`
- `bg-gray-900`, `dark:bg-gray-900` for dark backgrounds
- `text-gray-900 dark:text-white` (use `text-[var(--color-text-primary)]`)
- `bg-black/40`, `bg-black/70` (use `bg-[var(--color-overlay)]`)

**Warnings (--strict only):**
- `text-slate-900 dark:text-white` → prefer `text-[var(--color-text-primary)]`
- `border-gray-300 dark:border-gray-600` → prefer `border-[var(--color-border)]`

## CI Integration

Add to your CI pipeline to block PRs with design system violations:

```yaml
- run: npm run audit:design-system
```

## Reference

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and [.cursor/rules/ui-design-system.mdc](../../.cursor/rules/ui-design-system.mdc) for full token reference.
