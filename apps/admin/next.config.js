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
      allowedOrigins: [
        "100.*",
        "*.ts.net",
        "localhost:3002",
        "127.0.0.1:3002",
      ],
    },
  },
};

module.exports = nextConfig;
