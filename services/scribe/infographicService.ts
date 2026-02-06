/**
 * Infographic Generation Service
 * 
 * Dynamic remediation graphics using Google AI Studio's info_genius.
 * Generates tailored visual learning aids when students make mistakes or need clarification.
 * 
 * Features:
 * - Side-by-side comparisons (e.g., Erythema Nodosum vs. Migrans)
 * - Algorithm flowcharts
 * - Differential diagnosis tables
 * - Mnemonic visualizations
 * - Audience-appropriate complexity
 * 
 * @module infographicService
 */

import type {
  InfographicRequest,
  GeneratedInfographic,
  RemediationGraphicsLibrary,
  InfographicType,
} from '@/types/smart-scribe-system';

interface InfoGraphicServiceConfig {
  geminiApiKey: string;
  apiEndpoint?: string;
  cacheEnabled?: boolean;
}

export class InfoGraphicService {
  private config: InfoGraphicServiceConfig;
  private library: RemediationGraphicsLibrary;

  constructor(config: InfoGraphicServiceConfig) {
    this.config = {
      apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
      cacheEnabled: true,
      ...config,
    };

    this.library = {
      id: 'library-main',
      infographics: new Map(),
      commonComparisons: [],
      preGeneratedLibrary: [],
    };
  }

  /**
   * Generate infographic for student confusion.
   */
  async generateInfographic(request: InfographicRequest): Promise<GeneratedInfographic> {
    const startTime = Date.now();

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = await this.checkCache(request);
      if (cached) return cached;
    }

    // Build prompt based on infographic type
    const prompt = this.buildPrompt(request);

    // Call info_genius API
    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/models/info-genius:generate?key=${this.config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            style: request.complexity,
            format: 'svg', // SVG for interactive elements
            colorScheme: request.colorScheme,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Info Genius API error: ${response.statusText}`);
      }

      const data = await response.json();

      const infographic: GeneratedInfographic = {
        id: `infographic-${Date.now()}`,
        requestId: request.id,
        imageUrl: data.imageUrl,
        svgMarkup: data.svgMarkup,
        thumbnailUrl: data.thumbnailUrl,
        title: this.generateTitle(request),
        description: this.generateDescription(request),
        keyTakeaways: request.teachingPoints,
        interactiveElements: this.extractInteractiveElements(data.svgMarkup),
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'info-genius',
          generationTime: Date.now() - startTime,
          cost: 0.05, // Placeholder
        },
        status: 'ready',
      };

      // Cache it
      this.library.infographics.set(infographic.id, infographic);

      return infographic;
    } catch (error) {
      console.error('Infographic generation error:', error);

      return {
        id: `error-${Date.now()}`,
        requestId: request.id,
        imageUrl: '',
        thumbnailUrl: '',
        title: 'Generation Failed',
        description: String(error),
        keyTakeaways: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'info-genius',
          generationTime: Date.now() - startTime,
        },
        status: 'failed',
        error: String(error),
      };
    }
  }

  /**
   * Get pre-generated infographic by topic.
   */
  async getPreGeneratedInfographic(topic: string): Promise<GeneratedInfographic | null> {
    const entry = this.library.preGeneratedLibrary.find((e) => e.topic === topic);
    if (!entry) return null;

    return this.library.infographics.get(entry.infographicId) ?? null;
  }

  /**
   * Record student confusion for library building.
   */
  async recordConfusion(conceptA: string, conceptB: string): Promise<void> {
    const existing = this.library.commonComparisons.find(
      (c) =>
        (c.conceptA === conceptA && c.conceptB === conceptB) ||
        (c.conceptA === conceptB && c.conceptB === conceptA)
    );

    if (existing) {
      existing.frequency++;
    } else {
      this.library.commonComparisons.push({
        conceptA,
        conceptB,
        frequency: 1,
      });
    }

    // If frequency > threshold, pre-generate infographic
    if (existing && existing.frequency > 10 && !existing.infographicId) {
      const request: InfographicRequest = {
        id: `auto-${Date.now()}`,
        type: 'comparison',
        primaryConcept: conceptA,
        secondaryConcept: conceptB,
        confusionPoint: `Common confusion: ${conceptA} vs. ${conceptB}`,
        audience: 'student',
        complexity: 'moderate',
        teachingPoints: [],
        colorScheme: 'light',
      };

      const infographic = await this.generateInfographic(request);
      existing.infographicId = infographic.id;
    }
  }

  /**
   * Get most confused concept pairs.
   */
  getMostConfusedPairs(limit: number = 10): typeof this.library.commonComparisons {
    return [...this.library.commonComparisons]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Build prompt for info_genius based on infographic type.
   */
  private buildPrompt(request: InfographicRequest): string {
    const baseContext = `Generate a ${request.complexity} medical infographic for a ${request.audience}.

Confusion Point: ${request.confusionPoint}

Teaching Points:
${request.teachingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Color Scheme: ${request.colorScheme}`;

    switch (request.type) {
      case 'comparison':
        return `${baseContext}

Type: Side-by-Side Comparison
Primary Concept: ${request.primaryConcept}
Secondary Concept: ${request.secondaryConcept}

Create a visual comparison highlighting:
- Key distinguishing features
- Visual appearance differences
- Associated conditions
- Memory aids

${request.context ? `Context: ${request.context.caseContext}` : ''}`;

      case 'flowchart':
        return `${baseContext}

Type: Decision Tree / Flowchart
Topic: ${request.primaryConcept}

Create a step-by-step decision flowchart for diagnosing or managing ${request.primaryConcept}.
Include:
- Clear yes/no decision points
- Action boxes
- Warning signs
- End points (diagnoses or next steps)`;

      case 'differential_table':
        return `${baseContext}

Type: Differential Diagnosis Table
Primary Diagnosis: ${request.primaryConcept}
Student's Incorrect Answer: ${request.context?.studentAnswer}
Correct Answer: ${request.context?.correctAnswer}

Create a table comparing:
- Clinical features
- Key differentiating factors
- Diagnostic tests
- "Red flags" for each

Highlight why the correct answer fits better than the student's answer.`;

      case 'algorithm':
        return `${baseContext}

Type: Treatment/Diagnostic Algorithm
Topic: ${request.primaryConcept}

Create a step-by-step algorithm following clinical guidelines.
Include:
- Initial assessment steps
- Decision points
- Treatment pathways
- Escalation criteria`;

      case 'mnemonic_visual':
        return `${baseContext}

Type: Mnemonic Visualization
Concept: ${request.primaryConcept}

Create a memorable visual mnemonic.
Include:
- Visual representation of each letter/component
- Associated images
- Color coding
- Easy-to-recall layout`;

      default:
        return baseContext;
    }
  }

