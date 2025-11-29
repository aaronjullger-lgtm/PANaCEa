/**
 * Medical Image Gathering Script
 *
 * This script uses Gemini 2.5 Pro API and Google Custom Search Engine (CSE)
 * to gather high-quality medical diagnostic images for conditions.
 *
 * Supports gold standard, recognizable modalities for PA student education:
 * - EKG/ECG images for cardiac arrhythmias
 * - X-ray images (chest XR and skeletal XR)
 * - CT scans
 * - MRI scans
 * - Dermatology clinical photographs
 * - Fundoscopy/ophthalmoscopy images (retinal findings)
 *
 * Run with: npx tsx scripts/gatherMedicalImages.ts
 * Or with: npm run media:gather
 *
 * Required environment variables:
 * - GOOGLE_API_KEY or GEMINI_API_KEY: API key for Gemini and CSE
 * - GOOGLE_CSE_ID: Custom Search Engine ID
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";

// ================= CONFIGURATION =================

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
const CSE_ID = process.env.GOOGLE_CSE_ID || "";

const INPUT_JSON_FILE = "conditionContent.correct.json";
const IMAGE_OUTPUT_DIR = "public/media";

// AI Configuration
const MODEL_NAME = "gemini-2.5-pro";

// Image Settings
const REQUEST_DELAY_MS = 1500; // Delay between API requests to avoid rate limiting

// ================= TYPES =================

interface ConditionContent {
  diagnostics?: {
    notes?: string;
  };
  overview?: string;
  [key: string]: unknown;
}

interface ConditionData {
  [key: string]: ConditionContent;
}

interface SearchResult {
  link: string;
  image?: {
    contextLink?: string;
  };
}

interface CSEResponse {
  items?: SearchResult[];
}

/**
 * Diagnostic modality types for medical conditions
 * Gold standard modalities that PA students should recognize
 */
type DiagnosticModality =
  | "EKG"
  | "CXR"
  | "XR"
  | "CT"
  | "MRI"
  | "DERM"
  | "FUNDOSCOPY"
  | "NONE";

/**
 * Supported modalities (excludes NONE)
 */
const SUPPORTED_MODALITIES: DiagnosticModality[] = ["EKG", "CXR", "XR", "CT", "MRI", "DERM", "FUNDOSCOPY"];

/**
 * Strategy for finding diagnostic images
 */
interface DiagnosticStrategy {
  modality: DiagnosticModality;
  searchQuery: string;
  sourceSites: string;
  verificationCriteria: string;
}

// ================= SOURCE CONFIGURATION =================

/**
 * Trusted medical imaging sources by modality
 */
const MODALITY_SOURCES: Record<DiagnosticModality, string> = {
  EKG: "site:litfl.com OR site:ecg.utah.edu OR site:learntheheart.com OR site:ecgwaves.com",
  CXR: "site:radiopaedia.org OR site:radiologyassistant.nl OR site:learningradiology.com",
  XR: "site:radiopaedia.org OR site:orthobullets.com OR site:learningradiology.com",
  CT: "site:radiopaedia.org OR site:radiologyassistant.nl OR site:ctisus.com",
  MRI: "site:radiopaedia.org OR site:radiologyassistant.nl OR site:mrimaster.com",
  DERM: "site:dermnetnz.org OR site:dermis.net OR site:visualdx.com OR site:aad.org",
  FUNDOSCOPY: "site:eyewiki.org OR site:aao.org OR site:retinalphysician.com OR site:webeye.ophth.uiowa.edu",
  NONE: "",
};

/**
 * Medical category to typical modality mapping
 * Includes gold standard modalities for PA student recognition
 */
const CATEGORY_DEFAULT_MODALITIES: Record<string, DiagnosticModality[]> = {
  CV: ["EKG", "CXR", "CT"],
  PULM: ["CXR", "CT"],
  GI: ["CT"],
  NEURO: ["CT", "MRI"],
  MSK: ["XR", "MRI", "CT"],
  DERM: ["DERM"],
  ENDO: ["NONE"],
  HEME: ["NONE"],
  RENAL: ["CT"],
  GU: ["CT", "MRI"],
  EENT: ["FUNDOSCOPY", "CT", "MRI"],
  REPRO: ["NONE"],
  PSYCH: ["NONE"],
  ID: ["CXR", "CT"],
};

// ================= INITIALIZATION =================

