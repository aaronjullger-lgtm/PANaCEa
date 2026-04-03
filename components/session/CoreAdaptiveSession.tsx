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
import type { Question as QuizQuestion, PerformanceRecord, ErrorTag } from '@/types';
import { DEFAULT_SESSION_SIZE } from '@/lib/constants/sessionDefaults';
import { SessionScopeSelector } from '@/components/session/SessionScopeSelector';

const QuizView = lazy(() => import('@/components/session/QuizView'));

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoreAdaptiveSessionProps {
  onExit: () => void;
  // Shared quiz props passed from DrillViewRouter
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: QuizQuestion) => void;
  updateReviewQuestion: (question: QuizQuestion, wasCorrect: boolean) => void;
  updateLastPerformanceErrorTag: (tag: ErrorTag) => void;
  performanceData: PerformanceRecord[];
  fontSizeAdjustment: number;
  setFontSizeAdjustment: (n: number) => void;
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

interface DistributionState {
  isBalanced: boolean;
  skewScore: number;
  overRepresented: string[];
  boostSystems: string[];
  suppressSystems: string[];
  perSystemCaps: Record<string, number>;
}

// ─── Component ───────────────────────────────────────────────────────────────

const CoreAdaptiveSession: React.FC<CoreAdaptiveSessionProps> = ({
  onExit,
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
  const [showScopeSelector, setShowScopeSelector] = useState(true);
  const [sessionScope, setSessionScope] = useState<{
    mode: 'adaptive' | 'system' | 'subcategory' | 'condition';
    size: number;
    system?: string;
    subcategory?: string;
    conditionId?: string;
  } | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotationNotice, setRotationNotice] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ── Initialize: resolve blueprint + check distribution + fetch questions ──
  // Only runs after the user has selected a session scope (or skipped via Quick Start)
  useEffect(() => {
    if (!sessionScope) return; // Wait for scope selection
    let cancelled = false;

    async function initialize() {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token || cancelled) return;

        // Step 1: Resolve blueprint (calls our new API endpoint)
        const bpResponse = await fetch('/api/study/resolve-blueprint', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!bpResponse.ok) {
          throw new Error(`Blueprint resolution failed: ${bpResponse.status}`);
        }

        const bp = await bpResponse.json();
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
        let distData: any = null;
        const distResponse = await fetch('/api/study/check-distribution', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ weights: bp.weights }),
        });

        if (distResponse.ok) {
          distData = await distResponse.json();
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
        const sessionResponse = await fetch('/api/study/session/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: sessionScope.mode,
            size: sessionScope.size,
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
            system: sessionScope.system,
            subcategory: sessionScope.subcategory,
            conditionId: sessionScope.conditionId,
          }),
        });

        if (!sessionResponse.ok) {
          throw new Error(`Session generation failed: ${sessionResponse.status}`);
        }

        const session = await sessionResponse.json();
        if (cancelled) return;

        setSessionId(session.sessionId);
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
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);

  const handleSessionEnd = useCallback(async () => {
    if (!sessionId) {
      onExit();
      return;
    }

    try {
      const token = await getToken();
      if (!token) { onExit(); return; }

      const res = await fetch('/api/study/session-summary', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        const summary = await res.json();
        setSessionSummary(summary);
        setShowSummary(true);
        return; // Don't exit yet — show summary overlay first
      }
    } catch (err) {
      console.error('[CoreAdaptiveSession] Summary fetch failed:', err);
    }

    onExit(); // Fallback: exit if summary fails
  }, [sessionId, getToken, onExit]);

  // ── Distribution health helpers ──
  const distributionBadge = useMemo(() => {
    if (distribution.isBalanced) {
      return { text: 'Balanced', color: 'text-emerald-600 bg-emerald-50' };
    }
    if (distribution.skewScore > 0.5) {
      return { text: `Rebalancing (${distribution.overRepresented.length} over)`, color: 'text-red-600 bg-red-50' };
    }
    return { text: 'Slight skew', color: 'text-amber-600 bg-amber-50' };
  }, [distribution]);

  const urgencyBadge = useMemo(() => {
    if (blueprint.urgencyMultiplier >= 2.0) return { text: 'Cram mode', color: 'text-red-700 bg-red-100' };
    if (blueprint.urgencyMultiplier >= 1.4) return { text: 'High priority', color: 'text-orange-600 bg-orange-50' };
    if (blueprint.urgencyMultiplier >= 1.0) return { text: 'On track', color: 'text-blue-600 bg-blue-50' };
    return null; // No badge for relaxed / no exam
  }, [blueprint.urgencyMultiplier]);

  // ── Session settings for QuizView ──
  const sessionSettings = useMemo(() => ({
    mode: 'standard' as const,
    focus: 'due' as const,
    systems: Object.keys(blueprint.weights).filter(
      s => !blueprint.gatedSystems.includes(s)
    ),
    difficulty: 'adaptive' as const,
    count: 20,
    blueprintLabel: blueprint.label,
    examTypes: blueprint.examTypes,
    stage: blueprint.stage,
  }), [blueprint]);

  // ── Render ──

  // Show scope selector before session starts
  if (showScopeSelector && !sessionScope) {
    return (
      <SessionScopeSelector
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-300 border-t-stone-700" />
        <p className="text-stone-500 text-sm">
          Resolving your study plan...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h3 className="text-red-800 font-semibold mb-2">
            Session Error
          </h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                // Re-trigger initialization by toggling a retry key
                setRetryCount(c => c + 1);
              }}
              className="px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors duration-200 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              Retry
            </button>
            <button
              onClick={onExit}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 max-w-md text-center">
          <h3 className="text-amber-800 font-semibold mb-2">
            No Questions Available
          </h3>
          <p className="text-amber-600 text-sm mb-4">
            {blueprint.gatedSystems.length > 0
              ? `Your current study plan covers ${Object.keys(blueprint.weights).length} systems. More content will unlock as you progress in your program.`
              : 'All questions have been reviewed recently. Check back later or try a different study mode.'}
          </p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors duration-200 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
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
        <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-lg w-full shadow-sm">
          <h3 className="text-stone-800 font-semibold text-lg mb-1">Session Complete</h3>
          <p className="text-stone-500 text-sm mb-4">
            {sessionSummary.blueprintLabel ?? blueprint.label}
          </p>

          {/* Score */}
          <div className="flex items-center gap-4 mb-4">
            <div className="text-3xl font-bold text-stone-800">
              {sessionSummary.correctAnswers ?? 0}/{sessionSummary.totalQuestions ?? questions.length}
            </div>
            <div className="text-sm text-stone-500">correct</div>
          </div>

          {/* System breakdown */}
          {Object.keys(breakdown).length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">By System</h4>
              <div className="space-y-1">
                {Object.entries(breakdown)
                  .sort((a: any, b: any) => b[1].count - a[1].count)
                  .slice(0, 8)
                  .map(([sys, data]: [string, any]) => (
                    <div key={sys} className="flex items-center justify-between text-sm">
                      <span className="text-stone-600">{sys}</span>
                      <span className={`font-medium ${data.accuracy >= 0.7 ? 'text-emerald-600' : data.accuracy >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
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
              <span className={`text-xs px-2 py-0.5 rounded-full ${health.isBalanced ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
                {health.isBalanced ? 'Balanced distribution' : `${health.overRepresented?.length ?? 0} systems over-represented`}
              </span>
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Next Steps</h4>
              <div className="space-y-1">
                {recs.map((rec: string, i: number) => (
                  <p key={i} className="text-sm text-stone-600">{rec}</p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onExit}
            className="w-full px-4 py-2.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors duration-200 text-sm font-medium mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
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
      <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
            {blueprint.label}
          </span>
          {blueprint.daysToExam !== null && blueprint.daysToExam > 0 && (
            <span className="text-xs text-stone-400">
              {blueprint.daysToExam}d to exam
            </span>
          )}
          {blueprint.daysToExam !== null && blueprint.daysToExam <= 0 && (
            <span className="text-xs text-red-500 font-medium">
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
            <span className="text-xs text-stone-400" title="Distribution skew score">
              {Math.round(distribution.skewScore * 100)}% skew
            </span>
          )}
        </div>
      </div>

      {/* Rotation transition notice */}
      {rotationNotice && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-xs text-blue-700">{rotationNotice}</p>
          <button
            onClick={() => setRotationNotice(null)}
            className="text-xs text-blue-500 hover:text-blue-700 ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* QuizView — wired with full shared props from DrillViewRouter */}
      <div className="flex-1">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-stone-300 border-t-stone-700" />
          </div>
        }>
          <QuizView
            initialQueue={questions}
            setParentQueue={setQuestions}
            sessionSettings={sessionSettings}
            onEndSession={handleSessionEnd}
            onShowMenu={onExit}
            modeLabel={blueprint.label}
            sessionId={sessionId}
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