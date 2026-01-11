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
  ToggleRight
} from 'lucide-react';
import type { AttendingPersona } from '@/services/ai';
import { 
  ATTENDING_PERSONAS, 
  loadPreferredPersona, 
  savePreferredPersona 
} from '@/services/ai';
import type { SpanishMode } from '@/services/domain';

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
  onOpenPANRELA
}) => {
  const [wellnessChecksEnabled, setWellnessChecksEnabled] = useState(true);
  const [watchNotificationsEnabled, setWatchNotificationsEnabled] = useState(false);

  useEffect(() => {
    const savedWatch = localStorage.getItem('panceai_watch_enabled');
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

    const savedSpanishMode = localStorage.getItem('panceai_spanish_mode') as SpanishMode;
    if (savedSpanishMode) setSpanishMode(savedSpanishMode);

    const savedHaptic = localStorage.getItem('panceai_haptic_enabled');
    if (savedHaptic) setHapticEnabled(savedHaptic === 'true');

    const savedWellness = localStorage.getItem('panceai_wellness_enabled');
    if (savedWellness) setWellnessChecksEnabled(savedWellness === 'true');

    const savedCircadian = localStorage.getItem('panceai_circadian_enabled');
    if (savedCircadian) setCircadianTrackingEnabled(savedCircadian === 'true');
  }, []);

  const handlePersonaChange = (persona: AttendingPersona) => {
    setSelectedPersona(persona);
    savePreferredPersona(persona);
  };

  const handleSpanishModeChange = (mode: SpanishMode) => {
    setSpanishMode(mode);
    localStorage.setItem('panceai_spanish_mode', mode);
  };

  const handleHapticToggle = () => {
    const newValue = !hapticEnabled;
    setHapticEnabled(newValue);
    localStorage.setItem('panceai_haptic_enabled', newValue.toString());
  };

  const handleWellnessToggle = () => {
    const newValue = !wellnessChecksEnabled;
    setWellnessChecksEnabled(newValue);
    localStorage.setItem('panceai_wellness_enabled', newValue.toString());
  };

  const handleCircadianToggle = () => {
    const newValue = !circadianTrackingEnabled;
    setCircadianTrackingEnabled(newValue);
    localStorage.setItem('panceai_circadian_enabled', newValue.toString());
  };

  return (
    <div className="space-y-6">
      {/* Phase 13: Mental Health & Burnout Prevention */}
      <section>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" />
          Mental Health & Wellness
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">Wellness Check Reminders</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get gentle reminders to take breaks during intense study sessions
              </p>
            </div>
            <button
              onClick={handleWellnessToggle}
              className={`p-2 rounded-lg transition-colors ${
                wellnessChecksEnabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
              }`}
            >
              {wellnessChecksEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">Circadian Performance Analytics</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track when you perform best to optimize study schedule
              </p>
            </div>
            <button
              onClick={handleCircadianToggle}
              className={`p-2 rounded-lg transition-colors ${
                circadianTrackingEnabled
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
              }`}
            >
              {circadianTrackingEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>

          {onOpenWellnessCheck && (
            <button
              onClick={onOpenWellnessCheck}
              className="w-full p-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg 
                font-semibold hover:shadow-lg transition-all hover:scale-105"
            >
              Take a Wellness Break Now
            </button>
          )}
        </div>
      </section>

      {/* Phase 15: Hardware & Future-Proofing */}
      <section>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Watch className="w-5 h-5 text-blue-500" />
          Hardware Integration
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">Apple Watch Micro-Dosing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Receive hourly flashcards on your Apple Watch
              </p>
            </div>
            <button
              onClick={() => {
                const newValue = !watchNotificationsEnabled;
                setWatchNotificationsEnabled(newValue);
                localStorage.setItem('panceai_watch_enabled', newValue.toString());
              }}
              className={`p-2 rounded-lg transition-colors ${
                watchNotificationsEnabled
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
              }`}
            >
              {watchNotificationsEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>

          {onOpenARMode && (
            <button
              onClick={onOpenARMode}
              className="w-full p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg 
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          Deep Learning Features
        </h3>
        <div className="space-y-4">
          {onOpenForgettingCurve && (
            <button
              onClick={onOpenForgettingCurve}
              className="w-full p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg 
                font-semibold hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <TrendingDown className="w-5 h-5" />
              View Forgetting Curve Analysis
            </button>
          )}

          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Virtual Attending Persona</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose who gives you feedback after questions
            </p>
            <div className="grid grid-cols-1 gap-2">
              {Object.values(ATTENDING_PERSONAS).map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => handlePersonaChange(persona.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedPersona === persona.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{persona.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {persona.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {persona.description}
                      </div>
                    </div>
                    {selectedPersona === persona.id && (
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-green-500" />
          OSCE & Practical Skills
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <button className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
            hover:border-green-400 transition-colors text-left">
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Video Vignettes</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Visual diagnostic challenges
                </p>
              </div>
            </div>
          </button>
          <button className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
            hover:border-green-400 transition-colors text-left">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">SOAP Note Trainer</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Practice clinical documentation
                </p>
              </div>
            </div>
          </button>
          <button className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
            hover:border-green-400 transition-colors text-left">
            <div className="flex items-center gap-3">
              <List className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Differential Diagnosis Ranker</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Prioritization training
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Phase 19: Post-Graduation & Lifelong Learning */}
      <section>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-500" />
          Lifelong Learning
        </h3>
        <div className="space-y-3">
          {onOpenPANRELA && (
            <button
              onClick={onOpenPANRELA}
              className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg 
                font-semibold hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              PANRE-LA Simulator
            </button>
          )}
          <button className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
            hover:border-indigo-400 transition-colors text-left">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">New Drug Newsfeed</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Stay updated on FDA approvals
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Additional Features */}
      <section>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-orange-500" />
          Additional Features
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Medical Spanish Mode</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Learn clinical Spanish vocabulary in context
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['english', 'spanish', 'side-by-side'] as SpanishMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleSpanishModeChange(mode)}
                  className={`p-2 rounded-lg border-2 text-center text-sm font-semibold transition-all ${
                    spanishMode === mode
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-orange-300'
                  }`}
                >
                  {mode === 'english' && 'English'}
                  {mode === 'spanish' && 'Spanish'}
                  {mode === 'side-by-side' && 'Both'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">Haptic Feedback (Mobile)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Vibration patterns for correct/incorrect answers
              </p>
            </div>
            <button
              onClick={handleHapticToggle}
              className={`p-2 rounded-lg transition-colors ${
                hapticEnabled
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
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
