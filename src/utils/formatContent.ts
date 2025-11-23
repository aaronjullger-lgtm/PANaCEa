export const formatContent = (text: string): string => {
  // Convert simple hyphen-prefixed lines into markdown bullet syntax
  let formatted = text.replace(/(?<=\.|:|\n)\s*-\s+/g, "\n- ");

  // Preserve hyphenated drug/scientific names that should not become list separators
  formatted = formatted.replace(/(\w)-(\w)/g, "$1-$2");

  // Indent bullets that start with bold labels to improve nested list readability
  formatted = formatted.replace(/\n-\s+(?=\*\*)/g, "\n  - ");

  return formatted;
};

export default formatContent;
