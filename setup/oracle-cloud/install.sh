#!/usr/bin/env bash
# Oracle Cloud Free Tier — one-command Kitsune v2 installer
# Run on a fresh Ubuntu 22.04/24.04 Always-Free VM as a user with sudo.
# Usage:
#   export KITSUNE_DOMAIN=kitsune.duckdns.org
#   export KITSUNE_EMAIL=your-email@example.com
#   bash <(curl -L https://raw.githubusercontent.com/YOUR_GH_USER/kitsune-v2/main/setup/oracle-cloud/install.sh)

set -euo pipefail

echo "=== Kitsune v2 — Oracle Cloud Free Tier installer ==="

# ---- Configuration ----
KITSUNE_DOMAIN="${KITSUNE_DOMAIN:-}"
KITSUNE_EMAIL="${KITSUNE_EMAIL:-}"
KITSUNE_REPO="${KITSUNE_REPO:-https://github.com/Heztamione/kitsune-v2.git}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 48)}"

if [[ -z "$KITSUNE_DOMAIN" ]]; then
  echo "ERROR: Set KITSUNE_DOMAIN, e.g. export KITSUNE_DOMAIN=kitsune.duckdns.org"
  exit 1
fi

if [[ -z "$KITSUNE_EMAIL" ]]; then
  echo "ERROR: Set KITSUNE_EMAIL for Let's Encrypt, e.g. export KITSUNE_EMAIL=you@example.com"
  exit 1
fi

# ---- Base packages ----
echo "[*] Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git jq ufw

# ---- Docker ----
echo "[*] Installing Docker..."
if ! command -v docker &>/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  newgrp docker || true
fi

# ---- Caddy (for HTTPS reverse proxy) ----
echo "[*] Installing Caddy..."
if ! command -v caddy &>/dev/null; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update
  sudo apt-get install -y caddy
fi

# ---- Firewall ----
echo "[*] Opening ports 22, 80, and 443..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

# ---- Clone / update Kitsune ----
INSTALL_DIR="$HOME/kitsune-v2"
if [[ -d "$INSTALL_DIR" ]]; then
  echo "[*] Updating existing Kitsune repo..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "[*] Cloning Kitsune repo..."
  git clone "$KITSUNE_REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---- Install with Docker Compose ----
echo "[*] Building and starting Kitsune..."
cd "$INSTALL_DIR/setup/oracle-cloud"

# Ensure Docker is usable in this session
if ! docker info &>/dev/null; then
  echo "WARN: Docker not accessible in this shell; trying sudo."
  sudo docker info || true
fi

# Create .env for Docker Compose
cat > .env <<EOF
SESSION_SECRET=$SESSION_SECRET
KITSUNE_DOMAIN=$KITSUNE_DOMAIN
KITSUNE_EMAIL=$KITSUNE_EMAIL
EOF

# Build and start
# Determine whether we can run docker without sudo in this shell
if docker info &>/dev/null; then
  DOCKER="docker"
elif sudo -n docker info &>/dev/null; then
  DOCKER="sudo -E docker"
else
  echo "ERROR: Docker is installed but not accessible. Try logging out and back in, or run this script as root."
  exit 1
fi

$DOCKER compose down 2>/dev/null || true
$DOCKER compose up --build -d

# ---- Configure Caddy ----
echo "[*] Configuring Caddy for $KITSUNE_DOMAIN..."
# Substitute domain/email into the Caddyfile before installing it
sed -e "s|__KITSUNE_DOMAIN__|$KITSUNE_DOMAIN|g" -e "s|__KITSUNE_EMAIL__|$KITSUNE_EMAIL|g" Caddyfile | sudo tee /etc/caddy/Caddyfile >/dev/null

sudo systemctl enable caddy || true
sudo systemctl reload caddy || sudo systemctl restart caddy || sudo systemctl start caddy

# ---- Health check ----
echo "[*] Waiting for Kitsune to be healthy..."
for i in {1..30}; do
  if curl -fsS "https://$KITSUNE_DOMAIN/api/health" &>/dev/null || curl -fsS "http://127.0.0.1:7860/api/health" &>/dev/null; then
    break
  fi
  sleep 2
done

# ---- Summary ----
IP=$(curl -s -4 ifconfig.me 2>/dev/null || echo "<your VM public IP>")
cat <<EOF

=== Kitsune v2 is deployed ===

Public URL: https://$KITSUNE_DOMAIN
Public IP:  $IP
Admin:      https://$KITSUNE_DOMAIN/api/health
App:        https://$KITSUNE_DOMAIN/app/

The first registered account becomes "Tenko" (owner).

Data is stored in a Docker volume named kitsune-data.
It persists across container restarts but is tied to this VM.
To back it up: docker run --rm -v kitsune-data:/data -v \$(pwd):/backup alpine tar czf /backup/kitsune-data.tar.gz -C /data .

View logs:  cd kitsune-v2/setup/oracle-cloud && docker compose logs -f
Stop:      cd kitsune-v2/setup/oracle-cloud && docker compose down
Update:    cd kitsune-v2 && git pull && cd setup/oracle-cloud && docker compose up --build -d

Session secret is saved in:
  $INSTALL_DIR/setup/oracle-cloud/.env
EOF
