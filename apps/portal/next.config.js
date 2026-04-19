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
};

module.exports = nextConfig;
