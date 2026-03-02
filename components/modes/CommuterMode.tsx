/**
 * CommuterMode - Hands‑free voice‑driven question practice
 * 
 * Integrates speech synthesis, voice recognition, and large touch targets
 * for studying while commuting (driving, walking, public transit).
 */

import React, { useState, useEffect } from 'react';
import { useCommuter } from '@/contexts/CommuterContext';
import { useSessionGenerator } from '@/hooks/useSessionGenerator';
import { useUserContext } from '@/hooks/useUserContext';
import QuizView from '@/components/session/QuizView';
import { MiniModeLayout, MiniModeHeader, MiniModeCard } from './MiniModeLayout';

interface CommuterModeProps {
  onExit?: () => void;
}

const CommuterMode: React.FC<CommuterModeProps> = ({ onExit }) => {
  const commuter = useCommuter();
  const { careerStage } = useUserContext();
  const sessionGenerator = useSessionGenerator();
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enable commuter mode when component mounts
  useEffect(() => {
    commuter.enableCommuterMode();
    // Optionally set auto‑read and voice enabled
    commuter.updateSettings({ autoReadQuestions: true, voiceEnabled: true });
    return () => {
      // Keep commuter mode enabled globally? No need to disable.
    };
  }, [commuter]);

  // Generate a session queue
  useEffect(() => {
    const generateSession = async () => {
      setIsLoading(true);
      try {
        const session = await sessionGenerator.generateSession({
          count: 10,
          focus: 'all',
          systems: [],
          sessionType: 'MAIN',
        });
        setQueue(session.questions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate questions');
      } finally {
        setIsLoading(false);
      }
    };
    generateSession();
  }, [sessionGenerator]);

  if (isLoading) {
    return (
      <MiniModeLayout>
        <MiniModeHeader
          title="Commuter Mode"
          description="Loading your hands‑free session…"
          onExit={onExit}
        />
        <MiniModeCard>
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-action-primary border-t-transparent"></div>
            <p className="mt-4 text-text-secondary">Preparing questions…</p>
          </div>
        </MiniModeCard>
      </MiniModeLayout>
    );
  }

  if (error) {
    return (
      <MiniModeLayout>
        <MiniModeHeader
          title="Commuter Mode"
          description="Unable to start session"
          onExit={onExit}
        />
        <MiniModeCard>
          <div className="p-8 text-center">
            <p className="text-error">{error}</p>
            <button
              className="mt-4 rounded-lg bg-action-primary px-4 py-2 text-white"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </MiniModeCard>
      </MiniModeLayout>
    );
  }

  if (queue.length === 0) {
    return (
      <MiniModeLayout>
        <MiniModeHeader
          title="Commuter Mode"
          description="No questions available"
          onExit={onExit}
        />
        <MiniModeCard>
          <div className="p-8 text-center">
            <p className="text-text-secondary">No questions could be generated. Please try another mode.</p>
          </div>
        </MiniModeCard>
      </MiniModeLayout>
    );
  }

  return (
    <MiniModeLayout>
      <MiniModeHeader
        title="Commuter Mode"
        description="Hands‑free voice‑driven question practice"
        onExit={onExit}
      />
      <div className="p-4">
        <QuizView
          initialQueue={queue}
          setParentQueue={setQueue}
          sessionSettings={{
            mode: 'commuter_mode',
            system: 'all',
            focus: 'all',
            count: 10,
          }}
          isCommuterMode={true}
          onExit={onExit}
        />
      </div>
    </MiniModeLayout>
  );
};

export default CommuterMode;