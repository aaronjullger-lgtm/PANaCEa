// components/modes/osce/OSCESimulator.tsx
// Multimodal OSCE simulator with voice interaction and diagnostic UI

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Clock, Target, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useOSCEMetrics } from '@/hooks/useOSCEMetrics';
import { useResponseTelemetry } from '@/hooks/useResponseTelemetry';
import { BodyMap } from './BodyMap';
import { ExamPanel } from './ExamPanel';
import { ScoreReport } from './ScoreReport';
import { RapportMeter } from './RapportMeter';
import { getRandomEncounterCase, startOSCESession, saveOSCEChat } from '@/services/domain/osceService';
import { OSCEScoringEngine } from '@/services/domain/osceScoringEngine';
import type { BodyRegion, ExamFinding, OSCEScoreReport, RapportMeter as RapportMeterState } from '@/types/osce-enhanced';
import type { PatientEncounterCase } from '@/types/drill-modes';
import { InlineSpinner } from '@/components/loading';

interface OSCESimulatorProps {
  /** Time limit in seconds (default: 900s = 15 minutes) */
  timeLimit?: number;
  /** Called when the station is completed (with final score) */
  onComplete?: (score: number, sessionId: string) => void;
  /** Called when the user exits early */
  onExit?: () => void;
}

export const OSCESimulator: React.FC<OSCESimulatorProps> = ({
  timeLimit = 900,
  onComplete,
  onExit,
}) => {
  const { getToken } = useAuth();
  const [caseData, setCaseData] = useState<PatientEncounterCase | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [examFindings, setExamFindings] = useState<ExamFinding[]>([]);
  const [remainingTime, setRemainingTime] = useState(timeLimit);
  const [stationPhase, setStationPhase] = useState<'history' | 'physical' | 'diagnostic' | 'treatment'>('history');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [scoreReport, setScoreReport] = useState<OSCEScoreReport | null>(null);
  const [rapportMeter, setRapportMeter] = useState<RapportMeterState>({
    score: 50,
    empathyPoints: 0,
    trustPoints: 0,
    frustrationPoints: 0,
    milestones: [],
  });
  // Voice hooks
  const {
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    isListening,
    isSupported: speechRecognitionSupported,
    error: speechError,
  } = useSpeechRecognition();

  const {
    speak,
    isSpeaking,
    isSupported: speechSynthesisSupported,
  } = useSpeechSynthesis();

  // Metrics & telemetry
  const { logAction, calculateMetrics, reset: resetMetrics } = useOSCEMetrics();
  const { recordInteraction } = useResponseTelemetry({
    questionDisplayTime: Date.now(),
    mvrtThresholdMs: 500,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const scoringEngineRef = useRef<OSCEScoringEngine | null>(null);
  const examPanelCaseData = caseData
    ? {
        physicalExamData: caseData.physicalExamData,
        correctDiagnosis: caseData.correctDiagnosis,
      }
    : undefined;
  const findingsMap = examFindings.reduce(
    (acc, finding) => {
      acc[finding.region] = finding.finding;
      return acc;
    },
    {} as Partial<Record<BodyRegion, string>>
  );

  // Load a random encounter case
  const loadCase = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const caseResponse = await getRandomEncounterCase(token);
      if (!caseResponse?.data) {
        throw new Error('Failed to load OSCE case');
      }
      const caseItem = caseResponse.data;
      setCaseData(caseItem);
      scoringEngineRef.current = new OSCEScoringEngine(caseItem);
      setScoreReport(null);

      // Start a session for this case
      const sessionResponse = await startOSCESession(caseItem.id, token);
      if (sessionResponse?.id) {
        setSessionId(sessionResponse.id);
        startTimeRef.current = Date.now();
        resetMetrics();
        logAction('exam', 'session_started', { isCorrect: true });
      } else {
        throw new Error('Could not start OSCE session');
      }
    } catch (err) {
      console.error('Error loading OSCE case:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, logAction, resetMetrics]);

  // Initialize on mount
  useEffect(() => {
    loadCase();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopListening();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (remainingTime <= 0) {
      handleTimeUp();
      return;
    }
    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => prev - 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingTime]);

  const handleTimeUp = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStationPhase('diagnostic');
    // Auto‑submit? maybe just show score
    logAction('exam', 'time_up', { isCorrect: false });
  }, [logAction]);

  // Format remaining time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle exam findings from ExamPanel
  const handleExamPerformed = useCallback((finding: ExamFinding) => {
    setExamFindings((prev) => [...prev, finding]);
    scoringEngineRef.current?.trackExam(finding);
    logAction('exam', `exam_${finding.region}_${finding.maneuverId}`, {
      isCorrect: !finding.isAbnormal, // simplistic – real scoring would compare with case data
    });
    recordInteraction('click', `body_region_${finding.region}`);
  }, [logAction, recordInteraction]);

  // Toggle voice listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      logAction('communication', 'voice_stopped');
    } else {
      startListening({
        lang: 'en-US',
        interimResults: true,
        onResult: (text, isFinal, confidence) => {
          // You could send transcript to session chat
          logAction('communication', 'voice_utterance', { isCorrect: isFinal });
        },
      });
      logAction('communication', 'voice_started');
    }
  }, [isListening, startListening, stopListening, logAction]);

  // Speak a prompt (e.g., patient response)
  const speakPrompt = useCallback((text: string) => {
    speak(text, {
      rate: 1.0,
      pitch: 1.0,
      lang: 'en-US',
      onStart: () => logAction('communication', 'voice_synthesis_started'),
      onEnd: () => logAction('communication', 'voice_synthesis_ended'),
    });
  }, [speak, logAction]);

  // Submit final diagnosis and show score
  const handleSubmit = useCallback(async () => {
    if (!sessionId) return;
    try {
      const token = await getToken();
      // Save chat transcript (if any)
      await saveOSCEChat(sessionId, [{ speaker: 'student', text: transcript }], token);
      // Calculate final metrics
      const metrics = calculateMetrics();
      // Generate OSCE score report using scoring engine
      const report = scoringEngineRef.current?.generateReport();
      if (report) {
        setScoreReport(report);
        onComplete?.(report.overallScore, sessionId);
      } else {
        onComplete?.(metrics.clinicalConfidenceIndex, sessionId);
      }
      setShowScore(true);
    } catch (err) {
      console.error('Error submitting OSCE session:', err);
      setError('Submission failed');
    }
  }, [sessionId, getToken, transcript, calculateMetrics, onComplete]);

  // Reset station
  const handleReset = useCallback(() => {
    setExamFindings([]);
    setRemainingTime(timeLimit);
    setStationPhase('history');
    setShowScore(false);
    resetMetrics();
    startTimeRef.current = Date.now();
    logAction('exam', 'session_reset');
  }, [timeLimit, resetMetrics, logAction]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div role="status" aria-live="polite" aria-label="Loading OSCE station" className="text-center">
          <div className="flex justify-center mb-4">
            <InlineSpinner size="xl" className="text-[var(--color-accent)]" />
          </div>
          <p className="text-[var(--color-text-muted)]">Loading OSCE station…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <AlertCircle className="w-12 h-12 text-data-fail mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Station unavailable</h3>
        <p className="text-[var(--color-text-muted)] mb-4">{error}</p>
        <button
          onClick={loadCase}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:opacity-90"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            OSCE Station: {caseData?.patientName || 'Simulated Patient'}
          </h2>
          <p className="text-[var(--color-text-muted)]">
            Chief complaint: {caseData?.chiefComplaint || 'Not specified'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <Clock className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="font-mono font-bold">{formatTime(remainingTime)}</span>
          </div>
          {/* Voice support indicator */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            {speechRecognitionSupported ? (
              <Check className="w-4 h-4 text-data-success" />
            ) : (
              <AlertCircle className="w-4 h-4 text-data-fail" />
            )}
            <span>Voice input</span>
          </div>
          {onExit && (
            <button
              onClick={onExit}
              className="px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-primary)]"
            >
              Exit station
            </button>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Voice & transcript */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">Voice interaction</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleListening}
                  className={`p-3 rounded-full ${isListening ? 'bg-[var(--color-data-fail)]/20' : 'bg-[var(--color-accent)]/20'}`}
                  disabled={!speechRecognitionSupported}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5 text-[var(--color-data-fail)]" />
                  ) : (
                    <Mic className="w-5 h-5 text-[var(--color-accent)]" />
                  )}
                </button>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {isListening ? 'Listening…' : 'Click microphone to speak'}
                </span>
              </div>
              {speechError && (
                <p className="text-sm text-data-fail">{speechError}</p>
              )}
              <div className="mt-4">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">Live transcript</p>
                <div className="min-h-[80px] p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <p className="text-sm">{transcript || 'Your speech will appear here…'}</p>
                  {interimTranscript && (
                    <p className="text-sm text-[var(--color-text-muted)] italic">{interimTranscript}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => speakPrompt('Please describe your symptoms.')}
                disabled={!speechSynthesisSupported || isSpeaking}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)]"
              >
                <Volume2 className="w-4 h-4" />
                Simulate patient response
              </button>
            </div>
          </div>

          {/* Rapport meter */}
          <RapportMeter meter={rapportMeter} />
        </div>

        {/* Middle column: Physical exam UI */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Physical examination</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <BodyMap
                  onRegionClick={(region) => {
                    logAction('exam', `click_${region}`);
                    recordInteraction('click', `body_region_${region}`);
                  }}
                  highlightedRegions={examFindings.map(f => f.region)}
                  findingsMap={findingsMap as Record<BodyRegion, string>}
                />
              </div>
              <div>
                <ExamPanel
                  onExamPerformed={handleExamPerformed}
                  completedExams={examFindings}
                  caseData={examPanelCaseData}
                />
              </div>
            </div>
          </div>

          {/* Findings summary */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">Exam findings</h3>
            {examFindings.length === 0 ? (
              <p className="text-[var(--color-text-muted)] italic">No findings yet. Click on a body region and select an exam maneuver.</p>
            ) : (
              <ul className="space-y-2">
                {examFindings.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-bg-secondary)]">
                    <Target className="w-4 h-4 text-[var(--color-accent)]" />
                    <span className="text-sm">
                      <strong>{f.region}</strong>: {f.finding} {f.isAbnormal && '(Abnormal)'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-[var(--color-border)]">
        <div className="text-sm text-[var(--color-text-muted)]">
          Station phase: <span className="font-medium capitalize">{stationPhase}</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-primary)]"
          >
            Reset station
          </button>
          <button
            onClick={handleSubmit}
            disabled={!sessionId}
            className="px-6 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            Submit & score
          </button>
        </div>
      </div>

      {/* Score report overlay */}
      {showScore && scoreReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4">
          <div className="max-w-2xl w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
            <ScoreReport
              report={scoreReport}
              onClose={() => setShowScore(false)}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};
