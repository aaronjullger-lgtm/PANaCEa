/**
 * Account Footer Component
 * A thin, persistent footer bar showing user profile and sync status
 * Clicking opens account menu with Settings, Profile, and Logout options
 */

import React, { useState } from 'react';
import { UserButton, useUser, useClerk } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, Settings, LogOut, CheckCircle, XCircle } from 'lucide-react';

interface AccountFooterProps {
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  syncError?: string | null;
  onOpenSettings?: () => void;
}

export function AccountFooter({ 
  isSyncing, 
  lastSyncTime, 
  syncError,
  onOpenSettings 
}: AccountFooterProps) {
  const { isSignedIn, user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  // Get sync status display
  const getSyncStatus = () => {
    if (isSyncing) {
      return {
        icon: <Cloud className="w-4 h-4 animate-pulse" />,
        text: 'Syncing...',
        color: 'text-blue-600 dark:text-blue-400',
      };
    }
    if (syncError) {
      return {
        icon: <XCircle className="w-4 h-4" />,
        text: 'Sync Error',
        color: 'text-red-600 dark:text-red-400',
      };
    }
    if (lastSyncTime) {
      return {
        icon: <CheckCircle className="w-4 h-4" />,
        text: 'Synced',
        color: 'text-green-600 dark:text-green-400',
      };
    }
    return {
      icon: <Cloud className="w-4 h-4" />,
      text: 'Local',
      color: 'text-[var(--color-text-muted)]',
    };
  };

  const syncStatus = getSyncStatus();

  return (
    <>
      {/* Footer Bar */}
      <motion.footer
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-secondary)]/95 backdrop-blur-xl border-t border-[var(--color-border)] shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          {/* Left: User Profile (Clickable) */}
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-8 h-8">
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8 ring-2 ring-[var(--color-accent)]/20',
                  },
                }}
              />
            </div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)] hidden sm:inline">
              {user?.firstName || 'Student'}
            </span>
          </motion.button>

          {/* Right: Sync Status (Non-clickable indicator) */}
          <div 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] ${syncStatus.color}`}
            title={syncError || 'Cloud sync status'}
          >
            {syncStatus.icon}
            <span className="text-xs font-medium hidden sm:inline">
              {syncStatus.text}
            </span>
          </div>
        </div>
      </motion.footer>

      {/* Account Menu Popup */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50"
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-16 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-20 sm:left-8 z-50 bg-[var(--color-bg-tertiary)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden max-w-xs"
            >
              {/* User Info Header */}
              <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10">
                    <UserButton 
                      appearance={{
                        elements: {
                          avatarBox: 'w-10 h-10 ring-2 ring-[var(--color-accent)]/30',
                        },
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {user?.firstName || 'Student'}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] truncate">
                      {user?.emailAddresses[0]?.emailAddress}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Options */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <Settings className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span>Account Settings</span>
                </button>

                <div className="border-t border-[var(--color-border)] my-1" />

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
