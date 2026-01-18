# Systemd Service Files

This directory contains systemd service files for running PANaCEa as system services on Linux.

## Installation

1. **Copy service files to systemd directory:**

   ```bash
   sudo cp deployment/systemd/*.service /etc/systemd/system/
   ```

2. **Create panacea user (if not exists):**

   ```bash
   sudo useradd -r -s /bin/false panacea
   ```

3. **Set proper ownership:**

   ```bash
   sudo chown -R panacea:panacea /opt/PANaCEa
   ```

4. **Reload systemd configuration:**

   ```bash
   sudo systemctl daemon-reload
   ```

5. **Enable services to start on boot:**

   ```bash
   sudo systemctl enable panacea-server
   sudo systemctl enable panacea-worker
   ```

6. **Start services:**
   ```bash
   sudo systemctl start panacea-server
   sudo systemctl start panacea-worker
   ```

## Management

### Check status:

```bash
sudo systemctl status panacea-server
sudo systemctl status panacea-worker
```

### View logs:

```bash
sudo journalctl -u panacea-server -f
sudo journalctl -u panacea-worker -f
```

### Restart services:

```bash
sudo systemctl restart panacea-server
sudo systemctl restart panacea-worker
```

### Stop services:

```bash
sudo systemctl stop panacea-server
sudo systemctl stop panacea-worker
```

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database configured
- Environment variables set in `/opt/PANaCEa/.env`
- Application installed at `/opt/PANaCEa`

## Security

The services run with restricted privileges:

- Dedicated `panacea` user with no login shell
- `NoNewPrivileges=true` prevents privilege escalation
- `PrivateTmp=true` provides isolated /tmp
- `ProtectSystem=strict` prevents writing to system directories
- `ReadWritePaths` only allows writing to logs directory

## Troubleshooting

If services fail to start:

1. Check logs: `sudo journalctl -u panacea-server -n 50`
2. Verify environment file exists: `ls -la /opt/PANaCEa/.env`
3. Check database connectivity
4. Ensure all npm packages are installed: `cd /opt/PANaCEa && npm install`
5. Verify file permissions: `ls -la /opt/PANaCEa`
