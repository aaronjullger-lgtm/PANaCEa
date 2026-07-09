# Example: GOOD UI Review

Evidence-based, design-system-anchored, actionable. (Illustrative.)

---

**Screen:** Readiness dashboard card grid — reviewed at 375/768/1280px, light + dark.
**Evidence:** 6 screenshots attached (theme × 3 breakpoints).

**Findings (mapped to `ui-design-system.mdc`):**
1. ⚠️ `StatCard` value uses `text-emerald-500` (bright semantic color on a stat) → should be muted slate `--color-data-*`. (rule: data colors muted) — *fixed in `components/dashboard/StatCard.tsx`.*
2. ⚠️ Card gap inconsistent (`gap-3` vs `gap-4`) → standardized to `gap-4`. *fixed.*
3. ⚠️ Numbers not `tabular-nums` → added. *fixed.*
4. ⛔ Fixing the card radius would require editing `GlassCard` base → **not changed; needs approval** (shared primitive).

**Verification:** re-screenshotted light+dark; `rg -n "#[0-9a-fA-F]{3,6}"` clean; `npm run lint` + `npm run typecheck` pass.

**Verdict:** Pass after leaf fixes; one item deferred to human (shared primitive).
