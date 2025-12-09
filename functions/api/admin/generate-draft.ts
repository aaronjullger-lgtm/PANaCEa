/**
 * API: Generate AI draft content
 * POST /api/admin/generate-draft
 * 
 * Generates AI-drafted medical content and saves it to the database with status='draft'
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { canEditContent, type UserRole } from '../_shared/rbac';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface GenerateDraftRequest {
  conditionName: string;
  system: string;
  subcategory?: string;
}

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

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { id: true, role: true }
    });

    if (!user || !canEditContent(user.role as UserRole)) {
      return createErrorResponse('Forbidden: Insufficient permissions', 403);
    }

    const body: GenerateDraftRequest = await request.json();
    const { conditionName, system, subcategory } = body;

    // Validate required fields
    if (!conditionName || !system) {
      return createErrorResponse('Missing required fields: conditionName and system are required', 400);
    }

    // Generate conditionId
    const conditionId = `${system}__${subcategory || 'general'}__${conditionName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')}`;

    // Check if conditionId already exists
    const existing = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });

    if (existing) {
      return createErrorResponse('Content with this condition already exists', 409);
    }

    // Initialize Gemini AI
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
    if (!apiKey) {
      return createErrorResponse('AI service not configured', 500);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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
      console.error('Failed to parse AI response:', parseError);
      return createErrorResponse('Failed to parse AI-generated content', 500);
    }

    // Get client IP and user agent for audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create draft in database
    const newContent = await prisma.medicalContent.create({
      data: {
        conditionId,
        system,
        subcategory: subcategory || 'general',
        condition: conditionName,
        content: aiContent,
        status: 'draft',
        version: 1,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });

    // Create initial version record
    await prisma.contentVersion.create({
      data: {
        contentId: newContent.id,
        version: 1,
        content: aiContent,
        changeType: 'create',
        changeDescription: 'AI-generated draft content',
        changedBy: user.id,
      },
    });

    // Create audit log
    await prisma.contentAuditLog.create({
      data: {
        contentId: newContent.id,
        conditionId: newContent.conditionId,
        version: 1,
        changeType: 'create',
        changeDescription: 'AI-generated draft content',
        changedFields: ['content'],
        newValues: aiContent,
        changedBy: user.id,
        changedByRole: user.role,
        ipAddress,
        userAgent,
      },
    });

    return createSuccessResponse({
      message: 'Draft content generated successfully',
      content: newContent,
    }, 201);
  } catch (error: any) {
    console.error('Error generating draft content:', error);
    return createErrorResponse(error.message || 'Failed to generate draft content', 500);
  } finally {
    await prisma.$disconnect();
  }
}
