import React from "react";
import { renderMarkdownHtml } from "../src/lib/markdown";

interface MarkdownBlockProps {
  value?: string;
}

const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ value }) => {
  if (!value) return null;
  return (
    <div
      className="condition-content text-sm text-slate-700"
      dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(value) }}
    />
  );
};

export default MarkdownBlock;
