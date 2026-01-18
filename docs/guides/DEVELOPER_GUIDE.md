# PANaCEa Developer Guide

This guide will help you understand the PANaCEa codebase and contribute effectively.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Key Technologies](#key-technologies)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Building & Deployment](#building--deployment)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)

## Architecture Overview

PANaCEa is a medical education platform built with:

- **Frontend**: React 19 with TypeScript, Vite, TailwindCSS
- **Backend**: Express.js (Node.js)
- **Authentication**: Clerk
- **Database**: PostgreSQL with Prisma ORM (optional for development)
- **AI**: Google Gemini API for question generation
- **Animations**: Framer Motion

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│           Frontend (React + Vite)           │
│  - Components (UI)                          │
│  - Pages (Routes)                           │
│  - Hooks (State Management)                 │
│  - Services (API Calls)                     │
└─────────────┬───────────────────────────────┘
              │
              │ HTTP/REST
              │
┌─────────────▼───────────────────────────────┐
│        Backend (Express Server)             │
│  - API Endpoints                            │
│  - Authentication Middleware                │
│  - Rate Limiting                            │
│  - Gemini API Proxy                         │
└─────────────┬───────────────────────────────┘
              │
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────┐         ┌─────▼──────┐
│Database│         │ Gemini API │
│(Prisma)│         │            │
└────────┘         └────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (optional for local development)
- Clerk account
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your keys:
   - `VITE_CLERK_PUBLISHABLE_KEY` - Frontend authentication
   - `CLERK_SECRET_KEY` - Backend authentication
   - `GEMINI_API_KEY` - AI question generation
   - `DATABASE_URL` - **REQUIRED** for database-driven content

4. Generate Prisma Client:

   ```bash
   npm run db:generate
   ```

5. Start BOTH development servers (required):

   ```bash
   npm run dev:all
   ```

   **Important:** The app requires both frontend (port 3000) and backend (port 3001) servers to be running.
   Running only `npm run dev` will cause API errors because the backend won't be available.

## Project Structure

```
PANaCEa/
├── components/          # React components
│   ├── admin/          # Admin-only components
│   ├── achievements/   # Achievement system
│   ├── drill/          # Training drill modes
│   ├── modes/          # Special training modes
│   └── ...
├── pages/              # Page-level components
│   ├── admin/         # Admin pages
│   └── conditions/    # Condition-specific pages
├── hooks/              # Custom React hooks
│   ├── game/          # Game logic hooks
│   └── ...
├── lib/                # Utility libraries
│   ├── api/           # API services
│   ├── auth/          # Authentication utilities
│   ├── services/      # Business logic services
│   └── middleware/    # Express middleware
├── data/               # Static data and content
├── pharm/              # Pharmacology data
├── prisma/             # Database schema
├── functions/          # Cloudflare Functions (API endpoints)
├── tests/              # Test files
├── scripts/            # Build and utility scripts
└── server.ts           # Backend Express server
```

## Key Technologies

### Frontend

- **React 19**: UI framework with concurrent features
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first CSS framework
- **Framer Motion**: Animation library
- **Clerk**: Authentication provider

### Backend

- **Express**: Web server framework
- **Prisma**: Type-safe ORM
- **PostgreSQL**: Relational database
- **Gemini API**: AI-powered question generation

### Development Tools

- **Vitest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **tsx**: TypeScript execution

## Development Workflow

### Running the App

**⚠️ IMPORTANT: Always use `dev:all` for full functionality**

The application uses a **database-first architecture** that requires both frontend and backend servers:

- **Frontend (Vite)**: Port 3000 - React UI
- **Backend (Express)**: Port 3001 - API endpoints & database queries

**Development (both servers) - RECOMMENDED:**

```bash
npm run dev:all
```

This command starts both servers concurrently. Use this for normal development.

**Frontend only (limited functionality):**

```bash
npm run dev
```

**WARNING**: Running frontend only will cause errors:

- API requests to `/api/content/all` will fail
- Database queries won't work
- You'll see "SyntaxError: Unexpected token '<'" when parsing JSON
- This is because the backend server isn't running to handle API requests

**Backend only (for API development):**

```bash
npm run dev:server
```

### Troubleshooting Common Issues

**Error: "Unexpected token '<' in JSON"**

- **Cause**: Frontend trying to parse HTML instead of JSON from API
- **Solution**: Start backend server with `npm run dev:all`

**Error: "Failed to fetch from /api/content/all"**

- **Cause**: Backend server not running
- **Solution**: Use `npm run dev:all` instead of `npm run dev`

**Server starts but shows "Database unavailable"**

- **Cause**: DATABASE_URL not configured or database not accessible
- **Solution**: Check `.env` file has valid DATABASE_URL

### Code Organization Principles

1. **Component Structure**: Follow atomic design principles
   - Atoms: Basic UI elements (buttons, inputs)
   - Molecules: Simple component groups
   - Organisms: Complex components (modals, forms)
   - Pages: Route-level components

2. **State Management**:
   - Use React hooks for local state
   - Custom hooks for shared logic
   - Context for global state (auth, theme)
   - No external state management library (Redux, etc.)

3. **Styling**:
   - Use TailwindCSS utility classes
   - CSS variables for theming
   - Framer Motion for animations
   - Consistent spacing and colors

4. **Performance**:
   - Lazy load heavy components
   - Code splitting with dynamic imports
   - Memoization with useMemo/useCallback
   - Virtual scrolling for long lists

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place tests next to the code they test
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies

Example:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule';

describe('myFunction', () => {
  it('should return expected result', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

## Building & Deployment

### Production Build

```bash
# Build frontend
npm run build

# Build backend
npm run build:server
```

### Deployment Checklist

- [ ] Update environment variables
- [ ] Run tests
- [ ] Build production bundles
- [ ] Run security scans
- [ ] Update database schema (if needed)
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Verify deployment
- [ ] Monitor for errors

## Common Tasks

### Adding a New Component

1. Create component file in appropriate directory
2. Export component with TypeScript types
3. Add tests if complex logic
4. Update documentation if public API

### Adding a New API Endpoint

1. Add route in `server.ts`
2. Add validation middleware
3. Implement handler function
4. Add error handling
5. Test with Postman/curl
6. Update API documentation

### Adding a New Training Mode

1. Create component in `components/drill/` or `components/modes/`
2. Add mode configuration in `config/training-modes.ts`
3. Add route in `App.tsx`
4. Add navigation handler
5. Test thoroughly

### Updating Database Schema

1. Modify `prisma/schema.prisma`
2. Generate migration:
   ```bash
   npx prisma migrate dev --name description
   ```
3. Update Prisma client:
   ```bash
   npx prisma generate
   ```
4. Update TypeScript types if needed

## Troubleshooting

### Common Issues

**Issue: Backend not starting**

- Check if port 3001 is available
- Verify environment variables are set
- Check for syntax errors in server.ts

**Issue: Frontend can't connect to backend**

- Ensure backend is running on port 3001
- Check proxy configuration in vite.config.ts
- Verify CORS settings in server.ts

**Issue: Build failing**

- Clear cache: `rm -rf node_modules dist && npm install`
- Check for TypeScript errors
- Verify all dependencies are installed

**Issue: Tests failing**

- Update snapshots if UI changed
- Check for async timing issues
- Verify mocks are correct

### Getting Help

1. Check existing documentation
2. Search closed issues on GitHub
3. Ask in team chat
4. Create a new GitHub issue with:
   - Description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

## Best Practices

### Code Quality

- Write self-documenting code
- Add comments for complex logic
- Use TypeScript strictly (no `any`)
- Follow existing patterns
- Keep functions small and focused
- DRY (Don't Repeat Yourself)

### Security

- Never commit secrets
- Validate all user inputs
- Sanitize data before storage
- Use parameterized queries
- Keep dependencies updated
- Run security scans regularly

### Performance

- Lazy load heavy components
- Optimize images
- Minimize bundle size
- Use code splitting
- Cache API responses
- Profile and measure

### Accessibility

- Use semantic HTML
- Add ARIA labels
- Support keyboard navigation
- Ensure sufficient color contrast
- Test with screen readers

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

## License

See [LICENSE](./LICENSE) for license information.
