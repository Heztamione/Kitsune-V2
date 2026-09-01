# Kitsune v2 — container image for HF Spaces, Render, Oracle Cloud, and any Docker host.
# Runs the full Node.js server in demo mode (in-memory DB, no PostgreSQL required).
# For persistent data or production-grade realtime, set DATABASE_URL / TURN_* as
# environment variables and the server will use PostgreSQL instead.

FROM node:20-slim

# The official node image already has a non-root `node` user with UID 1000.
ENV HOME=/home/node \
    PORT=7860 \
    NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /app

# Install production dependencies first (layer cache friendly).
# --omit=dev skips electron, electron-builder, capacitor (huge, unneeded on the server).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy the application source.
# Secrets (.env, cookies, backups) are kept out by .gitignore and never copied.
COPY --chown=node:node . .

# Ensure the persistence directory is writable by the non-root user.
# The memory-db module writes to $HOME/.local/share/kitsune by default on Linux.
RUN mkdir -p /home/node/.local/share/kitsune && chown -R node:node /home/node /app
VOLUME /home/node/.local/share/kitsune

USER node

EXPOSE 7860

# A SESSION_SECRET is required in production; if not set via environment, generate one.
# Data will reset when a newly generated secret replaces an existing persistence file.
CMD ["sh", "-c", "export SESSION_SECRET=\"${SESSION_SECRET:-$(node -e 'console.log(require(\"crypto\").randomBytes(48).toString(\"hex\"))')}\" && node server.js"]
