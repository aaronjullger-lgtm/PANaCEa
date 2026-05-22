import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';

interface EncounterLoadingViewProps {
  onExit?: () => void;
  loadingStatusIndex: number;
  loadingStatusMessages: string[];
}

export const EncounterLoadingView: React.FC<EncounterLoadingViewProps> = ({
  onExit,
  loadingStatusIndex,
  loadingStatusMessages,
}) => {
  return (
    <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] border border-data-neutral">
              <MessageSquare className="w-6 h-6 text-data-neutral" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-data-neutral">Virtual OSCE</h1>
              <p className="text-sm text-data-neutral">Preparing your encounter…</p>
            </div>
          </div>
          {onExit && (
            <Button
              variant="ghost"
              onClick={onExit}
              aria-label="Exit"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-data-neutral-bg rounded-xl border border-data-neutral overflow-hidden animate-pulse">
              <div className="p-4 md:p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-data-neutral-bg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 bg-data-neutral-bg rounded" />
                  <div className="h-4 w-48 bg-data-neutral-bg rounded" />
                </div>
              </div>
              <div className="px-4 pb-4 md:px-6 md:pb-6 space-y-3">
                <div className="flex items-center gap-2 text-data-neutral">
                  <span className="w-2 h-2 rounded-full bg-data-neutral-bg animate-pulse" />
                  <span className="text-sm font-medium">
                    {loadingStatusMessages[loadingStatusIndex]}
                  </span>
                </div>
                <div className="h-24 bg-data-neutral-bg rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-data-neutral-bg rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral">
              <div className="h-4 w-24 bg-data-neutral-bg rounded mb-4" />
              <div className="flex gap-2">
                <div className="flex-1 h-12 bg-data-neutral-bg rounded-lg" />
                <div className="w-12 h-12 bg-data-neutral-bg rounded-lg" />
              </div>
            </div>
          </div>
          <div className="bg-data-neutral-bg rounded-xl border border-data-neutral p-4 md:p-6 min-h-[320px] flex flex-col items-center justify-center">
            <p className="text-data-neutral text-sm text-center max-w-xs">
              Conversation will appear here once the patient is ready.
            </p>
            <div className="flex items-center gap-2 mt-4 text-data-neutral">
              <div
                className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <div
                className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
