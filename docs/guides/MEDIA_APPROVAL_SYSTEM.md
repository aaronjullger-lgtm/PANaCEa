# Media Approval System

## Overview

The PANaCEa Media Approval System implements a comprehensive workflow for managing uploaded medical images, textbooks, and lectures. It ensures only high-quality, clinically relevant content is used in the educational platform.

## Key Features

### 1. **Automated Quality Assessment**
- AI-powered image analysis using Gemini Vision
- Resolution, format, and size validation
- Clinical relevance detection
- Quality scoring (0-100 scale)
- Auto-approval for high-quality images (score >= 70)

### 2. **Approval Workflow**
- **Pending State**: Newly uploaded media awaits review
- **Approved State**: Ready for use in educational content
- **Rejected State**: Does not meet quality standards

### 3. **Admin Dashboard**
- Visual interface for reviewing pending media
- One-click approve/reject actions
- Detailed quality metrics and AI analysis
- Batch approval capabilities
- Filtering by category (ECG, Dermatology, Radiology, etc.)

### 4. **Educational Resource Processing**
- Automatic text extraction from PDFs and PowerPoint slides
- AI-powered content analysis and summarization
- Automatic linking to relevant medical conditions
- Searchable resource library

## Architecture

### Database Schema

#### MediaAsset Model
```prisma
model MediaAsset {
  id              String     @id
  filename        String
  originalUrl     String?
  thumbnailUrl    String?
  type            String     // "ecg" | "imaging" | "labs" | "diagram"
  
  // Quality Control
  approvalStatus  String     @default("pending") // "pending" | "approved" | "rejected"
  qualityScore    Float?     // 0-100
  isClinical      Boolean    @default(false)
  approvedBy      String?
  approvedAt      DateTime?
  rejectionReason String?
  
  // Metadata
  tags            String[]
  description     String?
  dimensions      Json?
  
  // Relations
  conditionId     String?
  condition       Condition?
}
```

#### EducationalResource Model
```prisma
model EducationalResource {
  id              String   @id
  title           String
  resourceType    String   // "textbook" | "lecture" | "pdf" | "video"
  fileUrl         String?
  
  // Content
  extractedText   String?
  summary         String?
  keyTopics       String[]
  
  // Quality Control
  approvalStatus  String   @default("pending")
  qualityScore    Float?
  
  // Linkage
  conditionIds    String[]
  systemCodes     String[] // CV, PULM, GI, etc.
}
```

### Services

#### 1. Image Quality Service
**Location**: `services/imageQualityService.ts`

**Functions**:
- `assessImageQuality(buffer, category)` - Analyzes image quality
- `shouldAutoApprove(assessment)` - Determines auto-approval eligibility
- `generateThumbnail(buffer, maxWidth)` - Creates preview thumbnails
- `optimizeImage(buffer, maxWidth)` - Optimizes for web delivery

**Quality Thresholds**:
- Minimum width: 800px
- Minimum height: 600px
- Maximum file size: 10MB
- Minimum quality score for auto-approval: 70
- Supported formats: JPEG, PNG, WebP

#### 2. Media Approval Service
**Location**: `services/mediaApprovalService.ts`

**Functions**:
- `processUploadedMedia(mediaId, buffer, category)` - Processes new uploads
- `getPendingMedia(options)` - Retrieves media awaiting review
- `getApprovedMedia(options)` - Retrieves approved media
- `approveMedia(decision)` - Approves a media asset
- `rejectMedia(decision)` - Rejects a media asset
- `batchApproveMedia(mediaIds, approvedBy)` - Batch approval
- `getApprovalStats()` - Returns approval statistics

#### 3. Educational Resource Service
**Location**: `services/educationalResourceService.ts`

**Functions**:
- `uploadEducationalResource(options)` - Uploads and processes resources
- `getResourcesForCondition(conditionId)` - Gets resources for a condition
- `searchResources(query, filters)` - Searches resource library
- `trackResourceAccess(resourceId)` - Analytics tracking

### API Endpoints

#### Media Endpoints

##### POST `/api/media/upload`
Upload a new medical image with quality assessment.

**Request**:
```json
{
  "filename": "atrial-fibrillation.jpg",
  "category": "ecg",
  "conditionId": "condition-uuid",
  "tags": ["Atrial Fibrillation", "ECG", "Arrhythmia"],
  "description": "Classic irregularly irregular rhythm",
  "fileData": "base64-encoded-image-data"
}
```

