/**
 * Unit tests for functions/api/user/profile.ts
 *
 * Tests GET and PUT handlers for /api/user/profile endpoint.
 * Uses vi.mock to stub middleware, Prisma, and logger dependencies,
 * then invokes the exported handlers directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockFindUnique,
  mockCreate,
  mockUpdate,
  mockDisconnect,
  capturedHandlers,
} = vi.hoisted(() => {
  const mockFindUnique = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockDisconnect = vi.fn().mockResolvedValue(undefined);
  const capturedHandlers: { get: ((ctx: any) => Promise<any>) | null; put: ((ctx: any) => Promise<any>) | null; index: number } = {
    get: null,
    put: null,
    index: 0,
  };
  return { mockFindUnique, mockCreate, mockUpdate, mockDisconnect, capturedHandlers };
});

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => ({
    user: { findUnique: mockFindUnique, create: mockCreate, update: mockUpdate },
  }),
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (schema: unknown, handler: (ctx: any) => Promise<any>) => {
    // The module calls authenticatedEndpoint twice: first for GET, then for PUT
    if (capturedHandlers.index === 0) {
      capturedHandlers.get = handler;
    } else {
      capturedHandlers.put = handler;
    }
    capturedHandlers.index++;
    return handler;
  },
  withCors: () => vi.fn(),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: () => ({
    addContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Force module load so capturedGetHandler / capturedPutHandler get set
// eslint-disable-next-line @typescript-eslint/no-require-imports
import './profile';
import { profileUpdateSchema } from '../_shared/zodSchemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_user_123' },
    validated: {},
    ...overrides,
  };
}

const NOW = new Date('2026-04-01T12:00:00.000Z');

/** A full user row as Prisma would return */
function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-1',
    clerkId: 'clerk_user_123',
    email: 'test@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    examDate: NOW,
    graduationDate: new Date('2027-05-15T00:00:00.000Z'),
    school: 'Test University',
    currentRotation: 'Family Medicine',
    yearInProgram: '2',
    rotationExamDate: new Date('2026-06-01T00:00:00.000Z'),
    eorTestDate: null as Date | null,
    rotationStartDate: new Date('2026-03-01T00:00:00.000Z'),
    rotationEndDate: new Date('2026-05-01T00:00:00.000Z'),
    hasCompletedBaseline: true,
    hasCompletedOnboarding: true,
    updatedAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure function: buildProfileUpdateData (mirrored for direct testing)
// ---------------------------------------------------------------------------

function buildProfileUpdateData(validated: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (validated.firstName !== undefined) data.firstName = validated.firstName;
  if (validated.lastName !== undefined) data.lastName = validated.lastName;
  if (validated.examDate !== undefined)
    data.examDate = validated.examDate ? new Date(validated.examDate as string) : null;
  if (validated.graduationDate !== undefined)
    data.graduationDate = validated.graduationDate
      ? new Date(validated.graduationDate as string)
      : null;
  if (validated.school !== undefined) data.school = validated.school;
  if (validated.currentRotation !== undefined) data.currentRotation = validated.currentRotation;
  if (validated.yearInProgram !== undefined) data.yearInProgram = validated.yearInProgram;
  if (validated.eorTestDate !== undefined) {
    const dateValue = validated.eorTestDate ? new Date(validated.eorTestDate as string) : null;
    data.eorTestDate = dateValue;
    data.rotationExamDate = dateValue;
  }
  if (validated.rotationStartDate !== undefined)
    data.rotationStartDate = validated.rotationStartDate
      ? new Date(validated.rotationStartDate as string)
      : null;
  if (validated.rotationEndDate !== undefined)
    data.rotationEndDate = validated.rotationEndDate
      ? new Date(validated.rotationEndDate as string)
      : null;
  if (validated.hasCompletedBaseline !== undefined)
    data.hasCompletedBaseline = validated.hasCompletedBaseline;
  if (validated.hasCompletedOnboarding !== undefined)
    data.hasCompletedOnboarding = validated.hasCompletedOnboarding;
  return data;
}

// ---------------------------------------------------------------------------
// Tests: buildProfileUpdateData (pure)
// ---------------------------------------------------------------------------

