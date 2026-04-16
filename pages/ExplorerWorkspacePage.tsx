import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Filter, Network, Search } from 'lucide-react';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
} from '@/components/workspace';
import { CrossSystemExplorer } from '@/components/explorer/CrossSystemExplorer';
import { ROUTES } from '@/config/routes';

export const ExplorerWorkspacePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Systems Explorer',
            badgeTone: 'plum',
            title: 'Trace how conditions connect across the knowledge graph.',
            subtitle:
              'Follow how diseases, findings, and relationships link together — study the system, not isolated facts.',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Explorer mode"
            value="Graph view"
            detail="Interactive relationship mapping across systems and edge types."
            icon={Network}
          />
          <WorkspaceMetricCard
            label="Search model"
            value="Node-driven"
            detail="Start with a node, then branch outward by system, edge type, and depth."
            accent="#728ba6"
            icon={Search}
          />
          <WorkspaceMetricCard
            label="Filter control"
            value="Live"
            detail="Sidebar filters and path-finding tools stay available during exploration."
            accent="#9a7f9a"
            icon={Filter}
          />
          <WorkspaceMetricCard
            label="Best for"
            value="Integration"
            detail="Especially useful when you want to connect siloed facts across systems."
            accent="#b39b6c"
            icon={ArrowRightLeft}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Integration mode
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                This is where separate facts start feeling like a connected clinical model.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                Keep the heavy graph tooling intact, but frame it like a study workspace rather than
                a detached full-screen utility.
              </p>
            </div>

            <div className="workspace-subsurface rounded-[1.25rem] p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Good uses
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Follow a path from symptom to diagnosis to management.</li>
                <li>Map how one condition touches multiple organ systems.</li>
                <li>Use path-finding to connect concepts you keep missing together.</li>
              </ul>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Cross-system explorer"
          subtitle="The graph tool now sits inside the shared workspace shell while keeping its own search and filtering controls."
        >
          <div className="h-[78vh] min-h-[42rem]">
            <CrossSystemExplorer embedded onClose={() => navigate(ROUTES.STUDY)} />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default ExplorerWorkspacePage;