**Response**:
```json
{
  "success": true,
  "media": {
    "id": "media-uuid",
    "filename": "atrial-fibrillation.jpg",
    "originalUrl": "https://storage.url/...",
    "qualityScore": 85,
    "autoApproved": true
  }
}
```

##### GET `/api/media/pending`
Retrieve media awaiting approval.

**Query Parameters**:
- `category`: Filter by type (ecg, derm, radiology, etc.)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset
- `includeStats`: Include approval statistics

**Response**:
```json
{
  "success": true,
  "media": [...],
  "total": 42,
  "stats": {
    "pending": 42,
    "approved": 158,
    "rejected": 12,
    "total": 212,
    "approvalRate": 92.9
  }
}
```

##### POST `/api/media/approve`
Approve or reject a media asset.

**Request (Approve)**:
```json
{
  "action": "approve",
  "mediaId": "media-uuid",
  "approvedBy": "user-uuid"
}
```

**Request (Reject)**:
```json
{
  "action": "reject",
  "mediaId": "media-uuid",
  "approvedBy": "user-uuid",
  "rejectionReason": "Poor image quality"
}
```

**Request (Batch Approve)**:
```json
{
  "action": "batch-approve",
  "mediaIds": ["id1", "id2", "id3"],
  "approvedBy": "user-uuid"
}
```

##### GET `/api/media/stats`
Get approval workflow statistics.

#### Resource Endpoints

##### POST `/api/resources/upload`
Upload an educational resource (textbook, lecture, PDF).

**Request**:
```json
{
  "title": "Cardiology Lecture - Atrial Fibrillation",
  "resourceType": "pdf",
  "originalFilename": "cardio-lecture-01.pdf",
  "fileData": "base64-encoded-file-data",
  "author": "Dr. Smith",
  "source": "Medical School Lectures"
}
```

##### GET `/api/resources/search`
Search for educational resources.

**Query Parameters**:
- `q`: Search query (required)
- `resourceType`: Filter by type
- `systemCode`: Filter by organ system

##### GET `/api/resources/condition/:conditionId`
Get resources linked to a specific condition.

## Frontend Integration

### Photo Drill Integration

The photo drill automatically uses approved images:

```typescript
import { getImageForCondition } from '@/lib/services/photoManifestService';

// Fetch approved image for a condition
const photo = await getImageForCondition('Atrial Fibrillation', 'ecg');

// photo.imageUrl - URL to approved image (or placeholder if none available)
// photo.educationalCaption - Description
// photo.keyFindings - Array of clinical features
```

**Key Points**:
- Only `approved` images are returned
- Only images marked as `isClinical: true` are used
- Highest quality images are prioritized
- Graceful fallback to placeholders when no approved images exist

### Admin Dashboard

**Location**: `components/admin/MediaApprovalDashboard.tsx`

**Features**:
- Grid view of pending media
- Quality score badges
- One-click approval/rejection
- Detailed view with AI analysis
- Filtering by category
- Real-time statistics

**Usage**:
```tsx
import { MediaApprovalDashboard } from '@/components/admin/MediaApprovalDashboard';

// In admin routes
<Route path="/admin/media" element={<MediaApprovalDashboard />} />
```

## Workflow Guide

### For Content Uploaders

1. **Upload Media**
   - Use the upload interface or API endpoint
   - Provide descriptive filename and tags
   - Link to relevant medical condition (optional)
   - Add educational description

2. **Automatic Processing**
   - Image is optimized and stored
   - AI analyzes quality and clinical relevance
   - Quality score is calculated
   - High-quality images (score >= 70) are auto-approved
   - Others go to pending for manual review

3. **Result**
   - Auto-approved: Immediately available for use
   - Pending: Awaits admin review
   - You receive feedback on quality issues

### For Approvers/Admins

1. **Access Dashboard**
   - Navigate to `/admin/media`
   - View pending media queue

2. **Review Media**
   - Click on any image to view details
   - Check AI quality assessment
   - Review clinical features identified
   - Examine any issues or recommendations

3. **Make Decision**
   - **Approve**: Image moves to "use folder" (approved status)
   - **Reject**: Provide reason, image moves to rejected status
   - Approved images are immediately available to users

4. **Monitor Stats**
   - Track approval rates
   - Identify quality trends
   - Manage pending queue

## Quality Standards

### Automatic Approval Criteria

An image is automatically approved if ALL of the following are met:
- Quality score >= 70
- No technical issues (resolution, format, size)
- Marked as clinical by AI
- AI recommends "approve"

### Manual Review Triggers

