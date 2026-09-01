---
title: Kitsune v2
emoji: 🦊
colorFrom: pink
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Black & pink gaming chat media — shrines, channels, DMs, voice/video.
tags:
  - chat
  - gaming
  - webrtc
  - nodejs
  - express
---

<!-- HF Space header above. The rest is the project README. -->

# Kitsune v2

Kitsune is a black-and-pink gaming communication platform with persistent accounts, shrines, channels, direct messages, presence, moderation, and WebRTC calls.

## Requirements

- Node.js 20 or newer
- PostgreSQL 15 or newer
- HTTPS/WSS for public browser use
- A TURN server for reliable voice, video, and screen sharing across mobile networks

## Configure PostgreSQL

Create a PostgreSQL login and database using pgAdmin or `psql`:

```sql
CREATE ROLE kitsune LOGIN PASSWORD 'use-a-strong-password';
CREATE DATABASE kitsune OWNER kitsune;
```

Copy `.env.example` to `.env` and replace every placeholder. Never commit or share `.env`.

Required production values:

- `DATABASE_URL`: PostgreSQL connection URL
- `SESSION_SECRET`: at least 64 random characters
- `ALLOWED_ORIGINS`: permanent HTTPS application origin when one is available
- `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`: TURN relay configuration

Apply the schema and start the server:

```bash
npm install
npm run db:migrate
npm start
```

Open:

- `http://localhost:8080/` — landing page
- `http://localhost:8080/app/` — application
- `http://localhost:8080/api/health` — database, WebSocket, and TURN health

## Public testing

Run `self-host-public.bat` or `host-kitsune-cloud-bridge.bat` to create a temporary Cloudflare Quick Tunnel. It provides HTTPS/WSS but is not permanent production hosting and its URL changes whenever the tunnel restarts.

## Render free deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Heztamione/Kitsune-V2)

One-click deploy to Render’s free web service tier.

- The container uses the `Dockerfile` at the repo root and listens on the `$PORT` provided by Render.
- It runs in **demo mode** (in-memory database, no PostgreSQL required).
- The free tier **sleeps after 15 minutes of inactivity** and takes 30 seconds to wake up. This makes it great for demos but unsuitable for 24/7 production chat.
- `SESSION_SECRET` is generated automatically by Render. Set it as an environment variable if you want stable sessions across redeploys.
- For a production deployment, create a managed PostgreSQL database on Render and set `DATABASE_URL`, then upgrade to a paid plan to avoid sleep.

Your app will be available at `https://kitsune-v2.onrender.com` (or a Render-assigned subdomain).

## Hugging Face Space deployment

This repo is configured to run as a Hugging Face Space (`sdk: docker` in the `README.md` front matter, with a `Dockerfile` at the repo root). The Space runs the full Kitsune server in **demo mode** — an in-memory database with disk persistence, no PostgreSQL required.

- The container listens on port `7860` (`app_port` in the front matter) and exposes the landing page at `/`, the app at `/app/`, and the WebSocket at `/ws`.
- Data persists in the container's writable layer at `/home/user/.local/share/kitsune/`. On the free tier this is ephemeral — accounts and messages reset when the Space is restarted or rebuilt. For durable data, set `DATABASE_URL` (and `DATABASE_SSL=1`) as a Space Secret and the server will switch to PostgreSQL.
- `SESSION_SECRET` is generated automatically at startup if not set. Set it as a Space Secret for stable sessions across restarts.
- For reliable WebRTC voice/video across networks, set `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL` as Space Secrets. Without TURN, calls still work between clients that can reach each other directly.

To deploy: push this repo to a Hugging Face Space (git remote `https://huggingface.co/spaces/<your-user>/kitsune-v2`). The Space builds the Docker image and serves it at `https://<your-user>-kitsune-v2.hf.space`.

## Downloadable applications

The landing page exposes downloads only when their build artifacts exist:

- `/downloads/windows` — Windows 10/11 x64 installer
- `/downloads/android` — signed Android 7+ APK
- `/app/` — installable PWA for Chrome and Edge

Both native clients ask for the current HTTPS Kitsune server URL. This lets them work with changing temporary tunnel URLs. Build release packages with:

```bash
npm run build:pc
npm run build:android
```

Artifacts are written to `releases/pc` and `releases/android` with SHA-256 checksum files. The Android signing key is generated outside the repository under `%LOCALAPPDATA%\Kitsune\signing`; back it up securely because all future APK updates must use the same key. Public Windows releases should be signed with a trusted code-signing certificate to avoid SmartScreen warnings.

## Security model

- Passwords are hashed server-side with bcrypt cost 12.
- Authentication uses opaque, expiring, HTTP-only, SameSite cookies.
- WebSocket identities come from server sessions; clients cannot choose a user ID or role.
- Shrines, memberships, messages, DMs, friendships, blocks, bans, and sessions persist in PostgreSQL.
- Tenko/Admin actions are authorized by the server.
- HTTP and WebSocket payloads are size-limited and rate-limited.
- Browser security headers and same-origin mutation checks are enabled.
- The former browser-visible owner key has been removed. The first registered database account becomes Tenko and owns the public shrine.

## Realtime features

- Persistent shrine channel messages
- Persistent one-to-one direct messages between accepted friends
- Online, idle, do-not-disturb, and offline presence
- Friend requests, acceptance, removal, blocking, and unblocking
- Server-authorized promotion, demotion, kick, ban, and history clearing
- Authenticated WebSocket reconnect and heartbeat
- Incoming DM call invitations with accept/decline
- WebRTC voice, video, screen sharing, and small-group voice-channel mesh

The current group call implementation is a small-group peer mesh. Discord-scale calls require an SFU such as LiveKit plus TURN and Redis; a mesh should be limited to approximately 4–6 active participants.

## Verification

```bash
npm run check
npm test
npm audit
```

Full database and multi-browser integration tests require a configured PostgreSQL test database and TURN relay.

## Project structure

```text
Kitsune v2/
├── .env.example
├── package.json
├── server.js
├── src/server/
│   ├── auth.js
│   ├── config.js
│   ├── db.js
│   ├── migrate.js
│   ├── realtime.js
│   ├── schema.sql
│   └── services.js
├── src/renderer/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/kitsune-logo.png
└── website/
    ├── index.html
    ├── styles.css
    └── assets/kitsune-logo.png
```
