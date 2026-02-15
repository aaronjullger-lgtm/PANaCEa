/**
 * Shared media drill cases: single source for GET /api/drills/media and GET /api/drill/photo-batch.
 * Returns approved MediaAsset rows as PhotoCase[] for photo drill UI.
 *
 * @module services/drill/mediaDrillCases
 */

import {
  typeToModality,
  modalityToTypeFilters,
  allDrillTypes,
  type DrillModality,
} from '../../lib/mediaTypes';

export interface PhotoCase {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  highResUrl?: string | null;
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

interface PrismaLike {
  mediaAsset: {
    findMany: (args: any) => Promise<any[]>;
  };
}

export interface GetMediaDrillCasesOptions {
  modality?: DrillModality | null;
  count: number;
}

function hasRequiredQuizFields(asset: any): boolean {
  return !!(
    asset.correctDiagnosis &&
    asset.distractors &&
    Array.isArray(asset.distractors) &&
    asset.distractors.length >= 3
  );
}

function generateDefaultContext(diagnosis: string): ClinicalContext {
  return {
    age: 45,
    sex: Math.random() > 0.5 ? 'M' : 'F',
    chiefComplaint: `Evaluation for ${diagnosis}`,
    vitals: 'BP 120/80, HR 72, Temp 98.6°F, RR 14',
    history: 'Patient presents for clinical evaluation.',
  };
}

function generateDefaultExplanation(diagnosis: string, modality: string): string {
  const modalityName =
    modality === 'ecg' ? 'ECG' : modality === 'derm' ? 'dermatological' : 'imaging';
  return `This ${modalityName} finding is consistent with ${diagnosis}. Review the characteristic features and clinical presentation.`;
}

/**
 * Fetch photo drill cases from MediaAsset (same logic as GET /api/drills/media).
 * Use this from both drills/media and photo-batch so they return identical data.
 */
export async function getMediaDrillCases(
  prisma: PrismaLike,
  options: GetMediaDrillCasesOptions
): Promise<PhotoCase[]> {
  const { modality: modalityParam, count } = options;

  const whereClause: any = {
    AND: [
      { approvalStatus: 'approved' },
      { isClinical: true },
      { correctDiagnosis: { not: null } },
      {
        OR: [{ originalUrl: { not: null } }, { thumbnailUrl: { not: null } }],
      },
      {
        OR: [{ isAnnotated: false }, { isAnnotated: null }],
      },
      {
        OR: [{ usageType: 'quiz' }, { usageType: 'both' }, { usageType: null }],
      },
    ],
  };

  if (modalityParam) {
    whereClause.AND.push({
      type: { in: modalityToTypeFilters(modalityParam) },
    });
  } else {
    whereClause.AND.push({
      type: { in: allDrillTypes() },
    });
  }

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
    take: count * 2,
  });

  const photoCases: PhotoCase[] = [];

  for (const asset of assets) {
    try {
      if (!hasRequiredQuizFields(asset)) continue;

      const thumbnailUrl = asset.thumbnailUrl ?? null;
      const highResUrl = asset.originalUrl ?? null;
      const imageUrl = thumbnailUrl || highResUrl;
      if (!imageUrl) continue;

      let distractors: string[] = [];
      try {
        if (Array.isArray(asset.distractors)) {
          distractors = asset.distractors;
        } else if (typeof asset.distractors === 'string') {
          distractors = JSON.parse(asset.distractors);
        }
      } catch {
        continue;
      }
      if (!Array.isArray(distractors) || distractors.length < 3) continue;

      let clinicalContext: ClinicalContext | undefined;
      if (asset.clinicalContext) {
        try {
          clinicalContext =
            typeof asset.clinicalContext === 'string'
              ? JSON.parse(asset.clinicalContext)
              : asset.clinicalContext;
        } catch {
          clinicalContext = generateDefaultContext(asset.correctDiagnosis!);
        }
      }

      const modality = typeToModality(asset.type);
      const explanation =
        asset.description ||
        asset.altText ||
        generateDefaultExplanation(asset.correctDiagnosis!, modality);

      photoCases.push({
        id: asset.id,
        imageUrl,
        thumbnailUrl: thumbnailUrl || undefined,
        highResUrl:
          highResUrl && highResUrl !== (thumbnailUrl || imageUrl) ? highResUrl : undefined,
        modality,
        correctDiagnosis: asset.correctDiagnosis!,
        distractors,
        explanation,
        clinicalContext,
      });

      if (photoCases.length >= count) break;
    } catch {
      continue;
    }
  }

  return photoCases.sort(() => Math.random() - 0.5);
}
