#!/usr/bin/env npx ts-node

/**
 * Comprehensive Image Processing Pipeline
 *
 * Processes medical images for quiz/drill use with:
 * 1. Face detection and blurring for privacy
 * 2. Answer-revealing text/annotation detection
 * 3. Smart cropping to remove identifying info
 * 4. Quality assessment and filtering
 * 5. Batch upload to Supabase
 *
 * Usage: npx tsx scripts/images/process-images-pipeline.ts [options]
 * Options:
 *   --dry-run      Preview processing without changes
 *   --skip-blur    Skip face blurring
 *   --skip-ocr     Skip text detection
 *   --condition=X  Process only specific condition
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { execSync, exec } from 'child_process';
import {
  analyzeImage,
  DuplicateDetector,
  generatePerceptualHash,
  type ImageAnalysis,
} from './image-analyzer';
import { cropImage, isSharpAvailable, type CropRegion } from './image-cropper';

config();

// Rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_DELAY_MS = 300;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const DATABASE_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Temporary directory for processed images
const TEMP_DIR = '/tmp/panacea-image-processing';
const OUTPUT_DIR = '/tmp/panacea-processed-images';

// High-yield conditions for photo drills - these are visually diagnosable
const HIGH_YIELD_VISUAL_CONDITIONS = [
  // DERMATOLOGY (most visually diagnostic)
  'DERM__oncology__melanoma',
  'DERM__oncology__basal_cell_carcinoma',
  'DERM__oncology__squamous_cell_carcinoma',
  'DERM__oncology__actinic_keratosis',
  'DERM__infectious__tinea_corporis_ringworm',
  'DERM__infectious__tinea_versicolor',
  'DERM__infectious__scabies',
  'DERM__infectious_fungal__cutaneous_candidiasis',
  'DERM__papulosquamous__plaque_psoriasis',
  'DERM__papulosquamous__lichen_planus',
  'DERM__papulosquamous__pityriasis_rosea',
  'DERM__bullous__bullous_pemphigoid',
  'DERM__bullous__pemphigus_vulgaris',
  'DERM__reactive__hypersensitivity__erythema_multiforme',
  'DERM__reactive__hypersensitivity__erythema_nodosum',
  'DERM__connective_tissue__lupus__acute_cutaneous_lupus_erythematosus',
  'DERM__pigmentary__vitiligo',
  'DERM__pigmentary__acanthosis_nigricans',
  'DERM__hair_disorders__alopecia_areata',
  'DERM__acneiform__rosacea',
  'DERM__nail_disorders__onychomycosis',
  'DERM__nail_disorders__paronychia',
  'DERM__benign_lesions__seborrheic_keratosis',
  'DERM__dermatitis__eczema__atopic_dermatitis',
  'DERM__dermatitis__eczema__seborrheic_dermatitis',
  'DERM__inflammatory__hidradenitis_suppurativa',
  'DERM__infectious__abscess',

  // ECG (critical for PANCE)
  'CV__ecg__atrial_fibrillation',
  'CV__ecg__atrial_flutter',
  'CV__ecg__ventricular_tachycardia',
  'CV__ecg__ventricular_fibrillation',
  'CV__ecg__torsades_de_pointes',
  'CV__ischemic_heart_disease__stemi',
  'CV__ecg__anterior_stemi',
  'CV__ecg__inferior_stemi',
  'CV__ecg__lateral_stemi',
  'CV__carditis__pericarditis',
  'CV__conduction_disorders__left_bundle_branch_block',
  'CV__conduction_disorders__right_bundle_branch_block',
  'CV__conduction_disorders__first_degree_av_block',
  'CV__conduction_disorders__second_degree_av_block_mobitz_i',
  'CV__conduction_disorders__second_degree_av_block_mobitz_ii',
  'CV__conduction_disorders__third_degree_av_block',
  'CV__conduction_disorders__wolff_parkinson_white_syndrome',
  'CV__channelopathy__brugada_syndrome',
  'CV__ecg__hyperkalemia',
  'CV__ecg__hypokalemia',
  'CV__ecg__hypercalcemia',
  'CV__ecg__hypocalcemia',
  'CV__ecg__left_ventricular_hypertrophy',
  'CV__ecg__right_ventricular_hypertrophy',
  'CV__ecg__pulmonary_embolism',

  // RADIOLOGY
  'PULM__infectious__pneumonia',
  'PULM__pleural_disease__pneumothorax',
  'PULM__interstitial__sarcoidosis',
  'PULM__infectious__tuberculosis',
  'PULM__obstructive__chronic_obstructive_pulmonary_disease_copd',
  'GI__small_bowel__small_bowel_obstruction',
  'GI__obstruction__pneumoperitoneum',
  'GI__colon__diverticulitis',
  'GI__large_bowel_acute_abdomen__appendicitis',
  'GI__colon__volvulus',
  'GI__small_bowel__intussusception',
  'MSK__traumafracture__colles_fracture',
  'MSK__traumafracture__jones_fracture',
  'MSK__arthritis__osteoarthritis',
  'MSK__crystal_disease__gout',
  'NEURO__trauma__epidural_hematoma',
  'NEURO__trauma__subdural_hematoma',
  'NEURO__trauma__basilar_skull_fracture',
  'CV__vascular_disease__aortic_dissection',

  // EYE (HEENT)
  'HEENT__eye__glaucoma__acute_angleclosure_glaucoma',
  'HEENT__eye__retina__central_retinal_artery_occlusion_crao',
  'HEENT__eye__retina__central_retinal_vein_occlusion_crvo',
  'HEENT__eye__retina__retinal_detachment',
  'HEENT__eye__retina__diabetic_retinopathy',
  'HEENT__eye__retina__hypertensive_retinopathy',
  'HEENT__eye__retina__papilledema',
  'HEENT__eye__cornea__anterior_segment__herpes_simplex_keratitis',
  'HEENT__eye__cornea__anterior_segment__corneal_foreign_body',
  'HEENT__eye__orbit__orbital_cellulitis',
  'HEENT__eye__orbit__hyphema',
  'HEENT__eye__lens__cataract',
  'HEENT__eye__conjunctiva__pterygium',
  'HEENT__eye__conjunctiva__pinguecula',
  'HEENT__eye__lids__chalazion',
  'HEENT__eye__lids__hordeolum',
  'HEENT__eye__lids__ectropion',
  'HEENT__eye__lids__entropion',

  // INFECTIOUS DISEASE
  'ID__viral__varicella_chickenpox',
  'ID__viral__herpes_zoster_shingles',
  'ID__viral__measles',
  'ID__bacterial__impetigo',
  'ID__pediatrics__scarlet_fever',
  'DERM__infectious_viral_childhood_exanthem__hand_foot_mouth_disease_hfmd',
  'DERM__infectious_bacterial_systemic_with_cutaneous_manifestations__erythema_migrans',

  // HEMATOLOGY (blood smears)
  'HEME__anemia__iron_deficiency_anemia',
  'HEME__anemia__vitamin_b12_deficiency_anemia',
  'HEME__hemolytic__g6pd_deficiency',
  'HEME__hemoglobinopathy__sickle_cell_disease',
  'HEME__leukemia__acute_myeloid_leukemia_aml',
  'HEME__leukemia__chronic_lymphocytic_leukemia_cll',
  'HEME__plasma_cell__multiple_myeloma',
];

// Answer-revealing keywords to detect in images
const ANSWER_KEYWORDS = [
  // Disease names
  'melanoma',
  'carcinoma',
  'psoriasis',
  'eczema',
  'herpes',
  'shingles',
  'fibrillation',
  'tachycardia',
  'infarction',
  'stemi',
  'nstemi',
  'pneumonia',
  'tuberculosis',
  'fracture',
  'dislocation',
  // Diagnostic terms
  'diagnosis',
  'answer',
  'correct',
  'pathology',
  'finding',
  // Educational labels
  'figure',
  'case',
  'example',
  'note:',
  'arrow shows',
];

interface ProcessingResult {
  inputPath: string;
  outputPath?: string;
  conditionId?: string;
  success: boolean;
  skipped: boolean;
  skipReason?: string;
  facesBlurred?: number;
  textRemoved?: boolean;
  cropped?: boolean;
  qualityScore?: number;
}

interface ImageProcessingOptions {
  dryRun?: boolean;
  skipBlur?: boolean;
  skipOcr?: boolean;
  forceUpload?: boolean;
  targetCondition?: string;
}

/**
 * Ensure required directories exist
 */
