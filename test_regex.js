const formatRunOnKeys = (text) => {
  if (!text) return "";
  
  let formatted = text;
  
  const keyPattern = "([A-Z][^:\n\r\.\?\!]{2,100})";
  const pattern = new RegExp(`(^|[\.\!\?\;]\s+|\n\s*)(${keyPattern}):\s`, 'g');
  
  formatted = formatted.replace(pattern, (match, separator, key) => {
      if (!separator) return `- **${key}**: `;
      if (separator.includes('\n')) return `\n- **${key}**: `;
      return `${separator.trim()}\n- **${key}**: `;
  });
  
  return formatted;
};

const input = "Thompson test (calf squeeze): Positive when squeezing the calf fails to produce passive plantar flexion of the foot. This is considered the most reliable clinical test. Palpable gap: A defect in the tendon may be palpated along its course, typically 2-6 cm proximal to the calcaneal insertion. Inspection: Swelling, ecchymosis, and edema are often present over the posterior ankle and lower calf.";

console.log(formatRunOnKeys(input));
