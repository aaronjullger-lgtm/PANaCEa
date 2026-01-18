# Supabase RLS (Row Level Security) Implementation

## Overview

This migration adds Row Level Security policies to ensure users can only access their own data, while allowing admins full access.

## Tables with RLS Enabled

| Table                 | Policy                     | Description                             |
| --------------------- | -------------------------- | --------------------------------------- |
| `User`                | Own data only              | Users can read/update their own profile |
| `UserQuestionHistory` | Own data only              | Question history is private             |
| `QuestionAttempt`     | Own data only              | Attempt records are private             |
| `SRSItem`             | Own data only              | Spaced repetition data is private       |
| `PerformanceRecord`   | Own data only              | Performance stats are private           |
| `StudySession`        | Own data only              | Session data is private                 |
| `UserAchievement`     | Own data only              | Achievements are private                |
| `Bookmark`            | Own data only              | Bookmarks are private                   |
| `SyncQueue`           | Own data only              | Sync queue is private                   |
| `QuestionFlag`        | Create own, admins see all | Users can report, admins review         |
| `StudyGroupMember`    | Own memberships            | Users see their own group memberships   |

## Public Content Tables (No RLS)

These tables contain shared educational content accessible to all users:

- `MedicalContent`
- `Condition`
- `Drug`
- `LabTest`
- `ImagingStudy`
- `ECGPattern`
- `PreGeneratedQuestion`
- etc.

## How It Works

1. **User Identification**: Policies use `auth.uid()::text` which should match the Clerk `clerkId`
2. **Subqueries**: Since `userId` is our internal ID, policies use subqueries to look up the internal ID from clerkId
3. **Admin Bypass**: Service role (`service_role`) and admin role can access all data

## Important Configuration

### Supabase Setup

For these policies to work correctly with Clerk authentication:

1. **Custom JWT Claims**: Configure your Clerk → Supabase integration to pass the clerkId as the JWT subject
2. **Service Role**: Backend operations should use the Supabase service_role key to bypass RLS
3. **Anon/Public**: Frontend requests should use the anon key with proper JWT

### Backend Pattern

```typescript
// For user-specific operations (uses RLS)
const supabase = createClient(url, anonKey, {
  global: {
    headers: {
      Authorization: `Bearer ${userJwt}`,
    },
  },
});

// For admin/system operations (bypasses RLS)
const adminSupabase = createClient(url, serviceRoleKey);
```

## Running the Migration

```bash
# Apply to development
npm run db:migrate:dev

# Apply to production
npm run migrate:production
```

## Testing RLS

After applying the migration, test with:

```sql
-- As a user, try to select another user's data (should return empty)
SELECT * FROM "QuestionAttempt" WHERE "userId" = 'other-user-id';

-- As service_role, same query should return data
SELECT * FROM "QuestionAttempt" WHERE "userId" = 'other-user-id';
```

## Rollback

If needed, disable RLS on a table:

```sql
ALTER TABLE "TableName" DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_name" ON "TableName";
```
