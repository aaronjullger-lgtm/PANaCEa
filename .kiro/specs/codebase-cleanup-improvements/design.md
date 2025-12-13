# PANaCEa Codebase Cleanup & Feature Completion - Design Document

## Overview

This design document outlines the technical approach for implementing critical security fixes, type safety improvements, and completing unfinished features in the PANaCEa medical education platform. The design prioritizes security hardening while maintaining backward compatibility and improving developer experience.

## Architecture

### Current State Analysis

The PANaCEa application follows a modern full-stack architecture:
- **Frontend**: React 19 with TypeScript, Vite build system
- **Backend**: Express.js server with Cloudflare Functions for API endpoints
- **Database**: Supabase (PostgreSQL) with Prisma ORM
- **Authentication**: Clerk with JWT token verification
- **AI Integration**: Google Gemini API for content generation

### Key Architectural Concerns

1. **Security Gap**: Admin endpoints lack proper authentication middleware
2. **Type Safety**: Extensive use of `any` types in critical paths
3. **Logging**: Excessive debug output in production code
4. **Feature Incompleteness**: Several partially implemented features

## Components and Interfaces

### 1. Admin Authentication Middleware

```typescript
// lib/middleware/adminAuth.ts
export interface AdminAuthContext extends AuthContext {
  userId: string;
  clerkId: string;
  role: 'admin' | 'superadmin';
  permissions: string[];
}

export interface AdminMiddlewareOptions {
  requiredRole?: 'admin' | 'superadmin';
  requiredPermissions?: string[];
  auditLog?: boolean;
}
```

### 2. Enhanced Type Definitions

```typescript
// Enhanced API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Gemini service types
export interface GeminiRequestOptions {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  temperature?: number;
  maxTokens?: number;
}

export interface PatientSimulatorCase {
  caseId: string;
  patientData: PatientData;
  scenario: ClinicalScenario;
  expectedFindings: MedicalFindings;
}
```

### 3. Todoist Integration Service

```typescript
// services/todoistIntegration.ts
export interface TodoistExportOptions {
  includeStudyPlan: boolean;
  includeMissedQuestions: boolean;
  includeUpcomingReviews: boolean;
  exportFormat: 'oauth' | 'csv';
}

export interface TodoistOAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}
```

### 4. Structured Logging System

```typescript
// lib/logging/structuredLogger.ts
export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  userId?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityAuditLog extends LogEntry {
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
}
```

## Data Models

### Admin Role Management

```typescript
// Extend existing User model in Prisma schema
model User {
  // ... existing fields
  role: String @default("user") // user, admin, superadmin
  permissions: String[] @default([]) // granular permissions
  lastAdminAction: DateTime?
  adminAuditLogs: AdminAuditLog[]
}

model AdminAuditLog {
  id: String @id @default(uuid())
  userId: String
  action: String // "media_approve", "content_edit", etc.
  resource: String // resource identifier
  outcome: String // "success", "failure", "blocked"
  metadata: Json? // additional context
  ipAddress: String?
  userAgent: String?
  timestamp: DateTime @default(now())
  
  user: User @relation(fields: [userId], references: [id])
  
  @@index([userId, timestamp])
  @@index([action])
}
```

### Todoist Integration Data

```typescript
model TodoistIntegration {
  id: String @id @default(uuid())
  userId: String @unique
  accessToken: String? // encrypted OAuth token
  refreshToken: String? // encrypted refresh token
  projectId: String? // Todoist project for PANaCEa tasks
  lastSync: DateTime?
  syncEnabled: Boolean @default(false)
  preferences: Json? // export preferences
  
  user: User @relation(fields: [userId], references: [id])
  
  @@index([userId])
}
```

## Implementation Strategy

### Phase 1: Critical Security Fixes (Week 1)

#### 1.1 Admin Authentication Middleware
- Create `lib/middleware/adminAuth.ts` with role-based access control
- Implement JWT verification with admin role checking
- Add audit logging for all admin actions
- Apply middleware to existing unprotected endpoints

#### 1.2 Immediate Security Hardening
- Protect `/api/media/pending`, `/api/media/approve`, `/api/media/stats`
- Add rate limiting to admin endpoints
- Implement IP allowlisting for super-admin operations

### Phase 2: Type Safety Enhancement (Week 1-2)

#### 2.1 Critical Path Type Fixes
- Replace `any` types in `functions/api/_shared/auth.ts`
- Update `services/geminiService.ts` with proper interfaces
- Fix type safety in `server.ts` error handlers
- Create comprehensive type definitions for API responses

#### 2.2 Service Layer Type Safety
- Update all service functions to use specific types
- Create proper interfaces for external API responses
- Add type guards for runtime type checking

### Phase 3: Feature Completion (Week 2-3)

#### 3.1 Todoist Integration
- Implement OAuth flow with Todoist API
- Create CSV export functionality
- Build user interface for export preferences
- Add background sync capabilities

#### 3.2 Educational Resource Processing
- Replace AI vision with `pdf-parse` library
- Implement proper text extraction pipeline
- Add content indexing and search capabilities
- Create batch processing for existing PDFs

### Phase 4: Production Optimization (Week 3-4)

#### 4.1 Logging Cleanup
- Implement structured logging system
- Remove debug console statements
- Add production monitoring hooks
- Create log aggregation and alerting

#### 4.2 Performance Improvements
- Optimize database queries in admin endpoints
- Add caching for frequently accessed admin data
- Implement connection pooling optimizations

## Error Handling

### Admin Authentication Errors
```typescript
export enum AdminAuthError {
  INSUFFICIENT_PRIVILEGES = 'INSUFFICIENT_PRIVILEGES',
  INVALID_ADMIN_TOKEN = 'INVALID_ADMIN_TOKEN',
  ADMIN_ACCOUNT_SUSPENDED = 'ADMIN_ACCOUNT_SUSPENDED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}
```

### Type Safety Error Prevention
- Implement runtime type validation using Zod schemas
- Add comprehensive error boundaries in React components
- Create type-safe API client with automatic error handling

### Integration Error Handling
- Graceful fallbacks for Todoist API failures
- Retry mechanisms for PDF processing
- User-friendly error messages for all operations

## Testing Strategy

### Unit Testing
- Test admin middleware with various role combinations
- Validate type safety improvements with TypeScript compiler
- Test Todoist integration with mock API responses
- Verify PDF processing with sample documents

### Integration Testing
- End-to-end admin workflow testing
- Authentication flow validation
- API endpoint security testing
- Cross-browser compatibility for new features

### Security Testing
- Penetration testing of admin endpoints
- JWT token validation testing
- Role escalation prevention testing
- Rate limiting effectiveness testing

## Deployment Strategy

### Rollout Plan
1. **Security Fixes**: Deploy admin middleware immediately to staging
2. **Type Safety**: Gradual rollout with feature flags
3. **New Features**: Beta testing with select users
4. **Production**: Phased deployment with monitoring

### Monitoring and Alerting
- Admin action monitoring and alerting
- Type error tracking in production
- Integration failure notifications
- Performance metric tracking

### Rollback Strategy
- Feature flags for quick disabling of new functionality
- Database migration rollback procedures
- API versioning for backward compatibility
- Automated health checks and rollback triggers