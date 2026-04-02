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
import {
  X, BookOpen, FlaskConical, Heart, Stethoscope,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

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
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {icon}{title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function LabTable({ labs }: { labs: NormalLabRef[] }) {
  if (labs.length === 0) return <p className="text-xs text-gray-500">No labs linked to this topic.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-gray-500 border-b dark:border-gray-700">
          <th className="pb-1 font-medium">Lab</th>
          <th className="pb-1 font-medium">Normal Range</th>
          <th className="pb-1 font-medium">Unit</th>
        </tr>
      </thead>
      <tbody>
        {labs.map((lab, i) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
            <td className="py-1 text-gray-900 dark:text-gray-100 font-medium">{lab.name}</td>
            <td className="py-1 text-gray-600 dark:text-gray-400">{lab.normalRange}</td>
            <td className="py-1 text-gray-500">{lab.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
// ─── Main Component ──────────────────────────────────────────────────────────

export default function ClinicalQuickRefPanel({ isOpen, onClose, system, conditionId }: Props) {
  const [data, setData] = useState<QuickRefData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRef = useCallback(async () => {
    if (!system && !conditionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (system) params.set('system', system);
      if (conditionId) params.set('conditionId', conditionId);
      const res = await fetch(`/api/reference/quick-ref?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* graceful fail */ }
    finally { setLoading(false); }
  }, [system, conditionId]);

  useEffect(() => {
    if (isOpen) fetchRef();
  }, [isOpen, fetchRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />Clinical Reference
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && data && (
          <>
            <CollapsibleSection title="Vital Ranges" icon={<Heart className="w-4 h-4 text-red-500" />}>
              <div className="space-y-1">
                {data.vitalRanges.map((v, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{v.name}</span>
                    <span className="text-gray-500">{v.normalRange} {v.unit}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Normal Labs" icon={<FlaskConical className="w-4 h-4 text-blue-500" />}>
              <LabTable labs={data.normalLabs} />
            </CollapsibleSection>

            {data.relevantPearls.length > 0 && (
              <CollapsibleSection title="Clinical Pearls" icon={<Stethoscope className="w-4 h-4 text-emerald-500" />}>
                <ul className="space-y-2">
                  {data.relevantPearls.map((p, i) => (
                    <li key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      {p.content}
                      {p.source && <span className="text-gray-400 ml-1">({p.source})</span>}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
            {data.differentialFeatures.length > 0 && (
              <CollapsibleSection title="Differential Features" icon={<BookOpen className="w-4 h-4 text-purple-500" />} defaultOpen={false}>
                <div className="space-y-3">
                  {data.differentialFeatures.map((ddx, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{ddx.conditionName}</p>
                      <ul className="mt-1 space-y-0.5">
                        {ddx.distinguishingFeatures.map((f, j) => (
                          <li key={j} className="text-xs text-gray-600 dark:text-gray-400 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">
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
          <p className="text-xs text-gray-500 text-center p-6">
            Select a question to see relevant clinical references.
          </p>
        )}
      </div>
    </div>
  );
}
