/**
 * API Endpoint: Upload Media
 * POST /api/media/upload
 * 
 * Handles uploading medical images to Supabase Storage
 */

import type { Request, Response } from 'express';
import { uploadMedia } from '../../../services/mediaStorageService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, category, conditionId, tags, description, altText, fileData } = req.body;

    // Validate required fields
    if (!filename || !category || !fileData) {
      return res.status(400).json({ 
        error: 'Missing required fields: filename, category, and fileData are required' 
      });
    }

    // Convert base64 to Buffer
    const buffer = Buffer.from(fileData, 'base64');

    // Upload media
    const result = await uploadMedia({
      file: buffer,
      filename,
      category,
      conditionId,
      tags: tags || [],
      description,
      altText,
      uploadedBy: req.body.userId, // Add user authentication in middleware
    });

    return res.status(200).json({
      success: true,
      media: result,
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    return res.status(500).json({ 
      error: 'Failed to upload media',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
