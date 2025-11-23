export const preprocessMarkdown = (text: string): string => {
  if (!text) return text;

  return text
    .replace(/–|—/g, "-")
    .replace(/(^|\n)-(?=\S)/g, "$1- ")
    .replace(/\s{2,}/g, " ");
};

export default preprocessMarkdown;
