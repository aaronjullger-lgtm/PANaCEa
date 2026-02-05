/**
 * Layout Components Index
 * Central exports for PANaCEa layout system.
 * Active: NavRail, AppBrand, PageContainer, SiteFooter, SectorGrid, DrillShell.
 * Deprecated (not mounted in App): MainLayout, Sidebar, AppSidebar — see LAYOUT_README.md.
 */

export { NavRail } from './NavRail';
export type { QuickActionItem } from './NavRail';
export { AppBrand } from './AppBrand';
export type { AppBrandSize, AppBrandProps } from './AppBrand';
export { PageContainer } from './PageContainer';
export type { PageContainerMaxWidth, PageContainerProps } from './PageContainer';
export { SiteFooter } from './SiteFooter';
export type { SiteFooterProps } from './SiteFooter';
export { SectorGrid } from './SectorGrid';
export type { SectorItem } from './SectorGrid';
export { DrillShell, DrillShellCompact } from './DrillShell';