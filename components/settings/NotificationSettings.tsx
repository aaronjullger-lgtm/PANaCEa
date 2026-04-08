/**
 * NotificationSettings — Push notification preferences panel.
 *
 * Allows students to enable/disable push notifications for SRS reminders,
 * set quiet hours, and test notifications. Shows platform support status.
 *
 * @see hooks/usePushNotifications.ts
 * @see functions/api/push/subscribe.ts
 */

'use client';

import React, { useState } from 'react';
import { Bell, BellOff, Clock, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { PushPermissionState } from '@/hooks/usePushNotifications';

interface NotificationSettingsProps {
  quietStart?: string;
  quietEnd?: string;
  onQuietHoursChange?: (start: string, end: string) => void;
  className?: string;
}

const PERMISSION_STATUS: Record<PushPermissionState, {
  icon: React.ElementType;
  label: string;
  color: string;
}> = {
  granted: {
    icon: CheckCircle,
    label: 'Notifications enabled',
    color: 'var(--color-data-pass)',
  },
  prompt: {
    icon: Bell,
    label: 'Click to enable notifications',
    color: 'var(--color-accent)',
  },
  denied: {
    icon: BellOff,
    label: 'Blocked — enable in browser settings',
    color: 'var(--color-data-fail)',
  },
  unsupported: {
    icon: AlertCircle,
    label: 'Not supported on this device',
    color: 'var(--color-text-muted)',
  },
};

export function NotificationSettings({
  quietStart = '22:00',
  quietEnd = '07:00',
  onQuietHoursChange,
  className = '',
}: NotificationSettingsProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const [localQuietStart, setLocalQuietStart] = useState(quietStart);
  const [localQuietEnd, setLocalQuietEnd] = useState(quietEnd);

  const status = PERMISSION_STATUS[permission];
  const StatusIcon = status.icon;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleQuietHoursChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') {
      setLocalQuietStart(value);
      onQuietHoursChange?.(value, localQuietEnd);
    } else {
      setLocalQuietEnd(value);
      onQuietHoursChange?.(localQuietStart, value);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Study Reminders
        </h3>
      </div>

      {/* Permission status */}
      <div className="flex items-center gap-2 mb-4">
        <StatusIcon className="w-4 h-4" style={{ color: status.color }} />
        <span className="text-sm" style={{ color: status.color }}>
          {status.label}
        </span>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Push Notifications
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Get reminders when cards are due for review
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={!isSupported || permission === 'denied' || isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
            isLoading ? 'opacity-50 cursor-wait' : ''
          }`}
          style={{
            backgroundColor: isSubscribed
              ? 'var(--color-accent)'
              : 'var(--color-bg-tertiary)',
          }}
          role="switch"
          aria-checked={isSubscribed}
          aria-label="Toggle push notifications"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-bg-primary)] transition-transform ${
              isSubscribed ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="mb-4 p-2 rounded-lg text-xs"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-data-fail) 10%, var(--color-bg-secondary))',
            color: 'var(--color-data-fail)',
          }}
        >
          {error}
        </div>
      )}

      {/* Quiet hours */}
      {isSubscribed && (
        <div
          className="p-3 rounded-lg border"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Quiet Hours (no notifications)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={localQuietStart}
              onChange={(e) => handleQuietHoursChange('start', e.target.value)}
              className="text-xs px-2 py-1 rounded border bg-transparent"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              aria-label="Quiet hours start time"
            />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              to
            </span>
            <input
              type="time"
              value={localQuietEnd}
              onChange={(e) => handleQuietHoursChange('end', e.target.value)}
              className="text-xs px-2 py-1 rounded border bg-transparent"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              aria-label="Quiet hours end time"
            />
          </div>
        </div>
      )}

      {/* Platform note */}
      {!isSupported && (
        <div className="flex items-start gap-2 mt-3">
          <Smartphone className="w-3.5 h-3.5 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Push notifications require a modern browser. On iOS, add PANaCEa to your Home Screen first.
          </p>
        </div>
      )}
    </div>
  );
}

export default NotificationSettings;
