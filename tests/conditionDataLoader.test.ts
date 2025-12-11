import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    medicalContent: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  loadConditionData,
  getAllConditionIds,
  getConditionsBySystem,
} from '../services/conditionDataLoader';

import { prisma } from '../lib/prisma';

describe('Condition Data Loader - Database First', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set DATABASE_URL to enable database mode
    process.env.DATABASE_URL = 'postgresql://test';
  });

  describe('loadConditionData', () => {
    it('should load condition data from database by conditionId', async () => {
      const mockCondition = {
        id: 'uuid-1',
        conditionId: 'CV__ecg__atrial_fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        condition: 'Atrial Fibrillation',
        relatedSystems: [],
        content: {
          overview: 'Irregular heart rhythm',
          symptoms: ['Palpitations', 'Dyspnea'],
        },
        status: 'published',
      };

      (prisma.medicalContent.findUnique as any).mockResolvedValue(mockCondition);

      const result = await loadConditionData('CV__ecg__atrial_fibrillation');

      expect(result).not.toBeNull();
      expect(result?.conditionId).toBe('CV__ecg__atrial_fibrillation');
      expect(result?.system).toBe('CV');
      expect(result?.content.overview).toBe('Irregular heart rhythm');
      expect(prisma.medicalContent.findUnique).toHaveBeenCalledWith({
        where: {
          conditionId: 'CV__ecg__atrial_fibrillation',
          status: 'published',
        },
      });
    });

    it('should try case-insensitive search if exact match not found', async () => {
      (prisma.medicalContent.findUnique as any).mockResolvedValue(null);
      
      const mockCondition = {
        id: 'uuid-1',
        conditionId: 'CV__ecg__atrial_fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        condition: 'Atrial Fibrillation',
        relatedSystems: [],
        content: {
          overview: 'Irregular heart rhythm',
        },
        status: 'published',
      };

      (prisma.medicalContent.findFirst as any).mockResolvedValue(mockCondition);

      const result = await loadConditionData('Atrial Fibrillation');

      expect(result).not.toBeNull();
      expect(result?.conditionId).toBe('CV__ecg__atrial_fibrillation');
      expect(prisma.medicalContent.findFirst).toHaveBeenCalled();
    });

    it('should include relatedSystems in result', async () => {
      const mockCondition = {
        id: 'uuid-1',
        conditionId: 'PULM__infection__sarcoidosis',
        system: 'PULM',
        subcategory: 'Infection',
        condition: 'Sarcoidosis',
        relatedSystems: ['DERM', 'HEENT'],
        content: {
          overview: 'Multi-system granulomatous disease',
        },
        status: 'published',
      };

      (prisma.medicalContent.findUnique as any).mockResolvedValue(mockCondition);

      const result = await loadConditionData('PULM__infection__sarcoidosis');

      expect(result).not.toBeNull();
      expect(result?.relatedSystems).toEqual(['DERM', 'HEENT']);
      // Meta may have additional relatedSystems from registry if condition is found
      expect(result?.meta.relatedSystems).toBeDefined();
    });

    it('should return null if condition not found', async () => {
      (prisma.medicalContent.findUnique as any).mockResolvedValue(null);
      (prisma.medicalContent.findFirst as any).mockResolvedValue(null);

      const result = await loadConditionData('NonExistent');

      expect(result).toBeNull();
    });

    it('should return null if DATABASE_URL not configured', async () => {
      delete process.env.DATABASE_URL;

      const result = await loadConditionData('CV__ecg__atrial_fibrillation');

      expect(result).toBeNull();
      expect(prisma.medicalContent.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getAllConditionIds', () => {
    it('should return all published condition IDs', async () => {
      const mockConditions = [
        { conditionId: 'CV__ecg__atrial_fibrillation' },
        { conditionId: 'PULM__infection__pneumonia' },
        { conditionId: 'GI__inflammatory__crohns_disease' },
      ];

      (prisma.medicalContent.findMany as any).mockResolvedValue(mockConditions);

      const result = await getAllConditionIds();

      expect(result).toHaveLength(3);
      expect(result).toContain('CV__ecg__atrial_fibrillation');
      expect(prisma.medicalContent.findMany).toHaveBeenCalledWith({
        where: { status: 'published' },
        select: { conditionId: true },
      });
    });

    it('should return empty array if DATABASE_URL not configured', async () => {
      delete process.env.DATABASE_URL;

      const result = await getAllConditionIds();

      expect(result).toEqual([]);
      expect(prisma.medicalContent.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getConditionsBySystem', () => {
    it('should return conditions by primary system', async () => {
      const mockConditions = [
        { conditionId: 'CV__ecg__atrial_fibrillation' },
        { conditionId: 'CV__ischemic__stemi' },
      ];

      (prisma.medicalContent.findMany as any).mockResolvedValue(mockConditions);

      const result = await getConditionsBySystem('CV');

      expect(result).toHaveLength(2);
      expect(result).toContain('CV__ecg__atrial_fibrillation');
      expect(prisma.medicalContent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'published',
          OR: [
            { system: 'CV' },
            { relatedSystems: { has: 'CV' } },
          ],
        },
        select: { conditionId: true },
      });
    });

    it('should include conditions with system in relatedSystems', async () => {
      const mockConditions = [
        { conditionId: 'PULM__infection__sarcoidosis' }, // Has DERM in relatedSystems
        { conditionId: 'DERM__inflammatory__psoriasis' }, // Primary DERM
      ];

      (prisma.medicalContent.findMany as any).mockResolvedValue(mockConditions);

      const result = await getConditionsBySystem('DERM');

      expect(result).toHaveLength(2);
      expect(result).toContain('PULM__infection__sarcoidosis'); // Multi-system condition
      expect(result).toContain('DERM__inflammatory__psoriasis');
    });

    it('should return empty array if DATABASE_URL not configured', async () => {
      delete process.env.DATABASE_URL;

      const result = await getConditionsBySystem('CV');

      expect(result).toEqual([]);
      expect(prisma.medicalContent.findMany).not.toHaveBeenCalled();
    });
  });
});
