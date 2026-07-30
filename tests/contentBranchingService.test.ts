// SAFE-OVERRIDE: Writing new test file for contentBranchingService - no destructive operations
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid-' + Math.random().toString(36).slice(2) }));

vi.mock('../lib/prisma', () => ({
  prisma: {
    contentBranch: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    branchChange: { create: vi.fn(), deleteMany: vi.fn() },
    medicalContent: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), scope: vi.fn().mockReturnThis() },
}));

import * as branchService from '../lib/services/contentBranchingService';
import { prisma } from '../lib/prisma';

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = 'postgresql://test';
  mockPrisma.medicalContent.findMany.mockResolvedValue([]);
});

describe('contentBranchingService', () => {
  describe('createBranch', () => {
    it('creates a branch successfully', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue(null);
      mockPrisma.contentBranch.create.mockResolvedValue({ id: 'branch-1' });

      const id = await branchService.createBranch({ name: 'test-branch', createdBy: 'user-1' });
      expect(id).toBe('branch-1');
      expect(mockPrisma.contentBranch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'test-branch', createdBy: 'user-1', baseBranch: 'main' }),
      });
    });

    it('uses provided baseBranch', async () => {
      mockPrisma.contentBranch.findUnique
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce({ id: 'base-1' }); // base branch exists
      mockPrisma.contentBranch.create.mockResolvedValue({ id: 'branch-2' });

      const id = await branchService.createBranch({ name: 'feature-x', baseBranch: 'develop', createdBy: 'user-1' });
      expect(id).toBe('branch-2');
      expect(mockPrisma.contentBranch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ baseBranch: 'develop' }) })
      );
    });

    it('throws on duplicate branch name', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        branchService.createBranch({ name: 'existing-branch', createdBy: 'user-1' })
      ).rejects.toThrow('already exists');
    });

    it('throws when base branch does not exist', async () => {
      mockPrisma.contentBranch.findUnique
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce(null); // base not found

      await expect(
        branchService.createBranch({ name: 'feature', baseBranch: 'nonexistent', createdBy: 'user-1' })
      ).rejects.toThrow('does not exist');
    });

    it('throws on invalid branch name', async () => {
      await expect(
        branchService.createBranch({ name: 'has spaces!', createdBy: 'user-1' })
      ).rejects.toThrow('can only contain');
    });

    it('throws on special characters in name', async () => {
      await expect(
        branchService.createBranch({ name: 'branch@#$', createdBy: 'user-1' })
      ).rejects.toThrow('can only contain');
    });

    it('allows hyphens and underscores in name', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue(null);
      mockPrisma.contentBranch.create.mockResolvedValue({ id: 'branch-ok' });

      const id = await branchService.createBranch({ name: 'my_feature-branch', createdBy: 'user-1' });
      expect(id).toBe('branch-ok');
    });

    it('throws when DATABASE_URL not set', async () => {
      delete process.env.DATABASE_URL;
      await expect(
        branchService.createBranch({ name: 'test', createdBy: 'user-1' })
      ).rejects.toThrow('Database not configured');
    });
  });

  describe('addChangeToBranch', () => {
    it('adds a change to an active branch', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'b1', status: 'active' });
      mockPrisma.branchChange.create.mockResolvedValue({ id: 'change-1' });
      mockPrisma.contentBranch.update.mockResolvedValue({});

      const id = await branchService.addChangeToBranch('my-branch', {
        contentId: 'content-1',
        conditionId: 'cond-1',
        changeType: 'update',
        contentData: { title: 'Updated' },
        createdBy: 'user-1',
      });
      expect(id).toBe('change-1');
      expect(mockPrisma.branchChange.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ contentId: 'content-1', changeType: 'update' }) })
      );
      expect(mockPrisma.contentBranch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { changeCount: { increment: 1 } } })
      );
    });

    it('supports create change type', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'b1', status: 'active' });
      mockPrisma.branchChange.create.mockResolvedValue({ id: 'change-2' });
      mockPrisma.contentBranch.update.mockResolvedValue({});

      const id = await branchService.addChangeToBranch('my-branch', {
        contentId: 'content-new',
        conditionId: 'cond-1',
        changeType: 'create',
        contentData: { title: 'New content' },
        createdBy: 'user-1',
      });
      expect(mockPrisma.branchChange.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ changeType: 'create' }) })
      );
    });

    it('supports delete change type', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'b1', status: 'active' });
      mockPrisma.branchChange.create.mockResolvedValue({ id: 'change-3' });
      mockPrisma.contentBranch.update.mockResolvedValue({});

      await branchService.addChangeToBranch('my-branch', {
        contentId: 'content-del',
        conditionId: 'cond-1',
        changeType: 'delete',
        contentData: {},
        createdBy: 'user-1',
      });
      expect(mockPrisma.branchChange.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ changeType: 'delete' }) })
      );
    });

    it('throws when branch not found', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue(null);

      await expect(
        branchService.addChangeToBranch('nonexistent', { contentId: 'c1', conditionId: 'cond', changeType: 'update', contentData: {}, createdBy: 'u1' })
      ).rejects.toThrow('not found');
    });

    it('throws when branch is not active', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'b1', status: 'merged' });

      await expect(
        branchService.addChangeToBranch('merged-branch', { contentId: 'c1', conditionId: 'cond', changeType: 'update', contentData: {}, createdBy: 'u1' })
      ).rejects.toThrow('merged and cannot accept changes');
    });

    it('throws when DATABASE_URL not set', async () => {
      delete process.env.DATABASE_URL;
      await expect(
        branchService.addChangeToBranch('x', { contentId: 'c', conditionId: 'cond', changeType: 'update', contentData: {}, createdBy: 'u' })
      ).rejects.toThrow('Database not configured');
    });
  });

  describe('getBranchChanges', () => {
    it('returns changes ordered by createdAt desc', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({
        id: 'b1',
        BranchChange: [
          { contentId: 'c2', conditionId: 'cond2', changeType: 'update', contentData: {}, previousData: null, createdBy: 'u1', createdAt: new Date('2026-04-17T12:00:00') },
          { contentId: 'c1', conditionId: 'cond1', changeType: 'create', contentData: {}, previousData: null, createdBy: 'u1', createdAt: new Date('2026-04-17T10:00:00') },
        ],
      });

      const changes = await branchService.getBranchChanges('my-branch');
      expect(changes).toHaveLength(2);
      expect(changes[0].contentId).toBe('c2');
      expect(changes[1].contentId).toBe('c1');
    });

    it('throws when branch not found', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue(null);

      await expect(branchService.getBranchChanges('nonexistent')).rejects.toThrow('not found');
    });

    it('returns empty array when DATABASE_URL not set', async () => {
      delete process.env.DATABASE_URL;
      const result = await branchService.getBranchChanges('any');
      expect(result).toEqual([]);
    });
  });

  describe('mergeBranch', () => {
    it('merges an active branch successfully', async () => {
      const branch = {
        id: 'b1',
        status: 'active',
        createdAt: new Date('2026-04-15'),
        BranchChange: [{ contentId: 'c-new', conditionId: 'cond', changeType: 'create', contentData: { title: 'New' } }],
      };
      mockPrisma.contentBranch.findUnique.mockResolvedValue(branch);
      mockPrisma.medicalContent.findUnique.mockResolvedValue(null); // no conflict for create
      mockPrisma.medicalContent.create.mockResolvedValue({ id: 'c-new' });
      mockPrisma.contentBranch.update.mockResolvedValue({});

      const result = await branchService.mergeBranch('my-branch', 'admin-1');
      expect(result.success).toBe(true);
      expect(result.mergedCount).toBe(1);
      expect(result.message).toContain('Successfully merged');
      expect(mockPrisma.contentBranch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'merged', mergedBy: 'admin-1' }) })
      );
    });

    it('detects update conflict when content modified after branch creation', async () => {
      const branch = {
        id: 'b1',
        status: 'active',
        createdAt: new Date('2026-04-15'),
        BranchChange: [{ contentId: 'c-existing', conditionId: 'cond', changeType: 'update', contentData: { title: 'Updated' } }],
      };
      mockPrisma.contentBranch.findUnique.mockResolvedValue(branch);
      mockPrisma.medicalContent.findMany.mockResolvedValue([{ id: 'c-existing', updatedAt: new Date('2026-04-16') }]);
      mockPrisma.medicalContent.findUnique.mockResolvedValue({ id: 'c-existing', updatedAt: new Date('2026-04-16') });

      const result = await branchService.mergeBranch('my-branch', 'admin-1');
      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toContain('modified since branch creation');
    });

    it('detects create conflict when content already exists', async () => {
      const branch = {
        id: 'b1',
        status: 'active',
        createdAt: new Date('2026-04-15'),
        BranchChange: [{ contentId: 'c-existing', conditionId: 'cond', changeType: 'create', contentData: { title: 'New' } }],
      };
      mockPrisma.contentBranch.findUnique.mockResolvedValue(branch);
      mockPrisma.medicalContent.findMany.mockResolvedValue([{ id: 'c-existing' }]);
      mockPrisma.medicalContent.findUnique.mockResolvedValue({ id: 'c-existing' });

      const result = await branchService.mergeBranch('my-branch', 'admin-1');
      expect(result.success).toBe(false);
      expect(result.conflicts[0].reason).toContain('already exists');
    });

    it('detects delete conflict when content already deleted', async () => {
      const branch = {
        id: 'b1',
        status: 'active',
        createdAt: new Date('2026-04-15'),
        BranchChange: [{ contentId: 'c-deleted', conditionId: 'cond', changeType: 'delete', contentData: {} }],
      };
      mockPrisma.contentBranch.findUnique.mockResolvedValue(branch);
      mockPrisma.medicalContent.findUnique.mockResolvedValue(null);

      const result = await branchService.mergeBranch('my-branch', 'admin-1');
      expect(result.success).toBe(false);
      expect(result.conflicts[0].reason).toContain('already been deleted');
    });

    it('continues applying changes when one fails', async () => {
      const branch = {
        id: 'b1',
        status: 'active',
        createdAt: new Date('2026-04-15'),
        BranchChange: [
          { contentId: 'c1', conditionId: 'cond', changeType: 'create', contentData: { title: 'OK' } },
          { contentId: 'c2', conditionId: 'cond', changeType: 'create', contentData: { title: 'FAIL' } },
        ],
      };
      mockPrisma.contentBranch.findUnique.mockResolvedValue(branch);
      mockPrisma.medicalContent.findUnique.mockResolvedValue(null);
      mockPrisma.medicalContent.create
        .mockResolvedValueOnce({ id: 'c1' })
        .mockRejectedValueOnce(new Error('DB constraint violation'));
      mockPrisma.contentBranch.update.mockResolvedValue({});

      const result = await branchService.mergeBranch('my-branch', 'admin-1');
      expect(result.success).toBe(true);
      expect(result.mergedCount).toBe(1);
    });

    it('throws when branch not found', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue(null);
      await expect(branchService.mergeBranch('nonexistent', 'admin')).rejects.toThrow('not found');
    });

    it('throws when branch is not active', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'b1', status: 'archived', BranchChange: [] });
      await expect(branchService.mergeBranch('archived', 'admin')).rejects.toThrow('archived and cannot be merged');
    });

    it('throws when DATABASE_URL not set', async () => {
      delete process.env.DATABASE_URL;
      await expect(branchService.mergeBranch('x', 'admin')).rejects.toThrow('Database not configured');
    });
  });

  describe('listBranches', () => {
    it('returns non-archived branches by default', async () => {
      mockPrisma.contentBranch.findMany.mockResolvedValue([
        { id: 'b1', name: 'branch-1', description: 'desc', baseBranch: 'main', status: 'active', createdBy: 'u1', createdAt: new Date(), updatedAt: new Date(), mergedAt: null, _count: { BranchChange: 3 } },
      ]);

      const branches = await branchService.listBranches();
      expect(branches).toHaveLength(1);
      expect(branches[0].name).toBe('branch-1');
      expect(branches[0].changeCount).toBe(3);
      expect(mockPrisma.contentBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { not: 'archived' } } })
      );
    });

    it('includes archived when flag is true', async () => {
      mockPrisma.contentBranch.findMany.mockResolvedValue([]);
      await branchService.listBranches(true);
      expect(mockPrisma.contentBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    it('returns empty array when DATABASE_URL not set', async () => {
      delete process.env.DATABASE_URL;
      expect(await branchService.listBranches()).toEqual([]);
    });

    it('returns empty array on DB error', async () => {
      mockPrisma.contentBranch.findMany.mockRejectedValue(new Error('DB error'));
      expect(await branchService.listBranches()).toEqual([]);
    });
  });

  describe('deleteBranch', () => {
    it('deletes an active branch and its changes', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'b1', status: 'active' });
      mockPrisma.branchChange.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.contentBranch.delete.mockResolvedValue({});

      await branchService.deleteBranch('my-branch');
      expect(mockPrisma.branchChange.deleteMany).toHaveBeenCalledWith({ where: { branchId: 'b1' } });
      expect(mockPrisma.contentBranch.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    });

    it('throws when branch not found', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue(null);
      await expect(branchService.deleteBranch('nonexistent')).rejects.toThrow('not found');
    });

    it('throws when branch is merged', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({ id: 'b1', status: 'merged' });
      await expect(branchService.deleteBranch('merged-branch')).rejects.toThrow('Cannot delete a merged branch');
    });

    it('throws when DATABASE_URL not set', async () => {
      delete process.env.DATABASE_URL;
      await expect(branchService.deleteBranch('x')).rejects.toThrow('Database not configured');
    });
  });

  describe('compareBranches', () => {
    it('returns correct change counts by type', async () => {
      mockPrisma.contentBranch.findUnique.mockResolvedValue({
        id: 'b1',
        BranchChange: [
          { contentId: 'c1', conditionId: 'cond1', changeType: 'create', contentData: {}, previousData: null, createdBy: 'u1', createdAt: new Date('2026-04-17T12:00:00') },
          { contentId: 'c2', conditionId: 'cond2', changeType: 'update', contentData: {}, previousData: null, createdBy: 'u1', createdAt: new Date('2026-04-17T11:00:00') },
          { contentId: 'c2', conditionId: 'cond2', changeType: 'update', contentData: {}, previousData: null, createdBy: 'u1', createdAt: new Date('2026-04-17T10:00:00') },
          { contentId: 'c3', conditionId: 'cond3', changeType: 'delete', contentData: {}, previousData: null, createdBy: 'u1', createdAt: new Date('2026-04-17T09:00:00') },
        ],
      });

      const result = await branchService.compareBranches('my-branch');
      expect(result.added).toEqual(['cond1']);
      expect(result.modified).toEqual(['cond2', 'cond2']);
      expect(result.deleted).toEqual(['cond3']);
      expect(result.total).toBe(4);
    });

    it('returns empty result when DATABASE_URL not set', async () => {
      delete process.env.DATABASE_URL;
      const result = await branchService.compareBranches('any');
      expect(result).toEqual({ added: [], modified: [], deleted: [], total: 0 });
    });

    it('returns empty result on error', async () => {
      mockPrisma.contentBranch.findUnique.mockRejectedValue(new Error('fail'));
      const result = await branchService.compareBranches('any');
      expect(result).toEqual({ added: [], modified: [], deleted: [], total: 0 });
    });
  });
});
