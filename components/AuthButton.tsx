/**
 * Authentication button component
 * Shows sign in/sign out and user profile
 */

import React from 'react';
import { UserButton, useUser } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Cloud, CloudOff } from 'lucide-react';

interface AuthButtonProps {
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  syncError?: string | null;
}

export function AuthButton({ isSyncing, lastSyncTime, syncError }: AuthButtonProps) {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] animate-pulse" />
      </div>
    );
  }

  // This component should only be shown to authenticated users now
  // since unauthenticated users see the landing page
  if (!isSignedIn) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row items-center justify-center gap-4 p-6 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)]"
    >
      {/* User Profile Section */}
      <div className="flex items-center gap-3">
        <UserButton
          appearance={{
            elements: {
              avatarBox:
                'w-12 h-12 ring-1 ring-[var(--color-border)] bg-[var(--color-bg-primary)] dark:bg-slate-700 dark:ring-white/20',
              userButtonAvatarBox: 'dark:bg-slate-700',
              avatarImage: 'dark:brightness-110',
            },
            variables: {
              colorBackground: 'rgb(226 232 240)', // slate-200
            },
          }}
        />
        <div className="text-left">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            {user?.firstName || 'Student'}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {user?.emailAddresses[0]?.emailAddress}
          </div>
        </div>
      </div>

      {/* Sync Status Indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
        {isSyncing ? (
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <Cloud className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-medium">Syncing...</span>
          </div>
        ) : syncError ? (
          <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
            <CloudOff className="w-4 h-4" />
            <span className="text-xs font-medium">Sync error</span>
          </div>
        ) : lastSyncTime ? (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <Cloud className="w-4 h-4" />
            <span className="text-xs font-medium">Cloud synced</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Cloud className="w-4 h-4" />
            <span className="text-xs font-medium">Local only</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
