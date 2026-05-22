import React from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MessageSquare, User, Clock, Award, CheckCircle,
  Activity, Stethoscope, Microscope, FileText, ChevronRight,
  Shield, Globe, FlaskConical, AlertTriangle,
} from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';
import { InlineButtonSpinner } from '@/components/loading';
import { OSCEHistoryPanel } from './osce';
import { OSCE_QUICK_START_PRESETS, type OSCEQuickStartPreset } from '@/config/osce-settings';
import type { OSEConditionSchedule } from '@/lib/osce-spaced-repetition';

export interface OSCEStats {
  totalEncounters: number;
  averageScore: number | null;
  passRate: number | null;
  trend: number[];
}

export interface ConditionStats {
  total: number;
  mastered: number;
  struggling: number;
}

export interface EncounterLandingViewProps {
  /** Callback when user exits the encounter mode entirely */
  onExit?: () => void;
  /** OSCE performance statistics (null = not loaded yet) */
  osceStats: OSCEStats | null;
  /** Spaced repetition condition stats (null = no data) */
  conditionStats: ConditionStats | null;
  /** Conditions currently due for review */
  dueConditions: OSEConditionSchedule[];
  /** AI patient difficulty level */
  aiDifficulty: 'cooperative' | 'difficult' | 'very_difficult';
  /** Whether cultural competency scenario modifier is active */
  enableCulturalCompetency: boolean;
  /** Whether resource-limited scenario modifier is active */
  enableResourceLimited: boolean;
  /** Whether an encounter is currently loading */
  isLoading: boolean;
  /** Error message to display (null = no error) */
  loadError: string | null;
  /** Whether the past encounters history panel is visible */
  showHistoryPanel: boolean;
  // ── Handlers ──
  setAiDifficulty: (level: 'cooperative' | 'difficult' | 'very_difficult') => void;
  setEnableCulturalCompetency: React.Dispatch<React.SetStateAction<boolean>>;
  setEnableResourceLimited: React.Dispatch<React.SetStateAction<boolean>>;
  applyPreset: (preset: OSCEQuickStartPreset) => void;
  handleStartEncounter: (filters?: { targetSystems?: string[]; difficulty?: string } | null) => void;
  setShowHistoryPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadError: React.Dispatch<React.SetStateAction<string | null>>;
}

