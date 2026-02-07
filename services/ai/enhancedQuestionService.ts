/**
 * Enhanced Question Generation Service
 *
 * Generates high-quality PANCE questions by leveraging the rich database content.
 * Uses MedicalContent, Condition, and linked entities for contextual generation.
 */

import type { Question, SessionSettings } from '@/types';
import {
  getWeightedRandomSystem,
  getWeightedRandomTask,
  recordQuestion,
  normalizeSystemCode,
  PANCE_SYSTEM_PERCENTAGES,
} from './panceDistributionService';

interface DatabaseCondition {
  id: string;
  name: string;
  system: string;
  subcategory?: string;
  content?: {
    overview?: string;
    symptoms?: string;
    diagnostics?: string;
    treatment?: string;
    clinicalPresentation?: string;
    epidemiology?: string;
    complications?: string;
    differentialDiagnosis?: string;
    physicalExam?: string;
    keyPoints?: string[];
    buzzwords?: string[];
    classic_triad?: string[];
    clinical_pearls?: string[];
    first_line_rx?: string;
    gold_standard_dx?: string;
    best_initial_test?: string;
    classic_patient?: string;
    mnemonic?: string;
  };
  buzzwords?: string[];
  aliases?: string[];
}

interface EnhancedQuestionContext {
  condition: DatabaseCondition;
  linkedEntities: {
    labs?: Array<{ name: string; significance: string; normalRange?: string }>;
    imaging?: Array<{ name: string; findings: string }>;
    drugs?: Array<{ name: string; mechanism?: string; indication?: string }>;
    anatomy?: Array<{ name: string; clinicalSignificance?: string }>;
  };
  task: string;
}

/**
 * Fetch a random published condition from the database by system
 */
