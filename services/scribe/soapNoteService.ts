/**
 * SOAP Note Service
 *
 * Real-time SOAP note generation during OSCE / patient encounter sessions.
 * The browser no longer holds a Gemini API key — all model access goes
 * through the authenticated `/api/scribe/soap/extract` edge endpoint, which
 * is itself backed by the unified AI Gateway.
 *
 * Sprint 4 migration notes:
 *   - Dropped `geminiApiKey` from the service config. Its removal closes the
 *     long-standing `VITE_GEMINI_API_KEY` browser-bundle leak.
 *   - `extractSOAPElements()` now POSTs `{ context, currentNote }` to the
 *     server and receives a Zod-validated partial SOAPNote back. Merging
 *     logic is unchanged so the draft-note mutation behavior is identical.
 *   - A `TokenProvider` is accepted at service construction so the service
 *     can work with either a pre-fetched Clerk token or the Clerk `getToken`
 *     function itself.
 *
 * Features (unchanged from the previous implementation):
 * - Background note drafting during encounter
 * - Element-by-element tracking with confidence scores
 * - Side-by-side comparison (student vs. AI)
 * - Missing element highlighting
 * - Completeness scoring
 *
 * @module soapNoteService
 */

import type {
  SOAPNote,
  SOAPElement,
  RealtimeSOAPGenerator,
  SOAPComparison,
  HPIElement,
} from '@/types/smart-scribe-system';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

/**
 * Pre-fetched token OR an async getter (e.g. Clerk's `getToken`). Keeping
 * the service transport-agnostic means callers can pass either shape.
 */
export type TokenProvider = string | null | (() => Promise<string | null>);

interface SOAPNoteServiceConfig {
  /** Clerk token source. When omitted the server middleware will 401. */
  tokenProvider?: TokenProvider;
  /** Poll cadence for the real-time draft generator. Defaults to 5 s. */
  updateInterval?: number;
  /** Confidence threshold for including AI-inferred elements. */
  confidenceThreshold?: number;
}

async function resolveToken(provider: TokenProvider | undefined): Promise<string | null> {
  if (!provider) return null;
  if (typeof provider === 'function') {
    try {
      return await provider();
    } catch {
      return null;
    }
  }
  return provider;
}

export class SOAPNoteService {
  private config: Required<Omit<SOAPNoteServiceConfig, 'tokenProvider'>> & {
    tokenProvider?: TokenProvider;
  };
  private activeGenerators: Map<string, RealtimeSOAPGenerator> = new Map();

  constructor(config: SOAPNoteServiceConfig = {}) {
    this.config = {
      updateInterval: 5000, // 5 seconds
      confidenceThreshold: 0.7,
      ...config,
    };
  }

  /**
   * Start real-time SOAP note generation for a session.
   */
  async startRealtimeGeneration(sessionId: string): Promise<string> {
    const generator: RealtimeSOAPGenerator = {
      id: `gen-${sessionId}`,
      sessionId,
      draftNote: this.createEmptySOAPNote(sessionId),
      transcriptBuffer: [],
      vitalsHistory: [],
      physicalFindingsHistory: [],
      status: 'listening',
      lastUpdateAt: new Date().toISOString(),
      config: {
        updateInterval: this.config.updateInterval,
        confidenceThreshold: this.config.confidenceThreshold,
        enableStreaming: true,
      },
    };

    this.activeGenerators.set(sessionId, generator);

    // Start periodic update loop
    this.startUpdateLoop(sessionId);

    return generator.id;
  }

  /**
   * Add transcript segment to the generator.
   */
  async addTranscript(
    sessionId: string,
    speaker: 'student' | 'patient',
    text: string
  ): Promise<void> {
    const generator = this.activeGenerators.get(sessionId);
    if (!generator) return;

    generator.transcriptBuffer.push({
      speaker,
      text,
      timestamp: new Date().toISOString(),
    });

    // If buffer is large enough, trigger update
    if (generator.transcriptBuffer.length >= 5) {
      await this.updateDraftNote(sessionId);
    }
  }

  /**
   * Add vitals update to the generator.
   */
  async addVitals(sessionId: string, vitals: Record<string, string | number>): Promise<void> {
    const generator = this.activeGenerators.get(sessionId);
    if (!generator) return;

    generator.vitalsHistory.push({
      vitals,
      timestamp: new Date().toISOString(),
    });

    // Trigger immediate update for vitals
    await this.updateDraftNote(sessionId);
  }

