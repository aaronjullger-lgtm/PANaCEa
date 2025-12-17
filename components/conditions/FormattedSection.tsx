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

// Helper to format run-on key-value pairs into lists and nested bullets when appropriate.
// Example: "Inspection: Swelling. Palpation: Tenderness." -> "- **Inspection**: Swelling.\n- **Palpation**: Tenderness."
// For values with multiple clauses (e.g., semicolons or multiple sentences), create sub-bullets for better scanning.
const formatRunOnKeys = (text: string): string => {
  if (!text) return "";

  // Capture pairs like "Key: value" where key is reasonably short and capitalized.
  const pairPattern = /([A-Z][^:\n\r\.\!\?]{2,80}):\s*([^]+?)(?=(?:[A-Z][^:\n\r\.\!\?]{2,80}):|$)/g;
  const pairs = Array.from(text.matchAll(pairPattern));

  // Only treat as structured if we see 2+ pairs; otherwise leave untouched to avoid false positives.
  if (pairs.length < 2) {
    return text;
  }

  const formatValue = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    // If it already contains markdown list markers, return as-is (with a space for readability).
    if (/^\s*[-*+]\s+/m.test(trimmed)) {
      return ` ${trimmed}`;
    }

    // Prefer semicolons or bullet dots as list separators.
    let parts = trimmed.split(/;\s+|•\s+/).filter(Boolean);

    // If no semicolons, attempt sentence-based split when multiple sentences are present.
    if (parts.length < 2) {
      const sentenceSplit = trimmed.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean);
      if (sentenceSplit.length >= 2) {
        parts = sentenceSplit;
      }
    }

    // If we have multiple meaningful parts, return as sub-bullets; otherwise keep inline.
    if (parts.length >= 2 && parts.every(p => p.trim().length > 0 && p.trim().length < 300)) {
      return `\n${parts.map(p => `  - ${p.trim()}`).join('\n')}`;
    }

    return ` ${trimmed}`;
  };

  const cleanInline = (val: string) => {
    // Remove stray leading/trailing ** if not balanced
    if (/^\*\*[^*]+$/.test(val)) {
      val = val.replace(/^\*\*\s*/, '');
    }
    if (/^[^*]+\*\*$/.test(val)) {
      val = val.replace(/\s*\*\*$/, '');
    }
    return val.trim();
  };

  const lines = pairs.map(([, rawKey, rawValue]) => {
    const key = String(rawKey).trim();
    const value = formatValue(String(rawValue));
    const needsNewline = /\n/.test(value);
    const cleanedValue = value.replace(/^\s+/, '');
    return needsNewline
      ? `- **${key}**:${cleanedValue}`
      : `- **${key}**: ${cleanInline(cleanedValue)}`;
  });

  return lines.join("\n");
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
        let processed = sanitizeMedicalMarkdown(formatRunOnKeys(trimmed));

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
    markdown = sanitizeMedicalMarkdown(formatRunOnKeys(content));
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
