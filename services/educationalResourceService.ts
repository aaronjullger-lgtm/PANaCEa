/**
 * Educational Resource Service
 * 
 * Processes and manages educational resources (textbooks, lectures, PDFs)
 * Extracts content, links to conditions, and enables search
 */

import { prisma } from '../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin, getStorageUrl } from '../lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const RESOURCE_BUCKET = 'educational-resources';

export interface ResourceUploadOptions {
  file: Buffer;
  title: string;
  resourceType: 'textbook' | 'lecture' | 'pdf' | 'video' | 'slides';
  originalFilename: string;
  author?: string;
  source?: string;
  pageNumber?: number;
  uploadedBy?: string;
}

export interface ResourceProcessingResult {
  id: string;
  extractedText?: string;
  summary?: string;
  keyTopics: string[];
  conditionIds: string[];
  systemCodes: string[];
  autoApproved: boolean;
}

/**
 * Upload and process an educational resource
 */
export async function uploadEducationalResource(
  options: ResourceUploadOptions
): Promise<ResourceProcessingResult> {
  const { file, title, resourceType, originalFilename, author, source, pageNumber, uploadedBy } = options;

  // Sanitize filename
  const sanitizedFilename = originalFilename
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '');

  // Upload to Supabase Storage
  const storagePath = `${resourceType}/${sanitizedFilename}`;
  const { data, error } = await supabaseAdmin.storage
    .from(RESOURCE_BUCKET)
    .upload(storagePath, file, {
      contentType: getMimeType(originalFilename),
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const fileUrl = getStorageUrl(RESOURCE_BUCKET, storagePath);

  // Create database record with pending status
  const resource = await prisma.educationalResource.create({
    data: {
      title,
      resourceType,
      fileUrl,
      originalFilename: sanitizedFilename,
      author,
      source,
      pageNumber,
      uploadedBy,
      mimeType: getMimeType(originalFilename),
      fileSize: file.length,
      approvalStatus: 'pending',
    },
  });

  // Process content asynchronously
  const processingResult = await processResourceContent(resource.id, file, resourceType);

  return {
    id: resource.id,
    ...processingResult,
  };
}

/**
 * Process resource content to extract text, topics, and link to conditions
 */
async function processResourceContent(
  resourceId: string,
  fileBuffer: Buffer,
  resourceType: string
): Promise<Omit<ResourceProcessingResult, 'id'>> {
  let extractedText: string | undefined;
  let summary: string | undefined;
  let keyTopics: string[] = [];
  let conditionIds: string[] = [];
  let systemCodes: string[] = [];

  try {
    // Extract text based on resource type
    if (resourceType === 'pdf') {
      extractedText = await extractTextFromPDF(fileBuffer);
    } else if (resourceType === 'slides') {
      extractedText = await extractTextFromPPTX(fileBuffer);
    }

    // Use AI to analyze content
    if (extractedText) {
      const analysis = await analyzeEducationalContent(extractedText);
      
      summary = analysis.summary;
      keyTopics = analysis.keyTopics;
      systemCodes = analysis.systemCodes;

      // Link to conditions in database
      conditionIds = await linkToConditions(analysis.keyTopics);

      // Update resource with extracted data
      await prisma.educationalResource.update({
        where: { id: resourceId },
        data: {
          extractedText: extractedText.substring(0, 50000), // Limit size
          summary,
          keyTopics,
          conditionIds,
          systemCodes,
          qualityScore: analysis.qualityScore,
          approvalStatus: analysis.qualityScore >= 70 ? 'approved' : 'pending',
          approvedAt: analysis.qualityScore >= 70 ? new Date() : null,
          approvedBy: analysis.qualityScore >= 70 ? 'system' : null,
        },
      });
    }

  } catch (error) {
    console.error('Error processing resource content:', error);
    // Don't fail the upload, just mark for manual review
  }

  return {
    extractedText,
    summary,
    keyTopics,
    conditionIds,
    systemCodes,
    autoApproved: keyTopics.length > 0 && (summary?.length || 0) > 100,
  };
}

/**
 * Extract text from PDF using AI vision
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // For MVP, we'll use AI to read the PDF
  // In production, consider using pdf-parse or pdf.js
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const base64Pdf = pdfBuffer.toString('base64');
  const pdfPart = {
    inlineData: {
      data: base64Pdf,
      mimeType: 'application/pdf',
    },
  };

  const prompt = 'Extract all text from this PDF document. Return only the extracted text.';
  
  const result = await model.generateContent([prompt, pdfPart]);
  const response = await result.response;
  return response.text();
}

/**
 * Extract text from PowerPoint/slides
 */
async function extractTextFromPPTX(pptxBuffer: Buffer): Promise<string> {
  // Similar approach for PPTX files
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const base64Pptx = pptxBuffer.toString('base64');
  const pptxPart = {
    inlineData: {
      data: base64Pptx,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    },
  };

  const prompt = 'Extract all text from this PowerPoint presentation. Return only the extracted text.';
  
  const result = await model.generateContent([prompt, pptxPart]);
  const response = await result.response;
  return response.text();
}

/**
 * Analyze educational content using AI
 */
async function analyzeEducationalContent(text: string): Promise<{
  summary: string;
  keyTopics: string[];
  systemCodes: string[];
  qualityScore: number;
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a medical education expert. Analyze this educational content and provide:

1. A brief summary (2-3 sentences)
2. Key medical topics/conditions mentioned (as array)
3. Organ systems covered (use codes: CV, PULM, GI, NEURO, RENAL, ENDO, HEME, MSK, DERM, PSYCH, OTHER)
4. Quality score (0-100) based on educational value, accuracy, and completeness

Content:
${text.substring(0, 10000)}

Respond in JSON format:
{
  "summary": "...",
  "keyTopics": ["condition1", "condition2", ...],
  "systemCodes": ["CV", "PULM", ...],
  "qualityScore": 85
}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const responseText = response.text();

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response did not contain valid JSON');
  }

  const analysis = JSON.parse(jsonMatch[0]);
  
  return {
    summary: analysis.summary || '',
    keyTopics: analysis.keyTopics || [],
    systemCodes: analysis.systemCodes || [],
    qualityScore: analysis.qualityScore || 50,
  };
}

