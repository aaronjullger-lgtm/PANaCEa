/**
 * Input validation middleware
 * Provides reusable validation functions for API endpoints
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Validates that required fields exist in request body
 */
export function validateRequired(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter((field) => !req.body[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        missing: missing,
      });
    }

    return next();
  };
}

/**
 * Validates string length
 */
export function validateStringLength(field: string, min: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];

    if (typeof value !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must be a string`,
      });
    }

    if (value.length < min || value.length > max) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must be between ${min} and ${max} characters`,
      });
    }

    return next();
  };
}

/**
 * Sanitizes string input to prevent XSS
 *
 * ⚠️ WARNING: This is a BASIC sanitizer suitable for development only.
 * For production use, MUST replace with a dedicated library like:
 * - DOMPurify (https://github.com/cure53/DOMPurify)
 * - validator.js (https://github.com/validatorjs/validator.js)
 * - xss (https://github.com/leizongmin/js-xss)
 *
 * This basic implementation has known limitations and should NOT be used
 * for production security without enhancement.
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    throw new TypeError('sanitizeString expects a string input');
  }

  // BASIC sanitization - Replace with DOMPurify or similar for production
  // This implementation has known security limitations

  // For production, use:
  // import DOMPurify from 'dompurify';
  // return DOMPurify.sanitize(value);

  return value
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '') // Remove iframes
    .replace(/<object[^>]*>.*?<\/object>/gis, '') // Remove objects
    .replace(/<embed[^>]*>.*?<\/embed>/gis, '') // Remove embeds
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove inline event handlers
    .replace(/(javascript|data|vbscript):/gi, '') // Remove dangerous protocols
    .trim();
}

/**
 * Middleware to sanitize all string fields in request body
 */
export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    try {
      Object.keys(req.body).forEach((key) => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = sanitizeString(req.body[key]);
        }
      });
      return next();
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid input format',
        message: error instanceof Error ? error.message : 'Validation error',
      });
    }
  } else {
    return next();
  }
}

/**
 * Validates array length
 */
export function validateArrayLength(field: string, min: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];

    if (!Array.isArray(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must be an array`,
      });
    }

    if (value.length < min || value.length > max) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must contain between ${min} and ${max} items`,
      });
    }

    return next();
  };
}

/**
 * Validates enum values
 */
export function validateEnum(field: string, allowedValues: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];

    if (!allowedValues.includes(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must be one of: ${allowedValues.join(', ')}`,
      });
    }

    return next();
  };
}

/**
 * Validates timestamp format
 */
export function validateTimestamp(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];

    if (!value) {
      return next(); // Optional timestamp
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must be a valid ISO 8601 timestamp`,
      });
    }

    next();
  };
}
