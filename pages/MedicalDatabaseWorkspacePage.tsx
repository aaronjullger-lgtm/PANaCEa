import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, ExternalLink, FileSearch, ShieldCheck } from 'lucide-react';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { MedicalDatabaseSearch } from '@/components/external/MedicalDatabaseSearch';
import { ROUTES } from '@/config/routes';

export const MedicalDatabaseWorkspacePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Evidence Search',
            badgeTone: 'steel',
            title: 'Search outside the app without leaving the workspace.',
            subtitle:
              'Use this page when you need external literature, trial data, or guideline context to support what you are studying inside PANaCEa.',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Connected sources"
            value={3}
            detail="PubMed, ClinicalTrials.gov, and guideline search in one flow."
            icon={Database}
          />
          <WorkspaceMetricCard
            label="Use case"
            value="Evidence pull"
            detail="Best for quick literature checks and guideline confirmation."
            accent="#728ba6"
            icon={FileSearch}
          />
          <WorkspaceMetricCard
            label="Output"
            value="Exportable"
            detail="Search results can be exported or opened at the source."
            accent="#b39b6c"
            icon={ExternalLink}
          />
          <WorkspaceMetricCard
            label="Reliability"
            value="Health-aware"
            detail="Database status is surfaced before you trust a failed search."
            accent="#7a8f6e"
            icon={ShieldCheck}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Research mode
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Treat external evidence as a fast clarification tool, not a workflow reset.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                This workspace is meant for short, focused evidence pulls while you’re already in a
                study session, not a full literature review detour.
              </p>
            </div>

            <div className="workspace-subsurface rounded-[1.25rem] p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Best moments to use it
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Check a guideline after missing a management question.</li>
                <li>Pull a paper or trial when a topic feels uncertain.</li>
                <li>Sanity-check external evidence before saving it to your library.</li>
              </ul>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Medical database search"
          subtitle="The existing search workflow stays intact inside the shared workspace shell."
        >
          <MedicalDatabaseSearch onClose={() => navigate(ROUTES.STUDY)} />
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default MedicalDatabaseWorkspacePage;
