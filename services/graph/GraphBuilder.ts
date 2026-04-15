import { prisma } from '@/lib/prisma';
import { GraphNodeType, GraphEdgeType, Prisma } from '@prisma/client';
import type { GraphBuildOptions, GraphNodeData, GraphEdgeData } from './types';

export class GraphBuilder {
  private options: GraphBuildOptions;

  constructor(options: GraphBuildOptions = {}) {
    this.options = {
      rebuild: false,
      batchSize: 1000,
      includeNodes: undefined,
      includeEdgeTypes: undefined,
      ...options,
    };
  }

  /**
   * Rebuild the entire graph (nodes and edges)
   */
  async rebuildGraph(): Promise<void> {
    if (this.options.rebuild) {
      await this.clearGraph();
    }
    await this.buildAllNodes();
    await this.buildAllEdges();
  }

  /**
   * Clear all graph nodes and edges (cascading delete)
   */
  async clearGraph(): Promise<void> {
    await prisma.graphEdge.deleteMany({});
    await prisma.graphNode.deleteMany({});
  }

  /**
   * Build all nodes from source data
   */
  async buildAllNodes(): Promise<void> {
    const nodeTypes = this.options.includeNodes ?? Object.values(GraphNodeType);
    const tasks: Promise<void>[] = [];

    if (nodeTypes.includes(GraphNodeType.CONDITION)) {
      tasks.push(this.buildConditionNodes());
    }
    if (nodeTypes.includes(GraphNodeType.SYSTEM)) {
      tasks.push(this.buildSystemNodes());
    }
    if (nodeTypes.includes(GraphNodeType.ANATOMY)) {
      tasks.push(this.buildAnatomyNodes());
    }
    if (nodeTypes.includes(GraphNodeType.DRUG)) {
      tasks.push(this.buildDrugNodes());
    }
    if (nodeTypes.includes(GraphNodeType.PROCEDURE)) {
      tasks.push(this.buildProcedureNodes());
    }
    if (nodeTypes.includes(GraphNodeType.FINDING)) {
      tasks.push(this.buildFindingNodes());
    }
    if (nodeTypes.includes(GraphNodeType.LAB_TEST)) {
      tasks.push(this.buildLabTestNodes());
    }
    if (nodeTypes.includes(GraphNodeType.IMAGING)) {
      tasks.push(this.buildImagingNodes());
    }
    if (nodeTypes.includes(GraphNodeType.VITAL_SIGN)) {
      tasks.push(this.buildVitalSignNodes());
    }
    // Other node types can be added later

    await Promise.all(tasks);
  }

  /**
   * Build all edges from relationship tables
   */
  async buildAllEdges(): Promise<void> {
    const edgeTypes = this.options.includeEdgeTypes ?? Object.values(GraphEdgeType);
    const tasks: Promise<void>[] = [];

    if (edgeTypes.includes(GraphEdgeType.HIERARCHICAL)) {
      tasks.push(this.buildHierarchicalEdges());
    }
    if (edgeTypes.includes(GraphEdgeType.CO_OCCURRENCE)) {
      tasks.push(this.buildCoOccurrenceEdges());
    }
    if (edgeTypes.includes(GraphEdgeType.ASSOCIATED)) {
      tasks.push(this.buildAssociatedEdges());
    }
    // Semantic and explicit edges will be added by RelationshipExtractor
    // Treats, Causes, Manifests, Differential, Complicates edges can be derived from existing links

    await Promise.all(tasks);
  }

  // --- Node Builders ---

  private async buildConditionNodes(): Promise<void> {
    const conditions = await prisma.medicalContent.findMany({
      select: {
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        canonicalName: true,
        parent_category: true,
        parentId: true,
        pance_yield: true,
      },
      where: {
        status: { not: 'draft' },
      },
    });

    // Fetch SystemMapping to map canonicalName/subcategory to taxonomyCode
    const systemMappings = await prisma.systemMapping.findMany({
      select: {
        taxonomyCode: true,
        canonicalName: true,
        subcategory: true,
      },
    });

    // Create a lookup map keyed by canonicalName + subcategory
    const mappingMap = new Map<string, string>();
    for (const mapping of systemMappings) {
      const key = `${mapping.canonicalName?.toLowerCase() || ''}:${mapping.subcategory.toLowerCase()}`;
      mappingMap.set(key, mapping.taxonomyCode);
    }

    const nodes: GraphNodeData[] = conditions.map((cond) => {
      // Try to find taxonomyCode
      let taxonomyCode: string | undefined = undefined;
      const key1 = `${cond.canonicalName?.toLowerCase() || ''}:${cond.subcategory.toLowerCase()}`;
      const key2 = `${cond.condition.toLowerCase()}:${cond.subcategory.toLowerCase()}`;
      taxonomyCode = mappingMap.get(key1) || mappingMap.get(key2);

      return {
        id: `condition:${cond.conditionId}`,
        nodeType: GraphNodeType.CONDITION,
        label: cond.canonicalName || cond.condition,
        description: `Condition: ${cond.condition}`,
        sourceType: 'MedicalContent',
        sourceId: cond.conditionId,
        taxonomyCode,
        systemCodes: cond.system ? [cond.system] : [],
        metadata: {
          parentId: cond.parentId ?? undefined,
          parentCategory: cond.parent_category ?? undefined,
          panceYield: cond.pance_yield ?? undefined,
          subcategory: cond.subcategory,
        },
      };
    });

    await this.upsertNodes(nodes);
  }

