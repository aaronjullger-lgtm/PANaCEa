/**
 * Token generation and validation utilities for PANaCEa
 * Handles password reset and email verification tokens
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Generates a secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded token string
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hashes a token for secure storage in database
 * @param token - Plain text token
 * @returns Hashed token
 */
export async function hashToken(token: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(token, saltRounds);
}

/**
 * Verifies a token against its hash
 * @param token - Plain text token
 * @param hash - Hashed token from database
 * @returns True if token matches
 */
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

/**
 * Hashes a password for secure storage
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Higher for passwords
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifies a password against its hash
 * @param password - Plain text password
 * @param hash - Hashed password from database
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates token expiry time
 * @param hours - Number of hours until expiry (default: 1)
 * @returns Date object for expiry
 */
export function generateTokenExpiry(hours: number = 1): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

/**
 * Checks if a token has expired
 * @param expiry - Token expiry date
 * @returns True if token has expired
 */
export function isTokenExpired(expiry: Date | null): boolean {
  if (!expiry) return true;
  return new Date() > expiry;
}
