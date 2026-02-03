/**
 * NavRail – Collapsible glassmorphism left rail with quick actions.
 * Persists across views; quick actions can change by active screen (e.g. Lab Values when in simulation).
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Play,
  BookOpen,
  BarChart3,
  Calculator,
  LucideIcon,
} from 'lucide-react';

export interface QuickActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
}

interface NavRailProps {
  /** Quick actions shown in rail (e.g. Resume Session, Lab Values when in clinical sim) */
  quickActions?: QuickActionItem[];
  /** Additional class for container */
  className?: string;
}

const DEFAULT_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/study' },
  { id: 'start', label: 'Start Session', icon: Play, href: '/study' },
  { id: 'reference', label: 'Reference', icon: BookOpen, href: '/study?tab=resources' },
  { id: 'analytics', label: 'Progress', icon: BarChart3, href: '/study?tab=analytics' },
  { id: 'calculators', label: 'Calculators', icon: Calculator, href: '/study/toolkit' },
];

const RAIL_WIDTH_COLLAPSED = 56;
const RAIL_WIDTH_EXPANDED = 200;

export const NavRail: React.FC<NavRailProps> = ({
  quickActions = DEFAULT_QUICK_ACTIONS,
  className = '',
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--nav-rail-width',
      `${collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED}px`,
    );
    return () => {
      document.documentElement.style.removeProperty('--nav-rail-width');
    };
  }, [collapsed]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`
        fixed left-0 top-0 z-30 flex h-screen flex-col
        border-r border-[var(--color-border)]
        bg-[var(--color-glass-bg)] backdrop-blur-xl
        shadow-[0_4px_24px_var(--color-shadow-soft)]
        ${className}
      `}
      style={{
        backgroundImage: 'var(--noise-texture)',
        backgroundBlendMode: 'overlay',
        backgroundOpacity: 0.03,
      }}
    >
      {/* Collapse toggle */}
      <div className="flex h-14 items-center justify-end border-b border-[var(--color-border)] px-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          aria-label={collapsed ? 'Expand rail' : 'Collapse rail'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Quick actions */}
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Quick actions">
        <ul className="space-y-1">
          {quickActions.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            );

            const baseClass =
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';

            if (item.href) {
              const isActive =
                location.pathname === item.href ||
                (item.href !== '/study' && location.pathname.startsWith(item.href));
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className={`${baseClass} ${isActive ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : ''}`}
                  >
                    {content}
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.id}>
                <button type="button" onClick={item.onClick} className={baseClass}>
                  {content}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </motion.aside>
  );
};

export default NavRail;
