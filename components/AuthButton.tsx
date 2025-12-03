/**
 * Authentication button component
 * Shows sign in/sign out and user profile
 */

import React, { useState } from 'react';
import { SignIn, SignOutButton, UserButton, useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Cloud, CloudOff } from 'lucide-react';

interface AuthButtonProps {
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  syncError?: string | null;
}

export function AuthButton({ isSyncing, lastSyncTime, syncError }: AuthButtonProps) {
  const { isSignedIn, user, isLoaded } = useUser();
  const [showSignIn, setShowSignIn] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] animate-pulse" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <>
        <motion.button
          onClick={() => setShowSignIn(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors text-sm font-medium"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <User className="w-4 h-4" />
          Sign In
        </motion.button>

        <AnimatePresence>
          {showSignIn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => setShowSignIn(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl p-2"
              >
                <SignIn 
                  appearance={{
                    elements: {
                      rootBox: 'mx-auto',
                      card: 'bg-transparent shadow-none',
                    },
                  }}
                  afterSignInUrl="/"
                  afterSignUpUrl="/"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Sync Status Indicator */}
      <div className="flex items-center gap-2 text-xs">
        {isSyncing ? (
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Cloud className="w-4 h-4 animate-pulse" />
            <span>Syncing...</span>
          </div>
        ) : syncError ? (
          <div className="flex items-center gap-1.5 text-red-500">
            <CloudOff className="w-4 h-4" />
            <span>Sync error</span>
          </div>
        ) : lastSyncTime ? (
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Cloud className="w-4 h-4" />
            <span>Synced</span>
          </div>
        ) : null}
      </div>

      {/* User Profile */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-text-muted)] hidden sm:block">
          {user?.firstName || user?.emailAddresses[0]?.emailAddress}
        </span>
        <UserButton 
          appearance={{
            elements: {
              avatarBox: 'w-9 h-9',
            },
          }}
        />
      </div>
    </div>
  );
}
