/**
 * blueprintCoverageCheck — Integration Tests
 *
 * Tests blueprint coverage analysis with mocked Prisma.
 * Covers: per-system coverage ratios, status classification,
 * and sorting order (worst first).
 */

import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../../toolRegistry';
import { blueprintCoverageCheckTool } from '../blueprintCoverageCheck';

describe('blueprintCoverageCheck — Input Validation', () => {
  const tool = blueprintCoverageCheckTool;

  it('accepts empty input (all systems)', () => {
    expect(() => tool.inputSchema.parse({})).not.toThrow();
  });

  it('accepts system filter', () => {
    expect(() =>
      tool.inputSchema.parse({ system: 'Cardiovascular' })
    ).not.toThrow();
  });

  it('accepts minHealthScore', () => {
    expect(() =>
      tool.inputSchema.parse({ minHealthScore: 0.5 })
    ).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({ minHealthScore: 1 })
    ).not.toThrow();
  });

  it('rejects minHealthScore > 1', () => {
    expect(() => tool.inputSchema.parse({ minHealthScore: 1.5 })).toThrow();
  });

  it('rejects minHealthScore < 0', () => {
    expect(() => tool.inputSchema.parse({ minHealthScore: -0.1 })).toThrow();
  });
});

describe('blueprintCoverageCheck — Execution', () => {
  it('classifies critical coverage (<50%)', async () => {
    const mockPrisma = {
      question: {
        count: vi.fn()
          .mockResolvedValueOnce(3000) // total pool size
          .mockResolvedValueOnce(50),  // CV questions (target: 330)
      },
    };

    const result = await blueprintCoverageCheckTool.execute(
      { system: 'Cardiovascular' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.systems).toHaveLength(1);
    const cv = result.systems[0]!;
    expect(cv.status).toBe('critical');
    expect(cv.coverageRatio).toBeLessThan(0.5);
    expect(cv.deficit).toBeGreaterThan(0);
  });

  it('classifies under coverage (50-80%)', async () => {
    const mockPrisma = {
      question: {
        count: vi.fn()
          .mockResolvedValueOnce(3000) // total
          .mockResolvedValueOnce(200), // questions (target: 330 for CV at 11%)
      },
    };

    const result = await blueprintCoverageCheckTool.execute(
      { system: 'Cardiovascular' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    const cv = result.systems[0]!;
    expect(cv.status).toBe('under');
  });

  it('classifies on_target coverage (80-120%)', async () => {
    const mockPrisma = {
      question: {
        count: vi.fn()
          .mockResolvedValueOnce(3000) // total
          .mockResolvedValueOnce(330), // exact target
      },
    };

    const result = await blueprintCoverageCheckTool.execute(
      { system: 'Cardiovascular' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    const cv = result.systems[0]!;
    expect(cv.status).toBe('on_target');
    expect(cv.coverageRatio).toBeGreaterThanOrEqual(0.8);
    expect(cv.coverageRatio).toBeLessThanOrEqual(1.2);
  });

  it('returns all systems sorted by coverage (worst first)', async () => {
    // Mock: return different counts per system
    const counts: Record<string, number> = {
      Cardiovascular: 50,
      Pulmonary: 150,
      Gastrointestinal: 300,
      Musculoskeletal: 270,
      HEENT: 200,
      Reproductive: 100,
      Neurological: 210,
      Psychiatry: 210,
      Endocrine: 180,
      Dermatology: 150,
      Genitourinary: 150,
      Hematology: 120,
      'Infectious Disease': 80,
      Nephrology: 120,
      'Emergency Medicine': 60,
      General: 60,
    };

    const mockPrisma = {
      question: {
        count: vi.fn(({ where }: { where: Record<string, unknown> }) => {
          const system = where.system as string | undefined;
          // First call: total pool size
          // Subsequent calls: per-system counts
          return Promise.resolve(system ? (counts[system] ?? 0) : 3000);
        }),
      },
    };

    const result = await blueprintCoverageCheckTool.execute(
      {},
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.systems.length).toBe(16);
    // First system should have the worst coverage ratio
    const ratios = result.systems.map((s) => s.coverageRatio);
    expect(ratios[0]).toBeLessThanOrEqual(ratios[ratios.length - 1]!);
  });

  it('reports total pool size', async () => {
    const mockPrisma = {
      question: {
        count: vi.fn().mockResolvedValue(2500),
      },
    };

    const result = await blueprintCoverageCheckTool.execute(
      { system: 'Cardiovascular' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.totalPoolSize).toBe(2500);
  });

  it('includes timestamp', async () => {
    const mockPrisma = {
      question: {
        count: vi.fn().mockResolvedValue(3000),
      },
    };

    const result = await blueprintCoverageCheckTool.execute(
      { system: 'Cardiovascular' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.timestamp).toBeDefined();
    expect(() => new Date(result.timestamp)).not.toThrow();
  });
});
