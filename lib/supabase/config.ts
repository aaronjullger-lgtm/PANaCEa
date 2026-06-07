export interface SupabaseConfigValues {
  url: string;
  anonKey: string;
}

export type SupabaseConfigValidationCode =
  | 'VALID'
  | 'MISSING_URL'
  | 'MISSING_ANON_KEY'
  | 'INVALID_URL';

export interface SupabaseConfigValidationResult {
  valid: boolean;
  code: SupabaseConfigValidationCode;
  message: string;
}

export function validateSupabaseConfigValues({
  url,
  anonKey,
}: SupabaseConfigValues): SupabaseConfigValidationResult {
  if (!url) {
    return {
      valid: false,
      code: 'MISSING_URL',
      message: 'Supabase URL is not configured',
    };
  }

  if (!anonKey) {
    return {
      valid: false,
      code: 'MISSING_ANON_KEY',
      message: 'Supabase anon key is not configured',
    };
  }

  if (!url.startsWith('https://')) {
    return {
      valid: false,
      code: 'INVALID_URL',
      message: 'Supabase URL must start with https://',
    };
  }

  return { valid: true, code: 'VALID', message: 'Supabase configuration is valid' };
}
