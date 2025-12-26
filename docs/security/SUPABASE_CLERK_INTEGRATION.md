# Supabase + Clerk Integration Guide

This guide explains how PANaCEa integrates Supabase with Clerk for authentication, following the [official Supabase documentation](https://supabase.com/docs/guides/auth/sso/clerk).

## Overview

Instead of using Supabase's built-in authentication, PANaCEa uses Clerk for user authentication and passes Clerk session tokens to Supabase. This allows Row Level Security (RLS) policies in Supabase to use JWT claims from Clerk.

## Architecture

```
User → Clerk Authentication → Clerk Session Token → Supabase Client → Supabase Database
```

### Benefits

1. **Single Authentication System**: Use Clerk for all authentication needs
2. **Secure RLS Policies**: Leverage Clerk JWT claims in Supabase RLS policies
3. **Automatic Token Management**: Tokens are automatically refreshed by Clerk
4. **No Token Sharing**: No need to share JWT secrets between services

## Setup Instructions

### 1. Configure Environment Variables

Add these to your `.env` file:

```bash
# Server-side Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Client-side Supabase configuration (prefixed with VITE_)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Clerk configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

### 2. Using Supabase with Clerk in React Components

Use the `useSupabase()` hook to get a Supabase client configured with Clerk authentication:

```tsx
import { useSupabase } from './hooks/useSupabase';

function MyComponent() {
  const supabase = useSupabase();
  
  const fetchData = async () => {
    // Supabase client automatically includes Clerk token
    const { data, error } = await supabase
      .from('my_table')
      .select('*');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Data:', data);
  };
  
  return (
    <button onClick={fetchData}>Fetch Data</button>
  );
}
```

### 3. Creating RLS Policies

Supabase RLS policies can access Clerk JWT claims using the `auth.jwt()` function.

#### Available Clerk JWT Claims

- `sub`: User ID
- `email`: User email
- `org_id`: Organization ID (if using Clerk organizations)
- `org_role`: Organization role (e.g., "org:admin")
- `fva`: Factor verification age (for 2FA checks)

#### Example: User-specific data access

```sql
-- Only allow users to access their own data
CREATE POLICY "Users can only access their own data"
ON user_data
FOR ALL
TO authenticated
USING (user_id = (auth.jwt()->>'sub'));
```

#### Example: Organization admin access

```sql
-- Only organization admins can insert data
CREATE POLICY "Only org admins can insert"
ON secured_table
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt()->>'org_role') = 'org:admin'
  AND
  organization_id = (auth.jwt()->>'org_id')
);
```

#### Example: Require 2FA verification

```sql
-- Only users who completed 2FA can access sensitive data
CREATE POLICY "Require 2FA for sensitive data"
ON sensitive_table
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  (auth.jwt()->'fva'->>1) != '-1'
);
```

### 4. Server-side Usage

For server-side operations (Node.js/Express), continue using the existing `supabase` and `supabaseAdmin` clients from `lib/supabase.ts`:

```typescript
import { supabaseAdmin } from '../lib/supabase';

// Server-side operations that bypass RLS
const { data, error } = await supabaseAdmin
  .from('users')
  .select('*');
```

**Important**: Only use `supabaseAdmin` for trusted server-side operations. It bypasses all RLS policies.

## Implementation Details

### Client Creation

The Supabase client is created with a custom fetch function that injects the Clerk token:

```typescript
createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, init) => {
      const token = await getToken();
      return fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
    },
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
```

### Token Management

- Clerk handles token refresh automatically
- Tokens are fetched on each Supabase request
- No need to manually manage token lifecycle

## Testing

### Local Testing

1. Sign in with Clerk
2. Make a Supabase query
3. Check browser DevTools → Network tab
4. Verify `Authorization: Bearer <token>` header is present

### Testing RLS Policies

```sql
-- View the current JWT claims
SELECT auth.jwt();

-- Test a specific claim
SELECT auth.jwt()->>'sub' AS user_id;
SELECT auth.jwt()->>'org_role' AS org_role;
```

## Troubleshooting

### Issue: "JWT expired" errors

**Cause**: Token expiration  
**Solution**: Clerk should automatically refresh tokens. Check that `autoRefreshToken` is working.

### Issue: RLS policies not working

**Cause**: JWT claims not accessible  
**Solution**: 
1. Verify token is being sent in Authorization header
2. Check that JWT claims are present: `SELECT auth.jwt()`
3. Ensure RLS is enabled: `ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;`

### Issue: "relation does not exist" errors

**Cause**: Table name mismatch  
**Solution**: Supabase uses lowercase table names. Ensure your queries match the database schema.

## Migration from Deprecated Integration

If you were using the deprecated Clerk Integration with JWT templates:

1. **Remove**: Custom JWT template in Clerk
2. **Remove**: Shared JWT secret configuration
3. **Update**: Use the new `useSupabase()` hook
4. **Update**: RLS policies to use `auth.jwt()` instead of `auth.uid()`

## Security Best Practices

1. **Never expose service role key** to the client
2. **Use RLS policies** for all user-facing tables
3. **Validate JWT claims** in RLS policies
4. **Use restrictive policies** for sensitive operations
5. **Test policies thoroughly** before production deployment

## Additional Resources

- [Supabase + Clerk Documentation](https://supabase.com/docs/guides/auth/sso/clerk)
- [Clerk JWT Claims Reference](https://clerk.com/docs/backend-requests/handling/manual-jwt)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL JWT Functions](https://supabase.com/docs/guides/database/extensions/pgjwt)

## Support

For issues or questions:
- Check existing [GitHub Issues](https://github.com/aaronjullger-lgtm/PANaCEa/issues)
- Create a new issue with the `supabase` and `authentication` labels
