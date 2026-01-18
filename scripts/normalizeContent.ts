import * as fs from 'fs';
import * as path from 'path';
import {
  CONDITION_REGISTRY,
  findConditionMeta,
  buildConditionDefinition,
} from '../config/conditionRegistry';

const RAW_PATH = path.join(process.cwd(), 'data', 'conditionContent.json');
const CLEAN_PATH = path.join(process.cwd(), 'data', 'conditionContent.clean.json');

// Target Schema Keys
const TARGET_KEYS = [
  'overview',
  'etiology',
  'pathophysiology',
  'epidemiology',
  'symptoms',
  'physical_exam',
  'diagnostics',
  'treatment',
  'prognosis',
  'differential_diagnosis',
  'risk_factors',
  'complications',
  'buzzwords',
];

// Key Mappings (Messy -> Clean)
const KEY_MAP: Record<string, string> = {
  examFindings: 'physical_exam',
  physicalExamFindings: 'physical_exam',
  physicalExam: 'physical_exam',
  exam: 'physical_exam',
  etiologyPathophysiology: 'pathophysiology',
  differentialDiagnosis: 'differential_diagnosis',
  differential: 'differential_diagnosis',
  riskFactors: 'risk_factors',
  management: 'treatment',
  treatmentManagement: 'treatment',
  clinicalPresentation: 'symptoms', // Often overlaps
};

interface CleanContent {
  conditionId: string;
  conditionName: string;
  content: Record<string, any>;
  missingSections: string[];
}

async function main() {
  console.log('🧹 Starting Content Normalization...');

  if (!fs.existsSync(RAW_PATH)) {
    console.error(`❌ Source file not found: ${RAW_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(RAW_PATH, 'utf-8');
  if (!rawData.trim()) {
    console.error('❌ Source file is empty.');
    process.exit(1);
  }

  let json: any[];
  try {
    json = JSON.parse(rawData);
    if (!Array.isArray(json)) {
      // Handle case where it might be a single object or Type C at root
      json = [json];
    }
  } catch (e) {
    console.error('❌ Invalid JSON format.');
    process.exit(1);
  }

  // Map to store merged content: ConditionID -> ContentObject
  const mergedData = new Map<string, any>();

  // Helper to get or create entry
  const getEntry = (id: string, name: string) => {
    if (!mergedData.has(id)) {
      mergedData.set(id, {
        conditionId: id,
        conditionName: name,
        content: {},
      });
    }
    return mergedData.get(id);
  };

  // Helper to merge content object
  const mergeContent = (entry: any, newContent: any) => {
    for (const [key, value] of Object.entries(newContent)) {
      // Normalize key
      let cleanKey = KEY_MAP[key] || key;

      // If key is not in target keys, keep it but maybe warn?
      // For now, we keep everything but prioritize target keys structure.

      // Merge logic
      if (!entry.content[cleanKey]) {
        entry.content[cleanKey] = value;
      } else {
        // If exists, try to merge if array or string
        if (Array.isArray(entry.content[cleanKey]) && Array.isArray(value)) {
          entry.content[cleanKey] = [...entry.content[cleanKey], ...value];
        } else if (typeof entry.content[cleanKey] === 'string' && typeof value === 'string') {
          entry.content[cleanKey] += '\n\n' + value;
        } else if (typeof entry.content[cleanKey] === 'object' && typeof value === 'object') {
          entry.content[cleanKey] = { ...entry.content[cleanKey], ...value };
        }
      }
    }
  };

  // 1. Iterate and Normalize
  console.log(`🔄 Processing ${json.length} raw entries...`);

  for (const item of json) {
    let conditionName: string | undefined;
    let contentToMerge: any = {};

    // Detect Type C: {"rosacea": {...}}
    const keys = Object.keys(item);
    if (
      keys.length === 1 &&
      typeof item[keys[0]] === 'object' &&
      !['conditionId', 'condition', 'topic', 'content'].includes(keys[0])
    ) {
      conditionName = keys[0];
      contentToMerge = item[conditionName];
    } else {
      // Type A, B, D
      conditionName = item.condition || item.topic || item.name || item.conditionName;

      if (item.content) {
        // Type D or standard
        contentToMerge = item.content;
      } else {
        // Type A/B (flat or section-based)
        // If "section" key exists, this is a fragment
        if (item.section && item.text) {
          contentToMerge = { [item.section]: item.text };
        } else {
          // Assume flat object is content, excluding metadata keys
          const { condition, topic, name, conditionId, section, ...rest } = item;
          contentToMerge = rest;
        }
      }
    }

    // Resolve Identity
    const meta = findConditionMeta(conditionName);
    if (!meta) {
      console.warn(`⚠️  Could not match condition: "${conditionName}"`);
      continue;
    }

    const def = buildConditionDefinition(meta);
    const entry = getEntry(def.id, meta.condition);

    mergeContent(entry, contentToMerge);
  }

  // 2. Validate and Finalize
  const output: CleanContent[] = [];
  let missingCount = 0;

  for (const entry of mergedData.values()) {
    const missing: string[] = [];

    // Check for required keys
    for (const key of TARGET_KEYS) {
      if (
        !entry.content[key] ||
        (Array.isArray(entry.content[key]) && entry.content[key].length === 0)
      ) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      missingCount++;
      // console.warn(`🔸 ${entry.conditionName} missing: ${missing.join(', ')}`);
    }

    output.push({
      conditionId: entry.conditionId,
      conditionName: entry.conditionName,
      content: entry.content,
      missingSections: missing,
    });
  }

  // 3. Save
  fs.writeFileSync(CLEAN_PATH, JSON.stringify(output, null, 2));
  console.log(`✅ Normalized ${output.length} conditions.`);
  console.log(`⚠️  ${missingCount} conditions have missing sections.`);
  console.log(`💾 Saved to ${CLEAN_PATH}`);
}

main();
