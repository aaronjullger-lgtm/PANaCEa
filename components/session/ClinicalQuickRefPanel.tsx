/**
 * ClinicalQuickRefPanel — In-session clinical reference drawer
 *
 * Opens on-demand during a quiz session to show normal labs, vital ranges,
 * clinical pearls, and differential features relevant to the current question.
 * Students never need to leave the session to look up clinical info.
 *
 * Sprint 4B — April 2026
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  X, BookOpen, FlaskConical, Heart, Stethoscope,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { InlineSpinner } from '@/components/loading';

// ─── Types (mirrors clinicalQuickRefService) ─────────────────────────────────

interface NormalLabRef { name: string; normalRange: string; unit: string; clinicalSignificance?: string; }
interface VitalRef { name: string; normalRange: string; unit: string; }
interface ClinicalPearlRef { content: string; source?: string; conditionName?: string; }
interface DifferentialFeature { conditionName: string; distinguishingFeatures: string[]; }

interface QuickRefData {
  normalLabs: NormalLabRef[];
  vitalRanges: VitalRef[];
  relevantPearls: ClinicalPearlRef[];
  differentialFeatures: DifferentialFeature[];
  relatedConditions: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  system?: string;
  conditionId?: string;
}
// ─── Sub-Components ──────────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="last:border-0" style={{ boxShadow: 'inset 0 -1px 0 0 var(--color-border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--color-bg-tertiary)] transition-colors duration-200"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          {icon}{title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function LabTable({ labs }: { labs: NormalLabRef[] }) {
  if (labs.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No labs linked to this topic.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[var(--color-text-muted)]" style={{ boxShadow: 'inset 0 -1px 0 0 var(--color-border)' }}>
          <th className="pb-1 font-medium">Lab</th>
          <th className="pb-1 font-medium">Normal Range</th>
          <th className="pb-1 font-medium">Unit</th>
        </tr>
      </thead>
      <tbody>
        {labs.map((lab, i) => (
          <tr key={i} className="last:border-0" style={{ boxShadow: 'inset 0 -1px 0 0 var(--color-border)' }}>
            <td className="py-1 text-[var(--color-text-primary)] font-medium">{lab.name}</td>
            <td className="py-1 text-[var(--color-text-secondary)]">{lab.normalRange}</td>
            <td className="py-1 text-[var(--color-text-muted)]">{lab.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
// ─── Main Component ──────────────────────────────────────────────────────────

export default function ClinicalQuickRefPanel({ isOpen, onClose, system, conditionId }: Props) {
  const { getToken } = useAuth();
  const [data, setData] = useState<QuickRefData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRef = useCallback(async () => {
    if (!system && !conditionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (system) params.set('system', system);
      if (conditionId) params.set('conditionId', conditionId);
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/reference/quick-ref?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (refErr) {
      console.warn('[ClinicalQuickRefPanel] Fetch failed', refErr);
    }
    finally { setLoading(false); }
  }, [system, conditionId, getToken]);

  useEffect(() => {
    if (isOpen) fetchRef();
  }, [isOpen, fetchRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[var(--color-bg-secondary)] shadow-xl z-50 flex flex-col" style={{ boxShadow: '-1px 0 0 0 var(--color-border), -4px 0 12px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3" style={{ boxShadow: 'inset 0 -1px 0 0 var(--color-border)' }}>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <BookOpen className="w-4 h-4" />Clinical Reference
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors duration-200" aria-label="Close clinical reference panel">
          <X className="w-4 h-4 text-[var(--color-text-muted)]" />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
            <InlineSpinner size="md" className="text-[var(--color-text-muted)]" />
          </div>
        )}

        {!loading && data && (
          <>
            <CollapsibleSection title="Vital Ranges" icon={<Heart className="w-4 h-4 text-[var(--color-data-fail)]" />}>
              <div className="space-y-1">
                {(data.vitalRanges ?? []).map((v, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)]">{v.name}</span>
                    <span className="text-[var(--color-text-muted)]">{v.normalRange} {v.unit}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Normal Labs" icon={<FlaskConical className="w-4 h-4 text-[var(--color-accent)]" />}>
              <LabTable labs={data.normalLabs ?? []} />
            </CollapsibleSection>

            {data.relevantPearls.length > 0 && (
              <CollapsibleSection title="Clinical Pearls" icon={<Stethoscope className="w-4 h-4 text-[var(--color-data-pass)]" />}>
                <ul className="space-y-2">
                  {data.relevantPearls.map((p, i) => (
                    <li key={i} className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      {p.content}
                      {p.source && <span className="text-[var(--color-text-muted)] ml-1">({p.source})</span>}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
            {(data.differentialFeatures ?? []).length > 0 && (
              <CollapsibleSection title="Differential Features" icon={<BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />} defaultOpen={false}>
                <div className="space-y-3">
                  {(data.differentialFeatures ?? []).map((ddx, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">{ddx.conditionName}</p>
                      <ul className="mt-1 space-y-0.5">
                        {(ddx.distinguishingFeatures ?? []).map((f, j) => (
                          <li key={j} className="text-xs text-[var(--color-text-secondary)] pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-[var(--color-text-muted)]">
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </>
        )}

        {!loading && !data && (
          <p className="text-xs text-[var(--color-text-muted)] text-center p-6">
            Select a question to see relevant clinical references.
          </p>
        )}
      </div>
    </div>
  );
}
