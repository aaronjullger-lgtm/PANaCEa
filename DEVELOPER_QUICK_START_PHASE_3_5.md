# Developer Quick Start: Phase 3-5 Features

## 🚀 Quick Setup (5 Minutes)

### 1. Install Dependencies
```bash
npm install
npx prisma generate
```

### 2. Set Up Database
```bash
# Option A: Use existing DATABASE_URL from .env
# Option B: Set up fresh database
npx prisma migrate dev --name init
```

### 3. Start Development
```bash
# Terminal 1: Frontend + Backend
npm run dev:all

# Terminal 2: Background Worker (optional)
npm run worker
```

### 4. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Prisma Studio: `npx prisma studio`

## 🏗️ Architecture Overview

### Database Models (Key Tables)

```
MedicalContent
├── ContentVersion (1:many)
└── ContentAuditLog (1:many)

BackgroundJob
├── Status: pending/processing/completed/failed
└── Types: generate_questions, health_check, etc.

User
├── Roles: user/viewer/editor/approver/admin/superadmin
└── Relations: Performance, SRS, Achievements
```

### Service Layer

```
lib/services/
├── cms/
│   ├── auditLogger.ts      # Audit trail management
│   └── contentService.ts   # Content lifecycle
├── queue/
│   └── jobQueue.ts         # Background jobs
└── sync/
    └── offlineSync.ts      # Offline resilience
```

### API Endpoints

```
/api/admin/content/
├── list              GET    # List all content
├── [id]              GET    # Get single item
├── [id]              PUT    # Update content
├── [id]              DELETE # Archive content
├── create            POST   # Create draft
└── transition        POST   # Change status

/api/admin/audit/
└── logs              GET    # Get audit logs

/api/admin/health/
└── reports           GET    # Health reports
```

## 📝 Common Development Tasks

### Create New Content (API)

```typescript
// POST /api/admin/content/create
{
  "conditionId": "CV__ecg__my_condition",
  "system": "CV",
  "subcategory": "ECG",
  "condition": "My Condition",
  "content": {
    "overview": "...",
    "symptoms": [...],
    "treatment": [...]
  },
  "description": "Initial creation"
}
```

### Update Content

```typescript
// PUT /api/admin/content/[id]
{
  "content": {
    "overview": "Updated overview...",
    "symptoms": ["symptom1", "symptom2"]
  },
  "description": "Updated overview and symptoms"
}
```

### Transition Status

```typescript
// POST /api/admin/content/transition
{
  "contentId": "uuid-here",
  "newStatus": "pending_review",
  "description": "Ready for review"
}
```

### Query Audit Logs

```typescript
// GET /api/admin/audit/logs?contentId=uuid&format=json
// GET /api/admin/audit/logs?format=csv (download)
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test tests/cms          # CMS tests only
npm test tests/cms/rbac     # RBAC tests only
```

### Test RBAC Permissions
```typescript
import { canEditContent } from './functions/api/_shared/rbac';

canEditContent('viewer')   // false
canEditContent('editor')   // true
canEditContent('admin')    // true
```

### Test State Machine
```typescript
import { transitionStatus } from './lib/services/cms/contentService';

// Valid: draft -> pending_review
await transitionStatus(prisma, contentId, 'pending_review', options);

// Invalid: draft -> published (throws error)
await transitionStatus(prisma, contentId, 'published', options); // ❌
```

## 🔍 Debugging

### View Database
```bash
npx prisma studio
# Opens GUI at http://localhost:5555
```

### Check Job Queue
```sql
SELECT * FROM "BackgroundJob" 
WHERE status = 'pending' 
ORDER BY priority DESC, "scheduledFor" ASC 
LIMIT 10;
```

### Monitor Audit Logs
```sql
SELECT * FROM "ContentAuditLog" 
WHERE "contentId" = 'your-uuid' 
ORDER BY "changedAt" DESC;
```

### Test Offline Sync
```javascript
// In browser console
import { queueOperation, getQueueStatus } from './lib/services/sync/offlineSync';

// Queue an operation
queueOperation('save_progress', { score: 100 });

// Check status
getQueueStatus();
// { total: 1, pending: 1, synced: 0, failed: 0 }
```

## 🛠️ Useful Scripts

### Background Jobs

