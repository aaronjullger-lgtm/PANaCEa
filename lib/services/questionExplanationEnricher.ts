/**
 * Question Explanation Enricher
 *
 * Enhances post-answer explanations with contextual clinical reference data.
 * After a student answers a question, this service injects relevant labs,
 * clinical pearls, and differential features into the explanation view.
 *
 * Sprint 4C — April 2026
 * @module lib/services/questionExplanationEnricher
 */

import type { PrismaClient } from '@prisma/client';
import { getQuickRef, type QuickRefData, type QuickRefContext } from './clinicalQuickRefService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EnrichedExplanation {
  originalExplanation: string;
  enrichments: ExplanationEnrichment[];
  quickRef: QuickRefData;
}

export interface ExplanationEnrichment {
  type: 'lab_context' | 'clinical_pearl' | 'differential_tip' | 'high_yield';
  content: string;
  source?: string;
}
// ─── Core Enrichment ─────────────────────────────────────────────────────────

/**
 * Enrich a question's explanation with contextual clinical data.
 * Called after answer submission to enhance the learning moment.
 */
export async function enrichExplanation(
  prisma: PrismaClient,
  originalExplanation: string,
  context: QuickRefContext & { wasCorrect: boolean }
): Promise<EnrichedExplanation> {
  const quickRef = await getQuickRef(prisma, context);
  const enrichments: ExplanationEnrichment[] = [];

  // Add relevant lab context
  for (const lab of quickRef.normalLabs.slice(0, 3)) {
    const significance = lab.clinicalSignificance
      ? ` — ${lab.clinicalSignificance}`
      : '';
    enrichments.push({
      type: 'lab_context',
      content: `${lab.name}: Normal ${lab.normalRange} ${lab.unit}${significance}`,
    });
  }

  // Add clinical pearls (especially valuable after incorrect answers)
  const pearlLimit = context.wasCorrect ? 1 : 3;
  for (const pearl of quickRef.relevantPearls.slice(0, pearlLimit)) {
    enrichments.push({
      type: 'clinical_pearl',
      content: pearl.content,
      source: pearl.source,
    });
  }
  // Add differential tips for incorrect answers
  if (!context.wasCorrect && quickRef.differentialFeatures.length > 0) {
    for (const ddx of quickRef.differentialFeatures.slice(0, 2)) {
      const features = ddx.distinguishingFeatures.slice(0, 3).join(', ');
      enrichments.push({
        type: 'differential_tip',
        content: `Key features distinguishing ${ddx.conditionName}: ${features}`,
      });
    }
  }

  return { originalExplanation, enrichments, quickRef };
}

/**
 * Format enrichments into a readable string for simple rendering.
 * Used when the client doesn't support structured enrichment display.
 */
export function formatEnrichmentsAsText(enriched: EnrichedExplanation): string {
  if (enriched.enrichments.length === 0) return enriched.originalExplanation;

  const sections: string[] = [enriched.originalExplanation, '', '--- Clinical Context ---'];

  for (const e of enriched.enrichments) {
    const prefix = e.type === 'lab_context' ? '📊'
      : e.type === 'clinical_pearl' ? '💡'
      : e.type === 'differential_tip' ? '🔍'
      : '⭐';
    sections.push(`${prefix} ${e.content}`);
  }

  return sections.join('\n');
}
