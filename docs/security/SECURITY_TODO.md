# Security TODOs - Action Required Before Production

## ⚠️ CRITICAL: Admin Authentication Not Enabled

The admin authentication middleware has been created but is **NOT YET APPLIED** to the API routes.

### Current Status

- ✅ Middleware created: `lib/middleware/adminAuth.ts`
- ✅ Token verification implemented
- ✅ Role-based access control ready
- ❌ **NOT applied to routes** (security vulnerability!)

### Action Required

#### 1. Import the middleware in `server.ts`

Add at the top of the file:

```typescript
import { requireAdmin } from './lib/middleware/adminAuth';
```

#### 2. Apply to admin endpoints

**Replace these lines:**

```typescript
// Get pending media (admin-only)
app.get('/api/media/pending', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware
    const pendingHandler = await import('./functions/api/media/pending');
    await pendingHandler.default(req, res);
  } catch (error) {
    // error handling
  }
});
```

**With:**

```typescript
// Get pending media (admin-only)
app.get('/api/media/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pendingHandler = await import('./functions/api/media/pending');
    await pendingHandler.default(req, res);
  } catch (error) {
    // error handling
  }
});
```

#### 3. Apply to all admin routes

Apply `requireAdmin` middleware to these endpoints:

- ✅ `/api/media/pending` - Get pending media
- ✅ `/api/media/approve` - Approve/reject media
- ✅ `/api/media/stats` - Get approval statistics

**Optional:** Apply to upload endpoint (require any authenticated user):

```typescript
import { requireAuth } from './lib/middleware/adminAuth'; // You'll need to create this

app.post('/api/media/upload', requireAuth, async (req, res) => {
  // handler
});
```

### Testing Authentication

After applying middleware:

1. **Test without token (should fail):**

```bash
curl http://localhost:3001/api/media/pending
# Expected: 401 Unauthorized
```

2. **Test with invalid token (should fail):**

```bash
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:3001/api/media/pending
# Expected: 401 Unauthorized
```

3. **Test with valid non-admin token (should fail):**

```bash
curl -H "Authorization: Bearer <valid-user-token>" \
  http://localhost:3001/api/media/pending
# Expected: 403 Forbidden
```

4. **Test with valid admin token (should succeed):**

```bash
curl -H "Authorization: Bearer <valid-admin-token>" \
  http://localhost:3001/api/media/pending
# Expected: 200 OK with data
```

### Why This Wasn't Applied Automatically

Authentication was left as a TODO to allow you to:

1. Test the functionality without auth during development
2. Configure Clerk properly before enforcement
3. Set up admin users with correct roles
4. Choose when to enable the security layer

### Development Mode

For local development, you can use the dev bypass:

In `.env`:

```bash
NODE_ENV=development
BYPASS_AUTH=true  # WARNING: NEVER set this in production!
```

Then import the dev version:

```typescript
import { requireAdminDev } from './lib/middleware/adminAuth';
app.get('/api/media/pending', requireAdminDev, async (req, res) => {
  // handler
});
```

This will bypass auth checks in development only.

### Production Checklist

Before deploying to production:

- [ ] Import `requireAdmin` in `server.ts`
- [ ] Apply to all admin endpoints
- [ ] Remove or comment out TODO comments
- [ ] Test with valid admin token
- [ ] Test with non-admin token (verify rejection)
- [ ] Test without token (verify rejection)
- [ ] Ensure `BYPASS_AUTH` is NOT set in production `.env`
- [ ] Verify `NODE_ENV=production` in production
- [ ] Set up admin users with `role: "admin"` in Clerk metadata
- [ ] Test end-to-end approval workflow
- [ ] Monitor logs for authentication failures

### Additional Security Measures

Consider implementing:

1. **Request logging:**
   - Log all admin actions
   - Track who approved/rejected what
   - Monitor suspicious activity

2. **Rate limiting per user:**
   - Currently limited by IP
   - Consider per-user rate limits
   - Prevent abuse

3. **Audit trail:**
   - Already implemented in database
   - Review regularly
   - Alert on suspicious patterns

4. **Session timeout:**
   - Configure in Clerk
   - Force re-authentication after timeout
   - Recommended: 24 hours

5. **Two-factor authentication:**
   - Enable in Clerk for admin users
   - Require for sensitive operations
   - Recommended for production

### Resources

- [Clerk Authentication Docs](https://clerk.com/docs/authentication)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

**Status:** ⚠️ **ACTION REQUIRED** - Apply middleware before production deployment

**Priority:** 🔴 **CRITICAL** - Security vulnerability if not addressed

**Estimated Time:** 5 minutes to apply, 10 minutes to test

**Last Updated:** December 8, 2024
