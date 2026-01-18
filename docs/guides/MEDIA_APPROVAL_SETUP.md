# Media Approval System Setup Guide

This guide walks you through setting up the complete "Upload → AI Check → Human Approve → Live" workflow for medical images and educational resources.

## Prerequisites

- [x] Supabase account created
- [x] GitHub repository linked to Supabase
- [x] Prisma schema updated (already done)
- [ ] Environment variables configured
- [ ] Storage buckets created
- [ ] Database schema pushed

## Step 1: Configure Environment Variables

Add these to your `.env` file (or set them in your deployment environment):

```bash
# Database (Already configured)
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Gemini API (for AI processing)
GEMINI_API_KEY=your_gemini_api_key_here
```

Get these values from:

- **Supabase URL & Keys**: Supabase Dashboard → Project Settings → API
- **Database URLs**: Supabase Dashboard → Project Settings → Database → Connection String

## Step 2: Push Schema to Database

Run this command to create all database tables:

```bash
npx prisma db push
```

This will create:

- `MediaAsset` table with new fields (status, folder, mediaType, etc.)
- `EducationalResource` table for textbooks/PDFs
- All other existing tables

Verify the schema was applied:

```bash
npx prisma studio
```

This opens a GUI to browse your database.

## Step 3: Generate Prisma Client

After pushing the schema, regenerate the Prisma client with updated types:

```bash
npx prisma generate
```

## Step 4: Create Supabase Storage Buckets

Log into your Supabase Dashboard:

