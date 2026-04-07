/**
 * API: Generate AI draft content
 * POST /api/admin/generate-draft
 *
 * Generates AI-drafted medical content and saves it to the database with status='draft'
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GenerateDraftSchema = z.object({
  body: z.object({
    conditionName: z.string().min(1),
    system: z.string().min(1),
    subcategory: z.string().optional(),
  }),
});

/**
 * Utility function to clean AI-generated JSON responses
 * Removes markdown code blocks and extra whitespace
 */
function cleanAIJsonResponse(text: string): string {
  return text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
}

export const onRequestOptions = withCors();

export const onRequestPost = adminAuthenticatedEndpoint(GenerateDraftSchema, async (context) => {
  const { env, auth, validated, request } = context;
  const logger = createEndpointLogger('/api/admin/generate-draft');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // withAdminRole() already verified admin access. Use cached DB user ID when available
    // (set by the DB-path in withAdminRole); fall back to a minimal query for env-allowlist users.
    let userId = (auth.metadata as any)?.dbUserId as string | undefined;
    let userRole = (auth.metadata as any)?.dbRole as string | undefined;
    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true, role: true },
      });
      userId = dbUser?.id ?? auth.userId;
      userRole = String(dbUser?.role ?? 'admin').toLowerCase();
    }

    const { conditionName, system, subcategory } = validated.body;

    // Generate conditionId
    const conditionId = `${system}__${subcategory || 'general'}__${conditionName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')}`;

    // Check if conditionId already exists
    const existing = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });

    if (existing) {
      logger.info('Content already exists', { conditionId, userId });

      return {
        data: { error: 'Content with this condition already exists' },
        status: 409,
      };
    }

    // Initialize Gemini AI
    const apiKey = env.GEMINI_API_KEY || (env as any).GOOGLE_API_KEY;
    if (!apiKey) {
      logger.error('AI service not configured', { userId });
      throw new Error('AI service not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Phase 1.3 optimization: stable release for reliability (was gemini-2.0-flash-exp)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Generate AI content
    const prompt = `You are a medical education expert. Generate comprehensive medical content for "${conditionName}" in the ${system} system.

Return a JSON object with the following structure:
{
  "overview": "Brief 2-3 sentence overview of the condition",
  "symptoms": ["symptom 1", "symptom 2", "symptom 3"],
  "diagnosis": {
    "physical_exam": "Key physical exam findings",
    "labs": "Important laboratory findings",
    "imaging": "Relevant imaging studies"
  },
  "treatment": {
    "first_line": "First-line treatment",
    "alternatives": ["alternative 1", "alternative 2"]
  },
  "complications": ["complication 1", "complication 2"],
  "pearls": ["clinical pearl 1", "clinical pearl 2", "clinical pearl 3"]
}

Ensure all information is accurate, concise, and suitable for PA students preparing for the PANCE exam.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse AI response
    const cleanedText = cleanAIJsonResponse(text);

    let aiContent;
    try {
      aiContent = JSON.parse(cleanedText);
    } catch (parseError) {
      logger.error('Failed to parse AI response', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        userId,
      });
      throw new Error('Failed to parse AI-generated content');
    }

    // Get client IP and user agent for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create draft in database
    const newContent = await prisma.medicalContent.create({
      data: {
        id: crypto.randomUUID(),
        conditionId,
        system,
        subcategory: subcategory || 'general',
        condition: conditionName,
        content: aiContent,
        status: 'draft',
        version: 1,
        createdBy: userId,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });

    // Create initial version record
    await prisma.contentVersion.create({
      data: {
        id: crypto.randomUUID(),
        contentId: newContent.id,
        version: 1,
        content: aiContent,
        changeType: 'create',
        changeDescription: 'AI-generated draft content',
        changedBy: userId,
      },
    });

    // Create audit log
    await prisma.contentAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        contentId: newContent.id,
        conditionId: newContent.conditionId,
        version: 1,
        changeType: 'create',
        changeDescription: 'AI-generated draft content',
        changedFields: ['content'],
        newValues: aiContent,
        changedBy: userId,
        changedByRole: userRole ?? 'admin',
        ipAddress,
        userAgent,
      },
    });

    logger.info('Draft content generated successfully', {
      userId,
      conditionId,
      contentId: newContent.id,
    });

    auditLog('admin_generate_draft', {
      userId: auth.userId,
      conditionId,
      contentId: newContent.id,
      system,
    });

    return {
      data: {
        message: 'Draft content generated successfully',
        content: newContent,
      },
      status: 201,
    };
  } catch (error) {
    logger.error('Error generating draft content', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate draft content');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
