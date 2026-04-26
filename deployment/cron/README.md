# Retired Local Cron Surface

Local machine cron is no longer the supported scheduler for PANaCEa.

Recurring automation is now owned by GitHub Actions and documented in:

- [`docs/automation/README.md`](../../docs/automation/README.md)

This directory remains only to document that the historical cron-based path has been retired. Do not install new recurring jobs from `deployment/cron/`.

```bash
# Add to crontab
PATH=/usr/local/bin:/usr/bin:/bin
```

2. **Environment variables are loaded:**

   ```bash
   # Option 1: Use .env file (if supported)
   0 0 * * * cd /opt/PANaCEa && source .env && npx tsx scripts/scheduleJobs.ts

   # Option 2: Set in crontab header
   DATABASE_URL=postgresql://...
   GEMINI_API_KEY=...
   ```

## Troubleshooting

### Jobs Not Running?

1. **Check cron daemon is running:**

   ```bash
   sudo systemctl status cron  # Debian/Ubuntu
   sudo systemctl status crond # RHEL/CentOS
   ```

2. **Verify crontab syntax:**

   ```bash
   crontab -l
   ```

3. **Check logs for errors:**

   ```bash
   tail -50 /opt/PANaCEa/logs/scheduler.log
   ```

4. **Test job manually:**
   ```bash
   cd /opt/PANaCEa && npx tsx scripts/scheduleJobs.ts
   ```

### Permission Issues?

Ensure the cron user can access:

- Application directory
- Log directory
- Database (via DATABASE_URL)

```bash
# Set proper ownership
sudo chown -R panacea:panacea /opt/PANaCEa

# Make logs writable
chmod 755 /opt/PANaCEa/logs
```

## Alternative: Using systemd Timers

For modern Linux systems, consider using systemd timers instead of cron:

```bash
# See deployment/systemd/ for timer examples
sudo cp deployment/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable panacea-scheduler.timer
sudo systemctl start panacea-scheduler.timer
```
