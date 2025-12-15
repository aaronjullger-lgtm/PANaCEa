/**
 * ESM wrapper for Prisma Client Edge
 * 
 * This file provides ESM exports for Prisma Client to work with Cloudflare Workers.
 * It re-exports everything from the CommonJS Prisma Client as ESM.
 */

// Import everything from the generated Prisma client
import prismaClientEdge from '.prisma/client/edge.js';

// Re-export as named exports
export const {
  Prisma,
  PrismaClient
} = prismaClientEdge;

// Re-export types
export type {
  PrismaClient as PrismaClientType
} from '.prisma/client/edge.js';
