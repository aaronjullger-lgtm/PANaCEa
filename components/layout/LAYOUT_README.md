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

## Deprecated (deleted)

- **MainLayout** – Previously used Sidebar; not mounted in App. Deleted as part of repository health cleanup.
- **Sidebar** – Previously used NAVIGATION_STRUCTURE; paths did not map to App view state. Deleted as part of repository health cleanup.
- **AppSidebar** – Previously used NAVIGATION_CONFIG; not mounted. Deleted as part of repository health cleanup.
- **AccountFooter** – Not used; account/sync UI lives in EnhancedSettingsTab. Deleted as part of repository health cleanup.

See `config/navigation.ts` for NavRail as the only active nav and NAVIGATION_STRUCTURE/NAVIGATION_CONFIG as reference.
