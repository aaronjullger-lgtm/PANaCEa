/**
 * CoreAdaptiveSession — Unified FSRS Study Session Component
 *
 * This is the single entry point for all adaptive study: PANCE, EOR, PANRE.
 * It resolves the user's learner stage, loads the appropriate blueprint,
 * enforces anti-gaming distribution, and delegates to QuizView for rendering.
 *
 * Key design decisions:
 *
 * 1. NO exam-type selector in the UI. The system infers the right blueprint
 *    from the user's profile (trainingPhase, currentRotation, lifecycleRole).
 *    The user just hits "Study" and gets the right content.
 *
 * 2. FSRS ratings are fully implicit — derived from behavioral telemetry
 *    via deriveContinuousRating(). No self-rating buttons.
 *
 * 3. Session distribution is enforced against the blueprint to prevent
 *    data skewing. Users see a balanced mix even if they prefer one topic.
 *
 * 4. The session label shows what mode is active ("PANCE Preparation",
 *    "Internal Medicine EOR + PANCE", etc.) so the user understands
 *    the weighting without needing to configure it.
 */

import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Question as QuizQuestion, PerformanceRecord, ErrorTag, SessionSettings } from '@/types';
import { DEFAULT_SESSION_SIZE } from '@/lib/constants/sessionDefaults';
import { SessionScopeSelector } from '@/components/session/SessionScopeSelector';
import { DrillLoadingState } from '@/components/loading';
import { createApiClient } from '@/lib/sdk';
import { syncManager } from '@/lib/services/sync/syncManager';

const QuizView = lazy(() => import('@/components/session/QuizView'));

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CoreAdaptiveSessionScope {
  mode: 'adaptive' | 'system' | 'subcategory' | 'condition';
  size: number;
  system?: string;
  systems?: string[];
  subcategory?: string;
  conditionId?: string;
  conditionName?: string;
}

export interface CoreAdaptiveSessionProps {
  onExit: () => void;
  initialScope?: CoreAdaptiveSessionScope | null;
  initialSessionSettings?: SessionSettings | null;
  initialSelectorMode?: CoreAdaptiveSessionScope['mode'];
  lockSelectorMode?: boolean;
  studyPlanTaskId?: string | null;
  studyPlanSource?: string | null;
  studyPlanDate?: string | null;
  // Shared quiz props passed from DrillViewRouter
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: QuizQuestion) => void;
  updateReviewQuestion: (question: QuizQuestion, wasCorrect: boolean) => void;
  updateLastPerformanceErrorTag: (tag: ErrorTag) => void;
  performanceData: PerformanceRecord[];
  fontSizeAdjustment: number;
  setFontSizeAdjustment: React.Dispatch<React.SetStateAction<number>>;
  flaggedQuestions: QuizQuestion[];
  addFlaggedQuestion: (q: QuizQuestion) => void;
  removeFlaggedQuestion: (q: QuizQuestion) => void;
  updateQuestionNote: (q: QuizQuestion, note: string) => void;
}

interface BlueprintState {
  label: string;
  stage: string;
  examTypes: string[];
  weights: Record<string, number>;
  gatedSystems: string[];
  daysToExam: number | null;
  urgencyMultiplier: number;
  isLoaded: boolean;
  error: string | null;
}

