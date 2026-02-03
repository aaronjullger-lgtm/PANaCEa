import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { getNavigationWithIcons, NavigationCategory } from '../../config/navigation';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose, className = '' }) => {
  const location = useLocation();
  const navigation = getNavigationWithIcons();

  const isActiveRoute = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && onClose && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar - Deep Navy, Gold active states */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed md:sticky top-0 left-0 h-screen w-[280px] bg-[#0F172A] border-r border-slate-700/50 z-50 flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted-amber-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <h1 className="text-xl font-bold text-white">PANaCEa</h1>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden p-2 hover:bg-slate-800/60 rounded-lg transition-colors text-slate-400 hover:text-white"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-6">
            {navigation.map((category: NavigationCategory, categoryIndex: number) => (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.05 }}
              >
                {/* Category Label */}
                <div className="px-3 mb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {category.category}
                  </h2>
                </div>

                {/* Navigation Items */}
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const Icon = item.iconComponent;
                    const isActive = isActiveRoute(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => onClose?.()}
                        className={`
                          group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg
                          transition-all duration-200 ease-out
                          ${
                            isActive
                              ? 'bg-slate-800/40 text-white'
                              : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
                          }
                        `}
                      >
                        {/* Gold vertical pill on left edge for active */}
                        {isActive && (
                          <motion.div
                            layoutId="activeNav"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-muted-amber-500 rounded-r-full"
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          />
                        )}

                        {/* Icon */}
                        {Icon && (
                          <Icon
                            className={`
                              w-5 h-5 flex-shrink-0 transition-colors
                              ${isActive ? 'text-muted-amber-500' : 'text-slate-400 group-hover:text-slate-300'}
                            `}
                          />
                        )}

                        {/* Label */}
                        <span
                          className={`
                            flex-1 text-sm font-medium transition-colors
                            ${isActive ? 'font-semibold text-white' : 'font-normal'}
                          `}
                        >
                          {item.label}
                        </span>

                        {/* Hover Chevron */}
                        <ChevronRight
                          className={`
                            w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-slate-400
                            ${isActive ? 'opacity-100 text-muted-amber-500' : ''}
                          `}
                        />
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="w-2 h-2 bg-[var(--color-data-pass)] rounded-full animate-pulse"></div>
            <span>All systems operational</span>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
