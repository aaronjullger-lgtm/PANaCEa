import React from 'react';

interface ComparisonProps {
  targetCondition: string;
  selectedCondition?: string; // If they missed it
  distinguishers: string[];
  comparisonTable?: Record<string, { differs: string }>;
}

export function ContrastiveComparisonTable({
  targetCondition,
  selectedCondition,
  distinguishers,
}: ComparisonProps) {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mt-4">
      <h3 className="text-lg font-semibold mb-2 text-[var(--color-text-primary)]">✓ Correct! {targetCondition}</h3>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          🔑 Key Distinguishers
        </h4>
        <ul className="list-disc pl-5 space-y-1">
          {distinguishers.map((d, i) => (
            <li key={i} className="text-[var(--color-text-primary)]">
              {d}
            </li>
          ))}
        </ul>
      </div>

      {/* If we had more data for comparisonTable, we'd render it here.
                For now, we focus on the key distinguishers of the target. */}
    </div>
  );
}
