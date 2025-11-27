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
  const lines = normalized.split("\n");
  const hasNewlines = lines.filter(l => l.trim()).length > 1;
  
  if (!hasNewlines) {
    // Split by bullet markers: "* " or "*   " patterns
    // First, protect **bold** markers by replacing them temporarily
    const boldPlaceholders: string[] = [];
    normalized = normalized.replace(/\*\*([^*]+)\*\*/g, (match) => {
      boldPlaceholders.push(match);
      return `__BOLD_${boldPlaceholders.length - 1}__`;
    });
    
    // Split by bullet patterns - all bullets start at same level initially
    normalized = normalized
      .replace(/^\s*\*\s+/g, "• ")  // Start of string
      .replace(/\s+\*\s+/g, "\n• ");  // " * " or " *   " pattern -> bullet
    
    // Handle numbered items like "1.  " or "2.  "
    normalized = normalized.replace(/\s+(\d+)\.\s{2,}/g, "\n▪ ");
    
    // Restore bold markers with bounds checking
    normalized = normalized.replace(/__BOLD_(\d+)__/g, (match, index) => {
      const idx = parseInt(index);
      return idx < boldPlaceholders.length ? boldPlaceholders[idx] : match;
    });
  }
  
  const finalLines = normalized.split("\n");
  const roots: BulletNode[] = [];
  const stack: { level: number; node: BulletNode }[] = [];
  
  // Track parent headers that indicate nesting context
  // An item ending with "**HeaderText:**" means subsequent items are its children
  // until we see another similar pattern without a preceding header-only line
  let currentNestLevel = 0;
  let inNestedContext = false;

  finalLines.forEach((line, lineIndex) => {
    if (!line.trim()) return;

    // Check if line starts with asterisk bullet pattern: "*   " or "* "
    // This indicates a nested bullet point (not bold marker which is "**")
    const asteriskBulletMatch = line.match(/^(\*\s{1,})(.*)$/);
    let text: string;
    let isAsteriskBullet = false;
    let leadingSpaces = 0;
    let bulletSymbol = "";

    if (asteriskBulletMatch) {
      // This is a nested bullet using asterisk syntax like "*   **Text**:"
      isAsteriskBullet = true;
      text = asteriskBulletMatch[2].trim();
    } else {
      const match = line.match(/^(\s*)([•◦▪])?\s*(.*)$/);
      leadingSpaces = match?.[1]?.length ?? 0;
      bulletSymbol = match?.[2] ?? "";
      text = (match?.[3] ?? line).trim();
    }
    
    if (!text) return;

    // Check if this line is ONLY a header (bold text ending with colon, with minimal other text)
    // Pattern: starts with optional text, then **Header:** and ends there
    const isHeaderOnly = /\*\*[^*]+:\*\*\s*$/.test(text);
    
    // Check if this line ENDS with a header pattern (could have text before)
    const endsWithHeader = /\*\*[^*]+:\*\*\s*$/.test(text);
    
    // Check if this is an item that starts with a bold term (like **Paroxysmal:**)
    const startsWithBoldTerm = /^\*\*[^*]+:\*\*/.test(text);

    // Determine level
    let level = 0;
    
    if (isAsteriskBullet) {
      // Lines starting with "* " or "*   " are nested bullets (level 1)
      level = 1;
    } else if (bulletSymbol === "▪") {
      // Numbered items are always deeply nested
      level = 2;
    } else if (bulletSymbol === "◦") {
      level = 1;
    } else {
      // For regular bullets, check context
      if (inNestedContext && !isHeaderOnly) {
        // We're in a nested context (after a header-only line)
        // Items that start with bold terms are nested
        if (startsWithBoldTerm) {
          level = currentNestLevel + 1;
        } else {
          // Non-bold items might break the nesting
          level = 0;
          inNestedContext = false;
        }
      } else {
        level = Math.floor(leadingSpaces / 4);
      }
    }
    
    level = Math.min(2, level);
    
    // If this is a header-only line, the next items should be nested under it
    if (endsWithHeader && !startsWithBoldTerm) {
      // This is a header line like "... **Types of Atrial Fibrillation:**"
      // The next items should be nested
      inNestedContext = true;
      currentNestLevel = level;
    }

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
    
    // If this line is a header-only line (like **Valvular vs. Non-valvular:**)
    // start a new nested context
    if (isHeaderOnly) {
      inNestedContext = true;
      currentNestLevel = level;
    }
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
