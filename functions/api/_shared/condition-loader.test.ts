import { describe, expect, it, vi } from 'vitest';
import {
  loadConditionData,
  loadConditionsBySystem,
  loadRandomCondition,
} from './condition-loader';

function createPrismaMock(rows: unknown[] = []) {
  return {
    medicalContent: {
      findFirst: vi.fn(async () => rows.shift() ?? null),
      findMany: vi.fn(async () => rows),
      count: vi.fn(async () => rows.length),
    },
  };
}

describe('condition-loader', () => {
  it('queries MedicalContent.condition and returns it as name', async () => {
    const prisma = createPrismaMock([
      {
        id: 'content-1',
        condition: 'Pulmonary embolism',
        system: 'PULM',
        subcategory: 'Vascular',
        content: '{"overview":"VTE"}',
      },
    ]);

    const result = await loadConditionData(prisma, 'Pulmonary embolism');

    expect(prisma.medicalContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ['published', 'approved'] },
          condition: {
            equals: 'Pulmonary embolism',
            mode: 'insensitive',
          },
        },
        select: expect.objectContaining({
          condition: true,
        }),
      })
    );
    expect(JSON.stringify(prisma.medicalContent.findFirst.mock.calls[0]?.[0])).not.toContain(
      '"name"'
    );
    expect(result).toEqual({
      id: 'content-1',
      conditionId: undefined,
      name: 'Pulmonary embolism',
      system: 'PULM',
      subcategory: 'Vascular',
      content: { overview: 'VTE' },
    });
  });

  it('maps MedicalContent.condition for system and random loaders', async () => {
    const rows = [
      {
        id: 'content-2',
        condition: 'Asthma',
        system: 'PULM',
        subcategory: 'Obstructive',
        content: { overview: 'Reversible airway obstruction' },
      },
    ];

    const bySystemPrisma = createPrismaMock([...rows]);
    await expect(loadConditionsBySystem(bySystemPrisma, 'PULM')).resolves.toEqual([
      {
        id: 'content-2',
        conditionId: undefined,
        name: 'Asthma',
        system: 'PULM',
        subcategory: 'Obstructive',
        content: { overview: 'Reversible airway obstruction' },
      },
    ]);

    const randomPrisma = createPrismaMock([...rows]);
    await expect(loadRandomCondition(randomPrisma)).resolves.toMatchObject({
      id: 'content-2',
      name: 'Asthma',
    });
  });

  it('filters every loader to published or approved medical content', async () => {
    const exactPrisma = createPrismaMock([]);
    await loadConditionData(exactPrisma, 'Asthma');
    expect(exactPrisma.medicalContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['published', 'approved'] },
        }),
      })
    );

    const systemPrisma = createPrismaMock([]);
    await loadConditionsBySystem(systemPrisma, 'PULM');
    expect(systemPrisma.medicalContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['published', 'approved'] },
        }),
      })
    );

    const randomPrisma = createPrismaMock([]);
    await loadRandomCondition(randomPrisma);
    expect(randomPrisma.medicalContent.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { in: ['published', 'approved'] },
      }),
    });
  });
});
