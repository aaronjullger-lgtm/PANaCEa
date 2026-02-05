/**
 * Drills Routes (Express – local dev parity with CF /api/drills/*)
 *
 * GET  /api/drills/lab-cases – Lab cases for Mini Lab drill
 * POST /api/drills/lab-cases – getDiagnoses for autocomplete
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';

const router = Router();

interface LabValue {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  isCritical?: boolean;
  abnormalDirection?: 'high' | 'low';
}

interface LabPanel {
  name: string;
  values: LabValue[];
}

interface TransformedLabCase {
  id: string;
  clinicalContext: string;
  patientAge?: number;
  patientSex?: string;
  panels: LabPanel[];
  correctDiagnosis: string;
  keyFindings: string[];
  explanation: string;
  category: string;
}

function parseLabValue(
  valueStr: string,
  defaultUnit: string,
  defaultRange: string
): {
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  isCritical?: boolean;
  abnormalDirection?: 'high' | 'low';
} | null {
  if (!valueStr || typeof valueStr !== 'string') return null;
  const numMatch = valueStr.match(/[\d.]+/);
  if (!numMatch) return null;
  const value = numMatch[0];
  const lowerStr = valueStr.toLowerCase();
  const isDecreased = lowerStr.includes('decreased') || lowerStr.includes('low');
  const isIncreased =
    lowerStr.includes('increased') || lowerStr.includes('high') || lowerStr.includes('elevated');
  const isCritical = lowerStr.includes('critical') || lowerStr.includes('danger');
  const isAbnormal = isDecreased || isIncreased;
  return {
    value,
    unit: defaultUnit,
    referenceRange: defaultRange,
    isAbnormal,
    isCritical: isCritical || undefined,
    abnormalDirection: isDecreased ? 'low' : isIncreased ? 'high' : undefined,
  };
}

const PANEL_CONFIGS: { key: string; name: string; mappings: { key: string; name: string; unit: string; range: string }[] }[] = [
  {
    key: 'completeBloodCount',
    name: 'Complete Blood Count',
    mappings: [
      { key: 'hemoglobin', name: 'Hemoglobin', unit: 'g/dL', range: '12.0-16.0' },
      { key: 'hematocrit', name: 'Hematocrit', unit: '%', range: '36-48' },
      { key: 'whiteBloodCellCount', name: 'WBC', unit: 'k/μL', range: '4.5-11.0' },
      { key: 'plateletCount', name: 'Platelets', unit: 'k/μL', range: '150-400' },
    ],
  },
  {
    key: 'basicMetabolicPanel',
    name: 'Basic Metabolic Panel',
    mappings: [
      { key: 'glucose', name: 'Glucose', unit: 'mg/dL', range: '70-100' },
      { key: 'sodium', name: 'Sodium', unit: 'mEq/L', range: '136-145' },
      { key: 'potassium', name: 'Potassium', unit: 'mEq/L', range: '3.5-5.0' },
      { key: 'creatinine', name: 'Creatinine', unit: 'mg/dL', range: '0.7-1.3' },
    ],
  },
  {
    key: 'metabolicPanel',
    name: 'Basic Metabolic Panel',
    mappings: [
      { key: 'glucose', name: 'Glucose', unit: 'mg/dL', range: '70-100' },
      { key: 'sodium', name: 'Sodium', unit: 'mEq/L', range: '136-145' },
      { key: 'potassium', name: 'Potassium', unit: 'mEq/L', range: '3.5-5.0' },
      { key: 'creatinine', name: 'Creatinine', unit: 'mg/dL', range: '0.7-1.3' },
    ],
  },
];

function transformLabCase(dbCase: { id: string; clinicalVignette: string; correctDiagnosis: string; labs: Record<string, unknown> }): TransformedLabCase {
  const labs = dbCase.labs || {};
  const panels: LabPanel[] = [];
  const keyFindings: string[] = [];

  for (const panelConfig of PANEL_CONFIGS) {
    const panelData = labs[panelConfig.key] as Record<string, string> | undefined;
    if (!panelData) continue;
    const labPanel: LabPanel = { name: panelConfig.name, values: [] };
    for (const m of panelConfig.mappings) {
      const val = panelData[m.key];
      if (!val) continue;
      const parsed = parseLabValue(val, m.unit, m.range);
      if (parsed) {
        labPanel.values.push({ name: m.name, ...parsed });
        if (parsed.isAbnormal && parsed.abnormalDirection) {
          keyFindings.push(`${m.name}: ${parsed.value} ${parsed.unit} (${parsed.abnormalDirection})`);
        }
      }
    }
    if (labPanel.values.length > 0) panels.push(labPanel);
  }

  const diagnosis = dbCase.correctDiagnosis.toLowerCase();
  let category = 'random';
  if (diagnosis.includes('anemia') || diagnosis.includes('hematology') || diagnosis.includes('hemolytic')) category = 'hematology';
  else if (diagnosis.includes('diabetic') || diagnosis.includes('dka') || diagnosis.includes('acidosis')) category = 'metabolic';
  else if (diagnosis.includes('thyroid') || diagnosis.includes('addison') || diagnosis.includes('siadh')) category = 'endocrine';
  else if (diagnosis.includes('renal') || diagnosis.includes('kidney') || diagnosis.includes('nephrotic')) category = 'renal';
  else if (diagnosis.includes('hepat') || diagnosis.includes('liver') || diagnosis.includes('cirrhosis')) category = 'hepatic';
  else if (diagnosis.includes('cardiac') || diagnosis.includes('heart') || diagnosis.includes('infarction')) category = 'cardiac';

  const explanation = `The lab findings are consistent with ${dbCase.correctDiagnosis}.`;

  return {
    id: dbCase.id,
    clinicalContext: dbCase.clinicalVignette,
    panels,
    correctDiagnosis: dbCase.correctDiagnosis,
    keyFindings: keyFindings.slice(0, 5),
    explanation,
    category,
  };
}

router.get('/lab-cases', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    const category = (req.query.category as string) || undefined;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const shuffle = req.query.shuffle !== 'false';

    const dbCases = await prisma.labCase.findMany({ take: limit * 2 });
    let transformed = dbCases.map((c) => transformLabCase(c)).filter((c) => c.panels.length > 0);

    if (category && category !== 'random') {
      transformed = transformed.filter((c) => c.category === category);
    }
    if (shuffle) {
      transformed = transformed.sort(() => Math.random() - 0.5);
    }
    transformed = transformed.slice(0, limit);

    res.json({ success: true, cases: transformed, total: transformed.length });
  } catch (error) {
    console.error('Error fetching lab cases:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lab cases' });
  }
});

router.post('/lab-cases', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    const action = req.body?.action;
    if (action !== 'getDiagnoses') {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    const cases = await prisma.labCase.findMany({ select: { correctDiagnosis: true } });
    const diagnoses = [...new Set(cases.map((c) => c.correctDiagnosis))].sort();
    res.json({ success: true, diagnoses });
  } catch (error) {
    console.error('Error in lab-cases POST:', error);
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

export default router;
