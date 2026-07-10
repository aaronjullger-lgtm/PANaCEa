# Media Approval System Setup Guide

This guide walks through setting up the Media Approval System for PANaCEa.

## Prerequisites

- Supabase account and project created
- Environment variables configured (DATABASE_URL, SUPABASE_URL, etc.)
- Node.js v18 or higher

## Step 1: Install Dependencies

```bash
npm install
```

This will install the new `sharp` package required for image processing.

## Step 2: Update Database Schema

Apply the schema changes to add approval workflow fields:

```bash
# Generate Prisma client with new models
npx prisma generate

# Push schema changes to database
npx prisma db push
```

Or create a migration:

```bash
npx prisma migrate dev --name add_media_approval_system
```

## Step 3: Configure Supabase Storage

### Create Storage Buckets

1. Go to your Supabase Dashboard → Storage
2. Create two buckets:

#### Bucket 1: `medical-images`

- **Name**: `medical-images`
- **Public**: ✅ Yes (for public access to approved images)
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Bucket 2: `educational-resources`

- **Name**: `educational-resources`
- **Public**: ✅ Yes
- **File size limit**: 50MB
- **Allowed MIME types**: `application/pdf, application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation`

### Set Up Storage Policies

For `medical-images` bucket:

```sql
-- Allow public read access to all files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'medical-images' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medical-images'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their uploads
CREATE POLICY "Users can update own uploads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'medical-images'
  AND auth.role() = 'authenticated'
);
```

For `educational-resources` bucket:

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'educational-resources' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'educational-resources'
  AND auth.role() = 'authenticated'
);
```

## Step 4: Create Folders in Storage

Create folder structure in `medical-images` bucket:

- `ecg/`
- `ecg/thumbnails/`
- `derm/`
- `derm/thumbnails/`
- `radiology/`
- `radiology/thumbnails/`
- `labs/`
- `labs/thumbnails/`
- `diagrams/`
- `diagrams/thumbnails/`

## Step 5: Verify Environment Variables

Ensure these variables are set in your `.env` file:

```env
# Supabase
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://...
DIRECT_DATABASE_URL=postgresql://...

# AI
GEMINI_API_KEY=your-gemini-api-key
```

## Step 6: Test the System

### Test 1: Upload an Image

```bash
curl -X POST http://localhost:3001/api/media/upload \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test-ecg.jpg",
    "category": "ecg",
    "tags": ["Test"],
    "description": "Test upload",
    "fileData": "BASE64_ENCODED_IMAGE_DATA"
  }'
```

Expected response:

```json
{
  "success": true,
  "media": {
    "id": "...",
    "qualityScore": 85,
    "autoApproved": true
  }
}
```

### Test 2: Get Pending Media

```bash
curl http://localhost:3001/api/media/pending?includeStats=true
```

### Test 3: Get Approval Stats

```bash
curl http://localhost:3001/api/media/stats
```

## Step 7: Access Admin Dashboard

1. Start the development servers:

```bash
npm run dev:all
```

2. Navigate to: `http://localhost:3000/admin/media`

3. You should see the Media Approval Dashboard with:
   - Statistics cards (Pending, Approved, Rejected, Approval Rate)
   - Filters by category
   - Grid of pending media
   - Ability to approve/reject

## Step 8: Migrate Existing Media (Optional)

If you have existing media in the database without approval status:

```bash
# Create a migration script
npx tsx scripts/migrateExistingMedia.ts
```

Script content (`scripts/migrateExistingMedia.ts`):

```typescript
import { prisma } from '../lib/prisma';

async function migrateExistingMedia() {
  console.log('Migrating existing media...');

  // Update all media without approval status
  const result = await prisma.mediaAsset.updateMany({
    where: {
      approvalStatus: null,
    },
    data: {
      approvalStatus: 'pending',
      isClinical: false,
    },
  });

  console.log(`Updated ${result.count} media assets to pending status`);
}

migrateExistingMedia()
  .then(() => console.log('Migration complete'))
  .catch(console.error)
  .finally(() => process.exit(0));
```

## Step 9: Configure Admin Routes

Add the Media Approval Dashboard to your admin routes:

```typescript
// In your routing configuration (e.g., App.tsx)
import { MediaApprovalDashboard } from '@/components/admin/MediaApprovalDashboard';

// Add route
<Route path="/admin/media" element={<MediaApprovalDashboard />} />
```

## Step 10: Add Admin Menu Link

Update your admin menu to include a link to the media approval dashboard:

```typescript
// In MenuView.tsx or admin navigation
<Link to="/admin/media">
  <ImageIcon className="w-5 h-5" />
  Media Approval
  {pendingCount > 0 && (
    <span className="ml-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
      {pendingCount}
    </span>
  )}
</Link>
```

## Verification Checklist

- [ ] Dependencies installed successfully
- [ ] Database schema updated
- [ ] Supabase storage buckets created
- [ ] Storage policies configured
- [ ] Folder structure created
- [ ] Environment variables set
- [ ] Test upload successful
- [ ] Admin dashboard accessible
- [ ] Approval workflow working
- [ ] Images appear in photo drill (approved only)

## Troubleshooting

### Issue: "Sharp module not found"

**Solution**:

```bash
npm install sharp
npm rebuild sharp
```

### Issue: "Storage bucket not found"

**Solution**:

- Verify bucket names in Supabase dashboard
- Check bucket is set to public
- Verify storage policies are created

### Issue: "Database connection failed"

**Solution**:

- Check DATABASE_URL is correct
- Verify database is accessible
- Try: `npx prisma db push` to sync schema

### Issue: "Auto-approval not working"

**Solution**:

- Check GEMINI_API_KEY is set
- Verify AI analysis is returning valid data
- Check quality score calculation
- Review logs for AI errors

### Issue: "Images not appearing in photo drill"

**Solution**:

- Verify images are approved (`approvalStatus = 'approved'`)
- Check `isClinical` flag is true
- Ensure images are linked to conditions
- Clear cache and reload

## Next Steps

1. **Upload Medical Images**: Start uploading ECGs, radiographs, dermatology images
2. **Review Pending**: Check the admin dashboard regularly
3. **Monitor Quality**: Track approval rates and quality trends
4. **Upload Resources**: Add textbooks, lecture notes, and educational PDFs
5. **Link to Conditions**: Ensure media is properly linked to medical conditions

## Advanced Configuration

### Custom Quality Thresholds

Edit `services/imageQualityService.ts`:

```typescript
const QUALITY_THRESHOLDS = {
  MIN_WIDTH: 800, // Adjust minimum width
  MIN_HEIGHT: 600, // Adjust minimum height
  MIN_QUALITY_SCORE: 70, // Adjust auto-approval threshold
  MAX_FILE_SIZE_MB: 10, // Adjust max file size
};
```

### Batch Processing

For bulk uploads, use the batch approval endpoint:

```typescript
await fetch('/api/admin/media/approve', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    action: 'approve',
    mediaIds: ['id1', 'id2', 'id3'],
    reason: 'optional rejection reason when action is reject',
  }),
});
```

## Support

For additional help:

1. Review [MEDIA_APPROVAL_SYSTEM.md](./MEDIA_APPROVAL_SYSTEM.md)
2. Check [DATABASE_IMPLEMENTATION.md](./DATABASE_IMPLEMENTATION.md)
3. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## Maintenance

### Regular Tasks

- **Daily**: Review pending media queue
- **Weekly**: Check approval statistics
- **Monthly**: Analyze quality trends
- **Quarterly**: Clean up rejected media
- **As needed**: Update quality thresholds based on trends
