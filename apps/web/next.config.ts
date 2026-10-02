import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  transpilePackages: ["@guidelines/core"],
  agentRules: false,
  devIndicators: false,
  serverExternalPackages: ["chokidar"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  turbopack: { root: path.join(import.meta.dirname, "../..") },
};

export default config;