/**
 * Link extracted topics to conditions in the database
 */
async function linkToConditions(topics: string[]): Promise<string[]> {
  const conditionIds: string[] = [];

  for (const topic of topics) {
    // Try to find matching condition (case-insensitive)
    const condition = await prisma.condition.findFirst({
      where: {
        name: {
          contains: topic,
          mode: 'insensitive',
        },
      },
    });

    if (condition) {
      conditionIds.push(condition.id);
    }
  }

  return conditionIds;
}

/**
 * Get educational resources for a condition
 */
export async function getResourcesForCondition(
  conditionId: string,
  limit: number = 10
) {
  return prisma.educationalResource.findMany({
    where: {
      conditionIds: {
        has: conditionId,
      },
      approvalStatus: 'approved',
    },
    orderBy: {
      qualityScore: 'desc',
    },
    take: limit,
  });
}

/**
 * Search educational resources
 */
export async function searchResources(
  query: string,
  filters?: {
    resourceType?: string;
    systemCode?: string;
  }
) {
  const where: any = {
    approvalStatus: 'approved',
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { summary: { contains: query, mode: 'insensitive' } },
      { keyTopics: { hasSome: [query] } },
    ],
  };

  if (filters?.resourceType) {
    where.resourceType = filters.resourceType;
  }

  if (filters?.systemCode) {
    where.systemCodes = { has: filters.systemCode };
  }

  return prisma.educationalResource.findMany({
    where,
    orderBy: {
      qualityScore: 'desc',
    },
    take: 20,
  });
}

/**
 * Track resource access (for analytics)
 */
export async function trackResourceAccess(resourceId: string) {
  await prisma.educationalResource.update({
    where: { id: resourceId },
    data: {
      viewCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
  });
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}
