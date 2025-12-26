# Media Approval System - Deployment Checklist

Quick reference checklist for deploying the complete media approval infrastructure.

## Prerequisites

- [ ] Supabase account created
- [ ] GitHub repo linked to Supabase
- [ ] Clerk authentication configured
- [ ] Node.js 18+ installed
- [ ] PostgreSQL client installed (for DB access)

## Environment Setup

### 1. Configure Environment Variables

Create `.env` file in project root:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/db"

# Supabase
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Clerk Auth
VITE_CLERK_PUBLISHABLE_KEY="pk_test_xxxxx"
CLERK_SECRET_KEY="sk_test_xxxxx"

# Gemini AI
GEMINI_API_KEY="your-key"
VITE_GEMINI_API_KEY="your-key"

# Server
NODE_ENV="production"
PORT=3001
FRONTEND_URL="https://your-domain.com"
```

**Get credentials from:**
- Supabase: Dashboard → Project Settings → API & Database
- Clerk: Dashboard → API Keys
- Gemini: Google AI Studio

### 2. Install Dependencies

```bash
npm install
```

## Database Setup

### 3. Push Database Schema

```bash
# Push schema to Supabase
npm run db:push

# Generate Prisma client
npm run db:generate
```

**Verify:**
```bash
# Open database GUI
npm run db:studio
```

Check that these tables exist:
- `User`
- `MediaAsset` (with new fields: status, folder, mediaType, etc.)
- `EducationalResource`
- `MedicalContent`
- `Condition`

## Supabase Storage

### 4. Create Storage Buckets

In Supabase Dashboard → Storage:

**Bucket 1: `medical-images`**
- Public: ✅ Yes
- File size limit: 10 MB
- Allowed MIME types: `image/*`

**Bucket 2: `educational-resources`**
- Public: ✅ Yes
- File size limit: 50 MB
- Allowed MIME types: `application/pdf`, `video/*`, `audio/*`

### 5. Configure Storage Policies

For each bucket, add these policies:

**Allow authenticated uploads:**
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'medical-images');
```

**Allow public reads:**
```sql
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'medical-images');
```

Repeat for `educational-resources` bucket.

## User Permissions

### 6. Set Admin Roles in Clerk

In Clerk Dashboard → Users:

1. Find your admin user
2. Go to **Metadata** tab
3. Add to **Public Metadata**:
   ```json
   {
     "role": "admin"
   }
   ```

**Available roles:**
- `admin` - Full access
- `superadmin` - Full access + user management
- `approver` - Can approve media
- `editor` - Can edit content
- `viewer` - Read-only access
- `user` - Standard user (default)

## Data Migration

### 7. Migrate Existing Data

**Option A: Migrate static content to database**
```bash
npm run migrate:static-to-db
```

This migrates:
- Condition content from JSON files
- Condition registry
- Preserves all original files as backup

**Option B: Process existing media files**
```bash
npm run media:process-existing
```

This:
- Scans local media directories
- Runs AI quality checks
- Populates approval queue

**Review migration report:**
```bash
cat output/migration-report.json
```

### 8. Integrate Media with Database

```bash
npm run media:integrate
```

This:
- Scans media directories
- Matches media to conditions
- Writes to database
- Creates JSON backup

## Application Deployment

### 9. Build Application

```bash
# Build frontend
npm run build

# Build backend
npm run build:server
```

### 10. Start Services

**Development:**
```bash
npm run dev:all
```

**Production:**
```bash
# Start backend
NODE_ENV=production node dist-server/server.js

# Serve frontend (use your hosting platform)
# For Vercel/Netlify: Deploy dist/ folder
# For VPS: Use nginx to serve dist/
```

## Verification

### 11. Test Media Approval Workflow

1. **Access admin dashboard:**
   - Press `Cmd/Ctrl + K`
   - Type "media approval"
   - OR navigate to `/admin/media` in your app

2. **Upload test image:**
   ```bash
   curl -X POST http://localhost:3001/api/media/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@test-image.jpg" \
     -F "category=ecg" \
     -F "tags=[\"chest\",\"x-ray\"]"
   ```

3. **Check pending media:**
   - Go to Media Approval Dashboard
   - Verify test image appears
   - Check AI metadata and quality score

4. **Approve media:**
   - Click "Approve" button
   - Verify status changes to "approved"
   - Check folder moved to "clinical_verified"

5. **Verify in database:**
   ```bash
   npm run db:studio
   ```
   - Open MediaAsset table
   - Confirm record exists with correct status

### 12. Test API Endpoints

**Get pending media:**
```bash
curl http://localhost:3001/api/media/pending?includeStats=true
```

**Approve media:**
```bash
curl -X POST http://localhost:3001/api/media/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "approve",
    "mediaId": "uuid",
    "approvedBy": "user-id"
  }'
```

**Get stats:**
```bash
curl http://localhost:3001/api/media/stats
```

## Security Hardening

### 13. Enable Backend Authentication

In `server.ts`, uncomment auth middleware:

```typescript
import { requireAdmin } from './lib/middleware/adminAuth';

app.post('/api/media/approve', requireAdmin, async (req, res) => {
  // Handler code
});
```

Apply to these routes:
- `/api/media/pending`
- `/api/media/approve`
- `/api/media/stats`
- `/api/media/upload` (require authenticated user)

### 14. Configure CORS

In `server.ts`, update CORS settings:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 15. Set Up Rate Limiting

Already configured! Adjust if needed:

```typescript
// In server.ts
app.use('/api', rateLimit(100, 15 * 60 * 1000)); // 100 req/15min
```

For production with multiple instances, use Redis:

```bash
npm install redis connect-redis express-rate-limit
```

## Monitoring

### 16. Set Up Logging

**Option A: Supabase logs**
- Dashboard → Logs → View API logs

**Option B: Custom logging**
```typescript
// Add to server.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 17. Health Checks

**Application health:**
```bash
curl http://localhost:3001/health
```

**Database health:**
```bash
npm run health-check
```

## Troubleshooting

### Common Issues

**Error: "Prisma Client not generated"**
```bash
npm run db:generate
```

**Error: "Storage bucket does not exist"**
- Check Supabase Dashboard → Storage
- Create missing buckets
- Verify bucket names match code

**Error: "Authentication required"**
- Check Clerk configuration
- Verify token is being sent
- Check user role in Clerk metadata

**Images not loading:**
- Verify bucket is Public
- Check storage policies
- Confirm CORS settings

**Database connection failed:**
- Verify DATABASE_URL in .env
- Check Supabase dashboard for connection strings
- Use direct URL for migrations, pooled URL for app

## Post-Deployment

### 18. Monitor System

- [ ] Check error logs daily
- [ ] Review approval queue weekly
- [ ] Monitor storage usage
- [ ] Track API performance
- [ ] Review user feedback

### 19. Optimize Performance

**If slow uploads:**
- Enable image compression
- Implement chunked uploads
- Add CDN for static assets

**If database slow:**
- Add database indexes
- Enable query caching
- Use read replicas

**If approval queue large:**
- Increase auto-approval threshold
- Add more approvers
- Implement batch processing

### 20. Backup Strategy

**Database backups:**
- Supabase: Automatic daily backups
- Manual: `pg_dump` weekly

**Storage backups:**
- Download bucket contents monthly
- Keep JSON migration reports

**Static files:**
- Keep all original JSON/TS files
- Version control all code changes

## Success Criteria

✅ **System is ready when:**
- [ ] All tests pass
- [ ] Media uploads successfully
- [ ] AI analysis runs
- [ ] Approval workflow works
- [ ] Database is populated
- [ ] Admin dashboard accessible
- [ ] API endpoints respond
- [ ] Authentication works
- [ ] Monitoring is active

## Support

**Documentation:**
- [Media Approval Setup Guide](./MEDIA_APPROVAL_SETUP.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [API Reference](./docs/api/)

**Issues:**
- GitHub Issues: Report bugs
- Supabase Support: Database issues
- Clerk Support: Auth issues

## Rollback Plan

If deployment fails:

1. **Revert database changes:**
   ```bash
   # Restore from Supabase backup
   # Or reset to previous migration
   ```

2. **Switch back to static files:**
   - Comment out database reads
   - Uncomment JSON file reads
   - Deploy previous version

3. **Clear cache:**
   ```bash
   npm run db:generate
   rm -rf node_modules/.cache
   ```

4. **Investigate logs:**
   ```bash
   cat logs/error.log
   ```

---

**Deployment Date:** _____________

**Deployed By:** _____________

**Version:** _____________

**Notes:**
_____________________________________________
_____________________________________________
