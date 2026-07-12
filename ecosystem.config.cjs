// PM2 process config for the Next.js standalone server on a Hostinger VPS.
//
// Secrets (DATABASE_URL, SESSION_SECRET, AI_*) are read from the environment —
// export them before `pm2 start`, or add them to the `env` block on the server
// (do NOT commit real secrets). See deploy/HOSTINGER.md for the full runbook.
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
      // PM2 merges this with the inherited shell environment, so exported
      // DATABASE_URL / SESSION_SECRET / AI_* are available to the app.
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
