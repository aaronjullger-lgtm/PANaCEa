import React from "react";
import { isMeaningfulContent } from "../../lib/loadConditions";

interface BulletNode {
  parts: React.ReactNode[];
  children: BulletNode[];
  type: 'bullet' | 'header' | 'text';
}

const BULLET_LEVEL_BY_SYMBOL: Record<string, number> = {
  "•": 0,
  "◦": 1,
  "▪": 2,
};

function formatText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** OR *italic*
  // Note: We use [^*] to avoid matching across multiple * markers incorrectly
  // but we need to be careful about nested structures. For simple cases:
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    if (match[1]) { // Bold match (**...**)
      parts.push(<strong key={`b-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) { // Italic match (*...*)
      parts.push(<em key={`i-${match.index}`}>{match[4]}</em>);
    }
    
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

  // Global Normalization (applies to all content)
  // 1. Handle Headers: ### Header -> **Header** (and ensure it's on its own line)
  normalized = normalized.replace(/^###\s+(.*)$/gm, "**$1**");

  // 2. Handle Hyphen Bullets: - Item -> • Item
  normalized = normalized.replace(/^(\s*)-\s+/gm, "$1• ");

  // 3. Handle Asterisk Bullets: * Item -> • Item
  // We match start of line, optional whitespace, asterisk, then space.
  // This avoids matching *italics* which wouldn't have a space after the first * usually, 
  // or would be inside text.
  normalized = normalized.replace(/^(\s*)\*\s+/gm, "$1• ");
  
  // 4. Handle Double Bullets: •• -> Indented Bullet
  normalized = normalized.replace(/^(\s*)••\s*/gm, "    • ");

  // 5. Handle Numbered Lists: 1. Item -> • Item
  // This prevents "double bullets" (one from UI, one from text "1.")
  normalized = normalized.replace(/^(\s*)\d+\.\s+/gm, "$1• ");

  // 6. Handle "Term: Definition" style lines that are missing bullets
  // Convert "Term: Definition..." to "• **Term**: Definition..."
  // Only applies if the line doesn't already start with a bullet or special char
  // and the "Term" is reasonably short (< 50 chars)
  normalized = normalized.replace(/^(\s*)([A-Za-z0-9][^:\n]{0,50}):\s+(.+)$/gm, (match, indent, term, rest) => {
    // Don't touch if it looks like a header (already bold)
    if (term.trim().startsWith('**')) return match;
    return `${indent}• **${term}**: ${rest}`;
  });

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

    // Check if line starts with asterisk bullet pattern: "* " or "*   " (1-4 spaces)
    // This indicates a nested bullet point (not bold marker which is "**")
    const asteriskBulletMatch = line.match(/^(\*\s{1,4})(.*)$/);
    let text: string;
    let isAsteriskBullet = false;
    let leadingSpaces = 0;
    let bulletSymbol = "";

    if (asteriskBulletMatch) {
      // This is a nested bullet using asterisk syntax like "* **Text**:" or "*   **Text**:"
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
    const isBoldHeader = /\*\*[^*]+:\*\*\s*$/.test(text);
    
    // Check for implicit headers (no bold, short, looks like a title)
    // e.g. "Acute/Emergency Management"
    // Criteria:
    // 1. No bullet (checked later via !bulletSymbol)
    // 2. Short length (< 60 chars)
    // 3. Starts with uppercase or number
    // 4. Not a sentence (doesn't end with period, unless it's short)
    const isImplicitHeader = !bulletSymbol && !isAsteriskBullet && 
                             text.length < 60 && 
                             /^[A-Z0-9]/.test(text) && 
                             (!/[.]$/.test(text) || text.endsWith(':'));

    const isHeaderOnly = isBoldHeader || isImplicitHeader;
    
    // Check if this line ENDS with a header pattern (could have text before)
    const endsWithHeader = /\*\*[^*]+:\*\*\s*$/.test(text);
    
    // Check if this is an item that starts with a bold term (like **Paroxysmal:**)
    const startsWithBoldTerm = /^\*\*[^*]+:\*\*/.test(text);

    // Determine node type
    let nodeType: 'bullet' | 'header' | 'text' = 'bullet';
    if (isHeaderOnly) {
      nodeType = 'header';
    } else if (!bulletSymbol && !isAsteriskBullet) {
      // If no bullet, check context
      if (inNestedContext && !isHeaderOnly) {
        // Inside a list, no bullet -> likely text continuation
        nodeType = 'text';
      } else {
        // At root level, no bullet -> likely a header
        nodeType = 'header';
      }
    }

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
      // If we are in a nested context, we generally want to nest subsequent items
      // UNLESS it's a new top-level header (no bullet, no indent).
      // If it has a bullet, it's definitely content/sub-header, so nest it.
      if (inNestedContext && (!isHeaderOnly || bulletSymbol)) {
        // We're in a nested context (after a header-only line)
        // Items that start with bold terms are nested
        if (startsWithBoldTerm) {
          level = currentNestLevel + 1;
        } else {
          // Non-bold items might break the nesting
          // FIX: If we are in a nested context, we should assume subsequent items are nested
          level = currentNestLevel + 1;
        }
      } else {
        // Standard indentation logic
        level = Math.floor(leadingSpaces / 2); // Changed from 4 to 2 to be more forgiving
      }
    }
    
    // Auto-correction: Ensure we don't skip levels (e.g., 0 -> 2)
    // If the stack is empty, level must be 0
    if (stack.length === 0) {
      level = 0;
    } else {
      // If we have a parent, we can at most be one level deeper than the last item
      const lastItemLevel = stack[stack.length - 1].level;
      if (level > lastItemLevel + 1) {
        level = lastItemLevel + 1;
      }
    }
    
    level = Math.min(2, level);
    
    // If this is a header-only line, the next items should be nested under it
    if (nodeType === 'header' || (endsWithHeader && !startsWithBoldTerm)) {
      // This is a header line like "... **Types of Atrial Fibrillation:**"
      // The next items should be nested
      inNestedContext = true;
      currentNestLevel = level;
    }

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const node: BulletNode = { parts: formatText(text), children: [], type: nodeType };

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
    if (nodeType === 'header') {
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
    <ul className={`flex flex-col ${level === 0 ? 'gap-4' : 'gap-2 mt-2'}`}>
      {nodes.map((node, index) => {
        // Use the node type to determine if it's a header
        const isHeaderNode = node.type === 'header';
        const isBulletNode = node.type === 'bullet';

        return (
          <li key={`${level}-${index}`} className="relative">
            <div className={`flex items-start gap-3 ${isHeaderNode ? 'mt-4 mb-2' : ''}`}>
              {isBulletNode && (
                <span className={`
                  shrink-0 mt-2 rounded-full 
                  ${level === 0 ? 'w-1.5 h-1.5 bg-blue-500' : 
                    level === 1 ? 'w-1 h-1 bg-gray-400 border border-gray-400' : 
                    'w-1 h-1 bg-gray-300'}
                `} />
              )}
              <div className={`text-gray-800 dark:text-gray-200 leading-relaxed ${isHeaderNode ? 'font-bold text-lg text-blue-900 dark:text-blue-100 border-b border-gray-100 dark:border-gray-800 pb-1 w-full' : ''}`}>
                {node.parts}
              </div>
            </div>
            {node.children.length > 0 && (
              <div className={`${isHeaderNode ? 'ml-1' : 'ml-[0.4rem]'} pl-4 border-l-2 border-gray-100 dark:border-gray-800 mt-1`}>
                <BulletList
                  nodes={node.children}
                  level={Math.min(level + 1, 2)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

interface FormattedSectionProps {
  content?: string | string[] | Record<string, unknown> | null;
}

const FormattedSection: React.FC<FormattedSectionProps> = ({ content }) => {
  if (typeof content === 'object' && !Array.isArray(content) && content !== null) {
    return null;
  }

  if (Array.isArray(content)) {
    if (content.length === 0) return null;
  } else if (!isMeaningfulContent(content)) {
    return null;
  }

  // Handle array content by joining with newlines
  const textContent = Array.isArray(content) 
    ? content.map(item => item.startsWith('•') || item.startsWith('*') ? item : `• ${item}`).join('\n')
    : content as string;

  const bullets = buildBulletTree(textContent ?? "");

  if (bullets.length === 0) {
    return <p className="condition-empty">No details available for this section.</p>;
  }

  return <BulletList nodes={bullets} level={0} />;
};

export default FormattedSection;
