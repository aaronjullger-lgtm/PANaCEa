/**
 * Custom Study Mode
 *
 * Main container for the custom study session feature.
 * Manages the flow between builder, runner, and summary phases.
 */

import React, { useState } from 'react';
import type {
  CustomSessionConfig,
  CustomSessionSummary as SummaryType,
} from '../../types/custom-session';
import { customSessionService } from '@/services/core';
import CustomSessionBuilder from '../custom-study/CustomSessionBuilder';
import CustomSessionRunner from '../custom-study/CustomSessionRunner';
import CustomSessionSummary from '../custom-study/CustomSessionSummary';

interface Props {
  onBack: () => void;
}

type Phase = 'builder' | 'running' | 'summary';

export default function CustomStudyMode({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('builder');
  const [config, setConfig] = useState<CustomSessionConfig | null>(null);
  const [summary, setSummary] = useState<SummaryType | null>(null);

  // Handle session start from builder
  const handleStartSession = (sessionConfig: CustomSessionConfig) => {
    setConfig(sessionConfig);
    setPhase('running');
  };

  // Handle session end from runner
  const handleEndSession = () => {
    // Get summary before clearing state
    try {
      const sessionSummary = customSessionService.endSession();
      setSummary(sessionSummary);
      setPhase('summary');
    } catch {
      // If no session state, just go back to builder
      setPhase('builder');
    }
  };

  // Handle starting a new session
  const handleStartNew = () => {
    setConfig(null);
    setSummary(null);
    setPhase('builder');
  };

  // Handle going home
  const handleGoHome = () => {
    customSessionService.clearSessionState();
    onBack();
  };

  return (
    <div className="min-h-screen bg-data-neutral">
      {phase === 'builder' && (
        <CustomSessionBuilder onStartSession={handleStartSession} onCancel={onBack} />
      )}

      {phase === 'running' && config && (
        <CustomSessionRunner config={config} onEnd={handleEndSession} />
      )}

      {phase === 'summary' && summary && (
        <CustomSessionSummary
          summary={summary}
          onStartNew={handleStartNew}
          onGoHome={handleGoHome}
        />
      )}
    </div>
  );
}

export { CustomStudyMode };
