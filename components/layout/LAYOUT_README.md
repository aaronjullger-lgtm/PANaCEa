# Layout System

## Active components

- **NavRail** – Primary navigation for the study app. Mounted in App.tsx; uses paths `/study`, `/menu`, `/study?tab=resources`, `/study?tab=analytics`, `/study/toolkit`.
- **AppBrand** – Shared logo + "PANaCEa" for headers (Landing and App shell). Use for consistent branding and single source for logo paths/typography.
- **PageContainer** – Shared max-width + horizontal padding (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`). Use for sections and pages (LandingPage, CommandCenterPage, dashboards).
- **SiteFooter** – Copyright + tagline for landing and full-width pages.
- **SectorGrid** – Universal navigation grid for sector/card navigation.
- **DrillShell** / **DrillShellCompact** – Standardized layout wrapper for drill modes.

## Shell structure

- **App shell**: App.tsx renders header (AppBrand + PageContainer) and NavRail; content is view-state driven. URL sync in App.tsx and CommandCenterHub.
- **Landing**: LandingPage uses AppBrand (size lg, no link) and PageContainer for sections; SiteFooter for footer.

## Deprecated (not mounted)

- **MainLayout** – Uses Sidebar; not mounted in App. Kept for future route-based layouts.
- **Sidebar** – Uses NAVIGATION_STRUCTURE; paths do not map to App view state. Not mounted.
- **AppSidebar** – Uses NAVIGATION_CONFIG; not mounted.
- **AccountFooter** – Not used; account/sync UI lives in EnhancedSettingsTab. File kept for possible future footer bar.

See `config/navigation.ts` for NavRail as the only active nav and NAVIGATION_STRUCTURE/NAVIGATION_CONFIG as reference.
