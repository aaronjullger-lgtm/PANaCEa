# Startup Commands — Mission Control, 9Router, 9Remote & Friends

Local agent-infra control plane. Everything below runs on this Mac (darwin, Node 22).

## Quick reference

| Service | URL | Start | Status check |
|---|---|---|---|
| Mission Control | http://localhost:3000 | `bash scripts/mc-up.sh` | `curl -s http://127.0.0.1:3000/api/health` |
| 9Router dashboard | http://localhost:20128 | `9router` | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:20128/api/health` |
| 9Remote (remote terminal) | http://localhost:2208 | `9remote` / `9remote ui` | `curl -s http://127.0.0.1:2208/api/health` |
| Qdrant vector DB (Docker) | localhost:6333 | `docker start qdrant` | `docker ps --filter name=qdrant` |

All start commands are **idempotent** — safe to re-run; they detect an already-running service and skip.

---

## 1. Mission Control

Self-hosted control plane for operating AI agents (dispatch tasks, inspect runs, review failures, track spend). Next.js + SQLite at `~/MissionControl`.

```bash
cd ~/MissionControl

# Dev server (default)
bash scripts/mc-up.sh

# Variants
bash scripts/mc-up.sh --no-browser   # don't open Firefox
bash scripts/mc-up.sh --prod         # pnpm build && pnpm start (production mode)
bash scripts/mc-up.sh --local        # skip Cloudflare tunnel
bash scripts/mc-up.sh --tunnel       # force Cloudflare quick tunnel
```

What `mc-up.sh` does (in order): starts the server if not running → verifies runtime connections (Claude Code, Codex, 1Password, OpenClaw) → checks SQLite health → starts Qdrant container if Docker is available → starts Cloudflare quick tunnel (unless `--local`) → prints status board + public URL.

Health / status:

```bash
curl -s http://127.0.0.1:3000/api/health        # {"status":"ok","db":"ok",...}
curl -s http://127.0.0.1:3000/api/health | python3 -m json.tool
bash scripts/station-doctor.sh                  # deeper runtime diagnostics
node scripts/mc-cli.cjs --help                  # headless CLI for dispatch/status
node scripts/mc-tui.cjs                         # terminal UI
```

Logs / state:

```bash
tail -f ~/MissionControl/.data/mc-dev.log       # dev server log
cat ~/MissionControl/.data/mc.pid               # server PID
cat ~/MissionControl/.data/cloudflared.pid      # tunnel PID
grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" ~/MissionControl/.data/cloudflared.log | head -1   # public URL
```

Stop:

```bash
kill "$(cat ~/MissionControl/.data/mc.pid)"            # stop server
kill "$(cat ~/MissionControl/.data/cloudflared.pid)"    # stop tunnel (if you want it down)
```

Notes: first-ever local setup needs `http://localhost:3000/setup` to create the admin account (already done on this machine). First run requires `nvm use 22 && pnpm install`.

---

## 2. 9Router

FREE AI router + token saver (RTK compression, subscription → cheap → free fallback). Local gateway on port **20128**, dashboard included. Global install: `~/.local/lib/node_modules/9router`.

```bash
# Start (foreground)
9router

# Background variants
9router -t          # system tray mode (background; right-click tray to quit/open)
9router -n          # don't auto-open browser
9router -n -t       # background + no browser (used for headless starts)
9router -l          # show server logs in terminal
9router -p 20128 -H 0.0.0.0   # explicit port/host
9router --skip-update         # skip auto-update check
```

Dashboard: **http://localhost:20128** (providers, quota tracking, model routing).

Connect any CLI tool to it (endpoint `http://localhost:20128/v1`, API key from dashboard):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:20128/api/health   # expect 200
```

Stop: quit from the tray icon, or `pkill -f 9router` (check `pgrep -fl 9router` first).

Data/state lives in `~/.9router/` (db, auth, jwt-secret, tunnel, logs). Logs: `~/.9router/logs/`.

### Capabilities (OpenAI-compatible REST)

Base URL `http://localhost:20128/v1` (or `NINEROUTER_URL`), optional key from Dashboard → Keys if `requireApiKey` is on. Skills in `.agents/skills/9router*` cover each capability.

