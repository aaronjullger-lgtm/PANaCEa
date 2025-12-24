/**
 * LibraryCard - Renders medical content with proper formatting
 * 
 * Displays condition details with collapsible sections for:
 * - Definition
 * - Symptoms & Presentation
 * - Diagnostics
 * - Treatment
 * - Pearls
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface LibraryCardProps {
  content: {
    id: string;
    condition: string;
    system: string;
    subcategory?: string;
    definition?: string | null;
    symptoms?: any;
    buzzwords?: any;
    clinical_pearls?: any;
    classic_patient?: string | null;
    pathophysiology?: string | null;
    diagnosis?: any;
    treatment?: any;
    complications?: any;
    prognosis?: string | null;
    pance_yield?: string | null;
  };
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<SectionProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-[var(--color-text-secondary)] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
};

const renderContent = (content: any): React.ReactNode => {
  if (!content) return null;

  // Handle arrays
  if (Array.isArray(content)) {
    return (
      <ul className="list-disc list-inside space-y-1">
        {content.map((item, idx) => (
          <li key={idx}>
            {typeof item === 'string' ? (
              <ReactMarkdown className="inline">{item}</ReactMarkdown>
            ) : (
              renderContent(item)
            )}
          </li>
        ))}
      </ul>
    );
  }

  // Handle objects (structured data)
  if (typeof content === 'object') {
    // Check if it's a stepped treatment (First Line, Second Line)
    if (content.type === 'steps' && Array.isArray(content.items)) {
      return (
        <div className="space-y-3">
          {content.items.map((step: any, idx: number) => (
            <div key={idx} className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
              <h4 className="font-semibold text-sm text-[var(--color-text-primary)] mb-1">
                {step.title}
              </h4>
              <ReactMarkdown>{step.content}</ReactMarkdown>
            </div>
          ))}
        </div>
      );
    }

    // Check if it's a grid (labs, diagnostics)
    if (content.type === 'grid' && content.items) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(content.items).map(([key, value]) => (
            <div key={key} className="bg-[var(--color-bg-secondary)] rounded p-2">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">{key}</div>
              <div className="text-sm text-[var(--color-text-primary)] mt-1">
                {String(value)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Generic object rendering
    return (
      <div className="space-y-2">
        {Object.entries(content).map(([key, value]) => (
          <div key={key}>
            <span className="font-medium text-[var(--color-text-primary)]">{key}: </span>
            {renderContent(value)}
          </div>
        ))}
      </div>
    );
  }

  // Handle strings (markdown)
  if (typeof content === 'string') {
    return <ReactMarkdown>{content}</ReactMarkdown>;
  }

  return String(content);
};

export const LibraryCard: React.FC<LibraryCardProps> = ({ content }) => {
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              {content.condition}
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded-md text-[var(--color-text-secondary)] font-medium">
                {content.system}
              </span>
              {content.subcategory && (
                <span className="text-[var(--color-text-muted)]">{content.subcategory}</span>
              )}
              {content.pance_yield && (
                <span
                  className={`px-2 py-1 rounded-md text-xs font-semibold ${
                    content.pance_yield === 'HIGH'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : content.pance_yield === 'MEDIUM'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {content.pance_yield} YIELD
                </span>
              )}
            </div>
          </div>
        </div>
        {content.classic_patient && (
          <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
            <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              CLASSIC PATIENT
            </div>
            <p className="text-sm text-[var(--color-text-primary)]">{content.classic_patient}</p>
          </div>
        )}
      </div>

      {/* Content Sections */}
      <div className="divide-y divide-[var(--color-border)]">
        {content.definition && (
          <CollapsibleSection title="Definition" defaultOpen>
            {renderContent(content.definition)}
          </CollapsibleSection>
        )}

        {content.pathophysiology && (
          <CollapsibleSection title="Pathophysiology">
            {renderContent(content.pathophysiology)}
          </CollapsibleSection>
        )}

        {content.symptoms && (
          <CollapsibleSection title="Symptoms & Presentation">
            {renderContent(content.symptoms)}
          </CollapsibleSection>
        )}

        {content.buzzwords && (
          <CollapsibleSection title="Buzzwords">
            {renderContent(content.buzzwords)}
          </CollapsibleSection>
        )}

        {content.diagnosis && (
          <CollapsibleSection title="Diagnosis">
            {renderContent(content.diagnosis)}
          </CollapsibleSection>
        )}

        {content.treatment && (
          <CollapsibleSection title="Treatment">
            {renderContent(content.treatment)}
          </CollapsibleSection>
        )}

        {content.clinical_pearls && (
          <CollapsibleSection title="Clinical Pearls">
            {renderContent(content.clinical_pearls)}
          </CollapsibleSection>
        )}

        {content.complications && (
          <CollapsibleSection title="Complications">
            {renderContent(content.complications)}
          </CollapsibleSection>
        )}

        {content.prognosis && (
          <CollapsibleSection title="Prognosis">
            {renderContent(content.prognosis)}
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
};
