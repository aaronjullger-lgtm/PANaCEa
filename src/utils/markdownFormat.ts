export function fixNestedBullets(md: string): string {
  return md
    .replace(/:\s*\n-\s/g, ":\n - ")
    .replace(/- \*\*([^:]+):\*\*/g, "\n- $1:");
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