function ensureDirectories(): void {
  [TEMP_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Detect faces in an image using Python/OpenCV
 * Returns bounding boxes of detected faces
 */
async function detectFaces(
  imagePath: string
): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  try {
    // Use a simple Python script with OpenCV for face detection
    const pythonScript = `
import cv2
import json
import sys

image = cv2.imread(sys.argv[1])
if image is None:
    print(json.dumps([]))
    sys.exit(0)

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# Use Haar cascade for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

# Also try profile faces
profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
profiles = profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

all_faces = []
for (x, y, w, h) in faces:
    all_faces.append({"x": int(x), "y": int(y), "width": int(w), "height": int(h)})
for (x, y, w, h) in profiles:
    all_faces.append({"x": int(x), "y": int(y), "width": int(w), "height": int(h)})

print(json.dumps(all_faces))
`;

    const scriptPath = path.join(TEMP_DIR, 'detect_faces.py');
    fs.writeFileSync(scriptPath, pythonScript);

    const result = execSync(`python3 "${scriptPath}" "${imagePath}"`, { encoding: 'utf-8' });
    return JSON.parse(result.trim());
  } catch (error) {
    // Face detection failed, return empty array
    return [];
  }
}

/**
 * Blur faces in an image using OpenCV
 */
async function blurFaces(
  imagePath: string,
  faces: Array<{ x: number; y: number; width: number; height: number }>,
  outputPath: string
): Promise<boolean> {
  if (faces.length === 0) {
    // No faces to blur, just copy the file
    fs.copyFileSync(imagePath, outputPath);
    return true;
  }

  try {
    const pythonScript = `
import cv2
import json
import sys

image = cv2.imread(sys.argv[1])
faces = json.loads(sys.argv[2])
output_path = sys.argv[3]

for face in faces:
    x, y, w, h = face['x'], face['y'], face['width'], face['height']
    # Expand region slightly for better coverage
    margin = int(min(w, h) * 0.1)
    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(image.shape[1], x + w + margin)
    y2 = min(image.shape[0], y + h + margin)
    
    # Apply strong Gaussian blur
    roi = image[y1:y2, x1:x2]
    blurred = cv2.GaussianBlur(roi, (99, 99), 30)
    image[y1:y2, x1:x2] = blurred

cv2.imwrite(output_path, image)
print("success")
`;

    const scriptPath = path.join(TEMP_DIR, 'blur_faces.py');
    fs.writeFileSync(scriptPath, pythonScript);

    const facesJson = JSON.stringify(faces).replace(/"/g, '\\"');
    execSync(`python3 "${scriptPath}" "${imagePath}" "${facesJson}" "${outputPath}"`, {
      encoding: 'utf-8',
    });
    return true;
  } catch (error) {
    console.error('Face blur error:', error);
    return false;
  }
}

/**
 * Detect text in image using OCR (pytesseract)
 */
async function detectText(
  imagePath: string
): Promise<{
  text: string;
  regions: Array<{ x: number; y: number; width: number; height: number; text: string }>;
}> {
  try {
    const pythonScript = `
import cv2
import json
import sys

try:
    import pytesseract
except ImportError:
    print(json.dumps({"text": "", "regions": []}))
    sys.exit(0)

image = cv2.imread(sys.argv[1])
if image is None:
    print(json.dumps({"text": "", "regions": []}))
    sys.exit(0)

# Get text with bounding boxes
data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

text = pytesseract.image_to_string(image)
regions = []

n_boxes = len(data['text'])
for i in range(n_boxes):
    if int(data['conf'][i]) > 60:  # Confidence threshold
        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
        word = data['text'][i].strip()
        if word:
            regions.append({"x": x, "y": y, "width": w, "height": h, "text": word})

print(json.dumps({"text": text.strip(), "regions": regions}))
`;

    const scriptPath = path.join(TEMP_DIR, 'detect_text.py');
    fs.writeFileSync(scriptPath, pythonScript);

    const result = execSync(`python3 "${scriptPath}" "${imagePath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    return JSON.parse(result.trim());
  } catch (error) {
    return { text: '', regions: [] };
  }
}

/**
 * Check if detected text contains answer-revealing content
 */
function hasAnswerRevealingText(text: string): { revealing: boolean; matches: string[] } {
  const lowerText = text.toLowerCase();
  const matches: string[] = [];

  for (const keyword of ANSWER_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matches.push(keyword);
    }
  }

  return { revealing: matches.length > 0, matches };
}

/**
 * Remove text regions from image by blurring them
 */
async function removeTextRegions(
  imagePath: string,
  regions: Array<{ x: number; y: number; width: number; height: number }>,
  outputPath: string
): Promise<boolean> {
  if (regions.length === 0) {
    fs.copyFileSync(imagePath, outputPath);
    return true;
  }

  try {
    const pythonScript = `
import cv2
import json
import sys

image = cv2.imread(sys.argv[1])
regions = json.loads(sys.argv[2])
output_path = sys.argv[3]

for region in regions:
    x, y, w, h = region['x'], region['y'], region['width'], region['height']
    # Expand region slightly
    margin = 5
    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(image.shape[1], x + w + margin)
    y2 = min(image.shape[0], y + h + margin)
    
    # Replace with solid color matching background
    roi = image[y1:y2, x1:x2]
    # Use edge color as fill
    if roi.size > 0:
        edge_color = cv2.mean(roi)[:3]
        cv2.rectangle(image, (x1, y1), (x2, y2), edge_color, -1)

cv2.imwrite(output_path, image)
print("success")
`;

    const scriptPath = path.join(TEMP_DIR, 'remove_text.py');
    fs.writeFileSync(scriptPath, pythonScript);

    const regionsJson = JSON.stringify(regions).replace(/"/g, '\\"');
    execSync(`python3 "${scriptPath}" "${imagePath}" "${regionsJson}" "${outputPath}"`, {
      encoding: 'utf-8',
    });
    return true;
  } catch (error) {
    console.error('Text removal error:', error);
    return false;
  }
}

/**
 * Process a single image through the pipeline
 */
async function processImage(
  imagePath: string,
  conditionId: string,
  options: ImageProcessingOptions
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    inputPath: imagePath,
    conditionId,
    success: false,
    skipped: false,
  };

  const filename = path.basename(imagePath);
  const outputPath = path.join(OUTPUT_DIR, `${conditionId}_${filename}`);

  try {
    // Step 1: Detect faces
    let currentPath = imagePath;
    if (!options.skipBlur) {
      const faces = await detectFaces(imagePath);
      if (faces.length > 0) {
        const blurredPath = path.join(TEMP_DIR, `blurred_${filename}`);
        const blurred = await blurFaces(imagePath, faces, blurredPath);
        if (blurred) {
          currentPath = blurredPath;
          result.facesBlurred = faces.length;
        }
      }
    }

    // Step 2: Detect and check text
    if (!options.skipOcr) {
      const textResult = await detectText(currentPath);
      const answerCheck = hasAnswerRevealingText(textResult.text);

      if (answerCheck.revealing && !options.forceUpload) {
        // Try to remove the answer-revealing text
        const regionsToRemove = textResult.regions.filter((r) =>
          answerCheck.matches.some((m) => r.text.toLowerCase().includes(m.toLowerCase()))
        );

        if (regionsToRemove.length > 0) {
          const cleanedPath = path.join(TEMP_DIR, `cleaned_${filename}`);
          const cleaned = await removeTextRegions(currentPath, regionsToRemove, cleanedPath);
          if (cleaned) {
            currentPath = cleanedPath;
            result.textRemoved = true;
          }
        } else if (answerCheck.matches.length > 2) {
          // Too much answer-revealing text, skip this image
          result.skipped = true;
          result.skipReason = `Answer-revealing text: ${answerCheck.matches.join(', ')}`;
          return result;
        }
      }
    }

    // Step 3: Copy to output
    if (options.dryRun) {
      result.outputPath = outputPath;
      result.success = true;
      console.log(`  [DRY RUN] Would process: ${filename}`);
    } else {
      fs.copyFileSync(currentPath, outputPath);
      result.outputPath = outputPath;
      result.success = true;
    }

    return result;
  } catch (error) {
    result.skipped = true;
    result.skipReason = `Processing error: ${error}`;
    return result;
  }
}

/**
 * Get all images for a condition from local folders
 */
function getLocalImagesForCondition(conditionId: string, basePath: string): string[] {
  const images: string[] = [];
  const conditionName = conditionId.split('__').pop()?.replace(/_/g, ' ') || '';

  const folders = [
    'ALL IMAGES',
    'curated_images/DERM',
    'curated_images/ECG',
    'curated_images/RAD',
    'MISC/good',
  ];

  for (const folder of folders) {
    const folderPath = path.join(basePath, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const lowerFile = file.toLowerCase();
      const lowerCondition = conditionName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const lowerFileNorm = lowerFile.replace(/[^a-z0-9]/g, '');

      if (lowerFileNorm.includes(lowerCondition) && /\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
        images.push(path.join(folderPath, file));
      }
    }
  }

  return [...new Set(images)]; // Remove duplicates
}

/**
 * Main pipeline function
 */
async function runPipeline(options: ImageProcessingOptions = {}): Promise<void> {
  console.log('🏥 Medical Image Processing Pipeline');
  console.log('====================================\n');

  ensureDirectories();

  // Check Python dependencies
  try {
    execSync('python3 -c "import cv2"', { encoding: 'utf-8' });
  } catch {
    console.error('❌ OpenCV (cv2) not installed. Run: pip3 install opencv-python');
    process.exit(1);
  }

  const basePath = '/Users/aaronullger/PANaCEa/DATA/DATA';
  const conditionsToProcess = options.targetCondition
    ? [options.targetCondition]
    : HIGH_YIELD_VISUAL_CONDITIONS;

  console.log(`📊 Processing ${conditionsToProcess.length} high-yield conditions`);
  console.log(
    `   Options: dryRun=${options.dryRun}, skipBlur=${options.skipBlur}, skipOcr=${options.skipOcr}\n`
  );

  const stats = {
    total: 0,
    processed: 0,
    skipped: 0,
    facesBlurred: 0,
    textRemoved: 0,
    errors: 0,
  };

  for (let i = 0; i < conditionsToProcess.length; i++) {
    const conditionId = conditionsToProcess[i];
    const conditionName = conditionId.split('__').pop()?.replace(/_/g, ' ') || conditionId;

    console.log(`[${i + 1}/${conditionsToProcess.length}] ${conditionName}`);

    // Get local images for this condition
    const images = getLocalImagesForCondition(conditionId, basePath);

    if (images.length === 0) {
      console.log(`  ⚠️ No local images found\n`);
      continue;
    }

    console.log(`  📷 Found ${images.length} images`);

    // Process each image
    for (const imagePath of images.slice(0, 10)) {
      // Limit to 10 per condition
      stats.total++;

      const result = await processImage(imagePath, conditionId, options);

      if (result.success) {
        stats.processed++;
        if (result.facesBlurred) stats.facesBlurred += result.facesBlurred;
        if (result.textRemoved) stats.textRemoved++;
        console.log(
          `    ✅ ${path.basename(imagePath)}${result.facesBlurred ? ` (${result.facesBlurred} faces blurred)` : ''}${result.textRemoved ? ' (text removed)' : ''}`
        );
      } else if (result.skipped) {
        stats.skipped++;
        console.log(`    ⏭️ ${path.basename(imagePath)}: ${result.skipReason}`);
      } else {
        stats.errors++;
        console.log(`    ❌ ${path.basename(imagePath)}`);
      }

      await delay(100); // Small delay between images
    }

    console.log('');
  }

  console.log('\n📊 Pipeline Complete!');
  console.log('=====================');
  console.log(`  Total images: ${stats.total}`);
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Faces blurred: ${stats.facesBlurred}`);
  console.log(`  Text removed: ${stats.textRemoved}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`\n  Output directory: ${OUTPUT_DIR}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ImageProcessingOptions = {
  dryRun: args.includes('--dry-run'),
  skipBlur: args.includes('--skip-blur'),
  skipOcr: args.includes('--skip-ocr'),
  forceUpload: args.includes('--force'),
};

const conditionArg = args.find((a) => a.startsWith('--condition='));
if (conditionArg) {
  options.targetCondition = conditionArg.split('=')[1];
}

runPipeline(options).catch(console.error);
