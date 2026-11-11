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
  // Old "C-Suite" addresses, kept working after the rename to C-Level.
  async redirects() {
    return [
      { source: "/settings/c-suite", destination: "/settings/c-level", permanent: true },
      { source: "/settings/c-suite/:slug", destination: "/settings/c-level/:slug", permanent: true },
      { source: "/tutorials/c-suite-:topic(hq|sessions|memory|studio)", destination: "/tutorials/c-level-:topic", permanent: true },
    ];
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
