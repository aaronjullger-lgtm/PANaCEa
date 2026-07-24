# PANaCEa Documentation Index

Welcome to the PANaCEa documentation! This index helps you quickly find the information you need.

---

## 📚 Quick Navigation

### For New Developers

1. **[Quick Start Guide](guides/QUICK_START.md)** - Get up and running in minutes
2. **[Developer Guide](guides/DEVELOPER_GUIDE.md)** - Comprehensive development guide
3. **[Architecture Overview](architecture/)** - Understand the system design

### For Deployment

1. **[Cloudflare Deployment Guide](deployment/CLOUDFLARE_DEPLOYMENT.md)** - Deploy to Cloudflare Pages
2. **[Production Checklist](deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md)** - Pre-deployment verification
3. **[Environment Setup](deployment/CLOUDFLARE_ENV_SETUP.md)** - Configure environment variables

### For Feature Development

1. **[Implementation Guides](implementation/)** - Feature-specific implementation docs
2. **[Database Implementation](guides/DATABASE_IMPLEMENTATION.md)** - Database architecture
3. **[Search Engine](guides/SEARCH_ENGINE_UPGRADE.md)** - Search functionality

### For API Surface

1. **[API Overview](api/API_OVERVIEW.md)** - Current request/response contracts for updated endpoints

---

## 🏗️ Architecture

Learn about PANaCEa's system design:

- **[Pillar Architecture](architecture/PILLAR_ARCHITECTURE.md)** - High-level system design
- **[Database-First Architecture](architecture/DATABASE_FIRST_ARCHITECTURE.md)** - Database-centric approach
- **[Registry-First Architecture](architecture/REGISTRY_FIRST_ARCHITECTURE.md)** - Registry system design
- **[Hybrid Content Engine](architecture/HYBRID_CONTENT_ENGINE.md)** - Content delivery system

---

## 🔌 API

Backend endpoint contracts and API behavior docs:

- **[API Overview](api/API_OVERVIEW.md)** - Staging lake and admin review contracts (`/api/questions/staging/*`, `/api/admin/staging/*`) plus shared AI Gateway routing notes

---

## 🚀 Deployment

Deploy and maintain PANaCEa in production:

### Cloudflare Platform

- **[Cloudflare Deployment](deployment/CLOUDFLARE_DEPLOYMENT.md)** - Main deployment guide
- **[Cloudflare Functions Guide](deployment/CLOUDFLARE_FUNCTIONS_GUIDE.md)** - Serverless functions
- **[Cloudflare Setup](deployment/CLOUDFLARE_SETUP.md)** - Initial setup
- **[Environment Variables](deployment/CLOUDFLARE_ENV_SETUP.md)** - Configuration
- **[Secrets vs Env Vars](deployment/CLOUDFLARE_SECRETS_VS_ENV_VARS.md)** - Security best practices

### Production

- **[Production Deployment Checklist](deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md)** - Pre-flight checks
- **[Production Checklist](deployment/PRODUCTION_CHECKLIST.md)** - Ongoing maintenance
- **[Deployment Checklist](deployment/DEPLOYMENT_CHECKLIST.md)** - General deployment
- **[Media Deployment](deployment/DEPLOYMENT_CHECKLIST_MEDIA.md)** - Media assets

### Backend & Database

- **[Database Backend Deployment](deployment/DATABASE_BACKEND_DEPLOYMENT.md)** - Database setup
- **[Cloud Sync](deployment/CLOUD_SYNC_README.md)** - Data synchronization
- **[Media Approval Setup](deployment/SETUP_MEDIA_APPROVAL.md)** - Media workflow

---

## 💻 Implementation

Feature-specific implementation guides:

### Core Features

- **[Admin CMS](implementation/ADMIN_CMS_IMPLEMENTATION.md)** - Content management system
- **[Grand Rounds](implementation/GRAND_ROUNDS_IMPLEMENTATION.md)** - Daily challenge feature
- **[Socratic Coaching](implementation/SOCRATIC_COACHING_IMPLEMENTATION.md)** - AI coaching system
- **[Patient Encounters](implementation/PATIENT_ENCOUNTER_ENHANCEMENTS.md)** - Clinical scenarios

### Drill Modes

