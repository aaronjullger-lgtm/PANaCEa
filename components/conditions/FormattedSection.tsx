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
  const lines = content
    .replace(/\t/g, "    ")
    .replace(/\r\n/g, "\n")
    .split("\n");

  const roots: BulletNode[] = [];
  const stack: { level: number; node: BulletNode }[] = [];

  lines.forEach((line) => {
    if (!line.trim()) return;

    const match = line.match(/^(\s*)([•◦▪])?\s*(.*)$/);
    const leadingSpaces = match?.[1]?.length ?? 0;
    const bulletSymbol = match?.[2] ?? "";
    const text = (match?.[3] ?? line).trim();
    if (!text) return;

    const levelFromSymbol = BULLET_LEVEL_BY_SYMBOL[bulletSymbol];
    const levelFromIndent = Math.round(leadingSpaces / 4);
    const level = Math.min(
      2,
      Number.isFinite(levelFromSymbol) ? levelFromSymbol : levelFromIndent
    );

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const node: BulletNode = { parts: toBoldParts(text), children: [] };

    let parent: { level: number; node: BulletNode } | null = null;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].level < level) {
        parent = stack[i];
        break;
      }
    }

    if (parent) parent.node.children.push(node);
    else roots.push(node);

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
  content?: string | string[] | null;
}

const FormattedSection: React.FC<FormattedSectionProps> = ({ content }) => {
  if (content == null) return null;

  let text: string;

  if (Array.isArray(content)) {
    if (content.length === 0) return null;
    text = content.join("\n");
  } else {
    text = typeof content === "string" ? content : String(content);
  }

  if (!isMeaningfulContent(text)) return null;

  const bullets = buildBulletTree(text);

  if (bullets.length === 0) {
    return <p className="condition-empty">No details available for this section.</p>;
  }

  return <BulletList nodes={bullets} level={0} />;
};

export default FormattedSection;
