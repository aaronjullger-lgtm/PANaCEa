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
        border-r border-slate-700/50
        bg-[#0F172A] shadow-[0_4px_24px_rgba(15,23,42,0.4)]
        ${className}
      `}
    >
      {/* Collapse toggle */}
      <div className="flex h-14 items-center justify-end border-b border-slate-700/50 px-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/60 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
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
            const isActive =
              item.href &&
              (location.pathname === item.href ||
                (item.href !== '/study' && location.pathname.startsWith(item.href)));
            const content = (
              <>
                <Icon
                  className={`h-5 w-5 shrink-0 ${isActive ? 'text-muted-amber-500' : 'text-slate-400 group-hover:text-slate-300'}`}
                  aria-hidden
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`truncate ${isActive ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            );

            const baseClass =
              'group relative flex w-full items-center gap-3 rounded-lg pl-4 pr-3 py-2.5 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A] active:scale-[0.98]';

            if (item.href) {
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className={`${baseClass} ${isActive ? '' : 'hover:bg-slate-800/40'}`}
                  >
                    {/* Liquid pill - slides between items via layoutId */}
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-pill"
                        className="absolute inset-0 bg-slate-800/50 rounded-lg z-0 border-l-4 border-l-muted-amber-500"
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
                <button type="button" onClick={item.onClick} className={`${baseClass} text-slate-400 hover:bg-slate-800/40 hover:text-slate-300`}>
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
