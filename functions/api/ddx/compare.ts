/**
 * GET /api/ddx/compare
 * 
 * Deep comparison of 2+ conditions with all linked entity data
 * Returns comprehensive comparison data from junction tables
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface DeepConditionData {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string;
  
  // Core clinical data
  classic_patient?: string;
  symptoms?: string;
  buzzwords?: string[];
  pathophysiology?: string;
  etiology?: string;
  riskFactors?: string;
  physicalExam?: string;
  
  // Diagnosis
  gold_standard_dx?: string;
  best_initial_test?: string;
  diagnostics?: string;
  differentialDiagnosis?: string;
  
  // Treatment
  first_line_rx?: string;
  treatment?: string;
  rx_mechanism?: string;
  rx_side_effects?: string;
  
  // Demographics
  age_demographic?: any;
  gender_bias?: string;
  
  // Prognosis
  complications?: string;
  prognosis?: string;
  prevention?: string;
  
  // PANCE relevance
  pance_yield?: number;
  clinical_pearls?: any;
  mnemonic?: string;
  
  // Linked entities (populated from junction tables)
  linkedLabs?: Array<{
    name: string;
    expectedResult?: string;
    significance?: string;
    isHighYield: boolean;
  }>;
  linkedImaging?: Array<{
    name: string;
    modality: string;
    expectedFindings?: string[];
    classicFindings?: string;
  }>;
  linkedFindings?: Array<{
    name: string;
    system: string;
    clinicalSignificance?: string;
    sensitivity?: number;
    specificity?: number;
  }>;
  linkedDrugs?: Array<{
    genericName: string;
    isFirstLine: boolean;
    mechanismOfAction?: string;
  }>;
  linkedScoringSystem?: Array<{
    name: string;
    category: string;
    whenToUse?: string;
  }>;
}

export async function onRequestGet(context: any) {
  const { request, env } = context;
  
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(request.url);
  const conditionIds = url.searchParams.get('ids')?.split(',').filter(Boolean) || [];
  
  if (conditionIds.length < 2) {
    return new Response(
      JSON.stringify({ error: 'At least 2 condition IDs required (comma-separated)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (conditionIds.length > 5) {
    return new Response(
      JSON.stringify({ error: 'Maximum 5 conditions for comparison' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Fetch all conditions with their MedicalContent
    const conditions = await Promise.all(
      conditionIds.map(async (id) => {
        // Get MedicalContent
        const medicalContent = await prisma.medicalContent.findUnique({
          where: { id },
          select: {
            id: true,
            conditionId: true,
            condition: true,
            system: true,
            subcategory: true,
            content: true,
            buzzwords: true,
            symptoms: true,
            pathophysiology: true,
            etiology: true,
            riskFactors: true,
            physicalExam: true,
            diagnostics: true,
            differentialDiagnosis: true,
            treatment: true,
            complications: true,
            prognosis: true,
            overview: true,
            gold_standard_dx: true,
            best_initial_test: true,
            first_line_rx: true,
            rx_mechanism: true,
            rx_side_effects: true,
            age_demographic: true,
            gender_bias: true,
            classic_patient: true,
            pance_yield: true,
            clinical_pearls: true,
            mnemonic: true,
            prevention: true,
          },
        });

        if (!medicalContent) return null;

        // Fetch linked entities in parallel
        const [labs, imaging, findings, drugs, scoringSystems] = await Promise.all([
          // Linked Labs
          prisma.labConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              LabTest: {
                select: {
                  name: true,
                  category: true,
                  isHighYield: true,
                  panceYield: true,
                },
              },
            },
            take: 10,
          }),
          
          // Linked Imaging
          prisma.imagingConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              ImagingStudy: {
                select: {
                  name: true,
                  modality: true,
                  classicSigns: true,
                  isHighYield: true,
                },
              },
            },
            take: 10,
          }),
          
          // Linked Physical Exam Findings
          prisma.findingConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              PhysicalExamFinding: {
                select: {
                  name: true,
                  system: true,
                  clinicalSignificance: true,
                  sensitivity: true,
                  specificity: true,
                },
              },
            },
            take: 10,
          }),
          
          // Linked Drugs
          prisma.drugConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              Drug: {
                select: {
                  genericName: true,
                  brandName: true,
                  mechanismOfAction: true,
                  isFirstLine: true,
                },
              },
            },
            take: 10,
          }),
          
          // Linked Scoring Systems
          prisma.scoringSystemConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              ScoringSystem: {
                select: {
                  name: true,
                  category: true,
                  whenToUse: true,
                },
              },
            },
            take: 5,
          }),
        ]);

        return {
          ...medicalContent,
          linkedLabs: labs.map(l => ({
            name: l.LabTest.name,
            expectedResult: l.expectedResult,
            significance: l.significance,
            isHighYield: l.LabTest.isHighYield,
          })),
          linkedImaging: imaging.map(i => ({
            name: i.ImagingStudy.name,
            modality: i.ImagingStudy.modality,
            expectedFindings: i.expectedFindings,
            classicFindings: i.classicFindings,
          })),
          linkedFindings: findings.map(f => ({
            name: f.PhysicalExamFinding.name,
            system: f.PhysicalExamFinding.system,
            clinicalSignificance: f.PhysicalExamFinding.clinicalSignificance,
            sensitivity: f.sensitivity,
            specificity: f.specificity,
          })),
          linkedDrugs: drugs.map(d => ({
            genericName: d.Drug.genericName,
            brandName: d.Drug.brandName,
            isFirstLine: d.isFirstLine,
            mechanismOfAction: d.Drug.mechanismOfAction,
          })),
          linkedScoringSystem: scoringSystems.map(s => ({
            name: s.ScoringSystem.name,
            category: s.ScoringSystem.category,
            whenToUse: s.ScoringSystem.whenToUse,
          })),
        } as DeepConditionData;
      })
    );

    // Filter out nulls
    const validConditions = conditions.filter((c): c is DeepConditionData => c !== null);

    if (validConditions.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Not enough valid conditions found for comparison' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Compute discriminating features (fields that differ between conditions)
    const discriminatingFeatures: string[] = [];
    const fieldsToCheck = [
      'classic_patient', 'gold_standard_dx', 'best_initial_test', 
      'first_line_rx', 'age_demographic', 'gender_bias',
    ];
    
    fieldsToCheck.forEach(field => {
      const values = validConditions.map(c => c[field as keyof DeepConditionData]);
      const uniqueValues = new Set(values.filter(v => v != null));
      if (uniqueValues.size > 1) {
        discriminatingFeatures.push(field);
      }
    });

    // Find unique labs/imaging/findings for each condition
    const uniqueEntities = validConditions.map(condition => {
      const otherConditions = validConditions.filter(c => c.id !== condition.id);
      const otherLabNames = new Set(otherConditions.flatMap(c => c.linkedLabs?.map(l => l.name) || []));
      const otherImagingNames = new Set(otherConditions.flatMap(c => c.linkedImaging?.map(i => i.name) || []));
      
      return {
        conditionId: condition.id,
        uniqueLabs: condition.linkedLabs?.filter(l => !otherLabNames.has(l.name)) || [],
        uniqueImaging: condition.linkedImaging?.filter(i => !otherImagingNames.has(i.name)) || [],
      };
    });

    return new Response(
      JSON.stringify({
        conditions: validConditions,
        discriminatingFeatures,
        uniqueEntities,
        comparisonFields: [
          // Presentation
          { key: 'classic_patient', label: 'Classic Patient', category: 'presentation' },
          { key: 'symptoms', label: 'Symptoms', category: 'presentation' },
          { key: 'buzzwords', label: 'Buzzwords', category: 'presentation' },
          { key: 'physicalExam', label: 'Physical Exam', category: 'presentation' },
          
          // Demographics
          { key: 'age_demographic', label: 'Age', category: 'demographics' },
          { key: 'gender_bias', label: 'Gender Bias', category: 'demographics' },
          { key: 'riskFactors', label: 'Risk Factors', category: 'demographics' },
          
          // Pathophysiology
          { key: 'pathophysiology', label: 'Pathophysiology', category: 'pathophysiology' },
          { key: 'etiology', label: 'Etiology', category: 'pathophysiology' },
          
          // Diagnosis
          { key: 'gold_standard_dx', label: 'Gold Standard Dx', category: 'diagnosis' },
          { key: 'best_initial_test', label: 'Best Initial Test', category: 'diagnosis' },
          { key: 'diagnostics', label: 'Diagnostics', category: 'diagnosis' },
          { key: 'linkedLabs', label: 'Labs', category: 'diagnosis', isLinkedEntity: true },
          { key: 'linkedImaging', label: 'Imaging', category: 'diagnosis', isLinkedEntity: true },
          { key: 'linkedFindings', label: 'Exam Findings', category: 'diagnosis', isLinkedEntity: true },
          
          // Treatment
          { key: 'first_line_rx', label: 'First-Line Rx', category: 'treatment' },
          { key: 'treatment', label: 'Treatment', category: 'treatment' },
          { key: 'rx_mechanism', label: 'Rx Mechanism', category: 'treatment' },
          { key: 'linkedDrugs', label: 'Medications', category: 'treatment', isLinkedEntity: true },
          
          // Prognosis
          { key: 'complications', label: 'Complications', category: 'prognosis' },
          { key: 'prognosis', label: 'Prognosis', category: 'prognosis' },
          { key: 'prevention', label: 'Prevention', category: 'prognosis' },
        ],
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error comparing conditions:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to compare conditions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await prisma.$disconnect();
  }
}
