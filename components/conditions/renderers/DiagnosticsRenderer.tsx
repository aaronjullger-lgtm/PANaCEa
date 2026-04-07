import React from 'react';

interface DiagnosticsRendererProps {
  items: Record<string, string>;
}

const DiagnosticsRenderer: React.FC<DiagnosticsRendererProps> = ({ items }) => {
  if (!items || Object.keys(items).length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {Object.entries(items).map(([key, value]) => (
        <div
          key={key}
          className="flex flex-col p-4 bg-[var(--color-bg-secondary)] rounded-lg border-l-4 border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            {key.replace(/_/g, ' ')}
          </span>
          <span className="font-medium text-[var(--color-text-primary)]">{value}</span>
        </div>
      ))}
    </div>
  );
};

export default DiagnosticsRenderer;
