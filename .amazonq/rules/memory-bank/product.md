# PANaCEa - Product Overview

## Project Purpose

PANaCEa is an AI-powered medical education platform designed specifically for Physician Assistant (PA) students preparing for their PANCE (Physician Assistant National Certifying Exam) and PANRE (Physician Assistant National Recertifying Exam) board exams. The platform combines cutting-edge artificial intelligence with proven spaced repetition algorithms to create a personalized, adaptive learning experience.

## Value Proposition

- **90% Cost Reduction**: Hybrid Content Engine reduces AI generation costs from $7,300/year to $730/year through intelligent caching
- **40-100x Faster**: Question delivery optimized from 2-5 seconds to 50ms through staging lake architecture
- **Database-First Architecture**: PostgreSQL as single source of truth for all medical content (2195+ conditions)
- **Quality Control**: Staging lake validates all AI-generated questions before reaching users
- **No-Repeat Logic**: Smart question delivery ensures users never see the same question twice

## Key Features

### Core Learning Systems
- **AI-Generated Questions**: Clinical scenarios powered by Google Gemini API with contextual vignettes
- **FSRS v5 Spaced Repetition**: Adaptive learning algorithm with user-specific parameter tuning
- **Gamified Training Modes**: Photo Drill, Rapid Recall, DDx Compare, Virtual Patient Encounters
- **Analytics Dashboard**: Performance tracking across all PANCE organ systems with visual insights
- **PWA Support**: Progressive web app with offline study capabilities

### Intelligence Layer
- **Gemini Live Integration**: Real-time AI tutoring and clinical reasoning support
- **Clinical Eye**: Visual diagnostic training with medical imaging analysis
- **Knowledge Cache**: Intelligent content caching for instant retrieval
- **Visualizer**: Interactive medical concept visualization
- **Podcast Generation**: Audio learning content for commuter mode

### Content Management
- **Hybrid Content Engine**: Combines AI generation with quality-controlled staging
- **Pearl Harvester**: Automatic extraction of clinical pearls from explanations
- **Vignette Permutation Storage**: Dynamic question generation from templates
- **Medical Content Validation**: Automated quality checks and clinical fidelity audits

### Advanced Features
- **Virtual OSCE**: Interactive clinical case simulations with AI patient encounters
- **Adaptive Difficulty**: Dynamic question difficulty based on performance patterns
- **Circadian Analytics**: Study pattern optimization based on user chronotype
- **Metacognition Engine**: Self-assessment calibration and judgment of learning tracking
- **Rolling 360 Statistics**: Comprehensive performance analytics over time

## Target Users

### Primary Audience
- **PA Students**: Currently enrolled in Physician Assistant programs preparing for PANCE
- **Practicing PAs**: Certified PAs preparing for PANRE recertification
- **Medical Educators**: Faculty using the platform for curriculum development

### User Needs Addressed
- Comprehensive PANCE/PANRE exam preparation aligned with NCCPA blueprint
- Personalized learning paths based on individual performance and weak areas
- Efficient study time management through spaced repetition
- Clinical reasoning development through case-based scenarios
- Performance tracking and progress visualization

## Use Cases

### Study Session Workflows
1. **Adaptive Quiz Mode**: AI-generated questions based on user performance history
2. **Drill Training**: Focused practice on specific organ systems or conditions
3. **Photo Drill**: Visual diagnostic training with medical images
4. **DDx Comparison**: Differential diagnosis training with contrastive learning
5. **Virtual Patient Encounters**: Full clinical case simulations with SOAP notes

### Content Discovery
- Browse 2195+ medical conditions organized by PANCE organ systems
- Search drug database with brand/generic names and clinical applications
- Access lab test interpretations with sensitivity/specificity data
- Review clinical pearls and high-yield board facts

### Performance Analytics
- Track accuracy trends across organ systems
- Identify weak areas requiring additional study
- Monitor FSRS retention metrics and optimal review timing
- Export study data for external analysis

### Collaboration Features
- Peer validation of question quality
- Community-contributed clinical pearls
- Shared study sessions and leaderboards
- Faculty oversight and curriculum alignment

## Technical Differentiators

- **Edge Computing**: Cloudflare Pages Functions for global low-latency delivery
- **Database-First**: No static JSON files - all content in PostgreSQL with Prisma ORM
- **Type Safety**: Full TypeScript implementation with strict mode enabled
- **Modern Stack**: React 19, Vite, TailwindCSS, Framer Motion
- **Security**: Clerk authentication, CSP headers, rate limiting on AI endpoints
- **Testing**: Comprehensive E2E tests with Playwright, unit tests with Vitest
