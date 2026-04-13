/**
 * NavRail – Responsive primary navigation.
 *
 * Mobile  (<768px): Bottom tab bar — 5 icons flush to bottom edge, no sidebar.
 * Desktop (≥768px): Collapsible sidebar rail that can fully hide.
 *
 * All links are URL-driven; App.tsx syncs path → view.
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  LucideIcon,
} from 'lucide-react';
import { NAV_RAIL_ITEMS } from '@/config/navigation';
import { useCommuter } from '@/contexts/CommuterContext';
import { usePWAEnhancer } from '@/services/pwaEnhancer';
import { SidebarItem } from '@/components/layout/SidebarItem';
import { InfoTooltipWrapper } from '@/components/shared/TooltipWrapper';

export interface QuickActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  /** Optional section key for visual grouping (e.g. "study" vs "resources") */
  section?: string;
  /** When true, show in mobile bottom bar (max 5) */
  showInBottomBar?: boolean;
}

interface NavRailProps {
  quickActions?: QuickActionItem[];
  className?: string;
}

/** Default nav items from config (single source of truth). */
const DEFAULT_QUICK_ACTIONS: QuickActionItem[] = NAV_RAIL_ITEMS.map((item) => ({
  id: item.id,
  label: item.label,
  icon: item.icon,
  href: item.path,
  section: item.section,
  showInBottomBar: item.showInBottomBar,
}));

const RAIL_WIDTH_COLLAPSED = 56;
const RAIL_WIDTH_EXPANDED = 208;

