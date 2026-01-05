/**
 * Media Drill Question API Endpoint
 * 
 * Returns approved media assets (ECG, X-ray, Derm photos) as drill questions.
 * Uses database-first architecture - queries MediaAsset table for real clinical images.
 * 
 * Query Parameters:
 * - modality: 'ecg' | 'derm' | 'radiology' (optional, defaults to all)
 * - count: number of questions to return (optional, defaults to 20)
 * 
 * Response: PhotoCase[]
 * 
 * @example
 * GET /api/drills/media?modality=ecg&count=10
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { CloudflareContext } from '../_shared/types';

// ============================================================================
// TYPES
// ============================================================================

interface Env {
  DATABASE_URL: string;
}

// ============================================================================
// TYPE DEFINITIONS (match use-photo-drill.ts interface)
// ============================================================================

export interface PhotoCase {
  id: string;
  imageUrl: string;
  modality: 'ecg' | 'xray' | 'derm';
  correctDiagnosis: string;
  distractors: string[];
  explanation: string;
  clinicalContext?: ClinicalContext;
}

export interface ClinicalContext {
  age: number;
  sex: 'M' | 'F';
  chiefComplaint: string;
  vitals: string;
  history: string;
  additionalFindings?: string[];
}

type ModalityType = 'ecg' | 'derm' | 'radiology';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database type field to frontend modality enum
 */
function mapTypeToModality(type: string): 'ecg' | 'xray' | 'derm' {
  const normalized = type.toLowerCase();
  if (normalized === 'ekg' || normalized === 'ecg') return 'ecg';
  if (normalized === 'imaging' || normalized === 'xray') return 'xray';
  if (normalized === 'photo' || normalized === 'derm') return 'derm';
  
  // Default fallback
  return 'xray';
}

/**
 * Validate that an asset has required quiz fields
 */
function hasRequiredQuizFields(asset: any): boolean {
  return !!(
    asset.correctDiagnosis &&
    asset.distractors &&
    Array.isArray(asset.distractors) &&
    asset.distractors.length >= 3
  );
}

/**
 * Generate default clinical context if missing
 */
function generateDefaultContext(diagnosis: string): ClinicalContext {
  return {
    age: 45,
    sex: Math.random() > 0.5 ? 'M' : 'F',
    chiefComplaint: `Evaluation for ${diagnosis}`,
    vitals: 'BP 120/80, HR 72, Temp 98.6°F, RR 14',
    history: 'Patient presents for clinical evaluation.',
  };
}

/**
 * Generate default explanation
 */
