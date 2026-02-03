import { describe, it, expect, vi } from 'vitest';
import { resolveUserByClerkId } from '@/functions/api/_shared/resolveUser';

describe('resolveUserByClerkId', () => {
  it('returns user id when found and calls prisma with correct where/select', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'user_123' });
    const prisma = { user: { findUnique } } as any;

    const result = await resolveUserByClerkId(prisma, 'clerk_abc');

    expect(result).toEqual({ id: 'user_123' });
    expect(findUnique).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_abc' },
      select: { id: true },
    });
  });

  it('returns null when not found', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findUnique } } as any;

    const result = await resolveUserByClerkId(prisma, 'clerk_missing');
    expect(result).toBeNull();
  });
});

