/**
 * IncompleteFieldBadge
 *
 * Renders when a safety-critical field is empty. Never hide safety info
 * silently — make the gap visible so students don't assume absence of a
 * warning means absence of risk.
 *
 * Used by ContentFieldRenderer (via fieldKey prop) and ConditionDetailPanel.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface IncompleteFieldBadgeProps {
  /** The field that's missing (e.g., "complications"). Used for screen readers. */
  fieldLabel?: string;
  /** Optional override for the message. */
  message?: string;
  className?: string;
}

export const IncompleteFieldBadge: React.FC<IncompleteFieldBadgeProps> = ({
  fieldLabel,
  message,
  className = '',
}) => {
  const defaultMsg = fieldLabel
    ? `${fieldLabel} not yet reviewed — may be incomplete.`
    : 'This safety field has not been reviewed and may be incomplete.';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="incomplete-field-badge"
      className={[
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        'border-[var(--color-warning,#b45309)]/40',
        'bg-[var(--color-warning,#b45309)]/10',
        'text-[var(--color-warning,#b45309)]',
        className,
      ].join(' ')}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Needs clinical review.</strong>{' '}
        <span className="opacity-90">{message ?? defaultMsg}</span>
      </span>
    </div>
  );
};

export default IncompleteFieldBadge;
