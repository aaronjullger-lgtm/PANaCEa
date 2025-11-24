function autoBoldColon(text: string): string {
  const colonMatch = text.match(/^\s*(.+?):\s*(.*)$/);
  if (!colonMatch) return text;

  const [, leading, rest] = colonMatch;

  if (/^\s*\*\*.*\*\*\s*$/.test(leading) || /^\s*__.*__\s*$/.test(leading)) {
    return `${leading.trim()}:${rest ? ` ${rest}` : ""}`;
  }

  const cleaned = leading.replace(/^\*+|\*+$/g, "").replace(/^_+|_+$/g, "");
  return `**${cleaned.trim()}:**${rest ? ` ${rest}` : ""}`;
}

export function fixNestedBullets(md: string): string {
  const lines = md.split(/\n/);
  let inHeader = false;

  const processed = lines.map((line) => {
    if (!/^\s*-\s+/.test(line)) {
      inHeader = false;
      return line;
    }

    const content = line.replace(/^\s*-\s+/, "");
    const isHeader = /:\s*$/.test(content.trim());
    const bolded = autoBoldColon(content);
    const prefix = isHeader ? "- " : inHeader ? "  - " : "- ";

    if (isHeader) {
      inHeader = true;
    }

    return `${prefix}${bolded}`.trimEnd();
  });

  return processed.join("\n");
}

export function formatConditionMarkdown(text: string | undefined | null): string {
  if (!text) return "";

  let formatted = text;

  formatted = formatted.replace(/([.!?])\s+-\s+/g, "$1\n- ");

  formatted = formatted.replace(
    /(-\s*Indications\s*\(Mnemonic:[^\n]*\):\s*\n)((?:-\s*[A-Z]:[^\n]*\n?)+)/g,
    (_match, header: string, block: string) => {
      const nestedBlock = block.replace(/-\s+([A-Z]:)/g, "  - $1");
      return header + nestedBlock;
    }
  );

  formatted = fixNestedBullets(formatted);

  return formatted;
}

export default formatConditionMarkdown;