async function fetchRandomConditionBySystem(system: string): Promise<DatabaseCondition | null> {
  try {
    const response = await fetch(
      `/api/conditions?system=${system}&status=published&random=true&limit=1`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { conditions?: DatabaseCondition[] };
    if (data.conditions && data.conditions.length > 0) {
      return data.conditions[0];
    }
    return null;
  } catch (error: unknown) {
    console.warn('[EnhancedQuestionService] Failed to fetch condition:', error);
    return null;
  }
}

/**
 * Fetch linked entities for a condition
 */
async function fetchLinkedEntities(
  conditionId: string
): Promise<EnhancedQuestionContext['linkedEntities']> {
  const entities: EnhancedQuestionContext['linkedEntities'] = {};

  try {
    // Fetch lab tests linked to this condition
    const labResponse = await fetch(`/api/labtests?conditionId=${conditionId}&limit=5`);
    if (labResponse.ok) {
      const labData = (await labResponse.json()) as { labTests?: EnhancedQuestionContext['linkedEntities']['labs'] };
      entities.labs = labData.labTests?.slice(0, 5);
    }

    // Fetch imaging studies linked to this condition
    const imagingResponse = await fetch(`/api/imaging?conditionId=${conditionId}&limit=3`);
    if (imagingResponse.ok) {
      const imagingData = (await imagingResponse.json()) as { imagingStudies?: EnhancedQuestionContext['linkedEntities']['imaging'] };
      entities.imaging = imagingData.imagingStudies?.slice(0, 3);
    }

    // Fetch drugs linked to this condition
    // Ensure valid query params are always sent (default to empty object to avoid 400)
    const drugParams = new URLSearchParams();
    if (conditionId) {
      drugParams.set('conditionId', conditionId);
    }
    drugParams.set('limit', '5');
    const drugResponse = await fetch(`/api/drugs?${drugParams.toString()}`);
    if (drugResponse.ok) {
      const drugData = (await drugResponse.json()) as { drugs?: EnhancedQuestionContext['linkedEntities']['drugs'] };
      entities.drugs = drugData.drugs?.slice(0, 5);
    }
  } catch (error: unknown) {
    console.warn('[EnhancedQuestionService] Failed to fetch linked entities:', error);
  }

  return entities;
}

/**
 * Build rich context string for question generation
 */
function buildEnhancedContext(context: EnhancedQuestionContext): string {
  const { condition, linkedEntities, task } = context;
  const content = condition.content || {};

  let contextStr = `## Condition: ${condition.name}
System: ${condition.system}
${condition.subcategory ? `Subcategory: ${condition.subcategory}` : ''}

### Overview
${content.overview || 'Not available'}

### Clinical Presentation
${content.clinicalPresentation || content.symptoms || 'Not available'}

### Key Findings
${content.physicalExam || 'Physical exam findings not specified'}

`;

  // Add buzzwords if available
  if (content.buzzwords && content.buzzwords.length > 0) {
    contextStr += `### Buzzwords/Classic Findings
${content.buzzwords.join(', ')}

`;
  }

  // Add classic triad if available
  if (content.classic_triad && content.classic_triad.length > 0) {
    contextStr += `### Classic Triad
${content.classic_triad.join(', ')}

`;
  }

  // Add diagnostic information
  if (content.diagnostics || content.gold_standard_dx || content.best_initial_test) {
    contextStr += `### Diagnostics
${content.best_initial_test ? `Best Initial Test: ${content.best_initial_test}` : ''}
${content.gold_standard_dx ? `Gold Standard: ${content.gold_standard_dx}` : ''}
${content.diagnostics || ''}

`;
  }

  // Add treatment information
  if (content.treatment || content.first_line_rx) {
    contextStr += `### Treatment
${content.first_line_rx ? `First-Line: ${content.first_line_rx}` : ''}
${content.treatment || ''}

`;
  }

  // Add linked lab tests
  if (linkedEntities.labs && linkedEntities.labs.length > 0) {
    contextStr += `### Relevant Lab Tests
${linkedEntities.labs.map((lab) => `- ${lab.name}: ${lab.significance || ''}`).join('\n')}

`;
  }

  // Add linked imaging
  if (linkedEntities.imaging && linkedEntities.imaging.length > 0) {
    contextStr += `### Relevant Imaging
${linkedEntities.imaging.map((img) => `- ${img.name}: ${img.findings || ''}`).join('\n')}

`;
  }

  // Add clinical pearls
  if (content.clinical_pearls && content.clinical_pearls.length > 0) {
    contextStr += `### Clinical Pearls
${content.clinical_pearls.join('\n')}

`;
  }

  // Add task focus
  contextStr += `
## Question Requirements
- Task Focus: ${task}
- All questions must be at standard PANCE level
`;

  return contextStr;
}

/**
 * Generate question using enhanced database context
 */
export async function generateEnhancedQuestion(
  settings: SessionSettings,
  growthAreas: string[],
  enabledSystems?: Set<string>
): Promise<Question | null> {
  try {
    // Determine system based on PANCE distribution
    let targetSystem: string;

    if (settings.focus === 'topic' && settings.topic) {
      targetSystem = normalizeSystemCode(settings.topic) || settings.topic;
    } else if (settings.focus === 'growth' && growthAreas.length > 0) {
      // Pick from growth areas with some randomness
      targetSystem = growthAreas[Math.floor(Math.random() * growthAreas.length)] ?? getWeightedRandomSystem(enabledSystems);
    } else {
      // Use PANCE-weighted distribution
      targetSystem = getWeightedRandomSystem(enabledSystems);
    }

    // Get random task
    const task = getWeightedRandomTask();

    // Fetch a random condition from this system
    const condition = await fetchRandomConditionBySystem(targetSystem);

    if (!condition) {
      console.warn(`[EnhancedQuestionService] No condition found for system ${targetSystem}`);
      return null;
    }

    // Fetch linked entities for richer context
    const linkedEntities = await fetchLinkedEntities(condition.id);

    // Build enhanced context
    const context: EnhancedQuestionContext = {
      condition,
      linkedEntities,
      task,
    };

    // Generate question via API with enhanced context
    const response = await fetch('/api/questions/generate-enhanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: buildEnhancedContext(context),
        conditionId: condition.id,
        conditionName: condition.name,
        system: targetSystem,
        task,
      }),
    });

    if (!response.ok) {
      throw new Error(`Generation API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      question?: {
        id?: string;
        vignette?: string;
        question?: string;
        options?: string[];
        correctAnswerIndex?: number;
        rationale?: string;
        pearls?: string[];
      };
    };

    if (data.question) {
      // Record this question in distribution tracker
      recordQuestion(targetSystem, task);

      return {
        id: data.question.id || `enhanced-${Date.now()}`,
        question: data.question.vignette || data.question.question,
        options: Array.isArray(data.question.options) ? data.question.options : [],
        correctAnswerIndex: typeof data.question.correctAnswerIndex === 'number' ? data.question.correctAnswerIndex : 0,
        rationale: data.question.rationale,
        topic: condition.system,
        conditionId: condition.id,
        condition: condition.name,
        pearls: data.question.pearls || [],
        source: 'enhanced-generation',
        metadata: {
          task,
          subcategory: condition.subcategory,
          hasLinkedLabs: (linkedEntities.labs?.length || 0) > 0,
          hasLinkedImaging: (linkedEntities.imaging?.length || 0) > 0,
        },
      } as Question;
    }

    return null;
  } catch (error) {
    console.error('[EnhancedQuestionService] Generation failed:', error);
    return null;
  }
}

/**
 * Get condition statistics for a system
 */
export async function getSystemConditionStats(system: string): Promise<{
  total: number;
  published: number;
  hasContent: number;
}> {
  try {
    const response = await fetch(`/api/conditions/stats?system=${system}`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Ignore
  }
  return { total: 0, published: 0, hasContent: 0 };
}

/**
 * Check if a system has sufficient content for generation
 */
export async function systemHasSufficientContent(system: string): Promise<boolean> {
  const stats = await getSystemConditionStats(system);
  return stats.hasContent >= 5; // At least 5 conditions with content
}
