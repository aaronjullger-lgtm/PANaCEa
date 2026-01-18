/**
 * User Preferences API
 *
 * Syncs user preferences to database (previously localStorage only).
 * Enables:
 * - Cross-device preference sync
 * - Personalized experience
 * - Study habit analysis
 * - Better recommendation algorithms
 *
 * GET /api/user/preferences - Fetch preferences
 * POST /api/user/preferences - Create/update preferences
 * PATCH /api/user/preferences - Partial update
 * DELETE /api/user/preferences - Reset to defaults
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Validation schemas
const UserPreferencesSchema = z.object({
  body: z.object({
    // Study preferences
    dailyGoal: z.number().int().min(1).max(1000).optional(),
    preferredSystems: z.array(z.string()).optional(),
    sessionLength: z.number().int().min(5).max(180).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard', 'adaptive']).optional(),

    // Timing preferences
    wakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM format
    studyReminders: z.boolean().optional(),
    reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    reminderDays: z.array(z.number().int().min(0).max(6)).optional(),

    // UI preferences
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    soundEnabled: z.boolean().optional(),
    hapticFeedback: z.boolean().optional(),
    animationsEnabled: z.boolean().optional(),
    fontSize: z.enum(['small', 'medium', 'large']).optional(),

    // Learning preferences
    showHints: z.boolean().optional(),
    autoAdvance: z.boolean().optional(),
    explanationDepth: z.enum(['brief', 'detailed', 'comprehensive']).optional(),
    showPearls: z.boolean().optional(),
    showRelatedConcepts: z.boolean().optional(),

    // Review preferences
    fsrsEnabled: z.boolean().optional(),
    reviewBeforeExam: z.boolean().optional(),
    mixNewAndReview: z.boolean().optional(),

    // Advanced settings
    keyboardShortcuts: z.boolean().optional(),
    developerMode: z.boolean().optional(),
    betaFeatures: z.boolean().optional(),

    // Notification preferences
    emailDigest: z.boolean().optional(),
    emailFrequency: z.enum(['daily', 'weekly', 'monthly', 'never']).optional(),
    pushNotifications: z.boolean().optional(),

    // Privacy preferences
    shareAnonymousData: z.boolean().optional(),
    showOnLeaderboard: z.boolean().optional(),

    // Custom settings (flexible JSON)
    customSettings: z.record(z.string(), z.unknown()).optional(),
  }),
});

const PartialPreferencesSchema = z.object({
  body: z.object({
    // All fields optional for partial update
    dailyGoal: z.number().int().min(1).max(1000).optional(),
    preferredSystems: z.array(z.string()).optional(),
    sessionLength: z.number().int().min(5).max(180).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard', 'adaptive']).optional(),
    wakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    studyReminders: z.boolean().optional(),
    reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    reminderDays: z.array(z.number().int().min(0).max(6)).optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    soundEnabled: z.boolean().optional(),
    hapticFeedback: z.boolean().optional(),
    animationsEnabled: z.boolean().optional(),
    fontSize: z.enum(['small', 'medium', 'large']).optional(),
    showHints: z.boolean().optional(),
    autoAdvance: z.boolean().optional(),
    explanationDepth: z.enum(['brief', 'detailed', 'comprehensive']).optional(),
    showPearls: z.boolean().optional(),
    showRelatedConcepts: z.boolean().optional(),
    fsrsEnabled: z.boolean().optional(),
    reviewBeforeExam: z.boolean().optional(),
    mixNewAndReview: z.boolean().optional(),
    keyboardShortcuts: z.boolean().optional(),
    developerMode: z.boolean().optional(),
    betaFeatures: z.boolean().optional(),
    emailDigest: z.boolean().optional(),
    emailFrequency: z.enum(['daily', 'weekly', 'monthly', 'never']).optional(),
    pushNotifications: z.boolean().optional(),
    shareAnonymousData: z.boolean().optional(),
    showOnLeaderboard: z.boolean().optional(),
    customSettings: z.record(z.string(), z.unknown()).optional(),
  }),
});

// Empty schema for GET and DELETE
const EmptySchema = z.object({});

export const onRequestOptions = withCors();

/**
 * GET - Fetch user preferences
 */
export const onRequestGet = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/preferences');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    // Fetch preferences
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: auth.userId },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: auth.userId,
          // All other fields will use their default values from schema
        },
      });
      logger.info('Created default preferences for new user');
    }

    return {
      data: {
        success: true,
        preferences,
      },
    };
  } catch (error) {
    logger.error('Error fetching preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch preferences');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * POST - Create or fully update user preferences
 */
export const onRequestPost = authenticatedEndpoint(UserPreferencesSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/preferences');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    const payload = validated.body;

    // Upsert preferences
    const preferences = await prisma.userPreferences.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        ...payload,
      },
      update: {
        ...payload,
        updatedAt: new Date(),
      },
    });

    logger.info('Preferences saved successfully', {
      fieldsUpdated: Object.keys(payload).length,
    });

    return {
      data: {
        success: true,
        preferences,
        message: 'Preferences saved successfully',
      },
    };
  } catch (error) {
    logger.error('Error saving preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to save preferences');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * PATCH - Partially update user preferences
 */
export const onRequestPatch = authenticatedEndpoint(PartialPreferencesSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/preferences');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    const payload = validated.body;

    // Check if preferences exist
    const existing = await prisma.userPreferences.findUnique({
      where: { userId: auth.userId },
    });

    if (!existing) {
      // Create with partial data
      const preferences = await prisma.userPreferences.create({
        data: {
          userId: auth.userId,
          ...payload,
        },
      });

      logger.info('Preferences created (partial)', {
        fieldsSet: Object.keys(payload).length,
      });

      return {
        data: {
          success: true,
          preferences,
          message: 'Preferences created successfully',
        },
        status: 201,
      };
    }

    // Update existing preferences
    const preferences = await prisma.userPreferences.update({
      where: { userId: auth.userId },
      data: {
        ...payload,
        updatedAt: new Date(),
      },
    });

    logger.info('Preferences updated (partial)', {
      fieldsUpdated: Object.keys(payload).length,
    });

    return {
      data: {
        success: true,
        preferences,
        message: 'Preferences updated successfully',
      },
    };
  } catch (error) {
    logger.error('Error updating preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to update preferences');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * DELETE - Reset user preferences to defaults
 */
export const onRequestDelete = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/preferences');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    // Delete preferences
    await prisma.userPreferences.delete({
      where: { userId: auth.userId },
    });

    logger.info('Preferences deleted successfully');

    return {
      data: {
        success: true,
        message: 'Preferences deleted successfully',
      },
    };
  } catch (error) {
    logger.error('Error deleting preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to delete preferences');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
