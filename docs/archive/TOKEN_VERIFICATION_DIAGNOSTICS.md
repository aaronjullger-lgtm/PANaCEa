# Token Verification Diagnostics Implementation

## Overview

This document describes the comprehensive diagnostic logging system implemented for the Clerk authentication token verification process in `functions/api/_shared/auth.ts`.

## Problem Statement

The authentication system was experiencing token verification failures without providing sufficient diagnostic information to identify the root cause. The implementation addresses this by adding detailed logging at each phase of the authentication process.

## Implementation

### Phase 1: Environment and Configuration Verification

#### 1.1: Secret Key Existence Check
- **Location**: `authenticateRequest()` function, line 192
- **Action**: Verifies that `CLERK_SECRET_KEY` is present in the environment
- **Log Output**: 
  ```
  [AUTH] CLERK_SECRET_KEY is not configured in environment
  ```

#### 1.2: Secret Key Format Validation
- **Location**: `authenticateRequest()` function, lines 198-203
- **Action**: Validates that the secret key starts with `sk_test_` or `sk_live_`
- **Detects**: Common misconfiguration where public key (`pk_*`) is used instead of secret key
- **Log Output**: 
  ```
  [AUTH] CLERK_SECRET_KEY has invalid format. Expected to start with "sk_test_" or "sk_live_", got: pk_t***
  [AUTH] Note: Public keys (pk_*) cannot be used as secret keys
  ```

#### 1.3: Masked Secret Key Logging
- **Location**: `authenticateRequest()` function, lines 208-209
- **Action**: Logs first and last 5 characters of the secret key for verification
- **Security**: Full key is never logged, only masked version
- **Log Output**: 
  ```
  [AUTH] Secret key verified (masked): sk_te...vwxyz
  [AUTH] Secret key environment: test
  ```

### Phase 2: Server-Side Log Analysis

#### 2.1: Detailed Error Logging
- **Location**: `verifyAuthToken()` function, lines 109-113
- **Action**: Captures and logs essential error details when token verification fails
- **Log Output**: 
  ```
  [AUTH] Token verification failed with detailed error: {
    message: "Token expired",
    name: "Error"
  }
  ```

#### 2.2: Root Cause Identification
- **Location**: `verifyAuthToken()` function, lines 116-129
- **Action**: Analyzes error message to identify specific failure patterns
- **Identifies**:
  - Token Expiration
  - Signature Verification Failed (mismatched secret key)
  - Invalid Issuer
  - Invalid Audience
  - Unknown errors
- **Log Output**: 
  ```
  [AUTH] Root Cause: Token Expiration
  ```

#### 2.3: JWT Token Claims Inspection
- **Location**: `verifyAuthToken()` function, lines 78-95
- **Action**: Decodes JWT payload and logs key claims for diagnostic purposes
- **Security**: Only enabled in test environments (`sk_test_*`)
- **Uses**: Proper base64url decoding (not standard base64)
- **Log Output**: 
  ```
  [AUTH] Token payload claims: {
    exp: "2024-12-08T20:30:00.000Z",
    iss: "https://clerk.example.com",
    iat: "2024-12-08T19:30:00.000Z"
  }
  ```

#### 2.4: Token Expiration Detection
- **Location**: `verifyAuthToken()` function, lines 90-93
- **Action**: Checks if token is expired before verification attempt
- **Log Output**: 
  ```
  [AUTH] Token is expired. Expiration time: 2024-12-08T19:30:00.000Z
  ```

### Phase 3: Client-Side Request Inspection

#### 3.1: Authorization Header Presence
- **Location**: `verifyAuthToken()` function, lines 63-66
- **Action**: Verifies that the Authorization header exists
- **Log Output**: 
  ```
  [AUTH] Authorization header is missing
  ```

#### 3.2: Authorization Header Format Validation
- **Location**: `verifyAuthToken()` function, lines 68-72
- **Action**: Validates that header starts with "Bearer " (with correct capitalization)
- **Security**: Logs only first 10 characters to avoid exposing sensitive data
- **Log Output**: 
  ```
  [AUTH] Authorization header format is invalid. Expected "Bearer <token>", got: bearer tok...
  ```

