import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight, Filter, Pill, Search, Stethoscope, Activity } from 'lucide-react';
import type { ClinicalBrowsePayload, ClinicalSystem, ClinicalCategory, ClinicalCondition } from '@/services/clinicalBrowserService';
import { fetchClinicalBrowse } from '@/services/clinicalBrowserService';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/constants';

interface ClinicalLibraryProps {
  onSelectCondition?: (conditionId: string) => void;
}

const shimmer = 'bg-gradient-to-r from-transparent via-white/10 to-transparent';

export const ClinicalLibrary: React.FC<ClinicalLibraryProps> = ({ onSelectCondition }) => {
  const [data, setData] = useState<ClinicalBrowsePayload | null>(null);
  const [activeSystem, setActiveSystem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchClinicalBrowse()
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        // Default to first system with data
        const firstSystem = payload.systems[0]?.code ?? null;
        setActiveSystem(firstSystem);
        setActiveCategory(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load clinical data');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSystems: ClinicalSystem[] = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.systems;
    const term = search.toLowerCase();
    return data.systems
      .map((sys) => {
        const categories: ClinicalCategory[] = sys.categories
          .map((cat) => ({
            ...cat,
            conditions: cat.conditions.filter((c) =>
              c.name.toLowerCase().includes(term) ||
              c.subcategory.toLowerCase().includes(term) ||
              c.system.toLowerCase().includes(term)
            ),
          }))
          .filter((cat) => cat.conditions.length > 0);
        return { ...sys, categories };
      })
      .filter((sys) => sys.categories.length > 0 || sys.drugs.some((d) => d.genericName.toLowerCase().includes(term)));
  }, [data, search]);

  const activeSystemData = filteredSystems.find((s) => s.code === activeSystem) || filteredSystems[0];
  const categories = activeSystemData?.categories || [];
  const activeCategoryData = categories.find((c) => c.name === activeCategory) || categories[0];

  return (
    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--color-text-secondary)]" />
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Clinical Knowledge Browser</h3>
            <p className="text-sm text-[var(--color-text-muted)]">System → Category → Condition, backed by live database</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conditions or categories"
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0,1,2].map((key) => (
            <div key={key} className={`h-24 rounded-xl bg-[var(--color-bg-secondary)] overflow-hidden relative ${shimmer} animate-pulse`} />
          ))}
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Systems */}
          <div className="lg:col-span-1 space-y-2">
            <h4 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Systems
            </h4>
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {filteredSystems.map((system) => (
                <button
                  key={system.code}
                  onClick={() => {
                    setActiveSystem(system.code);
                    setActiveCategory(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    system.code === activeSystem
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-sm'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]/60'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-[var(--color-text-primary)]">{ABBREVIATION_TO_TOPIC_MAP[system.code as keyof typeof ABBREVIATION_TO_TOPIC_MAP] || system.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{system.categories.length} categories • {system.drugs.length} meds • {system.physiology.length} physio</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="lg:col-span-1">
            <h4 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Categories</h4>
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    cat.name === (activeCategory || activeCategoryData?.name)
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-sm'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--color-text-primary)]">{cat.name}</div>
                    <span className="text-xs text-[var(--color-text-muted)]">{cat.conditions.length} topics</span>
                  </div>
                </button>
              ))}
              {categories.length === 0 && (
                <div className="p-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm">
                  No categories for this system.
                </div>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope className="w-4 h-4 text-[var(--color-text-muted)]" />
              <h4 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Conditions</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-auto pr-1">
              {(activeCategoryData?.conditions || []).map((condition) => (
                <motion.button
                  key={condition.id}
                  onClick={() => onSelectCondition?.(condition.conditionId)}
                  whileHover={{ scale: 1.01 }}
                  className="text-left p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]/60 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[var(--color-text-primary)] mb-1">{condition.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-2">{condition.subcategory}</div>
                      {condition.overview && (
                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">{condition.overview}</p>
                      )}
                    </div>
                  </div>
                  {condition.buzzwords && condition.buzzwords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {condition.buzzwords.slice(0, 4).map((buzz) => (
                        <span key={buzz} className="px-2 py-1 text-[10px] rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                          {buzz}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.button>
              ))}
              {(activeCategoryData?.conditions || []).length === 0 && (
                <div className="p-4 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm">
                  No conditions match this filter.
                </div>
              )}
            </div>

            {/* Pharmacology + Physiology quick links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h5 className="font-semibold text-[var(--color-text-primary)]">High-yield Pharmacology</h5>
                </div>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {(activeSystemData?.drugs || []).slice(0, 8).map((drug) => (
                    <div key={drug.id} className="text-sm text-[var(--color-text-primary)] flex justify-between">
                      <span>{drug.genericName}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{drug.drugClass?.[0] || '—'}</span>
                    </div>
                  ))}
                  {(activeSystemData?.drugs || []).length === 0 && (
                    <p className="text-sm text-[var(--color-text-muted)]">No tagged medications for this system yet.</p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h5 className="font-semibold text-[var(--color-text-primary)]">Physiology Concepts</h5>
                </div>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {(activeSystemData?.physiology || []).slice(0, 8).map((concept) => (
                    <div key={concept.id} className="text-sm text-[var(--color-text-primary)]">
                      <div className="font-medium">{concept.name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{concept.category}</div>
                    </div>
                  ))}
                  {(activeSystemData?.physiology || []).length === 0 && (
                    <p className="text-sm text-[var(--color-text-muted)]">Physiology mapping coming soon for this system.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalLibrary;
