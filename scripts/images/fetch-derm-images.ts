#!/usr/bin/env npx tsx
/**
 * Dermatology Image Fetcher - Specialized Script
 * 
 * Fetches dermatology/clinical photos from Wikimedia Commons for PA student training.
 * 
 * Derm Adequacy Criteria:
 * - Must be actual clinical photo (not diagram/illustration)
 * - Good lighting and focus
 * - Lesion clearly visible and in focus
 * - No identifiable patient features (privacy)
 * - Appropriate scale reference if relevant
 * - Minimal annotations
 * 
 * Usage:
 *   npx tsx scripts/images/fetch-derm-images.ts
 *   npx tsx scripts/images/fetch-derm-images.ts --dry-run
 *   npx tsx scripts/images/fetch-derm-images.ts --category=infectious
 *   npx tsx scripts/images/fetch-derm-images.ts --condition="psoriasis"
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import * as https from 'https';
import 'dotenv/config';

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_BUCKET = 'medical-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '').trim();

// Initialize Gemini SDK
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Rate limiting configuration
const RATE_LIMIT = {
  minDelayMs: 1500,
  maxDelayMs: 3000,
  rateLimitBackoffMs: 30000,
  searchDelayMs: 1000
};

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for Gemini

async function rateLimitedDelay(isRateLimited = false): Promise<void> {
  const delay = isRateLimited 
    ? RATE_LIMIT.rateLimitBackoffMs 
    : Math.random() * (RATE_LIMIT.maxDelayMs - RATE_LIMIT.minDelayMs) + RATE_LIMIT.minDelayMs;
  await new Promise(r => setTimeout(r, delay));
}

// ============================================================================
// DERMATOLOGY CONDITIONS - High-yield for PANCE
// ============================================================================

interface DermCondition {
  conditionId: string;
  name: string;
  category: 'infectious' | 'inflammatory' | 'neoplastic' | 'autoimmune' | 'other';
  searchTerms: string[];
  correctDiagnosis: string;
  distractors: string[];
  visualFindings: string;
  clinicalContext: string;
  targetImageCount: number;
}

const DERM_CONDITIONS: DermCondition[] = [
  // =========== INFECTIOUS ===========
  {
    conditionId: 'ID__viral__herpes_zoster_shingles',
    name: 'Herpes Zoster (Shingles)',
    category: 'infectious',
    searchTerms: ['herpes zoster skin', 'shingles rash', 'dermatomal vesicles', 'zoster dermatome'],
    correctDiagnosis: 'Herpes Zoster',
    distractors: ['Herpes Simplex', 'Contact Dermatitis', 'Impetigo'],
    visualFindings: 'Grouped vesicles on erythematous base, dermatomal distribution, does NOT cross midline',
    clinicalContext: 'VZV reactivation. Antivirals within 72 hours. Postherpetic neuralgia risk. Shingrix vaccine prevention.',
    targetImageCount: 12
  },
  {
    conditionId: 'ID__bacterial__impetigo',
    name: 'Impetigo',
    category: 'infectious',
    searchTerms: ['impetigo skin', 'honey crusted lesions', 'bacterial skin infection children', 'impetigo bullous'],
    correctDiagnosis: 'Impetigo',
    distractors: ['Herpes Simplex', 'Contact Dermatitis', 'Eczema'],
    visualFindings: 'Honey-colored crusts, superficial erosions, perioral/perinasal distribution common',
    clinicalContext: 'S. aureus or Strep pyogenes. Topical mupirocin for limited. Oral antibiotics if extensive.',
    targetImageCount: 10
  },
  {
    conditionId: 'ID__bacterial__cellulitis_erysipelas',
    name: 'Cellulitis',
    category: 'infectious',
    searchTerms: ['cellulitis skin infection', 'erysipelas', 'bacterial skin infection spreading', 'leg cellulitis'],
    correctDiagnosis: 'Cellulitis',
    distractors: ['DVT', 'Contact Dermatitis', 'Stasis Dermatitis'],
    visualFindings: 'Spreading erythema, warmth, swelling, poorly defined borders, may have lymphangitic streaking',
    clinicalContext: 'S. aureus, Strep. Antibiotics covering gram-positives. Elevate extremity. Mark borders.',
    targetImageCount: 12
  },
  {
    conditionId: 'ID__fungal__tinea_infections',
    name: 'Tinea Corporis (Ringworm)',
    category: 'infectious',
    searchTerms: ['tinea corporis', 'ringworm skin', 'dermatophyte infection', 'tinea annular'],
    correctDiagnosis: 'Tinea Corporis',
    distractors: ['Nummular Eczema', 'Psoriasis', 'Granuloma Annulare'],
    visualFindings: 'Annular scaly plaque with raised erythematous border and central clearing',
    clinicalContext: 'Dermatophyte fungal infection. KOH prep shows hyphae. Topical antifungals. Oral if extensive.',
    targetImageCount: 10
  },
  {
    conditionId: 'DERM__infectious__molluscum_contagiosum',
    name: 'Molluscum Contagiosum',
    category: 'infectious',
    searchTerms: ['molluscum contagiosum', 'umbilicated papules', 'viral skin infection children', 'molluscum skin'],
    correctDiagnosis: 'Molluscum Contagiosum',
    distractors: ['Warts', 'Milia', 'Closed Comedones'],
    visualFindings: 'Dome-shaped pearly papules with central umbilication (dell)',
    clinicalContext: 'Poxvirus. Self-limited in immunocompetent. Cryotherapy or curettage if desired.',
    targetImageCount: 10
  },
  {
    conditionId: 'ID__parasitic__scabies_parasitic',
    name: 'Scabies',
    category: 'infectious',
    searchTerms: ['scabies rash', 'scabies burrows', 'sarcoptes scabiei', 'scabies web spaces'],
    correctDiagnosis: 'Scabies',
    distractors: ['Atopic Dermatitis', 'Contact Dermatitis', 'Folliculitis'],
    visualFindings: 'Linear burrows, papules/vesicles in web spaces, wrists, genitalia, intense nocturnal pruritus',
    clinicalContext: 'Sarcoptes scabiei mite. Permethrin 5% cream. Treat all close contacts. Wash bedding/clothing.',
    targetImageCount: 10
  },
  // =========== INFLAMMATORY ===========
  {
    conditionId: 'DERM__papulosquamous__guttate_psoriasis',
    name: 'Psoriasis',
    category: 'inflammatory',
    searchTerms: ['psoriasis plaque', 'psoriatic lesions', 'silvery scale psoriasis', 'psoriasis extensor'],
    correctDiagnosis: 'Plaque Psoriasis',
    distractors: ['Eczema', 'Seborrheic Dermatitis', 'Tinea'],
    visualFindings: 'Well-demarcated erythematous plaques with silvery scale, Auspitz sign, extensor surfaces/scalp',
    clinicalContext: 'Chronic autoimmune. Topical steroids/Vitamin D for mild. Biologics for moderate-severe.',
    targetImageCount: 15
  },
  {
    conditionId: 'DERM__dermatitis__eczema__dyshidrotic_eczema_pompholyx',
    name: 'Atopic Dermatitis (Eczema)',
    category: 'inflammatory',
    searchTerms: ['atopic dermatitis', 'eczema rash', 'flexural dermatitis', 'eczema antecubital'],
    correctDiagnosis: 'Atopic Dermatitis',
    distractors: ['Contact Dermatitis', 'Psoriasis', 'Scabies'],
    visualFindings: 'Ill-defined erythema, scaling, lichenification, flexural distribution in adults, face in infants',
    clinicalContext: 'Atopic triad (eczema, asthma, allergic rhinitis). Moisturize, topical steroids. Dupilumab for severe.',
    targetImageCount: 15
  },
  {
    conditionId: 'DERM__dermatitis__eczema__contact_dermatitis_irritantallergic',
    name: 'Contact Dermatitis',
    category: 'inflammatory',
    searchTerms: ['contact dermatitis', 'allergic contact dermatitis', 'poison ivy rash', 'nickel dermatitis'],
    correctDiagnosis: 'Contact Dermatitis',
    distractors: ['Atopic Dermatitis', 'Cellulitis', 'Herpes Zoster'],
    visualFindings: 'Linear or geometric erythema/vesicles conforming to area of contact, may be weeping',
    clinicalContext: 'Identify and remove allergen/irritant. Topical steroids. Oral steroids if severe/extensive.',
    targetImageCount: 12
  },
  {
    conditionId: 'DERM__papulosquamous__lichen_simplex_chronicus',
    name: 'Seborrheic Dermatitis',
    category: 'inflammatory',
    searchTerms: ['seborrheic dermatitis', 'dandruff', 'seborrheic scalp', 'seborrheic nasolabial'],
    correctDiagnosis: 'Seborrheic Dermatitis',
    distractors: ['Psoriasis', 'Tinea Capitis', 'Atopic Dermatitis'],
    visualFindings: 'Greasy yellowish scales on erythematous base, nasolabial folds, scalp, eyebrows',
    clinicalContext: 'Associated with Malassezia yeast. Ketoconazole shampoo/cream. May flare with stress, HIV.',
    targetImageCount: 10
  },
  {
    conditionId: 'DERM__acneiform__acne_vulgaris',
    name: 'Rosacea',
    category: 'inflammatory',
    searchTerms: ['rosacea face', 'acne rosacea', 'facial erythema telangiectasia', 'rhinophyma'],
    correctDiagnosis: 'Rosacea',
    distractors: ['Acne Vulgaris', 'Lupus', 'Seborrheic Dermatitis'],
    visualFindings: 'Central facial erythema, telangiectasias, papules/pustules (no comedones), rhinophyma in severe',
    clinicalContext: 'Triggers: sun, alcohol, spicy food. Metronidazole gel, brimonidine for erythema. Oral doxycycline.',
    targetImageCount: 12
  },
  // =========== NEOPLASTIC ===========
  {
    conditionId: 'DERM__benign_lesions__atypical_dysplastic_nevus',
    name: 'Melanoma',
    category: 'neoplastic',
    searchTerms: ['melanoma skin cancer', 'malignant melanoma', 'atypical mole melanoma', 'melanoma ABCDE'],
    correctDiagnosis: 'Melanoma',
    distractors: ['Dysplastic Nevus', 'Seborrheic Keratosis', 'Pigmented BCC'],
    visualFindings: 'ABCDE: Asymmetry, Border irregularity, Color variation, Diameter >6mm, Evolution/change',
    clinicalContext: 'Most deadly skin cancer. Wide excision. Sentinel node biopsy for staging. Immunotherapy for advanced.',
    targetImageCount: 15
  },
  {
    conditionId: 'DERM__benign_lesions__common_melanocytic_nevus',
    name: 'Basal Cell Carcinoma',
    category: 'neoplastic',
    searchTerms: ['basal cell carcinoma', 'BCC skin cancer', 'pearly papule telangiectasia', 'rodent ulcer'],
    correctDiagnosis: 'Basal Cell Carcinoma',
    distractors: ['Squamous Cell Carcinoma', 'Sebaceous Hyperplasia', 'Intradermal Nevus'],
    visualFindings: 'Pearly/translucent papule with telangiectasias, rolled borders, central ulceration ("rodent ulcer")',
    clinicalContext: 'Most common skin cancer. Rarely metastasizes. Surgical excision, Mohs for high-risk areas.',
    targetImageCount: 15
  },
  {
    conditionId: 'HEENT__oncology__head__neck__oral_cavity_squamous_cell_carcinoma',
    name: 'Squamous Cell Carcinoma',
    category: 'neoplastic',
    searchTerms: ['squamous cell carcinoma skin', 'SCC cutaneous', 'keratinizing skin tumor', 'SCC skin cancer'],
    correctDiagnosis: 'Squamous Cell Carcinoma',
    distractors: ['Keratoacanthoma', 'Basal Cell Carcinoma', 'Actinic Keratosis'],
    visualFindings: 'Firm erythematous scaly plaque or nodule, may ulcerate, keratinaceous crust',
    clinicalContext: 'Second most common skin cancer. Can metastasize. Surgical excision. From actinic keratoses.',
    targetImageCount: 12
  },
  {
    conditionId: 'DERM__benign_lesions__dermatofibroma',
    name: 'Actinic Keratosis',
    category: 'neoplastic',
    searchTerms: ['actinic keratosis', 'solar keratosis', 'precancerous skin lesion', 'actinic keratosis face'],
    correctDiagnosis: 'Actinic Keratosis',
    distractors: ['Seborrheic Keratosis', 'SCC', 'Psoriasis'],
    visualFindings: 'Rough, scaly, erythematous macule/papule on sun-exposed skin, sandpaper texture',
    clinicalContext: 'Precancerous - can progress to SCC. Cryotherapy, topical 5-FU or imiquimod, photodynamic therapy.',
    targetImageCount: 12
  },
  // =========== AUTOIMMUNE ===========
  {
    conditionId: 'DERM__pigmentary__postinflammatory_hyperpigmentation__hypopigmentation',
    name: 'Vitiligo',
    category: 'autoimmune',
    searchTerms: ['vitiligo skin', 'depigmented patches', 'white patches autoimmune', 'vitiligo hands face'],
    correctDiagnosis: 'Vitiligo',
    distractors: ['Tinea Versicolor', 'Post-inflammatory Hypopigmentation', 'Pityriasis Alba'],
    visualFindings: 'Well-demarcated depigmented (chalk-white) macules/patches, often symmetric',
    clinicalContext: 'Autoimmune destruction of melanocytes. Associated with thyroid disease. Topical steroids, phototherapy.',
    targetImageCount: 10
  },
  {
    conditionId: 'DERM__connective_tissue__lupus__discoid_lupus_erythematosus',
    name: 'Discoid Lupus / Malar Rash',
    category: 'autoimmune',
    searchTerms: ['lupus butterfly rash', 'malar rash lupus', 'discoid lupus skin', 'SLE rash'],
    correctDiagnosis: 'Cutaneous Lupus',
    distractors: ['Rosacea', 'Seborrheic Dermatitis', 'Contact Dermatitis'],
    visualFindings: 'Butterfly/malar rash sparing nasolabial folds (SLE), or discoid scarring plaques',
    clinicalContext: 'SLE or isolated cutaneous lupus. ANA, anti-dsDNA for SLE. Sun protection essential.',
    targetImageCount: 12
  },
  // =========== OTHER ===========
  {
    conditionId: 'DERM__reactive__hypersensitivity__urticaria',
    name: 'Urticaria (Hives)',
    category: 'other',
    searchTerms: ['urticaria hives', 'wheals allergic reaction', 'raised itchy welts', 'hives skin'],
    correctDiagnosis: 'Urticaria',
    distractors: ['Erythema Multiforme', 'Cellulitis', 'Insect Bites'],
    visualFindings: 'Erythematous, edematous wheals with central pallor, transient (<24h), dermographism',
    clinicalContext: 'IgE-mediated. Antihistamines. If anaphylaxis: epinephrine. Chronic urticaria workup if >6 weeks.',
    targetImageCount: 12
  },
  {
    conditionId: 'DERM__reactive__hypersensitivity__henochschnlein_purpura_iga_vasculitis__cutaneous_findings',
    name: 'Erythema Multiforme',
    category: 'other',
    searchTerms: ['erythema multiforme', 'target lesions skin', 'iris lesions', 'erythema multiforme hands'],
    correctDiagnosis: 'Erythema Multiforme',
    distractors: ['Urticaria', 'Stevens-Johnson Syndrome', 'Drug Eruption'],
    visualFindings: 'Target/iris lesions with 3 zones (dark center, pale ring, red outer ring), acral distribution',
    clinicalContext: 'Often triggered by HSV. Self-limited EM minor. SJS/TEN are severe spectrum - different entity.',
    targetImageCount: 10
  },
  {
    conditionId: 'DERM__drug_eruptions__scars__stevensjohnson_syndrome_sjs',
    name: 'Stevens-Johnson Syndrome',
    category: 'other',
    searchTerms: ['Stevens Johnson syndrome', 'SJS skin', 'toxic epidermal necrolysis', 'SJS mucosal'],
    correctDiagnosis: 'Stevens-Johnson Syndrome',
    distractors: ['Erythema Multiforme', 'Drug Rash', 'Viral Exanthem'],
    visualFindings: 'Targetoid lesions with epidermal detachment, mucosal involvement (2+ sites), <10% BSA detachment',
    clinicalContext: 'Drug-induced usually (sulfa, anticonvulsants, allopurinol). Stop culprit drug. Burn unit for TEN (>30%).',
    targetImageCount: 10
  }
];

// ============================================================================
// API & HELPERS
// ============================================================================

async function searchWikimediaImages(searchTerm: string, limit: number = 10): Promise<any[]> {
  const baseUrl = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: `${searchTerm} filetype:bitmap`,
    gsrlimit: limit.toString(), gsrnamespace: '6', prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1200', format: 'json', origin: '*'
  });

  const url = `${baseUrl}?${params.toString()}`;
  const options = {
    headers: {
      'User-Agent': 'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js'
    }
  };

  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages || {};
          resolve(Object.values(pages).map((page: any) => ({
            title: page.title,
            url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
            originalUrl: page.imageinfo?.[0]?.url,
            mime: page.imageinfo?.[0]?.mime,
            source: 'wikimedia'
          })));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Search DermNet NZ-style images (via Wikimedia's medical image category)
async function searchDermDatabases(searchTerm: string, limit: number = 5): Promise<any[]> {
  // Search Wikimedia's medical/dermatology categories
  const baseUrl = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchTerm} dermatology skin lesion clinical photo filetype:bitmap`,
    gsrlimit: limit.toString(),
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*'
  });

  const url = `${baseUrl}?${params.toString()}`;
  const options = {
    headers: {
      'User-Agent': 'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js'
    }
  };

  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages || {};
          resolve(Object.values(pages).map((page: any) => ({
            title: page.title,
            url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
            originalUrl: page.imageinfo?.[0]?.url,
            mime: page.imageinfo?.[0]?.mime,
            source: 'derm-category'
          })));
        } catch (e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

// Combined search from all sources
async function searchAllSources(searchTerm: string, limit: number = 10): Promise<any[]> {
  const wikimediaLimit = Math.ceil(limit * 0.6);
  const dermLimit = Math.ceil(limit * 0.4);
  
  const [wikimediaResults, dermResults] = await Promise.all([
    searchWikimediaImages(searchTerm, wikimediaLimit),
    searchDermDatabases(searchTerm, dermLimit)
  ]);
  
  // Combine and deduplicate
  const allResults = [...wikimediaResults, ...dermResults];
  const seen = new Set<string>();
  return allResults.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ============================================================================
// PRE-FILTERING - Skip obviously irrelevant images before AI analysis
// ============================================================================

const DERM_EXCLUSION_KEYWORDS = [
  'room', 'equipment', 'machine', 'hospital', 'clinic', 'building',
  'doctor', 'nurse', 'technician', 'portrait', 'headshot',
  'diagram', 'illustration', 'drawing', 'cartoon', 'icon', 'logo',
  'infographic', 'chart', 'graph', 'table', 'microscop', 'histolog',
  'cell', 'biopsy', 'pathology slide', 'hematoxylin', 'eosin',
  'x-ray', 'xray', 'radiograph', 'ct scan', 'mri', 'ultrasound'
];

const DERM_INCLUSION_KEYWORDS = [
  'skin', 'lesion', 'rash', 'dermat', 'cutaneous', 'eruption',
  'vesicle', 'papule', 'plaque', 'nodule', 'macule', 'pustule',
  'erythema', 'scaling', 'crusting', 'clinical', 'patient'
];

function preFilterDermResult(result: any): { pass: boolean; reason?: string } {
  const title = (result.title || '').toLowerCase();
  const description = (result.description || '').toLowerCase();
  const combined = `${title} ${description}`;
  
  // Check exclusion keywords
  for (const keyword of DERM_EXCLUSION_KEYWORDS) {
    if (combined.includes(keyword)) {
      return { pass: false, reason: `Contains "${keyword}"` };
    }
  }
  
  return { pass: true };
}

interface DermAnalysis {
  isValidClinicalPhoto: boolean;
  isActualPhoto: boolean;
  lesionVisible: boolean;
  goodQuality: boolean;
  privacyConcern: boolean;
  annotationLevel: 'none' | 'minimal' | 'moderate' | 'heavy';
  qualityScore: number;
  detectedCondition: string;
  matchesCondition: boolean;
  confidence: number;
  rejectReason?: string;
  accept: boolean;
}

async function analyzeDermImage(imageUrl: string, condition: DermCondition, retryCount = 0): Promise<DermAnalysis | null> {
  if (!genAI) {
    console.log('⚠️ No Gemini API key - skipping AI verification');
    return null;
  }

  try {
    const imageBuffer = await fetchImageAsBuffer(imageUrl);
    
    // Skip images that are too large
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      console.log(`  ⏭️ Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }
    
    // Check magic bytes
    const magicBytes = imageBuffer.slice(0, 4).toString('hex');
    const isJpeg = magicBytes.startsWith('ffd8');
    const isPng = magicBytes === '89504e47';
    if (!isJpeg && !isPng) {
      console.log(`  ⏭️ Not a valid JPEG/PNG image`);
      return null;
    }
    
    const base64Image = imageBuffer.toString('base64');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

    const prompt = `You are an expert dermatologist evaluating clinical photos for PA student training.

Expected condition: ${condition.correctDiagnosis}
Expected findings: ${condition.visualFindings}

Evaluate and respond in JSON:
{
  "isValidClinicalPhoto": boolean,
  "isActualPhoto": boolean,
  "lesionVisible": boolean,
  "goodQuality": boolean,
  "privacyConcern": boolean,
  "annotationLevel": "none|minimal|moderate|heavy",
  "qualityScore": number,
  "detectedCondition": string,
  "matchesCondition": boolean,
  "confidence": number,
  "rejectReason": string|null,
  "accept": boolean
}

STRICT CRITERIA:
- MUST be actual clinical photo (not illustration/diagram)
- Lesion must be clearly visible and in focus
- NO identifiable patient faces (privacyConcern = true = reject)
- qualityScore >= 6
- annotationLevel must be "none" or "minimal"

Respond ONLY with valid JSON.`;

    // Use SDK with gemini-2.5-flash
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: { temperature: 0.2 }
    });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image
        }
      }
    ]);

    const text = result.response.text();
    if (!text) return null;
    
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Handle rate limiting with backoff
    if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('quota')) {
      console.log(`  ⚠️ Rate limited! Waiting ${RATE_LIMIT.rateLimitBackoffMs / 1000}s...`);
      await rateLimitedDelay(true);
      if (retryCount < 2) {
        return analyzeDermImage(imageUrl, condition, retryCount + 1);
      }
    }
    
    // Retry once on transient errors
    if (retryCount < 1 && errorMsg.includes('400')) {
      console.log(`  ⚠️ Retrying after error...`);
      await new Promise(r => setTimeout(r, 2000));
      return analyzeDermImage(imageUrl, condition, retryCount + 1);
    }
    
    console.log(`  Analysis error: ${error}`);
    return null;
  }
}

function fetchImageAsBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js'
      }
    };
    protocol.get(options, (res: any) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchImageAsBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function uploadToSupabase(buffer: Buffer, filename: string): Promise<string> {
  const storagePath = `derm/${filename}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function checkDuplicate(conditionId: string, originalUrl: string): Promise<boolean> {
  return !!(await prisma.mediaAsset.findFirst({ where: { OR: [{ conditionId, sourceUrl: originalUrl }, { originalUrl }] } }));
}

async function saveMediaAsset(conditionId: string, publicUrl: string, originalUrl: string, condition: DermCondition, analysis: DermAnalysis): Promise<void> {
  await prisma.mediaAsset.create({
    data: {
      id: crypto.randomUUID(),
      conditionId,
      type: 'derm',
      filename: `derm_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`,
      originalUrl: publicUrl,
      sourceUrl: originalUrl,
      tags: ['derm', condition.category, condition.name.toLowerCase()],
      description: condition.clinicalContext,
      altText: `Clinical photo showing ${condition.correctDiagnosis}`,
      confidence: analysis.confidence,
      qualityScore: analysis.qualityScore,
      aiMetadata: { detectedCondition: analysis.detectedCondition, qualityScore: analysis.qualityScore, lesionVisible: analysis.lesionVisible },
      status: 'approved',
      approvalStatus: 'approved',
      modality: 'derm',
      explanation: condition.visualFindings,
      correctDiagnosis: condition.correctDiagnosis,
      distractors: condition.distractors,
      difficulty: 'medium',
      isClinical: true,
      updatedAt: new Date()
    }
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function processCondition(condition: DermCondition, dryRun: boolean): Promise<{ fetched: number; saved: number; errors: number }> {
  const stats = { fetched: 0, saved: 0, errors: 0 };
  console.log(`\n🔬 Processing: ${condition.name} (${condition.category}) - target: ${condition.targetImageCount} images`);
  
  const existingCount = await prisma.mediaAsset.count({ where: { conditionId: condition.conditionId, type: 'derm' } });
  if (existingCount >= condition.targetImageCount) { 
    console.log(`  ✓ Already have ${existingCount} images, skipping`); 
    return stats; 
  }
  
  const targetCount = condition.targetImageCount - existingCount;
  console.log(`  Need ${targetCount} more images (have ${existingCount})`);
  
  // Fetch more results per search for higher targets
  const resultsPerSearch = Math.min(20, Math.ceil(targetCount / condition.searchTerms.length) + 5);
  
  for (const searchTerm of condition.searchTerms) {
    if (stats.saved >= targetCount) break;
    console.log(`  🔍 Searching: "${searchTerm}" (fetching up to ${resultsPerSearch})`);
    
    try {
      // Use combined sources
      const results = await searchAllSources(searchTerm, resultsPerSearch);
      stats.fetched += results.length;
      console.log(`    Found ${results.length} results from all sources`);
      
      for (const result of results) {
        if (stats.saved >= targetCount || !result.url) break;
        
        // Skip unsupported formats
        const urlLower = result.url.toLowerCase();
        if (urlLower.includes('.svg') || urlLower.includes('.gif') || urlLower.includes('.webp') || urlLower.includes('.tiff')) {
          console.log(`    ⏭️ Skipping unsupported format: ${result.title?.substring(0, 40)}`);
          continue;
        }
        
        if (result.mime && !['image/jpeg', 'image/png', 'image/jpg'].includes(result.mime)) {
          console.log(`    ⏭️ Skipping unsupported mime: ${result.mime}`);
          continue;
        }
        
        if (await checkDuplicate(condition.conditionId, result.originalUrl || result.url)) {
          console.log(`    ⏭️ Duplicate: ${result.title?.substring(0, 40)}`);
          continue;
        }
        
        // Pre-filter based on title/description before expensive AI call
        const preFilter = preFilterDermResult(result);
        if (!preFilter.pass) {
          console.log(`    ⏭️ Pre-filtered: ${preFilter.reason} - ${result.title?.substring(0, 35)}`);
          continue;
        }
        
        console.log(`    🤖 Analyzing: ${result.title?.substring(0, 40)}...`);
        const analysis = await analyzeDermImage(result.url, condition);
        
        if (!analysis?.accept) { 
          console.log(`    ❌ Rejected: ${analysis?.rejectReason || 'Not suitable'}`); 
          continue; 
        }
        
        if (dryRun) { 
          console.log(`    ✅ Would save: ${analysis.detectedCondition} (Q${analysis.qualityScore})`); 
          stats.saved++; 
          continue; 
        }
        
        try {
          const buffer = await fetchImageAsBuffer(result.url);
          const filename = `derm_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;
          const publicUrl = await uploadToSupabase(buffer, filename);
          await saveMediaAsset(condition.conditionId, publicUrl, result.originalUrl || result.url, condition, analysis);
          console.log(`    ✅ Saved: ${analysis.detectedCondition} (Q${analysis.qualityScore})`);
          stats.saved++;
        } catch (e) { 
          console.log(`    ⚠️ Upload error: ${e}`); 
          stats.errors++; 
        }
        
        // Rate limit between API calls
        await rateLimitedDelay();
      }
    } catch (e) { 
      console.log(`    ⚠️ Search error: ${e}`); 
      stats.errors++; 
    }
    
    // Rate limit between searches
    await new Promise(r => setTimeout(r, RATE_LIMIT.searchDelayMs));
  }
  return stats;
}

async function main() {
  console.log('🩺 Dermatology Image Fetcher for PA Student Training\n' + '='.repeat(60));
  
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1]?.toLowerCase();
  const conditionFilter = args.find(a => a.startsWith('--condition='))?.split('=')[1]?.toLowerCase();
  
  if (dryRun) console.log('🔍 DRY RUN MODE\n');
  
  let conditions = DERM_CONDITIONS;
  if (categoryFilter) conditions = conditions.filter(c => c.category === categoryFilter);
  if (conditionFilter) conditions = conditions.filter(c => c.name.toLowerCase().includes(conditionFilter));
  
  // Calculate total target images
  const totalTargetImages = conditions.reduce((sum, c) => sum + c.targetImageCount, 0);
  
  console.log(`Processing ${conditions.length} conditions (${totalTargetImages} target images)...\n`);
  
  // Verify condition IDs exist in database
  console.log('🔍 Verifying condition IDs in database...');
  const dbConditions = await prisma.condition.findMany({
    select: { id: true }
  });
  const dbConditionIds = new Set(dbConditions.map(c => c.id));
  
  const missingConditions = conditions.filter(c => !dbConditionIds.has(c.conditionId));
  if (missingConditions.length > 0) {
    console.log(`⚠️ ${missingConditions.length} condition IDs not found in database:`);
    missingConditions.forEach(c => console.log(`   - ${c.conditionId} (${c.name})`));
  }
  
  const validConditions = conditions.filter(c => dbConditionIds.has(c.conditionId));
  console.log(`✓ ${validConditions.length} conditions verified\n`);
  
  const totals = { fetched: 0, saved: 0, errors: 0 };
  for (const condition of validConditions) {
    const stats = await processCondition(condition, dryRun);
    totals.fetched += stats.fetched; 
    totals.saved += stats.saved; 
    totals.errors += stats.errors;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 DERM FETCH SUMMARY');
  console.log('='.repeat(60));
  console.log(`Conditions: ${validConditions.length}/${conditions.length}`);
  console.log(`Target images: ${validConditions.reduce((sum, c) => sum + c.targetImageCount, 0)}`);
  console.log(`Fetched: ${totals.fetched} | Saved: ${totals.saved} | Errors: ${totals.errors}`);
  
  if (missingConditions.length > 0) {
    console.log(`\n⚠️ Missing condition IDs: ${missingConditions.map(c => c.conditionId).join(', ')}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
