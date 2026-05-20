/**
 * IncidentBanner — user-safe system-status ribbon.
 *
 * Renders a dismissible banner at the top of the app when /api/health reports
 * the backend is degraded. Intentionally lightweight: no auth, no Sentry, no
 * blocking. The banner is *advisory* — study sessions still run; the banner
 * just tells the user their session data may not persist if the DB is out.
 *
 * Intended mount point: top of the authenticated app shell, below any nav.
 * Safe to leave mounted on the landing page too (it will read 'healthy' and
 * render nothing).
 *
 * Dismissal is per-tab (sessionStorage) so a user who dismisses the banner
 * during one session sees it again next time they open the app — the incident
 * may still be ongoing and worth re-flagging.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, WifiOff, X } from 'lucide-react';
import { useSystemStatus } from '@/hooks/useSystemStatus';

const DISMISS_KEY = 'panacea_incident_banner_dismissed_at';

/** How long a dismissal lasts within a tab before the banner re-shows (15m). */
const DISMISS_TTL_MS = 15 * 60 * 1000;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // sessionStorage may be unavailable in private mode — just ignore.
  }
}

export interface IncidentBannerProps {
  /** Override for testing: force visibility regardless of real status. */
  forceVisible?: boolean;
  /** Suppress the advisory health ribbon when another degraded-mode banner owns the top slot. */
  suppress?: boolean;
  /** Offset the top-level banner so fixed desktop navigation does not cover it. */
  offsetForNavRail?: boolean;
}

export const IncidentBanner: React.FC<IncidentBannerProps> = ({
  forceVisible = false,
  suppress = false,
  offsetForNavRail = false,
}) => {
  const { status, message } = useSystemStatus({ pollOnMount: !suppress });
  const [dismissed, setDismissed] = useState(() => wasRecentlyDismissed());

  // If the status flips from degraded -> healthy, drop the dismissal so the
  // next incident can surface naturally.
  useEffect(() => {
    if (status === 'healthy' && dismissed) {
      setDismissed(false);
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        // ignore
      }
    }
  }, [status, dismissed]);

  const shouldShow =
    forceVisible ||
    (!suppress && !dismissed && (status === 'unhealthy' || status === 'unreachable'));

  if (!shouldShow) return null;

  const isOffline = status === 'unreachable';
  const Icon = isOffline ? WifiOff : AlertTriangle;
  const title = isOffline
    ? 'Sync paused'
    : 'Some features are temporarily unavailable';
  const body = isOffline
    ? "Your progress is saved locally. We'll sync automatically when the connection returns."
    : message
      ? `Your progress is safe. Retry if needed, or continue with available study tools.`
      : 'Your progress is safe. Continue studying or retry the unavailable feature in a moment.';

  const handleDismiss = () => {
    markDismissed();
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full border-b border-[var(--color-data-provisional)]/40 bg-[var(--color-data-provisional)]/15 text-[var(--color-text-primary)] ${
        offsetForNavRail ? 'md:pl-[var(--nav-rail-width)]' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-start gap-3">
        <Icon
          className="w-5 h-5 mt-0.5 flex-shrink-0 text-[var(--color-data-provisional)]"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{body}</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss system status banner"
          className="flex-shrink-0 p-1 rounded-md hover:bg-[var(--color-bg-tertiary)]/60 transition-colors"
        >
          <X className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default IncidentBanner;
