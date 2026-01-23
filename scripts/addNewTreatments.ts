// scripts/addNewTreatments.ts
// Script to add new treatment entries to the treatment database
// Similar to addNewConditions.ts but for pharmacological and non-pharmacological treatments

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = 'gemini-2.5-pro';
const OUTPUT_FILE = path.resolve('pharm/treatmentData.json');
const MAX_RETRIES = 3;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay

// ======================================================
// API KEY (optional - if not provided, will use placeholder content)
// ======================================================
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

let client: GoogleGenerativeAI | null = null;
let model: any = null;

if (apiKey) {
  client = new GoogleGenerativeAI(apiKey);
  model = client.getGenerativeModel({ model: MODEL_NAME });
  console.log('✅ Gemini API key found - will generate content with AI');
} else {
  console.log('[WARNING] No Gemini API key found - will use placeholder content');
}

// ======================================================
// ASCII CLEANER
// ======================================================
function asciiClean(str: string = ''): string {
  return (
    str
      .normalize('NFKC')
      .replace(/[""„‟]/g, '"')
      .replace(/[''‚‛]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\u00A0/g, ' ')
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7F]/g, '')
  );
}

// ======================================================
// GENERATE TREATMENT KEY
// ======================================================
function generateTreatmentKey(category: string, treatmentName: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  return `TX__${normalize(category)}__${normalize(treatmentName)}`;
}

// ======================================================
// TREATMENT INTERFACE
// ======================================================
export interface TreatmentContent {
  term: string;
  category: string; // e.g., "Physical Therapy", "Surgery", "Lifestyle", "Behavioral"
  subcategory?: string; // e.g., "Orthopedic", "Cardiac Rehabilitation"
  description: string; // Overview of the treatment
  indications: string[]; // Conditions this treatment is used for
  contraindications: string[];
  mechanism: string; // How the treatment works
  procedure?: string; // For surgical/procedural treatments
  duration?: string; // Typical duration of treatment
  frequency?: string; // How often administered
  sideEffects: string[]; // Potential side effects or risks
  precautions: string[]; // Safety considerations
  evidence: string; // Evidence level/quality
  clinicalNotes: string; // Additional clinical pearls
  relatedConditions: string[]; // Conditions commonly treated
  aliases?: string[]; // Alternative names
}

export interface NewTreatment {
  category: string;
  subcategory?: string;
  treatmentName: string;
  aliases?: string[];
}

