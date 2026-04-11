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
  headers: async () => [
    {
      // HTML pages — always revalidate so new deploys are picked up immediately
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
