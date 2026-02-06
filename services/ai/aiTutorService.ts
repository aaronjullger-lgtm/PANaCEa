/**
 * AI Tutor Service
 * 
 * Integrates Google AI Studio's ask_the_manual (Grounding API) to provide
 * RAG-based clinical tutoring backed by uploaded textbooks and study materials.
 * 
 * Features:
 * - Upload clinical resources to Gemini corpus
 * - Query with grounded citations
 * - Progressive hint system
 * - Contextual tutoring during OSCE
 * - Post-encounter debrief
 * 
 * @module aiTutorService
 */

import type {
  ClinicalResource,
  TutorQuery,
  TutorResponse,
  Citation,
  AskTheManualRequest,
  AskTheManualResponse,
  ProgressiveHintSequence,
  HintLevel,
  ContextualIntervention,
  OSCEDebrief,
} from '@/types/ai-tutor-system';

interface AITutorConfig {
  geminiApiKey: string;
  apiEndpoint?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export class AITutorService {
  private config: AITutorConfig;
  private corpusCache: Map<string, string> = new Map(); // resourceId -> corpusId

  constructor(config: AITutorConfig) {
    this.config = {
      apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
      defaultTemperature: 0.3, // Lower temp for factual accuracy
      defaultMaxTokens: 2048,
      ...config,
    };
  }

  /**
   * Upload a clinical resource to ask_the_manual corpus.
   */
  async uploadResource(resource: ClinicalResource): Promise<string> {
    const startTime = Date.now();

    try {
      // 1. Create corpus
      const corpusResponse = await fetch(
        `${this.config.apiEndpoint}/corpora?key=${this.config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: resource.title,
            description: `${resource.type} - ${resource.specialty}`,
          }),
        }
      );

      if (!corpusResponse.ok) {
        throw new Error(`Failed to create corpus: ${corpusResponse.statusText}`);
      }

      const corpusData = await corpusResponse.json();
      const corpusId = corpusData.name; // e.g., "corpora/my-corpus-id"

      // 2. Upload document to corpus
      const documentResponse = await fetch(
        `${this.config.apiEndpoint}/${corpusId}/documents?key=${this.config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: resource.title,
            mimeType: this.getMimeType(resource.format),
            uri: resource.fileUrl, // Must be publicly accessible or use inline_data
          }),
        }
      );

      if (!documentResponse.ok) {
        throw new Error(`Failed to upload document: ${documentResponse.statusText}`);
      }

      // 3. Cache corpus ID
      this.corpusCache.set(resource.id, corpusId);

      console.log(`Uploaded resource ${resource.title} in ${Date.now() - startTime}ms`);
      return corpusId;
    } catch (error) {
      console.error('Resource upload error:', error);
      throw error;
    }
  }

  /**
   * Query the AI tutor with grounded knowledge.
   */
  async query(query: TutorQuery): Promise<TutorResponse> {
    const startRetrievalTime = Date.now();

    // Build corpus list
    const corpusIds = await this.getRelevantCorpora(query);

    if (corpusIds.length === 0) {
      throw new Error('No relevant resources found for query');
    }

    // Build context-aware prompt
    const prompt = this.buildPrompt(query);

    // Build ask_the_manual request
    const request: AskTheManualRequest = {
      query: prompt,
      corpusIds,
      maxResults: 10,
      minRelevanceScore: 0.3,
      generationConfig: {
        temperature: this.config.defaultTemperature,
        maxOutputTokens: this.config.defaultMaxTokens,
      },
    };

    const retrievalTime = Date.now() - startRetrievalTime;
    const startGenerationTime = Date.now();

    // Call Gemini Grounding API
    const response = await this.callGroundingAPI(request);

    const generationTime = Date.now() - startGenerationTime;

    // Parse citations
    const citations = this.parseCitations(response, query);

    // Extract teaching points
    const teachingPoints = this.extractTeachingPoints(response.answer);

    // Generate follow-up questions
    const followUpQuestions = this.generateFollowUpQuestions(query, response.answer);

    return {
      id: `response-${Date.now()}`,
      queryId: query.id,
      answer: response.answer,
      citations,
      confidence: this.calculateConfidence(response),
      hintLevel: query.hintLevel,
      followUpQuestions,
      teachingPoints,
      latency: {
        retrievalMs: retrievalTime,
        generationMs: generationTime,
        totalMs: retrievalTime + generationTime,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get progressive hint for a diagnostic scenario.
   */
  async getProgressiveHint(
    sequence: ProgressiveHintSequence,
    nextLevel: HintLevel
  ): Promise<string> {
    const hints = sequence.hints[nextLevel];

    if (Array.isArray(hints) && hints.length > 0) {
      // Return first hint at this level
      return hints[0];
    }

    // If no pre-defined hint, generate one
    const query: TutorQuery = {
      id: `hint-${Date.now()}`,
      question: `Provide a ${nextLevel} hint for diagnosing this case`,
      context: 'osce_active',
      hintLevel: nextLevel,
      relatedCaseId: sequence.scenarioId,
      userId: 'system',
      timestamp: new Date().toISOString(),
    };

    const response = await this.query(query);
    return response.answer;
  }

  /**
   * Provide contextual intervention during OSCE.
   */
  async provideIntervention(
    caseId: string,
    trigger: ContextualIntervention['trigger'],
    context: TutorQuery['clinicalContext']
  ): Promise<ContextualIntervention> {
    const query: TutorQuery = {
      id: `intervention-${Date.now()}`,
      question: this.buildInterventionQuery(trigger, context),
      context: 'osce_active',
      hintLevel: 'moderate',
      relatedCaseId: caseId,
      clinicalContext: context,
      userId: 'system',
      timestamp: new Date().toISOString(),
    };

    const response = await this.query(query);

    return {
      type: this.determineInterventionType(trigger),
      trigger,
      message: response.answer,
      citations: response.citations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate post-OSCE debrief with AI tutor.
   */
  async generateDebrief(
    sessionId: string,
    caseDetails: OSCEDebrief['case'],
    performance: OSCEDebrief['performance']
  ): Promise<OSCEDebrief> {
    const query: TutorQuery = {
      id: `debrief-${Date.now()}`,
      question: this.buildDebriefQuery(caseDetails, performance),
      context: 'post_osce_review',
      hintLevel: 'explicit',
      relatedCaseId: sessionId,
      userId: 'system',
      timestamp: new Date().toISOString(),
    };

    const response = await this.query(query);

    // Parse structured debrief from response
    const analysis = this.parseDebriefAnalysis(response.answer, performance);

    return {
      sessionId,
      case: caseDetails,
      performance,
      analysis: {
        ...analysis,
        citations: response.citations,
      },
      recommendedResources: await this.getRecommendedResources(caseDetails),
      nextCaseRecommendations: response.relatedTopics || [],
      timestamp: new Date().toISOString(),
    };
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Get relevant corpora for a query.
   */
  private async getRelevantCorpora(query: TutorQuery): Promise<string[]> {
    const corpusIds: string[] = [];

    // If specific resources requested, use those
    if (query.resourceFilters?.resourceIds) {
      for (const resourceId of query.resourceFilters.resourceIds) {
        const corpusId = this.corpusCache.get(resourceId);
        if (corpusId) corpusIds.push(corpusId);
      }
    }

    // If collections requested, expand to resources
    if (query.resourceFilters?.collectionIds) {
      // Fetch collection resources from database
      // For now, use all cached corpora
      corpusIds.push(...Array.from(this.corpusCache.values()));
    }

    // If no filters, use all available corpora
    if (corpusIds.length === 0) {
      corpusIds.push(...Array.from(this.corpusCache.values()));
    }

    return [...new Set(corpusIds)]; // Deduplicate
  }

  /**
   * Build context-aware prompt.
   */
  private buildPrompt(query: TutorQuery): string {
    let prompt = '';

    // Add clinical context if available
    if (query.clinicalContext) {
      prompt += 'Clinical Context:\n';
      prompt += `- Patient: ${query.clinicalContext.patientAge}yo ${query.clinicalContext.patientSex}\n`;
      prompt += `- Chief Complaint: ${query.clinicalContext.chiefComplaint}\n`;
      if (query.clinicalContext.vitals) {
        prompt += `- Vitals: ${JSON.stringify(query.clinicalContext.vitals)}\n`;
      }
      prompt += '\n';
    }

    // Add hint level instruction
    prompt += this.getHintLevelInstruction(query.hintLevel);

    // Add the actual question
    prompt += `\n\nQuestion: ${query.question}\n\n`;

    // Add conversation history if available
    if (query.conversationHistory && query.conversationHistory.length > 0) {
      prompt += 'Previous conversation:\n';
      for (const turn of query.conversationHistory.slice(-3)) {
        prompt += `Q: ${turn.question}\nA: ${turn.answer}\n\n`;
      }
    }

    return prompt;
  }

  /**
   * Get instruction for hint level.
   */
  private getHintLevelInstruction(level: HintLevel): string {
    switch (level) {
      case 'subtle':
        return 'Provide a subtle hint that guides thinking without giving away the answer. Focus on asking leading questions or highlighting general categories.';
      case 'moderate':
        return 'Provide a moderate hint that narrows down the possibilities. Mention key clinical features or diagnostic categories to consider.';
      case 'explicit':
        return 'Provide an explicit hint that clearly points toward the answer. State the diagnosis or key finding directly, but explain the reasoning.';
      case 'answer':
        return 'Provide the complete answer with full explanation, citations, and teaching points.';
    }
  }

  /**
   * Call Gemini Grounding API.
   */
  private async callGroundingAPI(request: AskTheManualRequest): Promise<AskTheManualResponse> {
    const response = await fetch(
      `${this.config.apiEndpoint}/models/gemini-pro:generateGroundedContent?key=${this.config.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: request.query }],
            },
          ],
          groundingConfig: {
            groundingSources: [
              {
                semanticRetriever: {
                  sources: request.corpusIds.map((id) => ({ name: id })),
                  maxChunks: request.maxResults || 10,
                  minRelevanceScore: request.minRelevanceScore || 0.3,
                },
              },
            ],
          },
          generationConfig: request.generationConfig,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Grounding API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      answer: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      groundingAttributions: data.candidates?.[0]?.groundingMetadata?.groundingAttributions || [],
    };
  }

  /**
   * Parse citations from grounding response.
   */
  private parseCitations(
    response: AskTheManualResponse,
    query: TutorQuery
  ): Citation[] {
    const citations: Citation[] = [];

    for (const attr of response.groundingAttributions) {
      const resourceId = this.findResourceIdByCorpusId(attr.sourceId.corpusId);
      if (!resourceId) continue;

      citations.push({
        resourceId,
        resourceTitle: 'Clinical Resource', // TODO: Look up from database
        excerpt: attr.content.text,
        relevanceScore: attr.retrievalScore,
        citationString: `[${resourceId}] ${attr.content.text.slice(0, 100)}...`,
      });
    }

    return citations;
  }

  /**
   * Find resource ID by corpus ID.
   */
  private findResourceIdByCorpusId(corpusId: string): string | undefined {
    for (const [resourceId, cachedCorpusId] of this.corpusCache.entries()) {
      if (cachedCorpusId === corpusId) {
        return resourceId;
      }
    }
    return undefined;
  }

  /**
   * Calculate confidence score.
   */
  private calculateConfidence(response: AskTheManualResponse): number {
    if (response.groundingAttributions.length === 0) {
      return 0.5; // Low confidence without grounding
    }

    const avgRelevance =
      response.groundingAttributions.reduce((sum, attr) => sum + attr.retrievalScore, 0) /
      response.groundingAttributions.length;

    return Math.min(0.95, 0.5 + avgRelevance * 0.5); // Scale 0.5-0.95
  }

  /**
   * Extract teaching points from answer.
   */
  private extractTeachingPoints(answer: string): string[] {
    // Simple extraction - look for numbered lists or bullet points
    const lines = answer.split('\n');
    const teachingPoints: string[] = [];

    for (const line of lines) {
      if (/^[\d•\-*]\s+/.test(line.trim())) {
        teachingPoints.push(line.trim().replace(/^[\d•\-*]\s+/, ''));
      }
    }

    return teachingPoints.slice(0, 5); // Max 5 points
  }

  /**
   * Generate follow-up questions.
   */
  private generateFollowUpQuestions(query: TutorQuery, answer: string): string[] {
    // Placeholder - in production, use another LLM call to generate relevant follow-ups
    return [
      'What are the key risk factors for this condition?',
      'What diagnostic tests would you order?',
      'How would you manage this patient?',
    ];
  }

  /**
   * Build intervention query.
   */
  private buildInterventionQuery(
    trigger: ContextualIntervention['trigger'],
    context?: TutorQuery['clinicalContext']
  ): string {
    if (trigger.event === 'time_elapsed') {
      return `The student has been working on this case for ${trigger.threshold} seconds without progress. Provide guidance.`;
    } else if (trigger.event === 'wrong_action') {
      return 'The student has taken an incorrect action. Provide corrective feedback.';
    } else if (trigger.event === 'missed_critical_finding') {
      return 'The student has missed a critical finding. Provide a hint to redirect attention.';
    } else {
      return 'Provide tutoring for this clinical scenario.';
    }
  }

  /**
   * Determine intervention type.
   */
  private determineInterventionType(trigger: ContextualIntervention['trigger']): ContextualIntervention['type'] {
    if (trigger.event === 'wrong_action') return 'correction';
    if (trigger.event === 'missed_critical_finding') return 'hint';
    if (trigger.event === 'time_elapsed') return 'encouragement';
    return 'teaching_point';
  }

  /**
   * Build debrief query.
   */
  private buildDebriefQuery(
    caseDetails: OSCEDebrief['case'],
    performance: OSCEDebrief['performance']
  ): string {
    return `Provide a comprehensive debrief for this OSCE case:

Diagnosis: ${caseDetails.diagnosis}
Chief Complaint: ${caseDetails.chiefComplaint}

Student Performance:
- Correct Diagnosis: ${performance.correctDiagnosis ? 'Yes' : 'No'}
- Essential Questions Asked: ${performance.essentialQuestionsAsked.join(', ')}
- Critical Findings Missed: ${performance.criticalFindingsMissed.join(', ')}
- Time to Action: ${performance.timeToAction}s

Provide:
1. Strengths (what the student did well)
2. Areas for improvement
3. Key teaching points
4. Recommended next steps for learning`;
  }

  /**
   * Parse debrief analysis.
   */
  private parseDebriefAnalysis(
    answer: string,
    performance: OSCEDebrief['performance']
  ): Pick<OSCEDebrief['analysis'], 'strengths' | 'areasForImprovement' | 'teachingPoints'> {
    // Simple parsing - in production, use structured output
    const sections = answer.split(/\d+\.\s+/);

    return {
      strengths: this.extractListItems(sections[1] || ''),
      areasForImprovement: this.extractListItems(sections[2] || ''),
      teachingPoints: this.extractListItems(sections[3] || ''),
    };
  }

  /**
   * Extract list items from text.
   */
  private extractListItems(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') || line.startsWith('•'))
      .map((line) => line.replace(/^[-•]\s*/, ''));
  }

  /**
   * Get recommended resources based on case.
   */
  private async getRecommendedResources(caseDetails: OSCEDebrief['case']): Promise<ClinicalResource[]> {
    // Placeholder - in production, query database for relevant resources
    return [];
  }

  /**
   * Get MIME type for resource format.
   */
  private getMimeType(format: ClinicalResource['format']): string {
    switch (format) {
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'rtf':
        return 'application/rtf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  }
}

/**
 * Factory function for creating AI Tutor Service.
 */
export function createAITutorService(geminiApiKey: string): AITutorService {
  return new AITutorService({ geminiApiKey });
}
