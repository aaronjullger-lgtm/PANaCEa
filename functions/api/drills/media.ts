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

import type { PagesFunction } from '@cloudflare/workers-types';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

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

export const onRequestGet: PagesFunction = async (context) => {
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
      // Build query filters
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
      
      // Fetch media assets
      const assets = await prisma.mediaAsset.findMany({
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
      
      // Transform to PhotoCase format
      const photoCases: PhotoCase[] = [];
      
      for (const asset of assets) {
        // Validate required fields
        if (!hasRequiredQuizFields(asset)) {
          continue; // Skip assets without complete quiz data
        }
        
        // Prefer original URL, fallback to thumbnail
        const imageUrl = asset.originalUrl || asset.thumbnailUrl;
        if (!imageUrl) continue;
        
        // Parse JSON fields
        const distractors = Array.isArray(asset.distractors)
          ? asset.distractors
          : typeof asset.distractors === 'string'
          ? JSON.parse(asset.distractors)
          : [];
        
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
      }
      
      // If we don't have enough cases, return what we found
      if (photoCases.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'No approved media assets found for drill questions',
            suggestion: 'Ensure MediaAsset table has approved clinical images with correctDiagnosis and distractors fields populated'
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
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