Images require manual review if:
- Quality score < 70
- Technical issues detected (low resolution, wrong format)
- AI is uncertain about clinical relevance
- AI recommends "review"

### Rejection Reasons

Common rejection reasons:
- Poor image quality (blurry, pixelated)
- Not clinically relevant
- Duplicate image
- Wrong category
- Copyright concerns
- Insufficient resolution
- Contains patient identifiable information

## Performance Optimization

### Image Optimization

All uploaded images are automatically:
- Resized to max 1920px width (maintaining aspect ratio)
- Compressed using JPEG quality 85
- Converted to progressive JPEG for faster loading

### Thumbnail Generation

Thumbnails are generated for:
- Approved images (300px width)
- Used in grid views and previews
- Cached for fast loading

### Database Indexes

Optimized queries with indexes on:
- `approvalStatus` - Fast filtering of pending/approved media
- `qualityScore` - Prioritizing high-quality images
- `conditionId` - Quick lookup by condition
- `tags` - Searchable tagging
- `approvedAt` - Chronological sorting

### Caching Strategy

1. **Media URLs**: Cached for 1 hour (3600s)
2. **Approved Media Lists**: Query results cached
3. **Thumbnails**: Aggressive caching, rarely change

## Cost Optimization

### Reducing API Usage

1. **Auto-Approval**: 60-70% of high-quality images approved automatically
2. **Reuse**: Same image used across multiple users
3. **Thumbnails**: Lower bandwidth for previews
4. **Optimization**: Smaller file sizes reduce storage costs

### Storage Optimization

1. **Optimization**: All images compressed before storage
2. **Thumbnails**: Separate lower-resolution versions
3. **Cleanup**: Rejected images can be purged after review period

## Security Considerations

### Upload Validation

- File type validation (only images)
- Size limits enforced (max 10MB)
- Malware scanning (TODO: integrate antivirus)

### Access Control

- Upload: Authenticated users only
- Approval: Admin role required
- Public access: Only approved images

### Data Privacy

- No patient identifiable information in images
- Images reviewed before public use
- Audit trail of all approvals/rejections

## Troubleshooting

### Issue: Images not appearing in photo drill

**Check**:
1. Is image approved? (`approvalStatus = 'approved'`)
2. Is image marked as clinical? (`isClinical = true`)
3. Is image linked to correct condition?
4. Check browser console for errors

### Issue: Auto-approval not working

**Check**:
1. Quality score >= 70?
2. No technical issues in assessment?
3. AI recommendation is "approve"?
4. Image meets minimum resolution requirements?

### Issue: Upload failing

**Check**:
1. File size < 10MB?
2. Supported format (JPEG, PNG, WebP)?
3. Valid base64 encoding?
4. Supabase storage bucket configured?

## Future Enhancements

### Planned Features

1. **Version Control**: Track image updates over time
2. **Collaborative Review**: Multiple approvers, voting system
3. **Advanced Search**: AI-powered image similarity search
4. **Bulk Operations**: Approve/reject multiple images at once (partially implemented)
5. **Quality Trends**: Analytics on upload quality over time
6. **Auto-Tagging**: AI-powered automatic tag generation
7. **Duplicate Detection**: Prevent uploading same image twice
8. **Copyright Verification**: Integration with reverse image search

### Integration Opportunities

1. **PACS Integration**: Direct import from medical imaging systems
2. **Medical Textbook APIs**: Automated textbook content extraction
3. **PubMed Integration**: Link to relevant research papers
4. **Case Libraries**: Integration with medical case repositories

## Dependencies

### Required Packages

To enable all functionality, install:

```bash
npm install sharp  # Image processing
```

### Supabase Setup

Required storage buckets:
- `medical-images` - For clinical images
- `educational-resources` - For PDFs, textbooks, lectures

Bucket configuration:
- Public read access
- Authenticated write access
- Size limits configured

## Migration Guide

### Applying Schema Changes

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Or create migration
npx prisma migrate dev --name add_media_approval_system
```

### Migrating Existing Media

For existing media without approval status:

```typescript
// Script to update existing media
await prisma.mediaAsset.updateMany({
  where: { approvalStatus: null },
  data: {
    approvalStatus: 'pending',
    isClinical: false,
  },
});
```

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review service logs for errors
3. Check Supabase dashboard for storage issues
4. Verify environment variables are set correctly

## Changelog

### Version 1.0 (December 2024)
- Initial implementation
- AI-powered quality assessment
- Approval workflow
- Admin dashboard
- Educational resource processing
- API endpoints for all operations
