# Deploying behind an EXISTING Traefik (Docker) reverse proxy

Use this path **instead of** the nginx setup in `../HOSTINGER.md` when the VPS
already runs a Traefik reverse proxy in Docker that owns ports 80/443 (e.g. a box
that also hosts n8n, Coolify, or other Dockerized apps). We don't fight Traefik for
the ports — we add **one small nginx proxy container** that Traefik auto-discovers
via labels and gives your domain + automatic HTTPS, exactly like its other services.

The ReqLens app itself still runs on the host via PM2 (see `../HOSTINGER.md`
steps 1–6), but bound to the Docker gateway so the proxy container can reach it and
the port is never exposed publicly.

## 1. Bind the app to the Docker gateway (not localhost)

The proxy container can't reach the host's `127.0.0.1`. Bind the app to the gateway
of Traefik's Docker network instead. Find that network + gateway:

```bash
docker inspect <traefik-container> --format '{{json .NetworkSettings.Networks}}'
# note the network NAME (e.g. root_default) and its Gateway (e.g. 172.18.0.1)
```

Set the app's bind host to that gateway and restart PM2:

```bash
cd ~/reqlens-ai
# ecosystem.config.cjs reads APP_HOST (default 127.0.0.1)
APP_HOST=172.18.0.1 pm2 restart ecosystem.config.cjs --update-env
curl -s -o /dev/null -w '%{http_code}\n' http://172.18.0.1:3000   # expect 200/307
```

## 2. Match your Traefik's entrypoints + cert resolver

Inspect a working service's labels to copy the exact recipe your Traefik expects:

```bash
docker inspect <an-existing-service> --format '{{json .Config.Labels}}'
```

Note the `entrypoints` (e.g. `web,websecure`) and `certresolver` (e.g. `mytlschallenge`),
then edit `docker-compose.yml` below if yours differ. Also update:
- the network name under `networks:` (external) and `traefik.docker.network`
- the `Host(...)` rule with your domain
- `proxy_pass` in `reqlens.conf` with your gateway IP

## 3. Start the proxy

```bash
mkdir -p ~/reqlens-ingress
cp deploy/traefik/reqlens.conf deploy/traefik/docker-compose.yml ~/reqlens-ingress/
cd ~/reqlens-ingress && docker compose up -d
```

Traefik discovers it within seconds and issues the certificate on the first HTTPS
request (DNS for your domain must already point at this VPS). Verify:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain.com   # expect 200/307
```

## Updating the app later

The proxy never changes. To ship app updates:

```bash
cd ~/reqlens-ai && git pull && npm ci
set -a; . ./.env.production; set +a
npm run db:migrate && npm run build:standalone
APP_HOST=172.18.0.1 pm2 restart ecosystem.config.cjs --update-env
```
