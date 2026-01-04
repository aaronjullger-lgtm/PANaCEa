/**
 * API Endpoint: Upload Educational Resource
 * POST /api/resources/upload
 * 
 * Handles uploading educational resources (textbooks, lectures, PDFs)
 */

import type { Request, Response } from 'express';
import { uploadEducationalResource } from '../../../services/educationalResourceService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      title, 
      resourceType, 
      originalFilename, 
      fileData, 
      author, 
      source, 
      pageNumber,
      uploadedBy 
    } = req.body;

    // Validate required fields
    if (!title || !resourceType || !originalFilename || !fileData) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, resourceType, originalFilename, and fileData are required' 
      });
    }

    // Convert base64 to Buffer
    const buffer = Buffer.from(fileData, 'base64');

    // Upload and process resource
    const result = await uploadEducationalResource({
      file: buffer,
      title,
      resourceType,
      originalFilename,
      author,
      source,
      pageNumber,
      uploadedBy: uploadedBy || req.body.userId,
    });

    return res.status(200).json({
      success: true,
      resource: result,
      message: result.autoApproved 
        ? 'Resource uploaded and auto-approved'
        : 'Resource uploaded, pending review',
    });

  } catch (error) {
    console.error('Error uploading resource:', error);
    return res.status(500).json({ 
      error: 'Failed to upload resource',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
