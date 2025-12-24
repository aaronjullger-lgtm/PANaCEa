/**
 * RichText Component
 * 
 * Intelligently renders markdown-style text with proper formatting.
 * Strips raw markdown syntax and applies styled HTML elements.
 * 
 * Features:
 * - Bold text (**text** or __text__) → styled bold
 * - Italic text (*text* or _text_) → styled italic
 * - Inline code (`code`) → code styling
 * - Links ([text](url)) → anchor tags
 * - Prevents raw markdown from leaking into UI
 */

import React from 'react';

interface RichTextProps {
  /** The text content with markdown syntax */
  children: string;
  /** Optional CSS class for the container */
  className?: string;
  /** Accent color for bold text */
  accentColor?: 'blue' | 'green' | 'purple' | 'red' | 'orange';
}

/**
 * Parse markdown-style text and convert to React elements
 */
function parseMarkdown(text: string, accentColor: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Define color classes
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    red: 'text-red-600 dark:text-red-400',
    orange: 'text-orange-600 dark:text-orange-400',
  };

  const accentClass = colorClasses[accentColor] || colorClasses.blue;

  // Regular expressions for markdown patterns
  const patterns = [
    // Bold: **text** or __text__
    {
      regex: /(\*\*|__)(.*?)\1/,
      render: (match: string, delimiter: string, content: string) => (
        <span key={key++} className={`font-bold ${accentClass}`}>
          {content}
        </span>
      ),
    },
    // Italic: *text* or _text_ (but not ** or __)
    {
      regex: /(?<!\*)(\*|_)(?!\1)(.*?)(?<!\1)\1(?!\1)/,
      render: (match: string, delimiter: string, content: string) => (
        <span key={key++} className="italic">
          {content}
        </span>
      ),
    },
    // Inline code: `code`
    {
      regex: /`([^`]+)`/,
      render: (match: string, content: string) => (
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-slate-100"
        >
          {content}
        </code>
      ),
    },
    // Links: [text](url)
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (match: string, text: string, url: string) => (
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline ${accentClass} hover:opacity-80 transition-opacity`}
        >
          {text}
        </a>
      ),
    },
  ];

  while (remaining.length > 0) {
    let matched = false;

    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        // Add text before the match
        if (match.index > 0) {
          elements.push(
            <span key={key++}>{remaining.substring(0, match.index)}</span>
          );
        }

        // Add the rendered element
        const matchArray = Array.from(match) as [string, ...string[]];
        elements.push(pattern.render(...matchArray));

        // Update remaining text
        remaining = remaining.substring(match.index + match[0].length);
        matched = true;
        break;
      }
    }

    // If no pattern matched, add the rest as plain text
    if (!matched) {
      elements.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return elements;
}

/**
 * RichText Component
 */
export const RichText: React.FC<RichTextProps> = ({
  children,
  className = '',
  accentColor = 'blue',
}) => {
  if (!children) return null;

  const parsed = parseMarkdown(children, accentColor);

  return <span className={className}>{parsed}</span>;
};

/**
 * Utility function to strip all markdown syntax (for plain text needs)
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';

  return text
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .trim();
}

/**
 * Utility function to check if text has markdown syntax
 */
export function hasMarkdown(text: string): boolean {
  if (!text) return false;

  const markdownPatterns = [
    /\*\*.*?\*\*/,
    /__.*?__/,
    /\*.*?\*/,
    /_.*?_/,
    /`.*?`/,
    /\[.*?\]\(.*?\)/,
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}

export default RichText;
