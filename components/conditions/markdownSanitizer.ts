export function sanitizeMedicalMarkdown(input: string): string {
  if (!input) return "";

  // Normalize newlines
  let text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Fix obvious bold syntax mistakes like trailing "****"
  text = text.replace(/\*{4,}/g, "**");

  const lines = text.split("\n");
  const out: string[] = [];

  for (let line of lines) {
    line = line.replace(/\s+$/g, "");
    const trimmed = line.trim();

    // Drop pure noise lines
    if (
      trimmed === "**" ||
      trimmed === "***" ||
      trimmed === "****" ||
      trimmed === "*" ||
      trimmed === "-" ||
      trimmed === "- **" ||
      trimmed === "- ** **" ||
      trimmed === "- **" ||
      /^-\s*\*+\s*$/.test(trimmed) ||
      /^\*+\s*$/.test(trimmed)
    ) {
      continue;
    }

    // Normalize common bullet symbols into Markdown list items (including nesting)
    line = line
      .replace(/^(\s*)•\s+/u, "$1- ")
      .replace(/^(\s*)◦\s+/u, "$1  - ")
      .replace(/^(\s*)▪\s+/u, "$1    - ");

    out.push(line);
  }

  text = out.join("\n");

  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
