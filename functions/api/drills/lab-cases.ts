/**
 * API Endpoint: /api/drills/lab-cases
 * 
 * Returns lab cases from the database for the Mini Lab Drill mode.
 * Transforms database format to match the LabCase interface expected by the frontend.
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest } from '../_shared/schemas';
import { z } from 'zod';

// Zod schema for lab cases POST actions
const LabCasesActionSchema = z.object({
  action: z.enum(['getDiagnoses']),
});

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

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
  orderableTests?: LabPanel[];
}

/**
 * Transform database lab case format to frontend format
 */
function transformLabCase(dbCase: any): TransformedLabCase {
  const labs = dbCase.labs || {};
  const panels: LabPanel[] = [];
  const keyFindings: string[] = [];
  
  // Transform CBC if present
  if (labs.completeBloodCount) {
    const cbcPanel: LabPanel = {
      name: 'Complete Blood Count',
      values: []
    };
    const cbc = labs.completeBloodCount;
    
    // Parse lab values from strings like "9.5 g/dL (decreased)"
    const labMappings = [
      { key: 'hemoglobin', name: 'Hemoglobin', unit: 'g/dL', range: '12.0-16.0' },
      { key: 'hematocrit', name: 'Hematocrit', unit: '%', range: '36-48' },
      { key: 'meanCorpuscularVolume', name: 'MCV', unit: 'fL', range: '80-100' },
      { key: 'meanCorpuscularHemoglobin', name: 'MCH', unit: 'pg', range: '27-33' },
      { key: 'meanCorpuscularHemoglobinConcentration', name: 'MCHC', unit: 'g/dL', range: '32-36' },
      { key: 'redCellDistributionWidth', name: 'RDW', unit: '%', range: '11.5-14.5' },
      { key: 'whiteBloodCellCount', name: 'WBC', unit: 'k/μL', range: '4.5-11.0' },
      { key: 'plateletCount', name: 'Platelets', unit: 'k/μL', range: '150-400' },
    ];
    
    for (const mapping of labMappings) {
      if (cbc[mapping.key]) {
        const parsed = parseLabValue(cbc[mapping.key], mapping.unit, mapping.range);
        if (parsed) {
          cbcPanel.values.push({ name: mapping.name, ...parsed });
          if (parsed.isAbnormal) {
            keyFindings.push(`${mapping.name}: ${parsed.value} ${parsed.unit} (${parsed.abnormalDirection})`);
          }
        }
      }
    }
    
    if (cbcPanel.values.length > 0) {
      panels.push(cbcPanel);
    }
  }
  
  // Transform Iron Studies if present
  if (labs.ironStudies) {
    const ironPanel: LabPanel = {
      name: 'Iron Studies',
      values: []
    };
    const iron = labs.ironStudies;
    
    const ironMappings = [
      { key: 'serumIron', name: 'Serum Iron', unit: 'mcg/dL', range: '60-170' },
      { key: 'serumFerritin', name: 'Ferritin', unit: 'ng/mL', range: '12-150' },
      { key: 'totalIronBindingCapacity', name: 'TIBC', unit: 'mcg/dL', range: '250-370' },
      { key: 'transferrinSaturation', name: 'Transferrin Sat', unit: '%', range: '20-50' },
    ];
    
    for (const mapping of ironMappings) {
      if (iron[mapping.key]) {
        const parsed = parseLabValue(iron[mapping.key], mapping.unit, mapping.range);
        if (parsed) {
          ironPanel.values.push({ name: mapping.name, ...parsed });
          if (parsed.isAbnormal) {
            keyFindings.push(`${mapping.name}: ${parsed.value} ${parsed.unit} (${parsed.abnormalDirection})`);
          }
        }
      }
    }
    
    if (ironPanel.values.length > 0) {
      panels.push(ironPanel);
    }
  }
  
  // Transform BMP if present
  if (labs.basicMetabolicPanel || labs.metabolicPanel) {
    const bmpData = labs.basicMetabolicPanel || labs.metabolicPanel;
    const bmpPanel: LabPanel = {
      name: 'Basic Metabolic Panel',
      values: []
    };
    
    const bmpMappings = [
      { key: 'glucose', name: 'Glucose', unit: 'mg/dL', range: '70-100' },
      { key: 'sodium', name: 'Sodium', unit: 'mEq/L', range: '136-145' },
      { key: 'potassium', name: 'Potassium', unit: 'mEq/L', range: '3.5-5.0' },
      { key: 'chloride', name: 'Chloride', unit: 'mEq/L', range: '98-106' },
      { key: 'bicarbonate', name: 'Bicarbonate', unit: 'mEq/L', range: '22-28' },
      { key: 'bun', name: 'BUN', unit: 'mg/dL', range: '7-20' },
      { key: 'creatinine', name: 'Creatinine', unit: 'mg/dL', range: '0.7-1.3' },
      { key: 'calcium', name: 'Calcium', unit: 'mg/dL', range: '8.5-10.5' },
    ];
    
    for (const mapping of bmpMappings) {
      if (bmpData[mapping.key]) {
        const parsed = parseLabValue(bmpData[mapping.key], mapping.unit, mapping.range);
        if (parsed) {
          bmpPanel.values.push({ name: mapping.name, ...parsed });
          if (parsed.isAbnormal) {
            keyFindings.push(`${mapping.name}: ${parsed.value} ${parsed.unit} (${parsed.abnormalDirection})`);
          }
        }
      }
    }
    
    if (bmpPanel.values.length > 0) {
      panels.push(bmpPanel);
    }
  }
  
  // Transform LFTs if present
  if (labs.liverFunctionTests || labs.hepaticPanel) {
    const lftData = labs.liverFunctionTests || labs.hepaticPanel;
    const lftPanel: LabPanel = {
      name: 'Liver Function Tests',
      values: []
    };
    
    const lftMappings = [
      { key: 'ast', name: 'AST', unit: 'U/L', range: '10-40' },
      { key: 'alt', name: 'ALT', unit: 'U/L', range: '7-56' },
      { key: 'alkalinePhosphatase', name: 'Alk Phos', unit: 'U/L', range: '44-147' },
      { key: 'totalBilirubin', name: 'Total Bilirubin', unit: 'mg/dL', range: '0.1-1.2' },
      { key: 'directBilirubin', name: 'Direct Bilirubin', unit: 'mg/dL', range: '0.0-0.3' },
      { key: 'albumin', name: 'Albumin', unit: 'g/dL', range: '3.5-5.0' },
    ];
    
    for (const mapping of lftMappings) {
      if (lftData[mapping.key]) {
        const parsed = parseLabValue(lftData[mapping.key], mapping.unit, mapping.range);
        if (parsed) {
          lftPanel.values.push({ name: mapping.name, ...parsed });
          if (parsed.isAbnormal) {
            keyFindings.push(`${mapping.name}: ${parsed.value} ${parsed.unit} (${parsed.abnormalDirection})`);
          }
        }
      }
    }
    
    if (lftPanel.values.length > 0) {
      panels.push(lftPanel);
    }
  }
  
  // Transform Thyroid Panel if present
  if (labs.thyroidPanel || labs.thyroidFunctionTests) {
    const thyroidData = labs.thyroidPanel || labs.thyroidFunctionTests;
    const thyroidPanel: LabPanel = {
      name: 'Thyroid Function Tests',
      values: []
    };
    
    const thyroidMappings = [
      { key: 'tsh', name: 'TSH', unit: 'mIU/L', range: '0.4-4.0' },
      { key: 'freeT4', name: 'Free T4', unit: 'ng/dL', range: '0.8-1.8' },
      { key: 'freeT3', name: 'Free T3', unit: 'pg/mL', range: '2.3-4.2' },
      { key: 't4', name: 'Total T4', unit: 'mcg/dL', range: '4.5-12.0' },
      { key: 't3', name: 'Total T3', unit: 'ng/dL', range: '80-200' },
    ];
    
    for (const mapping of thyroidMappings) {
      if (thyroidData[mapping.key]) {
        const parsed = parseLabValue(thyroidData[mapping.key], mapping.unit, mapping.range);
        if (parsed) {
          thyroidPanel.values.push({ name: mapping.name, ...parsed });
          if (parsed.isAbnormal) {
            keyFindings.push(`${mapping.name}: ${parsed.value} ${parsed.unit} (${parsed.abnormalDirection})`);
          }
        }
      }
    }
    
    if (thyroidPanel.values.length > 0) {
      panels.push(thyroidPanel);
    }
  }
  
  // Transform Coagulation Panel if present
  if (labs.coagulationStudies || labs.coagulationPanel) {
    const coagData = labs.coagulationStudies || labs.coagulationPanel;
    const coagPanel: LabPanel = {
      name: 'Coagulation Studies',
      values: []
    };
    
    const coagMappings = [
      { key: 'pt', name: 'PT', unit: 'seconds', range: '11-13.5' },
      { key: 'inr', name: 'INR', unit: '', range: '0.8-1.2' },
      { key: 'ptt', name: 'PTT', unit: 'seconds', range: '25-35' },
      { key: 'fibrinogen', name: 'Fibrinogen', unit: 'mg/dL', range: '200-400' },
      { key: 'dDimer', name: 'D-Dimer', unit: 'ng/mL', range: '<500' },
    ];
    
    for (const mapping of coagMappings) {
      if (coagData[mapping.key]) {
        const parsed = parseLabValue(coagData[mapping.key], mapping.unit, mapping.range);
        if (parsed) {
          coagPanel.values.push({ name: mapping.name, ...parsed });
          if (parsed.isAbnormal) {
            keyFindings.push(`${mapping.name}: ${parsed.value} ${parsed.unit} (${parsed.abnormalDirection})`);
          }
        }
      }
    }
    
    if (coagPanel.values.length > 0) {
      panels.push(coagPanel);
    }
  }
  
  // Infer category from diagnosis
  const diagnosis = dbCase.correctDiagnosis.toLowerCase();
  let category = 'random';
  
  if (diagnosis.includes('anemia') || diagnosis.includes('leukemia') || diagnosis.includes('polycythemia') || diagnosis.includes('thrombocytopenia') || diagnosis.includes('hemolytic') || diagnosis.includes('sickle') || diagnosis.includes('thalassemia')) {
    category = 'hematology';
  } else if (diagnosis.includes('diabetic') || diagnosis.includes('dka') || diagnosis.includes('hhs') || diagnosis.includes('acidosis') || diagnosis.includes('alkalosis') || diagnosis.includes('hypoglycemia')) {
    category = 'metabolic';
  } else if (diagnosis.includes('thyroid') || diagnosis.includes('addison') || diagnosis.includes('cushing') || diagnosis.includes('parathyroid') || diagnosis.includes('siadh') || diagnosis.includes('diabetes insipidus') || diagnosis.includes('hypothyroid') || diagnosis.includes('hyperthyroid')) {
    category = 'endocrine';
  } else if (diagnosis.includes('kidney') || diagnosis.includes('renal') || diagnosis.includes('nephrotic') || diagnosis.includes('glomerulo') || diagnosis.includes('kalemia') || diagnosis.includes('natremia')) {
    category = 'renal';
  } else if (diagnosis.includes('hepat') || diagnosis.includes('cirrhosis') || diagnosis.includes('liver') || diagnosis.includes('cholesta')) {
    category = 'hepatic';
  } else if (diagnosis.includes('infarction') || diagnosis.includes('heart') || diagnosis.includes('embolism') || diagnosis.includes('cardiac')) {
    category = 'cardiac';
  }
  
  // Build explanation from additional considerations
  let explanation = `The lab findings are consistent with ${dbCase.correctDiagnosis}.`;
  if (labs.additionalConsiderations && Array.isArray(labs.additionalConsiderations)) {
    explanation += ' ' + labs.additionalConsiderations.slice(0, 2).join(' ');
  }
  if (labs.peripheralBloodSmear) {
    explanation += ` Peripheral smear: ${labs.peripheralBloodSmear}`;
  }
  
  // Parse age and sex from vignette if possible
  let patientAge: number | undefined;
  let patientSex: string | undefined;
  
  const ageMatch = dbCase.clinicalVignette?.match(/(\d+)[- ]year[- ]old/i);
  if (ageMatch) {
    patientAge = parseInt(ageMatch[1]);
  }
  
  if (dbCase.clinicalVignette?.toLowerCase().includes('female') || dbCase.clinicalVignette?.toLowerCase().includes(' she ') || dbCase.clinicalVignette?.toLowerCase().includes('woman')) {
    patientSex = 'F';
  } else if (dbCase.clinicalVignette?.toLowerCase().includes('male') || dbCase.clinicalVignette?.toLowerCase().includes(' he ') || dbCase.clinicalVignette?.toLowerCase().includes(' man ')) {
    patientSex = 'M';
  }
  
  return {
    id: dbCase.id,
    clinicalContext: dbCase.clinicalVignette,
    patientAge,
    patientSex,
    panels,
    correctDiagnosis: dbCase.correctDiagnosis,
    keyFindings: keyFindings.slice(0, 5), // Limit to top 5 findings
    explanation,
    category,
  };
}

