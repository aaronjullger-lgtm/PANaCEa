/**
 * PANaCEa Design Tokens — canonical barrel export
 *
 * Import tokens from `@/lib/tokens` instead of defining values inline.
 *
 *   import { color, fontFamily, radius, shadow, safetyRed } from '@/lib/tokens';
 *
 * Rule: no raw hex values outside `lib/tokens/safety.ts`. If you need a color
 * that isn't here, add the CSS var in `index.css` and expose it via
 * `lib/tokens/colors.ts`.
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './safety';
export * from './entityAccents';
export * from './dataViz';
