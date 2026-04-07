/**
 * Z-Index Scale — Semantic layering constants
 *
 * Use these instead of arbitrary z-[N] values across components.
 * Each tier reserves a range so siblings within a tier can offset ±1.
 *
 * Layer cake (bottom → top):
 *   BASE        0   — default page content
 *   RAISED      1   — cards with onClick, relative positioned children
 *   STICKY     10   — sticky headers, bottom bars, inline popovers
 *   DROPDOWN   20   — dropdowns, autocomplete lists, tooltips
 *   OVERLAY    30   — scrim / backdrop behind modals & drawers
 *   DRAWER     35   — side drawers (ClinicalQuickRefPanel, BottomSheet)
 *   MODAL      40   — centered modals, confirmation dialogs
 *   TOAST      50   — toast notifications (always above modals)
 *   ONBOARDING 60   — onboarding overlays, product tours
 */

export const Z = {
  BASE: 0,
  RAISED: 1,
  STICKY: 10,
  DROPDOWN: 20,
  OVERLAY: 30,
  DRAWER: 35,
  MODAL: 40,
  TOAST: 50,
  ONBOARDING: 60,
} as const;

export type ZLayer = keyof typeof Z;
