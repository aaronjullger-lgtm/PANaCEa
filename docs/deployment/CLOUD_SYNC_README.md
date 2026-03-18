# Cloud Sync & User Authentication

PANaCEa now supports user authentication and cloud synchronization, allowing you to:

- 📱 Study on multiple devices
- ☁️ Keep your progress safe in the cloud
- 🔄 Automatically sync across devices
- 🔒 Secure your learning data with authentication
- 💾 Continue studying offline with automatic sync when online

## Quick Start

### For Users

1. **Sign In**: Click the "Sign In" button on the main menu
2. **Create Account**: Use email or Google sign-in
3. **Automatic Migration**: Your existing progress uploads automatically
4. **Study Anywhere**: Sign in on any device to access your progress

### For Developers

See the [Authentication Setup Guide](./AUTHENTICATION_SETUP.md) for detailed setup instructions.

## Features

### 🔐 Authentication

- Secure sign-in with Clerk
- Email and social authentication (Google, GitHub, etc.)
- Session management with automatic token refresh
- User profile management

### ☁️ Cloud Synchronization

- Automatic background sync
- Real-time progress saving
- Timestamp-based 3-way conflict resolution with local deletion tracking
- Offline support with queue-based sync

### 📊 Data Migration

- Seamless migration from localStorage
- No data loss during transition
- Backwards compatible (works without account)
- Manual backup option available

### 🎯 What Gets Synced

All your study data syncs automatically:

- ✅ Performance records (quiz history)
- ✅ Spaced repetition schedules (SRS)
- ✅ Missed questions queue
- ✅ Flagged questions
- ✅ Study statistics and progress
- ✅ Learning streaks

## Architecture

### Frontend

```
App.tsx
  ├── AuthProvider (Clerk)
  ├── useAuth() → User state
  ├── useUserStats() → Data sync
  └── Components
       └── AuthButton → Sign in/out UI
```

### Backend (Cloudflare Functions)

```
/functions/api/
  ├── sync.ts → GET/POST data sync
  ├── user/profile.ts → GET/PUT profile + onboarding flags
  └── user/stats.ts → User statistics aggregation
```

### Database (PostgreSQL + Prisma)

```
prisma/schema.prisma
  ├── User → Clerk user reference
  ├── PerformanceRecord → Quiz history
  ├── SRSItem → Spaced repetition
  └── SavedQuestion → Missed/flagged
```

## Technology Stack

- **Frontend**: React 19 + Vite
- **Authentication**: Clerk
- **Database**: PostgreSQL with Prisma ORM
- **Backend**: Cloudflare Pages Functions
- **State Management**: React hooks with localStorage fallback

## API Endpoints

### `GET /api/sync`

Fetch user's cloud data

```typescript
Request: {
  Authorization: 'Bearer <token>';
}
Response: {
  success: boolean;
  message: string;
  data: {
    performanceRecords: PerformanceRecord[];
    srsItems: SRSItem[];
    savedQuestions: SavedQuestion[];
  };
}
```

### `POST /api/sync`

Upload/merge local data to cloud

```typescript
Request: {
  userId: string;
  performanceRecords?: PerformanceRecord[];
  srsItems?: SRSItem[];
  savedQuestions?: SavedQuestion[];
  localDeletions?: Record<string, string>; // key -> ISO deletion timestamp
}
Response: {
  success: boolean;
  message: string;
  data: {
    performanceRecords: PerformanceRecord[];
    srsItems: SRSItem[];
    savedQuestions: SavedQuestion[];
  };
}
```

`localDeletions` key format:
- SRS items: `questionId`
- Saved/flagged/missed items: `questionId:type`

Merge behavior:
- If both local and cloud versions exist, newer timestamp wins (`updatedAt`, fallback to `lastReviewed`/`createdAt`).
- If item exists only in cloud but has a local deletion timestamp, cloud item is restored only when cloud timestamp is newer than deletion.

### `GET /api/user/profile`

Fetch authenticated user's profile metadata (including onboarding flags).

```typescript
Request: { Authorization: 'Bearer <token>' }
Response: {
  success: boolean;
  profile: {
    firstName: string | null;
    lastName: string | null;
    examDate: string | null;
    eorTestDate: string | null;
    hasCompletedOnboarding: boolean;
    // ...other profile fields
  };
}
```

### `PUT /api/user/profile`

Partially update profile and onboarding fields.

