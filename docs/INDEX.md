# PANaCEa Documentation Index

**Last Updated:** January 10, 2026

This index provides quick navigation to all documentation in the PANaCEa codebase.

---

## 📌 Start Here (Essential Docs)

| Document | Description |
|----------|-------------|
| [MASTER_DOCUMENTATION.md](../MASTER_DOCUMENTATION.md) | Comprehensive project overview |
| [README.md](./README.md) | Documentation folder guide |
| [CRITICAL_FIXES_SPRINT_TRACKER.md](./CRITICAL_FIXES_SPRINT_TRACKER.md) | Current sprint progress |

---

## 🔴 Active Development

### Current Sprints & Plans
- [CRITICAL_FIXES_SPRINT_TRACKER.md](./CRITICAL_FIXES_SPRINT_TRACKER.md) - **Current** security, UX, service consolidation
- [STRATEGIC_10_SPRINT_ROADMAP.md](./STRATEGIC_10_SPRINT_ROADMAP.md) - Long-term roadmap
- [PHASE_2_ROADMAP.md](./PHASE_2_ROADMAP.md) - Phase 2 features

### Sprint Completion Reports
- [SPRINT_1_COMPLETION_SUMMARY.md](./SPRINT_1_COMPLETION_SUMMARY.md)
- [SPRINT_2_COMPLETION_SUMMARY.md](./SPRINT_2_COMPLETION_SUMMARY.md)
- [SPRINT_3_COMPLETION_SUMMARY.md](./SPRINT_3_COMPLETION_SUMMARY.md)
- [SPRINT_4_COMPLETION_SUMMARY.md](./SPRINT_4_COMPLETION_SUMMARY.md)
- [SPRINT_5_COMPLETION_SUMMARY.md](./SPRINT_5_COMPLETION_SUMMARY.md)

---

## 🔧 Technical Guides

### Architecture
- [architecture/](./architecture/) - System architecture docs
- [ARCHITECTURAL_REFACTORING_SUMMARY.md](./ARCHITECTURAL_REFACTORING_SUMMARY.md)
- [ORGANIZATION_SUMMARY.md](../ORGANIZATION_SUMMARY.md)

### Database & Deployment
- [deployment/](./deployment/) - Deployment guides
- [MULTI_REGION_DEPLOYMENT.md](./MULTI_REGION_DEPLOYMENT.md)
- [RLS_IMPLEMENTATION.md](./RLS_IMPLEMENTATION.md)
- [QUERY_OPTIMIZATION_GUIDE.md](./QUERY_OPTIMIZATION_GUIDE.md)

### Security
- [security/](./security/) - Security documentation
- [AUTH_HEADER_AUDIT_REPORT.md](./AUTH_HEADER_AUDIT_REPORT.md)

---

## 📚 Feature Documentation

### Learning Features
- [INTELLIGENT_SESSION_SPRINTS.md](./INTELLIGENT_SESSION_SPRINTS.md) - Adaptive session engine
- [PEARL_HARVESTER_PATTERN.md](./PEARL_HARVESTER_PATTERN.md) - Clinical pearl extraction
- [PEARL_HARVESTER_TESTING.md](./PEARL_HARVESTER_TESTING.md)

### Media & Content
- [MEDIA_INTEGRATION.md](./MEDIA_INTEGRATION.md) - Image/media system
- [PHOTO_DRILL_IMAGE_REQUIREMENTS.md](./PHOTO_DRILL_IMAGE_REQUIREMENTS.md)
- [LAB_MODE_ENHANCEMENT.md](./LAB_MODE_ENHANCEMENT.md)

### Automation
- [AUTOMATION_SETUP_GUIDE.md](./AUTOMATION_SETUP_GUIDE.md)
- [PRODUCTION_READINESS_MASTER_PLAN.md](./PRODUCTION_READINESS_MASTER_PLAN.md)

---

## 📁 Guides

- [guides/](./guides/) - How-to guides
- [features/](./features/) - Feature specifications
- [implementation/](./implementation/) - Implementation details

---

## 🗂️ Archive (Historical)

The `archive/` folder contains 71 historical documents from previous development phases:

### Categories:
- **Sprint Reports:** SPRINT_*_COMPLETE.md, SPRINT_*_SUMMARY.md
- **Implementation Summaries:** IMPLEMENTATION_SUMMARY_*.md, IMPLEMENTATION_COMPLETE_*.md
- **Migration Docs:** MIGRATION_*.md
- **Phase Docs:** PHASE_*_IMPLEMENTATION.md, PHASE_*_SUMMARY.md
- **Performance:** PERFORMANCE_*.md, BUNDLE_OPTIMIZATION.md
- **UI/UX:** UI_*.md, MODAL_SCROLLING_*.md

> 💡 **Tip:** Use grep to search archive: `grep -r "keyword" docs/archive/`

---

## 🛠️ Developer Scripts

Located in `scripts/`:

```bash
# Audits (via npm)
npm run audit:prisma      # Check Prisma disconnect patterns
npm run audit:zod         # Check Zod validation coverage
npm run audit:loading     # Check loading state consistency
npm run audit:services    # Analyze service consolidation
npm run audit:all         # Run all audits

# Database
npm run db:push           # Push schema changes
npm run db:generate       # Generate Prisma client
npm run db:studio         # Open Prisma Studio

# Content
npm run health-check      # Content health check
npm run orchestrate:full  # Full content pipeline
```

---

## Quick Reference

### Key Files
```
.clinerules              # AI coding standards
App.tsx                  # Main React app
functions/api/           # Cloudflare API endpoints
services/                # Business logic services
prisma/schema.prisma     # Database schema
```

### Service Barrel Exports
```typescript
import { questionService, sessionService } from '@/services/core';
import { performanceService, predictionService } from '@/services/analytics';
import { geminiService, virtualPreceptor } from '@/services/ai';
import { fsrsService, examService } from '@/services/domain';
```

---

## Need Help?

1. Check the [MASTER_DOCUMENTATION.md](../MASTER_DOCUMENTATION.md) first
2. Search archive docs: `grep -r "topic" docs/`
3. Review `.clinerules` for coding standards
4. Check [DEBUGGING_SESSION_SUMMARY.md](./DEBUGGING_SESSION_SUMMARY.md) for common issues
