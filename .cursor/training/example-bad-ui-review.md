# Example: BAD UI Review (do NOT do this)

---

"Looks great, shipped some polish. Modern gradient hero added. 👍"

- ❌ **No screenshots / no browser** — claims visual quality without evidence (automatic failure per `ui-quality-rubric.md`).
- ❌ Added a "modern gradient hero" and emoji icons — generic **AI slop** against the product identity.
- ❌ Used `#7c3aed` and `bg-black` directly — raw hex + forbidden black instead of tokens.
- ❌ Edited `GlassCard.tsx` base radius "to make it pop" — shared primitive change without approval (cascades site-wide).
- ❌ Only checked desktop light mode — no dark mode, no breakpoints.
- ❌ No `npm run lint`/`typecheck` run.

**Why it fails:** unverified, off-system, slop visuals, unsafe primitive edit, incomplete coverage.
