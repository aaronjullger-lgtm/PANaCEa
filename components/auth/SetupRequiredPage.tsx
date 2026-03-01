/**
 * SetupRequiredPage - Shown when Clerk publishable key is missing
 *
 * Renders a friendly setup UI instead of throwing, so users see clear
 * instructions instead of an error boundary crash.
 */

import React from 'react';
import { Settings, ExternalLink, Copy, Check } from 'lucide-react';

interface SetupRequiredPageProps {
  message?: string;
}

const DEFAULT_MESSAGE = `Missing Publishable Key for Clerk!

To fix this issue:
1. Copy env.example to .env: cp env.example .env
2. Get your Clerk publishable key from https://dashboard.clerk.com
3. Add it to .env as: VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
4. Restart the development server

See AUTHENTICATION_SETUP.md for detailed setup instructions.`;

export function SetupRequiredPage({ message = DEFAULT_MESSAGE }: SetupRequiredPageProps) {
  const [copied, setCopied] = React.useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('cp env.example .env').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden">
        <div className="p-8">
          <div className="inline-flex p-4 bg-data-provisional/20 rounded-full mb-6">
            <Settings className="w-12 h-12 text-data-provisional" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">
            Setup Required
          </h1>
          <p className="text-[var(--color-text-secondary)] whitespace-pre-line text-sm mb-6">
            {message}
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-lg font-medium transition-opacity w-fit"
            >
              <ExternalLink className="w-4 h-4" />
              Open Clerk Dashboard
            </a>
            <button
              onClick={copyCommand}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] rounded-lg font-mono text-sm w-fit transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-data-pass" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy: cp env.example .env'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
