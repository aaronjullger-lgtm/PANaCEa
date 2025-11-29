/**
 * PPTX Image Extraction Script for Global Photo Mode
 *
 * This script scrubs through a folder of PowerPoint (.pptx) files to find and extract
 * CLINICAL images of specific medical conditions/findings for PA student visual diagnosis training.
 *
 * KEY FEATURES:
 * - Context-aware image selection using AI (Gemini) to filter clinical vs non-clinical
 * - Only extracts images useful for visual diagnosis (physical exam findings, imaging, ECGs)
 * - Excludes infographics, charts, text-heavy slides, and non-clinical content
 * - Smart cropping to focus on relevant clinical content
 * - Supports multiple images per condition with proper indexing
 *
 * PPTX files are ZIP archives containing:
 * - ppt/slides/slide*.xml - Slide content and text
 * - ppt/media/* - Images, videos, and other media
 * - ppt/slides/_rels/slide*.xml.rels - Relationships linking slides to media
 *
 * Image Naming Convention:
 *   {condition_id}--{index}.{ext}
 *   Example: atrial_fibrillation--001.png, atrial_fibrillation--002.png
 *
 * This allows the photo drill to:
 *   - Load multiple images per condition
 *   - Generate distractors from the same system/subcategory
 *   - Test users on visual diagnosis
 *
 * Run with: npx tsx scripts/extractPptxImages.ts [input_folder] [output_folder]
 * Or: npm run pptx:extract
 *
 * Environment Variables:
 *   GOOGLE_API_KEY - Required for AI-powered image classification
 */

import * as fs from "fs";
import * as path from "path";
import * as unzipper from "unzipper";
import sharp from "sharp";
import {
  normalize,
  similarityScore,
} from "../lib/mediaMatcherUtils.js";
import { CONDITION_REGISTRY, ConditionMeta } from "../conditionRegistry.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Default input folder containing PPTX files */
const DEFAULT_INPUT_FOLDER = "./pptx_input";

/** Default output folder for extracted images */
const DEFAULT_OUTPUT_FOLDER = "./public/assets/pptx_images";

/** Default manifest output path */
const DEFAULT_MANIFEST_PATH = "./src/data/pptx_image_manifest.json";

/** Minimum similarity score for condition matching (0-1) */
const MATCH_THRESHOLD = 0.6;

/** Supported image extensions in PPTX media folder */
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".tiff", ".bmp"]);

/** Extensions that cannot be processed (vector formats) */
const SKIP_EXTENSIONS = new Set([".emf", ".wmf", ".svg"]);

/** Log file for images that couldn't be matched */
const UNMATCHED_LOG_PATH = "./output/unmatched_pptx_images.json";

/** Log file for rejected (non-clinical) images */
const REJECTED_LOG_PATH = "./output/rejected_pptx_images.json";

/** Minimum image dimensions to consider (filters out tiny icons) */
const MIN_IMAGE_WIDTH = 200;
const MIN_IMAGE_HEIGHT = 200;

/** Output image dimensions for cropped/processed images */
const OUTPUT_IMAGE_SIZE = 800;

/** API delay between Gemini calls to avoid rate limiting */
const API_DELAY_MS = 1000;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents an extracted image from a PPTX file
 */
interface ExtractedImage {
  /** Original filename in the PPTX */
  originalName: string;
  /** Source PPTX file */
  sourceFile: string;
  /** Slide number if determinable */
  slideNumber?: number;
  /** Extracted text context from the slide */
  textContext: string[];
  /** Image buffer data */
  data: Buffer;
  /** Image file extension */
  extension: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
}

/**
 * Result of AI image classification
 */
interface ImageClassification {
  /** Is this a clinical image suitable for visual diagnosis training? */
  isClinical: boolean;
  /** Type of clinical image */
  imageType: "physical_exam" | "ecg" | "xray" | "ct" | "mri" | "ultrasound" | "dermoscopy" | "lab_result" | "infographic" | "text_slide" | "diagram" | "other";
  /** Confidence in the classification (0-1) */
  confidence: number;
  /** Reason for classification */
  reason: string;
  /** Suggested crop region if applicable */
  suggestedCrop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  /** Matched condition from the image content */
  detectedCondition?: string;
}

/**
 * Manifest entry for photo drill - compatible with existing photo mode format
 * This is the format needed for Global Photo Mode to load and test users
 */
