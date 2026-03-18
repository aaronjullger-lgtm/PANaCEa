/**
 * Advanced Features Panel
 * Centralized settings for Phase 13-19 features
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  Watch,
  Camera,
  Brain,
  Stethoscope,
  GraduationCap,
  Globe,
  Vibrate,
  TrendingDown,
  Users,
  Video,
  FileText,
  List,
  BookOpen,
  Bell,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { AttendingPersona } from '@/services/ai';
import { ATTENDING_PERSONAS, loadPreferredPersona, savePreferredPersona } from '@/services/ai';
import type { SpanishMode } from '@/services/domain';
import { StorageKeys } from '@/lib/storage/storageRegistry';

interface AdvancedFeaturesPanelProps {
  onOpenWellnessCheck?: () => void;
  onOpenARMode?: () => void;
  onOpenForgettingCurve?: () => void;
  onOpenPANRELA?: () => void;
}

export const AdvancedFeaturesPanel: React.FC<AdvancedFeaturesPanelProps> = ({
  onOpenWellnessCheck,
  onOpenARMode,
  onOpenForgettingCurve,
  onOpenPANRELA,
}) => {
  const [wellnessChecksEnabled, setWellnessChecksEnabled] = useState(true);
  const [watchNotificationsEnabled, setWatchNotificationsEnabled] = useState(false);

  useEffect(() => {
    const savedWatch = localStorage.getItem(StorageKeys.WATCH_ENABLED);
    if (savedWatch) setWatchNotificationsEnabled(savedWatch === 'true');
  }, []);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<AttendingPersona>('professor');
  const [spanishMode, setSpanishMode] = useState<SpanishMode>('english');
  const [circadianTrackingEnabled, setCircadianTrackingEnabled] = useState(true);

  useEffect(() => {
    // Load settings from localStorage
    const savedPersona = loadPreferredPersona();
    setSelectedPersona(savedPersona);

    const savedSpanishMode = localStorage.getItem(StorageKeys.SPANISH_MODE) as SpanishMode;
    if (savedSpanishMode) setSpanishMode(savedSpanishMode);

    const savedHaptic = localStorage.getItem(StorageKeys.HAPTIC_ENABLED);
    if (savedHaptic) setHapticEnabled(savedHaptic === 'true');

    const savedWellness = localStorage.getItem(StorageKeys.WELLNESS_ENABLED);
    if (savedWellness) setWellnessChecksEnabled(savedWellness === 'true');

    const savedCircadian = localStorage.getItem(StorageKeys.CIRCADIAN_ENABLED);
    if (savedCircadian) setCircadianTrackingEnabled(savedCircadian === 'true');
  }, []);

  const handlePersonaChange = (persona: AttendingPersona) => {
    setSelectedPersona(persona);
    savePreferredPersona(persona);
  };

  const handleSpanishModeChange = (mode: SpanishMode) => {
    setSpanishMode(mode);
    localStorage.setItem(StorageKeys.SPANISH_MODE, mode);
  };

  const handleHapticToggle = () => {
    const newValue = !hapticEnabled;
    setHapticEnabled(newValue);
    localStorage.setItem(StorageKeys.HAPTIC_ENABLED, newValue.toString());
  };

  const handleWellnessToggle = () => {
    const newValue = !wellnessChecksEnabled;
    setWellnessChecksEnabled(newValue);
    localStorage.setItem(StorageKeys.WELLNESS_ENABLED, newValue.toString());
  };

  const handleCircadianToggle = () => {
    const newValue = !circadianTrackingEnabled;
    setCircadianTrackingEnabled(newValue);
    localStorage.setItem(StorageKeys.CIRCADIAN_ENABLED, newValue.toString());
  };

  return (
    <div className="space-y-6">
      {/* Phase 13: Mental Health & Burnout Prevention */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-[var(--color-accent)]" />
          Mental Health & Wellness
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--color-text-primary)]">
                Wellness Check Reminders
              </h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                Get gentle reminders to take breaks during intense study sessions
              </p>
            </div>
            <button
              onClick={handleWellnessToggle}
              className={`p-2 rounded-lg transition-colors ${
                wellnessChecksEnabled
                  ? 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              {wellnessChecksEnabled ? (
                <ToggleRight className="w-6 h-6" />
              ) : (
                <ToggleLeft className="w-6 h-6" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--color-text-primary)]">
                Circadian Performance Analytics
              </h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                Track when you perform best to optimize study schedule
              </p>
            </div>
            <button
              onClick={handleCircadianToggle}
              className={`p-2 rounded-lg transition-colors ${
                circadianTrackingEnabled
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              {circadianTrackingEnabled ? (
                <ToggleRight className="w-6 h-6" />
              ) : (
                <ToggleLeft className="w-6 h-6" />
              )}
            </button>
          </div>

          {onOpenWellnessCheck && (
            <button
              onClick={onOpenWellnessCheck}
              className="w-full p-4 bg-gradient-to-r from-pink-500 to-rose-500 text-[var(--color-text-inverse)] rounded-lg 
                font-semibold hover:shadow-lg transition-all hover:scale-105"
            >
              Take a Wellness Break Now
            </button>
          )}
        </div>
      </section>

      {/* Phase 15: Hardware & Future-Proofing */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Watch className="w-5 h-5 text-[var(--color-accent)]" />
          Hardware Integration
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--color-text-primary)]">
                Apple Watch Micro-Dosing
              </h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                Receive hourly flashcards on your Apple Watch
              </p>
            </div>
            <button
              onClick={() => {
                const newValue = !watchNotificationsEnabled;
                setWatchNotificationsEnabled(newValue);
                localStorage.setItem(StorageKeys.WATCH_ENABLED, newValue.toString());
              }}
              className={`p-2 rounded-lg transition-colors ${
                watchNotificationsEnabled
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              {watchNotificationsEnabled ? (
                <ToggleRight className="w-6 h-6" />
              ) : (
                <ToggleLeft className="w-6 h-6" />
              )}
            </button>
          </div>

          {onOpenARMode && (
            <button
              onClick={onOpenARMode}
              className="w-full p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-[var(--color-text-inverse)] rounded-lg 
                font-semibold hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Launch AR Anatomy Mode
            </button>
          )}
        </div>
      </section>

      {/* Phase 17: Deep Learning Enhancements */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--color-accent)]" />
          Deep Learning Features
        </h2>
        <div className="space-y-4">
          {onOpenForgettingCurve && (
            <button
              onClick={onOpenForgettingCurve}
              className="w-full p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--color-text-inverse)] rounded-lg 
                font-semibold hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <TrendingDown className="w-5 h-5" />
              View Forgetting Curve Analysis
            </button>
          )}

          <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            <h4 className="font-semibold text-[var(--color-text-primary)] mb-3">
              Virtual Attending Persona
            </h4>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Choose who gives you feedback after questions
            </p>
            <div className="grid grid-cols-1 gap-2">
              {Object.values(ATTENDING_PERSONAS).map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => handlePersonaChange(persona.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedPersona === persona.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{persona.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--color-text-primary)]">
                        {persona.name}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {persona.description}
                      </div>
                    </div>
                    {selectedPersona === persona.id && (
                      <Users className="w-5 h-5 text-[var(--color-accent)]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Phase 18: OSCE & Practical Skills */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-[var(--color-accent)]" />
          OSCE & Practical Skills
        </h2>
        <div className="grid grid-cols-1 gap-3">
          <button
            className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] 
            hover:border-data-pass transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-[var(--color-data-pass)]" />
              <div>
                <h4 className="font-semibold text-[var(--color-text-primary)]">Video Vignettes</h4>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Visual diagnostic challenges
                </p>
              </div>
            </div>
          </button>
          <button
            className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] 
            hover:border-data-pass transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[var(--color-data-pass)]" />
              <div>
                <h4 className="font-semibold text-[var(--color-text-primary)]">
                  SOAP Note Trainer
                </h4>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Practice clinical documentation
                </p>
              </div>
            </div>
          </button>
          <button
            className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] 
            hover:border-data-pass transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <List className="w-5 h-5 text-[var(--color-data-pass)]" />
              <div>
                <h4 className="font-semibold text-[var(--color-text-primary)]">
                  Differential Diagnosis Ranker
                </h4>
                <p className="text-sm text-[var(--color-text-muted)]">Prioritization training</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Phase 19: Post-Graduation & Lifelong Learning */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[var(--color-accent)]" />
          Lifelong Learning
        </h2>
        <div className="space-y-3">
          {onOpenPANRELA && (
            <button
              onClick={onOpenPANRELA}
              className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-[var(--color-text-inverse)] rounded-lg 
                font-semibold hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              PANRE-LA Simulator
            </button>
          )}
          <button
            className="w-full p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] 
            hover:border-[var(--color-accent)] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[var(--color-accent)]" />
              <div>
                <h4 className="font-semibold text-[var(--color-text-primary)]">
                  New Drug Newsfeed
                </h4>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Stay updated on FDA approvals
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Additional Features */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-[var(--color-accent)]" />
          Additional Features
        </h2>
        <div className="space-y-4">
          <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            <h4 className="font-semibold text-[var(--color-text-primary)] mb-3">
              Medical Spanish Mode
            </h4>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Learn clinical Spanish vocabulary in context
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['english', 'spanish', 'side-by-side'] as SpanishMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleSpanishModeChange(mode)}
                  className={`p-2 rounded-lg border-2 text-center text-sm font-semibold transition-all ${
                    spanishMode === mode
                      ? 'border-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-data-provisional)]/50'
                  }`}
                >
                  {mode === 'english' && 'English'}
                  {mode === 'spanish' && 'Spanish'}
                  {mode === 'side-by-side' && 'Both'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--color-text-primary)]">
                Haptic Feedback (Mobile)
              </h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                Vibration patterns for correct/incorrect answers
              </p>
            </div>
            <button
              onClick={handleHapticToggle}
              className={`p-2 rounded-lg transition-colors ${
                hapticEnabled
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              {hapticEnabled ? <Vibrate className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdvancedFeaturesPanel;
