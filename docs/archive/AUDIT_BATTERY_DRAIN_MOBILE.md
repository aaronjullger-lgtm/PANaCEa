# Battery Drain Audit (Mobile)

**Context:** Complex animations (heatmaps, radar charts, streak gradients) and heavy compute (FSRS optimization) can drain battery. Medical students on long shifts need the app to be efficient.

## 1. FSRS Optimizer — Main Thread vs Worker

**Requirement:** FSRS optimizer must not block the main thread (ideally run in a Web Worker if client-side).

**Finding:** FSRS parameter optimization runs **entirely server-side** via `POST /api/user/fsrs-params`. The client only triggers the request and receives the result. L-BFGS and all heavy computation run on the Edge/Node backend, so the main thread is never blocked.

- **Service:** `services/optimizer/fsrsOptimizer.ts` — calls `/api/user/fsrs-params`.
- **UI:** `components/settings/FSRSOptimizer.tsx` — documents server-side behavior.
- **Rule:** Any future client-side FSRS optimization (e.g. WASM) **must** run in a Web Worker.

## 2. Animation Cost — GPU Layers vs CPU Repaints

**Requirement:** Hot-streak–style gradients and radar chart rendering should use GPU-friendly layers (e.g. `transform: translateZ(0)`) and avoid expensive CPU repaints. Heavy animations should be disabled when the device is in Low Power Mode or battery is low.

**Implementation:**

- **Low Power detection:** `hooks/useLowPowerMode.ts`
  - Uses `navigator.getBattery()` (where supported): reduce when level &lt; 20% or discharging and level &lt; 30%.
  - Uses `prefers-reduced-motion: reduce` (e.g. iOS Low Power Mode can set this).
- **GPU layers:** Animated containers for momentum/streak, heatmap cells, and radar charts use `transform: translateZ(0)` (or equivalent) to promote to a compositor layer and avoid unnecessary repaints.
- **Gating:** When `useLowPowerMode()` is true, heavy animations (heatmap cell stagger, streak glow, radar entrance, momentum spring) are disabled or shortened (duration 0, no repeat).

**Components updated:**

- MomentumIndicator (hot streak / “On Fire”) — GPU layer, low-power gating.
- ActivityHeatmap — GPU layer on grid/cells, low-power: no stagger, no hover/tap scale.
- SystemRadarChart, SystemComparison (radar view), IntelligenceHub (radar) — GPU layer on chart container.
- StreakFlame — GPU layer, low-power in addition to `prefers-reduced-motion`.

## 3. References

- `hooks/useLowPowerMode.ts` — low power / reduced motion detection.
- `hooks/useReducedMotion.ts` — prefers-reduced-motion only (used where battery API is not needed).
- `index.css` — `@media (prefers-reduced-motion: reduce)` for global animation reduction.