1. Navigate to **Storage** in the left sidebar
2. Click **New Bucket**
3. Create the first bucket:
   - **Name**: `medical-images`
   - **Public**: ✅ Yes (images need to be accessible)
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/*`
4. Create the second bucket:
   - **Name**: `educational-resources`
   - **Public**: ✅ Yes
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `application/pdf, video/*, audio/*`

### Set Bucket Policies (Important!)

For each bucket, click the three dots → **Policies** → **New Policy**:

**For uploads (authenticated users only):**

```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'medical-images');
```

**For public reads (everyone can view approved media):**

```sql
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'medical-images');
```

Repeat for the `educational-resources` bucket.

## Step 5: Wire Up Frontend Admin UI

The Media Approval Dashboard is already integrated into the app. To access it:

### Option A: Via Command Palette (Recommended)

1. Press `Cmd/Ctrl + K` anywhere in the app
2. Type "media" or "admin"
3. Select "Media Approval Dashboard"

### Option B: Direct Navigation

Navigate to the admin page programmatically:

```typescript
// In your admin menu or settings
handleNavigateToDrillMode('admin_media');
```

### Option C: Add to Admin Menu

Edit `pages/admin/AdminDashboard.tsx` and add a card:

```tsx
<div onClick={() => navigate('/admin/media')} className="card">
  <h3>Media Approval</h3>
  <p>Review pending uploads</p>
</div>
```

## Step 6: Ingest Existing Content

You've already uploaded photos and textbooks. Now tell the database about them:

### Option A: Process Existing Photos Script

This scans your local media directories and uploads metadata to the database:

```bash
npm run media:process-existing
```

What this does:

- Scans `assets/media/ekg`, `assets/media/labs`, `assets/media/imaging`, etc.
- Runs AI quality checks on each image
- Populates the approval queue with status `pending_review`
- Auto-approves high-confidence matches

### Option B: Manual Upload via API

Upload files programmatically:

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('category', 'ecg'); // or 'derm', 'radiology', etc.
formData.append('tags', JSON.stringify(['chest', 'x-ray', 'pneumonia']));

const response = await fetch('/api/media/upload', {
  method: 'POST',
  body: formData,
});
```

## Step 7: Launch the Full System

Start both the frontend and backend:

```bash
npm run dev:all
```

This runs:

- **Frontend** (Vite dev server on port 3000)
- **Backend API** (Express server on port 3001)

The backend includes the Context-Aware Orchestrator that runs every 6 hours to:

- Generate questions using approved media
- Process new uploads
- Run health checks

## Workflow Overview

### 1. Upload Phase

Files are uploaded to Supabase Storage:

- User uploads via admin UI or API
- Files stored in `medical-images` or `educational-resources` bucket
- Initial status: `pending_review`
- Folder: `inbox`

### 2. AI Check Phase

Automatic quality assessment:

- AI analyzes image resolution, clarity, clinical relevance
- Assigns quality score (0-100)
- Extracts metadata (tags, clinical features)
- Generates recommendations

**Auto-approval criteria:**

- Quality score ≥ 80
- High confidence match to condition
- No critical issues detected

### 3. Human Approve Phase

Admin reviews in Media Approval Dashboard:

- View pending items with AI metadata
- See quality score and recommendations
- Approve or reject with reason
- Batch approve/reject multiple items

**Upon approval:**

- Status changes to `approved`
- Folder moves to `clinical_verified`
- Media becomes available for question generation

**Upon rejection:**

- Status changes to `rejected`
- Folder moves to `archive`
- Rejection reason logged for audit

### 4. Live Phase

Approved media is used throughout the app:

- Photo Drill modes pull from approved media
- Question generator uses verified images
- Educational resources linked to conditions

## Database Schema Reference

### MediaAsset Table

Key fields for the approval workflow:

```prisma
model MediaAsset {
  // Approval workflow
  status         String   @default("pending_review")
                         // "pending_review" | "approved" | "rejected" | "flagged"

  // Organization
  folder         String   @default("inbox")
                         // "inbox" (no-use) | "clinical_verified" (use) | "archive"

  // Media type support
  mediaType      String   @default("image")
                         // "image" | "pdf" | "video" | "audio"

  // Quality assessment
  qualityScore   Float?   // AI-assigned score (0-100)

  // Textbook/Lecture fields
  textContent    String?  @db.Text // OCR text for search
  pageCount      Int?     // For PDFs
  duration       Int?     // For videos (seconds)

  // Source tracking
  sourceUrl      String?  // Where it came from
  citation       String?  // Academic citation
}
```

## API Endpoints

### Get Pending Media

```bash
GET /api/media/pending?category=ecg&includeStats=true
```

Response:

```json
{
  "success": true,
  "media": [...],
  "stats": {
    "pending": 15,
    "approved": 42,
    "rejected": 3,
    "total": 60,
    "approvalRate": 93
  }
}
```

### Approve Media

```bash
POST /api/media/approve
Content-Type: application/json

{
  "action": "approve",
  "mediaId": "uuid",
  "approvedBy": "user-id"
}
```

### Reject Media

```bash
POST /api/media/approve
Content-Type: application/json

{
  "action": "reject",
  "mediaId": "uuid",
  "approvedBy": "user-id",
  "rejectionReason": "Poor image quality"
}
```

## Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"

**Solution**: Make sure `.env` file exists in the project root with all required variables.

### Error: "Storage bucket 'medical-images' does not exist"

**Solution**:

1. Go to Supabase Dashboard → Storage
2. Create the missing bucket
3. Set it to Public
4. Add storage policies (see Step 4)

### Error: "Prisma Client not generated"

**Solution**: Run `npx prisma generate`

### Images not appearing after approval

**Check:**

1. Bucket is set to Public in Supabase
2. Storage policies allow public reads
3. `originalUrl` field is correctly set in database
4. CORS is configured if serving from different domain

### AI quality assessment failing

**Check:**

1. `GEMINI_API_KEY` is set in environment
2. API key has sufficient quota
3. Image file is valid and readable

## Advanced Configuration

### Customize Auto-Approval Thresholds

Edit `services/mediaApprovalService.ts`:

```typescript
function shouldAutoApprove(assessment: QualityAssessment): boolean {
  return (
    assessment.qualityScore >= 80 && // Change this threshold
    assessment.confidence >= 0.9 &&
    assessment.issues.length === 0
  );
}
```

### Add Custom Media Categories

1. Update Prisma schema with new category
2. Add filter button in `MediaApproval.tsx`
3. Update AI processing logic for category-specific checks

### Enable Media Versioning

Track changes to media over time:

```typescript
// When updating media, create version record
await prisma.mediaVersion.create({
  data: {
    mediaId: media.id,
    changes: { qualityScore: newScore },
    changedBy: userId,
  },
});
```

## Next Steps

Once the basic workflow is running:

1. **Cost Optimizer**: Update question generator to query approved media first
2. **Smart Upload**: Add bulk uploader with drag-and-drop
3. **OCR Integration**: Extract text from textbooks automatically
4. **Analytics Dashboard**: Track approval rates, quality trends
5. **User Permissions**: Implement RBAC for different approval levels

## Support

For issues or questions:

- Check the [GitHub Issues](https://github.com/yourusername/PANaCEa/issues)
- Review the [Developer Guide](./DEVELOPER_GUIDE.md)
- Contact the dev team

---

**Status**: ✅ Ready for production deployment after completing Steps 1-7.
