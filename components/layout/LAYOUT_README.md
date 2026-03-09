# Layout System

## Active components

- **NavRail** – Primary navigation for the study app. Mounted in App.tsx. Items come from **NAV_RAIL_ITEMS** in [config/navigation.ts](../config/navigation.ts) (single source of truth). Paths: `/study`, `/practice`, `/progress`, `/study/knowledge`, `/study/utilities`, `/study/path`. Mobile bottom bar shows the first five items with `showInBottomBar: true`.
- **AppBrand** – Shared logo + "PANaCEa" for headers (Landing and App shell). Use for consistent branding and single source for logo paths/typography.
- **PageContainer** – Shared max-width + horizontal padding (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`). Use for sections and pages (LandingPage, CommandCenterPage, dashboards).
- **SiteFooter** – Copyright + tagline for landing and full-width pages.
- **SectorGrid** – Universal navigation grid for sector/card navigation.
- **DrillShell** / **DrillShellCompact** – Standardized layout wrapper for drill modes.

## Shell structure

- **App shell**: App.tsx renders header (AppBrand + PageContainer) and NavRail; content is view-state driven. URL sync in App.tsx uses **CANONICAL_PATHS** from config/navigation.ts for 404 detection. CommandCenterHub syncs ?tab= to Study Tools.
- **Landing**: LandingPage uses AppBrand (size lg, no link) and PageContainer for sections; SiteFooter for footer.

## Deprecated (deleted)

- **MainLayout** – Previously used Sidebar; not mounted in App. Deleted as part of repository health cleanup.
- **Sidebar** – Previously used NAVIGATION_STRUCTURE; paths did not map to App view state. Deleted as part of repository health cleanup.
- **AppSidebar** – Previously used NAVIGATION_CONFIG; not mounted. Deleted as part of repository health cleanup.
- **AccountFooter** – Not used; account/sync UI lives in EnhancedSettingsTab. Deleted as part of repository health cleanup.

See [config/navigation.ts](../config/navigation.ts) for **NAV_RAIL_ITEMS** and **CANONICAL_PATHS** as the single source of truth. NAVIGATION_CONFIG and NAVIGATION_STRUCTURE are legacy; new code should use NAV_RAIL_ITEMS for the rail.
