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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur-md safe-area-bottom shadow-[0_-2px_12px_rgba(15,23,42,0.06)]"
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch justify-evenly h-14 max-w-lg mx-auto list-none m-0 p-0">
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
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[var(--color-accent)]"
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
                onClick={item.onClick}
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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navrail.collapsed');
      // Default to collapsed; respect saved preference if user has explicitly toggled
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('navrail.hidden') === 'true';
    } catch { return false; }
  });
  const location = useLocation();
  const { pathname, search } = location;
  const showPwaInstall =
    pwaStatus.hasInstallPrompt && !pwaStatus.isInstalled && !pwaStatus.isStandalone;

  // Persist sidebar state to localStorage
  useEffect(() => {
    try { localStorage.setItem('navrail.collapsed', String(collapsed)); } catch {}
  }, [collapsed]);
  useEffect(() => {
    try { localStorage.setItem('navrail.hidden', String(hidden)); } catch {}
  }, [hidden]);

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

  // Sync CSS variable for main content margin
  useEffect(() => {
    const width = hidden || isMobile ? 0 : collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED;
    document.documentElement.style.setProperty('--nav-rail-width', `${width}px`);
    return () => {
      document.documentElement.style.removeProperty('--nav-rail-width');
    };
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
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 p-1.5 rounded-r-lg bg-[var(--color-bg-secondary)] border border-l-0 border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors shadow-sm"
        aria-label="Show sidebar"
        title="Show sidebar (press [)"
      >
        <PanelLeftOpen className="h-4 w-4" />
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
            className={`${baseClass} ${isActive ? '' : 'hover:bg-[var(--color-bg-tertiary)]'}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <>
                <motion.div
                  layoutId="active-nav-pill"
                  className="absolute inset-0 rounded-xl bg-[var(--color-bg-tertiary)] z-0"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  aria-hidden
                />
                <span
                  className={`absolute top-1/2 z-0 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)] ${collapsed ? 'left-1/2 -translate-x-1/2' : 'left-2'}`}
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
    <div key={label} className="mb-3 first:mt-0">
      {!collapsed && (
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {label}
          </span>
        </div>
      )}
      <ul className="space-y-1 list-none m-0 p-0">{items.map(renderItem)}</ul>
    </div>
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`
        fixed left-0 z-40 flex flex-col
        border-r border-[var(--color-border)]
        bg-[var(--color-bg-primary)]/95 backdrop-blur-md
        shadow-[0_4px_24px_var(--color-shadow-soft),4px_0_24px_-4px_rgba(15,23,42,0.15)]
        ${className}
      `}
      style={{
        position: 'fixed',
        left: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        top: 'var(--header-height, 4rem)',
        height: 'calc(100vh - var(--header-height, 4rem))',
        backgroundColor: 'var(--color-bg-primary)',
        borderRight: '1px solid var(--color-border)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
      aria-label="Main navigation"
    >
      {/* Header with collapse/hide controls — centered when collapsed; clear separation from nav items */}
      <div
        className={`flex h-12 shrink-0 items-center border-b border-[var(--color-border)] px-2 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        {!collapsed && (
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Hide sidebar"
            title="Hide sidebar (press [)"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar (press [)' : 'Collapse sidebar (press [)'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-5 pb-4"
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