| Capability | Endpoint | Providers |
| --- | --- | --- |
| Chat / codegen | `/v1/chat/completions`, `/v1/messages` | OpenAI / Anthropic formats, streaming, auto-fallback |
| Image gen | `/v1/images/generations` | OpenAI, Imagen, DALL-E, FLUX, MiniMax, SDWebUI, ComfyUI, Codex |
| TTS | `/v1/audio/speech` | ElevenLabs, Edge TTS, Google, Hyperbolic voices |
| STT | `/v1/audio/transcriptions` | Whisper, Groq, Gemini, Deepgram, AssemblyAI, NVIDIA |
| Embeddings | `/v1/embeddings` | OpenAI, Gemini, Mistral, Voyager, Nvidia, GitHub |
| Web search | `/v1/search` | Tavily, Exa, Brave, Serper, SearXNG, Google PSE, Perplexity |
| Web fetch | `/v1/web/fetch` | Firecrawl, Jina Reader, Tavily Extract, Exa Contents |
| Models | `/v1/models[/image\|tts\|embedding\|web\|stt\|image-to-text]` | Model discovery per capability |

```bash
curl -s http://127.0.0.1:20128/v1/models | head -c 300   # model list
```

---

## 3. 9Remote

Remote terminal access from anywhere (persistent PTY sessions). Web UI dashboard on port **2208**. Global install: `~/.local/lib/node_modules/9remote`.

```bash
# Start server + UI (dashboard at localhost:2208)
9remote
9remote ui          # explicit web-UI mode
```

Health:

```bash
curl -s http://127.0.0.1:2208/api/health   # {"status":"ok",...}
```

State: `~/.9remote/` (keys, daemon, pty-daemon.sock, pids, tunnel). Stop: `pkill -f "9remote/dist/server.cjs"` (or quit via its tray/UI).

> Cloudflare tunnel permissions: if the tunnel fails, grant permissions in System Settings → Privacy & Security, then restart 9Remote.

---

## 4. Extras / supporting services

```bash
# Qdrant vector DB (used by Mission Control + qdrant MCP)
docker start qdrant                       # start if stopped
docker ps --filter name=qdrant            # verify
# (auto-started by mc-up.sh when Docker is running)

# OpenClaw agent runtime (optional; enables live session streaming)
openclaw --version                        # verify availability

# Mission Control notification daemon + agent heartbeat (optional)
bash ~/MissionControl/scripts/notification-daemon.sh
bash ~/MissionControl/scripts/agent-heartbeat.sh
```

---

## Boot order (from cold)

```bash
# 1. Docker daemon (if Qdrant needed) — usually auto-starts on login
docker info >/dev/null 2>&1 || open -a Docker

# 2. Mission Control (also starts Qdrant + tunnel)
cd ~/MissionControl && bash scripts/mc-up.sh --no-browser

# 3. 9Router
nohup 9router -n -t --skip-update > ~/.9router/logs/startup.log 2>&1 &

# 4. 9Remote
9remote
```

## Verification (everything up)

```bash
curl -s http://127.0.0.1:3000/api/health          # Mission Control
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:20128/api/health   # 9Router
curl -s http://127.0.0.1:2208/api/health          # 9Remote
docker ps --filter name=qdrant                    # Qdrant
lsof -iTCP:3000 -P | tail -1 && lsof -iTCP:20128 -P | tail -1 && lsof -iTCP:2208 -P | tail -1
```

> Tunnel URLs are ephemeral — they change on every restart. Use `--local` or a named tunnel for a permanent URL.

> Secrets (API keys, tunnel tokens) come from 1Password `Code` vault via `op://` refs — never hardcode.