function generateDefaultExplanation(diagnosis: string, modality: string): string {
  const modalityName = modality === 'ecg' ? 'ECG' : modality === 'derm' ? 'dermatological' : 'imaging';
  return `This ${modalityName} finding is consistent with ${diagnosis}. Review the characteristic features and clinical presentation.`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const onRequestGet = async (context: CloudflareContext<Env>) => {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    
    // Parse query parameters
    const modalityParam = url.searchParams.get('modality') as ModalityType | null;
    const countParam = url.searchParams.get('count');
    const count = countParam ? parseInt(countParam, 10) : 20;
    
    // Validate parameters
    if (countParam && (isNaN(count) || count < 1 || count > 100)) {
      return new Response(
        JSON.stringify({ error: 'Invalid count parameter. Must be between 1 and 100.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (modalityParam && !['ecg', 'derm', 'radiology'].includes(modalityParam)) {
      return new Response(
        JSON.stringify({ error: 'Invalid modality. Must be: ecg, derm, or radiology' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create Prisma client
    const prisma = createEdgePrismaClient(env.DATABASE_URL as string);
    
    try {
      // Wrap database query in try-catch for error handling
      let assets;
      
      try {
        // Build query filters
      // CRITICAL: For quiz mode, we only use CLEAN un-annotated images
      // Annotated images would give away the answer
      const whereClause: any = {
        AND: [
          { status: 'approved' }, // Only approved media
          { isClinical: true }, // Only clinical images (not diagrams)
          { correctDiagnosis: { not: null } }, // Has quiz data
          {
            OR: [
              { originalUrl: { not: null } },
              { thumbnailUrl: { not: null } },
            ]
          }, // Has at least one URL
          // IMPORTANT: Only use clean images without annotations for quiz mode
          // Images with arrows/labels would give away the diagnosis
          {
            OR: [
              { isAnnotated: false }, // Explicitly marked as clean
              { isAnnotated: null }, // Assume clean if not specified (legacy data)
            ]
          },
          // Filter by usageType - only quiz or both
          {
            OR: [
              { usageType: 'quiz' },
              { usageType: 'both' },
              { usageType: null }, // Assume quiz-suitable if not specified (legacy)
            ]
          },
        ],
      };
      
      // Add modality filter if specified
      if (modalityParam) {
        // Map modality to database type field
        const typeFilters: Record<ModalityType, string[]> = {
          'ecg': ['ekg', 'ecg', 'ECG', 'EKG'],
          'derm': ['photo', 'derm', 'PHOTO', 'DERM'],
          'radiology': ['imaging', 'xray', 'IMAGING', 'XRAY', 'X-Ray'],
        };
        
        whereClause.AND.push({
          type: { in: typeFilters[modalityParam] }
        });
      } else {
        // If no modality specified, only get types suitable for drills
        whereClause.AND.push({
          type: { in: ['ekg', 'ecg', 'ECG', 'EKG', 'photo', 'derm', 'PHOTO', 'DERM', 'imaging', 'xray', 'IMAGING', 'XRAY', 'X-Ray'] }
        });
      }
      
      // Fetch media assets with error handling
      assets = await prisma.mediaAsset.findMany({
        where: whereClause,
        select: {
          id: true,
          type: true,
          originalUrl: true,
          thumbnailUrl: true,
          correctDiagnosis: true,
          distractors: true,
          clinicalContext: true,
          description: true,
          altText: true,
        },
        take: count * 2, // Fetch extra in case some are invalid
      });
      } catch (dbError) {
        // Database query failed - log and return empty array
        console.error('[Media Drill API] Database query error:', dbError);
        return new Response(
          JSON.stringify([]),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Handle null or empty results gracefully
      if (!assets || assets.length === 0) {
        console.warn(`[Media Drill API] No assets found. Modality: ${modalityParam || 'all'}`);
        return new Response(
          JSON.stringify([]),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Transform to PhotoCase format
      const photoCases: PhotoCase[] = [];
      
      for (const asset of assets) {
        try {
          // Validate required fields
          if (!hasRequiredQuizFields(asset)) {
            continue; // Skip assets without complete quiz data
          }
          
          // Prefer original URL, fallback to thumbnail
          const imageUrl = asset.originalUrl || asset.thumbnailUrl;
          if (!imageUrl) continue;
          
          // Parse JSON fields safely
          let distractors: string[] = [];
          try {
            if (Array.isArray(asset.distractors)) {
              distractors = asset.distractors;
            } else if (typeof asset.distractors === 'string') {
              distractors = JSON.parse(asset.distractors);
            }
          } catch (jsonError) {
            console.error(`Failed to parse distractors for asset ${asset.id}:`, jsonError);
            continue; // Skip this asset if distractors are invalid
          }
          
          // Ensure we have enough distractors
          if (!Array.isArray(distractors) || distractors.length < 3) {
            console.warn(`Asset ${asset.id} has insufficient distractors (${distractors.length})`);
            continue;
          }
        
          let clinicalContext: ClinicalContext | undefined;
          if (asset.clinicalContext) {
            try {
              clinicalContext = typeof asset.clinicalContext === 'string'
                ? JSON.parse(asset.clinicalContext)
                : asset.clinicalContext;
            } catch (e) {
              // If parsing fails, generate default
              clinicalContext = generateDefaultContext(asset.correctDiagnosis!);
            }
          }
          
          // Map type to modality
          const modality = mapTypeToModality(asset.type);
          
          // Generate explanation
          const explanation = asset.description || 
            asset.altText || 
            generateDefaultExplanation(asset.correctDiagnosis!, modality);
          
          photoCases.push({
            id: asset.id,
            imageUrl,
            modality,
            correctDiagnosis: asset.correctDiagnosis!,
            distractors,
            explanation,
            clinicalContext,
          });
          
          // Stop once we have enough valid cases
          if (photoCases.length >= count) {
            break;
          }
        } catch (assetError) {
          console.error(`Error processing asset ${asset.id}:`, assetError);
          continue; // Skip this asset and continue with next
        }
      }
      
      // Handle empty results
      if (photoCases.length === 0) {
        console.warn(`[Media Drill API] No valid assets found. Total assets queried: ${assets.length}, modality: ${modalityParam || 'all'}`);
        // Return empty array instead of 404 to allow graceful degradation
        return new Response(
          JSON.stringify([]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Shuffle to randomize order
      const shuffled = photoCases.sort(() => Math.random() - 0.5);
      
      return new Response(
        JSON.stringify(shuffled),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('[Media Drill API] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch media drill questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
