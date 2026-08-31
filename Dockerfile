# Kitsune v2 — Hugging Face Spaces Docker image
# Runs the full Node.js server in demo mode (in-memory DB, no PostgreSQL required).
# For persistent data or production-grade realtime, set DATABASE_URL / TURN_* as
# Space Secrets in the HF Space settings and the server will use PostgreSQL instead.

FROM node:20-slim

# HF Spaces runs containers as a non-root user with UID 1000.
ENV HOME=/home/user \
    PORT=7860 \
    NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# Create the non-root user (HF Spaces convention).
RUN useradd -m -u 1000 user

WORKDIR /app

# Install production dependencies first (layer cache friendly).
# --omit=dev skips electron, electron-builder, capacitor (huge, unneeded on the server).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy the application source.
# Secrets (.env, cookies, backups) are kept out by .gitignore and never copied.
COPY --chown=user:user . .

# Ensure the persistence directory is writable by the non-root user.
# The memory-db module writes to $HOME/.local/share/kitsune by default on Linux.
RUN mkdir -p /home/user/.local/share/kitsune && chown -R user:user /home/user /app

USER user

EXPOSE 7860

# HF Spaces expects the app to listen on $PORT (default 7860).
# A SESSION_SECRET is required in production; if not set via Space Secrets,
# generate a random one at container start. Data will reset when that changes.
CMD ["sh", "-c", "export SESSION_SECRET=\"${SESSION_SECRET:-$(node -e 'console.log(require(\"crypto\").randomBytes(48).toString(\"hex\"))')}\" && node server.js"]
