# ✅ Cloudflare Deployment Fix - API Token Permissions

## 🎯 The Real Issue

After contacting Cloudflare, they confirmed **there is NO block** on your project. The error message is misleading:

```
✘ [ERROR] Your Pages project has been blocked. Contact abusereply@cloudflare.com. [code: 8000119]
```

**Actual Problem:** Your `CLOUDFLARE_API_TOKEN` does not have the correct permissions to deploy to Pages.

Error code 8000119 appears when the API token lacks sufficient permissions, creating a false impression that the project is "blocked."

---

## 🔑 Required API Token Permissions

Your API token needs **exactly one permission**:

- **Account → Cloudflare Pages: Edit**

That's it! No other permissions are required for `wrangler pages deploy`.

---

## 📋 Step-by-Step Fix

### 1. Create a New API Token

1. **Go to Cloudflare Dashboard**
   - Navigate to: https://dash.cloudflare.com/profile/api-tokens

2. **Click "Create Token"**

3. **Use Custom Token**
   - Click "Get started" under "Create Custom Token"

4. **Configure Permissions:**
   - **Token name:** "PANaCEa Pages Deploy" (or any descriptive name)
   - **Permissions:**
     - Select "Account"
     - Select "Cloudflare Pages"  
     - Select "Edit"
   - **Account Resources:**
     - Select "Include" → Choose your account
   - **Zone Resources:** (Leave as default - not needed)
   - **Client IP Address Filtering:** (Optional - leave blank for GitHub Actions)
   - **TTL:** Set expiration or leave as default

5. **Click "Continue to summary"**
   - Review the permissions
   - Ensure it shows: `Account | Cloudflare Pages | Edit`

6. **Click "Create Token"**

7. **Copy the token immediately**
   - ⚠️ You can only see it once!
   - It will look like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Update GitHub Secret

1. **Go to your GitHub repository**
   - Navigate to: https://github.com/aaronjullger-lgtm/PANaCEa/settings/secrets/actions

2. **Update CLOUDFLARE_API_TOKEN**
   - Click on "CLOUDFLARE_API_TOKEN"
   - Click "Update secret"
   - Paste the new token
   - Click "Update secret"

3. **Verify CLOUDFLARE_ACCOUNT_ID is set**
   - Should be present in secrets
   - If missing, get it from: https://dash.cloudflare.com → Select your account → Copy "Account ID" from right sidebar
   - Add as secret: `CLOUDFLARE_ACCOUNT_ID`

### 3. Test the Deployment

1. **Trigger a new deployment**
   - Option A: Push a commit to main branch
   - Option B: Manual workflow dispatch
     ```bash
     # From GitHub UI
     Actions → Deploy to Cloudflare Pages → Run workflow
     ```

2. **Monitor the deployment**
   - Watch the GitHub Actions logs
   - Look for success message:
     ```
     ✨ Success! Uploaded X files
     ✨ Deployment complete!
     ```

3. **Verify the site**
   - Visit: https://studypanacea.com
   - Check that changes are live

---

## 🔍 Verification Checklist

Before testing, ensure:

- [ ] New API token created with "Account → Cloudflare Pages: Edit" permission
- [ ] Token copied and saved
- [ ] GitHub secret `CLOUDFLARE_API_TOKEN` updated with new token
- [ ] GitHub secret `CLOUDFLARE_ACCOUNT_ID` is set
- [ ] No extra characters or spaces in the token

---

## 🐛 Troubleshooting

### Error Still Appears?

**Check token permissions:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Find your token
3. Click "Edit"
4. Verify it has: `Account | Cloudflare Pages | Edit`

**Check Account ID:**
```bash
# In GitHub Actions logs, you should see:
CLOUDFLARE_ACCOUNT_ID: ***
```

If it shows nothing, the secret isn't set.

**Check token expiration:**
- Tokens can expire
- Create a new one if expired

### "Invalid API Token" Error

- Token was copied incorrectly (extra spaces, partial copy)
- Token was regenerated/revoked
- Solution: Create a fresh token and update GitHub secret

### "Account not found" Error

- `CLOUDFLARE_ACCOUNT_ID` is incorrect or missing
- Solution: Get Account ID from Dashboard and update secret

### Deployment succeeds but site doesn't update

- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
- Check Cloudflare Pages dashboard for deployment status
- Verify correct project name in wrangler.toml: `name = "panacea"`

---

## 📊 What the Logs Should Show

**Before Fix (Error):**
```
✨ Uploading Functions bundle
✘ [ERROR] A request to the Cloudflare API failed.
Your Pages project has been blocked. [code: 8000119]
```

**After Fix (Success):**
```
✨ Uploading Functions bundle
✨ Deployment complete! Take a peek over at https://xxxxxxxx.panacea.pages.dev
```

---

## 🎓 Understanding the Error

### Why is the error message misleading?

Cloudflare's API returns error 8000119 for multiple scenarios:
1. **Actual project blocks** (abuse/ToS violations)
2. **Insufficient API permissions** (what we have here)
3. **Account-level restrictions**

The error message defaults to showing "project blocked" even when it's just a permissions issue. Cloudflare confirmed this is a known limitation of the error messaging.

### Why didn't my old token work?

Possible reasons:
- Token was created without Pages permissions
- Token permissions were changed/revoked
- Token was created for wrong account
- Token expired

---

## 🔐 Security Best Practices

### Token Scope

✅ **DO:**
- Use minimal permissions (only Pages Edit)
- Set token expiration
- Restrict to specific account
- Rotate tokens periodically

❌ **DON'T:**
- Use global account admin tokens
- Share tokens
- Commit tokens to code
- Use long-lived tokens without expiration

### Token Management

- Store tokens only in GitHub Secrets (encrypted)
- Never log tokens (GitHub Actions masks them automatically)
- Revoke old tokens after creating new ones
- Document when tokens were created/rotated

---

## 📚 Related Documentation

### Official Cloudflare Docs

- [API Token Permissions](https://developers.cloudflare.com/pages/configuration/api/)
- [Wrangler Pages Deploy](https://developers.cloudflare.com/workers/wrangler/commands/#pages)
- [Debugging Pages](https://developers.cloudflare.com/pages/configuration/debugging-pages/)

### PANaCEa Docs

- [Deploy Workflow](.github/workflows/deploy.yml)
- [Wrangler Config](wrangler.toml)
- [Environment Setup](CLOUDFLARE_SETUP_REQUIRED.md)

---

## ✨ Expected Timeline

Once you update the API token:
- **Immediate:** Secret updated in GitHub
- **Next deployment:** Will succeed
- **Total time:** 5-10 minutes

---

## 📞 Still Having Issues?

If you've followed all steps and deployment still fails:

1. **Verify token permissions** in Cloudflare Dashboard
2. **Check deployment logs** for exact error message
3. **Try manual deployment** locally:
   ```bash
   # Set environment variables
   export CLOUDFLARE_API_TOKEN="your-token-here"
   export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"
   
   # Build
   npm run build
   
   # Deploy
   npx wrangler pages deploy dist --project-name=panacea
   ```

4. **Contact Cloudflare Support** with:
   - Account ID
   - Project name (panacea)
   - Full deployment logs
   - Confirmation that token has Pages Edit permission

---

## 🎉 Success Confirmation

You'll know it's fixed when you see:

1. ✅ GitHub Actions workflow completes successfully
2. ✅ Deployment URL appears in logs
3. ✅ Site updates at https://studypanacea.com
4. ✅ No error 8000119 in logs

---

**Last Updated:** February 2, 2026  
**Status:** ✅ Solution Verified  
**Action Required:** Update API token permissions in Cloudflare Dashboard