if (!API_KEY) {
  console.error("❌ Missing GOOGLE_API_KEY or GEMINI_API_KEY environment variable");
  console.error("   Please set this in your .env file or environment");
  process.exit(1);
}

if (!CSE_ID) {
  console.error("❌ Missing GOOGLE_CSE_ID environment variable");
  console.error("   Please set this in your .env file or environment");
  process.exit(1);
}

const client = new GoogleGenerativeAI(API_KEY);
const model = client.getGenerativeModel({ model: MODEL_NAME });

// ================= UTILITY FUNCTIONS =================

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the category from a condition key
 * e.g., "CV__ecg__atrial_fibrillation" -> "CV"
 */
function extractCategory(conditionKey: string): string {
  const parts = conditionKey.split("__");
  return parts[0]?.toUpperCase() || "UNKNOWN";
}

/**
 * Extract the condition name from a condition key
 * e.g., "CV__ecg__atrial_fibrillation" -> "atrial fibrillation"
 */
function extractConditionName(conditionKey: string): string {
  const parts = conditionKey.split("__");
  const lastPart = parts[parts.length - 1] || conditionKey;
  return lastPart.replace(/_/g, " ");
}

/**
 * Normalize text for safe file naming
 */
function sanitizeFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Parse domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// ================= AI-POWERED DIAGNOSTIC ANALYSIS =================

/**
 * Use Gemini to analyze a condition and determine the best diagnostic modality
 */
