# Deploying ReqLens AI to Hostinger (VPS)

ReqLens AI is a Next.js app that needs a **Node.js server** (SSR + Server Actions),
a **PostgreSQL** database, and (optionally) an AI endpoint. That means a
**Hostinger VPS** (Ubuntu, root SSH) — Hostinger's shared/web hosting (PHP/LiteSpeed)
cannot run it. If you only have a domain + shared hosting, add a VPS plan; you can
still use your existing domain (below).

Everything below runs **on the VPS over SSH**.

---

## 0. Point your domain at the VPS
In Hostinger's hPanel → your VPS, note its **IP address**. Then in hPanel → Domains →
your domain → **DNS / Nameservers**, set/point DNS to the VPS:

- `A` record: `@` → `VPS_IP`
- `A` record: `www` → `VPS_IP`

(If the domain uses Hostinger nameservers, edit the DNS zone. Allow up to a few hours
to propagate; check with `ping YOUR_DOMAIN`.)

## 1. Base server setup
```bash
sudo apt update && sudo apt -y upgrade
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs git nginx postgresql postgresql-contrib
sudo npm i -g pm2
node -v   # should print v20.x
```

## 2. PostgreSQL: create the database + user
```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE reqlens;
CREATE USER reqlens WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG';
GRANT ALL PRIVILEGES ON DATABASE reqlens TO reqlens;
\c reqlens
GRANT ALL ON SCHEMA public TO reqlens;
SQL
```
Your connection string will be:
`postgres://reqlens:CHANGE_ME_STRONG@localhost:5432/reqlens`

## 3. Get the code + install
```bash
cd /var/www           # or wherever you keep apps
git clone https://github.com/chamsedubai1/reqlens-ai.git
cd reqlens-ai
npm ci
```

## 4. Environment variables
Create `/var/www/reqlens-ai/.env.production` (never commit it):
```bash
cat > .env.production <<'ENV'
DATABASE_URL=postgres://reqlens:CHANGE_ME_STRONG@localhost:5432/reqlens
SESSION_SECRET=PASTE_A_32+_CHAR_RANDOM_STRING   # openssl rand -base64 48

# --- AI reviewer (pick one; leave all blank to use the keyless mock) ---
# Qwen via Ollama on this VPS:
# AI_BASE_URL=http://127.0.0.1:11434/v1
# AI_MODEL=qwen2.5:7b
# Qwen via Alibaba DashScope (no local model needed):
# AI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
# AI_MODEL=qwen-plus
# AI_API_KEY=sk-...
ENV
```
Load it into your shell for the migrate/build/start steps:
```bash
set -a; . ./.env.production; set +a
```

## 5. Migrate (and optionally seed demo data)
```bash
npm run db:migrate
npm run db:seed     # optional — creates the demo workspace (demo@reqlens.test / password123)
```

## 6. Build the standalone server + start with PM2
```bash
npm run build:standalone       # builds + copies static assets into .next/standalone
pm2 start ecosystem.config.cjs # runs on 127.0.0.1:3000
pm2 save                       # persist the process list
pm2 startup                    # run the printed command so it survives reboots
pm2 logs reqlens               # check it booted cleanly
```
> The app binds to `127.0.0.1:3000` (local only); nginx exposes it publicly.
> PM2 inherits the env you sourced in step 4, so `DATABASE_URL`, `SESSION_SECRET`,
> and `AI_*` are available to the running app.

## 7. nginx reverse proxy + HTTPS
```bash
sudo cp deploy/nginx-reqlens.conf /etc/nginx/sites-available/reqlens
sudo sed -i 's/YOUR_DOMAIN/your-domain.com/g' /etc/nginx/sites-available/reqlens
sudo ln -s /etc/nginx/sites-available/reqlens /etc/nginx/sites-enabled/reqlens
sudo nginx -t && sudo systemctl reload nginx

# TLS (Let's Encrypt) — REQUIRED: sessions use Secure cookies, so the app only
# works over HTTPS in production.
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
Open `https://your-domain.com` — you should see the ReqLens AI landing page.

## 8. Updating after you push changes
```bash
cd /var/www/reqlens-ai
git pull
npm ci
set -a; . ./.env.production; set +a
npm run db:migrate          # applies any new migrations
npm run build:standalone
pm2 restart reqlens
```

---

## Notes

- **HTTPS is mandatory**, not optional: in production the session cookie is marked
  `Secure`, so logins only persist over `https://`. Finish step 7's certbot before testing.
- **AI provider / Qwen sizing:** a self-hosted Qwen on a **CPU-only** VPS is slow —
  a 7B model may take 10–60s per review and needs plenty of RAM (16 GB+ recommended;
  use a quantized model like `qwen2.5:7b`). For a small VPS, prefer **DashScope**
  (hosted Qwen API) or leave the AI vars blank to run the built-in **mock** reviewer.
  You can switch anytime by editing `.env.production` and `pm2 restart reqlens`.
- **Firewall:** allow 80/443 (`sudo ufw allow 'Nginx Full'`) and keep Postgres on
  localhost (do not expose 5432 publicly).
- **Backups:** `pg_dump reqlens > backup.sql` on a schedule.
