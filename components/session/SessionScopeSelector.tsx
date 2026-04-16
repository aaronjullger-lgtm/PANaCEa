/**
 * SessionScopeSelector — Pre-session configuration modal
 *
 * Appears when the user clicks "Study" from the dashboard or TrainingMenu.
 * Offers four session modes:
 *
 *   1. Quick Start (adaptive) — blueprint-weighted, one click
 *   2. Focus on System — filter to one of the 15 systems
 *   3. Focus on Subcategory — drill into a subcategory within a system
 *   4. Focus on Condition — target a specific condition
 *
 * Shows the resolved blueprint context so the user understands what's happening:
 *   "You're on Internal Medicine rotation. Session weighted 75% IM, 25% PANCE baseline."
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Layers,
  FolderOpen,
  Target,
  ChevronRight,
  ChevronLeft,
  Play,
  Info,
  Loader2,
} from 'lucide-react';
import { useResolvedBlueprint } from '@/hooks/useResolvedBlueprint';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MIN_SESSION_SIZE, MAX_SESSION_SIZE } from '@/lib/constants/sessionDefaults';

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionMode = 'adaptive' | 'system' | 'subcategory' | 'condition';

interface SessionConfig {
  mode: SessionMode;
  size: number;
  system?: string;
  subcategory?: string;
  conditionId?: string;
  conditionName?: string;
}

interface SessionScopeSelectorProps {
  onStart: (config: SessionConfig) => void;
  onCancel: () => void;
}

interface SystemOption {
  name: string;
  questionCount: number;
  mastery: number;
  subcategories: SubcategoryOption[];
}

interface SubcategoryOption {
  name: string;
  questionCount: number;
}

interface ConditionOption {
  id: string;
  name: string;
  questionCount: number;
}

interface LegacySystemPayload {
  system?: string;
  count?: number;
  mastery?: number;
  subcategories?: Array<{ name?: string; count?: number } | string>;
}

interface PoolStatusSystemStats {
  total?: number;
}

interface HighYieldConditionPayload {
  id?: string;
  condition?: string;
  name?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSystemOptions(payload: unknown): SystemOption[] {
  // New `/api/content/systems` shape: { data: [{ id, label, count }] } — or the bare array
  const unwrapped = isRecord(payload) && 'data' in payload ? (payload as { data: unknown }).data : payload;
  if (Array.isArray(unwrapped) && unwrapped.length > 0 && isRecord(unwrapped[0]) && 'label' in unwrapped[0]) {
    const rows = unwrapped as Array<{ id?: string; label?: string; count?: number }>;
    return rows
      .map((row) => ({
        name: row.label ?? row.id ?? '',
        questionCount: typeof row.count === 'number' ? row.count : 0,
        mastery: 0,
        subcategories: [] as { name: string; questionCount: number }[],
      }))
      .filter((sys) => sys.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  if (!isRecord(payload)) return [];

  const rootData = isRecord(payload.data) ? payload.data : payload;
  const legacySystems = Array.isArray(rootData.systems) ? rootData.systems as LegacySystemPayload[] : null;

  if (legacySystems) {
    return legacySystems
      .map((sys) => ({
        name: sys.system ?? '',
        questionCount: sys.count ?? 0,
        mastery: sys.mastery ?? 0,
        subcategories: Array.isArray(sys.subcategories)
          ? sys.subcategories.map((subcategory) => (
              typeof subcategory === 'string'
                ? { name: subcategory, questionCount: 0 }
                : {
                    name: subcategory.name ?? '',
                    questionCount: subcategory.count ?? 0,
                  }
            )).filter((subcategory) => subcategory.name.length > 0)
          : [],
      }))
      .filter((sys) => sys.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const bySystem = isRecord(rootData.bySystem) ? rootData.bySystem : null;
  if (!bySystem) return [];

  return Object.entries(bySystem)
    .map(([name, stats]) => ({
      name,
      questionCount: isRecord(stats) ? ((stats as PoolStatusSystemStats).total ?? 0) : 0,
      mastery: 0,
      subcategories: [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseConditionOptions(payload: unknown): ConditionOption[] {
  if (!isRecord(payload)) return [];

  const rootData = isRecord(payload.data) ? payload.data : payload;
  const rawConditions = Array.isArray(rootData.conditions)
    ? rootData.conditions
    : Array.isArray(rootData.data)
      ? rootData.data
      : Array.isArray(payload)
        ? payload
        : [];

  return rawConditions
    .map((condition) => {
      if (!isRecord(condition)) return null;
      const typedCondition = condition as HighYieldConditionPayload;
      const id = typedCondition.id ?? typedCondition.condition ?? typedCondition.name ?? '';
      const name = typedCondition.condition ?? typedCondition.name ?? typedCondition.id ?? '';
      if (!id || !name) return null;

      return {
        id,
        name,
        questionCount: 0,
      };
    })
    .filter((condition): condition is ConditionOption => condition !== null);
}

// ─── Session Size Options ────────────────────────────────────────────────────

const SESSION_SIZES = [
  { value: 10, label: '10', subtitle: '~15 min' },
  { value: 20, label: '20', subtitle: '~30 min' },
  { value: 30, label: '30', subtitle: '~45 min' },
  { value: 50, label: '50', subtitle: '~75 min' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const SessionScopeSelector: React.FC<SessionScopeSelectorProps> = ({
  onStart,
  onCancel,
}) => {
  const { getToken } = useAuth();
  const {
    blueprint,
    stage,
    weights,
    gatedSystems,
    label: blueprintLabel,
    urgencyMultiplier,
    isLoading: blueprintLoading,
  } = useResolvedBlueprint();
  const prefersReducedMotion = useReducedMotion();

  // State
  const [step, setStep] = useState<'mode' | 'system' | 'subcategory' | 'condition' | 'size'>('mode');
  const [selectedMode, setSelectedMode] = useState<SessionMode>('adaptive');
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<{ id: string; name: string } | null>(null);
  const [sessionSize, setSessionSize] = useState(20);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [conditions, setConditions] = useState<ConditionOption[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(false);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [systemsError, setSystemsError] = useState<string | null>(null);
  const [conditionsError, setConditionsError] = useState<string | null>(null);

  // Auto-scale session size based on urgency
  useEffect(() => {
    if (urgencyMultiplier >= 1.7) {
      setSessionSize(30);
    } else if (urgencyMultiplier >= 1.2) {
      setSessionSize(20);
    } else {
      setSessionSize(20);
    }
  }, [urgencyMultiplier]);

  // Fetch system data when entering system selection
  const loadSystems = useCallback(async () => {
    setLoadingSystems(true);
    setSystemsError(null);
    try {
      const token = await getToken();
      if (!token) {
        setSystems([]);
        setSystemsError('You need to be signed in to load systems.');
        return;
      }

      // Primary: content-backed system list (labels + published counts)
      const res = await fetch('/api/content/systems', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const parsed = parseSystemOptions(data);
        if (parsed.length > 0) {
          setSystems(parsed);
          return;
        }
      }

      // Fallback: legacy pool-status shape (bySystem dict)
      const fallback = await fetch('/api/questions/pool-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fallback.ok) {
        const fallbackData = await fallback.json();
        setSystems(parseSystemOptions(fallbackData));
        return;
      }

      setSystems([]);
      setSystemsError('No systems are available right now.');
    } catch (err) {
      console.error('[SessionScopeSelector] Failed to load systems:', err);
      setSystems([]);
      setSystemsError(err instanceof Error ? err.message : 'Failed to load systems.');
    } finally {
      setLoadingSystems(false);
    }
  }, [getToken]);

  // Fetch conditions when a subcategory is selected
  const loadConditions = useCallback(async (system: string, subcategory?: string) => {
    setLoadingConditions(true);
    setConditionsError(null);
    try {
      const token = await getToken();
      if (!token) {
        setConditions([]);
        setConditionsError('You need to be signed in to load conditions.');
        return;
      }

      const params = new URLSearchParams({ system });
      if (subcategory) params.set('subcategory', subcategory);

      const res = await fetch(`/api/conditions/high-yield?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setConditions(parseConditionOptions(data));
      } else {
        setConditions([]);
        setConditionsError('No conditions are available for this scope yet.');
      }
    } catch (err) {
      console.error('[SessionScopeSelector] Failed to load conditions:', err);
      setConditions([]);
      setConditionsError(err instanceof Error ? err.message : 'Failed to load conditions.');
    } finally {
      setLoadingConditions(false);
    }
  }, [getToken]);

  // Blueprint context message
  const contextMessage = useMemo(() => {
    if (!blueprint) return null;

    switch (stage) {
      case 'didactic_early':
      case 'didactic_late':
        return `${blueprintLabel}. ${gatedSystems.length > 0 ? `${gatedSystems.length} systems locked until later semesters.` : 'All systems available.'}`;
      case 'clinical_rotation':
        return `${blueprintLabel}. Your session is weighted toward your current rotation.`;
      case 'pance_prep':
        return blueprint.daysToExam
          ? `${blueprintLabel}. ${blueprint.daysToExam} days to exam.`
          : `${blueprintLabel}. Set your exam date in Settings for urgency-adjusted sessions.`;
      case 'panre':
        return `${blueprintLabel}. Focus on systems needing refresh.`;
      default:
        return blueprintLabel;
    }
  }, [blueprint, stage, blueprintLabel, gatedSystems]);

  // ── Mode Selection Handlers ──
  const handleModeSelect = (mode: SessionMode) => {
    setSelectedMode(mode);
    setSelectedSystem(null);
    setSelectedSubcategory(null);
    setSelectedCondition(null);
    setConditions([]);
    setSystemsError(null);
    setConditionsError(null);
    if (mode === 'adaptive') {
      setStep('size');
    } else {
      loadSystems();
      setStep('system');
    }
  };

  const handleSystemSelect = (systemName: string) => {
    setSelectedSystem(systemName);
    setSelectedSubcategory(null);
    setSelectedCondition(null);
    setConditions([]);
    setConditionsError(null);
    if (selectedMode === 'system') {
      setStep('size');
    } else if (selectedMode === 'subcategory' || selectedMode === 'condition') {
      const sys = systems.find(s => s.name === systemName);
      if (sys && sys.subcategories.length > 0) {
        setStep('subcategory');
      } else {
        // No subcategories — jump to size or conditions
        if (selectedMode === 'condition') {
          void loadConditions(systemName);
        }
        setStep(selectedMode === 'condition' ? 'condition' : 'size');
      }
    }
  };

  const handleSubcategorySelect = (subcategoryName: string) => {
    setSelectedSubcategory(subcategoryName);
    if (selectedMode === 'subcategory') {
      setStep('size');
    } else {
      loadConditions(selectedSystem!, subcategoryName);
      setStep('condition');
    }
  };

  const handleConditionSelect = (condition: { id: string; name: string }) => {
    setSelectedCondition(condition);
    setStep('size');
  };

  const handleBack = () => {
    switch (step) {
      case 'system':
        setStep('mode');
        setSelectedMode('adaptive');
        break;
      case 'subcategory':
        setStep('system');
        setSelectedSubcategory(null);
        break;
      case 'condition':
        setStep(selectedSubcategory ? 'subcategory' : 'system');
        setSelectedCondition(null);
        break;
      case 'size':
        if (selectedMode === 'adaptive') setStep('mode');
        else if (selectedMode === 'condition' && selectedCondition) setStep('condition');
        else if (selectedMode === 'subcategory' && selectedSubcategory) setStep('subcategory');
        else if (selectedSystem) setStep('system');
        else setStep('mode');
        break;
    }
  };

  const handleStart = () => {
    onStart({
      mode: selectedMode,
      size: sessionSize,
      system: selectedSystem ?? undefined,
      subcategory: selectedSubcategory ?? undefined,
      conditionId: selectedCondition?.id,
      conditionName: selectedCondition?.name,
    });
  };

  // ── Render ──
  const animProps = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        {...(prefersReducedMotion ? {} : { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 } })}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            {step !== 'mode' && (
              <button
                onClick={handleBack}
                aria-label="Go back"
                className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            )}
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex-1 text-center">
              {step === 'mode' && 'Start a Session'}
              {step === 'system' && 'Choose a System'}
              {step === 'subcategory' && 'Choose a Subcategory'}
              {step === 'condition' && 'Choose a Condition'}
              {step === 'size' && 'Session Size'}
            </h2>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors text-sm text-[var(--color-text-secondary)]"
            >
              Cancel
            </button>
          </div>

          {/* Blueprint context */}
          {contextMessage && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)]">
              <Info className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--color-text-secondary)]">{contextMessage}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          <AnimatePresence mode="wait">
            {/* Step 1: Mode Selection */}
            {step === 'mode' && (
              <motion.div key="mode" {...animProps} className="space-y-3">
                <ModeCard
                  icon={<Zap className="w-5 h-5" />}
                  title="Quick Start"
                  description="Blueprint-weighted adaptive session"
                  accent="text-[var(--color-accent)]"
                  onClick={() => handleModeSelect('adaptive')}
                  recommended
                />
                <ModeCard
                  icon={<Layers className="w-5 h-5" />}
                  title="Focus on System"
                  description="Study one body system (e.g., Cardiovascular)"
                  accent="text-[var(--color-accent)]"
                  onClick={() => handleModeSelect('system')}
                />
                <ModeCard
                  icon={<FolderOpen className="w-5 h-5" />}
                  title="Focus on Subcategory"
                  description="Drill into a specific topic area"
                  accent="text-[var(--color-text-secondary)]"
                  onClick={() => handleModeSelect('subcategory')}
                />
                <ModeCard
                  icon={<Target className="w-5 h-5" />}
                  title="Focus on Condition"
                  description="Target a single condition (e.g., CHF)"
                  accent="text-[var(--color-data-pass)]"
                  onClick={() => handleModeSelect('condition')}
                />
              </motion.div>
            )}

            {/* Step 2: System Selection */}
            {step === 'system' && (
              <motion.div key="system" {...animProps} className="space-y-2 max-h-[400px] overflow-y-auto">
                {loadingSystems ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                  </div>
                ) : systemsError ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-sm text-[var(--color-text-secondary)]">{systemsError}</p>
                    <button
                      onClick={() => void loadSystems()}
                      className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                    >
                      Retry
                    </button>
                  </div>
                ) : systems.length === 0 ? (
                  // Fallback: show all 15 systems without counts
                  ALL_SYSTEM_NAMES
                    .filter(s => !gatedSystems.includes(s))
                    .map(sys => (
                      <button
                        key={sys}
                        onClick={() => handleSystemSelect(sys)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                      >
                        <span className="font-medium text-[var(--color-text-primary)]">{sys}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      </button>
                    ))
                ) : (
                  systems
                    .filter(s => !gatedSystems.includes(s.name))
                    .map(sys => (
                      <button
                        key={sys.name}
                        onClick={() => handleSystemSelect(sys.name)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                      >
                        <div>
                          <span className="font-medium text-[var(--color-text-primary)]">{sys.name}</span>
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                            {sys.questionCount} questions
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {sys.mastery > 0 && (
                            <span className="text-xs font-medium text-[var(--color-data-pass)]">
                              {Math.round(sys.mastery * 100)}%
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        </div>
                      </button>
                    ))
                )}

                {/* Show gated systems as locked */}
                {gatedSystems.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                      Locked (not yet in your curriculum)
                    </p>
                    {gatedSystems.map(sys => (
                      <div
                        key={sys}
                        className="flex items-center justify-between p-3 rounded-xl opacity-40 cursor-not-allowed"
                      >
                        <span className="font-medium text-[var(--color-text-secondary)]">{sys}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">🔒</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Subcategory Selection */}
            {step === 'subcategory' && (
              <motion.div key="subcategory" {...animProps} className="space-y-2 max-h-[400px] overflow-y-auto">
                {(() => {
                  const sys = systems.find(s => s.name === selectedSystem);
                  if (!sys || sys.subcategories.length === 0) {
                    return (
                      <p className="text-center text-[var(--color-text-secondary)] py-8">
                        No subcategories available for {selectedSystem}
                      </p>
                    );
                  }
                  return sys.subcategories.map(sc => (
                    <button
                      key={sc.name}
                      onClick={() => handleSubcategorySelect(sc.name)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                    >
                      <div>
                        <span className="font-medium text-[var(--color-text-primary)]">{sc.name}</span>
                        {sc.questionCount > 0 && (
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                            {sc.questionCount} questions
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    </button>
                  ));
                })()}
              </motion.div>
            )}

            {/* Step 4: Condition Selection */}
            {step === 'condition' && (
              <motion.div key="condition" {...animProps} className="space-y-2 max-h-[400px] overflow-y-auto">
                {loadingConditions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                  </div>
                ) : conditionsError ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-sm text-[var(--color-text-secondary)]">{conditionsError}</p>
                    <button
                      onClick={() => {
                        if (selectedSystem) {
                          void loadConditions(selectedSystem, selectedSubcategory ?? undefined);
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                    >
                      Retry
                    </button>
                  </div>
                ) : conditions.length === 0 ? (
                  <p className="text-center text-[var(--color-text-secondary)] py-8">
                    No conditions available. Try selecting a broader scope.
                  </p>
                ) : (
                  conditions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleConditionSelect({ id: c.id, name: c.name })}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                    >
                      <span className="font-medium text-[var(--color-text-primary)]">{c.name}</span>
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    </button>
                  ))
                )}
              </motion.div>
            )}

            {/* Step 5: Session Size + Start */}
            {step === 'size' && (
              <motion.div key="size" {...animProps} className="space-y-6">
                {/* Scope summary */}
                <div className="text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {selectedMode === 'adaptive' && 'Full adaptive session'}
                    {selectedMode === 'system' && `System: ${selectedSystem}`}
                    {selectedMode === 'subcategory' && `${selectedSystem} → ${selectedSubcategory}`}
                    {selectedMode === 'condition' && `Condition: ${selectedCondition?.name}`}
                  </p>
                </div>

                {/* Size selector */}
                <div className="grid grid-cols-4 gap-3">
                  {SESSION_SIZES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setSessionSize(s.value)}
                      className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        sessionSize === s.value
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                      }`}
                    >
                      <span className="text-2xl font-bold text-[var(--color-text-primary)]">{s.label}</span>
                      <span className="text-xs text-[var(--color-text-secondary)] mt-1">{s.subtitle}</span>
                    </button>
                  ))}
                </div>

                {/* Start button */}
                <button
                  onClick={handleStart}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-lg hover:opacity-90 transition-opacity"
                >
                  <Play className="w-5 h-5" />
                  Start Session
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
  recommended?: boolean;
}

const ModeCard: React.FC<ModeCardProps> = ({
  icon,
  title,
  description,
  accent,
  onClick,
  recommended,
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-secondary)] transition-all text-left group"
  >
    <div className={`p-2.5 rounded-lg bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-bg-tertiary)] ${accent}`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[var(--color-text-primary)]">{title}</span>
        {recommended && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
            Recommended
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{description}</p>
    </div>
    <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
  </button>
);

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_SYSTEM_NAMES = [
  'Cardiovascular',
  'Dermatology',
  'Emergency Medicine',
  'Endocrine',
  'Gastrointestinal',
  'Genitourinary',
  'HEENT',
  'Hematology',
  'Infectious Disease',
  'Musculoskeletal',
  'Nephrology',
  'Neurological',
  'Psychiatry',
  'Pulmonary',
  'Reproductive',
];

export default SessionScopeSelector;
