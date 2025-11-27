import React from "react";
import { isMeaningfulContent } from "../../lib/loadConditions";

interface BulletNode {
  parts: React.ReactNode[];
  children: BulletNode[];
}

const BULLET_LEVEL_BY_SYMBOL: Record<string, number> = {
  "•": 0,
  "◦": 1,
  "▪": 2,
};

function toBoldParts(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={`${match[1]}-${match.index}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function buildBulletTree(content: string): BulletNode[] {
  // Normalize content: convert various bullet patterns to standardized format
  let normalized = content.replace(/\r\n/g, "\n");
  
  // If content is on a single line, split by bullet markers
  const hasNewlines = normalized.includes("\n") && normalized.split("\n").filter(l => l.trim()).length > 1;
  
  if (!hasNewlines) {
    // Split by bullet markers: "* " or "*   " patterns
    // First, protect **bold** markers by replacing them temporarily
    const boldPlaceholders: string[] = [];
    normalized = normalized.replace(/\*\*([^*]+)\*\*/g, (match) => {
      boldPlaceholders.push(match);
      return `__BOLD_${boldPlaceholders.length - 1}__`;
    });
    
    // Now split by bullet patterns: " *   " or " * " (with spaces around)
    // This handles patterns like: "text *   **Item:** description *   **Item2:**"
    normalized = normalized
      .replace(/^\s*\*\s+/g, "• ")  // Start of string
      .replace(/\s+\*\s{2,}/g, "\n◦ ")  // " *   " pattern (3+ spaces) -> nested bullet
      .replace(/\s+\*\s+/g, "\n• ");  // " * " pattern -> regular bullet
    
    // Handle numbered items like "1.  " or "2.  "
    normalized = normalized.replace(/\s+(\d+)\.\s{2,}/g, "\n▪ ");
    
    // Restore bold markers
    normalized = normalized.replace(/__BOLD_(\d+)__/g, (_, index) => boldPlaceholders[parseInt(index)]);
  }
  
  const finalLines = normalized.split("\n");
  const roots: BulletNode[] = [];
  const stack: { level: number; node: BulletNode }[] = [];

  finalLines.forEach((line) => {
    if (!line.trim()) return;

    const match = line.match(/^(\s*)([•◦▪])?\s*(.*)$/);
    const leadingSpaces = match?.[1]?.length ?? 0;
    const bulletSymbol = match?.[2] ?? "";
    const text = (match?.[3] ?? line).trim();
    if (!text) return;

    const levelFromSymbol = BULLET_LEVEL_BY_SYMBOL[bulletSymbol];
    const levelFromIndent = Math.floor(leadingSpaces / 4);
    const level = Math.min(
      2,
      Number.isFinite(levelFromSymbol)
        ? (levelFromSymbol as number)
        : levelFromIndent
    );

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const node: BulletNode = { parts: toBoldParts(text), children: [] };

    // ES2022-safe replacement for findLast
    let parent: { level: number; node: BulletNode } | null = null;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].level < level) {
        parent = stack[i];
        break;
      }
    }

    if (parent) {
      parent.node.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push({ level, node });
  });

  return roots;
}

const BulletList: React.FC<{ nodes: BulletNode[]; level: number }> = ({
  nodes,
  level,
}) => {
  if (!nodes.length) return null;

  return (
    <ul className={`condition-bullet-list level-${level}`}>
      {nodes.map((node, index) => (
        <li key={`${level}-${index}`} className="condition-bullet-item">
          <span className="condition-bullet-text">{node.parts}</span>
          {node.children.length > 0 && (
            <BulletList
              nodes={node.children}
              level={Math.min(level + 1, 2)}
            />
          )}
        </li>
      ))}
    </ul>
  );
};

interface FormattedSectionProps {
  content?: string | null;
}

const FormattedSection: React.FC<FormattedSectionProps> = ({ content }) => {
  if (!isMeaningfulContent(content)) return null;

  const bullets = buildBulletTree(content ?? "");

  if (bullets.length === 0) {
    return <p className="condition-empty">No details available for this section.</p>;
  }

  return <BulletList nodes={bullets} level={0} />;
};

export default FormattedSection;