```bash
# Schedule jobs
npm run schedule

# Process jobs manually
npm run worker

# Run health check
npm run health-check
```

### Database

```bash
# Reset database (WARNING: Deletes all data!)
npx prisma migrate reset

# View migrations
npx prisma migrate status

# Generate Prisma client
npx prisma generate
```

## 🎯 RBAC Quick Reference

### Role Hierarchy
```
user < viewer < editor < approver < admin < superadmin
```

### Permissions Matrix

| Action | User | Viewer | Editor | Approver | Admin | Superadmin |
|--------|------|--------|--------|----------|-------|------------|
| View CMS | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/Edit | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approve | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Publish | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Roles | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Check Permissions

```typescript
import { 
  canViewCMS, 
  canEditContent, 
  canApproveContent, 
  canPublishContent,
  getAllowedOperations 
} from './functions/api/_shared/rbac';

// Check specific permission
if (canEditContent(userRole)) {
  // Allow editing
}

// Get all permissions
const ops = getAllowedOperations(userRole);
console.log(ops);
// {
//   canView: true,
//   canCreate: true,
//   canEdit: true,
//   canApprove: false,
//   ...
// }
```

## 📊 State Machine

### Valid Transitions

```
draft
  ├─> pending_review
  └─> archived

pending_review
  ├─> draft (reject)
  ├─> approved
  └─> archived

approved
  ├─> published
  ├─> draft (revisions)
  └─> archived

published
  ├─> archived
  └─> draft (major revisions)

archived
  └─> draft (restore)
```

### Example Flow

```typescript
// 1. Create draft
const content = await createDraft(prisma, data, options);

// 2. Submit for review
await transitionStatus(prisma, content.id, 'pending_review', options);

// 3. Approve
await transitionStatus(prisma, content.id, 'approved', options);

// 4. Publish
await transitionStatus(prisma, content.id, 'published', options);
```

## 🐛 Common Issues

### Issue: Prisma Client Not Generated
```bash
npx prisma generate
```

### Issue: Database Connection Error
```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

### Issue: Tests Failing
```bash
# Clear cache
rm -rf node_modules/.vite
npm test
```

### Issue: Build Errors
```bash
# Clean and rebuild
rm -rf dist
npm run build
```

## 🔐 Security Best Practices

1. **Never commit `.env` files**
2. **Always validate user roles** before operations
3. **Use audit logging** for all content changes
4. **Validate input** on all API endpoints
5. **Use prepared statements** (Prisma handles this)
6. **Rate limit API calls** (already configured)

## 📚 Additional Resources

- **Main Docs**: `PHASE_3_4_5_IMPLEMENTATION.md`
- **Deployment**: `DEPLOYMENT_GUIDE_PHASE_3_5.md`
- **Schema**: `prisma/schema.prisma`
- **Tests**: `tests/cms/`

## 🎓 Learning Path

### Day 1: Setup & Basics
1. Set up environment
2. Run tests
3. Explore Prisma Studio
4. Test API endpoints with Postman

### Day 2: RBAC & Permissions
1. Review `rbac.ts`
2. Test different user roles
3. Understand permission checks
4. Write custom permission logic

### Day 3: Content Management
1. Study `contentService.ts`
2. Test state machine transitions
3. Review audit logging
4. Create/update content via API

### Day 4: Background Jobs
1. Study `jobQueue.ts`
2. Run background worker
3. Create custom job types
4. Test job scheduling

### Day 5: Integration
1. Connect frontend to new APIs
2. Test complete workflows
3. Review error handling
4. Performance testing

## 💡 Pro Tips

- Use Prisma Studio for quick database inspection
- Keep tests running in watch mode: `npm test -- --watch`
- Use PM2 for local worker management
- Enable database logging for debugging: `DATABASE_LOGGING=true`
- Use `git stash` to quickly switch between features
- Check audit logs frequently during development
- Test with different user roles in different browsers

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Write tests first (TDD)
3. Implement feature
4. Ensure all tests pass: `npm test`
5. Build successfully: `npm run build`
6. Request code review
7. Address feedback
8. Merge when approved

## Need Help?

1. Check documentation in `/docs`
2. Review test files for examples
3. Check Prisma Studio for data
4. Review audit logs for behavior
5. Ask the team!

Happy coding! 🎉