function isPathActive(href: string, pathname: string, search: string): boolean {
  const fullPath = pathname + search;
  if (href.includes('?')) return fullPath === href;
  // Normalize root / to /study so the Home rail item highlights correctly on launch.
  const normalizedPath = pathname === '/' || pathname === '' ? '/study' : pathname;
  if (href === '/study') {
    // Special case: only match the exact /study path (not /study/knowledge, /study/utilities, etc.)
    // so sub-sections like Knowledge and Tools highlight their own rail item, not Home.
    return (normalizedPath === '/study' || normalizedPath === '/study/') && !search;
  }
  return normalizedPath === href || normalizedPath.startsWith(href + '/');
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => globalThis.window?.matchMedia?.('(max-width: 767px)')?.matches === true
  );
  useEffect(() => {
    const mq = globalThis.window?.matchMedia?.('(max-width: 767px)');
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// ---------------------------------------------------------------------------
// Mobile: Bottom Tab Bar
// ---------------------------------------------------------------------------

function BottomTabBar({
  items,
  pathname,
  search,
}: {
  items: QuickActionItem[];
  pathname: string;
  search: string;
}) {
  // Take max 5 for the bottom bar
  const tabs = items.filter((i) => i.showInBottomBar !== false).slice(0, 5);

  // Light haptic tap for PWA standalone mode
  const hapticTap = () => {
    try { navigator?.vibrate?.(10); } catch { /* not available */ }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="Main navigation"
    >
      {/* Glass backdrop for mobile bottom bar — dark cinematic */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(10, 14, 26, 0.92)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
        }}
      />
      <ul className="flex items-stretch justify-evenly h-14 max-w-lg mx-auto" style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-evenly', height: '3.5rem', maxWidth: '32rem', margin: '0 auto', listStyle: 'none', padding: 0 }}>
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? isPathActive(item.href, pathname, search) : false;

          const inner = (
            <span className="flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-1">
              <Icon
                className={`h-5 w-5 transition-colors ${
                  isActive
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
                aria-hidden
              />
              <span
                className={`text-[10px] leading-none font-medium transition-colors ${
                  isActive
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.span
                  layoutId="bottom-tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                  style={{ background: '#c4b78a', boxShadow: '0 0 8px rgba(196, 183, 138, 0.4)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </span>
          );

          if (item.href) {
            return (
              <li key={item.id} className="flex-1 relative">
                <Link
                  to={item.href}
                  onClick={hapticTap}
                  className="flex items-center justify-center h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] active:scale-[0.98] transition-transform"
                  aria-current={isActive ? 'page' : undefined}
                >
                  {inner}
                </Link>
              </li>
            );
          }
          return (
            <li key={item.id} className="flex-1 relative">
              <button
                type="button"
                onClick={() => { hapticTap(); item.onClick?.(); }}
                className="flex items-center justify-center h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] active:scale-[0.98] transition-transform"
              >
                {inner}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Desktop: Sidebar Rail
// ---------------------------------------------------------------------------

export const NavRail: React.FC<NavRailProps> = ({
  quickActions = DEFAULT_QUICK_ACTIONS,
  className = '',
}) => {
  const commuterContext = useCommuter();
  const { status: pwaStatus, showInstallPrompt } = usePWAEnhancer();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(true);
  const [hidden, setHidden] = useState(false);
  const location = useLocation();
  const { pathname, search } = location;
  const showPwaInstall =
    pwaStatus.hasInstallPrompt && !pwaStatus.isInstalled && !pwaStatus.isStandalone;

  // Keyboard shortcut: [ to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        if (hidden) {
          setHidden(false);
          setCollapsed(true);
        } else if (collapsed) {
          setCollapsed(false);
        } else {
          setHidden(true);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [hidden, collapsed]);

  // Sync CSS variable for main content margin.
  // NOTE: No cleanup function — the variable must persist for the lifetime of
  // the authenticated shell. Removing it on unmount caused layout collapse
  // during AnimatePresence page transitions (see AUDIT_DASHBOARD_SHELL Finding 3).
  useEffect(() => {
    const width = hidden || isMobile ? 0 : collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED;
    document.documentElement.style.setProperty('--nav-rail-width', `${width}px`);
  }, [collapsed, hidden, isMobile]);

  // On mobile, render bottom tab bar instead
  if (isMobile) {
    return <BottomTabBar items={quickActions} pathname={pathname} search={search} />;
  }

  // Fully hidden state — just show a subtle reveal button
  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          setHidden(false);
          setCollapsed(true);
        }}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 p-1.5 rounded-r-md bg-[var(--color-bg-secondary)] border border-l-0 border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        aria-label="Show sidebar"
        title="Show sidebar (press [)"
      >
        <PanelLeftOpen className="h-3.5 w-3.5" />
      </button>
    );
  }

  const studyItems = quickActions.filter((i) => i.section === 'study' || !i.section);
  const resourceItems = quickActions.filter((i) => i.section === 'resources');

  const baseClass =
    'group relative flex w-full h-12 items-center rounded-xl px-2 transition-[padding,background-color] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] active:scale-[0.98] ' +
    (collapsed ? 'justify-center px-0' : '');

  const renderItem = (item: QuickActionItem) => {
    const isActive = item.href ? isPathActive(item.href, pathname, search) : false;

    // Create the SidebarItem component
    const sidebarItem = item.href ? (
      <SidebarItem
        as="span"
        label={item.label}
        icon={item.icon}
        active={isActive}
        collapsed={collapsed}
        iconVariant="box"
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.label}
      />
    ) : (
      <SidebarItem
        as="button"
        label={item.label}
        icon={item.icon}
        active={false}
        collapsed={collapsed}
        iconVariant="box"
        onClick={item.onClick}
        aria-label={item.label}
      />
    );

    // Wrap with tooltip if collapsed; use flex center so icon stays centered in rail (not w-full)
    const wrappedItem = collapsed ? (
      <InfoTooltipWrapper
        content={item.label}
        position="right"
        className="flex justify-center items-center"
        ariaLabel={item.label}
      >
        {sidebarItem}
      </InfoTooltipWrapper>
    ) : (
      sidebarItem
    );

    if (item.href) {
      return (
        <li key={item.id}>
          <Link
            to={item.href}
            className={`${baseClass} ${isActive ? '' : 'hover:bg-[rgba(255,255,255,0.04)]'}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <>
                <motion.div
                  layoutId="active-nav-pill"
                  className="absolute inset-0 rounded-xl z-0"
                  style={{
                    background: 'rgba(196, 183, 138, 0.08)',
                    boxShadow: '0 0 12px rgba(196, 183, 138, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  aria-hidden
                />
                <motion.span
                  layoutId="active-nav-accent"
                  className={`absolute top-1/2 z-0 h-5 w-[3px] -translate-y-1/2 rounded-full ${collapsed ? 'left-1/2 -translate-x-1/2' : 'left-1'}`}
                  style={{
                    background: 'linear-gradient(180deg, #c4b78a 0%, rgba(196, 183, 138, 0.4) 100%)',
                    boxShadow: '0 0 8px rgba(196, 183, 138, 0.4)',
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  aria-hidden
                />
              </>
            )}
            <span
              className={`relative z-10 flex h-12 items-center justify-center transition-[width] duration-200 ease-out ${collapsed ? 'w-10 shrink-0' : 'w-full'}`}
            >
              {wrappedItem}
            </span>
          </Link>
        </li>
      );
    }

    return <li key={item.id}>{wrappedItem}</li>;
  };

  const renderSection = (label: string, items: QuickActionItem[]) => (
    <div key={label} className="mb-2 first:mt-0">
      {!collapsed && (
        <div className="px-3 py-1.5">
          <span
            className="font-medium uppercase"
            style={{
              fontSize: '0.625rem',
              letterSpacing: '0.12em',
              color: '#64748b',
              borderLeft: '2px solid rgba(196, 183, 138, 0.15)',
              paddingLeft: '8px',
            }}
          >
            {label}
          </span>
        </div>
      )}
      <ul className="list-none m-0 p-0 space-y-0.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{items.map(renderItem)}</ul>
    </div>
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`scrollbar-premium ${className}`}
      style={{
        position: 'fixed',
        left: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        top: 'var(--header-height, 4rem)',
        height: 'calc(100vh - var(--header-height, 4rem))',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'rgba(10, 14, 26, 0.85)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.04)',
      }}
      aria-label="Main navigation"
    >
      {/* Header with collapse/hide controls — glass buttons */}
      <div
        className={`flex h-10 shrink-0 items-center ${collapsed ? 'justify-center px-1' : 'justify-between px-2'}`}
      >
        {!collapsed && (
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="p-1.5 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            style={{ color: '#64748b', border: '1px solid rgba(255, 255, 255, 0.06)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#f1f5f9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
            aria-label="Hide sidebar"
            title="Hide sidebar (press [)"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          style={{ color: '#64748b', border: '1px solid rgba(255, 255, 255, 0.06)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#f1f5f9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar (press [)' : 'Collapse sidebar (press [)'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 pt-2 pb-4"
        aria-label="App sections"
      >
        {renderSection('Study', studyItems)}
        {resourceItems.length > 0 && renderSection('Resources', resourceItems)}
      </nav>

      {/* PWA Install — show when browser supports install and app is not installed */}
      {showPwaInstall && (
        <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-3">
          <button
            type="button"
            onClick={() => showInstallPrompt()}
            className={`group flex w-full min-h-[44px] items-center rounded-xl py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] ${
              collapsed ? 'justify-center px-2' : 'gap-3 pl-3 pr-3'
            }`}
            title="Install PANaCEa app"
            aria-label="Install PANaCEa app"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-[var(--color-bg-tertiary)]">
              <Download className="h-5 w-5" aria-hidden />
            </span>
            {!collapsed && <span className="truncate text-sm font-medium">Install app</span>}
          </button>
        </div>
      )}

      {/* Commuter Mode quick toggle — centered when collapsed */}
      {commuterContext && (
        <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-3">
          <button
            type="button"
            onClick={commuterContext.toggleCommuterMode}
            className={`group flex w-full min-h-[44px] items-center rounded-xl py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${
              collapsed ? 'justify-center px-2' : 'gap-3 pl-3 pr-3'
            } ${
              commuterContext.isCommuterMode
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
            }`}
            title={
              commuterContext.isCommuterMode
                ? 'Disable Commuter Mode'
                : 'Enable Commuter Mode (voice + larger buttons)'
            }
            aria-label={
              commuterContext.isCommuterMode ? 'Disable Commuter Mode' : 'Enable Commuter Mode'
            }
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                commuterContext.isCommuterMode
                  ? 'bg-[var(--color-accent)]/20'
                  : 'group-hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <Headphones className="h-5 w-5" aria-hidden />
            </span>
            {!collapsed && (
              <span className="truncate text-sm font-medium">
                {commuterContext.isCommuterMode ? 'Commuter On' : 'Commuter'}
              </span>
            )}
          </button>
        </div>
      )}
    </motion.aside>
  );
};

export default NavRail;
