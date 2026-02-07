/**
 * NavRail – Primary app navigation. One clear path to each area.
 * Make sense: Home → Practice → Progress; Reference → Toolkit.
 * All links are URL-driven; App.tsx syncs path → view.
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Dumbbell,
  BarChart3,
  BookOpen,
  Calculator,
  Headphones,
  LucideIcon,
} from 'lucide-react';
import { useCommuter } from '@/contexts/CommuterContext';

export interface QuickActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  /** Optional section key for visual grouping (e.g. "study" vs "resources") */
  section?: string;
}

interface NavRailProps {
  quickActions?: QuickActionItem[];
  className?: string;
}

const RAIL_SECTIONS = ['study', 'resources'] as const;

const DEFAULT_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/study', section: 'study' },
  { id: 'practice', label: 'Practice', icon: Dumbbell, href: '/menu', section: 'study' },
  { id: 'progress', label: 'Progress', icon: BarChart3, href: '/study?tab=analytics', section: 'study' },
  { id: 'reference', label: 'Reference', icon: BookOpen, href: '/study/reference', section: 'resources' },
  { id: 'toolkit', label: 'Toolkit', icon: Calculator, href: '/study/toolkit', section: 'resources' },
];

const RAIL_WIDTH_COLLAPSED = 56;
const RAIL_WIDTH_EXPANDED = 208;

function isPathActive(href: string, pathname: string, search: string): boolean {
  const fullPath = pathname + search;
  if (href.includes('?')) return fullPath === href;
  if (href === '/study')
    return (pathname === '/' || pathname === '' || pathname === '/study' || pathname === '/study/') && !search;
  return pathname === href || pathname.startsWith(href + '/');
}

export const NavRail: React.FC<NavRailProps> = ({
  quickActions = DEFAULT_QUICK_ACTIONS,
  className = '',
}) => {
  const commuterContext = useCommuter();
  const [collapsed, setCollapsed] = useState(() => {
    return globalThis.window?.matchMedia?.('(max-width: 768px)')?.matches === true;
  });
  const location = useLocation();
  const { pathname, search } = location;

  useEffect(() => {
    const mq = globalThis.window?.matchMedia?.('(max-width: 768px)');
    const handler = () => setCollapsed((c) => (mq?.matches ? true : c));
    if (mq) {
      mq.addEventListener('change', handler);
    }
    return () => mq?.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--nav-rail-width',
      `${collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED}px`,
    );
    return () => {
      document.documentElement.style.removeProperty('--nav-rail-width');
    };
  }, [collapsed]);

  const studyItems = quickActions.filter((i) => i.section === 'study' || !i.section);
  const resourceItems = quickActions.filter((i) => i.section === 'resources');

  const renderItem = (item: QuickActionItem) => {
    const Icon = item.icon;
    const isActive = item.href ? isPathActive(item.href, pathname, search) : false;
    const content = (
      <>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            isActive
              ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
              : 'text-[var(--color-text-secondary)] group-hover:bg-[var(--color-bg-tertiary)] group-hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className={`truncate text-sm ${isActive ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'}`}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </>
    );

    const baseClass =
      'group relative flex w-full min-h-[44px] items-center gap-3 rounded-xl pl-3 pr-3 py-2.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] active:scale-[0.98]';

    if (item.href) {
      return (
        <li key={item.id}>
          <Link
            to={item.href}
            className={`${baseClass} ${isActive ? '' : 'hover:bg-[var(--color-bg-tertiary)]'}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <motion.div
                layoutId="active-nav-pill"
                className="absolute inset-0 rounded-xl bg-[var(--color-bg-tertiary)] border-l-4 border-l-[var(--color-accent)] z-0"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                aria-hidden
              />
            )}
            <span className="relative z-10 flex w-full items-center gap-3">
              {content}
            </span>
          </Link>
        </li>
      );
    }
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={item.onClick}
          className={`${baseClass} text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]`}
        >
          {content}
        </button>
      </li>
    );
  };

  const renderSection = (label: string, items: QuickActionItem[]) => (
    <div key={label} className="mb-1">
      {!collapsed && (
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {label}
          </span>
        </div>
      )}
      <ul className="space-y-0.5">
        {items.map(renderItem)}
      </ul>
    </div>
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`
        fixed left-0 z-30 flex flex-col
        border-r border-[var(--color-border)]
        bg-[var(--color-bg-primary)]/95 backdrop-blur-md
        shadow-[0_4px_24px_var(--color-shadow-soft)]
        ${className}
      `}
      style={{
        top: 'var(--header-height, 56px)',
        height: 'calc(100vh - var(--header-height, 56px))',
      }}
      aria-label="Main navigation"
    >
      <div className="flex h-12 items-center justify-end border-b border-[var(--color-border)] px-2 shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2" aria-label="App sections">
        {renderSection('Study', studyItems)}
        {resourceItems.length > 0 && renderSection('Resources', resourceItems)}
      </nav>

      {/* Commuter Mode quick toggle - PA students study on the go */}
      {commuterContext && (
        <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-3">
          <button
            type="button"
            onClick={commuterContext.toggleCommuterMode}
            className={`group flex w-full min-h-[44px] items-center gap-3 rounded-xl pl-3 pr-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${
              commuterContext.isCommuterMode
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
            }`}
            title={commuterContext.isCommuterMode ? 'Disable Commuter Mode' : 'Enable Commuter Mode (voice + larger buttons)'}
            aria-label={commuterContext.isCommuterMode ? 'Disable Commuter Mode' : 'Enable Commuter Mode'}
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
