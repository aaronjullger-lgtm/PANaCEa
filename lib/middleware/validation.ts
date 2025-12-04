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
    const missing = fields.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        missing: missing
      });
    }
    
    next();
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
        message: `${field} must be a string`
      });
    }
    
    if (value.length < min || value.length > max) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must be between ${min} and ${max} characters`
      });
    }
    
    next();
  };
}

/**
 * Sanitizes string input to prevent XSS
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return '';
  
  // Remove potentially dangerous characters and tags
  return value
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim();
}

/**
 * Middleware to sanitize all string fields in request body
 */
export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }
  next();
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
        message: `${field} must be an array`
      });
    }
    
    if (value.length < min || value.length > max) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${field} must contain between ${min} and ${max} items`
      });
    }
    
    next();
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
        message: `${field} must be one of: ${allowedValues.join(', ')}`
      });
    }
    
    next();
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
        message: `${field} must be a valid ISO 8601 timestamp`
      });
    }
    
    next();
  };
}
