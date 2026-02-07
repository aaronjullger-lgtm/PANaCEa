# 🔧 Quick Fix: Database Connection

**Your site is running but can't connect to the database.**  
Here's how to fix it in **5 minutes**:

---

## Option 1: Use Supabase (Recommended)

### Step 1: Get Your Connection String
1. Go to https://app.supabase.com
2. Sign in and select your project
3. Click **Settings** (gear icon)
4. Click **Database**
5. Scroll to **Connection string**
6. Select **Transaction mode**
7. Copy the string that looks like:
   ```
   postgresql://postgres.xxx:[YOUR_PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

### Step 2: Update .env
Replace the `DATABASE_URL` line in your `.env` file with:
```env
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:[YOUR_ACTUAL_PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**IMPORTANT:** Replace `[YOUR_ACTUAL_PASSWORD]` with your database password!

### Step 3: Test Connection
```bash
npx prisma db pull
```

If you see "✓ Introspected schema from database" - it worked!

### Step 4: Restart Servers
```bash
# Stop both servers (Ctrl+C in both terminals)
# Then restart:
npm run dev:server  # Terminal 1
npm run dev         # Terminal 2
```

### Step 5: Verify
```bash
curl http://localhost:3001/health
```

Should show: `"status": "healthy"`

---

## Option 2: Use Prisma Accelerate (Edge Optimized)

### Step 1: Set Up Accelerate
1. Go to https://console.prisma.io
2. Sign in with GitHub
3. Create a new project
4. Enable **Accelerate**
5. Connect your Supabase database
6. Copy the Accelerate connection string:
   ```
   prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY
   ```

### Step 2: Update .env
```env
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=YOUR_ACTUAL_API_KEY
```

### Step 3-5: Same as Option 1

---

## Common Issues

### "Password authentication failed"
- Your password is wrong
- Find password in Supabase: Settings → Database → Reset Password

### "Could not connect to server"
- Check your IP is whitelisted in Supabase
- Go to Settings → Database → Connection Pooler → Enable IPv4
- Or add your IP to Connection Pooler whitelist

### "SSL connection required"
- Add `?sslmode=require` to the end of your connection string:
  ```
  postgresql://...postgres?sslmode=require
  ```

---

## Quick Test

After updating `.env`:

```bash
# Test connection
npx prisma db pull

# Restart backend
npm run dev:server

# Check health
curl http://localhost:3001/health

# Should show "healthy" ✅
```

---

## Need Help?

**Can't find your password?**
1. Supabase dashboard
2. Settings → Database  
3. Click "Reset database password"
4. Copy new password
5. Update `.env`

**Still not working?**
- Check the connection string format exactly matches
- Make sure there are no spaces in the connection string
- Verify the password doesn't have special characters that need escaping

---

**Once the database connects, everything will work!** 🎉
