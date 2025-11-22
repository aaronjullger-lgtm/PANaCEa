export const SECTION_BREAK_TOKEN = "__SECTION_BREAK__";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const inlineFormat = (value: string) => {
  let formatted = escapeHtml(value);
  formatted = formatted.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/__(.+?)__/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>");
  formatted = formatted.replace(/_(.+?)_/g, "<em>$1</em>");
  formatted = formatted.replace(/`(.+?)`/g, "<code>$1</code>");
  return formatted;
};

export const renderMarkdownHtml = (value: string) => {
  const lines = value.split(/\r?\n/);
  let html = "";
  let inList = false;
  let paragraphLines: string[] = [];

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    html += `<p>${paragraphLines.map((ln) => inlineFormat(ln)).join("<br />")}</p>`;
    paragraphLines = [];
  };

  lines.forEach((line) => {
    if (line.includes(SECTION_BREAK_TOKEN)) {
      flushParagraph();
      closeList();
      html += '<hr class="my-3 border-t border-slate-200" />';
      return;
    }

    const trimmed = line.trimEnd();
    const bullet = trimmed.match(/^[-*]\s+(.*)/);
    const numbered = trimmed.match(/^\d+\.\s+(.*)/);

    if (bullet || numbered) {
      flushParagraph();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineFormat(bullet ? bullet[1] : numbered?.[1] ?? "")}</li>`;
      return;
    }

    if (trimmed.length === 0) {
      flushParagraph();
      closeList();
      return;
    }

    if (inList) {
      closeList();
    }

    paragraphLines.push(trimmed);
  });

  flushParagraph();
  closeList();
  return html;
};
