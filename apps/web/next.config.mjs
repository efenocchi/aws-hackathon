// API calls go through the web origin and are proxied server-side, so a single
// forwarded port (remote dev / tunnels) serves the whole app. Set
// NEXT_PUBLIC_API_URL to bypass the proxy and hit the API directly.
const API = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  transpilePackages: ["@aas/openui-lib"],
  async rewrites() {
    return [
      "/health",
      "/skills/:path*",
      "/transactions",
      "/wallets",
      "/events",
      "/jobs/:path*",
      "/renders/:path*",
    ].map((source) => ({ source, destination: `${API}${source}` }));
  },
};
