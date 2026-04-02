/**
 * Clinical Quick-Reference Service
 *
 * Provides fast, lightweight clinical reference data for in-session use.
 * Instead of the full reference library (heavy, many queries), this service
 * returns the most relevant reference data for a specific question context:
 * related normal labs, relevant anatomy, differential features, and
 * clinical pearls.
 *
 * Used by: ClinicalQuickRefPanel (in-session drawer) and
 * questionExplanationEnricher (post-answer enrichment).
 *
 * Sprint 4A — April 2026
 * @module lib/services/clinicalQuickRefService
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuickRefContext {
  system?: string;
  conditionId?: string;
  conditionName?: string;
  tags?: string[];
}

export interface QuickRefData {
  normalLabs: NormalLabRef[];
  vitalRanges: VitalRef[];
  relevantPearls: ClinicalPearlRef[];
  differentialFeatures: DifferentialFeature[];
  relatedConditions: string[];
}
export interface NormalLabRef {
  name: string;
  normalRange: string;
  unit: string;
  clinicalSignificance?: string;
}

export interface VitalRef {
  name: string;
  normalRange: string;
  unit: string;
}

export interface ClinicalPearlRef {
  content: string;
  source?: string;
  conditionName?: string;
}

export interface DifferentialFeature {
  conditionName: string;
  distinguishingFeatures: string[];
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Get quick-reference data relevant to a specific question context.
 * Designed for speed: uses targeted queries based on system/condition.
 */
export async function getQuickRef(
  prisma: PrismaClient,
  context: QuickRefContext
): Promise<QuickRefData> {
  const [normalLabs, vitalRanges, relevantPearls, differentialFeatures, relatedConditions] =
    await Promise.all([
      fetchNormalLabs(prisma, context),
      fetchVitalRanges(prisma, context),
      fetchClinicalPearls(prisma, context),
      fetchDifferentialFeatures(prisma, context),
      fetchRelatedConditions(prisma, context),
    ]);

  return { normalLabs, vitalRanges, relevantPearls, differentialFeatures, relatedConditions };
}
// ─── Lab Values ──────────────────────────────────────────────────────────────

async function fetchNormalLabs(
  prisma: PrismaClient,
  context: QuickRefContext
): Promise<NormalLabRef[]> {
  if (!context.conditionId && !context.system) return [];

  try {
    // If we have a condition, get labs linked to it
    if (context.conditionId) {
      const links = await prisma.labConditionLink.findMany({
        where: { conditionId: context.conditionId },
        include: {
          Lab: { select: { name: true, normalRange: true, unit: true, clinicalSignificance: true } },
        },
        take: 10,
      });
      return links
        .filter(l => l.Lab)
        .map(l => ({
          name: l.Lab.name,
          normalRange: l.Lab.normalRange ?? '',
          unit: l.Lab.unit ?? '',
          clinicalSignificance: l.Lab.clinicalSignificance ?? undefined,
        }));
    }
    return [];
  } catch {
    return []; // Graceful fallback
  }
}
// ─── Vital Ranges ────────────────────────────────────────────────────────────

async function fetchVitalRanges(
  _prisma: PrismaClient,
  _context: QuickRefContext
): Promise<VitalRef[]> {
  // Common vital ranges — static data, no DB needed
  return [
    { name: 'Heart Rate', normalRange: '60-100', unit: 'bpm' },
    { name: 'Blood Pressure (systolic)', normalRange: '90-120', unit: 'mmHg' },
    { name: 'Blood Pressure (diastolic)', normalRange: '60-80', unit: 'mmHg' },
    { name: 'Respiratory Rate', normalRange: '12-20', unit: 'breaths/min' },
    { name: 'Temperature', normalRange: '97.8-99.1', unit: '°F' },
    { name: 'SpO2', normalRange: '95-100', unit: '%' },
  ];
}

// ─── Clinical Pearls ─────────────────────────────────────────────────────────

async function fetchClinicalPearls(
  prisma: PrismaClient,
  context: QuickRefContext
): Promise<ClinicalPearlRef[]> {
  if (!context.conditionId) return [];

  try {
    const pearls = await prisma.clinicalPearl.findMany({
      where: { conditionId: context.conditionId },
      select: { content: true, source: true, Condition: { select: { name: true } } },
      take: 5,
    });
    return pearls.map(p => ({
      content: p.content,
      source: p.source ?? undefined,
      conditionName: p.Condition?.name ?? undefined,
    }));
  } catch {
    return [];
  }
}
// ─── Differential Features ───────────────────────────────────────────────────

async function fetchDifferentialFeatures(
  prisma: PrismaClient,
  context: QuickRefContext
): Promise<DifferentialFeature[]> {
  if (!context.conditionId) return [];

  try {
    const ddx = await prisma.differentialDiagnosis.findMany({
      where: { conditionId: context.conditionId },
      select: {
        differentialName: true,
        distinguishingFeatures: true,
      },
      take: 5,
    });
    return ddx.map(d => ({
      conditionName: d.differentialName ?? 'Unknown',
      distinguishingFeatures: Array.isArray(d.distinguishingFeatures)
        ? d.distinguishingFeatures.map(String)
        : typeof d.distinguishingFeatures === 'string'
          ? [d.distinguishingFeatures]
          : [],
    }));
  } catch {
    return [];
  }
}

// ─── Related Conditions ──────────────────────────────────────────────────────

async function fetchRelatedConditions(
  prisma: PrismaClient,
  context: QuickRefContext
): Promise<string[]> {
  if (!context.conditionId) return [];

  try {
    const relations = await prisma.conditionRelation.findMany({
      where: { conditionId1: context.conditionId },
      include: {
        Condition_ConditionRelation_conditionId2ToCondition: {
          select: { name: true },
        },
      },
      take: 5,
    });
    return relations
      .map(r => r.Condition_ConditionRelation_conditionId2ToCondition?.name)
      .filter((n): n is string => !!n);
  } catch {
    return [];
  }
}