- **[Drill Enhancements](implementation/DRILL_ENHANCEMENTS_IMPLEMENTATION.md)** - Drill improvements
- **[Drill Setup Quick Start](implementation/DRILL_SETUP_QUICK_START.md)** - Quick setup
- **[Drill Setup Refactor](implementation/DRILL_SETUP_REFACTOR_GUIDE.md)** - Architecture refactor
- **[DrillShell Migration](implementation/DRILLSHELL_MIGRATION.md)** - Shell component migration

---

## 📖 Guides

User and developer guides:

### Developer Guides

- **[Developer Guide](guides/DEVELOPER_GUIDE.md)** - Main development guide
- **[Developer Quick Start (Phase 3.5)](guides/DEVELOPER_QUICK_START_PHASE_3_5.md)** - Quick start
- **[Quick Start](guides/QUICK_START.md)** - General quick start

### Feature Guides

- **[Gamification Guide](guides/GAMIFICATION_GUIDE.md)** - Achievements & streaks
- **[Diagnostic Drill Hub](guides/DIAGNOSTIC_DRILL_HUB_GUIDE.md)** - Diagnostic training
- **[Lifelong Navigation](guides/LIFELONG_NAVIGATION_SYSTEM.md)** - Navigation system
- **[Mobile Responsive System](guides/MOBILE_RESPONSIVE_SYSTEM.md)** - Mobile optimization
- **[Multi-System Conditions](guides/MULTI_SYSTEM_CONDITIONS.md)** - Cross-system content

### Database & Content

- **[Database Implementation](guides/DATABASE_IMPLEMENTATION.md)** - Database architecture
- **[Media Approval System](guides/MEDIA_APPROVAL_SYSTEM.md)** - Media workflow
- **[Media Approval Setup](guides/MEDIA_APPROVAL_SETUP.md)** - Setup guide

### Search & UI

- **[Search Engine Upgrade](guides/SEARCH_ENGINE_UPGRADE.md)** - Search improvements
- **[Search Quick Reference](guides/SEARCH_QUICK_REFERENCE.md)** - Search API
- **[Site Organization](guides/SITE_ORGANIZATION_IMPROVEMENTS.md)** - UI organization

---

## 🔒 Security

Security and authentication:

- **[Security Headers](security/SECURITY_HEADERS.md)** - CSP and security headers
- **[Security TODO](security/SECURITY_TODO.md)** - Security checklist
- **[Supabase-Clerk Integration](security/SUPABASE_CLERK_INTEGRATION.md)** - Auth integration
- **[Supabase Setup](security/SUPABASE_SETUP.md)** - Database security

---

## 📦 Archive

Historical and deprecated documentation:

- **[Archive Folder](archive/)** - Older planning docs, migration notes, and completed improvements

---

## 🔍 Finding What You Need

### By Topic

- **Getting Started** → `guides/QUICK_START.md`
- **Architecture** → `architecture/`
- **Deployment** → `deployment/CLOUDFLARE_DEPLOYMENT.md`
- **Features** → `implementation/`
- **Security** → `security/`
- **Database** → `guides/DATABASE_IMPLEMENTATION.md`
- **Search** → `guides/SEARCH_ENGINE_UPGRADE.md`

### By Role

- **New Developer** → Start with `guides/QUICK_START.md`
- **DevOps** → See `deployment/` folder
- **Product Manager** → See `implementation/` for features
- **Security Engineer** → See `security/` folder

---

## 📝 Contributing to Docs

When adding new documentation:

1. **Choose the right folder:**
   - `architecture/` - System design documents
   - `api/` - Endpoint contracts and request/response references
   - `deployment/` - Production and hosting guides
   - `implementation/` - Feature implementation docs
   - `guides/` - User and developer guides
   - `security/` - Security and auth docs
   - `archive/` - Deprecated/historical docs

2. **Use descriptive filenames:**
   - UPPERCASE_WITH_UNDERSCORES.md
   - Prefix with category (e.g., `CLOUDFLARE_*.md`)

3. **Update this index:**
   - Add new docs to appropriate section
   - Keep alphabetical order within sections

4. **Cross-reference:**
   - Link to related docs
   - Use relative paths: `[Link](../folder/FILE.md)`

---

**Last Updated:** December 25, 2025  
**Total Documents:** ~80 organized files