  private async buildSystemNodes(): Promise<void> {
    // NCCPA blueprint systems from constants
    const systems = [
      'Cardiovascular',
      'Pulmonary',
      'Gastrointestinal',
      'Musculoskeletal',
      'Neurology',
      'Endocrine',
      'Renal',
      'Genitourinary',
      'EENT',
      'Integumentary',
      'Hematology',
      'Infectious Disease',
      'Psychiatry',
      'Obstetrics & Gynecology',
      'Surgery',
      'Emergency Medicine',
      'Preventive Medicine',
    ];

    const nodes: GraphNodeData[] = systems.map((system) => ({
      id: `system:${system}`,
      nodeType: GraphNodeType.SYSTEM,
      label: system,
      description: `NCCPA Blueprint System: ${system}`,
      sourceType: 'NCCPABlueprint',
      sourceId: system,
      taxonomyCode: undefined,
      systemCodes: [system],
      metadata: {},
    }));

    await this.upsertNodes(nodes);
  }

  private async buildAnatomyNodes(): Promise<void> {
    const anatomyStructures = await prisma.anatomyStructure.findMany({
      select: {
        id: true,
        name: true,
        system: true,
        description: true,
        region: true,
        type: true,
      },
    });

    const nodes: GraphNodeData[] = anatomyStructures.map((anatomy) => ({
      id: `anatomy:${anatomy.id}`,
      nodeType: GraphNodeType.ANATOMY,
      label: anatomy.name,
      description: anatomy.description ?? undefined,
      sourceType: 'AnatomyStructure',
      sourceId: anatomy.id,
      taxonomyCode: undefined,
      systemCodes: anatomy.system ? [anatomy.system] : [],
      metadata: {
        region: anatomy.region,
        type: anatomy.type,
      },
    }));

    await this.upsertNodes(nodes);
  }

  private async buildDrugNodes(): Promise<void> {
    const drugs = await prisma.drug.findMany({
      select: {
        id: true,
        genericName: true,
        brandName: true,
        displayName: true,
        mechanismOfAction: true,
        clinicalNotes: true,
        drugClass: true,
      },
    });

    const nodes: GraphNodeData[] = drugs.map((drug) => ({
      id: `drug:${drug.id}`,
      nodeType: GraphNodeType.DRUG,
      label: drug.displayName ?? drug.brandName ?? drug.genericName,
      description: drug.clinicalNotes ?? drug.mechanismOfAction ?? undefined,
      sourceType: 'Drug',
      sourceId: drug.id,
      taxonomyCode: undefined,
      systemCodes: [],
      metadata: {
        drugClass: drug.drugClass,
      },
    }));

    await this.upsertNodes(nodes);
  }

  private async buildProcedureNodes(): Promise<void> {
    const procedures = await prisma.procedure.findMany({
      select: {
        id: true,
        name: true,
        system: true,
        description: true,
      },
    });

    const nodes: GraphNodeData[] = procedures.map((proc) => ({
      id: `procedure:${proc.id}`,
      nodeType: GraphNodeType.PROCEDURE,
      label: proc.name,
      description: proc.description ?? undefined,
      sourceType: 'Procedure',
      sourceId: proc.id,
      taxonomyCode: undefined,
      systemCodes: proc.system ? [proc.system] : [],
      metadata: {},
    }));

    await this.upsertNodes(nodes);
  }

  private async buildFindingNodes(): Promise<void> {
    const findings = await prisma.physicalExamFinding.findMany({
      select: {
        id: true,
        name: true,
        system: true,
        description: true,
      },
    });

    const nodes: GraphNodeData[] = findings.map((finding) => ({
      id: `finding:${finding.id}`,
      nodeType: GraphNodeType.FINDING,
      label: finding.name,
      description: finding.description ?? undefined,
      sourceType: 'PhysicalExamFinding',
      sourceId: finding.id,
      taxonomyCode: undefined,
      systemCodes: finding.system ? [finding.system] : [],
      metadata: {},
    }));

    await this.upsertNodes(nodes);
  }

