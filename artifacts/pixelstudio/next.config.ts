import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/db"],

  serverExternalPackages: ["bcryptjs", "jsonwebtoken"],

  // Allow Replit proxy domains for dev cross-origin requests
  allowedDevOrigins: [
    "*.replit.dev",
    "*.spock.replit.dev",
    "*.replit.app",
    process.env.REPLIT_DEV_DOMAIN ?? "",
  ].filter(Boolean),

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