export function buildCoreAdaptiveSessionSettings({
  blueprint,
  sessionScope,
  studyPlanSource,
  studyPlanTaskId,
  studyPlanDate,
  launchSettings,
}: {
  blueprint: Pick<BlueprintState, 'weights' | 'gatedSystems' | 'label' | 'examTypes' | 'stage' | 'urgencyMultiplier'>;
  sessionScope: CoreAdaptiveSessionScope | null;
  studyPlanSource?: string | null;
  studyPlanTaskId?: string | null;
  studyPlanDate?: string | null;
  launchSettings?: SessionSettings | null;
}): SessionSettings {
  const blueprintSystems = Object.keys(blueprint.weights).filter(
    s => !blueprint.gatedSystems.includes(s)
  );
  const scopedSystems =
    sessionScope?.systems && sessionScope.systems.length > 0
      ? sessionScope.systems
      : sessionScope?.system
        ? [sessionScope.system]
        : blueprintSystems;
  const hasFocusedScope =
    sessionScope?.mode === 'system' ||
    sessionScope?.mode === 'subcategory' ||
    sessionScope?.mode === 'condition';

  const isDedicatedFocusedMode = studyPlanSource === 'mode-library' && hasFocusedScope;
  const isStudyPlanConditionTarget = sessionScope?.mode === 'condition' && studyPlanSource === 'study-plan';

  const baseSettings: SessionSettings = {
    mode: isDedicatedFocusedMode || isStudyPlanConditionTarget ? ('targeted' as const) : ('standard' as const),
    focus: hasFocusedScope ? ('topic' as const) : ('all' as const),
    topic: sessionScope?.conditionName ?? sessionScope?.conditionId ?? sessionScope?.subcategory ?? sessionScope?.system,
    systems: scopedSystems,
    difficulty: 'adaptive' as const,
    count: sessionScope?.size ?? DEFAULT_SESSION_SIZE,
    conditionId: sessionScope?.conditionId,
    conditionName: sessionScope?.conditionName,
    subcategoryName: sessionScope?.subcategory,
    blueprintLabel: blueprint.label,
    examTypes: blueprint.examTypes,
    stage: blueprint.stage,
    interleaveMode: scopedSystems.length > 1 ? ('interleaved' as const) : ('focused' as const),
    studyPlanTaskId: studyPlanSource === 'study-plan' ? studyPlanTaskId ?? undefined : undefined,
    studyPlanDate: studyPlanSource === 'study-plan' ? studyPlanDate ?? undefined : undefined,
    studyPlanSource: studyPlanSource === 'study-plan' ? studyPlanSource : undefined,
    urgencyMultiplier: blueprint.urgencyMultiplier,
  };

  if (!launchSettings) return baseSettings;

  const count = launchSettings.count ?? launchSettings.questionCount ?? baseSettings.count;
  return {
    ...baseSettings,
    ...launchSettings,
    count,
    questionCount: launchSettings.questionCount ?? count,
    systems: launchSettings.systems?.length ? launchSettings.systems : baseSettings.systems,
    conditionId: launchSettings.conditionId ?? baseSettings.conditionId,
    conditionName: launchSettings.conditionName ?? baseSettings.conditionName,
    subcategoryName: launchSettings.subcategoryName ?? baseSettings.subcategoryName,
    topic: launchSettings.topic ?? baseSettings.topic,
    blueprintLabel: baseSettings.blueprintLabel,
    examTypes: baseSettings.examTypes,
    stage: baseSettings.stage,
    studyPlanTaskId: baseSettings.studyPlanTaskId,
    studyPlanDate: baseSettings.studyPlanDate,
    studyPlanSource: baseSettings.studyPlanSource,
    urgencyMultiplier: baseSettings.urgencyMultiplier,
  };
}

export async function flushQueuedReviewsForSessionSummary({
  getToken,
  syncAll = (token?: string | null) => syncManager.syncAll(token),
  logger = console,
}: {
  getToken: () => Promise<string | null>;
  syncAll?: (token?: string | null) => Promise<unknown>;
  logger?: Pick<Console, 'warn'>;
}): Promise<boolean> {
  try {
    const token = await getToken();
    await syncAll(token);
    return true;
  } catch (error) {
    logger.warn('[CoreAdaptiveSession] Pending review sync did not finish before summary', error);
    return false;
  }
}

interface DistributionState {
  isBalanced: boolean;
  skewScore: number;
  overRepresented: string[];
  boostSystems: string[];
  suppressSystems: string[];
  perSystemCaps: Record<string, number>;
}

interface ResolvedBlueprintResponse {
  label: string;
  stage: string;
  examTypes: string[];
  weights: Record<string, number>;
  gatedSystems?: string[];
  daysToExam: number | null;
  urgencyMultiplier?: number;
  rotationTransition?: string | null;
}

interface DistributionConstraints {
  boostSystems?: string[];
  suppressSystems?: string[];
  perSystemCaps?: Record<string, number>;
}

interface DistributionCheckResponse {
  isBalanced: boolean;
  skewScore: number;
  overRepresented?: string[];
  constraints?: DistributionConstraints;
}

interface GeneratedStudySessionResponse {
  sessionId?: string | null;
  questions?: QuizQuestion[];
}

interface SessionBreakdownEntry {
  count: number;
  accuracy: number;
}

interface SessionRollingHealth {
  isBalanced: boolean;
  overRepresented?: string[];
}

