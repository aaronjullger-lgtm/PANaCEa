import { createEdgePrismaClient, CACHE_STRATEGY } from '../../../functions/api/_shared/prisma-edge';
import { MedicalContentSchema, type MedicalContentData, type ConditionMeta } from './types';
import { logger } from '../../logger';

const LOG_SCOPE = 'ContentService';

export class ContentService {
  private prisma: ReturnType<typeof createEdgePrismaClient>;

  constructor(databaseUrl: string) {
    this.prisma = createEdgePrismaClient(databaseUrl);
  }

  /**
   * Fetch standardized condition metadata
   */
  async getConditionMeta(conditionId: string): Promise<ConditionMeta | null> {
    const [condition, medicalContent] = await Promise.all([
      this.prisma.condition.findUnique({
        where: { id: conditionId },
        ...(CACHE_STRATEGY.STATIC as Record<string, unknown>),
      }),
      this.prisma.medicalContent.findUnique({
        where: { conditionId },
        select: { id: true, status: true },
        ...(CACHE_STRATEGY.STATIC as Record<string, unknown>),
      }),
    ]);

    if (!condition) return null;

    return {
      id: condition.id,
      conditionId: condition.id,
      name: condition.name,
      system: condition.system,
      subcategory: condition.subcategory,
      status: medicalContent?.status ?? 'draft',
      hasContent: !!medicalContent,
    };
  }

  /**
   * Load fully typed Medical Content
   */
  async getConditionContent(conditionId: string): Promise<MedicalContentData | null> {
    const content = await this.prisma.medicalContent.findUnique({
      where: { conditionId },
      ...(CACHE_STRATEGY.STATIC as Record<string, unknown>),
    });

    if (!content || !content.content) return null;

    try {
      // Parse and validate using Zod
      // The database stores JSON, so we coerce it to our schema
      return MedicalContentSchema.parse(content.content);
    } catch (error) {
      logger.error(LOG_SCOPE, `Validation failed for condition ${conditionId}`, error);
      return null;
    }
  }

  /**
   * Batch load Medical Content for multiple conditions
   */
  async getConditionsContent(conditionIds: string[]): Promise<Map<string, MedicalContentData>> {
    const contents = await this.prisma.medicalContent.findMany({
      where: { conditionId: { in: conditionIds } },
      ...(CACHE_STRATEGY.STATIC as Record<string, unknown>),
    });

    const resultMap = new Map<string, MedicalContentData>();

    for (const content of contents) {
      if (content.content) {
        try {
          const parsed = MedicalContentSchema.parse(content.content);
          resultMap.set(content.conditionId, parsed);
        } catch (error) {
          logger.error(LOG_SCOPE, `Validation failed for condition ${content.conditionId}`, error);
        }
      }
    }

    return resultMap;
  }

  /**
   * Get formatted clinical pearls for a condition
   */
  async getClinicalPearls(conditionId: string): Promise<string[]> {
    const content = await this.getConditionContent(conditionId);
    return content?.clinical_pearls || [];
  }

  /**
   * Get all conditions for a specific system
   */
  async getConditionsBySystem(system: string): Promise<ConditionMeta[]> {
    const conditions = await this.prisma.condition.findMany({
      where: { system },
      ...(CACHE_STRATEGY.STATIC as Record<string, unknown>),
    });
    if (conditions.length === 0) return [];
    const contentByCondition = await this.prisma.medicalContent.findMany({
      where: { conditionId: { in: conditions.map((c) => c.id) } },
      select: { conditionId: true, status: true },
      ...(CACHE_STRATEGY.STATIC as Record<string, unknown>),
    });
    const statusMap = new Map(contentByCondition.map((mc) => [mc.conditionId, mc.status]));

    return conditions.map((c) => ({
      id: c.id,
      conditionId: c.id,
      name: c.name,
      system: c.system,
      subcategory: c.subcategory,
      status: statusMap.get(c.id) ?? 'draft',
      hasContent: statusMap.has(c.id),
    }));
  }

  /**
   * Get all conditions (optionally filtered)
   */
  async getAllConditions(filter?: {
    system?: string | null;
    includeContent?: boolean;
  }): Promise<any[]> {
    const where: any = {
      status: 'published',
    };

    if (filter?.system) {
      where.OR = [
        { system: filter.system.toUpperCase() },
        { relatedSystems: { has: filter.system.toUpperCase() } },
      ];
    }

    const conditions = await this.prisma.condition.findMany({
      where,
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
        relatedSystems: true,
        aliases: true,
        displayName: true,
        status: true,
        content: filter?.includeContent || false,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ system: 'asc' }, { subcategory: 'asc' }, { name: 'asc' }],
      ...(CACHE_STRATEGY.STATIC as Record<string, unknown>),
    });

    return conditions;
  }

  /**
   * Clean up resources
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}
