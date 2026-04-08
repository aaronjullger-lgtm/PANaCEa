/**
 * MaintenancePage - Shown when critical API returns non-JSON (config/outage)
 *
 * Prevents white screen when API returns HTML (e.g. 502/503) and frontend
 * expects JSON. Renders a dedicated "Maintenance" UI instead.
 */

import React from 'react';
import { RefreshCw, Wrench } from 'lucide-react';

interface MaintenancePageProps {
  message?: string;
  onRetry?: () => void;
}

export function MaintenancePage({
  message = "We're experiencing technical difficulties. Please try again in a few moments.",
  onRetry,
}: MaintenancePageProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden">
        <div className="p-8 text-center">
          <div className="inline-flex p-4 bg-data-provisional/20 rounded-full mb-6">
            <Wrench className="w-12 h-12 text-data-provisional" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            Maintenance Mode
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-text-inverse)] rounded-lg font-medium transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
