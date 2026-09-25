import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` blocks dev resources for non-localhost origins; allow 127.0.0.1 and any
  // LAN hosts listed in DEV_ORIGINS (e.g. your laptop's IP, to test on the phone).
  allowedDevOrigins: ["127.0.0.1", ...(process.env.DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])],
  // Native/WASM and Node-only libraries stay out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "mammoth", "unpdf"],
  async headers() {
    return [
      {
        // Baseline hardening for every response.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