interface PhotoDrillManifestEntry {
  /** Unique ID for the case (condition_id--index) */
  id: string;
  /** Filename of the image (same as id with extension) */
  fileName: string;
  /** Full URL path for the image (relative to public folder) */
  imageUrl: string;
  /** The correct diagnosis for this case */
  condition: string;
  /** Condition system code (CV, PULM, DERM, etc.) for filtering */
  system: string;
  /** Subcategory of the condition */
  subcategory: string;
  /** Modality type for photo drill (ecg, xray, derm) */
  modality: "ecg" | "xray" | "derm" | "other";
  /** Array of distractor (incorrect) diagnoses for quiz */
  distractors: string[];
  /** Educational caption/explanation for feedback */
  caption: string;
  /** Matching confidence score (0-1) */
  confidence: number;
  /** Source PPTX file for attribution */
  source: string;
  /** Type of clinical image */
  imageType: string;
}

/**
 * Represents an unmatched image for manual review
 */
interface UnmatchedImage {
  /** Original filename */
  fileName: string;
  /** Source PPTX file */
  source: string;
  /** Text context extracted from slide */
  context: string[];
  /** Best match candidates with scores */
  candidates: Array<{ condition: string; score: number }>;
}

/**
 * Represents a rejected (non-clinical) image
 */
