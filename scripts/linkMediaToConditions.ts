import fs from "fs";
import path from "path";

const CONTENT_PATH = path.resolve("src/conditionContent.generated.json");
const MEDIA_DIR = path.resolve("public/media");

function deriveMapping(): Record<string, string[]> {
  if (!fs.existsSync(MEDIA_DIR)) return {};
  const files = fs.readdirSync(MEDIA_DIR).filter((f) => /\.(png|jpg|jpeg|gif)$/i.test(f));
  const map: Record<string, string[]> = {};

  for (const file of files) {
    const base = file.replace(/\.[^.]+$/, "");
    let conditionId = base;
    if (base.includes("--")) {
      conditionId = base.split("--")[0];
    } else {
      const parts = base.split("_");
      if (parts.length > 1) {
        conditionId = parts.slice(0, -1).join("_");
      }
    }
    if (!map[conditionId]) map[conditionId] = [];
    map[conditionId].push(base);
  }
  return map;
}

function run() {
  if (!fs.existsSync(CONTENT_PATH)) {
    console.error("Missing condition content JSON at", CONTENT_PATH);
    process.exit(1);
  }

  const mediaMap = deriveMapping();
  const raw = fs.readFileSync(CONTENT_PATH, "utf8");
  const parsed = JSON.parse(raw);

  const unmatched: string[] = [];
  for (const [conditionId, mediaIds] of Object.entries(mediaMap)) {
    if (!parsed[conditionId]) {
      unmatched.push(conditionId);
      continue;
    }
    parsed[conditionId].mediaIds = mediaIds;
  }

  fs.writeFileSync(CONTENT_PATH, JSON.stringify(parsed, null, 2));
  console.log(`Linked media to conditions. Updated ${CONTENT_PATH}`);
  if (unmatched.length) {
    console.warn("Media files without matching condition:", unmatched.join(", "));
  }
}

run();