export const EncounterLandingView: React.FC<EncounterLandingViewProps> = ({
  onExit,
  osceStats,
  conditionStats,
  dueConditions,
  aiDifficulty,
  enableCulturalCompetency,
  enableResourceLimited,
  isLoading,
  loadError,
  showHistoryPanel,
  setAiDifficulty,
  setEnableCulturalCompetency,
  setEnableResourceLimited,
  applyPreset,
  handleStartEncounter,
  setShowHistoryPanel,
  setLoadError,
}) => {
  return (
    <div className="min-h-dvh bg-data-neutral-bg text-data-neutral transition-colors duration-300">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
              <MessageSquare className="w-6 h-6 text-data-neutral" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Virtual OSCE</h1>
              <p className="text-sm text-data-neutral">Interactive Patient Interviews</p>
            </div>
          </div>
          {onExit && (
            <Button variant="ghost" onClick={onExit} aria-label="Exit Encounter">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-4xl font-bold text-data-neutral">Virtual Patient Encounter</h2>
            <p className="text-xl text-data-neutral max-w-2xl mx-auto">
              Practice clinical reasoning in a realistic patient interview simulation. Gather
              history, perform exams, order tests, and make your diagnosis.
            </p>

            {/* Performance Mini-Dashboard */}
            {osceStats && osceStats.totalEncounters > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-6 mt-4 p-3 rounded-xl bg-data-neutral-bg border border-data-neutral max-w-md mx-auto"
              >
                <div className="text-center">
                  <p className="text-lg font-bold text-[var(--color-text-inverse)]">{osceStats.totalEncounters}</p>
                  <p className="text-[10px] text-data-neutral uppercase tracking-wider">Encounters</p>
                </div>
                {osceStats.averageScore !== null && (
                  <div className="text-center">
                    <p className={`text-lg font-bold ${osceStats.averageScore >= 70 ? 'text-data-pass' : 'text-data-provisional'}`}>
                      {osceStats.averageScore}%
                    </p>
                    <p className="text-[10px] text-data-neutral uppercase tracking-wider">Avg Score</p>
                  </div>
                )}
                {osceStats.passRate !== null && (
                  <div className="text-center">
                    <p className={`text-lg font-bold ${osceStats.passRate >= 70 ? 'text-data-pass' : 'text-data-provisional'}`}>
                      {osceStats.passRate}%
                    </p>
                    <p className="text-[10px] text-data-neutral uppercase tracking-wider">Pass Rate</p>
                  </div>
                )}
                {osceStats.trend.length >= 2 && (
                  <div className="flex flex-col items-center">
                    <Sparkline
                      data={osceStats.trend}
                      width={80}
                      height={28}
                      color={(osceStats.trend[osceStats.trend.length - 1] ?? 0) >= 70 ? 'var(--color-data-pass)' : 'var(--color-data-provisional)'}
                      strokeWidth={1.5}
                      min={0}
                      max={100}
                    />
                    <p className="text-[10px] text-data-neutral uppercase tracking-wider">Trend</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Spaced Repetition — Due for Review */}
          {conditionStats && conditionStats.total > 0 && (
            <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--color-text-inverse)] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-data-neutral" />
                  Spaced Repetition
                </h3>
                <div className="flex items-center gap-3 text-xs text-data-neutral">
                  <span>{conditionStats.total} tracked</span>
                  <span className="text-data-pass">{conditionStats.mastered} mastered</span>
                  {conditionStats.struggling > 0 && (
                    <span className="text-data-fail">{conditionStats.struggling} struggling</span>
                  )}
                </div>
              </div>

              {dueConditions.length > 0 ? (
                <>
                  <p className="text-sm text-data-neutral">
                    {dueConditions.length} condition{dueConditions.length !== 1 ? 's' : ''} due for review:
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {dueConditions.slice(0, 6).map((cond) => {
                      const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(cond.nextReviewDate).getTime()) / 86400000));
                      return (
                        <div
                          key={cond.conditionId}
                          className="flex items-center justify-between p-3 rounded-xl border border-data-neutral bg-data-neutral-bg"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--color-text-inverse)] truncate">{cond.conditionName}</p>
                            <div className="flex items-center gap-2 text-xs text-data-neutral mt-0.5">
                              {cond.system && <span className="capitalize">{cond.system}</span>}
                              <span>Last: {cond.lastScore}%</span>
                            </div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                            daysOverdue > 7 ? 'bg-data-fail/20 text-data-fail' : 'bg-data-provisional/20 text-data-provisional'
                          }`}>
                            {daysOverdue === 0 ? 'Today' : `${daysOverdue}d overdue`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {dueConditions.length > 6 && (
                    <p className="text-xs text-data-neutral text-center">
                      +{dueConditions.length - 6} more due
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-data-pass">All caught up — no conditions due for review right now.</p>
              )}
            </div>
          )}

          {/* What You'll Practice */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral">
              <h3 className="text-lg font-semibold text-data-neutral mb-4 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-data-neutral" />
                Clinical Skills Practiced
              </h3>
              <ul className="space-y-2 text-sm text-data-neutral">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />History-taking and interview technique</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />Physical examination interpretation</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />Diagnostic test selection and interpretation</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />Differential diagnosis development</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />Treatment planning</li>
              </ul>
            </div>

            <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral">
              <h3 className="text-lg font-semibold text-data-neutral mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-data-neutral" />
                How You're Evaluated
              </h3>
              <ul className="space-y-2 text-sm text-data-neutral">
                <li className="flex items-center gap-2"><Activity className="w-4 h-4 text-data-neutral flex-shrink-0" />Efficiency: Minimal unnecessary questions</li>
                <li className="flex items-center gap-2"><Activity className="w-4 h-4 text-data-neutral flex-shrink-0" />Thoroughness: Covering key clinical domains</li>
                <li className="flex items-center gap-2"><Activity className="w-4 h-4 text-deep-plum-500 flex-shrink-0" />Diagnostic accuracy: Correct final diagnosis</li>
                <li className="flex items-center gap-2"><Activity className="w-4 h-4 text-deep-plum-500 flex-shrink-0" />Treatment appropriateness: Evidence-based plan</li>
              </ul>
            </div>
          </div>

          {/* How It Works Card */}
          <div className="bg-data-neutral-bg rounded-2xl p-8 border border-data-neutral shadow-lg space-y-6">
            <h3 className="text-2xl font-semibold text-[var(--color-text-inverse)]">Encounter Flow</h3>
            <div className="space-y-5">
              {[
                { num: 1, title: 'Review the Chief Complaint', desc: "You'll be presented with a patient's chief complaint and vital signs. The patient will respond dynamically to your questions.", Icon: User },
                { num: 2, title: 'Take History', desc: 'Type questions to gather history. Use focused, open-ended questions first, then targeted follow-ups. Information is revealed only when you ask!', Icon: MessageSquare },
                { num: 3, title: 'Physical Exam & Diagnostics', desc: 'Request physical exam maneuvers and order labs/imaging. Build your differential diagnosis as you gather data.', Icon: Microscope },
                { num: 4, title: 'Diagnose & Treat', desc: 'Submit your diagnosis and treatment plan. Receive detailed feedback from a virtual preceptor on your clinical reasoning.', Icon: FileText },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center flex-shrink-0 border border-data-neutral">
                    <step.Icon className="w-5 h-5 text-data-neutral" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-[var(--color-text-inverse)] mb-1">
                      <span className="text-data-neutral mr-2">{step.num}.</span>{step.title}
                    </h4>
                    <p className="text-data-neutral text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pro Tips */}
            <div className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
              <p className="text-sm text-data-neutral font-semibold mb-3 flex items-center gap-2">
                <Award className="w-4 h-4" />Clinical Pearls
              </p>
              <ul className="text-sm text-data-neutral space-y-2">
                <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" /><span>Start with open-ended questions (onset, location, duration, character, aggravating/alleviating factors)</span></li>
                <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" /><span>Review of systems should be targeted based on your differential</span></li>
                <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" /><span>Order tests to rule in or rule out specific diagnoses, not as a shotgun approach</span></li>
                <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" /><span>Think about pre-test probability before ordering expensive or invasive tests</span></li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-data-neutral">
              <Clock className="w-4 h-4" /><span>Typical encounter: 10-20 minutes</span>
            </div>
          </div>

          {/* Scenario Settings */}
          <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral shadow-md space-y-5">
            <h3 className="text-lg font-semibold text-[var(--color-text-inverse)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-data-neutral" />Encounter Settings
            </h3>

            {/* AI Difficulty */}
            <div>
              <label className="text-sm font-medium text-data-neutral block mb-2">Patient Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {(['cooperative', 'difficult', 'very_difficult'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setAiDifficulty(level)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      aiDifficulty === level
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                        : 'bg-data-neutral-bg text-data-neutral border-data-neutral hover:border-[var(--color-accent)]/50'
                    }`}
                  >
                    {level === 'cooperative' ? 'Cooperative' : level === 'difficult' ? 'Difficult' : 'Very Difficult'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-data-neutral mt-1">
                {aiDifficulty === 'cooperative' && 'Patient provides clear, direct answers.'}
                {aiDifficulty === 'difficult' && 'Patient gives vague answers and needs redirection.'}
                {aiDifficulty === 'very_difficult' && 'Patient is hostile, in pain, or cognitively impaired.'}
              </p>
            </div>

            {/* Toggle Row */}
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={() => setEnableCulturalCompetency(prev => !prev)}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                  enableCulturalCompetency
                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                    : 'bg-data-neutral-bg border-data-neutral hover:border-[var(--color-accent)]/30'
                }`}
              >
                <Globe className={`w-5 h-5 mt-0.5 flex-shrink-0 ${enableCulturalCompetency ? 'text-[var(--color-accent)]' : 'text-data-neutral'}`} />
                <div>
                  <span className={`text-sm font-medium block ${enableCulturalCompetency ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-inverse)]'}`}>
                    Cultural Competency
                  </span>
                  <span className="text-xs text-data-neutral">Patient has cultural beliefs affecting care decisions</span>
                </div>
              </button>

              <button
                onClick={() => setEnableResourceLimited(prev => !prev)}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                  enableResourceLimited
                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                    : 'bg-data-neutral-bg border-data-neutral hover:border-[var(--color-accent)]/30'
                }`}
              >
                <FlaskConical className={`w-5 h-5 mt-0.5 flex-shrink-0 ${enableResourceLimited ? 'text-[var(--color-accent)]' : 'text-data-neutral'}`} />
                <div>
                  <span className={`text-sm font-medium block ${enableResourceLimited ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-inverse)]'}`}>
                    Resource-Limited
                  </span>
                  <span className="text-xs text-data-neutral">Rural clinic — no CT, MRI, or advanced imaging</span>
                </div>
              </button>
            </div>
          </div>

          {/* Quick-Start Presets */}
          <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral space-y-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-inverse)] flex items-center gap-2">
              <Activity className="w-5 h-5 text-data-neutral" />Quick Start — Focused Practice
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {OSCE_QUICK_START_PRESETS.slice(0, 8).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  disabled={isLoading}
                  className="p-3 rounded-xl border border-data-neutral bg-data-neutral-bg hover:border-[var(--color-accent)]/50 transition-all text-left group disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-[var(--color-text-inverse)] group-hover:text-[var(--color-accent)] transition-colors block mb-1">
                    {preset.label}
                  </span>
                  <span className="text-xs text-data-neutral line-clamp-2">{preset.description}</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      preset.difficulty === 'cooperative' ? 'bg-data-pass/20 text-data-pass'
                        : preset.difficulty === 'difficult' ? 'bg-data-provisional/20 text-data-provisional'
                        : 'bg-data-fail/20 text-data-fail'
                    }`}>
                      {preset.difficulty === 'cooperative' ? 'Easy' : preset.difficulty === 'difficult' ? 'Hard' : 'Expert'}
                    </span>
                    {preset.enableCulturalCompetency && <Globe className="w-3 h-3 text-data-neutral" />}
                    {preset.enableResourceLimited && <FlaskConical className="w-3 h-3 text-data-neutral" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Past Encounters Toggle */}
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => setShowHistoryPanel(prev => !prev)}>
              <Clock className="w-4 h-4" />
              {showHistoryPanel ? 'Hide Past Encounters' : 'View Past Encounters'}
            </Button>
          </div>

          {/* History Panel */}
          <AnimatePresence>
            {showHistoryPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <OSCEHistoryPanel token={null} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Start Button */}
          <div className="text-center space-y-4">
            <motion.button
              onClick={() => handleStartEncounter()}
              disabled={isLoading}
              className="px-10 py-4 bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 mx-auto shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <>
                  <InlineButtonSpinner />Generating Case...
                </>
              ) : (
                <>
                  Start Interview
                  <MessageSquare className="w-5 h-5" />
                </>
              )}
            </motion.button>

            {loadError && (
              <motion.div
                initial={{ y: -10 }}
                animate={{ y: 0 }}
                className="max-w-md mx-auto p-4 bg-[var(--color-data-fail)]/5 border border-[var(--color-data-fail)]/20 rounded-xl"
              >
                <p className="text-sm text-[var(--color-data-fail)]">{loadError}</p>
                <Button variant="ghost" size="sm" onClick={() => setLoadError(null)}>Dismiss</Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EncounterLandingView;