interface RejectedImage {
  /** Original filename */
  fileName: string;
  /** Source PPTX file */
  source: string;
  /** Reason for rejection */
  reason: string;
  /** Detected image type */
  imageType: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Delays execution for the specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a condition ID from a condition name
 * Format: lowercase, spaces replaced with underscores, special chars removed
 * Example: "Atrial Fibrillation" -> "atrial_fibrillation"
 */
function createConditionId(conditionName: string): string {
  return conditionName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

/**
 * Creates the final filename for an image
 * Format: {condition_id}--{index}.{ext}
 * Example: atrial_fibrillation--001.png
 */
function createImageFilename(conditionId: string, index: number, extension: string): string {
  const paddedIndex = String(index).padStart(3, "0");
  return `${conditionId}--${paddedIndex}${extension}`;
}

/**
 * Extracts text content from a slide XML file
 */
function extractTextFromSlideXml(xmlContent: string): string[] {
  const texts: string[] = [];
  
  // Match text content in <a:t> tags (PowerPoint text elements)
  const textMatches = xmlContent.match(/<a:t>([^<]*)<\/a:t>/g);
  if (textMatches) {
    for (const match of textMatches) {
      const text = match.replace(/<\/?a:t>/g, "").trim();
      if (text.length > 2) {
        texts.push(text);
      }
    }
  }
  
  return texts;
}

/**
 * Gets image metadata (dimensions) using sharp
 */
async function getImageMetadata(imageData: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(imageData).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Processes and crops an image for optimal display
 * - Converts to JPEG for consistency
 * - Crops to focus on clinical content (center crop if no specific region)
 * - Resizes to standard output size
 */
async function processImage(
  imageData: Buffer,
  cropRegion?: { left: number; top: number; width: number; height: number }
): Promise<Buffer> {
  let pipeline = sharp(imageData);
  
  // Get original dimensions
  const metadata = await pipeline.metadata();
  const origWidth = metadata.width || 800;
  const origHeight = metadata.height || 600;
  
  // Apply crop if specified
  if (cropRegion) {
    // Ensure crop region is within bounds
    const safeLeft = Math.max(0, Math.min(cropRegion.left, origWidth - 10));
    const safeTop = Math.max(0, Math.min(cropRegion.top, origHeight - 10));
    const safeWidth = Math.min(cropRegion.width, origWidth - safeLeft);
    const safeHeight = Math.min(cropRegion.height, origHeight - safeTop);
    
    if (safeWidth > 50 && safeHeight > 50) {
      pipeline = pipeline.extract({
        left: Math.round(safeLeft),
        top: Math.round(safeTop),
        width: Math.round(safeWidth),
        height: Math.round(safeHeight),
      });
    }
  }
  
  // Resize to standard size while maintaining aspect ratio
  pipeline = pipeline.resize(OUTPUT_IMAGE_SIZE, OUTPUT_IMAGE_SIZE, {
    fit: "inside",
    withoutEnlargement: true,
  });
  
  // Convert to JPEG with good quality
  return pipeline.jpeg({ quality: 85, progressive: true }).toBuffer();
}

/**
 * Classifies an image using heuristics (fallback when AI is not available)
 * Analyzes image properties to determine if it's likely clinical
 */
async function classifyImageHeuristic(
  imageData: Buffer,
  textContext: string[]
): Promise<ImageClassification> {
  try {
    const metadata = await sharp(imageData).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const aspectRatio = width / height;
    
    // Analyze text context for clinical keywords
    const contextLower = textContext.join(" ").toLowerCase();
    const clinicalKeywords = [
      "ecg", "ekg", "electrocardiogram", "rhythm", "lead",
      "x-ray", "xray", "radiograph", "chest", "ct scan", "mri",
      "lesion", "rash", "skin", "dermoscopy", "biopsy",
      "ultrasound", "sonogram", "echo",
      "physical exam", "finding", "sign", "symptom",
      "diagnosis", "clinical", "patient", "presentation"
    ];
    
    const infographicKeywords = [
      "algorithm", "flowchart", "diagram", "table", "chart",
      "infographic", "pathway", "protocol", "guidelines",
      "summary", "overview", "bullet", "list", "steps"
    ];
    
    let clinicalScore = 0;
    let infographicScore = 0;
    
    for (const keyword of clinicalKeywords) {
      if (contextLower.includes(keyword)) clinicalScore++;
    }
    
    for (const keyword of infographicKeywords) {
      if (contextLower.includes(keyword)) infographicScore++;
    }
    
    // Determine image type based on context
    let imageType: ImageClassification["imageType"] = "other";
    if (contextLower.includes("ecg") || contextLower.includes("ekg") || contextLower.includes("rhythm")) {
      imageType = "ecg";
    } else if (contextLower.includes("x-ray") || contextLower.includes("xray") || contextLower.includes("radiograph")) {
      imageType = "xray";
    } else if (contextLower.includes("ct") || contextLower.includes("computed tomography")) {
      imageType = "ct";
    } else if (contextLower.includes("mri") || contextLower.includes("magnetic resonance")) {
      imageType = "mri";
    } else if (contextLower.includes("ultrasound") || contextLower.includes("sonogram")) {
      imageType = "ultrasound";
    } else if (contextLower.includes("skin") || contextLower.includes("rash") || contextLower.includes("lesion") || contextLower.includes("derm")) {
      imageType = "dermoscopy";
    } else if (contextLower.includes("physical") || contextLower.includes("exam") || contextLower.includes("finding")) {
      imageType = "physical_exam";
    }
    
    // Detect infographics/diagrams
    if (infographicScore > clinicalScore || contextLower.includes("algorithm") || contextLower.includes("flowchart")) {
      imageType = "infographic";
    }
    
    // Small images are likely icons
    if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
      return {
        isClinical: false,
        imageType: "other",
        confidence: 0.9,
        reason: "Image too small (likely icon or thumbnail)",
      };
    }
    
    // Very wide/tall aspect ratios often indicate banners or headers
    if (aspectRatio > 4 || aspectRatio < 0.25) {
      return {
        isClinical: false,
        imageType: "other",
        confidence: 0.7,
        reason: "Unusual aspect ratio (likely banner or header)",
      };
    }
    
    // Infographics are not clinical
    if (imageType === "infographic") {
      return {
        isClinical: false,
        imageType: "infographic",
        confidence: 0.6,
        reason: "Detected as infographic/flowchart based on context",
      };
    }
    
    // Determine if clinical based on scores
    const isClinical = clinicalScore > infographicScore && clinicalScore >= 1;
    
    return {
      isClinical,
      imageType,
      confidence: 0.5 + (clinicalScore * 0.1),
      reason: isClinical 
        ? `Clinical keywords found: ${clinicalScore}` 
        : "Could not confirm as clinical image",
    };
  } catch {
    return {
      isClinical: false,
      imageType: "other",
      confidence: 0.3,
      reason: "Failed to analyze image",
    };
  }
}

/**
 * Classifies an image using Google Gemini AI
 * Determines if the image is suitable for clinical visual diagnosis training
 */
async function classifyImageWithAI(
  imageData: Buffer,
  textContext: string[],
  apiKey: string
): Promise<ImageClassification> {
  try {
    // Dynamic import to handle missing API key gracefully
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Convert image to base64
    const base64Image = imageData.toString("base64");
    const mimeType = "image/jpeg"; // We'll convert all images to JPEG
    
    const prompt = `You are a medical education image classifier. Analyze this image and determine if it is suitable for PA (Physician Assistant) student visual diagnosis training.

CONTEXT from the slide: "${textContext.slice(0, 5).join(" ")}"

Classify this image into ONE of these categories:
1. "physical_exam" - Photos showing physical examination findings (e.g., skin lesions, swelling, deformities)
2. "ecg" - ECG/EKG tracings showing cardiac rhythms
3. "xray" - X-ray images (chest, musculoskeletal, etc.)
4. "ct" - CT scan images
5. "mri" - MRI images  
6. "ultrasound" - Ultrasound/sonogram images
7. "dermoscopy" - Dermatoscopic or close-up skin images
8. "lab_result" - Lab values or test results (NOT suitable for visual diagnosis)
9. "infographic" - Charts, flowcharts, algorithms, diagrams with lots of text (NOT suitable)
10. "text_slide" - Mostly text content (NOT suitable)
11. "diagram" - Anatomical drawings or illustrations (NOT suitable for diagnosis training)
12. "other" - None of the above

Return a JSON object with:
{
  "imageType": "<category from above>",
  "isClinical": <true if suitable for visual diagnosis training, false otherwise>,
  "confidence": <0.0 to 1.0>,
  "reason": "<brief explanation>",
  "detectedCondition": "<medical condition shown, if identifiable, or null>"
}

Only return the JSON object, no other text.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ]);
    
    const responseText = result.response.text().trim();
    
    // Parse JSON response
    let parsed: Partial<ImageClassification>;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      console.warn("    Failed to parse AI response, using heuristic fallback");
      return classifyImageHeuristic(imageData, textContext);
    }
    
    return {
      isClinical: parsed.isClinical ?? false,
      imageType: parsed.imageType ?? "other",
      confidence: parsed.confidence ?? 0.5,
      reason: parsed.reason ?? "AI classification",
      detectedCondition: parsed.detectedCondition,
    };
  } catch (error) {
    console.warn(`    AI classification failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return classifyImageHeuristic(imageData, textContext);
  }
}

/**
 * Determines the modality based on condition system and subcategory
 */
function determineModality(system: string, subcategory: string): "ecg" | "xray" | "derm" | "other" {
  const normalizedSubcat = subcategory.toLowerCase();
  
  // ECG modality
  if (system === "CV" && (normalizedSubcat.includes("ecg") || normalizedSubcat.includes("arrhythmia") || normalizedSubcat.includes("conduction"))) {
    return "ecg";
  }
  
  // Dermatology modality
  if (system === "DERM" || normalizedSubcat.includes("derm") || normalizedSubcat.includes("skin")) {
    return "derm";
  }
  
  // X-ray/Imaging modality for pulmonary, MSK, and other imaging conditions
  if (
    system === "PULM" ||
    system === "MSK" ||
    normalizedSubcat.includes("imaging") ||
    normalizedSubcat.includes("x-ray") ||
    normalizedSubcat.includes("xray") ||
    normalizedSubcat.includes("radiology") ||
    normalizedSubcat.includes("trauma") ||
    normalizedSubcat.includes("fracture")
  ) {
    return "xray";
  }
  
  return "other";
}

/**
 * Generates distractors for a condition from the same system/subcategory
 * Returns 3 plausible incorrect diagnoses for quiz mode
 */
function generateDistractors(condition: ConditionMeta): string[] {
  const distractors: string[] = [];
  
  // First, try to get conditions from the same subcategory
  const sameSubcategory = CONDITION_REGISTRY.filter(
    (c) => c.system === condition.system && 
           c.subcategory === condition.subcategory && 
           c.condition !== condition.condition
  );
  
  // Then, get conditions from the same system
  const sameSystem = CONDITION_REGISTRY.filter(
    (c) => c.system === condition.system && 
           c.condition !== condition.condition &&
           !sameSubcategory.includes(c)
  );
  
  // Shuffle and pick distractors
  const shuffledSubcat = sameSubcategory.sort(() => Math.random() - 0.5);
  const shuffledSystem = sameSystem.sort(() => Math.random() - 0.5);
  
  // Pick 2 from same subcategory if available, then fill from system
  for (const c of shuffledSubcat.slice(0, 2)) {
    distractors.push(c.condition);
  }
  
  for (const c of shuffledSystem) {
    if (distractors.length >= 3) break;
    distractors.push(c.condition);
  }
  
  return distractors.slice(0, 3);
}

/**
 * Generates an educational caption based on condition metadata
 */
function generateCaption(condition: ConditionMeta, textContext: string[]): string {
  // Try to use overview from condition if available
  if (condition.overview) {
    return condition.overview.substring(0, 200);
  }
  
  // Try to use key points
  if (condition.keyPoints && condition.keyPoints.length > 0) {
    return `Key features: ${condition.keyPoints.slice(0, 3).join(", ")}`;
  }
  
  // Fall back to extracted text context
  const relevantContext = textContext.filter((t) => t.length > 10).slice(0, 2);
  if (relevantContext.length > 0) {
    return relevantContext.join(" ");
  }
  
  return `This image shows characteristic findings of ${condition.condition}.`;
}

/**
 * Finds the best matching condition for given text context
 */
function findBestConditionMatch(textContext: string[]): {
  condition: ConditionMeta | null;
  score: number;
  bestMatchText: string;
} {
  const combinedText = textContext.join(" ");
  const normalizedContext = normalize(combinedText);
  
  let bestMatch: ConditionMeta | null = null;
  let bestScore = 0;
  let bestMatchText = "";
  
  for (const condition of CONDITION_REGISTRY) {
    const conditionName = normalize(condition.condition);
    
    // Check direct similarity
    const directScore = similarityScore(normalizedContext, conditionName);
    
    // Check if condition name is contained in context
    const containsCondition = normalizedContext.includes(conditionName) ? 1.0 : 0;
    
    // Check individual words for partial matches
    let wordScore = 0;
    const conditionWords = conditionName.split(" ").filter((w) => w.length > 3);
    const contextWords = normalizedContext.split(" ");
    
    for (const condWord of conditionWords) {
      for (const ctxWord of contextWords) {
        if (ctxWord.includes(condWord) || condWord.includes(ctxWord)) {
          wordScore += 0.2;
        }
      }
    }
    
    // Check aliases if available
    let aliasScore = 0;
    if (condition.aliases) {
      for (const alias of condition.aliases) {
        const normalizedAlias = normalize(alias);
        const aliasMatch = similarityScore(normalizedContext, normalizedAlias);
        aliasScore = Math.max(aliasScore, aliasMatch);
        
        if (normalizedContext.includes(normalizedAlias)) {
          aliasScore = Math.max(aliasScore, 1.0);
        }
      }
    }
    
    // Combined score with weights
    const finalScore = Math.max(
      directScore,
      containsCondition,
      Math.min(wordScore, 0.8),
      aliasScore
    );
    
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = condition;
      bestMatchText = condition.condition;
    }
  }
  
  return { condition: bestMatch, score: bestScore, bestMatchText };
}

/**
 * Gets top N candidate matches for manual review
 */
function getTopCandidates(
  textContext: string[],
  n: number = 5
): Array<{ condition: string; score: number }> {
  const combinedText = textContext.join(" ");
  const normalizedContext = normalize(combinedText);
  
  const scores: Array<{ condition: string; score: number }> = [];
  
  for (const condition of CONDITION_REGISTRY) {
    const conditionName = normalize(condition.condition);
    const score = similarityScore(normalizedContext, conditionName);
    
    if (score > 0.3) {
      scores.push({
        condition: condition.condition,
        score: Math.round(score * 100) / 100,
      });
    }
  }
  
  // Sort by score descending and take top N
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, n);
}

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extracts images and text context from a single PPTX file
 */