#### 3.3: Success Logging
- **Location**: `verifyAuthToken()` function, lines 102-106
- **Action**: Confirms successful token verification
- **Security**: User ID only logged in test environments
- **Log Output (test env)**: 
  ```
  [AUTH] Token verification successful for user: user_123abc
  ```
- **Log Output (production)**: 
  ```
  [AUTH] Token verification successful
  ```

## Security Considerations

### 1. Sensitive Data Protection
- **Secret Keys**: Never logged in full, only first/last 5 characters
- **Invalid Keys**: Only first 4 characters + *** logged when format is invalid
- **JWT Tokens**: Never logged in full, only decoded payload claims in test env
- **Authorization Headers**: Only first 10 characters logged when invalid
- **User IDs**: Only logged in test environments (sk_test_*)

### 2. Environment-Aware Logging
The system detects the environment based on the secret key prefix:
- **Test Environment** (`sk_test_*`): Detailed diagnostic logging enabled
- **Production Environment** (`sk_live_*`): Sensitive information omitted

### 3. JWT Decoding Security
- Uses proper base64url decoding (not standard base64)
- Handles missing padding automatically
- Only used for diagnostics, not for verification
- Never exposes the full token

## Testing

### Test Coverage
- 15 comprehensive tests covering all diagnostic scenarios
- All tests use proper base64url encoding for JWT tokens
- Mock Clerk client for isolated testing
- Test both success and failure scenarios

### Test Categories
1. **Authorization Header Validation** (3 tests)
   - Missing header
   - Invalid format
   - Incorrect capitalization

2. **Token Verification Errors** (5 tests)
   - Successful verification with claims logging
   - Expired token detection
   - Signature verification failure
   - Invalid issuer
   - Unknown errors

3. **Environment Configuration** (7 tests)
   - Missing secret key
   - Invalid key format (public key)
   - Invalid key format (random string)
   - Masked key logging (test env)
   - Masked key logging (live env)
   - Successful authentication
   - Failed authentication

## Usage Example

### Debugging a Token Verification Failure

When a token verification fails, you'll see a series of diagnostic logs:

```
[AUTH] Secret key verified (masked): sk_te...vwxyz
[AUTH] Secret key environment: test
[AUTH] Token payload claims: {
  exp: "2024-12-08T19:00:00.000Z",
  iss: "https://clerk.example.com",
  iat: "2024-12-08T18:00:00.000Z"
}
[AUTH] Token is expired. Expiration time: 2024-12-08T19:00:00.000Z
[AUTH] Token verification failed with detailed error: {
  message: "Token expired",
  name: "Error"
}
[AUTH] Root Cause: Token Expiration
[AUTH] Authentication failed - no valid user ID extracted
```

From this output, you can immediately see:
1. The secret key is configured correctly (test environment)
2. The token was issued at 18:00 and expired at 19:00
3. The token is expired (current time is after 19:00)
4. **Root Cause: Token Expiration**

## API Endpoints Using This System

All authenticated API endpoints in `functions/api/` use the `authenticateRequest()` function:
- `/api/sync` - User data synchronization
- `/api/achievements/*` - Achievement endpoints
- `/api/admin/*` - Admin CMS endpoints
- `/api/media/*` - Media management endpoints
- `/api/questions/*` - Question endpoints
- `/api/resources/*` - Resource endpoints
- `/api/streaks/*` - Streak endpoints

## Maintenance

### Adding New Diagnostic Logging
To add new diagnostic information:
1. Add the logging in the appropriate phase (1, 2, or 3)
2. Use `[AUTH]` prefix for consistency
3. Check environment before logging sensitive data
4. Add corresponding tests

### Updating Root Cause Detection
To add detection for new error patterns:
1. Add a new `else if` clause in the error handling section
2. Check for the error message pattern (case-insensitive)
3. Log a clear root cause message
4. Add a test case

## References

- [Clerk Authentication Documentation](https://clerk.com/docs)
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [Base64url Encoding RFC 4648](https://tools.ietf.org/html/rfc4648#section-5)
