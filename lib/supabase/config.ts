export interface SupabaseConfigValues {
  url: string;
  anonKey: string;
}

export function validateSupabaseConfigValues({
  url,
  anonKey,
}: SupabaseConfigValues): { valid: boolean; message: string } {
  if (!url) {
    return { valid: false, message: 'VITE_SUPABASE_URL is not configured' };
  }

  if (!anonKey) {
    return { valid: false, message: 'VITE_SUPABASE_ANON_KEY is not configured' };
  }

  if (!url.startsWith('https://')) {
    return { valid: false, message: 'VITE_SUPABASE_URL must start with https://' };
  }

  return { valid: true, message: 'Supabase configuration is valid' };
}
