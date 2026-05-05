import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { SelectedWidget } from '../../model/widgetTypes';

export function WhyThisDrawer({
  open,
  onClose,
  widgets,
}: {
  open: boolean;
  onClose: () => void;
  widgets: SelectedWidget[];
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="why-this-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="why-this-title" className="text-lg font-semibold text-[var(--color-text-primary)]">Why this is shown</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            aria-label="Close why this drawer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {widgets.map((widget) => (
            <article key={`${widget.slot}-${widget.id}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{widget.id.replace(/_/g, ' ')}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{widget.attribution}</p>
              <p className="mt-2 font-mono text-xs text-[var(--color-text-muted)]">Evidence {Math.round(widget.score.evidenceQuality * 100)} · Actionability {Math.round(widget.score.actionability * 100)}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
