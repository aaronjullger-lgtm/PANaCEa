import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Brain, MessageSquare, Users } from 'lucide-react';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
} from '@/components/workspace';
import { LiveStudySession } from '@/components/collaboration/LiveStudySession';
import { ROUTES } from '@/config/routes';

export const LiveCollaborationWorkspacePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Live Collaboration',
            badgeTone: 'sage',
            title: 'Study with live context, not just solo repetition.',
            subtitle:
              'Use collaborative mode when peer presence, benchmarking, and quick discussion will sharpen the session instead of distracting from it.',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Session mode"
            value="Live"
            detail="Real-time collaborative question flow with shared presence."
            icon={Users}
          />
          <WorkspaceMetricCard
            label="Benchmarking"
            value="Built-in"
            detail="Leaderboard and peer comparison stay available during the session."
            accent="#728ba6"
            icon={BarChart3}
          />
          <WorkspaceMetricCard
            label="Discussion"
            value="Chat + peers"
            detail="Keep communication alongside the study workflow instead of in a separate tool."
            accent="#9a7f9a"
            icon={MessageSquare}
          />
          <WorkspaceMetricCard
            label="Best for"
            value="Energy"
            detail="Use when live accountability or group momentum makes the session stronger."
            accent="#7a8f6e"
            icon={Brain}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Group mode
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Keep the social layer inside the study workflow instead of around it.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                This page preserves the real-time session interface, but frames it inside the same
                workspace language as the rest of the app so collaboration feels like a mode, not a
                separate product.
              </p>
            </div>

            <div className="workspace-subsurface rounded-[1.25rem] p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Best times to use it
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Quick group warmups before a deeper solo block.</li>
                <li>Peer accountability when motivation is dropping.</li>
                <li>Benchmarking your pace and streaks against others in real time.</li>
              </ul>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Live study session"
          subtitle="The collaboration interface remains intact inside a dedicated workspace frame."
        >
          <div className="h-[78vh] min-h-[42rem]">
            <LiveStudySession onClose={() => navigate(ROUTES.STUDY)} />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default LiveCollaborationWorkspacePage;