  private async buildLabTestNodes(): Promise<void> {
    const labTests = await prisma.labTest.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        typicalUse: true,
      },
    });

    const nodes: GraphNodeData[] = labTests.map((lab) => ({
      id: `labTest:${lab.id}`,
      nodeType: GraphNodeType.LAB_TEST,
      label: lab.name,
      description: lab.typicalUse ?? undefined,
      sourceType: 'LabTest',
      sourceId: lab.id,
      taxonomyCode: undefined,
      systemCodes: [],
      metadata: {
        category: lab.category,
        typicalUse: lab.typicalUse ?? undefined,
      },
    }));

    await this.upsertNodes(nodes);
  }

  private async buildImagingNodes(): Promise<void> {
    const imagingStudies = await prisma.imagingStudy.findMany({
      select: {
        id: true,
        name: true,
        modality: true,
        bodyRegion: true,
        description: true,
      },
    });

    const nodes: GraphNodeData[] = imagingStudies.map((img) => ({
      id: `imaging:${img.id}`,
      nodeType: GraphNodeType.IMAGING,
      label: img.name,
      description: img.description ?? undefined,
      sourceType: 'ImagingStudy',
      sourceId: img.id,
      taxonomyCode: undefined,
      systemCodes: [],
      metadata: {
        modality: img.modality,
        bodyRegion: img.bodyRegion ?? undefined,
      },
    }));

    await this.upsertNodes(nodes);
  }

  private async buildVitalSignNodes(): Promise<void> {
    const vitalSigns = await prisma.vitalSignRange.findMany({
      select: {
        id: true,
        vitalSign: true,
        displayName: true,
        category: true,
      },
    });

    const nodes: GraphNodeData[] = vitalSigns.map((vs) => ({
      id: `vitalSign:${vs.id}`,
      nodeType: GraphNodeType.VITAL_SIGN,
      label: vs.displayName || vs.vitalSign,
      description: `Vital Sign: ${vs.vitalSign}`,
      sourceType: 'VitalSignRange',
      sourceId: vs.id,
      taxonomyCode: undefined,
      systemCodes: vs.category ? [vs.category] : [],
      metadata: {
        category: vs.category,
      },
    }));

    await this.upsertNodes(nodes);
  }

  // --- Edge Builders ---

  private async buildHierarchicalEdges(): Promise<void> {
    // MedicalContent parent-child relationships
    const medicalContents = await prisma.medicalContent.findMany({
      select: {
        conditionId: true,
        parentId: true,
      },
      where: {
        parentId: { not: null },
      },
    });

    const edges: GraphEdgeData[] = medicalContents
      .filter((mc): mc is { conditionId: string; parentId: string } => mc.parentId !== null)
      .map((mc) => ({
        id: `hierarchical:${mc.parentId}->${mc.conditionId}`,
        sourceId: `condition:${mc.parentId}`,
        targetId: `condition:${mc.conditionId}`,
        edgeType: GraphEdgeType.HIERARCHICAL,
        weight: 1.0,
        description: 'Parent-child relationship',
        evidenceCount: 1,
      }));

    await this.upsertEdges(edges);
  }

  private async buildCoOccurrenceEdges(): Promise<void> {
    // Build co-occurrence edges between conditions that share the same organ system
    const conditions = await prisma.condition.findMany({
      select: { id: true, system: true },
    });

    // Group conditions by system
    const bySystem = new Map<string, string[]>();
    for (const c of conditions) {
      if (!c.system) continue;
      const list = bySystem.get(c.system) ?? [];
      list.push(c.id);
      bySystem.set(c.system, list);
    }

    const edges: GraphEdgeData[] = [];
    for (const [, conditionIds] of bySystem) {
      // Create edges between conditions in same system (limit pairwise to avoid explosion)
      const limited = conditionIds.slice(0, 50);
      for (let i = 0; i < limited.length; i++) {
        for (let j = i + 1; j < limited.length; j++) {
          edges.push({
            id: `cooccur:condition:${limited[i]}->condition:${limited[j]}`,
            sourceId: `condition:${limited[i]}`,
            targetId: `condition:${limited[j]}`,
            edgeType: GraphEdgeType.ASSOCIATED,
            weight: 0.3,
            description: 'Same organ system co-occurrence',
            evidenceCount: 1,
          });
        }
      }
    }

    if (edges.length > 0) await this.upsertEdges(edges);
  }

  private async buildAssociatedEdges(): Promise<void> {
    // Build edges from existing link tables
    const tasks = [
      this.buildAnatomyConditionEdges(),
      // Other link tables remain as placeholder calls
      this.buildEdgesFromLinkTable('DrugConditionLink', 'drug', 'condition', GraphEdgeType.ASSOCIATED),
      this.buildEdgesFromLinkTable('FindingConditionLink', 'finding', 'condition', GraphEdgeType.ASSOCIATED),
      this.buildEdgesFromLinkTable('LabConditionLink', 'labTest', 'condition', GraphEdgeType.ASSOCIATED),
      this.buildEdgesFromLinkTable('ImagingConditionLink', 'imaging', 'condition', GraphEdgeType.ASSOCIATED),
      this.buildEdgesFromLinkTable('ProcedureConditionLink', 'procedure', 'condition', GraphEdgeType.ASSOCIATED),
      this.buildEdgesFromLinkTable('VitalSignConditionLink', 'vitalSign', 'condition', GraphEdgeType.ASSOCIATED),
      this.buildEdgesFromLinkTable('AntibioticConditionLink', 'antibiotic', 'condition', GraphEdgeType.ASSOCIATED),
    ];

    await Promise.all(tasks);
  }

  private async buildAnatomyConditionEdges(): Promise<void> {
    const links = await prisma.anatomyConditionLink.findMany({
      select: {
        anatomyId: true,
        conditionId: true,
        relationshipType: true,
      },
    });

    const edges: GraphEdgeData[] = links.map(link => ({
      id: `anatomy-condition:${link.anatomyId}-${link.conditionId}`,
      sourceId: `anatomy:${link.anatomyId}`,
      targetId: `condition:${link.conditionId}`,
      edgeType: GraphEdgeType.ASSOCIATED,
      weight: 1.0,
      description: link.relationshipType || 'Associated',
      evidenceCount: 1,
    }));

    await this.upsertEdges(edges);
  }

  private async buildEdgesFromLinkTable(
    modelName: string,
    sourcePrefix: string,
    targetPrefix: string,
    edgeType: GraphEdgeType,
  ): Promise<void> {
    try {
      // Access prisma model dynamically — cast to any for dynamic key access
      const model = (prisma as unknown as Record<
        string,
        { findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]> }
      >)[
        modelName.charAt(0).toLowerCase() + modelName.slice(1)
      ] as
        | { findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]> }
        | undefined;
      if (!model?.findMany) return;

      const sourceKey = `${sourcePrefix}Id`;
      const targetKey = `${targetPrefix}Id`;
      const links = await model.findMany({ select: { [sourceKey]: true, [targetKey]: true }, take: 5000 });

      const edges: GraphEdgeData[] = [];
      for (const link of links) {
        const sourceValue = link[sourceKey];
        const targetValue = link[targetKey];
        if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') continue;

        edges.push({
          id: `link:${sourcePrefix}:${sourceValue}->${targetPrefix}:${targetValue}`,
          sourceId: `${sourcePrefix}:${sourceValue}`,
          targetId: `${targetPrefix}:${targetValue}`,
          edgeType,
          weight: 0.6,
          description: `${modelName} association`,
          evidenceCount: 1,
        });
      }

      if (edges.length > 0) await this.upsertEdges(edges);
    } catch {
      // Link table may not exist — skip silently
    }
  }

  // --- Database Operations ---

  private toJsonValue(value: GraphNodeData['metadata'] | GraphEdgeData['metadata'] | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined) return Prisma.JsonNull;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private async upsertNodes(nodes: GraphNodeData[]): Promise<void> {
    const batchSize = this.options.batchSize ?? 1000;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((node) =>
          prisma.graphNode.upsert({
            where: { sourceType_sourceId: { sourceType: node.sourceType, sourceId: node.sourceId } },
            update: {
              nodeType: node.nodeType,
              label: node.label,
              description: node.description ?? null,
              taxonomyCode: node.taxonomyCode ?? null,
              systemCodes: node.systemCodes,
              metadata: this.toJsonValue(node.metadata),
              updatedAt: new Date(),
            },
            create: {
              id: node.id,
              nodeType: node.nodeType,
              label: node.label,
              description: node.description ?? null,
              sourceType: node.sourceType,
              sourceId: node.sourceId,
              taxonomyCode: node.taxonomyCode ?? null,
              systemCodes: node.systemCodes,
              metadata: this.toJsonValue(node.metadata),
              updatedAt: new Date(),
            },
          }),
        ),
      );
    }
  }

  private async upsertEdges(edges: GraphEdgeData[]): Promise<void> {
    const batchSize = this.options.batchSize ?? 1000;
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
              weight: edge.weight ?? null,
              description: edge.description ?? null,
              evidenceCount: edge.evidenceCount ?? null,
              metadata: this.toJsonValue(edge.metadata),
              updatedAt: new Date(),
            },
            create: {
              id: edge.id,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              edgeType: edge.edgeType,
              weight: edge.weight ?? null,
              description: edge.description ?? null,
              evidenceCount: edge.evidenceCount ?? null,
              metadata: this.toJsonValue(edge.metadata),
              updatedAt: new Date(),
            },
          }),
        ),
      );
    }
  }
}