  /**
   * Generate title for infographic.
   */
  private generateTitle(request: InfographicRequest): string {
    switch (request.type) {
      case 'comparison':
        return `${request.primaryConcept} vs. ${request.secondaryConcept}`;
      case 'flowchart':
        return `${request.primaryConcept}: Decision Tree`;
      case 'differential_table':
        return `Differential Diagnosis: ${request.primaryConcept}`;
      case 'algorithm':
        return `${request.primaryConcept}: Management Algorithm`;
      case 'mnemonic_visual':
        return `Remember ${request.primaryConcept}`;
      default:
        return request.primaryConcept;
    }
  }

  /**
   * Generate description for infographic.
   */
  private generateDescription(request: InfographicRequest): string {
    return `Visual learning aid addressing: ${request.confusionPoint}`;
  }

  /**
   * Extract interactive elements from SVG markup.
   */
  private extractInteractiveElements(
    svgMarkup?: string
  ): GeneratedInfographic['interactiveElements'] {
    if (!svgMarkup) return undefined;

    // Placeholder - parse SVG for interactive elements
    // In production, look for data-interactive attributes
    return [];
  }

  /**
   * Check cache for existing infographic.
   */
  private async checkCache(request: InfographicRequest): Promise<GeneratedInfographic | null> {
    // Simple cache key based on concepts
    const cacheKey = `${request.primaryConcept}-${request.secondaryConcept}-${request.type}`;

    for (const [id, infographic] of this.library.infographics) {
      const infographicKey = `${infographic.title}-${infographic.metadata.model}`;
      if (infographicKey.includes(cacheKey)) {
        return infographic;
      }
    }

    return null;
  }
}

/**
 * Factory function.
 */
export function createInfoGraphicService(geminiApiKey: string): InfoGraphicService {
  return new InfoGraphicService({ geminiApiKey });
}

// ============================================================================
// PRE-GENERATED LIBRARY BUILDER
// ============================================================================

/**
 * Build library of high-yield comparisons.
 */
export async function buildHighYieldLibrary(
  service: InfoGraphicService
): Promise<void> {
  const highYieldComparisons = [
    { conceptA: 'Erythema Nodosum', conceptB: 'Erythema Migrans' },
    { conceptA: 'Crohns Disease', conceptB: 'Ulcerative Colitis' },
    { conceptA: 'Type 1 Diabetes', conceptB: 'Type 2 Diabetes' },
    { conceptA: 'STEMI', conceptB: 'NSTEMI' },
    { conceptA: 'Pneumonia', conceptB: 'Pulmonary Embolism' },
    { conceptA: 'Appendicitis', conceptB: 'Diverticulitis' },
    { conceptA: 'Viral Meningitis', conceptB: 'Bacterial Meningitis' },
    { conceptA: 'Nephritic Syndrome', conceptB: 'Nephrotic Syndrome' },
    { conceptA: 'Systolic Heart Failure', conceptB: 'Diastolic Heart Failure' },
    { conceptA: 'Basal Cell Carcinoma', conceptB: 'Squamous Cell Carcinoma' },
  ];

  for (const pair of highYieldComparisons) {
    const request: InfographicRequest = {
      id: `pregenerated-${Date.now()}`,
      type: 'comparison',
      primaryConcept: pair.conceptA,
      secondaryConcept: pair.conceptB,
      confusionPoint: `Common board exam confusion: ${pair.conceptA} vs. ${pair.conceptB}`,
      audience: 'student',
      complexity: 'moderate',
      teachingPoints: [
        `Key distinguishing features between ${pair.conceptA} and ${pair.conceptB}`,
        'Diagnostic criteria',
        'Treatment differences',
      ],
      colorScheme: 'light',
    };

    await service.generateInfographic(request);

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