// ======================================================
// NEW TREATMENTS TO ADD
// ======================================================
// Add your non-pharmacological treatments here
const NEW_TREATMENTS: NewTreatment[] = [
  // =====================================================
  // PHYSICAL THERAPY & REHABILITATION
  // =====================================================
  {
    category: 'Physical Therapy',
    subcategory: 'Orthopedic',
    treatmentName: 'Range of Motion Exercises',
    aliases: ['ROM Exercises', 'Mobility Exercises'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Orthopedic',
    treatmentName: 'Strengthening Exercises',
    aliases: ['Resistance Training', 'Muscle Strengthening'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Orthopedic',
    treatmentName: 'Joint Mobilization',
    aliases: ['Manual Therapy', 'Joint Manipulation'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Neurological',
    treatmentName: 'Gait Training',
    aliases: ['Walking Rehabilitation', 'Ambulation Training'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Cardiac',
    treatmentName: 'Cardiac Rehabilitation',
    aliases: ['Cardiac Rehab', 'Heart Rehab Program'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Pulmonary',
    treatmentName: 'Pulmonary Rehabilitation',
    aliases: ['Respiratory Therapy', 'Lung Rehab'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Modalities',
    treatmentName: 'Transcutaneous Electrical Nerve Stimulation',
    aliases: ['TENS', 'Electrical Stimulation'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Modalities',
    treatmentName: 'Ultrasound Therapy',
    aliases: ['Therapeutic Ultrasound'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Modalities',
    treatmentName: 'Heat Therapy',
    aliases: ['Thermotherapy', 'Hot Pack Application'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Modalities',
    treatmentName: 'Cold Therapy',
    aliases: ['Cryotherapy', 'Ice Application'],
  },
  {
    category: 'Physical Therapy',
    subcategory: 'Manual',
    treatmentName: 'Massage Therapy',
    aliases: ['Therapeutic Massage', 'Soft Tissue Mobilization'],
  },

  // =====================================================
  // OCCUPATIONAL THERAPY
  // =====================================================
  {
    category: 'Occupational Therapy',
    treatmentName: 'Activities of Daily Living Training',
    aliases: ['ADL Training', 'Self-Care Training'],
  },
  {
    category: 'Occupational Therapy',
    treatmentName: 'Hand Therapy',
    aliases: ['Upper Extremity Rehabilitation'],
  },
  {
    category: 'Occupational Therapy',
    treatmentName: 'Cognitive Rehabilitation',
    aliases: ['Cognitive Retraining', 'Brain Rehabilitation'],
  },
  {
    category: 'Occupational Therapy',
    treatmentName: 'Sensory Integration Therapy',
    aliases: ['Sensory Processing Therapy'],
  },

  // =====================================================
  // SPEECH & LANGUAGE THERAPY
  // =====================================================
  {
    category: 'Speech Therapy',
    treatmentName: 'Speech-Language Therapy',
    aliases: ['Speech Therapy', 'Articulation Therapy'],
  },
  {
    category: 'Speech Therapy',
    treatmentName: 'Swallowing Therapy',
    aliases: ['Dysphagia Therapy', 'Swallow Rehabilitation'],
  },
  {
    category: 'Speech Therapy',
    treatmentName: 'Voice Therapy',
    aliases: ['Vocal Therapy', 'Phonation Therapy'],
  },

  // =====================================================
  // BEHAVIORAL & PSYCHOLOGICAL THERAPIES
  // =====================================================
  {
    category: 'Behavioral Therapy',
    subcategory: 'Cognitive',
    treatmentName: 'Cognitive Behavioral Therapy',
    aliases: ['CBT'],
  },
  {
    category: 'Behavioral Therapy',
    subcategory: 'Cognitive',
    treatmentName: 'Dialectical Behavior Therapy',
    aliases: ['DBT'],
  },
  {
    category: 'Behavioral Therapy',
    subcategory: 'Exposure',
    treatmentName: 'Exposure Therapy',
    aliases: ['Systematic Desensitization'],
  },
  {
    category: 'Behavioral Therapy',
    subcategory: 'Mindfulness',
    treatmentName: 'Mindfulness-Based Stress Reduction',
    aliases: ['MBSR', 'Mindfulness Meditation'],
  },
  {
    category: 'Behavioral Therapy',
    subcategory: 'Interpersonal',
    treatmentName: 'Interpersonal Therapy',
    aliases: ['IPT'],
  },
  {
    category: 'Behavioral Therapy',
    subcategory: 'Family',
    treatmentName: 'Family Therapy',
    aliases: ['Family Counseling', 'Systemic Therapy'],
  },
  {
    category: 'Behavioral Therapy',
    subcategory: 'Group',
    treatmentName: 'Group Therapy',
    aliases: ['Group Counseling', 'Support Groups'],
  },
  {
    category: 'Behavioral Therapy',
    subcategory: 'Trauma',
    treatmentName: 'Eye Movement Desensitization and Reprocessing',
    aliases: ['EMDR'],
  },

  // =====================================================
  // LIFESTYLE MODIFICATIONS
  // =====================================================
  {
    category: 'Lifestyle',
    subcategory: 'Diet',
    treatmentName: 'DASH Diet',
    aliases: ['Dietary Approaches to Stop Hypertension'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Diet',
    treatmentName: 'Mediterranean Diet',
    aliases: ['Heart-Healthy Diet'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Diet',
    treatmentName: 'Low-Sodium Diet',
    aliases: ['Salt Restriction', 'Sodium Restricted Diet'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Diet',
    treatmentName: 'Diabetic Diet',
    aliases: ['Carbohydrate Counting', 'Glycemic Control Diet'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Diet',
    treatmentName: 'Gluten-Free Diet',
    aliases: ['Celiac Diet'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Exercise',
    treatmentName: 'Aerobic Exercise',
    aliases: ['Cardio', 'Cardiovascular Exercise'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Exercise',
    treatmentName: 'Resistance Training',
    aliases: ['Weight Training', 'Strength Training'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Cessation',
    treatmentName: 'Smoking Cessation',
    aliases: ['Tobacco Cessation', 'Quit Smoking Program'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Cessation',
    treatmentName: 'Alcohol Cessation',
    aliases: ['Alcohol Abstinence', 'Sobriety Program'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Weight',
    treatmentName: 'Weight Management',
    aliases: ['Weight Loss Program', 'Obesity Management'],
  },
  {
    category: 'Lifestyle',
    subcategory: 'Sleep',
    treatmentName: 'Sleep Hygiene',
    aliases: ['Sleep Training', 'Sleep Education'],
  },

  // =====================================================
  // SURGICAL PROCEDURES
  // =====================================================
  {
    category: 'Surgery',
    subcategory: 'Orthopedic',
    treatmentName: 'Total Joint Arthroplasty',
    aliases: ['Joint Replacement Surgery'],
  },
  {
    category: 'Surgery',
    subcategory: 'Orthopedic',
    treatmentName: 'Arthroscopic Surgery',
    aliases: ['Arthroscopy', 'Minimally Invasive Joint Surgery'],
  },
  {
    category: 'Surgery',
    subcategory: 'Orthopedic',
    treatmentName: 'Spinal Fusion',
    aliases: ['Spondylodesis', 'Spine Fusion Surgery'],
  },
  {
    category: 'Surgery',
    subcategory: 'Cardiac',
    treatmentName: 'Coronary Artery Bypass Grafting',
    aliases: ['CABG', 'Bypass Surgery', 'Heart Bypass'],
  },
  {
    category: 'Surgery',
    subcategory: 'Cardiac',
    treatmentName: 'Percutaneous Coronary Intervention',
    aliases: ['PCI', 'Angioplasty', 'Stenting'],
  },
  {
    category: 'Surgery',
    subcategory: 'Cardiac',
    treatmentName: 'Valve Replacement Surgery',
    aliases: ['Heart Valve Surgery'],
  },
  {
    category: 'Surgery',
    subcategory: 'Abdominal',
    treatmentName: 'Appendectomy',
    aliases: ['Appendix Removal'],
  },
  {
    category: 'Surgery',
    subcategory: 'Abdominal',
    treatmentName: 'Cholecystectomy',
    aliases: ['Gallbladder Removal'],
  },
  {
    category: 'Surgery',
    subcategory: 'Abdominal',
    treatmentName: 'Hernia Repair',
    aliases: ['Herniorrhaphy', 'Hernioplasty'],
  },
  {
    category: 'Surgery',
    subcategory: 'Bariatric',
    treatmentName: 'Gastric Bypass Surgery',
    aliases: ['Roux-en-Y', 'RYGB'],
  },
  {
    category: 'Surgery',
    subcategory: 'Bariatric',
    treatmentName: 'Sleeve Gastrectomy',
    aliases: ['Gastric Sleeve', 'Vertical Sleeve Gastrectomy'],
  },

  // =====================================================
  // PROCEDURES & INTERVENTIONS
  // =====================================================
  {
    category: 'Procedure',
    subcategory: 'Injection',
    treatmentName: 'Corticosteroid Injection',
    aliases: ['Steroid Injection', 'Cortisone Shot'],
  },
  {
    category: 'Procedure',
    subcategory: 'Injection',
    treatmentName: 'Joint Aspiration',
    aliases: ['Arthrocentesis', 'Joint Tap'],
  },
  {
    category: 'Procedure',
    subcategory: 'Injection',
    treatmentName: 'Trigger Point Injection',
    aliases: ['TPI', 'Myofascial Injection'],
  },
  {
    category: 'Procedure',
    subcategory: 'Nerve Block',
    treatmentName: 'Epidural Steroid Injection',
    aliases: ['ESI', 'Spinal Injection'],
  },
  {
    category: 'Procedure',
    subcategory: 'Nerve Block',
    treatmentName: 'Nerve Block',
    aliases: ['Regional Anesthesia', 'Local Nerve Block'],
  },
  {
    category: 'Procedure',
    subcategory: 'Wound Care',
    treatmentName: 'Wound Debridement',
    aliases: ['Tissue Debridement'],
  },
  {
    category: 'Procedure',
    subcategory: 'Wound Care',
    treatmentName: 'Negative Pressure Wound Therapy',
    aliases: ['NPWT', 'Wound VAC', 'Vacuum-Assisted Closure'],
  },
  {
    category: 'Procedure',
    subcategory: 'Respiratory',
    treatmentName: 'Supplemental Oxygen Therapy',
    aliases: ['Oxygen Supplementation', 'O2 Therapy'],
  },
  {
    category: 'Procedure',
    subcategory: 'Respiratory',
    treatmentName: 'CPAP Therapy',
    aliases: ['Continuous Positive Airway Pressure'],
  },
  {
    category: 'Procedure',
    subcategory: 'Respiratory',
    treatmentName: 'BiPAP Therapy',
    aliases: ['Bilevel Positive Airway Pressure'],
  },
  {
    category: 'Procedure',
    subcategory: 'Respiratory',
    treatmentName: 'Chest Physiotherapy',
    aliases: ['Chest PT', 'Airway Clearance Therapy'],
  },

  // =====================================================
  // COMPLEMENTARY & ALTERNATIVE MEDICINE
  // =====================================================
  {
    category: 'Complementary Medicine',
    treatmentName: 'Acupuncture',
    aliases: ['Needle Therapy', 'Traditional Chinese Medicine'],
  },
  {
    category: 'Complementary Medicine',
    treatmentName: 'Chiropractic Care',
    aliases: ['Spinal Manipulation', 'Chiropractic Adjustment'],
  },
  {
    category: 'Complementary Medicine',
    treatmentName: 'Yoga Therapy',
    aliases: ['Therapeutic Yoga'],
  },
  {
    category: 'Complementary Medicine',
    treatmentName: 'Tai Chi',
    aliases: ['Tai Chi Chuan', 'Moving Meditation'],
  },
  {
    category: 'Complementary Medicine',
    treatmentName: 'Biofeedback',
    aliases: ['Neurofeedback', 'EEG Biofeedback'],
  },

  // =====================================================
  // MEDICAL DEVICES
  // =====================================================
  {
    category: 'Medical Device',
    treatmentName: 'Pacemaker',
    aliases: ['Cardiac Pacemaker', 'Artificial Pacemaker'],
  },
  {
    category: 'Medical Device',
    treatmentName: 'Implantable Cardioverter Defibrillator',
    aliases: ['ICD', 'Automatic Defibrillator'],
  },
  {
    category: 'Medical Device',
    treatmentName: 'Insulin Pump',
    aliases: ['Continuous Subcutaneous Insulin Infusion', 'CSII'],
  },
  {
    category: 'Medical Device',
    treatmentName: 'Continuous Glucose Monitor',
    aliases: ['CGM', 'Glucose Sensor'],
  },
  {
    category: 'Medical Device',
    treatmentName: 'Orthotic Devices',
    aliases: ['Braces', 'Splints', 'Orthotics'],
  },
  {
    category: 'Medical Device',
    treatmentName: 'Prosthetic Devices',
    aliases: ['Prosthetics', 'Artificial Limbs'],
  },
  {
    category: 'Medical Device',
    treatmentName: 'Hearing Aids',
    aliases: ['Hearing Amplification Devices'],
  },
  {
    category: 'Medical Device',
    treatmentName: 'Cochlear Implant',
    aliases: ['Bionic Ear', 'Cochlear Prosthesis'],
  },

  // =====================================================
  // SUPPORTIVE & PALLIATIVE CARE
  // =====================================================
  {
    category: 'Supportive Care',
    treatmentName: 'Palliative Care',
    aliases: ['Comfort Care', 'Symptom Management'],
  },
  {
    category: 'Supportive Care',
    treatmentName: 'Hospice Care',
    aliases: ['End-of-Life Care', 'Terminal Care'],
  },
  {
    category: 'Supportive Care',
    treatmentName: 'Pain Management',
    aliases: ['Pain Control', 'Analgesia'],
  },
  {
    category: 'Supportive Care',
    treatmentName: 'Nutritional Support',
    aliases: ['Enteral Nutrition', 'Parenteral Nutrition', 'TPN'],
  },
  {
    category: 'Supportive Care',
    treatmentName: 'Fluid Resuscitation',
    aliases: ['IV Fluid Therapy', 'Volume Replacement'],
  },
  {
    category: 'Supportive Care',
    treatmentName: 'Blood Transfusion',
    aliases: ['RBC Transfusion', 'Packed Red Blood Cells'],
  },
];

// ======================================================
// GENERATE PLACEHOLDER CONTENT (when no API key)
// ======================================================
function generatePlaceholderContent(treatment: NewTreatment): TreatmentContent {
  return {
    term: treatment.treatmentName,
    category: treatment.category,
    subcategory: treatment.subcategory,
    description: `${treatment.treatmentName} is a ${treatment.category.toLowerCase()} intervention. Detailed description to be generated.`,
    indications: ['--'],
    contraindications: ['--'],
    mechanism: `Mechanism of ${treatment.treatmentName}. Content to be generated.`,
    sideEffects: ['--'],
    precautions: ['--'],
    evidence: 'Content to be generated.',
    clinicalNotes: `Clinical notes for ${treatment.treatmentName}. Content to be generated.`,
    relatedConditions: ['--'],
    aliases: treatment.aliases,
  };
}

// ======================================================
// GENERATE CONTENT FOR A TREATMENT (with Gemini API)
// ======================================================
async function generateTreatmentContent(treatment: NewTreatment): Promise<TreatmentContent | null> {
  // If no API key, return placeholder content
  if (!model) {
    return generatePlaceholderContent(treatment);
  }

  const prompt = `Generate comprehensive medical content for the non-pharmacological treatment "${treatment.treatmentName}" (${treatment.category} category${treatment.subcategory ? `, ${treatment.subcategory} subcategory` : ''}).

Format the response as a valid JSON object with the following fields:
{
  "term": "${treatment.treatmentName}",
  "category": "${treatment.category}",
  "subcategory": "${treatment.subcategory || ''}",
  "description": "2-3 paragraph overview of the treatment including definition, purpose, and clinical significance",
  "indications": ["List of conditions/situations where this treatment is indicated"],
  "contraindications": ["List of contraindications"],
  "mechanism": "How the treatment works, its therapeutic mechanism",
  "procedure": "Step-by-step procedure if applicable (for surgical/procedural treatments)",
  "duration": "Typical duration of treatment",
  "frequency": "How often administered",
  "sideEffects": ["Potential side effects or risks"],
  "precautions": ["Safety considerations and precautions"],
  "evidence": "Summary of evidence level and key studies supporting this treatment",
  "clinicalNotes": "Additional clinical pearls and practical considerations",
  "relatedConditions": ["Conditions commonly treated with this intervention"]
}

Provide medically accurate, board-exam-level content suitable for PA/medical students. Use proper medical terminology.
IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      // Clean the response
      text = asciiClean(text);
      text = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const content = JSON.parse(text) as TreatmentContent;

      // Add aliases if provided
      if (treatment.aliases && treatment.aliases.length > 0) {
        content.aliases = treatment.aliases;
      }

      return content;
    } catch (err: any) {
      console.error(
        `  [ERROR] Attempt ${attempt} failed for ${treatment.treatmentName}: ${err.message}`
      );
      if (attempt === MAX_RETRIES) {
        return null;
      }
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  return null;
}

// ======================================================
// MAIN
// ======================================================
async function main() {
  console.log('🚀 Starting treatment content generation');
  console.log(`📌 Total new treatments to add: ${NEW_TREATMENTS.length}`);

  // Load existing content
  let existingContent: Record<string, TreatmentContent> = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
    existingContent = JSON.parse(raw);
    console.log(`📂 Loaded ${Object.keys(existingContent).length} existing treatments`);
  }

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < NEW_TREATMENTS.length; i++) {
    const treatment = NEW_TREATMENTS[i];
    const key = generateTreatmentKey(treatment.category, treatment.treatmentName);

    // Skip if already exists
    if (existingContent[key]) {
      console.log(`⏩ Skipping (exists): ${treatment.treatmentName}`);
      skipped++;
      continue;
    }

    console.log(`\n[${i + 1}/${NEW_TREATMENTS.length}] 🔵 Generating: ${treatment.treatmentName}`);

    const content = await generateTreatmentContent(treatment);

    if (content) {
      existingContent[key] = content;
      added++;
      console.log(`  ✅ Added: ${treatment.treatmentName}`);

      // Save after each successful addition
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingContent, null, 2), 'utf8');
    } else {
      failed++;
      console.log(`  [ERROR] Failed: ${treatment.treatmentName}`);
    }

    // Delay between requests
    await new Promise((res) => setTimeout(res, DELAY_BETWEEN_REQUESTS));
  }

  console.log('\n🎉 Generation complete!');
  console.log(`  ✅ Added: ${added}`);
  console.log(`  ⏩ Skipped: ${skipped}`);
  console.log(`  [ERROR] Failed: ${failed}`);
  console.log(`  [INFO] Total treatments now: ${Object.keys(existingContent).length}`);
}

main().catch(console.error);
