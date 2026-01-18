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
      className="prose prose-sm prose-slate dark:prose-invert max-w-none"
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {content.condition}
        </h3>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4 flex-wrap">
          <span className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium">
            {content.system}
          </span>
          <span>•</span>
          <span>{content.subcategory}</span>

          {/* Demographics Badge */}
          {(ageDemographics.length > 0 || content.gender_bias) && (
            <>
              <span>•</span>
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                {ageDemographics.length > 0 && <span>{ageDemographics.join(' • ')}</span>}
                {ageDemographics.length > 0 && content.gender_bias && <span>•</span>}
                {content.gender_bias && <span>{content.gender_bias}</span>}
              </div>
            </>
          )}
        </div>
        {content.overview && (
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{content.overview}</p>
        )}

        {/* Buzzwords */}
        {content.buzzwords && content.buzzwords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {content.buzzwords.map((buzz) => (
              <span
                key={buzz}
                className="px-3 py-1 text-sm rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                {buzz}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Classic Triad - Red/Rose Callout */}
      {triads.length > 0 && (
        <div className="p-5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h4 className="font-semibold text-rose-900 dark:text-rose-100">Classic Triad</h4>
          </div>
          <ul className="space-y-2">
            {triads.map((triad, idx) => (
              <li key={idx} className="flex items-start gap-2 text-rose-800 dark:text-rose-200">
                <span className="text-rose-500 dark:text-rose-400 mt-1">•</span>
                <span>{triad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clinical Pearls - Amber Callout */}
      {pearls.length > 0 && (
        <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h4 className="font-semibold text-amber-900 dark:text-amber-100">Clinical Pearls</h4>
          </div>
          <ul className="space-y-2">
            {pearls.map((pearl, idx) => (
              <li key={idx} className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                <span className="text-amber-500 dark:text-amber-400 mt-1">💡</span>
                <span>{pearl}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* First-Line Treatment - Green Section */}
      {content.first_line_rx && (
        <div className="p-5 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="font-semibold text-green-900 dark:text-green-100">
              First-Line Treatment
            </h4>
          </div>
          <p className="text-green-800 dark:text-green-200">{content.first_line_rx}</p>
        </div>
      )}

      {/* Pharmacology Context - Subtle Gray Card (After First-Line Treatment) */}
      {(content.rx_mechanism || content.rx_side_effects) && (
        <div className="p-5 rounded-xl border border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-5 h-5 text-slate-400" />
            <h4 className="font-semibold text-slate-200">Pharmacology Insight</h4>
          </div>
          <div className="space-y-3 text-slate-300">
            {content.rx_mechanism && (
              <div className="flex items-start gap-2">
                <span className="text-lg">⚙️</span>
                <div className="flex-1">
                  <span className="font-medium text-slate-200">Mechanism: </span>
                  <MarkdownContent content={content.rx_mechanism} />
                </div>
              </div>
            )}
            {content.rx_side_effects && (
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <span className="font-medium text-slate-200">Key Risks: </span>
                  <MarkdownContent content={content.rx_side_effects} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prognosis Section */}
      {content.prognosis && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Prognosis</h4>
          <div className="text-slate-700 dark:text-slate-300">
            <MarkdownContent content={content.prognosis} />
          </div>
        </div>
      )}

      {/* Clinical Management & Counseling Section */}
      {(content.patient_education || content.disposition || content.prevention) && (
        <div className="p-6 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
          <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-4">
            Clinical Management & Counseling
          </h3>
          <div className="space-y-4">
            {/* Patient Education */}
            {content.patient_education && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h5 className="font-semibold text-indigo-900 dark:text-indigo-100">
                    Patient Education
                  </h5>
                </div>
                <div className="text-indigo-800 dark:text-indigo-200 ml-6">
                  <MarkdownContent content={content.patient_education} />
                </div>
              </div>
            )}

            {/* Disposition/Referral */}
            {content.disposition && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Hospital className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h5 className="font-semibold text-indigo-900 dark:text-indigo-100">
                    Disposition/Referral
                  </h5>
                </div>
                <div className="text-indigo-800 dark:text-indigo-200 ml-6">
                  <MarkdownContent content={content.disposition} />
                </div>
              </div>
            )}

            {/* Prevention/Screening */}
            {content.prevention && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h5 className="font-semibold text-indigo-900 dark:text-indigo-100">
                    Prevention/Screening
                  </h5>
                </div>
                <div className="text-indigo-800 dark:text-indigo-200 ml-6">
                  <MarkdownContent content={content.prevention} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gold Standard Diagnosis - Blue Section */}
      {content.gold_standard_dx && (
        <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">
              Gold Standard Diagnosis
            </h4>
          </div>
          <p className="text-blue-800 dark:text-blue-200">{content.gold_standard_dx}</p>
        </div>
      )}

      {/* First-Line Treatment - Green Section */}
      {content.first_line_rx && (
        <div className="p-5 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="font-semibold text-green-900 dark:text-green-100">
              First-Line Treatment
            </h4>
          </div>
          <p className="text-green-800 dark:text-green-200">{content.first_line_rx}</p>
        </div>
      )}

      {/* Empty State */}
      {triads.length === 0 &&
        pearls.length === 0 &&
        !content.gold_standard_dx &&
        !content.first_line_rx && (
          <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              No detailed clinical content available yet
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Content is being generated for this condition
            </p>
          </div>
        )}
    </div>
  );
};

export default MedicalContentRenderer;