async function extractFromPptx(pptxPath: string): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  const slideTexts: Map<number, string[]> = new Map();
  const mediaToSlide: Map<string, number> = new Map();
  
  const pptxName = path.basename(pptxPath);
  
  try {
    const directory = await unzipper.Open.file(pptxPath);
    
    // First pass: Extract slide text and relationship mappings
    for (const entry of directory.files) {
      const entryPath = entry.path;
      
      // Parse slide XML for text content
      if (entryPath.match(/ppt\/slides\/slide(\d+)\.xml$/)) {
        const slideNumMatch = entryPath.match(/slide(\d+)\.xml$/);
        if (slideNumMatch) {
          const slideNum = parseInt(slideNumMatch[1], 10);
          const content = await entry.buffer();
          const texts = extractTextFromSlideXml(content.toString("utf-8"));
          slideTexts.set(slideNum, texts);
        }
      }
      
      // Parse relationship files to map media to slides
      if (entryPath.match(/ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/)) {
        const slideNumMatch = entryPath.match(/slide(\d+)\.xml\.rels$/);
        if (slideNumMatch) {
          const slideNum = parseInt(slideNumMatch[1], 10);
          const content = await entry.buffer();
          const relContent = content.toString("utf-8");
          
          // Extract media references from relationships
          const mediaMatches = relContent.match(/Target="\.\.\/media\/([^"]+)"/g);
          if (mediaMatches) {
            for (const match of mediaMatches) {
              const mediaName = match.match(/Target="\.\.\/media\/([^"]+)"/)?.[1];
              if (mediaName) {
                mediaToSlide.set(mediaName, slideNum);
              }
            }
          }
        }
      }
    }
    
    // Second pass: Extract images with their context
    for (const entry of directory.files) {
      const entryPath = entry.path;
      
      // Check if this is an image in the media folder
      if (entryPath.startsWith("ppt/media/")) {
        const mediaFileName = path.basename(entryPath);
        const ext = path.extname(mediaFileName).toLowerCase();
        
        // Skip unsupported formats
        if (SKIP_EXTENSIONS.has(ext)) {
          continue;
        }
        
        if (IMAGE_EXTENSIONS.has(ext)) {
          const imageData = await entry.buffer();
          
          // Get image dimensions
          const metadata = await getImageMetadata(imageData);
          
          // Find associated slide text
          const slideNum = mediaToSlide.get(mediaFileName);
          const textContext = slideNum ? slideTexts.get(slideNum) ?? [] : [];
          
          // If no direct slide match, use all slide text as context
          const allTexts = textContext.length > 0
            ? textContext
            : Array.from(slideTexts.values()).flat();
          
          images.push({
            originalName: mediaFileName,
            sourceFile: pptxName,
            slideNumber: slideNum,
            textContext: allTexts,
            data: imageData,
            extension: ext,
            width: metadata?.width,
            height: metadata?.height,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error processing ${pptxPath}:`, error);
  }
  
  return images;
}

/**
 * Recursively finds all PPTX files in a directory
 */
function findPptxFiles(dir: string): string[] {
  const pptxFiles: string[] = [];
  
  if (!fs.existsSync(dir)) {
    console.warn(`Input directory does not exist: ${dir}`);
    return pptxFiles;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip hidden directories
      if (!entry.name.startsWith(".")) {
        pptxFiles.push(...findPptxFiles(fullPath));
      }
    } else if (entry.isFile()) {
      // Check for PPTX extension (case-insensitive)
      if (entry.name.toLowerCase().endsWith(".pptx") && !entry.name.startsWith("~$")) {
        pptxFiles.push(fullPath);
      }
    }
  }
  
  return pptxFiles;
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const inputFolder = args[0] || DEFAULT_INPUT_FOLDER;
  const outputFolder = args[1] || DEFAULT_OUTPUT_FOLDER;
  const manifestPath = args[2] || DEFAULT_MANIFEST_PATH;
  
  // Check for API key
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const useAI = !!apiKey;
  
  console.log("=".repeat(60));
  console.log("PPTX Image Extraction for Global Photo Mode");
  console.log("=".repeat(60));
  console.log(`Input folder:  ${inputFolder}`);
  console.log(`Output folder: ${outputFolder}`);
  console.log(`Manifest path: ${manifestPath}`);
  console.log(`AI Classification: ${useAI ? "ENABLED (Gemini)" : "DISABLED (using heuristics)"}`);
  if (!useAI) {
    console.log("  → Set GOOGLE_API_KEY env var to enable AI-powered image filtering");
  }
  console.log();
  
  // Ensure output directories exist
  fs.mkdirSync(outputFolder, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.mkdirSync(path.dirname(UNMATCHED_LOG_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(REJECTED_LOG_PATH), { recursive: true });
  
  // Find all PPTX files
  console.log("Step 1: Scanning for PPTX files...");
  const pptxFiles = findPptxFiles(inputFolder);
  console.log(`  Found ${pptxFiles.length} PPTX file(s)`);
  
  if (pptxFiles.length === 0) {
    console.log("\nNo PPTX files found. Please add PPTX files to the input folder.");
    console.log(`Expected location: ${path.resolve(inputFolder)}`);
    
    // Create example input folder if it doesn't exist
    if (!fs.existsSync(inputFolder)) {
      fs.mkdirSync(inputFolder, { recursive: true });
      console.log(`Created input folder: ${path.resolve(inputFolder)}`);
    }
    return;
  }
  
  // Extract images from all PPTX files
  console.log("\nStep 2: Extracting images from PPTX files...");
  const allImages: ExtractedImage[] = [];
  
  for (const pptxFile of pptxFiles) {
    console.log(`  Processing: ${path.basename(pptxFile)}`);
    const images = await extractFromPptx(pptxFile);
    console.log(`    Extracted ${images.length} image(s)`);
    allImages.push(...images);
  }
  
  console.log(`\nTotal images extracted: ${allImages.length}`);
  
  // Step 3: Filter for clinical images only
  console.log("\nStep 3: Classifying images (filtering for clinical content)...");
  const clinicalImages: Array<{ image: ExtractedImage; classification: ImageClassification }> = [];
  const rejectedImages: RejectedImage[] = [];
  
  for (let i = 0; i < allImages.length; i++) {
    const image = allImages[i];
    console.log(`  [${i + 1}/${allImages.length}] ${image.originalName}`);
    
    // Skip small images immediately
    if (image.width && image.height) {
      if (image.width < MIN_IMAGE_WIDTH || image.height < MIN_IMAGE_HEIGHT) {
        rejectedImages.push({
          fileName: image.originalName,
          source: image.sourceFile,
          reason: `Too small (${image.width}x${image.height})`,
          imageType: "other",
        });
        console.log(`    ✗ Rejected: Too small (${image.width}x${image.height})`);
        continue;
      }
    }
    
    // Classify the image
    let classification: ImageClassification;
    if (useAI) {
      classification = await classifyImageWithAI(image.data, image.textContext, apiKey);
      // Rate limit API calls
      await delay(API_DELAY_MS);
    } else {
      classification = await classifyImageHeuristic(image.data, image.textContext);
    }
    
    if (classification.isClinical) {
      clinicalImages.push({ image, classification });
      console.log(`    ✓ Clinical: ${classification.imageType} (${Math.round(classification.confidence * 100)}%)`);
    } else {
      rejectedImages.push({
        fileName: image.originalName,
        source: image.sourceFile,
        reason: classification.reason,
        imageType: classification.imageType,
      });
      console.log(`    ✗ Rejected: ${classification.reason} (${classification.imageType})`);
    }
  }
  
  console.log(`\nClinical images found: ${clinicalImages.length}`);
  console.log(`Rejected (non-clinical): ${rejectedImages.length}`);
  
  // Step 4: Match clinical images to conditions
  console.log("\nStep 4: Matching clinical images to medical conditions...");
  const conditionImageCounts: Map<string, number> = new Map();
  const manifestEntries: PhotoDrillManifestEntry[] = [];
  const unmatchedImages: UnmatchedImage[] = [];
  let unmatchedCounter = 0;
  
  for (const { image, classification } of clinicalImages) {
    // Use AI-detected condition if available, otherwise use text matching
    let condition: ConditionMeta | null = null;
    let score = 0;
    let bestMatchText = "";
    
    // First try AI-detected condition
    if (classification.detectedCondition) {
      const aiMatch = findBestConditionMatch([classification.detectedCondition]);
      if (aiMatch.score > 0.7) {
        condition = aiMatch.condition;
        score = aiMatch.score;
        bestMatchText = aiMatch.bestMatchText;
      }
    }
    
    // Fall back to text context matching
    if (!condition) {
      const textMatch = findBestConditionMatch(image.textContext);
      condition = textMatch.condition;
      score = textMatch.score;
      bestMatchText = textMatch.bestMatchText;
    }
    
    if (condition && score >= MATCH_THRESHOLD) {
      // Create condition-linked filename
      const conditionId = createConditionId(condition.condition);
      const currentCount = (conditionImageCounts.get(conditionId) || 0) + 1;
      conditionImageCounts.set(conditionId, currentCount);
      
      // Always output as .jpg since we process images
      const fileName = createImageFilename(conditionId, currentCount, ".jpg");
      const id = `${conditionId}--${String(currentCount).padStart(3, "0")}`;
      
      // Determine modality from classification or condition
      let modality = determineModality(condition.system, condition.subcategory);
      if (classification.imageType === "ecg") modality = "ecg";
      else if (classification.imageType === "xray" || classification.imageType === "ct" || classification.imageType === "mri") modality = "xray";
      else if (classification.imageType === "dermoscopy" || classification.imageType === "physical_exam") {
        if (condition.system === "DERM") modality = "derm";
      }
      
      // Create manifest entry with all data needed for photo drill
      const manifestEntry: PhotoDrillManifestEntry = {
        id,
        fileName,
        imageUrl: `/assets/pptx_images/${fileName}`,
        condition: condition.condition,
        system: condition.system,
        subcategory: condition.subcategory,
        modality,
        distractors: generateDistractors(condition),
        caption: generateCaption(condition, image.textContext),
        confidence: Math.round(score * 100) / 100,
        source: image.sourceFile,
        imageType: classification.imageType,
      };
      
      manifestEntries.push(manifestEntry);
      
      // Process and save the image
      try {
        const processedImage = await processImage(image.data, classification.suggestedCrop);
        const outputPath = path.join(outputFolder, fileName);
        fs.writeFileSync(outputPath, processedImage);
        console.log(`  ✓ ${image.originalName} → ${fileName} (${condition.condition})`);
      } catch (err) {
        console.log(`  ⚠ ${image.originalName} → Failed to process, saving original`);
        const outputPath = path.join(outputFolder, fileName.replace(".jpg", image.extension));
        fs.writeFileSync(outputPath, image.data);
      }
    } else {
      // Add to unmatched list for manual review
      unmatchedCounter++;
      const candidates = getTopCandidates(image.textContext);
      const fileName = `unmatched--${String(unmatchedCounter).padStart(3, "0")}.jpg`;
      
      unmatchedImages.push({
        fileName,
        source: image.sourceFile,
        context: image.textContext.slice(0, 10),
        candidates,
      });
      
      // Process and save the unmatched image for potential manual matching
      try {
        const processedImage = await processImage(image.data);
        const outputPath = path.join(outputFolder, "unmatched", fileName);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, processedImage);
      } catch {
        const outputPath = path.join(outputFolder, "unmatched", fileName.replace(".jpg", image.extension));
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, image.data);
      }
      
      console.log(`  ✗ ${image.originalName} → unmatched/${fileName} (best: ${bestMatchText || "N/A"})`);
    }
  }
  
  // Write manifest
  console.log("\nStep 5: Writing output files...");
  fs.writeFileSync(manifestPath, JSON.stringify(manifestEntries, null, 2));
  console.log(`  ✓ Manifest: ${manifestPath}`);
  
  // Write unmatched log if there are any
  if (unmatchedImages.length > 0) {
    fs.writeFileSync(UNMATCHED_LOG_PATH, JSON.stringify(unmatchedImages, null, 2));
    console.log(`  ✓ Unmatched log: ${UNMATCHED_LOG_PATH}`);
  }
  
  // Write rejected log
  if (rejectedImages.length > 0) {
    fs.writeFileSync(REJECTED_LOG_PATH, JSON.stringify(rejectedImages, null, 2));
    console.log(`  ✓ Rejected log: ${REJECTED_LOG_PATH}`);
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total PPTX files processed:    ${pptxFiles.length}`);
  console.log(`Total images extracted:        ${allImages.length}`);
  console.log(`Clinical images identified:    ${clinicalImages.length}`);
  console.log(`Non-clinical (rejected):       ${rejectedImages.length}`);
  console.log(`Successfully matched:          ${manifestEntries.length}`);
  console.log(`Unmatched (needs review):      ${unmatchedImages.length}`);
  console.log(`Unique conditions with images: ${conditionImageCounts.size}`);
  
  // Show conditions with multiple images
  const multiImageConditions = Array.from(conditionImageCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
  
  if (multiImageConditions.length > 0) {
    console.log("\nConditions with multiple images:");
    for (const [conditionId, count] of multiImageConditions.slice(0, 10)) {
      console.log(`  ${conditionId}: ${count} images`);
    }
    if (multiImageConditions.length > 10) {
      console.log(`  ... and ${multiImageConditions.length - 10} more`);
    }
  }
  
  if (unmatchedImages.length > 0) {
    console.log(`\nReview unmatched images at: ${outputFolder}/unmatched/`);
    console.log(`Candidates listed in: ${UNMATCHED_LOG_PATH}`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("HOW TO USE WITH GLOBAL PHOTO MODE");
  console.log("=".repeat(60));
  console.log(`\n1. Images are saved to: ${outputFolder}/`);
  console.log(`   Naming format: {condition_id}--{index}.jpg`);
  console.log(`   Example: atrial_fibrillation--001.jpg, atrial_fibrillation--002.jpg`);
  console.log(`\n2. Manifest saved to: ${manifestPath}`);
  console.log(`   Contains: condition, distractors, modality, caption, imageType`);
  console.log(`\n3. Load manifest in your photo drill hook to use images`);
  console.log(`   Each entry has an imageUrl ready for the PhotoCase interface`);
  console.log(`\n4. Multiple images per condition are supported for variety`);
  
  console.log("\nDone!");
}

// Run the script
main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
