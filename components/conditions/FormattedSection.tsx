import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ConditionContent } from "../../lib/loadConditions";
import TreatmentRenderer from "./renderers/TreatmentRenderer";
import DiagnosticsRenderer from "./renderers/DiagnosticsRenderer";
import { sanitizeMedicalMarkdown } from "./markdownSanitizer";

interface FormattedSectionProps {
  content?: ConditionContent;
}

// Normalize stray artifacts without altering intentional DB bolding.
const cleanArtifacts = (text: string): string => {
  if (!text) return text;
  let out = text;
  // Fix spacing after colons
  out = out.replace(/:\s*([A-Za-z])/g, ': $1');
  // Remove lone asterisks near colons or at line boundaries (keep paired **)
  out = out.replace(/:\s*\*\s*/g, ': ');
  out = out.replace(/\s+\*\s*$/gm, '');
  out = out.replace(/^\s*\*\s+/gm, '');
  // Hyphen spacing like "Hyperplasia:- *"
  out = out.replace(/:-\s*\*+/g, ': ');
  // Quote spacing
  out = out.replace(/"\s*\*\*/g, '" ');
  out = out.replace(/\*\*\s*"/g, ' "');
  // Collapse multiple spaces
  out = out.replace(/\s{2,}/g, ' ');
  return out.trim();
};


const FormattedSection: React.FC<FormattedSectionProps> = ({ content }) => {
  if (!content) return null;

  // 1. Handle Structured Data (Steps/Grid)
  if (typeof content === 'object' && !Array.isArray(content) && content !== null) {
    const typedContent = content as any;
    
    if (typedContent.type === 'steps') {
      return <TreatmentRenderer items={typedContent.items} />;
    }

    if (typedContent.type === 'grid') {
      return <DiagnosticsRenderer items={typedContent.items} />;
    }
  }

  // 2. Prepare Markdown Content
  let markdown = "";

  if (Array.isArray(content)) {
    if (content.length === 0) return null; // Fix: Return null for empty arrays to avoid "No details available" flash

    // Convert array of strings to bulleted list
    // Check if items already have bullets to avoid double-bulleting
    markdown = content
      .map((line) => {
        if (typeof line !== 'string') return '';
        const trimmed = line.trim();
        
        // 1. Enhance readability by splitting run-on keys
        let processed = cleanArtifacts(sanitizeMedicalMarkdown(trimmed));

        if (!processed) return '';

        const alreadyList = /^\s*[-*+]\s+/m.test(processed);
        if (alreadyList) {
          return processed;
        }

        // If it clearly ends with a colon and is short, treat as heading and keep as-is.
        const looksLikeIntro = /:\s*$/.test(processed) && processed.length < 160;
        if (looksLikeIntro) {
          return processed;
        }

        // Otherwise, make this array item a list item.
        return `- ${processed}`;
      })
      .filter(Boolean)
      .join("\n");
  } else if (typeof content === "string") {
    if (!content.trim()) return null; // Fix: Return null for empty strings
    markdown = cleanArtifacts(sanitizeMedicalMarkdown(content));
  } else {
    // Fallback for unknown object types
    return null;
  }

  if (!markdown.trim()) return null; // Fix: Return null instead of "No details available" message

  // 3. Render Markdown
  return (
    <div className="formatted-section condition-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Keep headings semantically appropriate inside section cards.
          h1: ({ node, ...props }) => <h4 {...props} />,
          h2: ({ node, ...props }) => <h5 {...props} />,
          h3: ({ node, ...props }) => <h6 {...props} />,

          // Ensure tables are horizontally scrollable on narrow screens.
          table: ({ node, ...props }) => (
            <div className="condition-table-wrap">
              <table {...props} />
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedSection;