  /**
   * Add physical findings to the generator.
   */
  async addPhysicalFindings(sessionId: string, findings: Record<string, unknown>): Promise<void> {
    const generator = this.activeGenerators.get(sessionId);
    if (!generator) return;

    generator.physicalFindingsHistory.push({
      findings,
      timestamp: new Date().toISOString(),
    });

    await this.updateDraftNote(sessionId);
  }

  /**
   * Get current draft note.
   */
  getDraftNote(sessionId: string): SOAPNote | null {
    const generator = this.activeGenerators.get(sessionId);
    return generator?.draftNote ?? null;
  }

  /**
   * Finalize note (stop generation).
   */
  async finalizeNote(sessionId: string): Promise<SOAPNote> {
    const generator = this.activeGenerators.get(sessionId);
    if (!generator) {
      throw new Error(`No active generator for session ${sessionId}`);
    }

    generator.status = 'generating';

    // Final comprehensive update
    await this.updateDraftNote(sessionId);

    generator.status = 'complete';

    // Calculate completeness
    const completenessScore = this.calculateCompleteness(generator.draftNote);
    generator.draftNote.metadata.completenessScore = completenessScore;

    return generator.draftNote;
  }

  /**
   * Compare student note with AI gold standard.
   */
  async compareNotes(studentNote: SOAPNote, goldStandardNote: SOAPNote): Promise<SOAPComparison> {
    const elementComparison: SOAPComparison['elementComparison'] = [];

    // Compare HPI elements
    const hpiElements: HPIElement[] = [
      'chief_complaint',
      'onset',
      'location',
      'duration',
      'character',
      'aggravating_factors',
      'relieving_factors',
      'severity',
    ];

    for (const element of hpiElements) {
      const studentElement = studentNote.subjective.hpi[element];
      const goldElement = goldStandardNote.subjective.hpi[element];

      if (!goldElement) continue;

      let status: 'present' | 'missing' | 'incomplete' | 'incorrect';
      let feedback: string;
      let severity: 'critical' | 'important' | 'minor' = 'important';

      if (!studentElement) {
        status = 'missing';
        feedback = `Missing ${element.replace('_', ' ')}: ${goldElement.content}`;
        severity = goldElement.isCritical ? 'critical' : 'important';
      } else {
        const similarity = this.calculateSimilarity(studentElement.content, goldElement.content);

        if (similarity > 0.8) {
          status = 'present';
          feedback = `Good documentation of ${element.replace('_', ' ')}`;
        } else if (similarity > 0.5) {
          status = 'incomplete';
          feedback = `Partially documented ${element.replace('_', ' ')}. Consider including: ${goldElement.content}`;
        } else {
          status = 'incorrect';
          feedback = `Incorrect ${element.replace('_', ' ')}. Expected: ${goldElement.content}`;
          severity = 'critical';
        }
      }

      elementComparison.push({
        section: 'subjective',
        elementType: `hpi.${element}`,
        studentContent: studentElement?.content,
        goldStandardContent: goldElement.content,
        status,
        feedback,
        severity,
      });
    }

    // Compare vital signs
    if (goldStandardNote.objective.vitalSigns) {
      const studentVitals = studentNote.objective.vitalSigns;
      const goldVitals = goldStandardNote.objective.vitalSigns;

      elementComparison.push({
        section: 'objective',
        elementType: 'vitalSigns',
        studentContent: studentVitals?.content,
        goldStandardContent: goldVitals.content,
        status: studentVitals ? 'present' : 'missing',
        feedback: studentVitals ? 'Vital signs documented' : 'Missing vital signs documentation',
        severity: 'critical',
      });
    }

    // Compare assessment
    if (goldStandardNote.assessment.primaryDiagnosis) {
      const studentDx = studentNote.assessment.primaryDiagnosis;
      const goldDx = goldStandardNote.assessment.primaryDiagnosis;

      const dxCorrect = studentDx
        ? studentDx.content.toLowerCase() === goldDx.content.toLowerCase()
        : false;

      elementComparison.push({
        section: 'assessment',
        elementType: 'primaryDiagnosis',
        studentContent: studentDx?.content,
        goldStandardContent: goldDx.content,
        status: dxCorrect ? 'present' : studentDx ? 'incorrect' : 'missing',
        feedback: dxCorrect ? 'Correct diagnosis' : `Diagnosis should be: ${goldDx.content}`,
        severity: 'critical',
      });
    }

    // Calculate scores
    const scores = this.calculateComparisonScores(elementComparison);

    // Extract feedback
    const strengths = elementComparison
      .filter((e) => e.status === 'present')
      .map((e) => e.feedback)
      .slice(0, 3);

    const areasForImprovement = elementComparison
      .filter((e) => e.status !== 'present')
      .sort((a, b) => {
        const severityOrder = { critical: 0, important: 1, minor: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .map((e) => e.feedback)
      .slice(0, 5);

    const teachingPoints = this.generateTeachingPoints(elementComparison);

    return {
      id: `comparison-${Date.now()}`,
      studentNote,
      goldStandardNote,
      elementComparison,
      scores,
      strengths,
      areasForImprovement,
      teachingPoints,
    };
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Create empty SOAP note structure.
   */
  private createEmptySOAPNote(sessionId: string): SOAPNote {
    return {
      id: `note-${sessionId}`,
      sessionId,
      subjective: {
        chiefComplaint: this.createEmptyElement(),
        hpi: {
          chief_complaint: null,
          onset: null,
          location: null,
          duration: null,
          character: null,
          aggravating_factors: null,
          relieving_factors: null,
          timing: null,
          severity: null,
          associated_symptoms: null,
          previous_episodes: null,
          risk_factors: null,
        },
        reviewOfSystems: {},
      },
      objective: {
        vitalSigns: this.createEmptyElement(),
        physicalExam: {},
      },
      assessment: {
        primaryDiagnosis: this.createEmptyElement(),
        differentialDiagnoses: [],
        clinicalReasoning: this.createEmptyElement(),
      },
      plan: {},
      metadata: {
        author: 'ai_gold_standard',
        createdAt: new Date().toISOString(),
        wordCount: 0,
        completenessScore: 0,
      },
    };
  }

  /**
   * Create empty SOAP element.
   */
  private createEmptyElement(): SOAPElement {
    return {
      content: '',
      source: 'transcript',
      timestamp: new Date().toISOString(),
      confidence: 0,
      isCritical: false,
    };
  }

  /**
   * Start periodic update loop.
   */
  private startUpdateLoop(sessionId: string): void {
    const generator = this.activeGenerators.get(sessionId);
    if (!generator) return;

    const interval = setInterval(async () => {
      const gen = this.activeGenerators.get(sessionId);
      if (!gen || gen.status === 'complete') {
        clearInterval(interval);
        return;
      }

      await this.updateDraftNote(sessionId);
    }, generator.config.updateInterval);
  }

  /**
   * Update draft note from current transcript/vitals.
   */
  private async updateDraftNote(sessionId: string): Promise<void> {
    const generator = this.activeGenerators.get(sessionId);
    if (!generator) return;

    generator.status = 'generating';

    // Build context for the server-side extractor
    const context = this.buildContext(generator);

    // Skip the network round-trip when there's nothing to extract from —
    // this happens during the first poll before any transcript has arrived.
    if (!context.trim()) {
      generator.status = 'listening';
      return;
    }

    // Call the authenticated edge endpoint to extract SOAP elements
    const updatedNote = await this.extractSOAPElements(context, generator.draftNote);

    generator.draftNote = updatedNote;
    generator.lastUpdateAt = new Date().toISOString();
    generator.status = 'listening';
  }

  /**
   * Build context for the extraction model.
   */
  private buildContext(generator: RealtimeSOAPGenerator): string {
    let context = '';

    // Transcript
    if (generator.transcriptBuffer.length > 0) {
      context += 'Transcript:\n';
      for (const turn of generator.transcriptBuffer) {
        context += `${turn.speaker}: ${turn.text}\n`;
      }
      context += '\n';
    }

    // Latest vitals
    if (generator.vitalsHistory.length > 0) {
      const latestVitals = generator.vitalsHistory[generator.vitalsHistory.length - 1]!;
      context += `Vital Signs: ${JSON.stringify(latestVitals.vitals)}\n\n`;
    }

    // Latest physical findings
    if (generator.physicalFindingsHistory.length > 0) {
      const latestFindings =
        generator.physicalFindingsHistory[generator.physicalFindingsHistory.length - 1]!;
      context += `Physical Findings: ${JSON.stringify(latestFindings.findings)}\n\n`;
    }

    return context;
  }

  /**
   * Extract SOAP elements via the authenticated edge endpoint. Returns the
   * current note unchanged if the server call fails — the real-time loop is
   * best-effort and must never crash an in-progress encounter.
   */
  private async extractSOAPElements(context: string, currentNote: SOAPNote): Promise<SOAPNote> {
    const endpoint = getApiEndpoint('/api/scribe/soap/extract');
    const authToken = await resolveToken(this.config.tokenProvider);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          context,
          currentNote,
        }),
      });

      if (!response.ok) {
        // Log once per failure; the loop will retry on the next tick.
        let serverMessage: string | undefined;
        try {
          const errBody = (await response.json()) as { error?: string };
          serverMessage = errBody?.error;
        } catch {
          /* ignore JSON parse failure on error body */
        }
        console.warn('[SOAPNoteService] extract endpoint returned non-OK', {
          status: response.status,
          serverMessage,
        });
        return currentNote;
      }

      const envelope = (await response.json()) as { data?: Partial<SOAPNote> };
      const extractedNote = envelope.data ?? {};

      // Merge with current note (identical merge rules to the pre-migration
      // implementation so downstream comparison logic stays unchanged).
      return this.mergeNotes(currentNote, extractedNote);
    } catch (error) {
      console.error('[SOAPNoteService] extract call failed:', error);
      return currentNote;
    }
  }

  /**
   * Merge extracted note with current note.
   */
  private mergeNotes(currentNote: SOAPNote, extractedNote: Partial<SOAPNote>): SOAPNote {
    // Deep merge logic (simplified — matches the pre-migration behavior)
    return {
      ...currentNote,
      ...extractedNote,
      subjective: {
        ...currentNote.subjective,
        ...extractedNote.subjective,
      },
      objective: {
        ...currentNote.objective,
        ...extractedNote.objective,
      },
      assessment: {
        ...currentNote.assessment,
        ...extractedNote.assessment,
      },
      plan: {
        ...currentNote.plan,
        ...extractedNote.plan,
      },
    };
  }

  /**
   * Calculate completeness score.
   */
  private calculateCompleteness(note: SOAPNote): number {
    let total = 0;
    let present = 0;

    // Check HPI elements
    const hpiElements: HPIElement[] = [
      'chief_complaint',
      'onset',
      'location',
      'duration',
      'character',
      'severity',
    ];

    for (const element of hpiElements) {
      total++;
      if (note.subjective.hpi[element]?.content) present++;
    }

    // Check objective
    if (note.objective.vitalSigns.content) {
      total++;
      present++;
    }

    // Check assessment
    if (note.assessment.primaryDiagnosis.content) {
      total++;
      present++;
    }

    return Math.round((present / total) * 100);
  }

  /**
   * Calculate comparison scores.
   */
  private calculateComparisonScores(
    elementComparison: SOAPComparison['elementComparison']
  ): SOAPComparison['scores'] {
    const total = elementComparison.length;
    const present = elementComparison.filter((e) => e.status === 'present').length;
    const incomplete = elementComparison.filter((e) => e.status === 'incomplete').length;

    const completeness = Math.round((present / total) * 100);
    const accuracy = Math.round(((present + incomplete * 0.5) / total) * 100);

    return {
      completeness,
      accuracy,
      organization: 85, // Placeholder
      overall: Math.round((completeness + accuracy) / 2),
    };
  }

  /**
   * Calculate text similarity.
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity (Jaccard)
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Generate teaching points from comparison.
   */
  private generateTeachingPoints(elementComparison: SOAPComparison['elementComparison']): string[] {
    const points: string[] = [];

    const missedCritical = elementComparison.filter(
      (e) => e.status === 'missing' && e.severity === 'critical'
    );

    if (missedCritical.length > 0) {
      points.push(
        `Critical elements missed: Always document ${missedCritical.map((e) => e.elementType).join(', ')}`
      );
    }

    const incorrectAssessment = elementComparison.find(
      (e) => e.elementType === 'primaryDiagnosis' && e.status === 'incorrect'
    );

    if (incorrectAssessment) {
      points.push(
        `Consider the diagnostic criteria for ${incorrectAssessment.goldStandardContent}`
      );
    }

    return points;
  }
}

/**
 * Factory function. Accepts a Clerk token provider (either a pre-fetched
 * token or the `getToken` function itself). Passing `null`/`undefined` is
 * allowed for test environments — the server will just 401.
 */
export function createSOAPNoteService(tokenProvider?: TokenProvider): SOAPNoteService {
  return new SOAPNoteService({ tokenProvider });
}
