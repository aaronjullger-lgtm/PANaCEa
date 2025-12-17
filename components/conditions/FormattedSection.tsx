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

// Helper to format run-on key-value pairs into lists and bold keys
// Example: "Inspection: Swelling. Palpation: Tenderness." -> "- **Inspection**: Swelling.\n- **Palpation**: Tenderness."
const formatRunOnKeys = (text: string): string => {
  if (!text) return "";

  // Regex to find "Key: Value" patterns
  // - Key starts with an uppercase letter
  // - Key excludes ':' and line breaks, and avoids obvious sentence endings in the key itself
  // - We replace every "Key: " occurrence with a new bullet (except the first, which starts the list)
  // Disallow sentence punctuation in the key so we don't accidentally capture
  // "This is a sentence. NextKey:" as one giant key.
  const keyPattern = /([A-Z][^:\n\r\.\!\?]{2,80}):\s/g;

  // Only transform when this looks like a run-on list (2+ key/value pairs).
  const matches = text.match(keyPattern);
  if (!matches || matches.length < 2) {
    return text;
  }

  let bulletIndex = 0;
  return text.replace(keyPattern, (_match, key: string) => {
    const cleanedKey = String(key).trim();
    const prefix = bulletIndex === 0 ? "" : "\n";
    bulletIndex += 1;
    return `${prefix}- **${cleanedKey}**: `;
  });
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

        // If the processed string already contains Markdown list items (possibly multi-line), keep it.
        // Wrapping it again would break Markdown list parsing.
        if (/^\s*[-*+]\s+/m.test(processed)) {
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
