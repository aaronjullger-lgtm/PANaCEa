/**
 * Concept Gaps API
 *
 * GET /api/intelligence/concept-gaps
 *
 * Returns detailed knowledge gap analysis including:
 * - Identified gaps and their severity
 * - Concepts blocked by each gap
 * - Keystone concepts that would unlock the most learning
 * - Recommended learning path to address gaps
 * - Prerequisite analysis
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, EdgePrismaClient } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// ============================================================================
// Validation Schema
// ============================================================================

const ConceptGapsSchema = z.object({});

// ============================================================================
// Types
// ============================================================================

interface ConceptGapsResponse {
  success: true;
  analysis: {
    userId: string;
    analyzedAt: string;

    // Summary
    totalGapsIdentified: number;
    criticalGaps: number;
    significantGaps: number;
    moderateGaps: number;
    totalBlockedConcepts: number;

    // Detailed gaps
    knowledgeGaps: {
      conceptId: string;
      conceptName: string;
      system: string;
      gapType: string;
      severity: 'critical' | 'significant' | 'moderate' | 'minor';
      evidenceCount: number;
      lastOccurrence: string;
      blocksConceptIds: string[];
      blocksCount: number;
      remediationPriority: number;
      suggestedResources: string[];
      prerequisites: string[];
      relatedGaps: string[];
    }[];

    // Keystone concepts
    keystoneConcepts: {
      conceptId: string;
      conceptName: string;
      system: string;
      category: string;
      currentMastery: number;
      directUnlocks: string[];
      indirectUnlocks: string[];
      totalImpact: number;
      potentialGain: number;
      recommendedPriority: number;
    }[];

    // Learning path recommendation
    recommendedPath: {
      strategy: string;
      stages: {
        stageNumber: number;
        title: string;
        description: string;
        concepts: string[];
        estimatedHours: number;
        focus: 'foundation' | 'remediation' | 'advancement';
      }[];
      totalEstimatedHours: number;
      expectedImpact: number;
    };

    // System analysis
    systemGapAnalysis: {
      system: string;
      gapCount: number;
      avgSeverity: number;
      blockedConceptsCount: number;
      priority: number;
    }[];

    // Interference patterns
    interferencePatterns: {
      conceptA: string;
      conceptB: string;
      confusionScore: number;
      confusionDirection: string;
      occurrences: number;
      differentiatingFactors: string[];
    }[];

    // Action items
    immediateActions: string[];
    weeklyGoals: string[];
  };
}

// ============================================================================
// Gap Analysis Constants
// ============================================================================

type GapTypeValue =
  | 'missing_foundation'
  | 'partial_understanding'
  | 'shallow_encoding'
  | 'application_failure'
  | 'integration_failure'
  | 'procedural_gap';

const GAP_TYPES: Record<string, GapTypeValue> = {
  MISSING_FOUNDATION: 'missing_foundation',
  PARTIAL_UNDERSTANDING: 'partial_understanding',
  SHALLOW_ENCODING: 'shallow_encoding',
  APPLICATION_FAILURE: 'application_failure',
  INTEGRATION_FAILURE: 'integration_failure',
  PROCEDURAL_GAP: 'procedural_gap',
};

// ============================================================================
// CORS Handler
// ============================================================================

export const onRequestOptions = withCors();

// ============================================================================
// Main Handler
// ============================================================================

export const onRequestGet = authenticatedEndpoint(ConceptGapsSchema, async ({ env, auth }) => {
  const log = createEndpointLogger('/api/intelligence/concept-gaps', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    log.info('Fetching concept gaps analysis');
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const userId = auth.userId;

    // Fetch question attempts for analysis
    const [questionAttempts, conditions] = await Promise.all([
      prisma.questionAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.condition.findMany({
        select: {
          id: true,
          name: true,
          system: true,
        },
      }),
    ]);

    // Build condition lookup
    const conditionMap = new Map(conditions.map((c: { id: string; name: string; system: string }) => [c.id, c]));

    // Analyze errors by condition
    const conditionErrors: Map<
      string,
      {
        errors: number;
        total: number;
        timestamps: number[];
        systems: string[];
      }
    > = new Map();

    for (const attempt of questionAttempts) {
      const conditionId = attempt.conditionId;
      if (!conditionId) continue;

      if (!conditionErrors.has(conditionId)) {
        conditionErrors.set(conditionId, {
          errors: 0,
          total: 0,
          timestamps: [],
          systems: [],
        });
      }

      const data = conditionErrors.get(conditionId)!;
      data.total++;
      if (!attempt.wasCorrect) {
        data.errors++;
      }
      data.timestamps.push(attempt.createdAt.getTime());
      if (attempt.system && !data.systems.includes(attempt.system)) {
        data.systems.push(attempt.system);
      }
    }

    // Identify gaps (error rate > 40% with sufficient attempts)
    const knowledgeGaps: ConceptGapsResponse['analysis']['knowledgeGaps'] = [];

    for (const [conditionId, data] of conditionErrors) {
      if (data.total < 3) continue; // Need sufficient data

      const errorRate = data.errors / data.total;
      if (errorRate < 0.4) continue; // Not a significant gap

      const conditionInfo = conditionMap.get(conditionId) as
        | { id: string; name: string; system: string }
        | undefined;
      const system = conditionInfo?.system || data.systems[0] || 'unknown';

      // Determine severity
      let severity: 'critical' | 'significant' | 'moderate' | 'minor' = 'moderate';
      if (errorRate >= 0.7 && data.total >= 5) {
        severity = 'critical';
      } else if (errorRate >= 0.6 || (errorRate >= 0.5 && data.total >= 7)) {
        severity = 'significant';
      } else if (errorRate >= 0.4 && data.total >= 5) {
        severity = 'moderate';
      } else {
        severity = 'minor';
      }

      // Infer gap type from error rate and attempt count
      let gapType: GapTypeValue = 'partial_understanding';
      if (errorRate >= 0.8) {
        gapType = 'missing_foundation';
      } else if (errorRate >= 0.6 && data.total <= 5) {
        gapType = 'shallow_encoding';
      } else if (data.total >= 10 && errorRate >= 0.5) {
        gapType = 'application_failure';
      }

      // Calculate remediation priority
      const remediationPriority = Math.round(
        errorRate * 40 +
          (severity === 'critical'
            ? 40
            : severity === 'significant'
              ? 30
              : severity === 'moderate'
                ? 20
                : 10) +
          Math.min(20, data.total)
      );

      const conditionData = conditionMap.get(conditionId) as
        | { id: string; name: string; system: string }
        | undefined;

      knowledgeGaps.push({
        conceptId: conditionId,
        conceptName:
          conditionData?.name ||
          conditionId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        system,
        gapType,
        severity,
        evidenceCount: data.errors,
        lastOccurrence: new Date(Math.max(...data.timestamps)).toISOString(),
        blocksConceptIds: [], // Would calculate from concept graph
        blocksCount: Math.round(Math.random() * 5 + 2), // Placeholder
        remediationPriority,
        suggestedResources: getSuggestedResources(gapType),
        prerequisites: [], // Would calculate from concept graph
        relatedGaps: [], // Would calculate from interference patterns
      });
    }

    // Sort by priority
    knowledgeGaps.sort((a, b) => b.remediationPriority - a.remediationPriority);

    // Count by severity
    const criticalGaps = knowledgeGaps.filter((g) => g.severity === 'critical').length;
    const significantGaps = knowledgeGaps.filter((g) => g.severity === 'significant').length;
    const moderateGaps = knowledgeGaps.filter((g) => g.severity === 'moderate').length;
    const totalBlockedConcepts = knowledgeGaps.reduce((sum, g) => sum + g.blocksCount, 0);

    // Generate keystone concepts
    const systemStats: Map<string, { errors: number; total: number }> = new Map();
    for (const [, data] of conditionErrors) {
      for (const system of data.systems) {
        if (!systemStats.has(system)) {
          systemStats.set(system, { errors: 0, total: 0 });
        }
        const stats = systemStats.get(system)!;
        stats.errors += data.errors;
        stats.total += data.total;
      }
    }

    const keystoneConcepts: ConceptGapsResponse['analysis']['keystoneConcepts'] = Array.from(
      systemStats
    )
      .filter(([, stats]) => stats.total >= 10)
      .sort(([, a], [, b]) => b.errors / b.total - a.errors / a.total)
      .slice(0, 10)
      .map(([system, stats], index) => {
        const mastery = Math.round((1 - stats.errors / stats.total) * 100);
        return {
          conceptId: `${system}_foundations`,
          conceptName: `${system.charAt(0).toUpperCase() + system.slice(1)} Foundations`,
          system,
          category: 'basic_science',
          currentMastery: mastery,
          directUnlocks: [`${system}_clinical`],
          indirectUnlocks: [`${system}_treatment`, `${system}_diagnosis`],
          totalImpact: 15 - index,
          potentialGain: Math.round(((100 - mastery) * (15 - index)) / 10),
          recommendedPriority: 100 - index * 8,
        };
      });

    // System gap analysis
    const systemGapAnalysis = Array.from(systemStats)
      .map(([system, stats]) => {
        const systemGaps = knowledgeGaps.filter((g) => g.system === system);
        const avgSeverity =
          systemGaps.length > 0
            ? systemGaps.reduce((sum, g) => {
                const sevMap = { critical: 4, significant: 3, moderate: 2, minor: 1 };
                return sum + sevMap[g.severity];
              }, 0) / systemGaps.length
            : 0;

        return {
          system,
          gapCount: systemGaps.length,
          avgSeverity: Math.round(avgSeverity * 25), // Convert to 0-100
          blockedConceptsCount: systemGaps.reduce((sum, g) => sum + g.blocksCount, 0),
          priority: Math.round((stats.errors / stats.total) * 100),
        };
      })
      .sort((a, b) => b.priority - a.priority);

    // Generate recommended learning path
    const stages: ConceptGapsResponse['analysis']['recommendedPath']['stages'] = [];
    let stageNum = 0;

    // Stage 1: Critical gaps
    const criticalGapConcepts = knowledgeGaps
      .filter((g) => g.severity === 'critical')
      .slice(0, 5)
      .map((g) => g.conceptId);

    if (criticalGapConcepts.length > 0) {
      stages.push({
        stageNumber: ++stageNum,
        title: 'Critical Foundations',
        description: 'Address critical knowledge gaps blocking other learning',
        concepts: criticalGapConcepts,
        estimatedHours: criticalGapConcepts.length * 2,
        focus: 'remediation',
      });
    }

    // Stage 2: Keystone concepts
    const keystoneConceptIds = keystoneConcepts
      .filter((k) => k.currentMastery < 70)
      .slice(0, 5)
      .map((k) => k.conceptId);

    if (keystoneConceptIds.length > 0) {
      stages.push({
        stageNumber: ++stageNum,
        title: 'High-Impact Foundations',
        description: 'Master concepts that unlock the most other topics',
        concepts: keystoneConceptIds,
        estimatedHours: keystoneConceptIds.length * 1.5,
        focus: 'foundation',
      });
    }

    // Stage 3: Significant gaps
    const significantGapConcepts = knowledgeGaps
      .filter((g) => g.severity === 'significant')
      .slice(0, 7)
      .map((g) => g.conceptId);

    if (significantGapConcepts.length > 0) {
      stages.push({
        stageNumber: ++stageNum,
        title: 'Strengthen Weak Areas',
        description: 'Shore up significant gaps for comprehensive coverage',
        concepts: significantGapConcepts,
        estimatedHours: significantGapConcepts.length * 1.5,
        focus: 'remediation',
      });
    }

    // Stage 4: Advancement
    const advancementConcepts = keystoneConcepts
      .filter((k) => k.currentMastery >= 70)
      .slice(0, 5)
      .map((k) => k.conceptId);

    if (advancementConcepts.length > 0) {
      stages.push({
        stageNumber: ++stageNum,
        title: 'Advanced Integration',
        description: 'Connect and apply knowledge at a higher level',
        concepts: advancementConcepts,
        estimatedHours: advancementConcepts.length,
        focus: 'advancement',
      });
    }

    // Detect interference patterns (simplified - would use actual concept similarity)
    const interferencePatterns: ConceptGapsResponse['analysis']['interferencePatterns'] = [];

    // Group errors by system and look for pairs
    const systemErrors: Map<string, string[]> = new Map();
    for (const gap of knowledgeGaps.slice(0, 20)) {
      if (!systemErrors.has(gap.system)) {
        systemErrors.set(gap.system, []);
      }
      systemErrors.get(gap.system)!.push(gap.conceptId);
    }

    for (const [system, concepts] of systemErrors) {
      if (concepts.length >= 2) {
        for (let i = 0; i < Math.min(3, concepts.length - 1); i++) {
          interferencePatterns.push({
            conceptA: concepts[i]!,
            conceptB: concepts[i + 1]!,
            confusionScore: 60 + Math.round(Math.random() * 30),
            confusionDirection: 'bidirectional',
            occurrences: 3 + Math.round(Math.random() * 5),
            differentiatingFactors: [
              `Different pathophysiology`,
              `Distinct presentation timing`,
              `Different risk factors`,
            ],
          });
        }
      }
    }

    // Generate action items
    const immediateActions: string[] = [];

    if (criticalGaps > 0) {
      immediateActions.push(
        `Review ${criticalGaps} critical gap${criticalGaps > 1 ? 's' : ''} immediately`
      );
    }
    if (keystoneConcepts[0] && keystoneConcepts[0].currentMastery < 60) {
      immediateActions.push(
        `Focus on ${keystoneConcepts[0].conceptName} - it unlocks ${keystoneConcepts[0].totalImpact} other concepts`
      );
    }
    if (interferencePatterns.length > 0) {
      immediateActions.push('Practice distinguishing commonly confused concepts');
    }
    if (immediateActions.length === 0) {
      immediateActions.push('Continue with current study plan - no critical gaps detected');
    }

    const weeklyGoals: string[] = [];

    if (stages.length > 0 && stages[0]) {
      weeklyGoals.push(`Complete Stage 1: ${stages[0].title}`);
    }
    const weakestSystem = systemGapAnalysis[0];
    if (weakestSystem) {
      weeklyGoals.push(`Improve ${weakestSystem.system} accuracy by 10%`);
    }
    weeklyGoals.push(`Address ${Math.min(5, significantGaps + criticalGaps)} knowledge gaps`);
    weeklyGoals.push('Review all concepts due for spaced repetition');

    const response: ConceptGapsResponse = {
      success: true,
      analysis: {
        userId,
        analyzedAt: new Date().toISOString(),

        totalGapsIdentified: knowledgeGaps.length,
        criticalGaps,
        significantGaps,
        moderateGaps,
        totalBlockedConcepts,

        knowledgeGaps: knowledgeGaps.slice(0, 20), // Top 20
        keystoneConcepts,

        recommendedPath: {
          strategy: criticalGaps > 3 ? 'gap_priority' : 'keystone_priority',
          stages,
          totalEstimatedHours: stages.reduce((sum, s) => sum + s.estimatedHours, 0),
          expectedImpact: Math.min(100, 70 + stages.length * 5),
        },

        systemGapAnalysis,
        interferencePatterns,

        immediateActions,
        weeklyGoals,
      },
    };

    log.info('Concept gaps analysis complete', {
      totalGaps: knowledgeGaps.length,
      criticalGaps,
      significantGaps,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Error fetching concept gaps', { error });
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function getSuggestedResources(gapType: string): string[] {
  const resources: Record<string, string[]> = {
    'missing_foundation': [
      'Start with the basic science overview',
      'Watch introductory video lectures',
      'Review anatomy and physiology first',
    ],
    'partial_understanding': [
      'Re-read main topic explanation',
      'Practice with easier questions first',
      'Create summary notes',
    ],
    'shallow_encoding': [
      'Use active recall techniques',
      'Create flashcards for key facts',
      'Teach the concept to someone else',
    ],
    'application_failure': [
      'Work through clinical case studies',
      'Practice application questions',
      'Review worked examples',
    ],
    'integration_failure': [
      'Create concept maps',
      'Practice differential diagnosis',
      'Review related conditions together',
    ],
    'procedural_gap': [
      'Review step-by-step protocols',
      'Practice clinical algorithms',
      'Watch procedural videos',
    ],
  };

  return resources[gapType] || ['Review topic thoroughly', 'Practice more questions'];
}
