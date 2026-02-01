import React from 'react';
import {
  AlertCircle,
  Lightbulb,
  Target,
  Stethoscope,
  UserCheck,
  Hospital,
  ShieldCheck,
  Pill,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MedicalContentData {
  id: string;
  condition: string;
  system: string;
  subcategory: string;
  overview?: string;
  classic_triad?: string | string[];
  clinical_pearls?: string | string[];
  gold_standard_dx?: string;
  first_line_rx?: string;
  buzzwords?: string[];

  // New Reference Grade Fields
  rx_mechanism?: string;
  rx_side_effects?: string;
  age_demographic?: string | string[];
  gender_bias?: string;
  patient_education?: string;
  disposition?: string;
  prevention?: string;
  prognosis?: string;
}

interface MedicalContentRendererProps {
  content: MedicalContentData;
  loading?: boolean;
}

export const MedicalContentRenderer: React.FC<MedicalContentRendererProps> = ({
  content,
  loading = false,
}) => {
  // Parse JSON strings to arrays if needed
  const parseToArray = (data: string | string[] | undefined): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [data];
    } catch {
      return [data];
    }
  };

  const triads = parseToArray(content.classic_triad);
  const pearls = parseToArray(content.clinical_pearls);
  const ageDemographics = parseToArray(content.age_demographic);

  // Markdown renderer component for prose fields
  const MarkdownContent: React.FC<{ content: string }> = ({ content }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm dark:prose-invert max-w-none"
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-[var(--color-bg-secondary)] rounded-xl"></div>
        <div className="h-32 bg-[var(--color-bg-secondary)] rounded-xl"></div>
        <div className="h-24 bg-[var(--color-bg-secondary)] rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          {content.condition}
        </h3>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-4 flex-wrap">
          <span className="px-2 py-1 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-accent)] font-medium">
            {content.system}
          </span>
          <span>•</span>
          <span>{content.subcategory}</span>

          {/* Demographics Badge */}
          {(ageDemographics.length > 0 || content.gender_bias) && (
            <>
              <span>•</span>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {ageDemographics.length > 0 && <span>{ageDemographics.join(' • ')}</span>}
                {ageDemographics.length > 0 && content.gender_bias && <span>•</span>}
                {content.gender_bias && <span>{content.gender_bias}</span>}
              </div>
            </>
          )}
        </div>
        {content.overview && (
          <p className="text-[var(--color-text-secondary)] leading-relaxed">{content.overview}</p>
        )}

        {/* Buzzwords */}
        {content.buzzwords && content.buzzwords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {content.buzzwords.map((buzz) => (
              <span
                key={buzz}
                className="px-3 py-1 text-sm rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
              >
                {buzz}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Classic Triad - Critical Info */}
      {triads.length > 0 && (
        <div className="p-5 rounded-xl border border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-data-fail)]" />
            <h4 className="font-semibold text-[var(--color-text-primary)]">Classic Triad</h4>
          </div>
          <ul className="space-y-2">
            {triads.map((triad, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-data-fail)] mt-1">•</span>
                <span>{triad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clinical Pearls - Key Insights */}
      {pearls.length > 0 && (
        <div className="p-5 rounded-xl border border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/10">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-[var(--color-data-provisional)]" />
            <h4 className="font-semibold text-[var(--color-text-primary)]">Clinical Pearls</h4>
          </div>
          <ul className="space-y-2">
            {pearls.map((pearl, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-data-provisional)] mt-1">💡</span>
                <span>{pearl}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* First-Line Treatment - Success Section */}
      {content.first_line_rx && (
        <div className="p-5 rounded-xl border border-[var(--color-data-pass)]/30 bg-[var(--color-data-pass)]/10">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5 text-[var(--color-data-pass)]" />
            <h4 className="font-semibold text-[var(--color-text-primary)]">First-Line Treatment</h4>
          </div>
          <p className="text-[var(--color-text-secondary)]">{content.first_line_rx}</p>
        </div>
      )}

      {/* Pharmacology Context - Subtle Gray Card (After First-Line Treatment) */}
      {/* Pharmacology Context - Subtle Gray Card (After First-Line Treatment) */}
      {(content.rx_mechanism || content.rx_side_effects) && (
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h4 className="font-semibold text-[var(--color-text-primary)]">Pharmacology Insight</h4>
          </div>
          <div className="space-y-3 text-[var(--color-text-secondary)]">
            {content.rx_mechanism && (
              <div className="flex items-start gap-2">
                <span className="text-lg">⚙️</span>
                <div className="flex-1">
                  <span className="font-medium text-[var(--color-text-primary)]">Mechanism: </span>
                  <MarkdownContent content={content.rx_mechanism} />
                </div>
              </div>
            )}
            {content.rx_side_effects && (
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <span className="font-medium text-[var(--color-text-primary)]">Key Risks: </span>
                  <MarkdownContent content={content.rx_side_effects} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prognosis Section */}
      {content.prognosis && (
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <h4 className="font-semibold text-[var(--color-text-primary)] mb-3">Prognosis</h4>
          <div className="text-[var(--color-text-secondary)]">
            <MarkdownContent content={content.prognosis} />
          </div>
        </div>
      )}

      {/* Clinical Management & Counseling Section */}
      {(content.patient_education || content.disposition || content.prevention) && (
        <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
            Clinical Management & Counseling
          </h3>
          <div className="space-y-4">
            {/* Patient Education */}
            {content.patient_education && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <h5 className="font-semibold text-[var(--color-text-primary)]">
                    Patient Education
                  </h5>
                </div>
                <div className="text-[var(--color-text-secondary)] ml-6">
                  <MarkdownContent content={content.patient_education} />
                </div>
              </div>
            )}

            {/* Disposition/Referral */}
            {content.disposition && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Hospital className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <h5 className="font-semibold text-[var(--color-text-primary)]">
                    Disposition/Referral
                  </h5>
                </div>
                <div className="text-[var(--color-text-secondary)] ml-6">
                  <MarkdownContent content={content.disposition} />
                </div>
              </div>
            )}

            {/* Prevention/Screening */}
            {content.prevention && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <h5 className="font-semibold text-[var(--color-text-primary)]">
                    Prevention/Screening
                  </h5>
                </div>
                <div className="text-[var(--color-text-secondary)] ml-6">
                  <MarkdownContent content={content.prevention} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gold Standard Diagnosis - Semantic Section */}
      {content.gold_standard_dx && (
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h4 className="font-semibold text-[var(--color-text-primary)]">
              Gold Standard Diagnosis
            </h4>
          </div>
          <p className="text-[var(--color-text-secondary)]">{content.gold_standard_dx}</p>
        </div>
      )}

      {/* First-Line Treatment - Success Section */}
      {content.first_line_rx && (
        <div className="p-5 rounded-xl border border-[var(--color-data-pass)]/30 bg-[var(--color-data-pass)]/10">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5 text-[var(--color-data-pass)]" />
            <h4 className="font-semibold text-[var(--color-text-primary)]">First-Line Treatment</h4>
          </div>
          <p className="text-[var(--color-text-secondary)]">{content.first_line_rx}</p>
        </div>
      )}

      {/* Empty State */}
      {triads.length === 0 &&
        pearls.length === 0 &&
        !content.gold_standard_dx &&
        !content.first_line_rx && (
          <div className="p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-center">
            <AlertCircle className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-[var(--color-text-secondary)] font-medium">
              No detailed clinical content available yet
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Content is being generated for this condition
            </p>
          </div>
        )}
    </div>
  );
};

export default MedicalContentRenderer;
