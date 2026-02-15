/**
 * Environment Variable Validation for Cloudflare Functions
 *
 * Provides early fail-fast validation with descriptive error messages.
 * Call at the top of request handlers to catch missing config immediately
 * rather than failing deep in a Prisma call or API request.
 *
 * @example
 * export const onRequestGet: PagesFunction<Env> = async (context) => {
 *   validateFunctionEnv(context.env, ['DATABASE_URL', 'GEMINI_API_KEY']);
 *   // ... rest of handler
 * };
 */

/**
 * Required environment variables for different function types
 */
/**
 * DATABASE_URL for production (Cloudflare Edge):
 * - Use Supabase Transaction Pooler (port 6543) or Prisma Accelerate (prisma://...)
 * - Direct PostgreSQL (port 5432) is dev-only; not Edge-compatible
 */
export const ENV_REQUIREMENTS = {
  /** Functions that need database access */
  DATABASE: ['DATABASE_URL'] as const,

  /** Functions that call Gemini AI */
  GEMINI: ['GEMINI_API_KEY'] as const,

  /** Functions that need authentication */
  AUTH: ['CLERK_SECRET_KEY'] as const,

  /** Functions that need Supabase storage */
  STORAGE: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const,

  /** Full stack - database + AI + auth */
  FULL_STACK: ['DATABASE_URL', 'GEMINI_API_KEY', 'CLERK_SECRET_KEY'] as const,
} as const;

export type EnvRequirement = keyof typeof ENV_REQUIREMENTS;

/**
 * Custom error for missing environment variables
 */
export class MissingEnvError extends Error {
  public readonly missingVars: string[];
  public readonly statusCode = 500;
  private readonly env?: Record<string, unknown>;

  constructor(missingVars: string[], env?: Record<string, unknown>) {
    const message = formatMissingEnvMessage(missingVars);
    super(message);
    this.name = 'MissingEnvError';
    this.missingVars = missingVars;
    this.env = env;
  }

  /**
   * Convert to JSON response for API errors.
   * Uses context.env when available (edge runtime); falls back to process.env for dev detection.
   */
  toResponse(): Response {
    const isDev =
      (this.env?.ENVIRONMENT as string) === 'development' ||
      (this.env?.NODE_ENV as string) === 'development' ||
      (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development');
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_ENVIRONMENT_CONFIG',
          message: 'Server configuration error. Required environment variables are missing.',
          details: isDev ? { missing: this.missingVars } : undefined,
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Format a helpful error message for missing environment variables
 */
function formatMissingEnvMessage(missingVars: string[]): string {
  const envDocs: Record<string, string> = {
    DATABASE_URL:
      'PostgreSQL: use Prisma Accelerate (prisma://...) or Supabase Transaction Pooler (port 6543); direct session port is not Edge-compatible.',
    GEMINI_API_KEY: 'Google Gemini API key for AI question generation',
    CLERK_SECRET_KEY: 'Clerk secret key for authentication',
    CLERK_WEBHOOK_SECRET: 'Clerk webhook signing secret',
    SUPABASE_URL: 'Supabase project URL',
    SUPABASE_ANON_KEY: 'Supabase anonymous key',
    SUPABASE_SERVICE_ROLE_KEY:
      'Supabase service role key (storage/admin); required for study/chat when resource uses storagePath or adobeDataPath',
    TURNSTILE_SECRET_KEY: 'Cloudflare Turnstile secret for bot protection',
  };

  const details = missingVars
    .map((v) => `  • ${v}: ${envDocs[v] || 'Required configuration value'}`)
    .join('\n');

  return `Missing required environment variables:\n${details}\n\nSet these in Cloudflare Pages Dashboard > Settings > Environment Variables`;
}

/**
 * Validate that required environment variables are present
 *
 * @param env - Cloudflare Pages Function environment object
 * @param required - Array of required variable names or preset key
 * @throws MissingEnvError if any required variables are missing
 *
 * @example Using preset requirements
 * validateFunctionEnv(context.env, 'DATABASE');
 * validateFunctionEnv(context.env, 'FULL_STACK');
 *
 * @example Using custom requirements
 * validateFunctionEnv(context.env, ['DATABASE_URL', 'CUSTOM_VAR']);
 */
export function validateFunctionEnv(
  env: Record<string, unknown>,
  required: EnvRequirement | readonly string[] | string[]
): void {
  const requiredVars: readonly string[] =
    typeof required === 'string' ? ENV_REQUIREMENTS[required] : required;

  const missing = requiredVars.filter((key) => {
    const value = env[key];
    // Check for undefined, null, or empty string
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    console.error(`[Env Validation] Missing required environment variables: ${missing.join(', ')}`);
    throw new MissingEnvError(missing, env);
  }
}

/**
 * Type-safe environment getter with validation
 *
 * @param env - Cloudflare Pages Function environment object
 * @param key - Environment variable key
 * @param required - If true, throws if missing; if false, returns undefined
 * @returns The environment variable value
 *
 * @example
 * const apiKey = getEnvVar(context.env, 'GEMINI_API_KEY', true); // throws if missing
 * const optional = getEnvVar(context.env, 'OPTIONAL_VAR', false); // undefined if missing
 */
export function getEnvVar<T extends boolean>(
  env: Record<string, unknown>,
  key: string,
  required: T
): T extends true ? string : string | undefined {
  const value = env[key];

  if (typeof value === 'string' && value.length > 0) {
    return value as T extends true ? string : string | undefined;
  }

  if (required) {
    throw new MissingEnvError([key], env);
  }

  return undefined as T extends true ? string : string | undefined;
}

/**
 * Higher-order function to wrap a handler with env validation
 *
 * @param required - Required environment variables
 * @param handler - The actual request handler
 * @returns Wrapped handler that validates env before executing
 *
 * @example
 * export const onRequestGet = withEnvValidation('DATABASE', async (context) => {
 *   // Safe to use context.env.DATABASE_URL here
 *   const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
 *   // ...
 * });
 */
export function withEnvValidation<E extends Record<string, unknown>>(
  required: EnvRequirement | readonly string[] | string[],
  handler: (context: {
    env: E;
    request: Request;
    params: Record<string, string>;
  }) => Promise<Response>
) {
  return async (context: {
    env: E;
    request: Request;
    params: Record<string, string>;
  }): Promise<Response> => {
    try {
      validateFunctionEnv(context.env as Record<string, unknown>, required);
      return await handler(context);
    } catch (error) {
      if (error instanceof MissingEnvError) {
        return error.toResponse();
      }
      throw error;
    }
  };
}
