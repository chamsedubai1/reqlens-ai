#!/usr/bin/env bash
#
# ReqLens AI — one-shot Hostinger VPS setup.
# Run as ROOT, from inside the cloned repo:
#
#   bash deploy/setup.sh your-domain.com
#
# Optional 2nd argument = Ollama model to use (default: qwen2.5:7b).
# It installs Node, PostgreSQL, nginx, PM2, and Ollama+Qwen; creates the DB;
# builds the app; and starts it behind nginx. It prints the final HTTPS command.
set -euo pipefail

DOMAIN="${1:-}"
AI_MODEL_TAG="${2:-qwen2.5:7b}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash deploy/setup.sh your-domain.com [ollama-model]"
  exit 1
fi
if [ "$(id -u)" != "0" ]; then
  echo "Please run this as root (you are logged into a Hostinger VPS as root)."
  exit 1
fi

# Move to the repo root (this script lives in deploy/).
cd "$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(pwd)"
echo ">>> [1/8] Repo: $REPO   Domain: $DOMAIN   AI model: $AI_MODEL_TAG"

export DEBIAN_FRONTEND=noninteractive
echo ">>> [2/8] Installing system packages (Node, Postgres, nginx, PM2)..."
apt-get update -y
apt-get install -y curl git nginx postgresql postgresql-contrib sudo ca-certificates openssl
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm i -g pm2 >/dev/null 2>&1 || npm i -g pm2

echo ">>> [3/8] Installing Ollama + pulling Qwen ($AI_MODEL_TAG) — this can take several minutes..."
AI_OK=0
if command -v ollama >/dev/null 2>&1 || curl -fsSL https://ollama.com/install.sh | sh; then
  if ollama pull "$AI_MODEL_TAG"; then
    AI_OK=1
  fi
fi
if [ "$AI_OK" != "1" ]; then
  echo ">>> WARNING: Ollama/Qwen setup did not complete. Deploying with the built-in"
  echo ">>>          mock reviewer for now — you can wire Qwen later (see HOSTINGER.md)."
fi

echo ">>> [4/8] Creating the PostgreSQL database..."
DB_NAME=reqlens
DB_USER=reqlens
DB_PASS="$(openssl rand -hex 16)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb "${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo ">>> [5/8] Writing .env.production..."
SECRET="$(openssl rand -base64 48)"
{
  echo "DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
  echo "SESSION_SECRET=${SECRET}"
  if [ "$AI_OK" = "1" ]; then
    echo "AI_BASE_URL=http://127.0.0.1:11434/v1"
    echo "AI_MODEL=${AI_MODEL_TAG}"
  fi
} > .env.production
chmod 600 .env.production
set -a; . ./.env.production; set +a

echo ">>> [6/8] Installing app dependencies, migrating DB, building..."
npm ci
npm run db:migrate
npm run build:standalone

echo ">>> [7/8] Starting the app with PM2..."
pm2 delete reqlens >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || pm2 startup >/dev/null 2>&1 || true

echo ">>> [8/8] Configuring nginx for ${DOMAIN}..."
# Normalise to the apex domain so server_name covers both apex and www.
APEX="${DOMAIN#www.}"
sed "s/YOUR_DOMAIN/${APEX}/g" deploy/nginx-reqlens.conf > /etc/nginx/sites-available/reqlens
ln -sf /etc/nginx/sites-available/reqlens /etc/nginx/sites-enabled/reqlens
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx   # start it if it isn't running, otherwise apply the config

cat <<DONE

==================================================================
 ReqLens AI is running behind nginx on http://${APEX}

 FINAL STEP — turn on HTTPS (logins REQUIRE it), run these two:

   apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d ${APEX} -d www.${APEX}

 Then open:  https://${DOMAIN}   and click "Sign up" to create
 your admin account.

 (Database password is saved in ${REPO}/.env.production)
 AI reviewer: $( [ "$AI_OK" = "1" ] && echo "Qwen via Ollama ($AI_MODEL_TAG)" || echo "built-in mock (Qwen not set up)" )
==================================================================
DONE
