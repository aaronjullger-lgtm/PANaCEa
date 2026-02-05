/**
 * @deprecated Not mounted in App. NavRail is the active nav. Kept for future route-based layouts.
 * See components/layout/LAYOUT_README.md and config/navigation.ts.
 */
import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * Main Layout Component
 * Provides the overall application structure with sidebar navigation
 *
 * Features:
 * - Responsive sidebar (mobile drawer, desktop sticky)
 * - Professional medical high-tech aesthetic
 * - Clean borders and subtle hover states
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[var(--color-bg-secondary)]">
      {/* Sidebar - Hidden on mobile by default */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar - Drawer */}
      <div className="md:hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header with Menu Button */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">PANaCEa</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default MainLayout;
