import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ConditionContent } from '../../lib/loadConditions';
import TreatmentRenderer from './renderers/TreatmentRenderer';
import DiagnosticsRenderer from './renderers/DiagnosticsRenderer';
import { sanitizeMedicalMarkdown } from './markdownSanitizer';

interface FormattedSectionProps {
  content?: ConditionContent;
}

/**
 * FormattedSection - Renders medical condition content from the database.
 *
 * The DB content is already well-formatted markdown. This component:
 * - Renders string fields (overview, pathophysiology, etc.) directly as markdown
 * - Renders array fields (symptoms, physicalExam, etc.) as bullet lists
 * - Preserves all existing bold, italic, headers, and nested structures from DB
 */
const FormattedSection: React.FC<FormattedSectionProps> = ({ content }) => {
  if (!content) return null;

  // Handle Structured Data (Steps/Grid) - legacy renderers
  if (typeof content === 'object' && !Array.isArray(content) && content !== null) {
    const typedContent = content as any;

    if (typedContent.type === 'steps') {
      return <TreatmentRenderer items={typedContent.items} />;
    }

    if (typedContent.type === 'grid') {
      return <DiagnosticsRenderer items={typedContent.items} />;
    }
  }

  // Prepare Markdown Content
  let markdown = '';

  if (Array.isArray(content)) {
    // Array fields: symptoms, physicalExam, riskFactors, complications, etc.
    // Each item is already formatted with bold/content, just needs to be a list item
    if (content.length === 0) return null;

    markdown = content
      .map((item) => {
        if (typeof item !== 'string') return '';
        const cleaned = sanitizeMedicalMarkdown(item.trim());
        if (!cleaned) return '';

        // Check if the item already starts with a list marker
        if (/^\s*[-*+]\s/.test(cleaned)) {
          return cleaned;
        }

        // Make it a bullet point
        return `- ${cleaned}`;
      })
      .filter(Boolean)
      .join('\n');
  } else if (typeof content === 'string') {
    // String fields: overview, pathophysiology, epidemiology, etc.
    // Already properly formatted markdown from DB - preserve as-is
    if (!content.trim()) return null;
    markdown = sanitizeMedicalMarkdown(content);
  } else {
    return null;
  }

  if (!markdown.trim()) return null;

  // Render with ReactMarkdown
  return (
    <div className="formatted-section condition-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Remap headings to fit within section cards (h3 -> h4, etc.)
          h1: ({ node, ...props }) => <h4 className="condition-heading-1" {...props} />,
          h2: ({ node, ...props }) => <h5 className="condition-heading-2" {...props} />,
          h3: ({ node, ...props }) => <h6 className="condition-heading-3" {...props} />,

          // Ensure tables are scrollable on narrow screens
          table: ({ node, ...props }) => (
            <div className="condition-table-wrap">
              <table {...props} />
            </div>
          ),

          // Style list items for better readability
          li: ({ node, children, ...props }) => (
            <li className="condition-list-item" {...props}>
              {children}
            </li>
          ),

          // Blockquotes as key-point / pearl callouts (high-yield emphasis)
          blockquote: ({ node, children, ...props }) => (
            <blockquote className="condition-callout" {...props}>
              {children}
            </blockquote>
          ),

          // Style paragraphs within list items
          p: ({ node, children, ...props }) => (
            <p className="condition-paragraph" {...props}>
              {children}
            </p>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedSection;
