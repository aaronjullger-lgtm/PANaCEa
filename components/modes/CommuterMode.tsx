/**
 * CommuterMode - Hands‑free voice‑driven question practice
 *
 * Integrates speech synthesis, voice recognition, and large touch targets
 * for studying while commuting (driving, walking, public transit).
 *
 * Triggers session generation via useSessionGenerator; on success, navigates
 * to /session/:id where SessionRunner loads questions from GET /api/study/session/:id/questions.
 */

import React, { useState, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { useCommuter } from '@/contexts/CommuterContext';
import { useSessionGenerator } from '@/hooks/useSessionGenerator';
import { MiniModeLayout, MiniModeHeader, MiniModeCard } from './MiniModeLayout';

interface CommuterModeProps {
  onExit?: () => void;
}

const CommuterMode: React.FC<CommuterModeProps> = ({ onExit }) => {
  const commuter = useCommuter();
  const sessionGenerator = useSessionGenerator();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const title = 'Commuter Mode';

  // Enable commuter mode when component mounts
  useEffect(() => {
    commuter.enableCommuterMode();
    commuter.updateSettings({ autoReadQuestions: true, voiceEnabled: true });
    return () => {};
  }, [commuter]);

  // Generate session and navigate to /session/:id (useSessionGenerator handles navigation)
  useEffect(() => {
    const runGenerate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const session = await sessionGenerator.generateSession({
          mode: 'mainSession',
          size: 10,
        });
        if (session) {
          // Navigation happens inside useSessionGenerator; component may unmount
          return;
        }
        setError('Failed to generate session');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate questions');
      } finally {
        setIsLoading(false);
      }
    };
    runGenerate();
  }, [sessionGenerator]);

  if (isLoading) {
    return (
      <MiniModeLayout
        title={title}
        subtitle="Loading your hands-free session..."
        icon={Volume2}
      >
        <MiniModeHeader
          title={title}
          subtitle="Loading your hands-free session..."
          icon={Volume2}
          onExit={onExit}
        />
        <MiniModeCard>
          <div role="status" aria-label="Loading session" className="p-8 text-center">
            <div aria-hidden="true" className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"></div>
            <p className="mt-4 text-[var(--color-text-secondary)]">Preparing questions…</p>
          </div>
        </MiniModeCard>
      </MiniModeLayout>
    );
  }

  // Error or fallback: show retry (on success, useSessionGenerator navigates away)
  return (
    <MiniModeLayout
      title={title}
      subtitle={error ? 'Unable to start session' : 'Start session'}
      icon={Volume2}
    >
      <MiniModeHeader
        title={title}
        subtitle={error ? 'Unable to start session' : 'Start session'}
        icon={Volume2}
        onExit={onExit}
      />
      <MiniModeCard>
        <div className="p-8 text-center">
          {error && <p role="alert" className="text-error">{error}</p>}
          <button
            className="mt-4 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[var(--color-text-inverse)]"
            onClick={() => {
              setError(null);
              setIsLoading(true);
              sessionGenerator
                .generateSession({ mode: 'mainSession', size: 10 })
                .then((session) => {
                  if (!session) setError('Failed to generate session');
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Failed to generate'))
                .finally(() => setIsLoading(false));
            }}
          >
            {error ? 'Retry' : 'Start session'}
          </button>
        </div>
      </MiniModeCard>
    </MiniModeLayout>
  );
};

export default CommuterMode;
