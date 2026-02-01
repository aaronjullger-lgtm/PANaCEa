/**
 * User Profile API
 *
 * RESTful endpoint for user profile (User model fields).
 * PUT: Partial update of profile fields (firstName, lastName, examDate, etc.)
 *
 * Validation: Strict Zod schema, at least one updatable field required.
 * Error Handling: 400 bad input, 401 auth, 404 user not found, 500 server.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { profileUpdateSchema } from '../_shared/zodSchemas';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const EmptySchema = z.object({});

type ProfileUpdateValidated = z.infer<typeof profileUpdateSchema>;

function buildProfileUpdateData(validated: ProfileUpdateValidated): Record<string, unknown> {
  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (validated.firstName !== undefined) data.firstName = validated.firstName;
  if (validated.lastName !== undefined) data.lastName = validated.lastName;
  if (validated.examDate !== undefined)
    data.examDate = validated.examDate ? new Date(validated.examDate) : null;
  if (validated.graduationDate !== undefined)
    data.graduationDate = validated.graduationDate ? new Date(validated.graduationDate) : null;
  if (validated.school !== undefined) data.school = validated.school;
  if (validated.currentRotation !== undefined) data.currentRotation = validated.currentRotation;
  if (validated.yearInProgram !== undefined) data.yearInProgram = validated.yearInProgram;
  if (validated.hasCompletedBaseline !== undefined)
    data.hasCompletedBaseline = validated.hasCompletedBaseline;
  if (validated.hasCompletedOnboarding !== undefined)
    data.hasCompletedOnboarding = validated.hasCompletedOnboarding;
  return data;
}

export const onRequestOptions = withCors();

/**
 * GET /api/user/profile
 * Fetch the authenticated user's profile.
 */
export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context) => {
    const { env, auth } = context;
    const logger = createEndpointLogger('/api/user/profile');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      logger.addContext({ userId: auth.userId });

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: {
          id: true,
          clerkId: true,
          email: true,
          firstName: true,
          lastName: true,
          examDate: true,
          graduationDate: true,
          school: true,
          currentRotation: true,
          yearInProgram: true,
          hasCompletedBaseline: true,
          hasCompletedOnboarding: true,
          updatedAt: true,
        },
      });

      if (!user) {
        logger.warn('User not found', { clerkId: auth.userId });
        return {
          data: { success: false, error: 'User not found. Please log in again.' },
          status: 404,
        };
      }

      return {
        data: {
          success: true,
          profile: {
            ...user,
            examDate: user.examDate?.toISOString() ?? null,
            graduationDate: user.graduationDate?.toISOString() ?? null,
            updatedAt: user.updatedAt.toISOString(),
          },
        },
      };
    } catch (error) {
      logger.error('Error fetching profile', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch profile');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

/**
 * PUT /api/user/profile
 * Partial update of authenticated user's profile.
 */
export const onRequestPut = authenticatedEndpoint(profileUpdateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/profile');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    // Resolve user by clerkId (auth.userId is Clerk sub)
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      logger.warn('User not found', { clerkId: auth.userId });
      return {
        data: { success: false, error: 'User not found. Please log in again.' },
        status: 404,
      };
    }

    // Build update payload (exclude undefined, handle dates)
    const updateData = buildProfileUpdateData(validated);

    const updatedUser = await prisma.user.update({
      where: { clerkId: auth.userId },
      data: updateData,
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        examDate: true,
        graduationDate: true,
        school: true,
        currentRotation: true,
        yearInProgram: true,
        hasCompletedBaseline: true,
        hasCompletedOnboarding: true,
        updatedAt: true,
      },
    });

    logger.info('Profile updated', { userId: user.id, fields: Object.keys(updateData) });

    return {
      data: {
        success: true,
        profile: {
          ...updatedUser,
          examDate: updatedUser.examDate?.toISOString() ?? null,
          graduationDate: updatedUser.graduationDate?.toISOString() ?? null,
          updatedAt: updatedUser.updatedAt.toISOString(),
        },
        message: 'Profile updated successfully',
      },
    };
  } catch (error) {
    logger.error('Error updating profile', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to update profile');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
