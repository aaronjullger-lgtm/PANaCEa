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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed md:sticky top-0 left-0 h-screen w-[280px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                PANaCEa
              </h1>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 text-gray-500" />
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
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
                          group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-all duration-200 ease-out
                          ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }
                        `}
                      >
                        {/* Active Indicator */}
                        {isActive && (
                          <motion.div
                            layoutId="activeNav"
                            className="absolute left-0 w-1 h-8 bg-blue-600 dark:bg-blue-500 rounded-r-full"
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          />
                        )}

                        {/* Icon */}
                        {Icon && (
                          <Icon
                            className={`
                              w-5 h-5 flex-shrink-0 transition-colors
                              ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}
                            `}
                          />
                        )}

                        {/* Label */}
                        <span
                          className={`
                            flex-1 text-sm font-medium transition-colors
                            ${isActive ? 'font-semibold' : 'font-normal'}
                          `}
                        >
                          {item.label}
                        </span>

                        {/* Hover Chevron */}
                        <ChevronRight
                          className={`
                            w-4 h-4 opacity-0 group-hover:opacity-100 transition-all
                            ${isActive ? 'opacity-100' : ''}
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
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>All systems operational</span>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
