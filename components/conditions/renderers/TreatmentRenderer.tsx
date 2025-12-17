import React from 'react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { sanitizeMedicalMarkdown } from "../markdownSanitizer";

interface Step {
  title: string;
  content: string;
}

interface TreatmentRendererProps {
  items: Step[];
}

const TreatmentRenderer: React.FC<TreatmentRendererProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col space-y-0 mt-4">
      {items.map((step, idx) => (
        <div key={idx} className="relative pl-8 pb-8 last:pb-0 group">
          {/* Vertical connector line */}
          {idx !== items.length - 1 && (
            <div className="absolute left-3.5 top-8 bottom-0 w-0.5 bg-blue-100 dark:bg-blue-900/50" />
          )}
          
          {/* Numbered Circle */}
          <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 z-10 shadow-sm">
            {idx + 1}
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 capitalize">
              {step.title}
            </h4>
            <div className="prose dark:prose-invert text-sm text-gray-600 dark:text-gray-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc pl-5 space-y-1 my-2" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="pl-1 leading-relaxed" {...props} />
                  ),
                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                }}
              >
                {sanitizeMedicalMarkdown(step.content)}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TreatmentRenderer;
