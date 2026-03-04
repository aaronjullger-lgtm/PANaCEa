import { prisma } from '@/lib/prisma';
import { GraphEdgeType } from '@prisma/client';
import type { GraphEdgeData } from './types';

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

    // Treatment edges (drugs, procedures) - placeholder
    if (content.treatment) {
      // TODO: extract drug names and procedure names
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
   * This is a naive implementation; in production you would use NLP or a medical NER.
   */
  private async extractConditionNames(text: string): Promise<string[]> {
    // For now, return empty array; implement later
    // TODO: Use a medical dictionary or lookup from GraphNode labels
    return [];
  }

  /**
   * Use Gemini to extract relation triples from clinical pearls
   */
  async extractWithGemini(contentId: string): Promise<void> {
    // TODO: Implement Gemini integration for advanced relationship extraction
    console.log('Gemini extraction not yet implemented');
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
              metadata: edge.metadata,
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
              metadata: edge.metadata,
            },
          }),
        ),
      );
    }
  }
}