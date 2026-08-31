# Kitsune v2 on Oracle Cloud Free Tier

This directory contains everything needed to run Kitsune v2 24/7 for free on an Oracle Cloud Always-Free VM.

## Why Oracle Cloud?

- **Always-Free compute** (1 Ampere ARM or 2 AMD VMs)
- **Stays awake** (no sleep/cold start like Render or Glitch)
- **Real public IP** + HTTPS with Caddy + Let's Encrypt
- **Suitable for a real chat server**

## Requirements

1. An Oracle Cloud account with Always-Free compute
2. A free domain/subdomain pointed at your VM's public IP
   - Easiest: create a free `duckdns.org` subdomain and point its A record to your VM IP
3. An SSH key to connect to the VM

## Quick start

1. **Create an Always-Free VM** in the Oracle Cloud Console:
   - Shape: `VM.Standard.A1.Flex` (Ampere ARM, 2 OCPUs, 12 GB RAM recommended) or `VM.Standard.E2.1.Micro`
   - OS: **Canonical Ubuntu 22.04**
   - Add an **ingress rule** for ports **80, 443** in the subnet security list
   - Note the **public IP**

2. **Point a domain to the VM**:
   - Go to https://www.duckdns.org, create a subdomain like `kitsune`
   - Set its A record to your VM's public IP
   - Your domain will be `kitsune.duckdns.org`

3. **SSH into the VM and run**:

   ```bash
   export KITSUNE_DOMAIN=kitsune.duckdns.org
   export KITSUNE_EMAIL=your-email@example.com
   bash <(curl -L https://raw.githubusercontent.com/Heztamione/Kitsune-V2/main/setup/oracle-cloud/install.sh)
   ```

   Or clone the repo first and run locally:

   ```bash
   git clone https://github.com/Heztamione/Kitsune-V2.git
   cd kitsune-v2/setup/oracle-cloud
   export KITSUNE_DOMAIN=kitsune.duckdns.org
   export KITSUNE_EMAIL=your-email@example.com
   ./install.sh
   ```

4. **Wait 3–5 minutes**, then open:
   - Landing page: `https://kitsune.duckdns.org`
   - App: `https://kitsune.duckdns.org/app/`
   - Health: `https://kitsune.duckdns.org/api/health`

## What the installer does

- Installs Docker and Caddy
- Opens ports 80 and 443
- Builds and runs Kitsune with Docker Compose
- Creates a Docker volume for in-memory DB persistence
- Configures Caddy as an HTTPS reverse proxy with a free Let's Encrypt certificate

## Important notes

- The default setup runs in **demo mode** (in-memory database). Data persists in the Docker volume as long as the VM runs.
- For true persistence, set `DATABASE_URL` in `docker-compose.yml` to a PostgreSQL server and redeploy.
- WebRTC voice/video works best with a TURN server. Set `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL` in `docker-compose.yml` if you have one.

## Management

```bash
cd kitsune-v2/setup/oracle-cloud

# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose up -d

# Update to the latest version
cd kitsune-v2 && git pull
cd setup/oracle-cloud && docker compose up --build -d
```

## Troubleshooting

- **Caddy fails to get a certificate**: Make sure port 80 is open and the domain's A record points to the VM IP.
- **Can't reach the site**: Check Oracle Cloud security list / NSG rules for ports 80 and 443.
- **Docker permission denied**: Log out and SSH back in, or run with `sudo`.
