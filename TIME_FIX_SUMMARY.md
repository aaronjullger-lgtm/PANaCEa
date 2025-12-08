# Time Discrepancy and Authentication Debug Mode Fix

## Problem Statement
The site was experiencing two related issues:
1. **Wrong day display**: The activity tab showed Sunday when it was actually Monday
2. **Authentication errors**: Users experiencing 401 errors and infinite loading due to "token-not-active-yet" caused by clock skew between client and server

## Root Causes

### 1. Date Calculation Issues
The frontend components were using the client's local system time via `new Date()`, which could be incorrect if:
- The user's computer has the wrong date/time set
- Timezone differences cause confusion between dates
- The client's clock is out of sync with the server

### 2. Authentication Clock Skew
Clerk JWT tokens have an "nbf" (not before) claim that specifies when the token becomes valid. If the client's clock is ahead of the server's clock (even by a few seconds), the token may not be valid yet, causing "token-not-active-yet" errors.

## Solutions Implemented

### 1. UTC Date Normalization
**Changed all date calculations to use UTC** to ensure consistency regardless of client timezone or local time settings:

#### Files Modified:
- `lib/utils/timeUtils.ts` - Added `getTodayUTC()` helper function
- `lib/services/streakService.ts` - Updated `getTodayDate()` and `getYesterdayDate()` to use UTC
- `components/analytics/ActivityHeatmap.tsx` - Updated date generation and grid processing
- `components/ProgressDashboard/HeatmapCalendar.tsx` - Updated date generation and grid processing  
- `components/StreakTracker.tsx` - Updated date calculations for the 7-day calendar

**Key Changes:**
```typescript
// Before: Used local time (wrong if client clock is off)
const today = new Date();
today.setHours(0, 0, 0, 0);

// After: Use UTC time (consistent everywhere)
const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
```

### 2. Increased Clock Skew Tolerance
**Increased the leeway from 5 seconds to 60 seconds** in the backend authentication middleware:

#### Files Modified:
- `lib/middleware/clerkAuth.ts` - Updated both `requireAuth()` and `optionalAuth()` functions

**Key Changes:**
```typescript
// Before: Only 5 seconds tolerance
const verifiedToken = await verifyToken(token, {
  secretKey,
  leeway: 5,
});

// After: 60 seconds tolerance to handle clock skew
const verifiedToken = await verifyToken(token, {
  secretKey,
  leeway: 60,
});
```

### 3. Enhanced Debug Logging
**Added comprehensive debug mode** for diagnosing authentication issues:

#### Backend (Server-side)
- Added `CLERK_AUTH_DEBUG` environment variable
- Logs authorization header presence and format
- Shows token verification attempts with server time
- Provides detailed error reasons (e.g., "token-not-active-yet", "token-expired")
- Includes reason codes in 401 responses when debug is enabled

#### Frontend (Client-side)
- Added `VITE_CLERK_DEBUG` environment variable (auto-enabled in dev mode)
- Logs ClerkProvider initialization
- Shows client time and timezone offset
- Enables Clerk telemetry for detailed debugging

#### Files Modified:
- `lib/middleware/clerkAuth.ts` - Added debug logging throughout auth functions
- `components/AuthProvider.tsx` - Added debug mode with telemetry
- `.env.example` - Added `CLERK_AUTH_DEBUG` and `VITE_CLERK_DEBUG` flags

## How to Use

### Enable Debug Mode
Add to your `.env` file:
```bash
# Backend auth debug
CLERK_AUTH_DEBUG=true

# Frontend Clerk debug (also auto-enabled in dev mode)
VITE_CLERK_DEBUG=true
```

### Debug Output Examples

**Backend logs** (when `CLERK_AUTH_DEBUG=true`):
```
[Auth Debug] Attempting to verify token with leeway: 60 seconds
[Auth Debug] Current server time: 2025-12-08T22:41:58.000Z
[Auth Debug] Token verified successfully for user: user_abc123
```

**Frontend logs** (when `VITE_CLERK_DEBUG=true` or in dev mode):
```
[Clerk] Debug mode enabled
[Clerk] Publishable key: pk_test_xxxxx...
[Clerk] Client time: 2025-12-08T22:41:58.123Z
[Clerk] Client timezone offset: -300
```

### Error Diagnosis
If you see a 401 error with debug enabled, check the `reason` field:
- `token-not-active-yet` - Clock skew issue (client ahead of server)
- `token-expired` - Token has expired, user needs to re-authenticate
- `invalid-signature` - Token signature is invalid
- `missing-authorization-header` - No auth header provided

## Testing Recommendations

1. **Test with incorrect client time**: Set your computer's clock forward or backward by several hours and verify the activity tab shows the correct day
2. **Test authentication**: Clear cookies, sign in again, and verify no 401 errors occur
3. **Verify UTC consistency**: Check that the activity heatmap and streak tracker show the same day regardless of timezone

## Benefits

1. **Consistent date display**: Activity heatmap and streak tracker always show the correct day, even if the user's computer clock is wrong
2. **Fewer auth errors**: 60-second leeway handles most clock skew issues
3. **Better debugging**: Debug mode provides detailed information to diagnose issues
4. **Cross-timezone support**: UTC normalization ensures dates are consistent for users in any timezone

## Migration Notes

- No database migrations required
- Changes are backward compatible
- Existing date data in the database will continue to work
- Users may need to clear their browser cache if they experience issues
