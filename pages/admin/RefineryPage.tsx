/**
 * RefineryPage - Content Refinery triage dashboard.
 * Wraps RefineryInbox in the standard admin full-screen overlay layout.
 * Access: same as refinery API (approver or admin).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { RefineryInbox } from '@/components/admin/refinery/RefineryInbox';
import { ROUTES } from '@/config/routes';

interface RefineryPageProps {
  onClose?: () => void;
}

export function RefineryPage({ onClose }: RefineryPageProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-primary)]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(ROUTES.ADMIN)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Back to admin dashboard"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)] truncate">
              Content Refinery
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Triage drafts, media, and questions
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <RefineryInbox />
      </div>
    </div>
  );
}

export default RefineryPage;
