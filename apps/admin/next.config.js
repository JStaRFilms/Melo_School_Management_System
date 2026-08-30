/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@convex-dev/better-auth",
    "@school/auth",
    "@school/convex",
    "@school/shared",
    "better-auth",
  ],
  experimental: {
    serverActions: {
      // Tailscale CGNAT range (100.64.0.0/10) + tailnet DNS
      allowedOrigins: [
        "100.64.*",
        "*.ts.net",
        "localhost:3002",
        "127.0.0.1:3002",
      ],
    },
  },
};

module.exports = nextConfig;
