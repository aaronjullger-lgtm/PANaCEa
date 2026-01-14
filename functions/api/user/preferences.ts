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
 */

import type { EventContext } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface UserPreferencesPayload {
  // Study preferences
  dailyGoal?: number;
  preferredSystems?: string[];
  sessionLength?: number;
  difficulty?: string;
  
  // Timing preferences
  wakeTime?: string;
  studyReminders?: boolean;
  reminderTime?: string;
  reminderDays?: number[];
  
  // UI preferences
  theme?: string;
  soundEnabled?: boolean;
  hapticFeedback?: boolean;
  animationsEnabled?: boolean;
  fontSize?: string;
  
  // Learning preferences
  showHints?: boolean;
  autoAdvance?: boolean;
  explanationDepth?: string;
  showPearls?: boolean;
  showRelatedConcepts?: boolean;
  
  // Review preferences
  fsrsEnabled?: boolean;
  reviewBeforeExam?: boolean;
  mixNewAndReview?: boolean;
  
  // Advanced settings
  keyboardShortcuts?: boolean;
  developerMode?: boolean;
  betaFeatures?: boolean;
  
  // Notification preferences
  emailDigest?: boolean;
  emailFrequency?: string;
  pushNotifications?: boolean;
  
  // Privacy preferences
  shareAnonymousData?: boolean;
  showOnLeaderboard?: boolean;
  
  // Custom settings
  customSettings?: any;
}

/**
 * Get user preferences
 */
export async function onRequestGet(context: EventContext<Env, any, Record<string, unknown>>) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult.success || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authResult.userId;

    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Fetch preferences
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId,
          // All other fields will use their default values from schema
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        preferences,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Create or fully update user preferences
 */
export async function onRequestPost(context: EventContext<Env, any, Record<string, unknown>>) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult.success || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authResult.userId;

    // Parse request body
    let payload: UserPreferencesPayload;
    try {
      payload = await context.request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Upsert preferences
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...payload,
      },
      update: {
        ...payload,
        updatedAt: new Date(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        preferences,
        message: 'Preferences saved successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error saving preferences:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to save preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Partially update user preferences
 */
export async function onRequestPatch(context: EventContext<Env, any, Record<string, unknown>>) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult.success || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authResult.userId;

    // Parse request body
    let payload: Partial<UserPreferencesPayload>;
    try {
      payload = await context.request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Check if preferences exist
    const existing = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!existing) {
      // Create with partial data
      const preferences = await prisma.userPreferences.create({
        data: {
          userId,
          ...payload,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          preferences,
          message: 'Preferences created successfully',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update existing preferences
    const preferences = await prisma.userPreferences.update({
      where: { userId },
      data: {
        ...payload,
        updatedAt: new Date(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        preferences,
        message: 'Preferences updated successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating preferences:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Delete user preferences (reset to defaults)
 */
export async function onRequestDelete(context: EventContext<Env, any, Record<string, unknown>>) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult.success || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authResult.userId;

    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Delete preferences
    await prisma.userPreferences.delete({
      where: { userId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Preferences deleted successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error deleting preferences:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}
