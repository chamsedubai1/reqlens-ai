import { existsSync } from "node:fs";

// Scripts run outside Next.js, so load .env.local (dev) when present. On the VPS
// the variables come from the sourced .env.production instead.
export function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}