```typescript
Request: {
  Authorization: 'Bearer <token>';
  // JSON body (top-level, no wrapper):
  firstName?: string;
  lastName?: string;
  examDate?: string | null;
  eorTestDate?: string | null;
  hasCompletedOnboarding?: boolean;
  // ...other optional profile fields
}
Response: { success: boolean; profile: object; message: string }
```

## Development

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your keys
```

3. Set up database:

```bash
npx prisma migrate dev
npx prisma generate
```

4. Start dev server:

```bash
npm run dev
```

### Testing Sync

To test cloud sync locally:

1. **Without Auth**: Data stays in localStorage
2. **With Auth**:
   - Sign in with test account
   - Create some performance data
   - Check browser DevTools > Network tab
   - Verify POST requests to `/api/sync`
   - Sign in on different browser to verify sync

### Database Migrations

Create new migration:

```bash
npx prisma migrate dev --name descriptive_name
```

Apply migrations in production:

```bash
npx prisma migrate deploy
```

Reset database (⚠️ deletes all data):

```bash
npx prisma migrate reset
```

## Security Considerations

### Authentication

- JWT tokens expire after 1 hour
- Refresh tokens handled automatically by Clerk
- Session cookies are httpOnly and secure
- CSRF protection enabled

### Data Protection

- All API calls require authentication
- User data isolated by userId
- SQL injection protected by Prisma
- CORS configured for frontend origin only

### Environment Variables

Never commit:

- ❌ `CLERK_SECRET_KEY`
- ❌ `DATABASE_URL`
- ❌ `.env` file

Always use:

- ✅ `.env.example` for templates
- ✅ Cloudflare environment variables for production
- ✅ Different keys for dev/staging/prod

## Deployment

### Cloudflare Pages

1. **Environment Variables**: Add to Cloudflare dashboard
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`

2. **Database**:
   - Use connection pooling (PgBouncer)
   - Consider Prisma Data Proxy for serverless
   - Set `connection_limit=1` in DATABASE_URL

3. **Build Settings**:
   - Build command: `npm run build`
   - Build output: `dist`
   - Node version: 18+

### Database Hosting

Recommended providers:

- **Neon**: Serverless PostgreSQL (free tier)
- **Supabase**: PostgreSQL + additional features (free tier)
- **Railway**: Simple deployment (free tier)
- **Fly.io**: Global PostgreSQL (paid)

## Monitoring

### Sync Status

Users can see sync status in the UI:

- 🟢 "Synced" - Last sync successful
- 🟡 "Syncing..." - Upload in progress
- 🔴 "Sync error" - Failed to sync (data safe locally)

### Error Handling

Errors are logged but don't block studying:

- Failed sync → Data stays in localStorage
- Network error → Retry on next action
- Auth error → Prompt to sign in again
- Transient Accelerate/network failures → Automatic retry with backoff

## Troubleshooting

### Common Issues

**Build fails with Prisma errors**

```bash
npx prisma generate
npm run build
```

**Database connection fails**

- Check DATABASE_URL format
- Verify database is running
- Check firewall rules
- Try connection pooling

**Clerk authentication fails**

- Verify publishable key matches domain
- Check secret key is correct
- Ensure Clerk app is not paused
- Clear cookies and try again

**Sync not working**

- Check browser console for errors
- Verify JWT token is present
- Check /api/sync endpoint is accessible
- Try manual sync (sign out/in)

## Future Enhancements

Planned features:

- [ ] Conflict resolution UI
- [ ] Manual export/import
- [ ] Data visualization dashboard
- [ ] Team/group features
- [ ] Advanced sync strategies (delta sync)
- [ ] Offline queue with retry logic
- [ ] Real-time sync with WebSockets

## Contributing

To contribute to cloud sync features:

1. Read [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md)
2. Set up local development environment
3. Test changes with real auth provider
4. Add tests for new sync logic
5. Update documentation
6. Submit PR with clear description

## License

This feature is part of PANaCEa and follows the same license.

## Support

- 📚 [Setup Guide](./AUTHENTICATION_SETUP.md)
- 📖 [Migration Guide](./MIGRATION_GUIDE.md)
- 🐛 [Report Issues](https://github.com/aaronjullger-lgtm/PANaCEa/issues)
- 💬 [Discussions](https://github.com/aaronjullger-lgtm/PANaCEa/discussions)
