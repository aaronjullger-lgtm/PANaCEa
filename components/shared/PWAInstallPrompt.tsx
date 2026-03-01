/**
 * PWA Install Prompt Component
 *
 * Shows install prompt for Progressive Web App with enhanced features
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, WifiOff, Bell, HardDrive, RefreshCw } from 'lucide-react';
import { StandardButton, PrimaryButton, SecondaryButton } from './StandardButton';
import { usePWAEnhancer } from '@/services/pwaEnhancer';

export interface PWAInstallPromptProps {
  /** Delay before showing prompt (ms) */
  delay?: number;
  /** Minimum session duration before showing (ms) */
  minSessionDuration?: number;
  /** Whether to show offline features */
  showOfflineFeatures?: boolean;
  /** Callback when user installs the app */
  onInstall?: () => void;
  /** Callback when user dismisses the prompt */
  onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  delay = 10000,
  minSessionDuration = 30000,
  showOfflineFeatures = true,
  onInstall,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [showDetails, setShowDetails] = useState(false);

  const {
    status,
    showInstallPrompt,
    checkForUpdates,
    clearCache,
    requestNotificationPermission,
    showNotification,
    getStorageInfo,
  } = usePWAEnhancer();

  // Check if we should show the prompt
  useEffect(() => {
    // Don't show if already installed or no install prompt available
    if (status.isInstalled || !status.hasInstallPrompt || hasInteracted) {
      return;
    }

    const timer = setTimeout(() => {
      const sessionDuration = Date.now() - sessionStartTime;
      if (sessionDuration >= minSessionDuration) {
        setIsVisible(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    status.isInstalled,
    status.hasInstallPrompt,
    hasInteracted,
    delay,
    minSessionDuration,
    sessionStartTime,
  ]);

  const handleInstall = async () => {
    const installed = await showInstallPrompt();
    if (installed) {
      setHasInteracted(true);
      setIsVisible(false);
      onInstall?.();

      // Show welcome notification
      setTimeout(() => {
        showNotification('PANaCEa Installed!', {
          body: 'The app is now installed on your device. You can use it offline.',
          icon: '/pwa-192x192.png',
        });
      }, 1000);
    }
  };

  const handleDismiss = () => {
    setHasInteracted(true);
    setIsVisible(false);
    onDismiss?.();

    // Store dismissal in localStorage to avoid showing too frequently
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  const handleLearnMore = () => {
    setShowDetails(!showDetails);
  };

  const handleTestNotification = async () => {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      await showNotification('Test Notification', {
        body: "Notifications are working! You'll receive study reminders and updates.",
        icon: '/pwa-192x192.png',
      });
    }
  };

  const handleCheckUpdates = async () => {
    const updated = await checkForUpdates();
    if (updated) {
      alert('App updated successfully! Refresh to see changes.');
    } else {
      alert('App is up to date.');
    }
  };

  const handleClearCache = async () => {
    const cleared = await clearCache();
    if (cleared) {
      alert('Cache cleared successfully.');
    } else {
      alert('Failed to clear cache.');
    }
  };

  // Don't render if not visible or already installed
  if (!isVisible || status.isInstalled) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--color-category-practice)] bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] rounded-lg">
                    <Download className="w-6 h-6 text-[var(--color-category-practice)] text-[var(--color-category-practice)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Install PANaCEa App</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Get the full experience on your device
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <Smartphone className="w-4 h-4 text-[var(--color-accent)]" />
                  <span className="text-sm font-medium">App-like Experience</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <WifiOff className="w-4 h-4 text-[var(--color-accent)]" />
                  <span className="text-sm font-medium">Offline Access</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <Bell className="w-4 h-4 text-[var(--color-accent)]" />
                  <span className="text-sm font-medium">Notifications</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <HardDrive className="w-4 h-4 text-[var(--color-accent)]" />
                  <span className="text-sm font-medium">Fast Loading</span>
                </div>
              </div>
            </div>

            {/* Details Section */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                >
                  <h4 className="font-semibold mb-3">Enhanced Features</h4>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-data-pass dark:bg-data-pass/30 rounded-lg mt-0.5">
                        <WifiOff className="w-4 h-4 text-data-pass dark:text-data-pass" />
                      </div>
                      <div>
                        <h5 className="font-medium text-sm">Offline Study Mode</h5>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Continue studying without internet connection. Questions and progress sync
                          when you're back online.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mt-0.5">
                        <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h5 className="font-medium text-sm">Smart Reminders</h5>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Get notified about due reviews, study goals, and personalized
                          recommendations.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[var(--color-category-practice)] bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] rounded-lg mt-0.5">
                        <HardDrive className="w-4 h-4 text-[var(--color-category-practice)] text-[var(--color-category-practice)]" />
                      </div>
                      <div>
                        <h5 className="font-medium text-sm">Fast Performance</h5>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Loads instantly from your home screen with cached content for
                          lightning-fast sessions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Controls */}
                  {showOfflineFeatures && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                      <h5 className="font-medium text-sm mb-3">Advanced Controls</h5>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton
                          size="xs"
                          onClick={handleTestNotification}
                          icon={<Bell className="w-3 h-3" />}
                        >
                          Test Notifications
                        </SecondaryButton>
                        <SecondaryButton
                          size="xs"
                          onClick={handleCheckUpdates}
                          icon={<RefreshCw className="w-3 h-3" />}
                        >
                          Check Updates
                        </SecondaryButton>
                        <StandardButton variant="ghost" size="xs" onClick={handleClearCache}>
                          Clear Cache
                        </StandardButton>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="p-6">
              <div className="flex flex-col gap-3">
                <PrimaryButton
                  fullWidth
                  onClick={handleInstall}
                  icon={<Download className="w-5 h-5" />}
                >
                  Install App
                </PrimaryButton>

                <div className="flex gap-2">
                  <SecondaryButton fullWidth onClick={handleLearnMore}>
                    {showDetails ? 'Show Less' : 'Learn More'}
                  </SecondaryButton>
                  <StandardButton variant="ghost" fullWidth onClick={handleDismiss}>
                    Not Now
                  </StandardButton>
                </div>
              </div>

              {/* Installation Instructions */}
              {!showDetails && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)] text-center">
                    On iOS: Tap <span className="font-semibold">Share</span> →{' '}
                    <span className="font-semibold">Add to Home Screen</span>
                    <br />
                    On Android: Tap <span className="font-semibold">Menu</span> →{' '}
                    <span className="font-semibold">Install App</span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">
                  {status.isOnline ? '✅ Online' : '⚠️ Offline'}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {status.isStandalone ? '📱 Installed' : '🌐 Browser'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
