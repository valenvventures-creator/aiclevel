import type { NextConfig } from "next";

/**
 * ADR-0003: Cache Components is intentionally disabled.
 * Nearly every A.I. C-Level surface is authenticated, tenant-scoped and
 * request-dependent, so the classic dynamic rendering model is simpler and
 * safer. Revisit once public, cacheable surfaces grow (see docs/ARCHITECTURE.md).
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "thoughtauthorities.com" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
