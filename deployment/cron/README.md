# Cron Job Configuration

This directory contains cron job configurations for scheduled tasks in PANaCEa.

## Scheduled Jobs

### 1. Job Scheduler (Daily at Midnight)

```bash
0 0 * * * cd /opt/PANaCEa && npx tsx scripts/scheduleJobs.ts
```

Schedules background jobs for:

- Question pre-generation (low-traffic hours 2-5 AM)
- Health checks
- System maintenance tasks

### 2. Health Check (Daily at 3 AM)

```bash
0 3 * * * cd /opt/PANaCEa && npx tsx scripts/contentHealthChecker.ts
```

Audits content quality and generates health reports.

### 3. Job Cleanup (Weekly on Sunday at 4 AM)

```bash
0 4 * * 0 cd /opt/PANaCEa && npx tsx scripts/cleanupJobs.ts
```

Removes completed/failed jobs older than 30 days.

## Installation

### Method 1: Direct Installation

```bash
# Edit your crontab
crontab -e

# Copy the relevant lines from panacea.cron and paste them
```

### Method 2: Install from File

```bash
# View current crontab
crontab -l > /tmp/current-crontab

# Append PANaCEa jobs
cat deployment/cron/panacea.cron | grep -v "^#" | grep -v "^$" >> /tmp/current-crontab

# Install the updated crontab
crontab /tmp/current-crontab
```

### Method 3: System-wide (requires root)

```bash
# Copy to /etc/cron.d/
sudo cp deployment/cron/panacea.cron /etc/cron.d/panacea

# Ensure proper permissions
sudo chmod 644 /etc/cron.d/panacea
```

## Customization

### Adjust Schedule Times

Edit the cron expressions to match your needs:

- `0 0 * * *` = Daily at midnight
- `0 3 * * *` = Daily at 3 AM
- `0 4 * * 0` = Weekly on Sunday at 4 AM
- `*/30 * * * *` = Every 30 minutes

### Change Installation Path

If your application is not in `/opt/PANaCEa`, update the paths in the cron file:

```bash
sed -i 's|/opt/PANaCEa|/your/path/here|g' deployment/cron/panacea.cron
```

## Monitoring

### View Cron Logs

```bash
# Application logs
tail -f /opt/PANaCEa/logs/scheduler.log
tail -f /opt/PANaCEa/logs/health-check.log
tail -f /opt/PANaCEa/logs/cleanup.log

# System cron logs (varies by distribution)
# Ubuntu/Debian:
sudo tail -f /var/log/syslog | grep CRON

# RHEL/CentOS:
sudo tail -f /var/log/cron
```

### Verify Cron Jobs are Running

```bash
# List all cron jobs
crontab -l

# Check if jobs are executing
grep CRON /var/log/syslog
```

## Environment Variables

Cron jobs run in a minimal environment. Ensure:

1. **PATH includes Node.js:**

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
