import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight, Filter, Pill, Search, Stethoscope, Activity, AlertCircle, RefreshCw, WifiOff, ArrowLeft } from 'lucide-react';
import type { ClinicalBrowsePayload, ClinicalSystem, ClinicalCategory, ClinicalCondition } from '@/services/clinicalBrowserService';
import { fetchClinicalBrowse, BackendUnavailableError, AuthenticationError } from '@/services/clinicalBrowserService';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/constants';
import { MedicalContentRenderer } from './MedicalContentRenderer';

interface ClinicalLibraryProps {
  onSelectCondition?: (conditionId: string) => void;
}

const shimmer = 'bg-gradient-to-r from-transparent via-white/10 to-transparent';

export const ClinicalLibrary: React.FC<ClinicalLibraryProps> = ({ onSelectCondition }) => {
  const [data, setData] = useState<ClinicalBrowsePayload | null>(null);
  const [activeSystem, setActiveSystem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<ClinicalCondition | null>(null);
  const [medicalContent, setMedicalContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'auth' | 'unavailable' | 'generic' | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    setErrorType(null);
    
    fetchClinicalBrowse()
      .then((payload) => {
        setData(payload);
        // Default to first system with data
        const firstSystem = payload.systems[0]?.code ?? null;
        setActiveSystem(firstSystem);
        setActiveCategory(null);
      })
      .catch((err) => {
        if (err instanceof AuthenticationError) {
          setError('Please sign in to access clinical content');
          setErrorType('auth');
        } else if (err instanceof BackendUnavailableError) {
          setError('Clinical database is currently unavailable. Please try again later.');
          setErrorType('unavailable');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load clinical data');
          setErrorType('generic');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch detailed medical content from database when a condition is selected
  useEffect(() => {
    if (!selectedCondition) {
      setMedicalContent(null);
      setContentError(null);
      return;
    }

    const fetchMedicalContent = async () => {
      setContentLoading(true);
      setContentError(null);

      try {
        const response = await fetch(`/api/content/${selectedCondition.conditionId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`);
        }

        const data = await response.json();
        setMedicalContent(data);
      } catch (err) {
        console.error('Error fetching medical content:', err);
        setContentError(err instanceof Error ? err.message : 'Failed to load clinical content');
        // Set basic content from registry as fallback
        setMedicalContent({
          id: selectedCondition.id,
          condition: selectedCondition.name,
          system: selectedCondition.system,
          subcategory: selectedCondition.subcategory,
          overview: selectedCondition.overview,
          buzzwords: selectedCondition.buzzwords,
        });
      } finally {
        setContentLoading(false);
      }
    };

    fetchMedicalContent();
  }, [selectedCondition]);

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
        <div className={`p-4 rounded-xl border text-sm flex items-center gap-3 ${
          errorType === 'unavailable' 
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300' 
            : errorType === 'auth'
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
        }`}>
          {errorType === 'unavailable' ? (
            <WifiOff className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="flex-1">{error}</span>
          <button 
            onClick={loadData}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 transition-colors text-xs font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
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
            
            <AnimatePresence mode="wait">
              {/* MASTER VIEW: List of Conditions */}
              {!selectedCondition && (
                <motion.div
                  key="condition-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-auto pr-1">
                    {(activeCategoryData?.conditions || []).map((condition) => (
                      <motion.button
                        key={condition.id}
                        onClick={() => setSelectedCondition(condition)}
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{condition.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{condition.subcategory}</div>
                            {condition.overview && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{condition.overview}</p>
                            )}
                          </div>
                        </div>
                        {condition.buzzwords && condition.buzzwords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {condition.buzzwords.slice(0, 4).map((buzz) => (
                              <span key={buzz} className="px-2 py-1 text-[10px] rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                                {buzz}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                  
                  {(activeCategoryData?.conditions || []).length === 0 && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                      No conditions match this filter.
                    </div>
                  )}
                </motion.div>
              )}

              {/* DETAIL VIEW: Selected Condition */}
              {selectedCondition && (
                <motion.div
                  key="condition-detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="space-y-4 max-h-[520px] overflow-auto pr-1"
                >
                  {/* Sticky Header with Back Button */}
                  <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                    <button
                      onClick={() => setSelectedCondition(null)}
                      className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors mb-3"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to list
                    </button>
                  </div>

                  {/* Error State */}
                  {contentError && (
                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{contentError}</span>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Showing basic information from registry</p>
                    </div>
                  )}

                  {/* Medical Content Renderer */}
                  <MedicalContentRenderer 
                    content={medicalContent || {
                      id: selectedCondition.id,
                      condition: selectedCondition.name,
                      system: selectedCondition.system,
                      subcategory: selectedCondition.subcategory,
                      overview: selectedCondition.overview,
                      buzzwords: selectedCondition.buzzwords,
                    }}
                    loading={contentLoading}
                  />

                  {/* Action Button */}
                  {onSelectCondition && !contentLoading && (
                    <button
                      onClick={() => onSelectCondition(selectedCondition.conditionId)}
                      className="w-full p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <BookOpen className="w-5 h-5" />
                      View Full Details in Modal
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

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
