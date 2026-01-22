import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { NAVIGATION_CONFIG, ICON_MAP } from '../../config/navigation';
import { cn } from '../../lib/utils';

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut();
  };

  const closeMobile = () => setMobileOpen(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo/Brand */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          PANaCEa
        </h1>
        <p className="text-xs text-gray-400 mt-1">Universal Medical Companion</p>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
        {NAVIGATION_CONFIG.map((section, sectionIdx) => (
          <div key={section.category}>
            {/* Category Header */}
            <h3 className="px-3 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {section.category}
            </h3>

            {/* Navigation Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.icon];
                if (!Icon) return null;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                        'text-gray-300 hover:text-white hover:bg-gray-800/50',
                        isActive && 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            'w-5 h-5 transition-colors',
                            isActive ? 'text-blue-400' : 'text-gray-400'
                          )}
                        />
                        <span className="text-sm font-medium">{item.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId={`sidebar-indicator-${sectionIdx}`}
                            className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign Out Button */}
      <div className="px-4 py-4 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200 text-gray-300 hover:text-white hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col w-64 bg-gray-900 border-r border-gray-800 fixed inset-y-0 left-0 z-30',
          className
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobile}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 bg-gray-900 border-r border-gray-800 z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}