import { prisma } from '@/lib/prisma';
import { GraphEdgeType } from '@prisma/client';
import type { GraphEdgeData } from './types';
import type { Prisma } from '@prisma/client';

export class RelationshipExtractor {
  /**
   * Extract relationships from all MedicalContent items and create semantic edges
   */
  async extractAll(): Promise<void> {
    const medicalContents = await prisma.medicalContent.findMany({
      select: {
        id: true,
        conditionId: true,
        condition: true,
        differentialDiagnosis: true,
        complications: true,
        treatment: true,
        riskFactors: true,
        symptoms: true,
        buzzwords: true,
        relatedSystems: true,
      },
      where: {
        status: { not: 'draft' },
      },
    });

    for (const content of medicalContents) {
      await this.extractFromMedicalContent(content);
    }
  }

  /**
   * Extract relationships from a single MedicalContent item
   */
  private async extractFromMedicalContent(content: {
    id: string;
    conditionId: string;
    condition: string;
    differentialDiagnosis?: string | null;
    complications?: string | null;
    treatment?: string | null;
    riskFactors?: string | null;
    symptoms?: string | null;
    buzzwords?: string[];
    relatedSystems?: string[];
  }): Promise<void> {
    const sourceNodeId = `condition:${content.conditionId}`;
    const edges: GraphEdgeData[] = [];

    // Differential diagnosis edges
    if (content.differentialDiagnosis) {
      const targetConditionIds = await this.extractConditionNames(content.differentialDiagnosis);
      for (const targetId of targetConditionIds) {
        edges.push({
          id: `semantic:${sourceNodeId}->${targetId}:ddx`,
          sourceId: sourceNodeId,
          targetId,
          edgeType: GraphEdgeType.DIFFERENTIAL,
          weight: 0.8,
          description: 'Differential diagnosis',
          evidenceCount: 1,
        });
      }
    }

    // Complication edges
    if (content.complications) {
      const targetConditionIds = await this.extractConditionNames(content.complications);
      for (const targetId of targetConditionIds) {
        edges.push({
          id: `semantic:${sourceNodeId}->${targetId}:complicates`,
          sourceId: sourceNodeId,
          targetId,
          edgeType: GraphEdgeType.COMPLICATES,
          weight: 0.9,
          description: 'Condition may complicate',
          evidenceCount: 1,
        });
      }
    }

    // Treatment edges (drugs)
    if (content.treatment) {
      const drugs = await prisma.drug.findMany({
        select: {
          id: true,
          genericName: true,
          brandName: true,
          displayName: true,
          aliases: true,
        },
      });
      const lowerTreatment = content.treatment.toLowerCase();
      for (const drug of drugs) {
        const names = [
          drug.genericName,
          drug.brandName,
          drug.displayName,
          ...(drug.aliases ?? []),
        ].filter((name): name is string => Boolean(name));
        if (names.some((name) => lowerTreatment.includes(name.toLowerCase()))) {
          edges.push({
            id: `semantic:${sourceNodeId}->drug:${drug.id}:treats`,
            sourceId: `drug:${drug.id}`,
            targetId: sourceNodeId,
            edgeType: GraphEdgeType.TREATS,
            weight: 0.8,
            description: `${drug.displayName ?? drug.brandName ?? drug.genericName} treats condition`,
            evidenceCount: 1,
          });
        }
      }
    }

    // Risk factor edges (conditions that increase risk)
    if (content.riskFactors) {
      const targetConditionIds = await this.extractConditionNames(content.riskFactors);
      for (const targetId of targetConditionIds) {
        edges.push({
          id: `semantic:${sourceNodeId}->${targetId}:risk`,
          sourceId: sourceNodeId,
          targetId,
          edgeType: GraphEdgeType.ASSOCIATED,
          weight: 0.7,
          description: 'Risk factor association',
          evidenceCount: 1,
        });
      }
    }

    // Symptom edges (finding nodes) - placeholder
    // Buzzwords (associated keywords) - can link to taxonomy nodes

    // Create edges in bulk
    if (edges.length > 0) {
      await this.upsertEdges(edges);
    }
  }

  /**
   * Extract condition names from text and map to existing graph node IDs.
   * Looks up Condition table names against the input text (case-insensitive substring match).
   */
  private async extractConditionNames(text: string): Promise<string[]> {
    if (!text || text.length < 3) return [];

    const conditions = await prisma.condition.findMany({
      select: { id: true, name: true },
    });

    const lowerText = text.toLowerCase();
    return conditions
      .filter((c) => c.name && lowerText.includes(c.name.toLowerCase()))
      .map((c) => `condition:${c.id}`);
  }

  /**
   * Use Gemini to extract relation triples from clinical pearls.
   * Requires Gemini API key configuration. Falls back to rule-based extraction.
   */
  async extractWithGemini(contentId: string): Promise<void> {
    // Gemini-powered NER extraction is deferred — rule-based extraction covers
    // differentials, complications, risk factors, and treatment drugs.
  }

  private async upsertEdges(edges: GraphEdgeData[]): Promise<void> {
    const batchSize = 1000;
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((edge) =>
          prisma.graphEdge.upsert({
            where: {
              sourceId_targetId_edgeType: {
                sourceId: edge.sourceId,
                targetId: edge.targetId,
                edgeType: edge.edgeType,
              },
            },
            update: {
              weight: edge.weight,
              description: edge.description,
              evidenceCount: edge.evidenceCount,
              metadata: edge.metadata as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
            create: {
              id: edge.id,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              edgeType: edge.edgeType,
              weight: edge.weight,
              description: edge.description,
              evidenceCount: edge.evidenceCount,
              metadata: edge.metadata as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
          })
        )
      );
    }
  }
}
