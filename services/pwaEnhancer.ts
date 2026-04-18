// @ts-nocheck -- TS debt backlog
/**
 * PWA Enhancer Service
 *
 * Enhanced Progressive Web App features for better offline experience,
 * install prompts, and background sync
 */

import { useEffect, useState, useCallback } from 'react';

export interface PWAInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAStatus {
  isInstalled: boolean;
  isStandalone: boolean;
  isOnline: boolean;
  hasInstallPrompt: boolean;
  storageEstimate: StorageEstimate | null;
  supportsBackgroundSync: boolean;
  supportsNotifications: boolean;
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  usagePercentage: number;
}

export class PWAEnhancer {
  private static instance: PWAEnhancer;
  private installPromptEvent: PWAInstallPromptEvent | null = null;
  private status: PWAStatus = {
    isInstalled: false,
    isStandalone: false,
    isOnline: true,
    hasInstallPrompt: false,
    storageEstimate: null,
    supportsBackgroundSync: false,
    supportsNotifications: false,
  };
  private listeners: Array<(status: PWAStatus) => void> = [];

  private constructor() {
    this.initialize();
  }

  static getInstance(): PWAEnhancer {
    if (!PWAEnhancer.instance) {
      PWAEnhancer.instance = new PWAEnhancer();
    }
    return PWAEnhancer.instance;
  }