/**
 * Parse a lab value string like "9.5 g/dL (decreased)" into structured data
 */
function parseLabValue(
  valueStr: string,
  defaultUnit: string,
  defaultRange: string
): { value: string; unit: string; referenceRange: string; isAbnormal: boolean; isCritical?: boolean; abnormalDirection?: 'high' | 'low' } | null {
  if (!valueStr || typeof valueStr !== 'string') return null;
  
  // Extract numeric value
  const numMatch = valueStr.match(/[\d.]+/);
  if (!numMatch) return null;
  
  const value = numMatch[0];
  const lowerStr = valueStr.toLowerCase();
  
  // Determine abnormality
  const isDecreased = lowerStr.includes('decreased') || lowerStr.includes('low');
  const isIncreased = lowerStr.includes('increased') || lowerStr.includes('high') || lowerStr.includes('elevated');
  const isNormal = lowerStr.includes('normal') || lowerStr.includes('wnl');
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

/**
 * GET /api/drills/lab-cases
 * Query params:
 * - category: Filter by category (hematology, metabolic, etc.)
 * - limit: Max number of cases to return (default 20)
 * - shuffle: Whether to randomize order (default true)
 */
export async function onRequestGet(context: any): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse query params
    const url = new URL(context.request.url);
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const shuffle = url.searchParams.get('shuffle') !== 'false';

    // Fetch lab cases from database
    const dbCases = await prisma.labCase.findMany({
      take: limit * 2, // Fetch extra to allow filtering after transform
    });

    // Transform to frontend format
    let transformedCases = dbCases
      .map(transformLabCase)
      .filter(c => c.panels.length > 0); // Only include cases with valid panels

    // Filter by category if specified
    if (category && category !== 'random') {
      transformedCases = transformedCases.filter(c => c.category === category);
    }

    // Shuffle if requested
    if (shuffle) {
      transformedCases = transformedCases.sort(() => Math.random() - 0.5);
    }

    // Limit results
    transformedCases = transformedCases.slice(0, limit);

    return new Response(JSON.stringify({
      success: true,
      cases: transformedCases,
      total: transformedCases.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching lab cases:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lab cases',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET all unique diagnoses (for autocomplete/validation)
 */
export async function onRequestPost(context: any): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate input with Zod schema
    const validation = await validateRequest(context.request.clone(), LabCasesActionSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { action } = (validation as { success: true; data: any }).data;

    if (action === 'getDiagnoses') {
      const cases = await prisma.labCase.findMany({
        select: { correctDiagnosis: true },
      });
      
      const diagnoses = [...new Set(cases.map(c => c.correctDiagnosis))].sort();
      
      return new Response(JSON.stringify({
        success: true,
        diagnoses,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing lab cases request:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
}
