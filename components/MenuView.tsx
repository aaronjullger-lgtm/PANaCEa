import React, { useMemo, useState } from 'react';
import type { PerformanceRecord, TopicStats, SessionSettings, Question } from '../types';
import SessionSetupModal from './SessionSetupModal';
import ProgressRing from './ProgressRing';
import TopicHeatmap from './TopicHeatmap';
import TopicDetailModal from './TopicDetailModal';

interface MenuViewProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  onBackToQuiz: () => void; // "Continue Session"
  hasActiveSession: boolean;
  clearPerformanceData: () => void;
  clearMissedQuestionsData: () => void;
  clearFlaggedQuestionsData: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onStartSession: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  onConfirmSession: (settings: SessionSettings) => void;
  growthAreas: string[];
}

const MenuView: React.FC<MenuViewProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  onBackToQuiz,
  hasActiveSession,
  clearPerformanceData,
  clearMissedQuestionsData,
  clearFlaggedQuestionsData,
  onStartSession,
  isModalOpen,
  onCloseModal,
  onConfirmSession,
  growthAreas
}) => {
  const [selectedTopic, setSelectedTopic] = useState<TopicStats | null>(null);

  const stats = useMemo(() => {
  // PANCE-level, ALL-topics sessions only
  const panceAll = performanceData.filter(
    (q) => q.focus === 'all' // (and optionally q.difficulty === 'same')
  );

  const last360 = panceAll.slice(-360);
  const correct360 = last360.filter(q => q.isCorrect).length;
  const overallScore = last360.length > 0 ? (correct360 / last360.length) * 100 : 0;

  const topics: string[] = Array.from(new Set(panceAll.map(q => q.topic)));

  const topicScores: TopicStats[] = topics
    .map(topic => {
      const topicQuestions = panceAll
        .filter(q => q.topic === topic)
        .slice(-100);
      const correct = topicQuestions.filter(q => q.isCorrect).length;
      const total = topicQuestions.length;
      const score = total > 0 ? (correct / total) * 100 : 0;
      return { topic, score, correct, total };
    })
    .sort((a, b) => b.total - a.total);

  return { overallScore, correct360, total360: last360.length, topicScores };
}, [performanceData]);

    const topics: string[] = Array.from(
      new Set(performanceData.map(q => q.topic))
    );

    const topicScores: TopicStats[] = topics
      .map(topic => {
        const topicQuestions = performanceData
          .filter(q => q.topic === topic)
          .slice(-100);
        const correct = topicQuestions.filter(q => q.isCorrect).length;
        const total = topicQuestions.length;
        const score = total > 0 ? (correct / total) * 100 : 0;
        return { topic, score, correct, total };
      })
      .sort((a, b) => b.total - a.total);

    return { overallScore, correct360, total360: last360.length, topicScores };
  }, [performanceData];

  const dueQuestionsCount = useMemo(() => {
    if (!missedQuestions) return 0;
    const today = new Date().toISOString().split('T')[0];
    return missedQuestions.filter(
      q => q.nextReviewDate && q.nextReviewDate <= today
    ).length;
  }, [missedQuestions]);

  const handleTopicSessionStart = (topicAbbr: string) => {
    setSelectedTopic(null);
    onConfirmSession({
      focus: 'topic',
      difficulty: 'same',
      topic: topicAbbr
    });
  };

  return (
    <>
      {isModalOpen && (
        <SessionSetupModal
          onClose={onCloseModal}
          onStart={onConfirmSession}
          growthAreas={growthAreas}
          dueQuestionsCount={dueQuestionsCount}
          flaggedQuestionsCount={flaggedQuestions.length}
        />
      )}

      {selectedTopic && (
        <TopicDetailModal
          topicStats={selectedTopic}
          onClose={() => setSelectedTopic(null)}
          onStartSession={handleTopicSessionStart}
        />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

          {/* HEADER */}
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#3D1B0E]">
                PANaCEa
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Adaptive PANCE AI practice.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              {hasActiveSession && (
                <button
                  onClick={onBackToQuiz}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-300 transition"
                >
                  Continue Session
                </button>
              )}
              <button
                onClick={onStartSession}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#3D1B0E] text-white text-xs font-semibold shadow-md hover:bg-[#2b130a] active:scale-[0.98] transition"
              >
                {hasActiveSession ? 'Start New Session' : 'Start Study Session'}
              </button>
            </div>
          </header>

          {/* OVERALL SCORE CARD */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">
              Overall Score
            </h2>
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 flex items-center justify-center">
                <ProgressRing score={stats.overallScore} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-2xl font-bold text-slate-900 leading-tight">
                  {stats.total360 === 0
                    ? '0%'
                    : `${stats.overallScore.toFixed(0)}%`}
                </p>
                <p className="text-sm text-slate-500">
                  Based on the last{' '}
                  <span className="font-semibold text-slate-700">
                    {stats.total360}
                  </span>{' '}
                  questions (
                  <span className="font-semibold text-emerald-600">
                    {stats.correct360}
                  </span>
                  /
                  <span className="font-semibold">{stats.total360}</span>).
                </p>
                {stats.total360 === 0 && (
                  <p className="text-xs text-slate-400">
                    Start a session to begin filling your dashboard.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* KNOWLEDGE MAP CARD */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Knowledge Map
              </h2>
              <p className="text-[11px] text-slate-400">
                Tap a system tile for details.
              </p>
            </div>
            <TopicHeatmap
              topicScores={stats.topicScores}
              onTopicClick={setSelectedTopic}
            />
          </section>

          {/* MANAGE DATA CARD */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">
              Manage Data
            </h2>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                onClick={clearPerformanceData}
                className="px-3 py-2 rounded-full border text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Clear All Performance Data
              </button>

              <button
                onClick={clearMissedQuestionsData}
                disabled={missedQuestions.length === 0}
                className="px-3 py-2 rounded-full border text-xs font-semibold border-red-300 text-red-700 disabled:border-slate-200 disabled:text-slate-400 disabled:bg-slate-50 hover:bg-red-50 disabled:hover:bg-slate-50"
                title={
                  missedQuestions.length === 0
                    ? 'No missed questions to clear'
                    : 'Clear missed questions bank'
                }
              >
                Clear Missed Qs ({missedQuestions.length})
              </button>

              <button
                onClick={clearFlaggedQuestionsData}
                disabled={flaggedQuestions.length === 0}
                className="px-3 py-2 rounded-full border text-xs font-semibold border-amber-300 text-amber-700 disabled:border-slate-200 disabled:text-slate-400 disabled:bg-slate-50 hover:bg-amber-50 disabled:hover:bg-slate-50"
                title={
                  flaggedQuestions.length === 0
                    ? 'No flagged questions to clear'
                    : 'Clear flagged questions'
                }
              >
                Clear Flagged Qs ({flaggedQuestions.length})
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default MenuView;
