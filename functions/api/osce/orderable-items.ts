/**
 * GET /api/osce/orderable-items
 *
 * Fetch orderable items from database for OSCE Quick Order System
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

interface OrderableItemResponse {
  id: string;
  name: string;
  category: 'labs' | 'imaging' | 'procedures' | 'medications';
  subcategory?: string;
  costTier: '$' | '$$' | '$$$' | '$$$$';
  turnaroundMinutes: number;
  isHighYield?: boolean;
  panceYield?: number | null;
  indications?: string[];
  contraindications?: string[];
}

interface OrderBundleResponse {
  id: string;
  name: string;
  description: string;
  items: string[];
  relatedChiefComplaints: string[];
  icon?: string;
}

// Define standard order bundles based on common clinical presentations
const ORDER_BUNDLES: OrderBundleResponse[] = [
  {
    id: 'cardiac-panel',
    name: 'Cardiac Workup',
    description: 'Standard workup for chest pain / ACS',
    items: ['cbc', 'bmp', 'troponin', 'bnp', 'ecg', 'cxr'],
    relatedChiefComplaints: ['chest pain', 'dyspnea', 'shortness of breath', 'syncope'],
  },
  {
    id: 'heart-failure',
    name: 'Heart Failure Workup',
    description: 'CHF evaluation and staging',
    items: ['cbc', 'bmp', 'bnp', 'troponin', 'lfts', 'tsh', 'ecg', 'cxr', 'echo'],
    relatedChiefComplaints: ['dyspnea', 'edema', 'orthopnea', 'weight gain', 'fatigue'],
  },
  {
    id: 'syncope-workup',
    name: 'Syncope Workup',
    description: 'Loss of consciousness evaluation',
    items: ['cbc', 'bmp', 'glucose', 'troponin', 'ecg', 'orthostatic-vitals', 'ct-head'],
    relatedChiefComplaints: ['syncope', 'fainting', 'passed out', 'loss of consciousness', 'dizzy'],
  },
  {
    id: 'afib-workup',
    name: 'Atrial Fibrillation Workup',
    description: 'New AFib evaluation',
    items: ['cbc', 'bmp', 'tsh', 'magnesium', 'ecg', 'cxr', 'echo'],
    relatedChiefComplaints: ['palpitations', 'irregular heartbeat', 'racing heart', 'afib'],
  },
  {
    id: 'pe-workup',
    name: 'PE Workup',
    description: 'Workup for suspected pulmonary embolism',
    items: ['cbc', 'bmp', 'd-dimer', 'troponin', 'bnp', 'cxr', 'ct-pe', 'ecg'],
    relatedChiefComplaints: ['dyspnea', 'pleuritic chest pain', 'hemoptysis', 'leg swelling'],
  },
  {
    id: 'copd-exacerbation',
    name: 'COPD Exacerbation',
    description: 'Acute COPD exacerbation workup',
    items: ['cbc', 'bmp', 'abg', 'procalcitonin', 'cxr', 'ecg', 'sputum-culture'],
    relatedChiefComplaints: ['copd', 'wheezing', 'dyspnea', 'cough', 'sputum'],
  },
  {
    id: 'pneumonia-workup',
    name: 'Pneumonia Workup',
    description: 'Community-acquired pneumonia evaluation',
    items: [
      'cbc',
      'bmp',
      'procalcitonin',
      'blood-culture',
      'sputum-culture',
      'cxr',
      'urinary-legionella',
      'urinary-pneumococcal',
    ],
    relatedChiefComplaints: ['fever', 'cough', 'productive cough', 'dyspnea', 'chest pain'],
  },
  {
    id: 'sepsis-panel',
    name: 'Sepsis Workup',
    description: 'Standard workup for suspected sepsis',
    items: [
      'cbc',
      'bmp',
      'lactate',
      'procalcitonin',
      'blood-culture',
      'urinalysis',
      'urine-culture',
      'cxr',
    ],
    relatedChiefComplaints: ['fever', 'altered mental status', 'hypotension', 'infection'],
  },
  {
    id: 'meningitis-workup',
    name: 'Meningitis Workup',
    description: 'Suspected CNS infection evaluation',
    items: ['cbc', 'bmp', 'blood-culture', 'lumbar-puncture', 'csf-analysis', 'ct-head'],
    relatedChiefComplaints: [
      'headache',
      'neck stiffness',
      'fever',
      'photophobia',
      'altered mental status',
    ],
  },
  {
    id: 'uti-workup',
    name: 'UTI Workup',
    description: 'Urinary tract infection evaluation',
    items: ['urinalysis', 'urine-culture', 'bmp'],
    relatedChiefComplaints: ['dysuria', 'frequency', 'urgency', 'flank pain', 'hematuria'],
  },
  {
    id: 'dka-panel',
    name: 'DKA Workup',
    description: 'Standard workup for diabetic ketoacidosis',
    items: ['cbc', 'bmp', 'abg', 'serum-ketones', 'urinalysis', 'hba1c', 'lipase'],
    relatedChiefComplaints: ['diabetic', 'hyperglycemia', 'vomiting', 'altered mental status'],
  },
  {
    id: 'thyroid-storm',
    name: 'Thyroid Storm Workup',
    description: 'Hyperthyroidism/thyroid storm evaluation',
    items: ['cbc', 'bmp', 'tsh', 'free-t4', 'free-t3', 'ecg', 'cxr'],
    relatedChiefComplaints: [
      'palpitations',
      'weight loss',
      'tremor',
      'heat intolerance',
      'agitation',
    ],
  },
  {
    id: 'adrenal-crisis',
    name: 'Adrenal Crisis Workup',
    description: 'Adrenal insufficiency evaluation',
    items: ['cbc', 'bmp', 'cortisol', 'acth', 'glucose', 'tsh'],
    relatedChiefComplaints: ['hypotension', 'fatigue', 'weakness', 'nausea', 'abdominal pain'],
  },
  {
    id: 'stroke-panel',
    name: 'Stroke Workup',
    description: 'Acute stroke workup',
    items: ['cbc', 'bmp', 'pt-inr', 'glucose', 'ct-head', 'ecg'],
    relatedChiefComplaints: [
      'weakness',
      'numbness',
      'facial droop',
      'speech difficulty',
      'vision changes',
    ],
  },
  {
    id: 'seizure-workup',
    name: 'New Seizure Workup',
    description: 'First-time seizure evaluation',
    items: [
      'cbc',
      'bmp',
      'glucose',
      'magnesium',
      'calcium',
      'lfts',
      'tox-screen',
      'ct-head',
      'eeg',
    ],
    relatedChiefComplaints: [
      'seizure',
      'convulsions',
      'shaking',
      'postictal',
      'loss of consciousness',
    ],
  },
  {
    id: 'headache-workup',
    name: 'Severe Headache Workup',
    description: 'Worst headache of life / thunderclap',
    items: ['cbc', 'bmp', 'esr', 'crp', 'ct-head', 'lumbar-puncture'],
    relatedChiefComplaints: [
      'headache',
      'worst headache',
      'thunderclap',
      'neck pain',
      'photophobia',
    ],
  },
  {
    id: 'abdominal-pain',
    name: 'Abdominal Pain Workup',
    description: 'Basic abdominal pain evaluation',
    items: ['cbc', 'bmp', 'lipase', 'lfts', 'urinalysis', 'pregnancy-test', 'ct-abd-pelvis'],
    relatedChiefComplaints: ['abdominal pain', 'nausea', 'vomiting', 'diarrhea'],
  },
  {
    id: 'gi-bleed',
    name: 'GI Bleed Workup',
    description: 'Upper or lower GI bleeding evaluation',
    items: ['cbc', 'bmp', 'pt-inr', 'type-screen', 'lfts', 'bun-cr-ratio', 'ng-lavage'],
    relatedChiefComplaints: [
      'melena',
      'hematochezia',
      'hematemesis',
      'bloody stool',
      'coffee ground emesis',
    ],
  },
  {
    id: 'pancreatitis',
    name: 'Pancreatitis Workup',
    description: 'Acute pancreatitis evaluation',
    items: ['cbc', 'bmp', 'lipase', 'lfts', 'calcium', 'triglycerides', 'ct-abd-pelvis'],
    relatedChiefComplaints: [
      'epigastric pain',
      'abdominal pain',
      'nausea',
      'vomiting',
      'back pain',
    ],
  },
  {
    id: 'appendicitis',
    name: 'Appendicitis Workup',
    description: 'Suspected appendicitis evaluation',
    items: ['cbc', 'bmp', 'urinalysis', 'pregnancy-test', 'ct-abd-pelvis'],
    relatedChiefComplaints: [
      'rlq pain',
      'right lower quadrant',
      'abdominal pain',
      'nausea',
      'anorexia',
    ],
  },
  {
    id: 'aki-workup',
    name: 'AKI Workup',
    description: 'Acute kidney injury evaluation',
    items: [
      'cbc',
      'bmp',
      'urinalysis',
      'urine-sodium',
      'urine-creatinine',
      'fena',
      'renal-ultrasound',
    ],
    relatedChiefComplaints: [
      'decreased urine',
      'oliguria',
      'anuria',
      'edema',
      'elevated creatinine',
    ],
  },
  {
    id: 'kidney-stone',
    name: 'Nephrolithiasis Workup',
    description: 'Kidney stone evaluation',
    items: ['cbc', 'bmp', 'urinalysis', 'ct-kub'],
    relatedChiefComplaints: ['flank pain', 'colicky pain', 'hematuria', 'back pain'],
  },
  {
    id: 'anemia-workup',
    name: 'Anemia Workup',
    description: 'New anemia evaluation',
    items: ['cbc', 'reticulocyte', 'iron-studies', 'b12', 'folate', 'peripheral-smear', 'lfts'],
    relatedChiefComplaints: ['fatigue', 'weakness', 'pallor', 'dyspnea', 'dizziness'],
  },
  {
    id: 'dvt-workup',
    name: 'DVT Workup',
    description: 'Deep vein thrombosis evaluation',
    items: ['cbc', 'bmp', 'd-dimer', 'pt-inr', 'venous-doppler'],
    relatedChiefComplaints: ['leg swelling', 'leg pain', 'calf pain', 'unilateral edema'],
  },
];

function estimateCostTier(category: string, modality?: string): '$' | '$$' | '$$$' | '$$$$' {
  if (category === 'labs') return '$';
  if (category === 'imaging') {
    if (modality === 'MRI') return '$$$$';
    if (modality === 'CT') return '$$$';
    if (modality === 'Ultrasound') return '$$';
    return '$$';
  }
  if (category === 'procedures') return '$$$';
  return '$$';
}

function estimateTurnaround(category: string, name: string, modality?: string): number {
  if (category === 'labs') {
    const quickLabs = ['glucose', 'troponin', 'lactate', 'abg', 'urinalysis', 'd-dimer'];
    if (quickLabs.some((q) => name.toLowerCase().includes(q))) return 30;
    if (name.toLowerCase().includes('culture')) return 2880;
    return 60;
  }
  if (category === 'imaging') {
    if (modality === 'X-ray') return 30;
    if (modality === 'CT') return 60;
    if (modality === 'Ultrasound') return 45;
    if (modality === 'MRI') return 120;
    return 60;
  }
  if (category === 'procedures') return 30;
  return 60;
}

const OrderableItemsSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  bundles: z.string().optional(),
});

export const onRequestGet = publicEndpoint(
  OrderableItemsSchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/osce/orderable-items');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { category, search, bundles } = validated || {};

      if (bundles === 'true') {
        return { data: { bundles: ORDER_BUNDLES } };
      }

      const items: OrderableItemResponse[] = [];

      if (!category || category === 'labs') {
        const labs = await prisma.labTest.findMany({
          where: search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { category: { contains: search, mode: 'insensitive' } },
                ],
              }
            : undefined,
          select: {
            id: true,
            name: true,
            category: true,
            isHighYield: true,
            panceYield: true,
            whenToOrder: true,
            turnaroundTime: true,
          },
          take: 100,
          orderBy: [{ isHighYield: 'desc' }, { panceYield: 'desc' }, { name: 'asc' }],
        });
        for (const lab of labs) {
          items.push({
            id: lab.id,
            name: lab.name,
            category: 'labs',
            subcategory: lab.category,
            costTier: estimateCostTier('labs'),
            turnaroundMinutes: lab.turnaroundTime
              ? parseInt(lab.turnaroundTime) || 60
              : estimateTurnaround('labs', lab.name),
            isHighYield: lab.isHighYield,
            panceYield: lab.panceYield,
            indications: lab.whenToOrder,
            contraindications: [],
          });
        }
      }

      if (!category || category === 'imaging') {
        const imaging = await prisma.imagingStudy.findMany({
          where: search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { modality: { contains: search, mode: 'insensitive' } },
                  { bodyRegion: { contains: search, mode: 'insensitive' } },
                ],
              }
            : undefined,
          select: {
            id: true,
            name: true,
            modality: true,
            bodyRegion: true,
            isHighYield: true,
            panceYield: true,
            indications: true,
            contraindications: true,
          },
          take: 100,
          orderBy: [{ isHighYield: 'desc' }, { panceYield: 'desc' }, { name: 'asc' }],
        });
        for (const img of imaging) {
          items.push({
            id: img.id,
            name: img.name,
            category: 'imaging',
            subcategory: img.modality,
            costTier: estimateCostTier('imaging', img.modality),
            turnaroundMinutes: estimateTurnaround('imaging', img.name, img.modality),
            isHighYield: img.isHighYield,
            panceYield: img.panceYield,
            indications: img.indications,
            contraindications: img.contraindications,
          });
        }
      }

      if (!category || category === 'procedures') {
        const procedures = await prisma.procedure.findMany({
          where: search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { category: { contains: search, mode: 'insensitive' } },
                ],
              }
            : undefined,
          select: {
            id: true,
            name: true,
            displayName: true,
            category: true,
            isHighYield: true,
            panceYield: true,
            indications: true,
            absoluteContraindications: true,
            relativeContraindications: true,
          },
          take: 100,
          orderBy: [{ isHighYield: 'desc' }, { panceYield: 'desc' }, { name: 'asc' }],
        });
        for (const proc of procedures) {
          items.push({
            id: proc.id,
            name: proc.displayName || proc.name,
            category: 'procedures',
            subcategory: proc.category,
            costTier: estimateCostTier('procedures'),
            turnaroundMinutes: estimateTurnaround('procedures', proc.name),
            isHighYield: proc.isHighYield,
            panceYield: proc.panceYield,
            indications: proc.indications,
            contraindications: [
              ...proc.absoluteContraindications,
              ...proc.relativeContraindications,
            ],
          });
        }
      }

      if (!category || category === 'medications') {
        const drugs = await prisma.drug.findMany({
          where: search
            ? {
                OR: [
                  { genericName: { contains: search, mode: 'insensitive' } },
                  { brandName: { contains: search, mode: 'insensitive' } },
                  { drugClass: { hasSome: [search] } },
                ],
              }
            : undefined,
          select: {
            id: true,
            genericName: true,
            brandName: true,
            drugClass: true,
            isHighYield: true,
            panceYield: true,
            indications: true,
            contraindications: true,
            isFirstLine: true,
          },
          take: 100,
          orderBy: [
            { isFirstLine: 'desc' },
            { isHighYield: 'desc' },
            { panceYield: 'desc' },
            { genericName: 'asc' },
          ],
        });
        for (const drug of drugs) {
          items.push({
            id: drug.id,
            name: drug.brandName ? `${drug.genericName} (${drug.brandName})` : drug.genericName,
            category: 'medications',
            subcategory: drug.drugClass[0] || 'Other',
            costTier: estimateCostTier('medications'),
            turnaroundMinutes: 15,
            isHighYield: drug.isHighYield,
            panceYield: drug.panceYield,
            indications: drug.indications,
            contraindications: drug.contraindications,
          });
        }
      }

      logger.info('Fetched orderable items', { count: items.length, category, search });
      return { data: { items, bundles: ORDER_BUNDLES, total: items.length } };
    } catch (error) {
      logger.error('Error fetching orderable items', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch orderable items');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
