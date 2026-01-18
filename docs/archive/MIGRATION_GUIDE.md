# Data Migration Guide

This guide explains how existing users can migrate their local progress data to their new cloud account.

## Overview

If you've been using PANaCEa before the authentication update, all your progress is stored locally in your browser's localStorage. When you sign in for the first time, we'll automatically migrate this data to your new cloud account so you don't lose any progress.

## Automatic Migration

When you sign in for the first time:

1. **All your existing data is preserved** - Nothing is deleted from localStorage
2. **Data is automatically uploaded** to your cloud account
3. **Sync begins immediately** - Future progress syncs automatically
4. **You can study offline** - Data syncs when you're back online

## What Gets Migrated?

The following data is migrated to your cloud account:

- ✅ **Performance Records**: All your quiz history and scores
- ✅ **Missed Questions**: Questions you got wrong (for review)
- ✅ **Flagged Questions**: Questions you marked for later review
- ✅ **SRS Data**: Spaced repetition schedules
- ✅ **Study Streaks**: Your learning progress

## Migration Process

### Step 1: Sign In

1. Open PANaCEa
2. Click the "Sign In" button in the menu
3. Create a new account or sign in with an existing one

### Step 2: Automatic Upload

Once signed in:

- Your local data is automatically uploaded to the cloud
- You'll see a "Syncing..." indicator
- When complete, you'll see "Synced" with a cloud icon

### Step 3: Verify

To verify your data was migrated:

1. Check your Analytics Dashboard
2. Your performance history should show all previous sessions
3. Missed/Flagged questions should appear in their respective sections

## Using Multiple Devices

After migration, you can study on multiple devices:

1. **First Device (already migrated)**:
   - Continue studying as normal
   - Changes sync automatically

2. **New Device**:
   - Sign in with the same account
   - Your data downloads automatically
   - Start studying with all your progress intact

## Troubleshooting

### "Data not syncing"

If your data doesn't appear to sync:

1. **Check your connection**: Ensure you're online
2. **Refresh the page**: Sometimes a reload helps
3. **Check sync status**: Look for the cloud icon in the menu
4. **Force sync**: Sign out and sign back in

### "Lost some progress"

If some data seems missing:

1. **Check localStorage**: Your data is still saved locally
2. **Force upload**: Sign out, then sign back in to trigger upload
3. **Check multiple browsers**: Ensure you're in the same browser where you studied

### "Can't sign in"

If you have trouble signing in:

1. **Check your email**: Look for verification emails
2. **Try another method**: Use Google sign-in if email doesn't work
3. **Clear cookies**: Sometimes browser state interferes
4. **Contact support**: See below for help

## Data Safety

Your data is protected:

- **Encrypted in transit**: All data uses HTTPS
- **Encrypted at rest**: Database is encrypted
- **No data loss**: LocalStorage backup remains
- **Regular backups**: Cloud database is backed up daily

## Manual Backup (Optional)

If you want to create a manual backup before migrating:

1. Open browser DevTools (F12)
2. Go to Application > Local Storage
3. Find these keys:
   - `panceai_performance_v2`
   - `panceai_missed_v2`
   - `panceai_flagged_v2`
   - `panacea_srs_items`
4. Copy each value to a text file
5. Save in a safe location

To restore from manual backup:

1. Open DevTools
2. Go to Application > Local Storage
3. Create or update the keys with your saved values
4. Refresh the page

## FAQ

**Q: Will I lose my data if I sign out?**
A: No! Your data is saved both locally and in the cloud. Signing out doesn't delete anything.

**Q: Can I use PANaCEa without an account?**
A: Yes! The app still works without signing in. Your data stays in localStorage (browser only).

**Q: What happens if I clear my browser data?**
A: If signed in, your data is safe in the cloud. If not signed in, you'll lose your localStorage data.

**Q: Can I merge data from multiple devices?**
A: Currently, the system keeps the most recent data. Merging is not fully supported yet.

**Q: Is my progress data private?**
A: Yes! Your data is only accessible by you. Even our team can't see your individual responses.

**Q: Can I delete my account?**
A: Yes. Contact support or use the account deletion feature in your profile settings.

**Q: Do I need to stay signed in?**
A: No. You can sign out and continue studying. Data syncs next time you sign in.

## Support

If you encounter issues during migration:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [Authentication Setup Guide](./AUTHENTICATION_SETUP.md)
3. Check browser console for error messages
4. Create an issue on GitHub with:
   - Browser and version
   - Error messages
   - Steps to reproduce

## Privacy Note

We take your data privacy seriously:

- ✅ Data is encrypted in transit and at rest
- ✅ No personal study information is shared
- ✅ You can export your data anytime
- ✅ You can delete your account anytime
- ✅ No third-party analytics on your study patterns

## Technical Details

For developers interested in the migration process:

- Migration happens in `useUserStats` hook
- Data is POSTed to `/api/sync` endpoint
- Merge strategy: timestamp-based (latest wins)
- LocalStorage remains as offline fallback
- Automatic retry on failed sync attempts

See the [Technical Implementation](#) for more details.