  private initialize(): void {
    // Check if app is installed as PWA
    this.status.isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    // Check if app is installed (for iOS)
    this.status.isInstalled =
      this.status.isStandalone || localStorage.getItem('pwa_installed') === 'true';

    // Check online status
    this.status.isOnline = navigator.onLine;

    // Check browser capabilities
    this.status.supportsBackgroundSync = 'serviceWorker' in navigator && 'SyncManager' in window;
    this.status.supportsNotifications = 'Notification' in window && 'serviceWorker' in navigator;

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnlineStatusChange);
    window.addEventListener('offline', this.handleOnlineStatusChange);

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt as EventListener);

    // Listen for app installed event
    window.addEventListener('appinstalled', this.handleAppInstalled);

    // Check storage estimate
    this.checkStorageEstimate();

    // Register service worker if not already registered
    this.registerServiceWorker();
  }

  private handleOnlineStatusChange = () => {
    this.status.isOnline = navigator.onLine;
    this.notifyListeners();
  };

  private handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    this.installPromptEvent = e as PWAInstallPromptEvent;
    this.status.hasInstallPrompt = true;
    this.notifyListeners();
  };

  private handleAppInstalled = () => {
    this.status.isInstalled = true;
    this.status.hasInstallPrompt = false;
    localStorage.setItem('pwa_installed', 'true');
    this.notifyListeners();
  };

  private async checkStorageEstimate(): Promise<void> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        this.status.storageEstimate = {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          usagePercentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0,
        };
        this.notifyListeners();
      } catch (error) {
        console.warn('Failed to get storage estimate:', error);
      }
    }
  }

  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('ServiceWorker registration successful with scope:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker installed. Refresh to update.');
              }
            });
          }
        });
      } catch (error) {
        console.error('ServiceWorker registration failed:', error);
      }
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener({ ...this.status }));
  }

  /**
   * Subscribe to PWA status changes
   */
  subscribe(listener: (status: PWAStatus) => void): () => void {
    this.listeners.push(listener);
    // Immediately call with current status
    listener({ ...this.status });

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current PWA status
   */
  getStatus(): PWAStatus {
    return { ...this.status };
  }

  /**
   * Show install prompt if available
   */
  async showInstallPrompt(): Promise<boolean> {
    if (!this.installPromptEvent) {
      return false;
    }

    try {
      this.installPromptEvent.prompt();
      const choice = await this.installPromptEvent.userChoice;

      if (choice.outcome === 'accepted') {
        this.status.isInstalled = true;
        this.status.hasInstallPrompt = false;
        localStorage.setItem('pwa_installed', 'true');
        this.notifyListeners();
        return true;
      } else {
        this.status.hasInstallPrompt = false;
        this.notifyListeners();
        return false;
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  /**
   * Check for app updates
   */
  async checkForUpdates(): Promise<boolean> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        return true;
      } catch (error) {
        console.error('Update check failed:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<boolean> {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));

        // Clear storage estimate
        this.status.storageEstimate = null;
        this.notifyListeners();

        return true;
      } catch (error) {
        console.error('Cache clearing failed:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!this.status.supportsNotifications) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.notifyListeners();
      return permission;
    } catch (error) {
      console.error('Notification permission request failed:', error);
      return 'denied';
    }
  }

  /**
   * Show notification
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.status.supportsNotifications || Notification.permission !== 'granted') {
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          ...options,
        });
      } catch (error) {
        console.error('Notification failed:', error);
      }
    }
  }

  /**
   * Register background sync
   */
  async registerBackgroundSync(tag: string): Promise<boolean> {
    if (!this.status.supportsBackgroundSync) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      return true;
    } catch (error) {
      console.error('Background sync registration failed:', error);
      return false;
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{
    total: number;
    used: number;
    available: number;
    percentage: number;
  }> {
    if (this.status.storageEstimate) {
      return {
        total: this.status.storageEstimate.quota,
        used: this.status.storageEstimate.usage,
        available: this.status.storageEstimate.quota - this.status.storageEstimate.usage,
        percentage: this.status.storageEstimate.usagePercentage,
      };
    }

    await this.checkStorageEstimate();
    if (this.status.storageEstimate) {
      return {
        total: this.status.storageEstimate.quota,
        used: this.status.storageEstimate.usage,
        available: this.status.storageEstimate.quota - this.status.storageEstimate.usage,
        percentage: this.status.storageEstimate.usagePercentage,
      };
    }

    return {
      total: 0,
      used: 0,
      available: 0,
      percentage: 0,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    window.removeEventListener('online', this.handleOnlineStatusChange);
    window.removeEventListener('offline', this.handleOnlineStatusChange);
    window.removeEventListener(
      'beforeinstallprompt',
      this.handleBeforeInstallPrompt as EventListener
    );
    window.removeEventListener('appinstalled', this.handleAppInstalled);
    this.listeners = [];
  }
}

/**
 * React hook for PWA features
 */
export function usePWAEnhancer(): {
  status: PWAStatus;
  showInstallPrompt: () => Promise<boolean>;
  checkForUpdates: () => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
  registerBackgroundSync: (tag: string) => Promise<boolean>;
  getStorageInfo: () => Promise<ReturnType<PWAEnhancer['getStorageInfo']>>;
} {
  const [status, setStatus] = useState<PWAStatus>(PWAEnhancer.getInstance().getStatus());

  useEffect(() => {
    const enhancer = PWAEnhancer.getInstance();
    const unsubscribe = enhancer.subscribe(setStatus);

    return () => {
      unsubscribe();
    };
  }, []);

  const showInstallPrompt = useCallback(async () => {
    return PWAEnhancer.getInstance().showInstallPrompt();
  }, []);

  const checkForUpdates = useCallback(async () => {
    return PWAEnhancer.getInstance().checkForUpdates();
  }, []);

  const clearCache = useCallback(async () => {
    return PWAEnhancer.getInstance().clearCache();
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    return PWAEnhancer.getInstance().requestNotificationPermission();
  }, []);

  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    return PWAEnhancer.getInstance().showNotification(title, options);
  }, []);

  const registerBackgroundSync = useCallback(async (tag: string) => {
    return PWAEnhancer.getInstance().registerBackgroundSync(tag);
  }, []);

  const getStorageInfo = useCallback(async () => {
    return PWAEnhancer.getInstance().getStorageInfo();
  }, []);

  return {
    status,
    showInstallPrompt,
    checkForUpdates,
    clearCache,
    requestNotificationPermission,
    showNotification,
    registerBackgroundSync,
    getStorageInfo,
  };
}

export default PWAEnhancer.getInstance();
