import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer - Safely renders markdown content
 *
 * Uses ReactMarkdown with sensible defaults for medical content.
 * Preserves line breaks and supports basic formatting.
 *
 * @param content - Markdown string to render
 * @param className - Additional CSS classes
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content || content.trim() === '') {
    return null;
  }

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          // Style paragraphs
          p: ({ children }) => (
            <p className="text-[var(--color-text-primary)] leading-relaxed mb-3 last:mb-0">
              {children}
            </p>
          ),
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[var(--color-text-primary)] ml-4">{children}</li>
          ),
          // Style emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--color-accent)]">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[var(--color-text-muted)]">{children}</em>
          ),
          // Style code blocks
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 bg-data-neutral/50 rounded text-sm font-mono text-data-pass">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
