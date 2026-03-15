'use client';

import React, { useMemo } from 'react';
import { Target } from 'lucide-react';
import { BodyMapWidget } from '@/components/dashboard/BodyMapWidget';
import { RoundsButton } from '@/components/dashboard/RoundsButton';
import { useRolling360Stats } from '@/hooks/useRolling360Stats';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';

export function ResidencyCockpitSection({
  onNavigateToDrillWithSystem,
}: {
  onNavigateToDrillWithSystem: (modeId: string, system: string) => void;
}) {
  const { stats, isLoading } = useRolling360Stats();
  const weakestSet = useMemo(() => new Set(stats?.weakestSystems ?? []), [stats?.weakestSystems]);
  const weakestSystem = stats?.weakestSystems?.[0] ?? null;
  const hasData = (stats?.totalInWindow ?? 0) >= 5;
  const systemsWithData = Object.entries(stats?.systemStats ?? {}).filter(([, s]) => s.total >= 2);

  if (isLoading) return null;

  return (
    <section className="mb-6">
      <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
        Residency Cockpit
      </h3>

      <div className="flex flex-col lg:flex-row gap-6">
        {hasData && systemsWithData.length > 0 && stats?.systemStats && (
          <div className="flex-shrink-0">
            <BodyMapWidget
              systemStats={stats.systemStats}
              weakestSystems={stats.weakestSystems ?? []}
              onSystemClick={(s) => onNavigateToDrillWithSystem('system_drill', s)}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col gap-4">
          <RoundsButton
            weakestSystem={weakestSystem}
            hasData={hasData}
            onStartRounds={(system) => {
              if (system) {
                onNavigateToDrillWithSystem('system_drill', system);
              } else {
                onNavigateToDrillWithSystem('system_drill', '');
              }
            }}
          />
          {systemsWithData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {systemsWithData.slice(0, 12).map(([system, sysStats]) => {
                const isWeak = weakestSet.has(system);
                return (
                  <button
                    key={system}
                    type="button"
                    onClick={() => onNavigateToDrillWithSystem('system_drill', system)}
                    className={`
                      text-left p-4 rounded-xl border transition-all min-h-[44px]
                      bg-[var(--color-bg-primary)] border-[var(--color-border)]
                      hover:border-[var(--color-accent)]/50 hover:shadow-lg
                      ${isWeak ? 'ring-1 ring-[var(--color-accent)]/30' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {system}
                      </span>
                      {isWeak && (
                        <span className="px-1.5 py-0.5 bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs rounded">
                          Weak
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {sysStats.accuracy.toFixed(0)}% · {sysStats.total} q
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
