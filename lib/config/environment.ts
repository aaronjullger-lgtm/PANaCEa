/**
 * Environment Configuration and Validation
 *
 * Provides type-safe access to environment variables with runtime validation.
 * Server will fail fast with clear error messages if required config is missing.
 */

import { z, ZodError } from 'zod';

/**
 * Environment schema with required and optional variables
 */
const envSchema = z.object({
  // Required - Server will not start without these
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database connectivity'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required for authentication'),

  // Required for AI features
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required for AI question generation'),

  // Server config with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Optional - Use refine for URL validation so we never call .url() on ZodDefault (Zod schema ordering)
  FRONTEND_URL: z
    .string()
    .optional()
    .default('http://localhost:3000')
    .refine((s) => !s || s.startsWith('http'), { message: 'FRONTEND_URL must be a valid URL' }),
  ADMIN_USER_IDS: z.string().optional(),
  SUPERADMIN_USER_IDS: z.string().optional(),

  // Supabase (optional, used for storage) - refine for URL when present, not .url() after optional
  SUPABASE_URL: z
    .string()
    .optional()
    .refine((s) => !s || s.startsWith('http'), { message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Sentry (optional, for error tracking)
  SENTRY_DSN: z.string().optional(),

  // Redis (optional, for caching)
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated environment configuration
 * Throws on startup if required variables are missing
 */
let _env: Env | null = null;

export function validateEnvironment(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (result.success) {
    _env = result.data;
    console.log('✓ Environment configuration validated');
    return _env;
  }

  // Validation failed - handle errors
  // Cast to SafeParseError to access .error property (TS control flow doesn't narrow after return)
  const zodError: ZodError = (result as { success: false; error: ZodError }).error;

  console.error('\n🚨 ENVIRONMENT CONFIGURATION ERROR 🚨\n');

  for (const issue of zodError.issues) {
    const path = issue.path.join('.');
    console.error(`  ❌ ${path || 'root'}: ${issue.message}`);
  }

  console.error('\n📝 Required environment variables:');
  console.error('   - DATABASE_URL: PostgreSQL connection string');
  console.error('   - CLERK_SECRET_KEY: Clerk authentication secret');
  console.error('   - GEMINI_API_KEY: Google Gemini API key\n');

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to start in production with missing configuration.\n');
    process.exit(1);
  }

  console.warn('⚠️  Running in development mode with incomplete configuration.\n');

  // In development, create a partial env with defaults for graceful degradation
  _env = {
    DATABASE_URL: process.env.DATABASE_URL || '',
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    PORT: Number(process.env.PORT) || 3001,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    ADMIN_USER_IDS: process.env.ADMIN_USER_IDS,
    SUPERADMIN_USER_IDS: process.env.SUPERADMIN_USER_IDS,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    REDIS_URL: process.env.REDIS_URL,
  };
  return _env;
}

/**
 * Get validated environment (call after validateEnvironment)
 */
export function getEnv(): Env {
  if (!_env) {
    throw new Error('Environment not validated. Call validateEnvironment() first.');
  }
  return _env;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}
