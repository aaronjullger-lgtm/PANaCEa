import fs from "fs";
import path from "path";

const INPUT_JSON = path.resolve("src/conditionContent.generated.json");
const OUTPUT_JSON = INPUT_JSON;
export const SECTION_BREAK_TOKEN = "__SECTION_BREAK__";

function asciiClean(str: string = ""): string {
  return str
    .normalize("NFKC")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\x7F]/g, "");
}

function normalizeSeparators(value: string): string {
  const lines = value.split(/\r?\n/);
  const processed = lines.map((line) => {
    if (/^\s*\*{3}\s*$/.test(line)) {
      return SECTION_BREAK_TOKEN;
    }
    const trailing = line.match(/^(.*?\S)\s*\*{3}\s*$/);
    if (trailing && !/\*{3}.+\*{3}/.test(trailing[1])) {
      return `${trailing[1]}\n${SECTION_BREAK_TOKEN}`;
    }
    return line;
  });
  return processed.join("\n");
}

function cleanValue(value: any): any {
  if (typeof value === "string") {
    return asciiClean(normalizeSeparators(value));
  }
  if (Array.isArray(value)) {
    return value.map((entry) => cleanValue(entry));
  }
  if (value && typeof value === "object") {
    const next: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = cleanValue(v);
    }
    return next;
  }
  return value;
}

function run() {
  if (!fs.existsSync(INPUT_JSON)) {
    console.error("Missing input JSON", INPUT_JSON);
    process.exit(1);
  }
  const raw = fs.readFileSync(INPUT_JSON, "utf8");
  const parsed = JSON.parse(raw);
  const cleaned = cleanValue(parsed);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(cleaned, null, 2));
  console.log(`Updated ${OUTPUT_JSON} with cleaned markdown separators.`);
}

run();