async function analyzeDiagnosticModality(
  conditionKey: string,
  conditionContent: ConditionContent
): Promise<DiagnosticStrategy | null> {
  const category = extractCategory(conditionKey);
  const conditionName = extractConditionName(conditionKey);

  // Get diagnostic notes if available
  const diagnosticNotes = conditionContent.diagnostics?.notes || "";
  const overview = conditionContent.overview || "";

  const prompt = `You are a medical education specialist analyzing diagnostic imaging for: "${conditionName}"

Category: ${category}
Diagnostic Information: ${diagnosticNotes.slice(0, 1500)}
Overview: ${overview.slice(0, 500)}

Analyze this condition and determine the GOLD STANDARD diagnostic imaging modality that a PA student should be able to recognize.

Choose from these modalities:
- EKG: For cardiac arrhythmias, MI, heart blocks (atrial fibrillation, flutter, SVT, VT, STEMI, Afib with RVR, etc.)
- CXR: For chest X-ray findings (pneumonia, COPD, pneumothorax, cardiomegaly, pleural effusion, etc.)
- XR: For bone/skeletal X-rays (fractures, dislocations, arthritis, osteomyelitis, etc.)
- CT: For cross-sectional imaging (stroke, PE, appendicitis, diverticulitis, abdominal trauma, tumors, etc.)
- MRI: For soft tissue/neurological imaging (ACL tear, brain tumors, MS plaques, disc herniation, spinal cord lesions, etc.)
- DERM: For dermatologic conditions visible on skin (rashes, lesions, melanoma, psoriasis, eczema, skin infections, etc.)
- FUNDOSCOPY: For retinal/eye findings visible on ophthalmoscopy (CRAO, papilledema, diabetic retinopathy, hypertensive retinopathy, optic neuritis, etc.)
- NONE: For conditions diagnosed primarily by labs, history, or physical exam without a recognizable image

RULES:
1. Choose the modality that produces the MOST RECOGNIZABLE diagnostic image for this condition
2. If there is a classic/pathognomonic finding on imaging, choose that modality
3. For eye conditions with fundoscopic findings (CRAO, CRVO, papilledema, retinopathy), choose FUNDOSCOPY
4. For skin conditions, always choose DERM
5. For cardiac arrhythmias, always choose EKG
6. If the condition is diagnosed primarily by labs/symptoms/history without imaging, choose NONE

Output EXACTLY in this JSON format (no markdown, no code blocks):
{
  "modality": "<EKG|CXR|XR|CT|MRI|DERM|FUNDOSCOPY|NONE>",
  "searchQuery": "<specific search query for finding this type of diagnostic image>",
  "verificationCriteria": "<what makes a good diagnostic image for this condition>"
}`;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();

    // Try to parse JSON, handling potential markdown code blocks
    let jsonText = text;
    if (text.includes("```json")) {
      jsonText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    } else if (text.includes("```")) {
      jsonText = text.replace(/```\s*/g, "");
    }

    const parsed = JSON.parse(jsonText);

    // Check if modality is supported (NONE means skip this condition)
    const modality = parsed.modality as DiagnosticModality;
    if (modality === "NONE" || !SUPPORTED_MODALITIES.includes(modality)) {
      return null;
    }

    const sourceSites = MODALITY_SOURCES[modality] || "";

    return {
      modality,
      searchQuery: parsed.searchQuery || `${conditionName} ${modality} diagnostic`,
      sourceSites,
      verificationCriteria:
        parsed.verificationCriteria ||
        `Clear ${modality} image showing ${conditionName}`,
    };
  } catch (error) {
    console.error(`   [AI Analysis Error] ${error}`);

    // Fallback to category-based defaults - find first supported modality
    const defaultModalities = CATEGORY_DEFAULT_MODALITIES[category];
    if (defaultModalities) {
      for (const modality of defaultModalities) {
        if (modality !== "NONE" && SUPPORTED_MODALITIES.includes(modality)) {
          return {
            modality,
            searchQuery: `${conditionName} ${modality} diagnostic image`,
            sourceSites: MODALITY_SOURCES[modality] || "",
            verificationCriteria: `Clear ${modality} showing ${conditionName}`,
          };
        }
      }
    }

    return null;
  }
}

// ================= IMAGE SEARCH =================

/**
 * Search for images using Google Custom Search API
 */
async function searchImages(
  query: string,
  sourceSites: string,
  numResults = 5
): Promise<SearchResult[]> {
  const fullQuery = sourceSites ? `${query} ${sourceSites}` : query;

  const params = new URLSearchParams({
    key: API_KEY,
    cx: CSE_ID,
    q: fullQuery,
    searchType: "image",
    num: String(Math.min(numResults, 10)),
    safe: "off",
  });

  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            // Check for API errors
            if (json.error) {
              console.error(`      [CSE API Error] ${json.error.message || JSON.stringify(json.error)}`);
              resolve([]);
              return;
            }
            resolve((json as CSEResponse).items || []);
          } catch (e) {
            console.error(`      [Parse Error] ${e}`);
            resolve([]);
          }
        });
      })
      .on("error", (e) => {
        console.error(`      [Network Error] ${e.message}`);
        resolve([]);
      });
  });
}

// ================= IMAGE DOWNLOAD =================

/**
 * Check if a URL has a supported protocol (http or https)
 */
function isValidImageUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Download an image from a URL
 */
async function downloadImage(
  imageUrl: string,
  outputPath: string
): Promise<boolean> {
  // Validate URL protocol before attempting download
  if (!isValidImageUrl(imageUrl)) {
    return false;
  }

  return new Promise((resolve) => {
    const protocol = imageUrl.startsWith("https") ? https : http;

    const request = protocol.get(imageUrl, { timeout: 15000 }, (response) => {
      // Handle redirects
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        const redirectUrl = response.headers.location;
        // Validate redirect URL has a supported protocol
        if (!isValidImageUrl(redirectUrl)) {
          resolve(false);
          return;
        }
        downloadImage(redirectUrl, outputPath)
          .then(resolve)
          .catch(() => resolve(false));
        return;
      }

      if (response.statusCode !== 200) {
        resolve(false);
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        try {
          const buffer = Buffer.concat(chunks);
          fs.writeFileSync(outputPath, buffer);
          resolve(true);
        } catch {
          resolve(false);
        }
      });
      response.on("error", () => resolve(false));
    });

    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}

// ================= IMAGE VERIFICATION =================

/**
 * Verify image quality using Gemini Vision
 */
async function verifyImageQuality(
  imagePath: string,
  conditionName: string,
  modality: DiagnosticModality,
  criteria: string
): Promise<boolean> {
  try {
    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // Determine MIME type from extension
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".webp") mimeType = "image/webp";

    // Build modality-specific verification prompt
    let modalityPrompt = "";
    switch (modality) {
      case "EKG":
        modalityPrompt =
          "This should be a real EKG/ECG strip showing rhythm and waveforms. REJECT diagrams, illustrations, or educational cartoons.";
        break;
      case "CXR":
      case "XR":
        modalityPrompt =
          "This should be an actual X-ray image. REJECT anatomical diagrams, illustrations, or labeled teaching images.";
        break;
      case "CT":
        modalityPrompt =
          "This should be an actual CT scan image (axial, sagittal, or coronal slice). REJECT diagrams or illustrations.";
        break;
      case "MRI":
        modalityPrompt =
          "This should be an actual MRI scan (T1, T2, FLAIR, etc.). REJECT diagrams or illustrations.";
        break;
      case "DERM":
        modalityPrompt =
          "This should be a real clinical photograph of a skin condition. REJECT illustrations, microscopy, or histology slides.";
        break;
      case "FUNDOSCOPY":
        modalityPrompt =
          "This should be a real fundoscopic/ophthalmoscopic photograph showing the retina. REJECT diagrams, illustrations, or cartoons.";
        break;
      default:
        modalityPrompt =
          "This should be a real diagnostic medical image. REJECT diagrams, illustrations, or non-medical images.";
    }

    const prompt = `You are a Medical Image Quality Reviewer. Analyze this image for: "${conditionName}"

Expected Modality: ${modality}
Verification Criteria: ${criteria}

${modalityPrompt}

APPROVE (output "KEEP") ONLY if:
1. It is a REAL diagnostic image (not a diagram, illustration, infographic, or cartoon)
2. The image quality is adequate (not excessively blurry or pixelated)
3. The relevant pathology or finding is visible
4. It does not have massive watermarks obscuring the image

REJECT (output "DISCARD") if:
1. It is a drawing, vector graphic, infographic, PowerPoint slide, or illustration
2. It is extremely low quality or blurry
3. The pathology is not clearly visible
4. It shows the wrong body part or condition
5. It is a stock photo or non-medical image

Respond with ONLY one word: KEEP or DISCARD`;

    const imagePart: Part = {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    };

    const response = await model.generateContent([prompt, imagePart]);
    const decision = response.response.text().trim().toUpperCase();

    return decision.includes("KEEP");
  } catch (error) {
    console.error(`   [Vision Verification Error] ${error}`);
    return false;
  }
}

// ================= MAIN PROCESSING =================

/**
 * Process a single condition to find and save a diagnostic image
 */
async function processCondition(
  conditionKey: string,
  conditionContent: ConditionContent,
  outputDir: string
): Promise<{ success: boolean; skipped: boolean; reason?: string }> {
  const conditionName = extractConditionName(conditionKey);
  const sanitizedKey = sanitizeFilename(conditionKey);
  const outputPath = path.join(outputDir, `${sanitizedKey}.jpg`);

  // Skip if image already exists
  if (fs.existsSync(outputPath)) {
    return { success: true, skipped: true, reason: "Image already exists" };
  }

  // Analyze diagnostic modality
  const strategy = await analyzeDiagnosticModality(conditionKey, conditionContent);

  if (!strategy) {
    return { success: false, skipped: true, reason: "No visual diagnostic" };
  }

  console.log(`   -> Modality: ${strategy.modality}`);
  console.log(`   -> Query: ${strategy.searchQuery.slice(0, 60)}...`);

  await sleep(REQUEST_DELAY_MS);

  // Search for images - try multiple strategies
  // Strategy 1: Use AI-generated query without site restrictions (most flexible)
  let searchResults = await searchImages(
    strategy.searchQuery,
    "", // No site restrictions for better results
    5
  );

  // Strategy 2: Try with trusted source sites
  if (searchResults.length === 0) {
    console.log(`   -> Tier 1 empty, trying trusted sources...`);
    searchResults = await searchImages(
      strategy.searchQuery,
      strategy.sourceSites,
      5
    );
  }

  // Strategy 3: Broader search with modality-specific terms
  if (searchResults.length === 0) {
    console.log(`   -> Tier 2 empty, trying broader search...`);
    let modalityTerms = "";
    switch (strategy.modality) {
      case "EKG":
        modalityTerms = "ECG EKG electrocardiogram strip rhythm";
        break;
      case "CXR":
        modalityTerms = "chest x-ray xray radiograph";
        break;
      case "XR":
        modalityTerms = "x-ray xray radiograph";
        break;
      case "CT":
        modalityTerms = "CT scan computed tomography axial";
        break;
      case "MRI":
        modalityTerms = "MRI magnetic resonance imaging";
        break;
      case "DERM":
        modalityTerms = "clinical photo dermatology skin lesion";
        break;
      case "FUNDOSCOPY":
        modalityTerms = "fundoscopy fundus ophthalmoscopy retina";
        break;
      default:
        modalityTerms = "medical diagnostic image";
    }
    const broadQuery = `${conditionName} ${modalityTerms} -cartoon -diagram -illustration -icon`;
    searchResults = await searchImages(broadQuery, "", 5);
  }

  if (searchResults.length === 0) {
    return { success: false, skipped: false, reason: "No search results" };
  }

  // Try each candidate until we find a good one
  for (let i = 0; i < searchResults.length; i++) {
    const candidate = searchResults[i];
    console.log(`   -> Candidate ${i + 1}/${searchResults.length}...`);

    // Skip URLs with unsupported protocols (e.g., x-raw-image:)
    if (!isValidImageUrl(candidate.link)) {
      console.log(`      Skipped (unsupported URL protocol)`);
      continue;
    }

    // Download image to temp location
    const tempPath = path.join(outputDir, `temp_${sanitizedKey}.jpg`);

    const downloaded = await downloadImage(candidate.link, tempPath);
    if (!downloaded) {
      console.log(`      Download failed`);
      continue;
    }

    // Verify file is valid and readable
    try {
      const stats = fs.statSync(tempPath);
      if (stats.size < 1000) {
        console.log(`      File too small`);
        fs.unlinkSync(tempPath);
        continue;
      }
    } catch {
      console.log(`      Invalid file`);
      continue;
    }

    await sleep(REQUEST_DELAY_MS);

    // Verify image quality with vision model
    const isGood = await verifyImageQuality(
      tempPath,
      conditionName,
      strategy.modality,
      strategy.verificationCriteria
    );

    if (isGood) {
      console.log(`      ✅ APPROVED`);

      // Move temp file to final location
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      fs.renameSync(tempPath, outputPath);

      // Log source for attribution
      const domain = candidate.image?.contextLink
        ? extractDomain(candidate.image.contextLink)
        : extractDomain(candidate.link);
      console.log(`      Source: ${domain}`);

      return { success: true, skipped: false };
    } else {
      console.log(`      ❌ REJECTED`);
      fs.unlinkSync(tempPath);
    }
  }

  // Clean up any remaining temp files
  const tempPath = path.join(outputDir, `temp_${sanitizedKey}.jpg`);
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }

  return { success: false, skipped: false, reason: "All candidates rejected" };
}

// ================= MAIN ENTRY POINT =================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Medical Image Gathering Script");
  console.log("=".repeat(60));
  console.log(`Model: ${MODEL_NAME}`);
  console.log(`Input: ${INPUT_JSON_FILE}`);
  console.log(`Output: ${IMAGE_OUTPUT_DIR}`);
  console.log("=".repeat(60));
  console.log();

  // Ensure output directory exists
  if (!fs.existsSync(IMAGE_OUTPUT_DIR)) {
    fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${IMAGE_OUTPUT_DIR}`);
  }

  // Load condition data
  let conditionData: ConditionData;
  try {
    const raw = fs.readFileSync(INPUT_JSON_FILE, "utf8");
    conditionData = JSON.parse(raw);
  } catch (error) {
    console.error(`❌ Error loading ${INPUT_JSON_FILE}:`, error);
    process.exit(1);
  }

  const conditionKeys = Object.keys(conditionData);
  console.log(`Found ${conditionKeys.length} conditions to process\n`);

  // Statistics
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // Process each condition
  for (let i = 0; i < conditionKeys.length; i++) {
    const key = conditionKeys[i];
    console.log(`\n[${i + 1}/${conditionKeys.length}] ${key}`);

    try {
      const result = await processCondition(
        key,
        conditionData[key],
        IMAGE_OUTPUT_DIR
      );

      if (result.success) {
        if (result.skipped) {
          console.log(`   -> Skipped: ${result.reason}`);
          skippedCount++;
        } else {
          successCount++;
        }
      } else {
        if (result.skipped) {
          console.log(`   -> Skipped: ${result.reason}`);
          skippedCount++;
        } else {
          console.log(`   -> Failed: ${result.reason}`);
          failedCount++;
        }
      }
    } catch (error) {
      console.error(`   -> Error: ${error}`);
      failedCount++;
    }

    // Add delay between conditions to avoid rate limiting
    if (i < conditionKeys.length - 1) {
      await sleep(500);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Successfully retrieved: ${successCount}`);
  console.log(`⏭️  Skipped (existing/no visual): ${skippedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`📊 Total processed: ${conditionKeys.length}`);
  console.log("=".repeat(60));
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
