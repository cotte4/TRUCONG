import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@dimadong/contracts", "@dimadong/game-engine", "@dimadong/ui"],
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
