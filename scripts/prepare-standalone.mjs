// After `next build` (output: "standalone"), the standalone folder ships a minimal
// server but NOT the static assets or /public — copy them in so CSS/JS/images load.
// Run via: npm run build:standalone
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";

const std = ".next/standalone";
if (!existsSync(std)) {
  console.error("No .next/standalone — run `next build` with output: 'standalone' first.");
  process.exit(1);
}

await cp(".next/static", `${std}/.next/static`, { recursive: true });
if (existsSync("public")) {
  await cp("public", `${std}/public`, { recursive: true });
}
console.log("Standalone assets prepared: .next/static (and public/ if present) copied into .next/standalone.");
