/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output so the app can be run on a Hostinger VPS with `node .next/standalone/server.js` behind nginx/PM2.
  output: "standalone",
};

export default nextConfig;
