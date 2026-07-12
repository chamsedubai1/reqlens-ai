// PM2 process config for the Next.js standalone server on a Hostinger VPS.
//
// Secrets (DATABASE_URL, SESSION_SECRET, AI_*) are read from the shell
// environment AT `pm2 start` TIME and baked into the app's env (and saved by
// `pm2 save` for reboots). So: export them / source .env.production BEFORE
// `pm2 start ecosystem.config.cjs`. See deploy/HOSTINGER.md.
function pick(keys) {
  const out = {};
  for (const k of keys) {
    if (process.env[k] != null && process.env[k] !== "") out[k] = process.env[k];
  }
  return out;
}

module.exports = {
  apps: [
    {
      name: "reqlens",
      cwd: __dirname,
      script: ".next/standalone/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        // Interface the Next server binds to. Default localhost (nginx on the same
        // host proxies to it). When routing through a Traefik *container*, set
        // APP_HOST to that Docker network's gateway (e.g. 172.18.0.1) so the proxy
        // container can reach it while it stays off the public internet.
        // See deploy/traefik/README.md.
        HOSTNAME: process.env.APP_HOST || "127.0.0.1",
        ...pick(["DATABASE_URL", "SESSION_SECRET", "AI_BASE_URL", "AI_MODEL", "AI_API_KEY"]),
      },
    },
  ],
};