describe('buildProfileUpdateData', () => {
  it('returns empty object when no fields provided', () => {
    expect(buildProfileUpdateData({})).toEqual({});
  });

  it('includes only provided string fields', () => {
    const result = buildProfileUpdateData({ firstName: 'Aaron', school: 'Penn' });
    expect(result).toEqual({ firstName: 'Aaron', school: 'Penn' });
    expect(result).not.toHaveProperty('lastName');
  });

  it('converts date strings to Date objects', () => {
    const result = buildProfileUpdateData({ examDate: '2026-07-01T00:00:00.000Z' });
    expect(result.examDate).toBeInstanceOf(Date);
    expect((result.examDate as Date).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('sets null for nullable date fields when null is passed', () => {
    const result = buildProfileUpdateData({ examDate: null, graduationDate: null });
    expect(result.examDate).toBeNull();
    expect(result.graduationDate).toBeNull();
  });

  it('sets both eorTestDate and rotationExamDate when eorTestDate provided', () => {
    const result = buildProfileUpdateData({ eorTestDate: '2026-06-15T00:00:00.000Z' });
    expect(result.eorTestDate).toBeInstanceOf(Date);
    expect(result.rotationExamDate).toBeInstanceOf(Date);
    expect((result.eorTestDate as Date).toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect((result.rotationExamDate as Date).toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('sets both eorTestDate and rotationExamDate to null when eorTestDate is null', () => {
    const result = buildProfileUpdateData({ eorTestDate: null });
    expect(result.eorTestDate).toBeNull();
    expect(result.rotationExamDate).toBeNull();
  });

  it('handles boolean fields', () => {
    const result = buildProfileUpdateData({ hasCompletedBaseline: true, hasCompletedOnboarding: false });
    expect(result).toEqual({ hasCompletedBaseline: true, hasCompletedOnboarding: false });
  });

  it('handles all fields simultaneously', () => {
    const result = buildProfileUpdateData({
      firstName: 'Test',
      lastName: 'User',
      examDate: '2026-07-01T00:00:00.000Z',
      graduationDate: null,
      school: 'School',
      currentRotation: 'IM',
      yearInProgram: '1',
      eorTestDate: '2026-08-01T00:00:00.000Z',
      rotationStartDate: '2026-03-01T00:00:00.000Z',
      rotationEndDate: null,
      hasCompletedBaseline: true,
      hasCompletedOnboarding: false,
    });
    expect(Object.keys(result)).toHaveLength(13); // 11 fields + eorTestDate also sets rotationExamDate
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/user/profile
// ---------------------------------------------------------------------------

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a placeholder user when the row is missing', async () => {
    const placeholderUser = makeMockUser({
      email: 'clerk_user_123@placeholder.panacea.app',
      firstName: null,
      lastName: null,
      examDate: null,
      graduationDate: null,
      school: null,
      currentRotation: null,
      yearInProgram: null,
      rotationExamDate: null,
      eorTestDate: null,
      rotationStartDate: null,
      rotationEndDate: null,
      hasCompletedBaseline: false,
      hasCompletedOnboarding: false,
    });
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(placeholderUser);
    mockCreate.mockResolvedValue({ id: 'uuid-1' });
    const result = await capturedHandlers.get!(makeContext());

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.data.success).toBe(true);
    expect(result.data.profile.email).toBe('clerk_user_123@placeholder.panacea.app');
  });

  it('returns profile with ISO date strings when user found', async () => {
    const user = makeMockUser();
    mockFindUnique.mockResolvedValue(user);
    const result = await capturedHandlers.get!(makeContext());

    expect(result.data.success).toBe(true);
    expect(result.data.profile.firstName).toBe('Jane');
    expect(result.data.profile.examDate).toBe(NOW.toISOString());
    expect(result.data.profile.graduationDate).toBe('2027-05-15T00:00:00.000Z');
    expect(result.data.profile.updatedAt).toBe(NOW.toISOString());
    expect(typeof result.data.profile.examDate).toBe('string');
  });

  it('falls back to eorTestDate when rotationExamDate is null', async () => {
    const eorDate = new Date('2026-07-15T00:00:00.000Z');
    const user = makeMockUser({ rotationExamDate: null, eorTestDate: eorDate });
    mockFindUnique.mockResolvedValue(user);
    const result = await capturedHandlers.get!(makeContext());

    expect(result.data.profile.eorTestDate).toBe('2026-07-15T00:00:00.000Z');
  });

  it('prefers rotationExamDate over eorTestDate', async () => {
    const user = makeMockUser({
      rotationExamDate: new Date('2026-06-01T00:00:00.000Z'),
      eorTestDate: new Date('2026-09-01T00:00:00.000Z'),
    });
    mockFindUnique.mockResolvedValue(user);
    const result = await capturedHandlers.get!(makeContext());

    expect(result.data.profile.eorTestDate).toBe('2026-06-01T00:00:00.000Z');
  });

  it('returns null for eorTestDate when both rotationExamDate and eorTestDate are null', async () => {
    const user = makeMockUser({ rotationExamDate: null, eorTestDate: null });
    mockFindUnique.mockResolvedValue(user);
    const result = await capturedHandlers.get!(makeContext());

    expect(result.data.profile.eorTestDate).toBeNull();
  });

  it('returns null for nullable date fields that are null', async () => {
    const user = makeMockUser({
      examDate: null,
      graduationDate: null,
      rotationStartDate: null,
      rotationEndDate: null,
    });
    mockFindUnique.mockResolvedValue(user);
    const result = await capturedHandlers.get!(makeContext());

    expect(result.data.profile.examDate).toBeNull();
    expect(result.data.profile.graduationDate).toBeNull();
    expect(result.data.profile.rotationStartDate).toBeNull();
    expect(result.data.profile.rotationEndDate).toBeNull();
  });

  it('returns 500 on Prisma error', async () => {
    mockFindUnique.mockRejectedValue(new Error('connection timeout'));
    const result = await capturedHandlers.get!(makeContext());

    expect(result.status).toBe(500);
    expect(result.data.success).toBe(false);
    expect(result.data.error).toContain('Failed to fetch profile');
  });

  it('always calls safePrismaDisconnect', async () => {
    mockFindUnique.mockResolvedValue(makeMockUser());
    await capturedHandlers.get!(makeContext());

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('calls safePrismaDisconnect even on error', async () => {
    mockFindUnique.mockRejectedValue(new Error('boom'));
    await capturedHandlers.get!(makeContext());

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: PUT /api/user/profile
// ---------------------------------------------------------------------------

describe('PUT /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a placeholder user before updating when the row is missing', async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'uuid-1' });
    mockCreate.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockResolvedValue(makeMockUser({ firstName: 'X' }));
    const result = await capturedHandlers.put!(makeContext({ validated: { firstName: 'X' } }));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.data.success).toBe(true);
    expect(result.data.profile.firstName).toBe('X');
  });

  it('updates user and returns profile with ISO dates', async () => {
    const user = makeMockUser();
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockResolvedValue(user);

    const result = await capturedHandlers.put!(
      makeContext({ validated: { firstName: 'Jane' } })
    );

    expect(result.data.success).toBe(true);
    expect(result.data.profile.firstName).toBe('Jane');
    expect(result.data.message).toBe('Profile updated successfully');
    expect(typeof result.data.profile.updatedAt).toBe('string');
  });

  it('calls prisma.user.update with correct where clause and data', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockResolvedValue(makeMockUser({ firstName: 'Updated' }));

    await capturedHandlers.put!(
      makeContext({ validated: { firstName: 'Updated', school: 'Harvard' } })
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'uuid-1' },
        data: { firstName: 'Updated', school: 'Harvard' },
      })
    );
  });

  it('profile update validation rejects unsupported onboarding fields', () => {
    const result = profileUpdateSchema.safeParse({
      school: 'Duke University',
      graduationDate: '2027-05-15',
      currentRotation: 'Emergency Medicine',
      yearInProgram: 'clinical',
      eorTestDate: '2026-08-01',
      rotationStartDate: '2026-07-01',
      rotationEndDate: '2026-08-15',
      hasCompletedOnboarding: true,
      specialty: 'cardiology',
    });

    if (result.success) {
      throw new Error('Expected unsupported profile field to fail validation');
    }
    expect(result.error?.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  it('converts date strings in update data', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockResolvedValue(makeMockUser());

    await capturedHandlers.put!(
      makeContext({ validated: { examDate: '2026-12-01T00:00:00.000Z' } })
    );

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.examDate).toBeInstanceOf(Date);
    expect(updateCall.data.examDate.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('sets eorTestDate AND rotationExamDate when eorTestDate provided', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockResolvedValue(makeMockUser());

    await capturedHandlers.put!(
      makeContext({ validated: { eorTestDate: '2026-06-15T00:00:00.000Z' } })
    );

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.eorTestDate).toBeInstanceOf(Date);
    expect(updateCall.data.rotationExamDate).toBeInstanceOf(Date);
    expect(updateCall.data.eorTestDate.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(updateCall.data.rotationExamDate.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('sets null for nullable date fields when null is passed', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockResolvedValue(makeMockUser({ examDate: null }));

    await capturedHandlers.put!(
      makeContext({ validated: { examDate: null } })
    );

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.examDate).toBeNull();
  });

  it('returns 500 on Prisma error during findUnique', async () => {
    mockFindUnique.mockRejectedValue(new Error('connection refused'));
    const result = await capturedHandlers.put!(
      makeContext({ validated: { firstName: 'X' } })
    );

    expect(result.status).toBe(500);
    expect(result.data.success).toBe(false);
    expect(result.data.error).toContain('Failed to update profile');
  });

  it('returns 500 on Prisma error during update', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockRejectedValue(new Error('unique constraint violation'));

    const result = await capturedHandlers.put!(
      makeContext({ validated: { firstName: 'X' } })
    );

    expect(result.status).toBe(500);
    expect(result.data.success).toBe(false);
  });

  it('always calls safePrismaDisconnect on success', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    mockUpdate.mockResolvedValue(makeMockUser());

    await capturedHandlers.put!(makeContext({ validated: { firstName: 'X' } }));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('always calls safePrismaDisconnect on error', async () => {
    mockFindUnique.mockRejectedValue(new Error('boom'));

    await capturedHandlers.put!(makeContext({ validated: { firstName: 'X' } }));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('returns eorTestDate with rotationExamDate fallback in response', async () => {
    mockFindUnique.mockResolvedValue({ id: 'uuid-1' });
    const updatedUser = makeMockUser({
      rotationExamDate: null,
      eorTestDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    mockUpdate.mockResolvedValue(updatedUser);

    const result = await capturedHandlers.put!(
      makeContext({ validated: { firstName: 'X' } })
    );

    // Response uses (rotationExamDate ?? eorTestDate), so falls back to eorTestDate
    expect(result.data.profile.eorTestDate).toBe('2026-08-01T00:00:00.000Z');
  });
});
