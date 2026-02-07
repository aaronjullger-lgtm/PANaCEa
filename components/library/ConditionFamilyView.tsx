import React, { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ChevronRight, ChevronDown, Activity, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
// import { useFetcher } from '@remix-run/react'; // Removed Remix dependency

interface ConditionFamilyViewProps {
  canonicalName: string;
  className?: string;
  onNavigate?: (id: string) => void;
}

interface FamilyMember {
  id: string;
  condition: string;
  relationshipType: 'subtype' | 'complication' | 'manifestation' | 'variant' | null;
  mastery?: number;
}

interface FamilyData {
  canonicalName: string;
  parent?: FamilyMember;
  members: FamilyMember[];
  stats?: {
    avgStability: number;
    overallMastery: 'high' | 'medium' | 'low';
    coveragePercentage: number;
  };
}

export function ConditionFamilyView({
  canonicalName,
  className,
  onNavigate,
}: ConditionFamilyViewProps) {
  // const fetcher = useFetcher<FamilyData>();
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadFamily() {
      if (!canonicalName) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/ api / conditions / family / ${encodeURIComponent(canonicalName)} `
        );
        if (res.ok) {
          const json = (await res.json()) as FamilyData | null;
          if (mounted) setData(json);
        } else {
          console.error('Failed to load family data: ', res.status, res.statusText);
        }
      } catch (e) {
        console.error('Failed to load family data', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadFamily();
    return () => {
      mounted = false;
    };
  }, [canonicalName]);

  if (loading && !data) {
    return (
      <Card className={cn('p-4 animate-pulse', className)}>
        <div className="h-6 w-1/3 bg-[var(--color-bg-tertiary)] rounded mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-[var(--color-bg-tertiary)] rounded" />
          <div className="h-4 w-5/6 bg-[var(--color-bg-tertiary)] rounded" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const subtypes = data.members.filter((m) => m.relationshipType === 'subtype');
  const complications = data.members.filter((m) => m.relationshipType === 'complication');
  const manifestations = data.members.filter(
    (m) => m.relationshipType === 'manifestation' || !m.relationshipType
  );

  const getMasteryColor = (mastery: string | undefined) => {
    if (mastery === 'high') return 'bg-green-500';
    if (mastery === 'medium') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card
      className={cn('overflow-hidden border-l-4', className, {
        'border-l-green-500': data.stats?.overallMastery === 'high',
        'border-l-yellow-500': data.stats?.overallMastery === 'medium',
        'border-l-red-500': data.stats?.overallMastery === 'low',
      })}
    >
      <div className="p-4 bg-[var(--color-bg-tertiary)]/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--color-text-muted)]" />
            {data.canonicalName} Family
          </h3>
          <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
        {data.stats && (
          <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-1">
              <span
                className={cn('w-2 h-2 rounded-full', getMasteryColor(data.stats.overallMastery))}
              />
              {data.stats.overallMastery === 'high'
                ? 'Strong'
                : data.stats.overallMastery === 'medium'
                  ? 'Developing'
                  : 'Needs Focus'}
            </div>
            <div>{data.stats.coveragePercentage}% Covered</div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {subtypes.length > 0 && (
            <section>
              <h4 className="text-xs uppercase font-bold text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Subtypes
              </h4>
              <div className="space-y-1 pl-2 border-l-2 border-[var(--color-border)] ml-1">
                {subtypes.map((m) => (
                  <MemberRow key={m.id} member={m} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          )}
          {complications.length > 0 && (
            <section>
              <h4 className="text-xs uppercase font-bold text-red-500 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Complications
              </h4>
              <div className="space-y-1 pl-2 border-l-2 border-red-100 ml-1">
                {complications.map((m) => (
                  <MemberRow key={m.id} member={m} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          )}
          {manifestations.length > 0 && (
            <section>
              <h4 className="text-xs uppercase font-bold text-blue-500 mb-2 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Manifestations
              </h4>
              <div className="space-y-1 pl-2 border-l-2 border-blue-100 ml-1">
                {manifestations.map((m) => (
                  <MemberRow key={m.id} member={m} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}

function MemberRow({
  member,
  onNavigate,
}: {
  member: FamilyMember;
  onNavigate?: (id: string) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigate?.(member.id);
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center justify-between p-2 rounded hover:bg-[var(--color-bg-tertiary)] cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
      onClick={() => onNavigate?.(member.id)}
      onKeyDown={handleKeyDown}
    >
      <span className="text-sm font-medium group-hover:text-[var(--color-accent)] transition-colors">
        {member.condition}
      </span>
      {member.mastery !== undefined && (
        <div className="w-16 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', {
              'bg-red-500': member.mastery < 50,
              'bg-yellow-500': member.mastery >= 50 && member.mastery < 80,
              'bg-green-500': member.mastery >= 80,
            })}
            style={{ width: `${member.mastery}%` }}
          />
        </div>
      )}
    </div>
  );
}