interface SessionSummaryResponse {
  blueprintLabel?: string | null;
  correctAnswers?: number;
  totalQuestions?: number;
  plannedQuestions?: number;
  persistedAnswers?: number;
  reviewSyncComplete?: boolean;
  sessionBreakdown?: Record<string, SessionBreakdownEntry>;
  recommendations?: string[];
  rollingHealth?: SessionRollingHealth | null;
}

export function buildStudyPlanCompletionPayloadFromSummary({
  summary,
  reviewSyncFlushed,
  planDate,
  taskId,
  sessionId,
}: {
  summary: Pick<SessionSummaryResponse, 'persistedAnswers' | 'totalQuestions' | 'correctAnswers'>;
  reviewSyncFlushed: boolean;
  planDate: string;
  taskId: string;
  sessionId: string;
}) {
  const questionsAnswered =
    typeof summary.persistedAnswers === 'number'
      ? summary.persistedAnswers
      : summary.totalQuestions ?? 0;

  if (questionsAnswered <= 0 || !reviewSyncFlushed) {
    return null;
  }

  return {
    action: 'complete' as const,
    planDate,
    taskId,
    actualQuestionsAnswered: questionsAnswered,
    actualAccuracy:
      questionsAnswered > 0 ? (summary.correctAnswers ?? 0) / questionsAnswered : undefined,
    actualDurationMinutes: Math.max(1, Math.round((questionsAnswered * 90) / 60)),
    linkedSessionId: sessionId,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

const CoreAdaptiveSession: React.FC<CoreAdaptiveSessionProps> = ({
  onExit,
  initialScope = null,
  initialSessionSettings = null,
  initialSelectorMode,
  lockSelectorMode = false,
  studyPlanTaskId = null,
  studyPlanSource = null,
  studyPlanDate = null,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  updateLastPerformanceErrorTag,
  performanceData,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  flaggedQuestions,
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote,
}) => {
  const { getToken } = useAuth();

  // Blueprint resolution state
  const [blueprint, setBlueprint] = useState<BlueprintState>({
    label: 'Loading...',
    stage: 'general',
    examTypes: ['PANCE'],
    weights: {},
    gatedSystems: [],
    daysToExam: null,
    urgencyMultiplier: 0.5,
    isLoaded: false,
    error: null,
  });

  // Distribution enforcement state
  const [distribution, setDistribution] = useState<DistributionState>({
    isBalanced: true,
    skewScore: 0,
    overRepresented: [],
    boostSystems: [],
    suppressSystems: [],
    perSystemCaps: {},
  });

  // Session scope state (set by SessionScopeSelector)
  const [showScopeSelector, setShowScopeSelector] = useState(() => !initialScope);
  const [sessionScope, setSessionScope] = useState<CoreAdaptiveSessionScope | null>(initialScope);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotationNotice, setRotationNotice] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const initialScopeKey = JSON.stringify(initialScope ?? null);

  useEffect(() => {
    if (!initialScope) return;
    setSessionScope(initialScope);
    setShowScopeSelector(false);
  }, [initialScope, initialScopeKey]);

  // ── Initialize: resolve blueprint + check distribution + fetch questions ──
  // Only runs after the user has selected a session scope (or skipped via Quick Start)
  useEffect(() => {
    if (!sessionScope) return; // Wait for scope selection
    const scope = sessionScope; // Narrow for closure capture
    let cancelled = false;

    async function initialize() {
      try {
        setIsLoading(true);
        const api = createApiClient(getToken);

        // Step 1: Resolve blueprint (calls our new API endpoint)
        const bp = await api.get<ResolvedBlueprintResponse>('/api/study/resolve-blueprint');
        if (cancelled) return;

        setBlueprint({
          label: bp.label,
          stage: bp.stage,
          examTypes: bp.examTypes,
          weights: bp.weights,
          gatedSystems: bp.gatedSystems ?? [],
          daysToExam: bp.daysToExam,
          urgencyMultiplier: bp.urgencyMultiplier ?? 0.5,
          isLoaded: true,
          error: null,
        });

        // Show rotation transition notice if applicable
        if (bp.rotationTransition) {
          setRotationNotice(bp.rotationTransition);
        }

        // Step 2: Check distribution for anti-gaming constraints
        let distData: DistributionCheckResponse | null = null;
        const distResponse = await api.postResult<DistributionCheckResponse>(
          '/api/study/check-distribution',
          { weights: bp.weights },
        );

        if (distResponse.ok) {
          distData = distResponse.data;
          if (!cancelled) {
            setDistribution({
              isBalanced: distData.isBalanced,
              skewScore: distData.skewScore,
              overRepresented: distData.overRepresented ?? [],
              boostSystems: distData.constraints?.boostSystems ?? [],
              suppressSystems: distData.constraints?.suppressSystems ?? [],
              perSystemCaps: distData.constraints?.perSystemCaps ?? {},
            });
          }
        }

        // Step 3: Fetch questions using blueprint weights + distribution constraints + user scope
        const session = await api.post<GeneratedStudySessionResponse>(
          '/api/study/session/generate',
          {
            mode: scope.mode,
            size: scope.size,
            blueprintWeights: bp.weights,
            gatedSystems: bp.gatedSystems,
            boostSystems: distData?.constraints?.boostSystems,
            suppressSystems: distData?.constraints?.suppressSystems,
            perSystemCaps: distData?.constraints?.perSystemCaps,
            blueprintStage: bp.stage,
            blueprintExamTypes: bp.examTypes,
            blueprintLabel: bp.label,
            urgencyMultiplier: bp.urgencyMultiplier,
            // Scope filters from user selection
            system: scope.system,
            systems: scope.systems,
            subcategory: scope.subcategory,
            conditionId: scope.conditionId,
          },
        );
        if (cancelled) return;

        setSessionId(session.sessionId ?? null);
        setQuestions(session.questions ?? []);
        setError(null);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[CoreAdaptiveSession] Init failed:', err);
          setError(err.message ?? 'Failed to initialize study session');
          setBlueprint(prev => ({ ...prev, error: err.message }));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    initialize();
    return () => { cancelled = true; };
  }, [getToken, retryCount, sessionScope]);
  // ── Session end: fetch summary, then exit ──
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryResponse | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [planSyncWarning, setPlanSyncWarning] = useState<string | null>(null);

  const handleSessionEnd = useCallback(async () => {
    setPlanSyncWarning(null);
    if (!sessionId) {
      onExit();
      return;
    }

    try {
      const token = await getToken();
      if (!token) { onExit(); return; }

      const api = createApiClient(getToken);
      const reviewSyncFlushed = await flushQueuedReviewsForSessionSummary({ getToken });
      if (!reviewSyncFlushed) {
        setPlanSyncWarning('Session saved. Some answers may finish syncing shortly.');
      }
      const summaryResult = await api.postResult<SessionSummaryResponse>(
        '/api/study/session-summary',
        { sessionId },
      );

      if (summaryResult.ok) {
        const summary = summaryResult.data;
        if (studyPlanTaskId && studyPlanSource === 'study-plan') {
          const planDate = studyPlanDate ?? new Date().toISOString().slice(0, 10);
          const completionPayload = buildStudyPlanCompletionPayloadFromSummary({
            summary,
            reviewSyncFlushed,
            planDate,
            taskId: studyPlanTaskId,
            sessionId,
          });

          if (!completionPayload) {
            setPlanSyncWarning("Session saved. Today's plan will update after answer sync finishes.");
          } else {
            try {
              const progressResult = await api.postResult('/api/study-plan/progress', {
                ...completionPayload,
              });

              if (!progressResult.ok) {
                const compatibilityResult = await api.postResult('/api/users/me/daily-plan', {
                  action: 'complete',
                  planDate: completionPayload.planDate,
                  taskId: completionPayload.taskId,
                  questionsAnswered: completionPayload.actualQuestionsAnswered,
                  accuracy: completionPayload.actualAccuracy,
                  durationMinutes: completionPayload.actualDurationMinutes,
                  linkedSessionId: completionPayload.linkedSessionId,
                });

                if (!compatibilityResult.ok) {
                  console.warn('[CoreAdaptiveSession] Failed to mark study-plan task complete');
                  setPlanSyncWarning("Session saved. Today's plan may take a moment to reflect completion.");
                }
              }
            } catch (progressError) {
              console.warn('[CoreAdaptiveSession] Failed to mark study-plan task complete', progressError);
              setPlanSyncWarning("Session saved. Today's plan may take a moment to reflect completion.");
            }
          }
        }
        setSessionSummary(summary);
        setShowSummary(true);
        return; // Don't exit yet — show summary overlay first
      }
    } catch (err) {
      console.error('[CoreAdaptiveSession] Summary fetch failed:', err);
    }

    onExit(); // Fallback: exit if summary fails
  }, [sessionId, getToken, onExit, studyPlanDate, studyPlanTaskId, studyPlanSource, questions.length]);

  // ── Distribution health helpers ──
  const distributionBadge = useMemo(() => {
    if (distribution.isBalanced) {
      return { text: 'Balanced', color: 'text-[var(--color-data-pass)] bg-[var(--color-data-pass)]' };
    }
    if (distribution.skewScore > 0.5) {
      return { text: `Rebalancing (${distribution.overRepresented.length} over)`, color: 'text-[var(--color-data-fail)] bg-[var(--color-data-fail)]' };
    }
    return { text: 'Slight skew', color: 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]' };
  }, [distribution]);

  const urgencyBadge = useMemo(() => {
    if (blueprint.urgencyMultiplier >= 2.0) return { text: 'Cram mode', color: 'text-[var(--color-data-fail)] bg-[var(--color-data-fail)]' };
    if (blueprint.urgencyMultiplier >= 1.4) return { text: 'High priority', color: 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]' };
    if (blueprint.urgencyMultiplier >= 1.0) return { text: 'On track', color: 'text-[var(--color-accent)] bg-[var(--color-accent)]' };
    return null; // No badge for relaxed / no exam
  }, [blueprint.urgencyMultiplier]);

  // ── Session settings for QuizView ──
  const sessionSettings = useMemo(() => {
    return buildCoreAdaptiveSessionSettings({
      blueprint,
      sessionScope,
      studyPlanSource,
      studyPlanTaskId,
      studyPlanDate,
      launchSettings: initialSessionSettings,
    });
  }, [blueprint, sessionScope, studyPlanDate, studyPlanSource, studyPlanTaskId, initialSessionSettings]);

  // ── Render ──

  // Show scope selector before session starts
  if (showScopeSelector && !sessionScope) {
    return (
      <SessionScopeSelector
        initialMode={initialSelectorMode}
        lockMode={lockSelectorMode}
        onStart={(config) => {
          setSessionScope(config);
          setShowScopeSelector(false);
        }}
        onCancel={onExit}
      />
    );
  }

  if (isLoading) {
    return (
      <DrillLoadingState
        message="Resolving your study plan..."
        variant="question"
        showTimer
        showProgress
      />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="bg-[var(--color-data-fail)] border border-[var(--color-data-fail)] rounded-xl p-6 max-w-md text-center">
          <h3 className="text-[var(--color-data-fail)] font-semibold mb-2">
            Session Error
          </h3>
          <p className="text-[var(--color-data-fail)] text-sm mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                // Re-trigger initialization by toggling a retry key
                setRetryCount(c => c + 1);
              }}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors duration-200 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              Retry
            </button>
            <button
              onClick={onExit}
              className="px-4 py-2 bg-[var(--color-data-fail)] text-[var(--color-data-fail)] rounded-lg hover:bg-[var(--color-data-fail)] transition-colors duration-200 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="bg-[var(--color-data-provisional)] border border-[var(--color-data-provisional)] rounded-xl p-6 max-w-md text-center">
          <h3 className="text-[var(--color-data-provisional)] font-semibold mb-2">
            No Questions Available
          </h3>
          <p className="text-[var(--color-data-provisional)] text-sm mb-4">
            {blueprint.gatedSystems.length > 0
              ? `Your current study plan covers ${Object.keys(blueprint.weights).length} systems. More content will unlock as you progress in your program.`
              : 'All questions have been reviewed recently. Check back later or try a different study mode.'}
          </p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-[var(--color-data-provisional)] text-[var(--color-data-provisional)] rounded-lg hover:bg-[var(--color-data-provisional)] transition-colors duration-200 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // ── Post-session summary overlay ──
  if (showSummary && sessionSummary) {
    const breakdown = sessionSummary.sessionBreakdown ?? {};
    const recs = sessionSummary.recommendations ?? [];
    const health = sessionSummary.rollingHealth;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl p-6 max-w-lg w-full shadow-sm">
          <h3 className="text-[var(--color-text-primary)] font-semibold text-lg mb-1">Session Complete</h3>
          <p className="text-[var(--color-text-muted)] text-sm mb-4">
            {sessionSummary.blueprintLabel ?? blueprint.label}
          </p>

          {/* Score */}
          <div className="flex items-center gap-4 mb-4">
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {sessionSummary.correctAnswers ?? 0}/{sessionSummary.totalQuestions ?? questions.length}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">correct</div>
          </div>

          {planSyncWarning && (
            <div className="mb-4 rounded-lg border border-[var(--color-data-provisional)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              {planSyncWarning}
            </div>
          )}

          {/* System breakdown */}
          {Object.keys(breakdown).length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">By System</h4>
              <div className="space-y-1">
                {Object.entries(breakdown)
                  .sort((a: any, b: any) => b[1].count - a[1].count)
                  .slice(0, 8)
                  .map(([sys, data]: [string, any]) => (
                    <div key={sys} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">{sys}</span>
                      <span className={`font-medium ${data.accuracy >= 0.7 ? 'text-[var(--color-data-pass)]' : data.accuracy >= 0.5 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'}`}>
                        {Math.round(data.accuracy * 100)}% ({data.count}q)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Rolling health */}
          {health && (
            <div className="mb-4 flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${health.isBalanced ? 'text-[var(--color-data-pass)] bg-[var(--color-data-pass)]' : 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]'}`}>
                {health.isBalanced ? 'Balanced distribution' : `${health.overRepresented?.length ?? 0} systems over-represented`}
              </span>
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Next Steps</h4>
              <div className="space-y-1">
                {recs.map((rec: string, i: number) => (
                  <p key={i} className="text-sm text-[var(--color-text-secondary)]">{rec}</p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onExit}
            className="w-full px-4 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors duration-200 text-sm font-medium mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Session header with blueprint info ──
  // This renders above QuizView to show the user what mode they're in
  return (
    <div className="flex flex-col h-full">
      {/* Blueprint context bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            {blueprint.label}
          </span>
          {blueprint.daysToExam !== null && blueprint.daysToExam > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {blueprint.daysToExam}d to exam
            </span>
          )}
          {blueprint.daysToExam !== null && blueprint.daysToExam <= 0 && (
            <span className="text-xs text-[var(--color-data-fail)] font-medium">
              Exam day{blueprint.daysToExam < 0 ? ` was ${Math.abs(blueprint.daysToExam)}d ago` : '!'}
            </span>
          )}
          {urgencyBadge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyBadge.color}`}>
              {urgencyBadge.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${distributionBadge.color}`}>
            {distributionBadge.text}
          </span>
          {distribution.skewScore > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]" title="Distribution skew score">
              {Math.round(distribution.skewScore * 100)}% skew
            </span>
          )}
        </div>
      </div>

      {/* Rotation transition notice */}
      {rotationNotice && (
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-accent)] border-b border-[var(--color-accent)]">
          <p className="text-xs text-[var(--color-accent)]">{rotationNotice}</p>
          <button
            onClick={() => setRotationNotice(null)}
            className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)] ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* QuizView — wired with full shared props from DrillViewRouter */}
      <div className="flex-1">
        <Suspense fallback={
          <DrillLoadingState
            message="Preparing your questions..."
            variant="question"
            showTimer
            showProgress
          />
        }>
          <QuizView
            initialQueue={questions}
            setParentQueue={setQuestions}
            sessionSettings={sessionSettings}
            setIsLoading={setIsLoading}
            setError={setError}
            growthAreas={[]}
            onEndSession={handleSessionEnd}
            onShowMenu={onExit}
            modeLabel={blueprint.label}
            sessionId={sessionId}
            queueStrategy="finite"
            addPerformanceRecord={addPerformanceRecord}
            addMissedQuestion={addMissedQuestion}
            updateReviewQuestion={updateReviewQuestion}
            updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
            performanceData={performanceData}
            fontSizeAdjustment={fontSizeAdjustment}
            setFontSizeAdjustment={setFontSizeAdjustment}
            flaggedQuestions={flaggedQuestions}
            addFlaggedQuestion={addFlaggedQuestion}
            removeFlaggedQuestion={removeFlaggedQuestion}
            updateQuestionNote={updateQuestionNote}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default CoreAdaptiveSession;
