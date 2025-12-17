import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ConditionContent } from "../../lib/loadConditions";
import TreatmentRenderer from "./renderers/TreatmentRenderer";
import DiagnosticsRenderer from "./renderers/DiagnosticsRenderer";

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
        let processed = formatRunOnKeys(trimmed).trimStart();
        
        // 2. Replace non-standard bullets (•, ◦, ▪) with standard Markdown dash on ALL lines
        // This ensures react-markdown renders them as proper <ul>/<li> elements
        processed = processed.replace(/^[\u2022\u25E6\u25AA]\s*/gm, '- ');

        // If formatRunOnKeys expanded this single line into a multi-bullet list, keep it as-is.
        // Wrapping it again would break Markdown list parsing ("- \n- **Key**").
        if (/^[-*+]\s+/m.test(processed)) {
          return processed;
        }
        
        // 3. Otherwise, prepend a dash to make it a list item
        return `- ${processed}`;
      })
      .join("\n");
  } else if (typeof content === "string") {
    if (!content.trim()) return null; // Fix: Return null for empty strings
    markdown = formatRunOnKeys(content).trimStart();
  } else {
    // Fallback for unknown object types
    return null;
  }

  if (!markdown.trim()) return null; // Fix: Return null instead of "No details available" message

  // 3. Render Markdown
  return (
    <div className="formatted-section prose prose-sm max-w-none dark:prose-invert text-gray-800 dark:text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom renderers to match existing styles
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 my-2" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />,
          li: ({ node, ...props }) => <li className="pl-1 leading-relaxed" {...props} />,
          h1: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2 text-primary-800 dark:text-primary-200" {...props} />,
          h2: ({ node, ...props }) => <h4 className="text-md font-bold mt-3 mb-2 text-primary-700 dark:text-primary-300" {...props} />,
          h3: ({ node, ...props }) => <h5 className="text-sm font-bold mt-2 mb-1 text-primary-600 dark:text-primary-400" {...props} />,
          p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-gray-900 dark:text-white" {...props} />,
          a: ({ node, ...props }) => <a className="text-blue-600 hover:underline dark:text-blue-400" {...props} />,
          table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border border-gray-200 dark:border-gray-700" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="bg-gray-50 dark:bg-gray-800" {...props} />,
          th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" {...props} />,
          tbody: ({ node, ...props }) => <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800" {...props} />,
          td: ({ node, ...props }) => <td className="px-3 py-2 whitespace-normal text-sm text-gray-700 dark:text-gray-300" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedSection;
