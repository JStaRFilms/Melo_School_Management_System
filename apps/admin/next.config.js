/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["100.84.230.66"],
  transpilePackages: [
    "@convex-dev/better-auth",
    "@school/auth",
    "@school/convex",
    "@school/shared",
    "better-auth",
  ],
};

module.exports = nextConfig;
