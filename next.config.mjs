/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output so the app can be run on a Hostinger VPS with `node .next/standalone/server.js` behind nginx/PM2.
  output: "standalone",
  // Transformers.js (Coach embeddings) loads native ONNX Runtime binaries; keep it
  // out of the server bundle so Node resolves it from node_modules at runtime.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
